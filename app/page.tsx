import LandingPage from "./LandingPage";
import { getPublicMenu } from "../src/modules/commerce/fnb-service";
import { getPublicLandingPage } from "../src/modules/content/cms-service";
import { approvedBaselineLanding } from "../src/modules/content/default-content";
import { getActivePropertyId } from "../src/platform/property";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ locale?: string | string[] }>;
} = {}) {
  const query = searchParams ? await searchParams : undefined;
  const locale = query?.locale === "id" ? "id" : "en";
  let data = approvedBaselineLanding(locale);
  try {
    const propertyId = await getActivePropertyId();
    const [landing, menu] = await Promise.all([
      getPublicLandingPage({ propertyId, locale }),
      getPublicMenu({ propertyId, locale }).catch(() => undefined),
    ]);
    data = menu ? { ...landing, menu } : landing;
  } catch {
    // The approved baseline keeps the public page available before initial
    // production master/CMS configuration. It contains no room prices,
    // capacities, testimonials, or distance claims that could diverge from
    // operational data.
  }
  return <LandingPage initialData={data} />;
}
