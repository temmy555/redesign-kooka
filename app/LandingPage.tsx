"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type {
  LandingRoomType,
  LandingSection,
  PublicDisplayCurrency,
  PublicLandingData,
  PublicLocale,
  PublicMenuData,
} from "../src/modules/content/contracts";
import {
  nextPublicDate,
  PublicDateField,
  PublicSelect,
} from "./PublicFormControls";
import KookaLogo from "./KookaLogo";

const kookaFoodImage = "/images/agoda-kooka/dining-food-beverages.jpg";

const roomImageFallbacks = [
  "/images/agoda-kooka/room-mezzanine-guestroom.jpg",
  "/images/agoda-kooka/room-two-bedroom-villa-bed.jpg",
  "/images/agoda-kooka/room-generic-01.jpg",
  "/images/agoda-kooka/room-generic-02.jpg",
  "/images/agoda-kooka/room-generic-03.jpg",
];

const authenticImageReplacements: Record<string, string> = {
  "/images/kooka-hero.jpeg": "/images/agoda-kooka/property-entrance.jpg",
  "/images/tropical-courtyard.jpg": "/images/agoda-kooka/facility-garden.jpg",
  "/images/gallery-room.jpg":
    "/images/agoda-kooka/room-mezzanine-guestroom.jpg",
};

function authenticImage(value: string) {
  return authenticImageReplacements[value] ?? value;
}

export function landingValue(
  section: LandingSection | undefined,
  key: string,
  fallback = "",
) {
  const candidate = section?.content[key];
  return typeof candidate === "string" ? candidate : fallback;
}

