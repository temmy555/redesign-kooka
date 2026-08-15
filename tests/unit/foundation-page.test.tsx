import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(() => undefined) }),
}));

import RootLayout, { metadata } from "../../app/layout";
import HomePage from "../../app/page";

describe("canonical application foundation", () => {
  it("renders the selected KOOKA direction", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("Urban Tropical Retreat");
    expect(html).toContain("A calm, <em>comfortable stay");
    expect(html).toContain("IDR");
  });

  it("honors the English locale URL on first render", async () => {
    const html = renderToStaticMarkup(
      await HomePage({ searchParams: Promise.resolve({ locale: "en" }) }),
    );

    expect(html).toContain("A calm, <em>comfortable stay");
    expect(html).toContain("Get directions");
  });

  it("keeps the configured document language and metadata", async () => {
    const html = renderToStaticMarkup(
      await RootLayout({ children: <main>KOOKA</main> }),
    );

    expect(html).toContain('<html lang="id"');
    expect(metadata.title).toEqual(
      expect.objectContaining({ default: "KOOKA Residence Surabaya" }),
    );
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({ images: expect.any(Array) }),
    );
  });
});
