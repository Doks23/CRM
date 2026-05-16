import { getGmailConnection } from "./client";

export async function createGmailDraft(input: {
  to: string;
  subject: string;
  body: string;
  threadId: string;
}): Promise<string | null> {
  const conn = await getGmailConnection();
  if (!conn) return null;

  const raw = buildRawMessage({
    to: input.to,
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
  from: string;
  subject: string;
  body: string;
}): string {
  const encodedBody = Buffer.from(opts.body, "utf-8").toString("base64");
  const email = [
    `To: ${opts.to}`,
    `From: ${opts.from}`,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encodedBody,
  ].join("\r\n");

  return Buffer.from(email, "utf-8").toString("base64url");
}
