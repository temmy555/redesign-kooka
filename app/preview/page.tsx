import type { Metadata } from "next";

import LandingPage from "../LandingPage";
import { getPublicMenu } from "../../src/modules/commerce/fnb-service";
import {
  getPublicLandingPage,
  verifyContentPreviewToken,
} from "../../src/modules/content/cms-service";
import type { PublicLocale } from "../../src/modules/content/contracts";

export const metadata: Metadata = {
  title: "Content Preview",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default async function ContentPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;
  if (!token) {
    return (
      <main className="preview-error">
        <h1>Preview link is invalid</h1>
      </main>
    );
  }
  let data;
  try {
    const payload = verifyContentPreviewToken(token);
    const locale: PublicLocale = query.locale === "en" ? "en" : "id";
    const [landing, menu] = await Promise.all([
      getPublicLandingPage({
        propertyId: payload.propertyId,
        locale,
        versionId: payload.versionId,
      }),
      getPublicMenu({ propertyId: payload.propertyId, locale }).catch(
        () => undefined,
      ),
    ]);
    data = menu ? { ...landing, menu } : landing;
  } catch {
    return (
      <main className="preview-error">
        <h1>Preview link has expired</h1>
      </main>
    );
  }
  return (
    <>
      <div className="preview-banner" role="status">
        Protected CMS preview · not published
      </div>
      <LandingPage initialData={data} />
    </>
  );
}
