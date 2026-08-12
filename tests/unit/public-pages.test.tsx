import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LandingPage, {
  formatMenuPrice,
  landingRecords,
  landingRoomMeta,
  landingStrings,
  landingValue,
  RoomDetailModal,
} from "../../app/LandingPage";
import BookingResults, {
  BookingResultContent,
  loadAvailability,
  roomSelections,
  type AvailabilityResponse,
  type SearchInput,
} from "../../app/booking/BookingResults";
import BookingPage, { nonNegativeInteger } from "../../app/booking/page";
import {
  formatPaymentCountdown,
  paymentTimeRemaining,
} from "../../app/booking/PaymentCountdown";
import BookingLookupPage from "../../app/booking/lookup/page";
import ContentPreviewPage from "../../app/preview/page";
import {
  nextPublicDate,
  publicDateFromToday,
} from "../../app/PublicFormControls";
import { approvedBaselineLanding } from "../../src/modules/content/default-content";

const U1 = "11111111-1111-4111-a111-111111111111";
const search: SearchInput = {
  checkInDate: "2026-08-10",
  checkoutDate: "2026-08-12",
  rooms: 1,
  adults: 2,
  children: 0,
  infants: 0,
  locale: "id",
  currency: "AUD",
};

describe("Batch 4 public pages", () => {
  it("normalizes optional CMS values without leaking malformed data", () => {
    const section = {
      key: "test",
      type: "TEST",
      content: {
        title: "Valid title",
        count: 3,
        records: [{ title: "One" }, null, ["nested"], "text", 2],
        strings: ["one", 2, null, "two"],
      },
    };
    expect(landingValue(section, "title", "Fallback")).toBe("Valid title");
    expect(landingValue(section, "count", "Fallback")).toBe("Fallback");
    expect(landingValue(undefined, "title")).toBe("");
    expect(landingRecords(section, "records")).toEqual([{ title: "One" }]);
    expect(landingRecords(section, "title")).toEqual([]);
    expect(landingRecords(undefined, "records")).toEqual([]);
    expect(landingStrings(section, "strings")).toEqual(["one", "two"]);
    expect(landingStrings(section, "title")).toEqual([]);
    expect(landingStrings(undefined, "strings")).toEqual([]);
  });

  it("formats every guest and extra-bed room summary variant", () => {
    const room = {
      id: U1,
      code: "DELUXE",
      name: "Deluxe",
      bedConfiguration: "Queen bed",
      maximumAdults: 2,
      maximumChildren: 1,
      maximumTotalGuests: 3,
      extraBedAllowed: true,
      maximumExtraBeds: 1,
      amenities: [],
      media: [],
    };
    expect(landingRoomMeta(room, "id")).toBe(
      "maks. 3 tamu · Queen bed · extra bed hingga 1",
    );
    expect(landingRoomMeta(room, "en")).toBe(
      "max. 3 guests · Queen bed · up to 1 extra bed",
    );
    expect(
      landingRoomMeta(
        {
          ...room,
          bedConfiguration: null,
          extraBedAllowed: false,
          maximumExtraBeds: 0,
        },
        "id",
      ),
    ).toBe("maks. 3 tamu · tanpa extra bed");
    expect(
      landingRoomMeta(
        { ...room, extraBedAllowed: false, maximumExtraBeds: 0 },
        "en",
      ),
    ).toContain("no extra bed");
  });

  it("formats official IDR and optional menu display estimates", () => {
    expect(formatMenuPrice(100_000, "IDR", {}, "id")).toContain("100.000");
    expect(formatMenuPrice(100_000, "USD", { USD: 0.000061 }, "en")).toContain(
      "$6.10",
    );
    expect(formatMenuPrice(100_000, "AUD", {}, "en")).toBeNull();
  });

  it("defaults public stay dates from today in the Jakarta timezone", () => {
    const lateUtc = new Date("2026-08-11T17:30:00.000Z");
    expect(publicDateFromToday(0, lateUtc)).toBe("2026-08-12");
    expect(publicDateFromToday(1, lateUtc)).toBe("2026-08-13");
  });

  it("formats the configured reservation payment deadline as a countdown", () => {
    const now = new Date("2026-08-12T08:00:00.000Z").getTime();
    const deadline = "2026-08-12T09:30:05.000Z";
    expect(paymentTimeRemaining(deadline, now)).toBe(5_405_000);
    expect(formatPaymentCountdown(5_405_000)).toBe("01:30:05");
    expect(paymentTimeRemaining(deadline, now + 6_000_000)).toBe(0);
    expect(formatPaymentCountdown(0)).toBe("00:00:00");
  });

  it("renders active public menu data without placeholder copy", () => {
    const data = approvedBaselineLanding("id");
    data.menu = {
      locale: "id",
      officialCurrency: "IDR",
      displayRates: { USD: 0.000061 },
      generatedAt: "2026-08-02T00:00:00.000Z",
      categories: [
        {
          id: U1,
          code: "MAIN",
          name: "Menu Utama",
          sortOrder: 1,
          items: [
            {
              id: U1,
              code: "NASI_GORENG",
              versionId: U1,
              versionNumber: 1,
              name: "Nasi Goreng KOOKA",
              description: "Nasi goreng rumahan.",
              available: true,
              priceIdr: 50_000,
              estimatedTotalIdr: 55_000,
              taxIncluded: false,
              serviceChargeIncluded: false,
            },
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<LandingPage initialData={data} />);
    expect(html).toContain("Dari dapur KOOKA");
    expect(html).toContain("Nasi Goreng KOOKA");
    expect(html).toContain(
      "Nikmati pilihan makanan dan minuman yang dapat dipesan dengan mudah",
    );
    expect(html).not.toContain("diproses oleh Front Office");
    expect(html).not.toContain("mengikuti konfigurasi");
    expect(html).not.toContain("placeholder");
  });

  it("renders the complete approved bilingual landing baseline", () => {
    const id = renderToStaticMarkup(
      <LandingPage initialData={approvedBaselineLanding("id")} />,
    );
    const en = renderToStaticMarkup(
      <LandingPage initialData={approvedBaselineLanding("en")} />,
    );
    expect(id).toContain("Hunian tenang");
    expect(id).toContain("Bagaimana cara melakukan pembayaran?");
    expect(id).toContain("Buka petunjuk arah");
    expect(en).toContain("A calm, <em>comfortable stay");
    expect(en).toContain("How do I make a payment?");
    expect(en).toContain("Get directions");
    expect(id).not.toContain("room-only");
    expect(id).toContain('href="/booking/lookup?locale=id"');
    expect(id).toContain("Lihat booking");
    expect(en).toContain('href="/booking/lookup?locale=en"');
    expect(en).toContain("View booking");
    expect(id).toContain("public-date-trigger");
    expect(id).toContain("public-select-trigger");
    expect(id.match(/alt="KOOKA Residence"/g)).toHaveLength(2);
    expect(id).toContain('name="checkInDate"');
    expect(id).toContain('name="adults"');
    expect(id).not.toContain("<select");
    expect(id).not.toContain('type="date"');
    expect(nextPublicDate("2026-08-31")).toBe("2026-09-01");
  });

  it("renders safe visual fallbacks when optional CMS sections are absent", () => {
    const empty = approvedBaselineLanding("en");
    empty.sections = [];
    empty.property.address = null;
    empty.rooms = [
      {
        id: U1,
        code: "HIDDEN",
        name: "Unpublished room media",
        maximumAdults: 2,
        maximumChildren: 0,
        maximumTotalGuests: 2,
        extraBedAllowed: false,
        maximumExtraBeds: 0,
        amenities: [],
        media: [],
      },
    ];
    const html = renderToStaticMarkup(<LandingPage initialData={empty} />);
    expect(html).toContain("Unpublished room media");
    expect(html).toContain(
      "%2Fimages%2Fagoda-kooka%2Froom-mezzanine-guestroom.jpg",
    );
    expect(html).toContain("%2Fimages%2Fagoda-kooka%2Fproperty-entrance.jpg");
    expect(html).toContain("%2Fimages%2Fagoda-kooka%2Ffacility-garden.jpg");
    expect(html).toContain("Surabaya");
    expect(html).toContain("Check availability");
  });

  it("prefers published CMS media over editorial image fallbacks", () => {
    const data = approvedBaselineLanding("id");
    for (const section of data.sections) {
      if (["hero", "experience", "gallery"].includes(section.key)) {
        section.media = [0, 1, 2].map((index) => ({
          id: `${index + 1}1111111-1111-4111-a111-111111111111`,
          url: `/api/content/media/${section.key}-${index}`,
          alt: `${section.key} asli ${index}`,
          sortOrder: index,
        }));
      }
      if (section.key === "trust") {
        section.content.items = [{ title: null, body: null }];
      }
      if (section.key === "faq") {
        section.content.items = [{ question: null, answer: null }];
      }
    }
    data.rooms = [
      {
        id: U1,
        code: "SIMPLE",
        name: "Simple Room",
        maximumAdults: 2,
        maximumChildren: 0,
        maximumTotalGuests: 2,
        extraBedAllowed: false,
        maximumExtraBeds: 0,
        amenities: [],
        media: [
          {
            id: U1,
            url: "/api/content/media/room",
            alt: "Kamar asli",
            sortOrder: 0,
          },
        ],
      },
    ];
    const html = renderToStaticMarkup(<LandingPage initialData={data} />);
    expect(html).toContain("hero asli 0");
    expect(html).toContain("experience asli 2");
    expect(html).toContain("gallery asli 2");
    expect(html).toContain("Simple Room");
  });

  it("renders operational room data only when authentic media is available", () => {
    const data = approvedBaselineLanding("id");
    data.rooms = [
      {
        id: U1,
        code: "DELUXE",
        name: "Deluxe Garden",
        description: "Kamar yang menghadap taman.",
        bedConfiguration: "Queen bed",
        maximumAdults: 2,
        maximumChildren: 1,
        maximumTotalGuests: 3,
        extraBedAllowed: true,
        maximumExtraBeds: 1,
        amenities: [
          { code: "WIFI", name: "Wi-Fi", iconKey: "wifi" },
          { code: "AC", name: "AC", iconKey: "snowflake" },
        ],
        media: [
          {
            id: U1,
            url: "/images/room-deluxe.jpg",
            alt: "Deluxe Garden KOOKA",
            sortOrder: 0,
          },
        ],
      },
    ];
    const html = renderToStaticMarkup(<LandingPage initialData={data} />);
    expect(html).toContain("Deluxe Garden");
    expect(html).toContain("maks. 3 tamu");
    expect(html).toContain("extra bed hingga 1");
    expect(html).toContain("Wi-Fi");
    expect(html).toContain("Lihat detail");
    expect(html).not.toContain('class="image-index"');

    const detail = renderToStaticMarkup(
      <RoomDetailModal
        fallbackImage="/images/room-fallback.jpg"
        locale="id"
        onCheckAvailability={() => undefined}
        onClose={() => undefined}
        room={{
          ...data.rooms[0]!,
          amenities: [
            ...data.rooms[0]!.amenities,
            { code: "NO_SMOKING", name: "Dilarang merokok" },
          ],
        }}
      />,
    );
    expect(detail).toContain("Detail kamar");
    expect(detail).toContain("Maks. 3 tamu");
    expect(detail).toContain("Queen bed");
    expect(detail).toContain("Dilarang merokok");
    expect(detail).toContain("Cek ketersediaan");
  });

  it("renders booking search loading state and normalized query", async () => {
    const loading = renderToStaticMarkup(<BookingResults search={search} />);
    expect(loading).toContain("Memeriksa kamar");
    expect(loading).toContain("AUD");
    expect(loading).toContain("kooka-logo-official.png");

    const page = await BookingPage({
      searchParams: Promise.resolve({
        checkInDate: "2026-08-10",
        checkoutDate: "2026-08-12",
        rooms: "2",
        adults: "4",
        locale: "en",
        currency: "USD",
      }),
    });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Choose your room");
    expect(html).toContain("Update results");
    expect(html).toContain('name="checkInDate"');
    expect(html).toContain('name="checkoutDate"');
    expect(html).toContain('name="adults"');
    expect(html).toContain('name="rooms"');
    expect(html).toContain("Guest details");

    expect(nonNegativeInteger(["3", "4"], 1)).toBe(3);
    expect(nonNegativeInteger("0", 2)).toBe(0);
    expect(nonNegativeInteger("-1", 2)).toBe(2);
    expect(nonNegativeInteger("1.5", 2)).toBe(2);
    expect(nonNegativeInteger(undefined, 2)).toBe(2);

    const defaults = await BookingPage({ searchParams: Promise.resolve({}) });
    const defaultHtml = renderToStaticMarkup(defaults);
    expect(defaultHtml).toContain("Pilih kamar Anda");
    expect(defaultHtml).toContain("IDR");

    const aud = await BookingPage({
      searchParams: Promise.resolve({
        currency: "AUD",
        rooms: "0",
        adults: "0",
        children: ["1", "2"],
        infants: "1",
      }),
    });
    expect(renderToStaticMarkup(aud)).toContain("AUD");
  });

  it("renders customer booking lookup without an account login", async () => {
    const page = await BookingLookupPage({
      searchParams: Promise.resolve({
        code: "KR-260803-ABC123",
        locale: "id",
      }),
    });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Lihat booking Anda");
    expect(html).toContain("KR-260803-ABC123");
    expect(html).toContain("Email (opsional)");
    expect(html).not.toContain('required="" type="email"');
  });

  it("renders available, unavailable, extra-bed, and empty room results", () => {
    const result: AvailabilityResponse = {
      checkInDate: search.checkInDate,
      checkoutDate: search.checkoutDate,
      nights: 2,
      requestedRooms: 1,
      roomTypes: [
        {
          id: U1,
          code: "DELUXE",
          nameId: "Deluxe",
          nameEn: "Deluxe",
          maximumAdults: 2,
          maximumChildren: 1,
          maximumTotalGuests: 3,
          extraBedAllowed: true,
          maximumExtraBeds: 1,
          extraBedCapacityIncrement: 1,
          availableRooms: 2,
          available: true,
          offer: {
            ratePlanCode: "BAR",
            ratePlanNameId: "Harga fleksibel",
            ratePlanNameEn: "Flexible rate",
            nightlyFromIdr: 500000,
            estimatedStayIdr: 1000000,
          },
        },
        {
          id: "22222222-2222-4222-a222-222222222222",
          code: "FAMILY",
          nameId: "Family",
          nameEn: "Family",
          maximumAdults: 4,
          maximumChildren: 2,
          maximumTotalGuests: 5,
          extraBedAllowed: false,
          maximumExtraBeds: 0,
          extraBedCapacityIncrement: 0,
          availableRooms: 0,
          available: false,
          offer: {
            ratePlanCode: "FAMILY",
            ratePlanNameId: "Harga keluarga",
            ratePlanNameEn: "Family rate",
            nightlyFromIdr: 800000,
            estimatedStayIdr: 1600000,
          },
        },
      ],
    };
    const id = renderToStaticMarkup(
      <BookingResultContent
        search={search}
        result={result}
        loading={false}
        error=""
      />,
    );
    const en = renderToStaticMarkup(
      <BookingResultContent
        search={{ ...search, locale: "en" }}
        result={result}
        loading={false}
        error=""
      />,
    );
    const empty = renderToStaticMarkup(
      <BookingResultContent
        search={search}
        result={{ ...result, roomTypes: [] }}
        loading={false}
        error="Search failed"
      />,
    );
    expect(id).toContain("2 kamar tersedia");
    expect(id).toContain("Extra bed hingga");
    expect(id).toContain("Tidak tersedia pada tanggal ini");
    expect(en).toContain("2 rooms available");
    expect(en).toContain("Unavailable for selected dates");
    expect(en).toContain("Add room");
    expect(en).toContain("2 nights");
    expect(en).toContain(
      "Taxes and service charges, if applicable, are shown in the summary before booking.",
    );
    expect(id).toContain(
      "Pajak dan biaya layanan, jika berlaku, ditampilkan di ringkasan sebelum booking.",
    );
    expect(empty).toContain("Search failed");
    expect(empty).toContain("Belum ada tipe kamar aktif");
  });

  it("allows a multi-room search to combine different room types", () => {
    const queen: AvailabilityResponse["roomTypes"][number] = {
      id: U1,
      code: "QUEEN",
      nameId: "Queen Room",
      nameEn: "Queen Room",
      maximumAdults: 2,
      maximumChildren: 0,
      maximumTotalGuests: 2,
      extraBedAllowed: false,
      maximumExtraBeds: 0,
      extraBedCapacityIncrement: 0,
      availableRooms: 1,
      available: false,
      offer: {
        ratePlanCode: "QUEEN-ONLINE",
        ratePlanNameId: "Online",
        ratePlanNameEn: "Online",
        nightlyFromIdr: 300000,
        estimatedStayIdr: 600000,
      },
    };
    const garden = {
      ...queen,
      id: "22222222-2222-4222-a222-222222222222",
      code: "QUEEN-GARDEN",
      nameId: "Queen Garden",
      nameEn: "Queen Garden",
      offer: { ...queen.offer!, ratePlanCode: "GARDEN-ONLINE" },
    };
    const multiSearch = {
      ...search,
      rooms: 2,
      adults: 4,
      locale: "en" as const,
    };
    const result: AvailabilityResponse = {
      checkInDate: search.checkInDate,
      checkoutDate: search.checkoutDate,
      nights: 2,
      requestedRooms: 2,
      roomTypes: [queen, garden],
    };
    const html = renderToStaticMarkup(
      <BookingResultContent
        search={multiSearch}
        result={result}
        loading={false}
        error=""
        selectedRoomCounts={{ [queen.id]: 1 }}
      />,
    );
    expect(html).toContain("1 of 2 rooms selected");
    expect(html).toContain("1 room available");
    expect(html).toContain("Add room");
    expect(html).not.toContain("Only 1 rooms available");

    const selections = roomSelections(multiSearch, [queen, garden]);
    expect(selections).toEqual([
      expect.objectContaining({
        roomTypeId: queen.id,
        ratePlanCode: "QUEEN-ONLINE",
        adults: 2,
      }),
      expect.objectContaining({
        roomTypeId: garden.id,
        ratePlanCode: "GARDEN-ONLINE",
        adults: 2,
      }),
    ]);
  });

  it("loads availability and preserves API errors", async () => {
    const result: AvailabilityResponse = {
      checkInDate: search.checkInDate,
      checkoutDate: search.checkoutDate,
      nights: 2,
      requestedRooms: 1,
      roomTypes: [],
    };
    const success = async () =>
      new Response(JSON.stringify(result), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    await expect(
      loadAvailability(search, undefined, success as typeof fetch),
    ).resolves.toEqual(result);

    const failure = async () =>
      new Response(JSON.stringify({ error: { message: "Dates closed" } }), {
        status: 409,
        headers: { "content-type": "application/json" },
      });
    await expect(
      loadAvailability(search, undefined, failure as typeof fetch),
    ).rejects.toThrow("Dates closed");

    const genericFailure = async () =>
      new Response(JSON.stringify({}), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    await expect(
      loadAvailability(search, undefined, genericFailure as typeof fetch),
    ).rejects.toThrow("Availability search failed");
  });

  it("renders a safe message for missing preview tokens", async () => {
    const page = await ContentPreviewPage({
      searchParams: Promise.resolve({}),
    });
    expect(renderToStaticMarkup(page)).toContain("Preview link is invalid");
  });
});
