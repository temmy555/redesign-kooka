import { beforeEach, describe, expect, it, vi } from "vitest";

const { handler, getAuth } = vi.hoisted(() => {
  const handler = vi.fn(async () => new Response(null, { status: 204 }));
  return { handler, getAuth: vi.fn(() => ({ handler })) };
});

vi.mock("../../src/platform/auth", () => ({ getAuth }));

import { GET, POST } from "../../app/api/auth/[...all]/route";

describe("staff auth route handler", () => {
  beforeEach(() => {
    handler.mockClear();
    getAuth.mockClear();
  });

  it("delegates GET requests to the Better Auth handler resolved per-request", async () => {
    const request = new Request("http://localhost/api/auth/get-session");

    await GET(request);

    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(request);
  });

  it("delegates POST requests to the Better Auth handler resolved per-request", async () => {
    const request = new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
    });

    await POST(request);

    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(request);
  });
});
