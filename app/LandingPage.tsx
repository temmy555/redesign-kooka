"use client";

import Image from "next/image";
import kookaFoodImage from "../public/images/agoda-kooka/dining-food-beverages.jpg";
import {
  useEffect,
  useMemo,
  useRef,
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
  publicDateFromToday,
  PublicDateField,
  PublicSelect,
} from "./PublicFormControls";
import KookaLogo from "./KookaLogo";

const WHATSAPP_NUMBER = "6283831455142";
const WHATSAPP_MESSAGE: Record<PublicLocale, string> = {
  id: "Halo KOOKA Residence, saya ingin bertanya soal ketersediaan kamar",
  en: "Hello KOOKA Residence, I'd like to ask about room availability",
};

function whatsappHref(locale: PublicLocale) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE[locale])}`;
}

const roomImageFallbacks = [
  "/images/kooka-assets/ark-05044.jpg",
  "/images/kooka-assets/ark-05050.jpg",
  "/images/kooka-assets/ark-05060.jpg",
  "/images/kooka-assets/ark-05070.jpg",
  "/images/kooka-assets/ark-05080.jpg",
];

const authenticImageReplacements: Record<string, string> = {
  "/images/kooka-hero.jpeg": "/images/kooka-assets/ark-05080.jpg",
  "/images/tropical-courtyard.jpg": "/images/kooka-assets/ark-05070.jpg",
  "/images/gallery-room.jpg": "/images/kooka-assets/ark-05100.jpg",
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
  const [checkIn, setCheckIn] = useState(() => publicDateFromToday(0));
  const [checkout, setCheckout] = useState(() => publicDateFromToday(1));
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
          min={publicDateFromToday(0)}
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

export function RoomDetailModal({
  room,
  fallbackImage,
  locale,
  onClose,
  onCheckAvailability,
}: {
  room: LandingRoomType;
  fallbackImage: string;
  locale: PublicLocale;
  onClose: () => void;
  onCheckAvailability: () => void;
}) {
  const [activeImage, setActiveImage] = useState(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const images = room.media.length
    ? room.media
    : [
        {
          id: `fallback-${room.id}`,
          url: fallbackImage,
          alt: `${room.name} · KOOKA Residence Surabaya`,
          caption: null,
          sortOrder: 0,
        },
      ];
  const currentImage = images[activeImage] ?? images[0]!;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, room.id]);

  const details = [
    {
      label: locale === "id" ? "Kapasitas" : "Capacity",
      value:
        locale === "id"
          ? `Maks. ${room.maximumTotalGuests} tamu`
          : `Max. ${room.maximumTotalGuests} guests`,
    },
    {
      label: locale === "id" ? "Tamu dewasa" : "Adults",
      value:
        locale === "id"
          ? `Maks. ${room.maximumAdults} dewasa`
          : `Max. ${room.maximumAdults} adults`,
    },
    {
      label: locale === "id" ? "Tempat tidur" : "Bed",
      value:
        room.bedConfiguration ||
        (locale === "id"
          ? "Konfirmasi ke Front Office"
          : "Confirm with Front Office"),
    },
    {
      label: "Extra bed",
      value: room.extraBedAllowed
        ? locale === "id"
          ? `Tersedia hingga ${room.maximumExtraBeds}`
          : `Available up to ${room.maximumExtraBeds}`
        : locale === "id"
          ? "Tidak tersedia"
          : "Not available",
    },
  ];

  return (
    <div className="room-modal-shell">
      <button
        aria-label={
          locale === "id" ? "Tutup detail kamar" : "Close room details"
        }
        className="room-modal-backdrop"
        onClick={onClose}
        type="button"
      />
      <section
        aria-labelledby={`room-detail-title-${room.id}`}
        aria-modal="true"
        className="room-modal"
        role="dialog"
      >
        <button
          aria-label={locale === "id" ? "Tutup" : "Close"}
          className="room-modal-close"
          onClick={onClose}
          ref={closeButton}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="room-modal-gallery">
          <div className="room-modal-hero">
            <Image
              alt={currentImage.alt}
              fill
              priority
              sizes="(max-width: 820px) 100vw, 58vw"
              src={currentImage.url}
            />
            {images.length > 1 ? (
              <span className="room-gallery-count">
                {activeImage + 1} / {images.length}
              </span>
            ) : null}
          </div>
          {images.length > 1 ? (
            <div
              aria-label={locale === "id" ? "Galeri kamar" : "Room gallery"}
              className="room-modal-thumbnails"
            >
              {images.map((image, index) => (
                <button
                  aria-label={
                    locale === "id"
                      ? `Lihat foto ${index + 1}`
                      : `View photo ${index + 1}`
                  }
                  aria-pressed={activeImage === index}
                  className={activeImage === index ? "is-active" : undefined}
                  key={image.id}
                  onClick={() => setActiveImage(index)}
                  type="button"
                >
                  <Image alt="" fill sizes="92px" src={image.url} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="room-modal-content">
          <p className="eyebrow">
            {locale === "id" ? "Detail kamar" : "Room details"}
          </p>
          <h2 id={`room-detail-title-${room.id}`}>{room.name}</h2>
          <p className="room-modal-description">
            {room.description ||
              (locale === "id"
                ? "Ruang personal yang tenang untuk beristirahat nyaman selama berada di Surabaya."
                : "A calm, personal space for a comfortable and restful stay in Surabaya.")}
          </p>
          <dl className="room-detail-facts">
            {details.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
          <div className="room-amenities">
            <h3>{locale === "id" ? "Fasilitas kamar" : "Room amenities"}</h3>
            {room.amenities.length ? (
              <ul>
                {room.amenities.map((amenity) => (
                  <li key={amenity.code}>
                    <span aria-hidden="true">✓</span>
                    {amenity.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {locale === "id"
                  ? "Detail fasilitas dapat dikonfirmasi kepada Front Office."
                  : "Amenity details can be confirmed with Front Office."}
              </p>
            )}
          </div>
          <button
            className="button room-modal-cta"
            onClick={onCheckAvailability}
            type="button"
          >
            {locale === "id" ? "Cek ketersediaan" : "Check availability"}
          </button>
        </div>
      </section>
    </div>
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
  const [selectedRoom, setSelectedRoom] = useState<LandingRoomType | null>(
    null,
  );
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const [heroVideoMuted, setHeroVideoMuted] = useState(true);
  const [heroVideoPlaying, setHeroVideoPlaying] = useState(true);

  useEffect(() => {
    const isLocaleExplicit = window.localStorage.getItem(
      "kooka-language-explicit",
    );
    const savedLocale =
      isLocaleExplicit === "1"
        ? window.localStorage.getItem("kooka-language")
        : null;
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
  const menuCategories = useMemo(
    () => data.menu?.categories ?? [],
    [data.menu?.categories],
  );
  const heroImage = authenticImage(
    hero?.media?.[0]?.url ||
      landingValue(hero, "imageUrl", "/images/kooka-assets/ark-05080.jpg"),
  );
  const heroVideo = landingValue(hero, "heroVideoUrl");
  const heroAlt =
    hero?.media?.[0]?.alt ||
    landingValue(hero, "imageAlt", "KOOKA Residence Surabaya");
  const experienceImages = landingStrings(experience, "images").map(
    authenticImage,
  );
  const galleryImages = landingStrings(gallery, "images").map(authenticImage);
  const locationAddress = publicAddress(
    landingValue(
      location,
      "address",
      data.property.address ?? "Surabaya, Indonesia",
    ),
  );
  const locationMapUrl = `https://www.google.com/maps?q=${encodeURIComponent(
    `KOOKA Residence Surabaya, ${locationAddress}`,
  )}&output=embed`;

  function changeCurrency(next: PublicDisplayCurrency) {
    setCurrency(next);
  }

  function focusBookingSearch() {
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

  function goToBookingSearch(event: ReactMouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    focusBookingSearch();
  }

  function toggleHeroVideoSound() {
    const video = heroVideoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setHeroVideoMuted(video.muted);
  }

  function toggleHeroVideoPlayback() {
    const video = heroVideoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play().catch(() => setHeroVideoPlaying(false));
      return;
    }

    video.pause();
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
              onChange={(value) => {
                window.localStorage.setItem("kooka-language-explicit", "1");
                setLocale(value as PublicLocale);
              }}
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
          {heroVideo ? (
            <video
              ref={heroVideoRef}
              className="hero-video"
              autoPlay
              muted
              loop
              playsInline
              poster={heroImage}
              onPause={() => setHeroVideoPlaying(false)}
              onPlay={() => setHeroVideoPlaying(true)}
              onVolumeChange={(event) =>
                setHeroVideoMuted(event.currentTarget.muted)
              }
            >
              <source src={heroVideo} type="video/mp4" />
              <source src={heroVideo} type="video/quicktime" />
            </video>
          ) : (
            <Image
              src={heroImage}
              alt={heroAlt}
              fill
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
            />
          )}
          {heroVideo ? (
            <div className="hero-media-footer">
              <div
                className="hero-video-controls"
                role="group"
                aria-label={
                  locale === "id" ? "Kontrol video hero" : "Hero video controls"
                }
              >
                <button
                  type="button"
                  onClick={toggleHeroVideoPlayback}
                  aria-label={
                    heroVideoPlaying
                      ? locale === "id"
                        ? "Jeda video"
                        : "Pause video"
                      : locale === "id"
                        ? "Putar video"
                        : "Play video"
                  }
                  title={
                    heroVideoPlaying
                      ? locale === "id"
                        ? "Jeda video"
                        : "Pause video"
                      : locale === "id"
                        ? "Putar video"
                        : "Play video"
                  }
                >
                  {heroVideoPlaying ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 6v12M16 6v12" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 6 9 6-9 6Z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={toggleHeroVideoSound}
                  aria-label={
                    heroVideoMuted
                      ? locale === "id"
                        ? "Aktifkan suara"
                        : "Turn sound on"
                      : locale === "id"
                        ? "Matikan suara"
                        : "Mute video"
                  }
                  title={
                    heroVideoMuted
                      ? locale === "id"
                        ? "Aktifkan suara"
                        : "Turn sound on"
                      : locale === "id"
                        ? "Matikan suara"
                        : "Mute video"
                  }
                >
                  {heroVideoMuted ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M11 7 7.5 10H4v4h3.5l3.5 3Z" />
                      <path d="m16 9 5 5M21 9l-5 5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M11 7 7.5 10H4v4h3.5l3.5 3Z" />
                      <path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ) : null}
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
                <button
                  aria-label={
                    locale === "id"
                      ? `Lihat detail ${room.name}`
                      : `View details for ${room.name}`
                  }
                  className="room-image"
                  onClick={() => setSelectedRoom(room)}
                  type="button"
                >
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
                  <span className="image-note">{room.name}</span>
                  <span className="room-arrow" aria-hidden="true">
                    ↗
                  </span>
                </button>
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
                    <button
                      className="room-detail-link"
                      onClick={() => setSelectedRoom(room)}
                      type="button"
                    >
                      {locale === "id" ? "Lihat detail" : "View details"}
                    </button>
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

      {selectedRoom ? (
        <RoomDetailModal
          fallbackImage={
            roomImageFallbacks[
              Math.max(
                0,
                publicRooms.findIndex((room) => room.id === selectedRoom.id),
              ) % roomImageFallbacks.length
            ]!
          }
          locale={locale}
          onCheckAvailability={() => {
            setSelectedRoom(null);
            window.requestAnimationFrame(focusBookingSearch);
          }}
          onClose={() => setSelectedRoom(null)}
          room={selectedRoom}
        />
      ) : null}

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
                  "/images/kooka-assets/ark-05070.jpg"
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
            <p>
              {locale === "id"
                ? "Makanan & minuman · KOOKA Residence"
                : "Food & drinks · KOOKA Residence"}
            </p>
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
          <div className="gallery-section-actions">
            <span className="quiet-note">Urban Tropical Retreat</span>
            <a className="gallery-view-all" href={`/gallery?locale=${locale}`}>
              {locale === "id" ? "Lihat semua galeri" : "Explore the gallery"}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <div className="editorial-grid">
          {[0, 1, 2].map((index) => (
            <div className={`editorial-photo photo-${index + 1}`} key={index}>
              <Image
                src={
                  gallery?.media?.[index]?.url ||
                  galleryImages[index] ||
                  "/images/kooka-assets/ark-05080.jpg"
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
        <div className="location-map">
          <iframe
            title="KOOKA Residence Surabaya on Google Maps"
            src={locationMapUrl}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="location-address">
            <span>KOOKA Residence</span>
            <strong>{locationAddress}</strong>
          </div>
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
          <a href={`/gallery?locale=${locale}`}>
            {locale === "id" ? "Galeri" : "Gallery"}
          </a>
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

      <a
        className="whatsapp-float"
        href={whatsappHref(locale)}
        target="_blank"
        rel="noreferrer"
        aria-label={locale === "id" ? "Chat via WhatsApp" : "Chat via WhatsApp"}
      >
        <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <path d="M16.01 3C9.38 3 4 8.34 4 14.92c0 2.36.64 4.56 1.85 6.48L4 29l7.8-2.05a12.9 12.9 0 0 0 4.21.71h.01c6.63 0 12.01-5.34 12.01-11.92C28.03 8.34 22.65 3 16.01 3Zm0 21.79h-.01a9.9 9.9 0 0 1-5.05-1.39l-.36-.21-4.63 1.21 1.24-4.5-.24-.37a9.78 9.78 0 0 1-1.53-5.21c0-5.42 4.42-9.83 9.87-9.83 2.64 0 5.11 1.03 6.98 2.88a9.75 9.75 0 0 1 2.89 6.95c0 5.42-4.42 9.83-9.87 9.83Zm5.4-7.36c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.34.44-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.91-2.2-.24-.57-.48-.5-.66-.5-.17 0-.37-.02-.56-.02-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.71.23 1.36.19 1.87.12.57-.09 1.75-.71 2-1.4.25-.69.25-1.28.17-1.4-.07-.13-.27-.2-.56-.35Z" />
        </svg>
      </a>
    </main>
  );
}
