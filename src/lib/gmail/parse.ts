import type { gmail_v1 } from "googleapis";

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

  // Prefer internalDate (epoch ms) over Date header — it's accurate.
  const receivedAt = msg.internalDate
    ? new Date(Number(msg.internalDate))
    : dateRaw
      ? new Date(dateRaw)
      : new Date();

  const { text, html } = extractBodies(msg.payload);
  const labelIds = msg.labelIds ?? [];

  return {
    gmailMessageId: msg.id,
    gmailThreadId: msg.threadId,
    receivedAt,
    fromName,
    fromEmail,
    toEmails,
    subject,
    bodyText: text || stripHtml(html),
    bodyHtml: html,
    labelIds,
    isOutbound: labelIds.includes("SENT"),
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
