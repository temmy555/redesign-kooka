# Notifications dan Customer Communication — KOOKA Residence

| Informasi        | Nilai                                                         |
| ---------------- | ------------------------------------------------------------- |
| Versi            | 1.3 Draft                                                     |
| Tanggal          | 4 Agustus 2026                                                |
| Scope            | Phase 1 communication foundation; Phase 3 WhatsApp automation |
| Sumber kebutuhan | [PRD.md](PRD.md)                                              |

## 1. Tujuan

Dokumen ini mengatur komunikasi customer dan alert internal tanpa menjadikan email atau WhatsApp sebagai sumber kebenaran transaksi. Reservation, inventory, payment, folio, dan refund tetap diproses di sistem; notifikasi hanya menyampaikan hasil atau meminta tindakan.

## 2. Kanal per fase

### Phase 1

- Email transaksional.
- In-app notification dan exception queue untuk staf.
- Tombol/deep link WhatsApp dengan pesan yang telah diisi, tetapi dikirim customer atau staf secara manual.
- Halaman `Cek Booking` tanpa akun menggunakan booking code dan email booking.

Status WhatsApp manual hanya boleh berupa:

- `Prepared`: pesan berhasil disiapkan.
- `Opened`: deep link WhatsApp dibuka.
- `Handed Off`: kontrol berpindah ke aplikasi WhatsApp.

Sistem tidak boleh mengklaim pesan WhatsApp manual sebagai `Sent`, `Delivered`, atau `Read` karena status tersebut belum dapat diverifikasi.

### Phase 3

WhatsApp Business API dapat menambahkan pengiriman otomatis, template approval, delivery receipt, inbound message handling, dan status `Sent/Delivered/Read` jika provider benar-benar mendukungnya.

## 3. Alur customer setelah booking online

### 3.1 Halaman booking berhasil

Setelah booking dibuat, customer langsung melihat:

- Kode booking.
- Ringkasan tanggal, room type, jumlah kamar, dan tamu.
- Total resmi dan required payment 100% dalam IDR untuk booking online publik.
- Rekening bank resmi dan tombol salin.
- Payment deadline dan countdown yang menggunakan waktu server.
- Tombol `Konfirmasi via WhatsApp` dengan booking code serta nominal terisi otomatis.
- Tombol `Lihat & Bayar Booking` untuk membuka halaman booking kembali.

Website tidak menerima atau memproses pembayaran pada tahap ini. Halaman hanya menampilkan instruksi transfer manual yang berlaku.

Instruksi menggunakan payment-instruction snapshot booking. Perubahan rekening
tidak mengganti tampilan booking lama; informasi rekening historis tetap dapat
dilihat melalui halaman `Cek Booking` tanpa mengirim email tambahan.

### 3.2 Tidak ada email saat booking baru dibuat

Kode booking, total, deadline, seluruh rekening transfer, dan instruksi pembayaran
ditampilkan langsung pada halaman booking berhasil serta halaman `Cek Booking`.
Booking baru tidak mengirim email instruksi pembayaran atau reminder. Customer
mengirim kode booking dan bukti transfer melalui WhatsApp sesuai alur manual.

### 3.3 Kembali melalui Cek Booking

Customer dapat membuka menu `Cek Booking` lalu memasukkan booking code dan email booking. Halaman yang valid dapat menampilkan:

- Ringkasan booking dan reservation status.
- Payment balance serta status review pembayaran.
- Total/required payment/saldo resmi dalam IDR; label deposit hanya digunakan pada admin-created manual booking.
- Payment deadline dan countdown bila masih berlaku.
- Rekening dan instruksi transfer aktif.
- Dokumen customer yang diizinkan.
- Tombol WhatsApp untuk mengirim konfirmasi.

Phase 1 tidak menyediakan perubahan atau cancellation mandiri. Customer diarahkan ke Front Office/WhatsApp.

## 4. Deadline pembayaran dan inventory

Konfigurasi awal yang disepakati:

- Checkout-session hold: default 15 menit sejak customer memasuki tahap penyelesaian booking.
- Public online payment deadline: default 2 jam sejak booking `On Hold/Pending Payment` dibuat.
- Deadline 1 jam hanya untuk same-day booking atau policy khusus yang dikonfigurasi admin.
- Tidak ada reminder deadline melalui email. Deadline tetap terlihat pada halaman
  `Cek Booking` dan antrean operasional Front Office.
- Seluruh deadline ditampilkan dengan waktu absolut Asia/Jakarta selain countdown.

