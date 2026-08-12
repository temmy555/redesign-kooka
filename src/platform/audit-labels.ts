const exactAuditActionLabels: Record<string, string> = {
  "commercial.rate_plan.publish": "Tarif kamar diterbitkan",
  "commercial.rate_plan.version.create": "Tarif kamar diperbarui",
  "commercial.document_profile.publish":
    "Profil invoice & kuitansi diterbitkan",
  "commercial.document_profile.approve": "Profil invoice & kuitansi disetujui",
  "commercial.document_profile.reject": "Profil invoice & kuitansi ditolak",
  "commercial.document_profile.retire":
    "Profil invoice & kuitansi dinonaktifkan",
  "commercial.document_profile.version.create":
    "Profil invoice & kuitansi diperbarui",
  ROOM_MARKED_READY: "Kamar ditandai siap",
  ROOM_CLEANING_STARTED: "Pembersihan kamar dimulai",
  ROOM_RETURNED_TO_SERVICE: "Kamar kembali tersedia",
  ROOM_ASSIGNED: "Kamar dialokasikan",
  ROOM_MOVED: "Tamu dipindahkan ke kamar lain",
  ROOM_BLOCKED: "Kamar diblokir",
  CLEANING_TASK_CREATED: "Jadwal pembersihan dibuat",
  CLEANING_TASK_TRANSITIONED: "Status pembersihan diperbarui",
  MAINTENANCE_REPORTED: "Perawatan kamar dilaporkan",
  MAINTENANCE_TRANSITIONED: "Status perawatan diperbarui",
  DAMAGE_ASSESSED: "Kerusakan tamu dicatat",
  LOST_FOUND_RECORDED: "Barang tertinggal dicatat",
  LOST_FOUND_CLAIM_RECORDED: "Pengambilan barang tertinggal dicatat",
  PAPER_ORDER_ENTERED: "Pesanan F&B dicatat",
  STATUS_CHANGED: "Status diperbarui",
  CANCELLED: "Dibatalkan",
  PAYMENT_ALLOCATED: "Pembayaran dialokasikan",
  FINANCIAL_DOCUMENT_ISSUED: "Dokumen tagihan diterbitkan",
  FINANCIAL_DOCUMENT_SUPERSEDED: "Dokumen tagihan diganti",
  FINANCIAL_DOCUMENT_RENDER_RETRIED: "Pembuatan dokumen diulang",
  FOLIO_ENTRY_POSTED: "Rincian tagihan ditambahkan",
  FOLIO_ENTRY_REVERSED: "Rincian tagihan dibatalkan",
  MANUAL_REFUND_APPROVED: "Refund manual disetujui",
  REPORT_EXPORTED: "Laporan diunduh",
  RECONCILIATION_RUN: "Pemeriksaan kesesuaian data dijalankan",
  BUSINESS_DAY_ROLLOVER_COMPLETED: "Pergantian hari operasional selesai",
  CHECKIN_CAPTURE_RECORDED: "Data registrasi tamu disimpan",
  MARK_NO_SHOW: "Tamu ditandai tidak datang",
  NO_SHOW_ROOM_RELEASED: "Kamar tamu yang tidak datang dilepas",
  ALL_STAYS_CHECKED_OUT: "Semua kamar telah check-out",
};

const subjectLabels: Array<[RegExp, string]> = [
  [/document[ _]profile/, "Profil invoice & kuitansi"],
  [/payment[ _]instruction/, "Instruksi pembayaran"],
  [/rate[ _]plan/, "Tarif kamar"],
  [/exchange[ _]rate/, "Kurs tampilan"],
  [/room[ _]type/, "Jenis kamar"],
  [/room[ _]unit/, "Nomor kamar"],
  [/resource[ _]pool/, "Persediaan tambahan"],
  [/amenity/, "Fasilitas kamar"],
  [/property[ _]profile/, "Profil properti"],
  [/setting/, "Pengaturan operasional"],
  [/tax/, "Pajak dan biaya layanan"],
  [/policy/, "Kebijakan pembatalan"],
  [/menu.*category|category/, "Kategori menu"],
  [/menu.*item|item[ _]version|item/, "Menu F&B"],
  [/room[ _]gallery/, "Galeri kamar"],
  [/media/, "Media galeri"],
  [/content/, "Konten landing page"],
  [/attendance.*location|location/, "Titik absensi"],
  [/attendance/, "Absensi"],
  [/reservation/, "Booking"],
  [/payment/, "Pembayaran"],
  [/role/, "Hak akses staf"],
  [/staff|owner/, "Akun staf"],
  [/file/, "File"],
  [/room/, "Kamar"],
  [/report/, "Laporan"],
];

