import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicLandingPage: vi.fn(),
  getPublicMenu: vi.fn(),
  verifyContentPreviewToken: vi.fn(),
}));

vi.mock("../../src/modules/content/cms-service", () => ({
  getPublicLandingPage: mocks.getPublicLandingPage,
  verifyContentPreviewToken: mocks.verifyContentPreviewToken,
}));
vi.mock("../../src/modules/commerce/fnb-service", () => ({
  getPublicMenu: mocks.getPublicMenu,
}));

import ContentPreviewPage from "../../app/preview/page";
import { approvedBaselineLanding } from "../../src/modules/content/default-content";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";

describe("protected CMS preview page", () => {
  beforeEach(() => {
    mocks.verifyContentPreviewToken.mockReset().mockReturnValue({
      propertyId: U1,
      versionId: U2,
    });
    mocks.getPublicLandingPage
      .mockReset()
      .mockResolvedValue(approvedBaselineLanding("en"));
    mocks.getPublicMenu.mockReset().mockResolvedValue({ categories: [] });
  });

  it("renders an English preview from the first token query value", async () => {
    const page = await ContentPreviewPage({
      searchParams: Promise.resolve({
        token: ["signed-token", "ignored"],
        locale: "en",
      }),
    });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Protected CMS preview");
    expect(html).toContain("A calm, <em>comfortable stay");
    expect(mocks.verifyContentPreviewToken).toHaveBeenCalledWith(
      "signed-token",
    );
    expect(mocks.getPublicLandingPage).toHaveBeenCalledWith({
      propertyId: U1,
      versionId: U2,
      locale: "en",
    });
  });

  it("uses Indonesian by default for a scalar token", async () => {
    mocks.getPublicLandingPage.mockResolvedValue(approvedBaselineLanding("id"));
    const page = await ContentPreviewPage({
      searchParams: Promise.resolve({ token: "signed-token", locale: "fr" }),
    });
    expect(renderToStaticMarkup(page)).toContain("Hunian tenang");
    expect(mocks.getPublicLandingPage).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "id" }),
    );
  });

  it("keeps protected CMS preview available when menu loading fails", async () => {
    mocks.getPublicMenu.mockRejectedValue(new Error("menu unavailable"));
    const page = await ContentPreviewPage({
      searchParams: Promise.resolve({ token: "signed-token", locale: "en" }),
    });
    expect(renderToStaticMarkup(page)).toContain(
      "A calm, <em>comfortable stay",
    );
  });

  it("fails closed when token verification or preview loading fails", async () => {
    mocks.verifyContentPreviewToken.mockImplementation(() => {
      throw new Error("expired");
    });
    const page = await ContentPreviewPage({
      searchParams: Promise.resolve({ token: "expired-token" }),
    });
    expect(renderToStaticMarkup(page)).toContain("Preview link has expired");
  });
});