export function landingRecords(
  section: LandingSection | undefined,
  key: string,
) {
  const candidate = section?.content[key];
  return Array.isArray(candidate)
    ? candidate.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

export function landingStrings(
  section: LandingSection | undefined,
  key: string,
) {
  const candidate = section?.content[key];
  return Array.isArray(candidate)
    ? candidate.filter((item): item is string => typeof item === "string")
    : [];
}

const guestCopyReplacements: Record<string, string> = {
  "Reservasi langsung · Pembayaran resmi dalam IDR":
    "Pesan langsung untuk pengalaman menginap yang lebih personal",
  "Direct reservation · Official payment in IDR":
    "Book direct for a more personal stay",
  "Bantuan personal dari Front Office":
    "Layanan personal sejak sebelum kedatangan",
  "Personal Front Office assistance": "Personal care from before you arrive",
  "Pilih tipe kamar yang sesuai. Nomor kamar ditentukan Front Office berdasarkan ketersediaan dan kesiapan kamar.":
    "Pilih ruang yang paling sesuai untuk masa tinggal dan kenyamanan Anda.",
  "Choose the right room type. Physical room numbers are assigned by Front Office according to availability and readiness.":
    "Choose the space that best suits your stay and comfort.",
  "Bantuan Front Office yang personal":
    "Layanan hangat dan personal selama menginap",
  "Personal assistance from Front Office":
    "Warm, personal care throughout your stay",
  "Setelah booking, Anda menerima kode booking dan instruksi transfer resmi dalam IDR. Bukti transfer beserta kode booking dikirim melalui WhatsApp untuk diverifikasi Front Office.":
    "Setelah reservasi dibuat, Anda akan menerima kode booking dan petunjuk pembayaran. Kirimkan bukti transfer melalui WhatsApp agar reservasi dapat kami konfirmasi.",
  "After booking, you receive a booking code and official IDR transfer instructions. Send your transfer receipt and booking code through WhatsApp for Front Office verification.":
    "Once your reservation is made, you will receive a booking code and payment instructions. Send your transfer receipt through WhatsApp so we can confirm your stay.",
  "Tidak. Seluruh tarif kamar bersifat room-only dan makanan dapat dipesan terpisah.":
    "Sarapan tidak termasuk dalam harga kamar. Pilihan makanan dan minuman dapat dipesan secara terpisah selama Anda menginap.",
  "No. All room rates are room-only, and food can be ordered separately.":
    "Breakfast is not included in the room rate. Food and drinks can be ordered separately during your stay.",
  "Waktu default check-in pukul 14.00 dan checkout pukul 12.00. Permintaan lebih awal atau lebih lambat memerlukan konfirmasi Front Office dan bergantung pada kesiapan kamar.":
    "Jadwal standar check-in pukul 14.00 dan checkout pukul 12.00. Waktu kedatangan lebih awal atau lebih malam dapat dibicarakan langsung dengan Front Office dan menyesuaikan kesiapan kamar.",
  "Default check-in is 14:00 and checkout is 12:00. Earlier or later requests require Front Office confirmation and depend on room readiness.":
    "Standard check-in is at 14:00 and checkout is at 12:00. Earlier or late-night arrivals can be arranged directly with Front Office, subject to room readiness.",
  "Tamu memilih tipe kamar. Nomor kamar fisik dialokasikan Front Office sesuai ketersediaan dan kesiapan kamar.":
    "Anda memilih tipe kamar saat reservasi. Nomor kamar akan kami siapkan berdasarkan ketersediaan pada hari kedatangan.",
  "Guests choose a room type. Front Office assigns the physical room number according to availability and readiness.":
    "You choose a room type when booking. We will prepare the room number based on availability on your arrival day.",
};

export function guestFacingText(value: string, locale?: PublicLocale) {
  if (value === "Direct booking") {
    return locale === "id" ? "Reservasi langsung" : "Direct reservation";
  }
  return guestCopyReplacements[value] ?? value;
}

function publicAddress(address: string | null | undefined) {
  if (
    !address ||
    /(sintetis|synthetic|pengujian|testing|test data|placeholder)/i.test(
      address,
    )
  ) {
    return "Surabaya, Indonesia";
  }
  return address;
}

function EditorialHeading({
  text,
  accent,
  fallbackWords = 2,
}: {
  text: string;
  accent?: string;
  fallbackWords?: number;
}) {
  const words = text.trim().split(/\s+/);
  const chosenAccent =
    accent?.trim() ||
    words.slice(Math.max(0, words.length - fallbackWords)).join(" ");
  const start = text
    .toLocaleLowerCase()
    .lastIndexOf(chosenAccent.toLocaleLowerCase());
  if (start < 0) return text;
  return (
    <>
      {text.slice(0, start)}
      <em>{text.slice(start)}</em>
    </>
  );
}

function tomorrow(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function landingRoomMeta(room: LandingRoomType, locale: PublicLocale) {
  const guests =
    locale === "id"
      ? `maks. ${room.maximumTotalGuests} tamu`
      : `max. ${room.maximumTotalGuests} guests`;
  const extra = room.extraBedAllowed
    ? locale === "id"
      ? `extra bed hingga ${room.maximumExtraBeds}`
      : `up to ${room.maximumExtraBeds} extra bed`
    : locale === "id"
      ? "tanpa extra bed"
      : "no extra bed";
  return [guests, room.bedConfiguration, extra].filter(Boolean).join(" · ");
}

export function formatMenuPrice(
  amountIdr: number,
  currency: PublicDisplayCurrency,
  rates: PublicMenuData["displayRates"],
  locale: PublicLocale,
) {
  const formatterLocale = locale === "id" ? "id-ID" : "en-US";
  if (currency === "IDR") {
    return new Intl.NumberFormat(formatterLocale, {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amountIdr);
  }
  const rate = rates[currency];
  if (!rate) return null;
  return `≈ ${new Intl.NumberFormat(formatterLocale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountIdr * rate)}`;
}

function BookingSearch({
  locale,
  currency,
}: {
  locale: PublicLocale;
  currency: PublicDisplayCurrency;
}) {
  const [checkIn, setCheckIn] = useState(() => tomorrow(1));
  const [checkout, setCheckout] = useState(() => tomorrow(2));
  const [adults, setAdults] = useState("2");
  const [rooms, setRooms] = useState("1");

  return (
    <form className="availability" id="availability" action="/booking">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="children" value="0" />
      <input type="hidden" name="infants" value="0" />
      <label>
        <span>Check-in</span>
        <PublicDateField
          ariaLabel="Check-in"
          locale={locale}
          name="checkInDate"
          min={tomorrow(0)}
          value={checkIn}
          onChange={(next) => {
            setCheckIn(next);
            if (checkout <= next) setCheckout(nextPublicDate(next));
          }}
        />
      </label>
      <label>
        <span>Check-out</span>
        <PublicDateField
          ariaLabel="Check-out"
          locale={locale}
          name="checkoutDate"
          min={nextPublicDate(checkIn)}
          value={checkout}
          onChange={setCheckout}
        />
      </label>
      <label>
        <span>{locale === "id" ? "Tamu" : "Guests"}</span>
        <PublicSelect
          ariaLabel={
            locale === "id" ? "Jumlah tamu dewasa" : "Number of adults"
          }
          name="adults"
          onChange={setAdults}
          options={["1", "2", "3", "4", "5", "6"].map((value) => ({
            value,
            label: value,
          }))}
          value={adults}
        />
      </label>
      <label>
        <span>{locale === "id" ? "Kamar" : "Rooms"}</span>
        <PublicSelect
          ariaLabel={locale === "id" ? "Jumlah kamar" : "Number of rooms"}
          name="rooms"
          onChange={setRooms}
          options={["1", "2", "3", "4"].map((value) => ({
            value,
            label: value,
          }))}
          value={rooms}
        />
      </label>
      <button type="submit">
        {locale === "id" ? "Cari kamar" : "Find rooms"} <b>→</b>
      </button>
    </form>
  );
}

export default function LandingPage({
  initialData,
}: {
  initialData: PublicLandingData;
}) {
  const [data, setData] = useState(initialData);
  const [locale, setLocale] = useState<PublicLocale>(initialData.locale);
  const [currency, setCurrency] = useState<PublicDisplayCurrency>("IDR");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("kooka-language");
    const savedCurrency = window.localStorage.getItem("kooka-currency");
    queueMicrotask(() => {
      if (savedLocale === "id" || savedLocale === "en") setLocale(savedLocale);
      if (
        savedCurrency === "IDR" ||
        savedCurrency === "USD" ||
        savedCurrency === "AUD"
      ) {
        setCurrency(savedCurrency);
      }
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("kooka-language", locale);
    if (locale === data.locale) return;
    const controller = new AbortController();
    fetch(`/api/content/landing?locale=${locale}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load translation");
        return (await response.json()) as PublicLandingData;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setLocale(data.locale);
        }
      });
    return () => controller.abort();
  }, [data.locale, locale]);

  useEffect(() => {
    window.localStorage.setItem("kooka-currency", currency);
  }, [currency]);

  const byKey = useMemo(
    () => new Map(data.sections.map((section) => [section.key, section])),
    [data.sections],
  );
  const hero = byKey.get("hero");
  const trust = byKey.get("trust");
  const roomsSection = byKey.get("rooms");
  const experience = byKey.get("experience");
  const gallery = byKey.get("gallery");
  const location = byKey.get("location");
  const faq = byKey.get("faq");
  const cta = byKey.get("cta");
  const publicRooms = data.rooms;
  const menuCategories = data.menu?.categories ?? [];
  const heroImage = authenticImage(
    hero?.media?.[0]?.url ||
      landingValue(
        hero,
        "imageUrl",
        "/images/agoda-kooka/property-entrance.jpg",
      ),
  );
  const heroAlt =
    hero?.media?.[0]?.alt ||
    landingValue(hero, "imageAlt", "KOOKA Residence Surabaya");
  const experienceImages = landingStrings(experience, "images").map(
    authenticImage,
  );
  const galleryImages = landingStrings(gallery, "images").map(authenticImage);

  function changeCurrency(next: PublicDisplayCurrency) {
    setCurrency(next);
  }

  function goToBookingSearch(event: ReactMouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setMenuOpen(false);
    const form = document.getElementById("availability");
    if (!form) return;
    window.history.replaceState(null, "", "#availability");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    window.requestAnimationFrame(() => {
      form
        .querySelector<HTMLButtonElement>(".public-date-trigger")
        ?.focus({ preventScroll: true });
    });
  }

  return (
    <main id="top">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="KOOKA Residence home">
          <KookaLogo
            className="brand-logo"
            priority
            sizes="(max-width: 560px) 118px, 146px"
          />
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span className="sr-only">Menu</span>
        </button>
        <nav id="site-navigation" className={menuOpen ? "is-open" : ""}>
          <a href="#rooms" onClick={() => setMenuOpen(false)}>
            {locale === "id" ? "Kamar" : "Rooms"}
          </a>
          <a href="#experience" onClick={() => setMenuOpen(false)}>
            {locale === "id" ? "Pengalaman" : "Experience"}
          </a>
          {menuCategories.length ? (
            <a href="#menu" onClick={() => setMenuOpen(false)}>
              {locale === "id" ? "Menu" : "Menu"}
            </a>
          ) : null}
          <a href="#gallery" onClick={() => setMenuOpen(false)}>
            {locale === "id" ? "Galeri" : "Gallery"}
          </a>
          <a href="#location" onClick={() => setMenuOpen(false)}>
            {locale === "id" ? "Lokasi" : "Location"}
          </a>
          <a
            href={`/booking/lookup?locale=${locale}`}
            onClick={() => setMenuOpen(false)}
          >
            {locale === "id" ? "Lihat booking" : "View booking"}
          </a>
        </nav>
        <div className="header-actions">
          <div
            className="site-controls"
            aria-label="Language and currency preferences"
          >
            <PublicSelect
              ariaLabel="Language"
              onChange={(value) => setLocale(value as PublicLocale)}
              options={[
                { value: "id", label: "ID" },
                { value: "en", label: "EN" },
              ]}
              value={locale}
              variant="compact"
            />
            <i aria-hidden="true" />
            <PublicSelect
              ariaLabel="Currency"
              onChange={(value) =>
                changeCurrency(value as PublicDisplayCurrency)
              }
              options={[
                { value: "IDR", label: "IDR" },
                { value: "USD", label: "USD" },
                { value: "AUD", label: "AUD" },
              ]}
              value={currency}
              variant="compact"
            />
          </div>
          <a
            className="button button-small"
            href="#availability"
            onClick={goToBookingSearch}
          >
            {locale === "id" ? "Cek tanggal" : "Check dates"}
          </a>
        </div>
      </header>

      <section className="hero">
        <div className="hero-visual">
          <Image
            src={heroImage}
            alt={heroAlt}
            fill
            priority
            sizes="(max-width: 900px) 100vw, 50vw"
          />
          <div className="hero-photo-label">
            <span>{landingValue(hero, "imageLabel", "Courtyard")}</span>
            <strong>Surabaya, Indonesia</strong>
          </div>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">{landingValue(hero, "eyebrow")}</p>
          <h1>
            <EditorialHeading
              text={landingValue(hero, "title")}
              accent={landingValue(hero, "titleAccent")}
              fallbackWords={3}
            />
          </h1>
          <p className="hero-intro">{landingValue(hero, "body")}</p>
          <div className="hero-links">
            <a className="text-link" href="#rooms">
              {locale === "id" ? "Jelajahi kamar" : "Explore rooms"} <b>↘</b>
            </a>
            <span>
              {guestFacingText(landingValue(hero, "bookingNote"), locale)}
            </span>
          </div>
        </div>
        <BookingSearch locale={locale} currency={currency} />
      </section>

      <section className="trust-strip" aria-label="KOOKA Residence highlights">
        {landingRecords(trust, "items").map((item) => (
          <p key={String(item.title)}>
            <strong>{guestFacingText(String(item.title ?? ""), locale)}</strong>
            <span>{guestFacingText(String(item.body ?? ""), locale)}</span>
          </p>
        ))}
      </section>

      <section className="rooms section" id="rooms">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{landingValue(roomsSection, "eyebrow")}</p>
            <h2>
              <EditorialHeading
                text={landingValue(roomsSection, "title")}
                accent={landingValue(roomsSection, "titleAccent")}
              />
            </h2>
          </div>
          <p>{guestFacingText(landingValue(roomsSection, "body"), locale)}</p>
        </div>
        {publicRooms.length ? (
          <div className="room-grid">
            {publicRooms.map((room, index) => (
              <article className="room-card" key={room.id}>
                <div className="room-image">
                  <Image
                    src={
                      room.media[0]?.url ??
                      roomImageFallbacks[index % roomImageFallbacks.length]
                    }
                    alt={
                      room.media[0]?.alt ??
                      `${room.name} · KOOKA Residence Surabaya`
                    }
                    fill
                    sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw"
                  />
                  <span className="image-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="image-note">{room.name}</span>
                  <span className="room-arrow" aria-hidden="true">
                    ↗
                  </span>
                </div>
                <div className="room-body">
                  <p className="room-meta">{landingRoomMeta(room, locale)}</p>
                  <h3>{room.name}</h3>
                  <p>
                    {room.description ||
                      (locale === "id"
                        ? "Ruang personal yang tenang untuk beristirahat nyaman selama berada di Surabaya."
                        : "A calm, personal space for a comfortable and restful stay in Surabaya.")}
                  </p>
                  <div className="room-footer">
                    <span>
                      {locale === "id"
                        ? `Hingga ${room.maximumTotalGuests} tamu`
                        : `Up to ${room.maximumTotalGuests} guests`}
                      <small>
                        {room.amenities
                          .slice(0, 3)
                          .map((amenity) => amenity.name)
                          .join(" · ") ||
                          (room.extraBedAllowed
                            ? locale === "id"
                              ? `Extra bed tersedia hingga ${room.maximumExtraBeds}`
                              : `Up to ${room.maximumExtraBeds} extra bed available`
                            : locale === "id"
                              ? "Tanpa extra bed"
                              : "No extra bed")}
                      </small>
                    </span>
                    <a href="#availability" onClick={goToBookingSearch}>
                      {locale === "id" ? "Lihat kamar" : "View room"}
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="room-search-prompt">
            <p>
              {locale === "id"
                ? "Pilihan kamar dan kapasitas ditampilkan sesuai tanggal menginap Anda."
                : "Room choices and capacity are shown for your selected stay dates."}
            </p>
            <a
              className="button"
              href="#availability"
              onClick={goToBookingSearch}
            >
              {locale === "id" ? "Cari kamar tersedia" : "Find available rooms"}
            </a>
          </div>
        )}
      </section>

      <section className="experience" id="experience">
        <div className="experience-copy">
          <p className="eyebrow light">{landingValue(experience, "eyebrow")}</p>
          <h2>
            <EditorialHeading
              text={landingValue(experience, "title")}
              accent={landingValue(experience, "titleAccent")}
            />
          </h2>
          <p>{landingValue(experience, "body")}</p>
          <ul>
            {landingStrings(experience, "points").map((point) => (
              <li key={point}>{guestFacingText(point, locale)}</li>
            ))}
          </ul>
        </div>
        <div className="experience-gallery">
          {[0, 1, 2].map((index) => (
            <div
              className={index === 0 ? "gallery-main" : "gallery-small"}
              key={experienceImages[index] ?? index}
            >
              <Image
                src={
                  experience?.media?.[index]?.url ||
                  experienceImages[index] ||
                  "/images/agoda-kooka/facility-garden.jpg"
                }
                alt={
                  experience?.media?.[index]?.alt ||
                  "KOOKA Residence atmosphere"
                }
                fill
                sizes="(max-width: 900px) 100vw, 35vw"
              />
              <span className="gallery-label">
                {locale === "id"
                  ? ["Halaman", "Detail kamar", "Momen KOOKA"][index]
                  : ["Courtyard", "Room detail", "KOOKA moments"][index]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {menuCategories.length ? (
        <section className="menu-section section" id="menu">
          <div className="menu-visual">
            <Image
              src={kookaFoodImage}
              alt={
                locale === "id"
                  ? "Hidangan dari dapur KOOKA Residence"
                  : "A dish from the KOOKA Residence kitchen"
              }
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
            />
            <span className="plate plate-one" aria-hidden="true" />
            <span className="plate plate-two" aria-hidden="true" />
            <p>KOOKA kitchen · Surabaya</p>
          </div>
          <div className="menu-copy">
            <p className="eyebrow">
              {locale === "id" ? "Dari dapur KOOKA" : "From the KOOKA kitchen"}
            </p>
            <h2>
              {locale === "id" ? (
                <>
                  Hidangan segar untuk <em>masa tinggal Anda.</em>
                </>
              ) : (
                <>
                  Fresh dishes for <em>your stay.</em>
                </>
              )}
            </h2>
            <p className="menu-intro">
              {locale === "id"
                ? "Nikmati pilihan makanan dan minuman yang dapat dipesan dengan mudah selama Anda menginap."
                : "Enjoy a selection of food and drinks, available to order throughout your stay."}
            </p>
            <div className="menu-list">
              {menuCategories.map((category) => (
                <div className="menu-list-category" key={category.id}>
                  <h3>{category.name}</h3>
                  {category.items.map((item) => {
                    const displayed = formatMenuPrice(
                      item.estimatedTotalIdr,
                      currency,
                      data.menu?.displayRates ?? {},
                      locale,
                    );
                    return (
                      <div
                        className={`menu-list-item${item.available ? "" : " menu-item-unavailable"}`}
                        key={item.id}
                      >
                        <div className="menu-item-copy">
                          <strong>{item.name}</strong>
                          {item.description ? (
                            <small>{item.description}</small>
                          ) : null}
                          {!item.available ? (
                            <small className="menu-unavailable">
                              {locale === "id"
                                ? "Sedang tidak tersedia"
                                : "Currently unavailable"}
                            </small>
                          ) : null}
                        </div>
                        <i aria-hidden="true" />
                        <span>
                          {displayed ??
                            formatMenuPrice(
                              item.estimatedTotalIdr,
                              "IDR",
                              {},
                              locale,
                            )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="menu-currency-note">
              {currency === "IDR"
                ? locale === "id"
                  ? "Harga ditampilkan dalam rupiah. Pajak dan layanan, bila berlaku, tercantum pada tagihan."
                  : "Prices are shown in rupiah. Applicable tax and service charges will appear on your bill."
                : locale === "id"
                  ? `Nilai ${currency} ditampilkan sebagai referensi. Pembayaran dilakukan dalam rupiah.`
                  : `${currency} values are shown for reference. Payment is made in Indonesian rupiah.`}
            </p>
          </div>
        </section>
      ) : null}

      <section className="gallery-section section" id="gallery">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">{landingValue(gallery, "eyebrow")}</p>
            <h2>
              <EditorialHeading
                text={landingValue(gallery, "title")}
                accent={landingValue(gallery, "titleAccent")}
                fallbackWords={3}
              />
            </h2>
          </div>
          <span className="quiet-note">Urban Tropical Retreat</span>
        </div>
        <div className="editorial-grid">
          {[0, 1, 2].map((index) => (
            <div className={`editorial-photo photo-${index + 1}`} key={index}>
              <Image
                src={
                  gallery?.media?.[index]?.url ||
                  galleryImages[index] ||
                  "/images/agoda-kooka/room-mezzanine-guestroom.jpg"
                }
                alt={
                  gallery?.media?.[index]?.alt || "A moment at KOOKA Residence"
                }
                fill
                sizes="(max-width: 760px) 100vw, 50vw"
              />
              <span className="editorial-label">
                {locale === "id"
                  ? ["Kamar", "Halaman", "Detail"][index]
                  : ["Room", "Courtyard", "Detail"][index]}
              </span>
            </div>
          ))}
          <blockquote>
            {landingValue(gallery, "quote")}
            <cite>KOOKA Residence Surabaya</cite>
          </blockquote>
        </div>
      </section>

      <section className="location" id="location">
        <div className="map-art" aria-label="KOOKA Residence location">
          <span className="road r1" />
          <span className="road r2" />
          <span className="road r3" />
          <span className="map-pin">K</span>
          <small>
            {publicAddress(
              landingValue(
                location,
                "address",
                data.property.address ?? "Surabaya, Indonesia",
              ),
            )}
          </small>
        </div>
        <div className="location-copy">
          <p className="eyebrow light">{landingValue(location, "eyebrow")}</p>
          <h2>
            <EditorialHeading
              text={landingValue(location, "title")}
              accent={landingValue(location, "titleAccent")}
            />
          </h2>
          <p>{landingValue(location, "body")}</p>
          <a
            className="button button-light"
            href={landingValue(location, "directionsUrl", "#location")}
            target="_blank"
            rel="noreferrer"
          >
            {locale === "id" ? "Buka petunjuk arah" : "Get directions"}
          </a>
        </div>
      </section>

      <section className="faq section" id="faq">
        <div>
          <p className="eyebrow">{landingValue(faq, "eyebrow")}</p>
          <h2>
            <EditorialHeading
              text={landingValue(faq, "title")}
              accent={landingValue(faq, "titleAccent")}
              fallbackWords={1}
            />
          </h2>
        </div>
        <div className="faq-list">
          {landingRecords(faq, "items").map((item, index) => (
            <details key={String(item.question)} open={index === 0}>
              <summary>
                {String(item.question ?? "")}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{guestFacingText(String(item.answer ?? ""), locale)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <p className="eyebrow light">{landingValue(cta, "eyebrow")}</p>
        <h2>{landingValue(cta, "title")}</h2>
        <p>{landingValue(cta, "body")}</p>
        <a
          className="button button-light"
          href="#availability"
          onClick={goToBookingSearch}
        >
          {landingValue(
            cta,
            "label",
            locale === "id" ? "Cek ketersediaan" : "Check availability",
          )}{" "}
          →
        </a>
      </section>

      <footer>
        <a
          aria-label="KOOKA Residence home"
          className="brand footer-brand"
          href="#top"
        >
          <KookaLogo
            className="brand-logo"
            sizes="(max-width: 560px) 118px, 146px"
          />
        </a>
        <div>
          <strong>{locale === "id" ? "Jelajahi" : "Explore"}</strong>
          <a href="#rooms">{locale === "id" ? "Kamar" : "Rooms"}</a>
          <a href="#gallery">{locale === "id" ? "Galeri" : "Gallery"}</a>
          <a href="#location">{locale === "id" ? "Lokasi" : "Location"}</a>
        </div>
        <div>
          <strong>{locale === "id" ? "Bantuan" : "Help"}</strong>
          <a href="#faq">FAQ</a>
          <a href="#availability" onClick={goToBookingSearch}>
            Booking
          </a>
          <a href={`/booking/lookup?locale=${locale}`}>
            {locale === "id" ? "Lihat booking" : "View booking"}
          </a>
        </div>
        <div>
          <strong>{locale === "id" ? "Temukan kami" : "Find us"}</strong>
          <span>{publicAddress(data.property.address)}</span>
        </div>
        <p className="footer-bottom">
          © 2026 KOOKA Residence · Urban Tropical Retreat in Surabaya.
        </p>
      </footer>

      <a
        className="mobile-booking"
        href="#availability"
        onClick={goToBookingSearch}
      >
        <span>
          {locale === "id" ? "Cek tanggal dan kamar" : "Check dates and rooms"}
        </span>
        <strong>→</strong>
      </a>
    </main>
  );
}