Deadline pembayaran berarti customer telah melakukan transfer dan menyerahkan bukti/referensi sebelum batas waktu; bukan batas waktu bagi admin untuk menyelesaikan verifikasi.

Jika bukti diterima sebelum deadline:

1. Admin mencatat payment record `Pending Verification` beserta received-at.
2. Booking masuk `Payment Review Hold`.
3. Inventory tidak dilepas oleh expiry job selama review berlangsung.
4. Customer melihat pesan `Pembayaran sedang diverifikasi. Booking Anda masih ditahan.`
5. Admin kemudian memverifikasi atau menolak payment.

Jika tidak ada bukti/referensi yang tercatat sampai deadline, reservation menjadi `Expired` dan inventory dilepas secara atomik. Customer yang telah expired harus membuat booking baru; Front Office hanya dapat membuka kembali booking setelah availability diperiksa ulang dan deadline baru dibuat.

## 5. Verifikasi dan hasil pembayaran

- Payment `Verified` diposting ke folio.
- Untuk booking online publik, reservation menjadi `Confirmed` dan guarantee classification `Guaranteed` hanya setelah pembayaran 100% terverifikasi. Verified partial payment tetap tampil sebagai credit/outstanding dan tidak melewati confirmation guard.
- Email konfirmasi dikirim satu kali ketika ambang pembayaran wajib pertama kali
  terpenuhi dan booking terkonfirmasi. Verifikasi pembayaran sebagian tidak
  mengirim email.
- Payment `Rejected` tidak mengurangi saldo; alasan customer-facing tidak boleh mengekspos catatan internal.
- Rejection terlihat pada halaman `Cek Booking` dan ditangani melalui Front
  Office/WhatsApp; sistem tidak mengirim email rejection.

## 6. Event, message, dan delivery dipisahkan

Satu business event dapat menghasilkan beberapa message, dan satu message dapat memiliki beberapa delivery attempt. Contoh: `payment.verified` menghasilkan email customer, in-app update Front Office, dan audit reference.

Status delivery otomatis:

- `Pending`.
- `Processing`.
- `Sent`.
- `Delivered`, hanya jika provider menyediakan bukti.
- `Failed`.
- `Cancelled`.
- `Suppressed`, misalnya alamat tidak valid atau preferensi non-transaksional.

Status bisnis tidak boleh bergantung pada keberhasilan provider notifikasi. Booking/payment transaction harus selesai terlebih dahulu; event dikirim melalui transactional outbox dan background worker.

## 7. Reliability dan idempotency

- Event dan outbox ditulis dalam transaksi yang sama dengan perubahan bisnis.
- Worker dapat retry dengan exponential backoff tanpa menggandakan pesan.
- Dedupe key minimal menggunakan business event ID, recipient, channel, dan template/version.
- Kegagalan permanen masuk failure review queue.
- Notifikasi terjadwal dibatalkan atau diganti saat booking diubah, dibatalkan, dikonfirmasi, expired, atau payment status berubah.
- Pengiriman ulang manual memakai action berizin dan tercatat, bukan membuat event bisnis palsu.

## 8. Template, bahasa, dan histori

- Template memiliki key stabil, versi, channel, subject/title, serta isi Bahasa Indonesia dan English.
- Bahasa mengikuti language snapshot booking; admin dapat memilih bahasa lain sebelum resend.
- Fallback tidak boleh menghasilkan key atau konten kosong.
- Setiap message menyimpan template version dan rendered snapshot agar histori tetap dapat dibaca setelah template berubah.
- Nominal customer-facing selalu menampilkan IDR sebagai nilai resmi; USD/AUD hanya boleh menjadi estimasi sekunder berlabel.
- Template menyertakan identitas KOOKA dan kanal kontak resmi untuk mengurangi risiko phishing.

## 9. Recipient routing

Recipient disimpan berdasarkan peran, bukan hanya satu field email:

- `Booker/Contact Person`.
- `Primary Guest` atau `Room Lead Guest` bila komunikasi stay diperlukan.
- `Payer` untuk instruksi atau bukti pembayaran.
- `Invoice Recipient` untuk dokumen keuangan.

Satu orang dapat memegang beberapa peran. Sistem melakukan dedupe untuk pesan yang sama, tetapi routing invoice terpisah tetap mengikuti instruksi billing.

## 10. Email customer Phase 1

Hanya tiga jenis email customer yang dikirim:

1. Bukti pembayaran telah dicatat dan menunggu verifikasi Front Office.
2. Pembayaran telah terverifikasi dan booking terkonfirmasi. Email ini hanya
   dikirim saat ambang pembayaran wajib pertama kali terpenuhi.
