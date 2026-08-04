import type {
  LandingSection,
  PublicLandingData,
  PublicLocale,
} from "./contracts";

const baselineSections: LandingSection[] = [
  {
    key: "hero",
    type: "HERO",
    content: {
      eyebrow: "Urban Tropical Retreat · Surabaya",
      title: "Hunian tenang & nyaman di Surabaya.",
      titleAccent: "nyaman di Surabaya.",
      body: "Beristirahatlah di rumah taman kami yang asri. Nikmati suasana hijau dan ruang yang personal, tetap dekat dengan kebutuhan kota.",
      bookingNote:
        "Pesan langsung untuk pengalaman menginap yang lebih personal",
      imageUrl: "/images/agoda-kooka/property-entrance.jpg",
      imageAlt: "Pintu masuk KOOKA Residence Surabaya",
      imageLabel: "KOOKA Residence · Surabaya, Indonesia",
    },
  },
  {
    key: "trust",
    type: "TRUST_STRIP",
    content: {
      items: [
        {
          title: "Suasana asri",
          body: "Taman hijau untuk rehat yang lebih tenang",
        },
        {
          title: "Kamar bersih dan nyaman",
          body: "Ruang personal untuk istirahat berkualitas",
        },
        {
          title: "Lokasi di Surabaya Barat",
          body: "Dekat kebutuhan harian dan berbagai tujuan kota",
        },
        {
          title: "Reservasi langsung",
          body: "Layanan personal sejak sebelum kedatangan",
        },
      ],
    },
  },
  {
    key: "rooms",
    type: "ROOM_COLLECTION",
    content: {
      eyebrow: "Akomodasi",
      title: "Temukan kamar yang terasa seperti rumah.",
      titleAccent: "seperti rumah.",
      body: "Pilih ruang yang paling sesuai untuk masa tinggal dan kenyamanan Anda.",
    },
  },
  {
    key: "experience",
    type: "EDITORIAL_FEATURE",
    content: {
      eyebrow: "The KOOKA feeling",
      title: "Tempat rindang untuk memulihkan tenaga.",
      titleAccent: "memulihkan tenaga.",
      body: "Tidur nyenyak, bangun dalam suasana yang lebih pelan, lalu nikmati waktu di halaman hijau. KOOKA menyambut perjalanan singkat, waktu sendiri, maupun liburan bersama orang terdekat.",
      points: [
        "Lingkungan asri dengan pemandangan taman",
        "Kamar yang intim untuk istirahat yang tenang",
        "Layanan hangat dan personal selama menginap",
      ],
      images: [
        "/images/agoda-kooka/facility-garden.jpg",
        "/images/agoda-kooka/room-mezzanine-guestroom.jpg",
        "/images/agoda-kooka/facility-balcony-01.jpg",
      ],
    },
  },
  {
    key: "gallery",
    type: "GALLERY",
    content: {
      eyebrow: "A quiet corner of the city",
      title: "Suasana, kamar, dan momen di KOOKA.",
      titleAccent: "momen di KOOKA.",
      quote: "A slower, softer way to stay in Surabaya.",
      images: [
        "/images/agoda-kooka/room-two-bedroom-villa-interior.jpg",
        "/images/agoda-kooka/property-exterior-02.jpg",
        "/images/agoda-kooka/facility-garden.jpg",
      ],
    },
  },
  {
    key: "location",
    type: "LOCATION",
    content: {
      eyebrow: "Lokasi",
      title: "Suasana kota yang tetap terasa damai.",
      titleAccent: "terasa damai.",
      body: "KOOKA Residence berada di Surabaya Barat, dekat tempat makan, perbelanjaan, sekolah, dan fasilitas medis.",
      address: "Jl. Darmo Permai Selatan XVI/28, Surabaya",
      directionsUrl:
        "https://www.google.com/maps/search/?api=1&query=Kooka+Residence+Surabaya",
    },
  },
  {
    key: "faq",
    type: "FAQ",
    content: {
      eyebrow: "Sebelum menginap",
      title: "Hal yang sering ditanyakan.",
      titleAccent: "ditanyakan.",
      items: [
        {
          question: "Bagaimana cara melakukan pembayaran?",
          answer:
            "Setelah reservasi dibuat, Anda akan menerima kode booking dan petunjuk pembayaran. Kirimkan bukti transfer melalui WhatsApp agar reservasi dapat kami konfirmasi.",
        },
        {
          question: "Apakah sarapan termasuk harga kamar?",
          answer:
            "Sarapan tidak termasuk dalam harga kamar. Pilihan makanan dan minuman dapat dipesan secara terpisah selama Anda menginap.",
        },
        {
          question: "Kapan waktu check-in dan checkout?",
          answer:
            "Jadwal standar check-in pukul 14.00 dan checkout pukul 12.00. Waktu kedatangan lebih awal atau lebih malam dapat dibicarakan langsung dengan Front Office dan menyesuaikan kesiapan kamar.",
        },
        {
          question: "Apakah nomor kamar dapat dipilih saat booking?",
          answer:
            "Anda memilih tipe kamar saat reservasi. Nomor kamar akan kami siapkan berdasarkan ketersediaan pada hari kedatangan.",
        },
      ],
    },
  },
  {
    key: "cta",
    type: "CTA",
    content: {
      eyebrow: "Your quiet stay in Surabaya",
      title: "Tempat nyaman Anda sudah menanti.",
      body: "Cari tanggal menginap dan temukan ruang yang terasa seperti rumah.",
      label: "Cek ketersediaan",
    },
  },
];

