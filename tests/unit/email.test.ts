import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
const { currentEnvironment } = vi.hoisted(() => ({
  currentEnvironment: {
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: 1025,
    SMTP_FROM: "KOOKA Local <no-reply@kooka.local>",
    SMTP_USER: undefined as string | undefined,
    SMTP_PASSWORD: undefined as string | undefined,
  },
}));

vi.mock("nodemailer", () => ({ default: { createTransport } }));
vi.mock("../../src/platform/environment", () => ({
  parseApplicationEnvironment: () => currentEnvironment,
}));
vi.mock("../../src/platform/logger", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  }),
}));

import { sendEmail } from "../../src/platform/email";

describe("sendEmail", () => {
  beforeEach(() => {
    sendMail.mockReset();
    createTransport.mockClear();
    currentEnvironment.SMTP_USER = undefined;
    currentEnvironment.SMTP_PASSWORD = undefined;
  });

  // Order matters: `sendEmail` caches its transporter in a module-level
  // variable, so this must run before any other test in this file forces
  // that cache to populate.
  it("reuses a single authenticated transporter across multiple sends", async () => {
    currentEnvironment.SMTP_USER = "no-reply@kooka.test";
    currentEnvironment.SMTP_PASSWORD = "secret-password";
    sendMail.mockResolvedValue({ messageId: "msg-1" });

    await sendEmail({ to: "a@example.com", subject: "s", text: "t" });
    await sendEmail({ to: "b@example.com", subject: "s", text: "t" });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { user: "no-reply@kooka.test", pass: "secret-password" },
      }),
    );
  });

  it("sends via the configured SMTP transport and returns the message id", async () => {
    sendMail.mockResolvedValue({ messageId: "msg-1" });

    const result = await sendEmail({
      to: "guest@example.com",
      subject: "Booking confirmed",
      text: "See you soon",
    });

    expect(result).toEqual({ messageId: "msg-1" });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "KOOKA Local <no-reply@kooka.local>",
        to: "guest@example.com",
        subject: "Booking confirmed",
      }),
    );
  });
});
