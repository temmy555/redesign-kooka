import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuth, getSession, headers } = vi.hoisted(() => ({
  getAuth: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("../../src/platform/auth", () => ({ getAuth }));
vi.mock("next/headers", () => ({ headers }));

import {
  getCurrentSession,
  requireCurrentSession,
} from "../../src/platform/session";

describe("server-side session lookup", () => {
  beforeEach(() => {
    getAuth.mockReset();
    getSession.mockReset();
    headers.mockReset();
    const requestHeaders = new Headers({ cookie: "kooka.session_token=abc" });
    headers.mockResolvedValue(requestHeaders);
    getAuth.mockReturnValue({ api: { getSession } });
  });

  it("resolves the session from the caller's own request headers, never client-supplied identity", async () => {
    getSession.mockResolvedValue({
      session: { id: "session-1", userId: "user-1" },
      user: { id: "user-1", email: "owner@kooka.example" },
    });

    const session = await getCurrentSession();

    expect(getSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
    expect(session?.user.id).toBe("user-1");
  });

  it("returns null for an anonymous/expired/revoked caller instead of throwing", async () => {
    getSession.mockResolvedValue(null);

    await expect(getCurrentSession()).resolves.toBeNull();
  });

  it("requireCurrentSession throws when there is no authenticated session", async () => {
    getSession.mockResolvedValue(null);

    await expect(requireCurrentSession()).rejects.toThrow(
      /No authenticated staff session/u,
    );
  });

  it("requireCurrentSession returns the session when one exists", async () => {
    const session = {
      session: { id: "session-1", userId: "user-1" },
      user: { id: "user-1", email: "owner@kooka.example" },
    };
    getSession.mockResolvedValue(session);

    await expect(requireCurrentSession()).resolves.toBe(session);
  });
});
