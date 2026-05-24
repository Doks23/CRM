import type { gmail_v1 } from "googleapis";

export interface ForwardedEmailInfo {
  isForwarded: boolean;
  originalFromName: string | null;
  originalFromEmail: string | null;
  originalSubject: string | null;
  originalDate: string | null;
  originalTo: string | null;
  forwarderName: string | null;
  forwarderEmail: string | null;
  /** The forwarded content after the forwarded header (the part written by forwarder is separate). */
  forwardedContent: string | null;
}

export interface ParsedMessage {
  gmailMessageId: string;
  gmailThreadId: string;
  receivedAt: Date;
  fromName: string | null;
  fromEmail: string | null;
  toEmails: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string;
  labelIds: string[];
  /** True when the message has the `SENT` label (we wrote it). */
  isOutbound: boolean;
  /** If this is a LinkedIn notification email */
  isLinkedInNotification: boolean;
  /** Forwarded email metadata */
  forwarded: ForwardedEmailInfo | null;
}

/** Decode a Gmail base64url body part to a UTF-8 string. */
function decodeBase64Url(data: string): string {
  // Gmail uses base64url; convert to standard base64 then decode.
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

/** Walk MIME parts and collect the best plain-text and HTML bodies. */
function extractBodies(payload: gmail_v1.Schema$MessagePart | undefined): {
  text: string;
  html: string;
} {
  let text = "";
  let html = "";

  function visit(part: gmail_v1.Schema$MessagePart) {
    const mimeType = part.mimeType ?? "";
    const data = part.body?.data;

    if (data) {
      const decoded = decodeBase64Url(data);
      if (mimeType === "text/plain" && !text) text = decoded;
      else if (mimeType === "text/html" && !html) html = decoded;
    }

    if (part.parts) part.parts.forEach(visit);
  }

  if (payload) visit(payload);
  return { text, html };
}

function header(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const h = headers.find(
    (x) => x.name?.toLowerCase() === name.toLowerCase(),
  );
  return h?.value ?? undefined;
}

/** Parse "Display Name <user@example.com>" → {name, email}. */
function parseAddress(raw: string | undefined): {
  name: string | null;
  email: string | null;
} {
  if (!raw) return { name: null, email: null };
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1]?.trim() || null, email: match[2].trim() };
  }
  // Bare email like "user@example.com"
  if (raw.includes("@")) return { name: null, email: raw.trim() };
  return { name: raw.trim() || null, email: null };
}

function parseAddressList(raw: string | undefined): string[] {
  if (!raw) return [];
  const result: string[] = [];
  let current = "";
  let inQuote = false;
  for (const ch of raw) {
    if (ch === '"') { inQuote = !inQuote; current += ch; continue; }
    if (ch === "," && !inQuote) {
      const parsed = parseAddress(current.trim()).email;
      if (parsed) result.push(parsed);
      current = "";
      continue;
    }
    current += ch;
  }
  const parsed = parseAddress(current.trim()).email;
  if (parsed) result.push(parsed);
  return result;
}

export function parseGmailMessage(
  msg: gmail_v1.Schema$Message,
): ParsedMessage | null {
  if (!msg.id || !msg.threadId) return null;

  const headers = msg.payload?.headers;
  const fromRaw = header(headers, "From");
  const toRaw = header(headers, "To");
  const subject = header(headers, "Subject") ?? "";
  const dateRaw = header(headers, "Date");

  const { name: fromName, email: fromEmail } = parseAddress(fromRaw);
  const toEmails = parseAddressList(toRaw);

  const receivedAt = msg.internalDate
    ? new Date(Number(msg.internalDate))
    : dateRaw
      ? new Date(dateRaw)
      : new Date();

  const { text, html } = extractBodies(msg.payload);
  const bodyText = text || stripHtml(html);
  const labelIds = msg.labelIds ?? [];

  const isLinkedIn = isLinkedInEmail(fromEmail);
  const forwarded = detectForwardedEmail(subject, bodyText, fromEmail, fromName);

  return {
    gmailMessageId: msg.id,
    gmailThreadId: msg.threadId,
    receivedAt,
    fromName,
    fromEmail,
    toEmails,
    subject,
    bodyText,
    bodyHtml: html,
    labelIds,
    isOutbound: labelIds.includes("SENT"),
    isLinkedInNotification: isLinkedIn,
    forwarded,
  };
}