3. Invoice yang sengaja diterbitkan dan dikirim oleh Front Office. Proforma,
   receipt, refund note, dan rincian tagihan tetap dapat dibuat sebagai PDF,
   tetapi tidak dikirim otomatis melalui email.

Booking dibuat, payment reminder, payment rejected/voided, booking amended,
cancelled/expired, pre-arrival, early/late request, dan event operasional lain
tidak mengirim email customer. Statusnya tetap tersedia pada halaman `Cek
Booking`, antarmuka staf, audit log, dan komunikasi WhatsApp manual bila perlu.

Email reset password staf tetap tersedia sebagai email keamanan akun internal
dan tidak dihitung sebagai email customer booking.

Notifikasi marketing/promosi harus dipisahkan dari komunikasi transaksional dan memerlukan consent/preference tersendiri bila kelak digunakan.

## 11. Alert internal minimum

- Payment menunggu verifikasi atau mendekati deadline.
- Booking baru, unassigned room, dan konflik allocation/maintenance.
- Room belum ready mendekati check-in.
- Possible no-show atau arrival overdue.
- Late checkout risk dan same-day turnover.
- Cleaning overdue atau inspection gagal.
- Refund menunggu approval/proses.
- POS/service posting failure pada Phase 2.
- Security, suspicious access, retention, atau purge failure.
- Lost & Found high-value/unsecured item, claim pending/multiple, pickup overdue, shipment failed/returned, retention deadline, disposition approval, custody gap, atau seal mismatch.

Alert internal memiliki lifecycle `Open`, `Acknowledged`, `Resolved`, atau `Escalated`. Mengirim alert tidak berarti masalah selesai; resolution harus merujuk action atau bukti penyelesaian.

## 12. Keamanan dan privasi

- Email, push, atau WhatsApp tidak boleh memuat nomor/foto KTP, tanda tangan, rekening refund, bukti transfer internal, internal notes, atau link file publik.
- Pesan Lost & Found tidak memuat foto penuh, ciri rahasia, alamat lengkap, isi dokumen, lokasi storage, nomor seal, atau custody evidence.
- Informasi sensitif hanya diakses melalui session/short-lived authorized link yang sesuai.
- Log provider dan analytics tidak boleh merekam secret token, booking-email pair, atau payload sensitif.
- Error lookup tetap generik, rate-limited, dan dimonitor.
- Unsubscribe tidak boleh mematikan pesan transaksional penting; kategori marketing dikelola terpisah.

## 13. Minimum acceptance tests

- Booking berhasil tetap tersimpan ketika provider email gagal; outbox dapat retry tanpa booking ganda.
- Customer menerima booking code di layar dan dapat kembali menggunakan booking code saja; email dapat diisi sebagai verifikasi tambahan.
- Deep link dari email tidak membuka detail booking hanya dengan code tanpa verifikasi email/session.
- Public booking memperoleh deadline 2 jam; policy same-day dapat menggunakan 1 jam.
- Public booking tidak menawarkan deposit; amount required selalu 100% total resmi IDR. Deposit persentase/nominal tetap hanya dapat berasal dari admin-created manual booking.
- Verified partial public payment tidak mengonfirmasi reservation; bila expiry terjadi, inventory dilepas tanpa menghapus payment/folio credit dan penyelesaiannya masuk workflow manual resmi.
- Booking baru, reminder deadline, rejection, void, cancellation, dan expiry tidak
  membuat email customer.
- Bukti yang tercatat sebelum deadline membuat `Payment Review Hold`; expiry job tidak melepas inventory selama review.
- Booking tanpa bukti pada deadline menjadi `Expired` dan inventory dilepas tepat sekali.
- Booking expired tidak dapat dibayar/dihidupkan kembali tanpa availability check serta hold baru.
- Satu event retry tidak menghasilkan email ganda.
- Konfirmasi tidak dikirim ulang ketika pembayaran tambahan dicatat setelah
  ambang pembayaran wajib sudah terpenuhi.
- Dua email status pembayaran memakai template HTML KOOKA dan tetap memiliki
  plain-text fallback; email dokumen menyertakan PDF.
- WhatsApp manual tidak pernah diberi status `Delivered` atau `Read`.
- Template dan dokumen mengikuti language snapshot serta menampilkan nilai resmi IDR.
- Pesan dan provider log tidak memuat data highly sensitive.
- Notifikasi kandidat Lost & Found tidak membocorkan secret attributes; retry tidak membuat claim/handover/shipment ganda dan perubahan status membatalkan reminder yang tidak lagi relevan.
