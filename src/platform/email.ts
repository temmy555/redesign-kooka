import "server-only";

import { createHash } from "node:crypto";

import nodemailer, { type Transporter } from "nodemailer";

import { parseApplicationEnvironment } from "./environment";
import { getLogger } from "./logger";

/**
 * Email adapter (Roadmap Langkah 8), per
 * docs/DEPENDENCY-QUALITY-BASELINE.md's "Email | Nodemailer | SMTP adapter
 * dan local catcher dibuat pada Langkah 4/8" commitment. `SMTP_HOST`/
 * `SMTP_PORT`/`SMTP_FROM` (src/platform/environment.ts) point at Mailpit in
 * development and a real relay in uat/production; this module doesn't need
 * to know which.
 *
 * This is a low-level send primitive, not a template engine or a queue: per
 * docs/TECHNICAL-ARCHITECTURE.md §4, an actual "send booking confirmation"
 * or "send reminder" call should happen from inside a transactional-outbox
 * job handler (src/platform/outbox.ts) registered by the domain module that
 * owns that email, not fired directly from a request handler -- that's what
 * makes the send retryable and not lost if the process crashes right after
 * the triggering DB commit.
 */

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const environment = parseApplicationEnvironment(process.env);
  transporter = nodemailer.createTransport({
    host: environment.SMTP_HOST,
    port: environment.SMTP_PORT,
    secure: environment.SMTP_PORT === 465,
  });
  return transporter;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendEmailResult {
  messageId: string;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const environment = parseApplicationEnvironment(process.env);
  const info = await getTransporter().sendMail({
    from: environment.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  getLogger().info(
    {
      recipientReference: createHash("sha256")
        .update(input.to.toLowerCase())
        .digest("hex")
        .slice(0, 12),
      messageId: info.messageId,
    },
    "Email sent",
  );

  return { messageId: info.messageId };
}