/** Minimal HTML → text fallback when we only have HTML. */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detect LinkedIn notification-style sender domains. */
export function isLinkedInEmail(email: string | null): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return domain === "linkedin.com" || domain === "e.linkedin.com";
}

/** Detect if subject indicates a forwarded email. */
function isForwardedSubject(subject: string): boolean {
  const s = subject.trim().toLowerCase();
  return s.startsWith("fwd:") || s.startsWith("fw:") || s.startsWith("re: fwd:");
}

/**
 * Parse forwarded email from body text.
 *
 * Detects patterns like:
 * ---------- Forwarded message ----------
 * From: John Doe <john@example.com>
 * Date: Mon, Jan 15, 2024 at 10:00 AM
 * Subject: Inquiry about makhana
 * To: saurabh@whitepops.com
 */
function parseForwardedFromBody(
  bodyText: string,
  currentFromEmail: string | null,
  currentFromName: string | null,
): ForwardedEmailInfo | null {
  if (!bodyText) return null;

  const forwardedPatterns = [
    /-{10,}\s*Forwarded message\s*-{10,}/i,
    /Begin forwarded message:/i,
    /^Fwd:/m,
  ];

  let matchIndex = -1;
  for (const pattern of forwardedPatterns) {
    const match = bodyText.match(pattern);
    if (match && match.index !== undefined) {
      matchIndex = match.index;
      break;
    }
  }

  if (matchIndex === -1) return null;

  const headerSection = bodyText.slice(matchIndex);

  const info: ForwardedEmailInfo = {
    isForwarded: true,
    originalFromName: null,
    originalFromEmail: null,
    originalSubject: null,
    originalDate: null,
    originalTo: null,
    forwarderName: currentFromName,
    forwarderEmail: currentFromEmail,
    forwardedContent: null,
  };

  const fromMatch = headerSection.match(/From:\s*([^\n]+)/i);
  if (fromMatch) {
    const parsed = parseAddress(fromMatch[1].trim());
    info.originalFromName = parsed.name;
    info.originalFromEmail = parsed.email;
  }

  const subjectMatch = headerSection.match(/Subject:\s*([^\n]+)/i);
  if (subjectMatch) {
    info.originalSubject = subjectMatch[1].trim();
  }

  const dateMatch = headerSection.match(/Date:\s*([^\n]+)/i);
  if (dateMatch) {
    info.originalDate = dateMatch[1].trim();
  }

  const toMatch = headerSection.match(/To:\s*([^\n]+)/i);
  if (toMatch) {
    info.originalTo = toMatch[1].trim();
  }

  const firstBlankLineAfterHeader = headerSection.indexOf("\n\n");
  if (firstBlankLineAfterHeader > 0) {
    info.forwardedContent = headerSection.slice(firstBlankLineAfterHeader).trim();
  }

  if (!info.originalFromEmail && !info.originalSubject) {
    return null;
  }

  return info;
}

/** Detect and parse forwarded email. */
function detectForwardedEmail(
  subject: string,
  bodyText: string,
  fromEmail: string | null,
  fromName: string | null,
): ForwardedEmailInfo | null {
  if (isForwardedSubject(subject)) {
    const parsed = parseForwardedFromBody(bodyText, fromEmail, fromName);
    if (parsed) return parsed;
    return {
      isForwarded: true,
      originalFromName: null,
      originalFromEmail: null,
      originalSubject: subject.replace(/^(Fwd|FW|Re: Fwd|Re: FW):\s*/i, "").trim(),
      originalDate: null,
      originalTo: null,
      forwarderName: fromName,
      forwarderEmail: fromEmail,
      forwardedContent: bodyText,
    };
  }

  return parseForwardedFromBody(bodyText, fromEmail, fromName);
}
