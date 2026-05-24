import { getGmailConnection } from "./client";

export async function createGmailDraft(input: {
  to: string;
  cc?: string[] | null;
  bcc?: string[] | null;
  subject: string;
  body: string;
  threadId: string;
}): Promise<string | null> {
  const conn = await getGmailConnection();
  if (!conn) return null;

  const raw = buildRawMessage({
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    from: conn.email,
    subject: input.subject,
    body: input.body,
  });

  const res = await conn.gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw, threadId: input.threadId },
    },
  });

  await conn.flush();
  return res.data.id ?? null;
}

export async function sendGmailDraft(
  draftId: string,
): Promise<string | null> {
  const conn = await getGmailConnection();
  if (!conn) return null;

  const res = await conn.gmail.users.drafts.send({
    userId: "me",
    requestBody: { id: draftId },
  });

  await conn.flush();
  return res.data.id ?? null;
}

function buildRawMessage(opts: {
  to: string;
  cc?: string[] | null;
  bcc?: string[] | null;
  from: string;
  subject: string;
  body: string;
}): string {
  const encodedBody = Buffer.from(opts.body, "utf-8").toString("base64");
  const lines: string[] = [];

  lines.push(`To: ${opts.to}`);
  if (opts.cc && opts.cc.length > 0) {
    lines.push(`Cc: ${opts.cc.join(", ")}`);
  }
  if (opts.bcc && opts.bcc.length > 0) {
    lines.push(`Bcc: ${opts.bcc.join(", ")}`);
  }
  lines.push(`From: ${opts.from}`);
  lines.push(`Subject: ${opts.subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push("Content-Transfer-Encoding: base64");
  lines.push("");
  lines.push(encodedBody);

  const email = lines.join("\r\n");
  return Buffer.from(email, "utf-8").toString("base64url");
}