const englishByKey: Record<string, Record<string, unknown>> = {
  hero: {
    eyebrow: "Urban Tropical Retreat · Surabaya",
    title: "A calm, comfortable stay in Surabaya.",
    titleAccent: "comfortable stay in Surabaya.",
    body: "Rest in our leafy garden home. Enjoy green surroundings and personal spaces while staying close to the city’s essentials.",
    bookingNote: "Book direct for a more personal stay",
    imageUrl: "/images/agoda-kooka/property-entrance.jpg",
    imageAlt: "Entrance to KOOKA Residence Surabaya",
    imageLabel: "KOOKA Residence · Surabaya, Indonesia",
  },
  trust: {
    items: [
      {
        title: "Leafy surroundings",
        body: "A green garden for a calmer pause",
      },
      {
        title: "Clean and comfortable",
        body: "Personal spaces made for quality rest",
      },
      {
        title: "West Surabaya location",
        body: "Close to daily essentials and city destinations",
      },
      {
        title: "Direct reservation",
        body: "Personal care from before you arrive",
      },
    ],
  },
  rooms: {
    eyebrow: "Accommodation",
    title: "Find a room that feels like home.",
    titleAccent: "feels like home.",
    body: "Choose the space that best suits your stay and comfort.",
  },
  experience: {
    eyebrow: "The KOOKA feeling",
    title: "A leafy hideout to recharge.",
    titleAccent: "to recharge.",
    body: "Sleep well, wake to a slower rhythm, then spend time in the leafy courtyard. KOOKA welcomes short trips, time alone, and quiet stays with the people closest to you.",
    points: [
      "Leafy surroundings with garden views",
      "Intimate rooms made for restful sleep",
      "Warm, personal care throughout your stay",
    ],
    images: [
      "/images/agoda-kooka/facility-garden.jpg",
      "/images/agoda-kooka/room-mezzanine-guestroom.jpg",
      "/images/agoda-kooka/facility-balcony-01.jpg",
    ],
  },
  gallery: {
    eyebrow: "A quiet corner of the city",
    title: "The atmosphere, rooms and moments at KOOKA.",
    titleAccent: "moments at KOOKA.",
    quote: "A slower, softer way to stay in Surabaya.",
    images: [
      "/images/agoda-kooka/room-two-bedroom-villa-interior.jpg",
      "/images/agoda-kooka/property-exterior-02.jpg",
      "/images/agoda-kooka/facility-garden.jpg",
    ],
  },
  location: {
    eyebrow: "Location",
    title: "A city stay that still feels peaceful.",
    titleAccent: "feels peaceful.",
    body: "KOOKA Residence is in West Surabaya, close to dining, shopping, schools and medical facilities.",
    address: "Jl. Darmo Permai Selatan XVI/28, Surabaya",
    directionsUrl:
      "https://www.google.com/maps/search/?api=1&query=Kooka+Residence+Surabaya",
  },
  faq: {
    eyebrow: "Before your stay",
    title: "Frequently asked questions.",
    titleAccent: "questions.",
    items: [
      {
        question: "How do I make a payment?",
        answer:
          "Once your reservation is made, you will receive a booking code and payment instructions. Send your transfer receipt through WhatsApp so we can confirm your stay.",
      },
      {
        question: "Is breakfast included?",
        answer:
          "Breakfast is not included in the room rate. Food and drinks can be ordered separately during your stay.",
      },
      {
        question: "What are the check-in and checkout times?",
        answer:
          "Standard check-in is at 14:00 and checkout is at 12:00. Earlier or late-night arrivals can be arranged directly with Front Office, subject to room readiness.",
      },
      {
        question: "Can I choose a room number when booking?",
        answer:
          "You choose a room type when booking. We will prepare the room number based on availability on your arrival day.",
      },
    ],
  },
  cta: {
    eyebrow: "Your quiet stay in Surabaya",
    title: "Your comfortable haven is waiting.",
    body: "Search your dates and find a space that feels like home.",
    label: "Check availability",
  },
};

export function approvedBaselineSections(
  locale: PublicLocale,
): LandingSection[] {
  if (locale === "id") return baselineSections;
  return baselineSections.map((section) => ({
    ...section,
    content: englishByKey[section.key] ?? section.content,
  }));
}

export function approvedBaselineLanding(
  locale: PublicLocale,
  generatedAt = new Date(),
): PublicLandingData {
  return {
    source: "APPROVED_BASELINE",
    locale,
    pageVersionId: null,
    property: {
      name: "KOOKA Residence Surabaya",
      address: "Jl. Darmo Permai Selatan XVI/28, Surabaya",
      baseCurrency: "IDR",
    },
    sections: approvedBaselineSections(locale),
    rooms: [],
    generatedAt: generatedAt.toISOString(),
  };
}