const operationLabels: Array<[RegExp, string]> = [
  [/(^|[ ._])submit[ _]review$/, "diajukan untuk diperiksa"],
  [/(^|[ ._])status[ _]change$/, "statusnya diperbarui"],
  [/(^|[ ._])type[ _]change$/, "jenisnya diubah"],
  [/(^|[ ._])sort[ _]order[ ._]set$/, "urutannya diperbarui"],
  [/(^|[ ._])availability[ ._]set$/, "ketersediaannya diperbarui"],
  [/(^|[ ._])room[ _]gallery[ ._]set$/, "diperbarui"],
  [/(^|[ ._])version[ ._]create$/, "diperbarui"],
  [/(^|[ ._])create$/, "dibuat"],
  [/(^|[ ._])update$/, "diperbarui"],
  [/(^|[ ._])publish$/, "diterbitkan"],
  [/(^|[ ._])approve$/, "disetujui"],
  [/(^|[ ._])reject$/, "ditolak"],
  [/(^|[ ._])retire$/, "dinonaktifkan"],
  [/(^|[ ._])archive$/, "diarsipkan"],
  [/(^|[ ._])activate$/, "diaktifkan"],
  [/(^|[ ._])cancel$/, "dibatalkan"],
  [/(^|[ ._])void$/, "dibatalkan"],
  [/(^|[ ._])grant$/, "diberikan"],
  [/(^|[ ._])revoke$/, "dicabut"],
  [/(^|[ ._])upload$/, "diunggah"],
  [/(^|[ ._])link$/, "dihubungkan"],
  [/(^|[ ._])set$/, "diperbarui"],
  [/(^|[ ._])authenticate$/, "diverifikasi"],
  [/(^|[ ._])purge$/, "dihapus permanen"],
];

const fallbackWords: Record<string, string> = {
  commercial: "pengaturan",
  configuration: "pengaturan",
  cms: "konten",
  identity: "akun",
  fnb: "F&B",
  room: "kamar",
  cleaning: "pembersihan",
  started: "dimulai",
  marked: "ditandai",
  ready: "siap",
  create: "dibuat",
  created: "dibuat",
  update: "diperbarui",
  updated: "diperbarui",
  publish: "diterbitkan",
  published: "diterbitkan",
  approve: "disetujui",
  approved: "disetujui",
  reject: "ditolak",
  rejected: "ditolak",
  cancel: "dibatalkan",
  cancelled: "dibatalkan",
};

function readableFallback(action: string) {
  const words = action
    .trim()
    .toLocaleLowerCase("id-ID")
    .split(/[._:-]+/)
    .filter(Boolean)
    .map((word) => fallbackWords[word] ?? word);

  if (words.length === 0) return "Aktivitas sistem";
  const label = words.join(" ");
  return label.charAt(0).toLocaleUpperCase("id-ID") + label.slice(1);
}

export function auditActionLabel(action: string) {
  const trimmed = action.trim();
  if (!trimmed) return "Aktivitas sistem";

  const exact = exactAuditActionLabels[trimmed];
  if (exact) return exact;

  const normalized = trimmed.toLocaleLowerCase("id-ID");
  const subject = subjectLabels.find(([pattern]) => pattern.test(normalized));
  const operation = operationLabels.find(([pattern]) =>
    pattern.test(normalized),
  );

  if (subject && operation) return `${subject[1]} ${operation[1]}`;
  return readableFallback(trimmed);
}
