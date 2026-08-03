# Notifications dan Customer Communication — KOOKA Residence

| Informasi        | Nilai                                                         |
| ---------------- | ------------------------------------------------------------- |
| Versi            | 1.2 Draft                                                     |
| Tanggal          | 1 Agustus 2026                                                |
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

Instruksi menggunakan payment-instruction snapshot booking. Perubahan rekening tidak mengganti tampilan booking lama sampai `Reissue Payment Instruction` berhasil; reissue mengantrekan notifikasi old/new context yang aman tanpa pernah meminta customer mengabaikan booking code atau mentransfer berdasarkan pesan tidak terverifikasi.

### 3.2 Email pertama

Sistem mengantrekan email `Selesaikan Pembayaran Booking` yang berisi:

- Booking code.
- Ringkasan dan nominal IDR.
- Deadline beserta zona waktu Asia/Jakarta.
- Instruksi transfer ringkas.
- Link `Lihat & Bayar Booking`.

Link boleh mengisi booking code secara otomatis, tetapi customer tetap harus memasukkan email booking. Setelah valid, sistem membuat session berumur pendek agar data lookup tidak dikirim berulang pada setiap request.

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
- Reminder dijadwalkan 30 menit sebelum deadline.
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
- Customer menerima konfirmasi booking dan receipt/dokumen yang relevan.
- Payment `Rejected` tidak mengurangi saldo; alasan customer-facing tidak boleh mengekspos catatan internal.
- Rejection mengarahkan customer untuk menghubungi Front Office atau mengirim bukti yang benar selama hold/review policy masih mengizinkan.

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

## 10. Notifikasi customer minimum

Phase 1 mendukung event berikut:

- Booking dibuat dan instruksi pembayaran.
- Reminder sebelum payment deadline.
- Bukti pembayaran sedang direview.
- Pembayaran verified atau rejected.
- Booking confirmed, amended, cancelled, atau expired.
- Pre-arrival reminder dan informasi late arrival/contact.
- Invoice, receipt, dan refund note tersedia.
- Early check-in/late checkout request diterima, approved, rejected, cancelled, atau changed; pesan menegaskan request belum dijamin sebelum approved dan menampilkan approved time/charge IDR bila ada.
- Lost & Found: kandidat item ditemukan, informasi verifikasi diperlukan, claim verified/rejected, pickup schedule/ready/handover, shipment/tracking/delivery failure, serta retention reminder bila policy mengharuskan.

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
- Reminder lama dibatalkan setelah booking confirmed/cancelled/expired/amended.
- Bukti yang tercatat sebelum deadline membuat `Payment Review Hold`; expiry job tidak melepas inventory selama review.
- Booking tanpa bukti pada deadline menjadi `Expired` dan inventory dilepas tepat sekali.
- Booking expired tidak dapat dibayar/dihidupkan kembali tanpa availability check serta hold baru.
- Satu event retry tidak menghasilkan email ganda.
- WhatsApp manual tidak pernah diberi status `Delivered` atau `Read`.
- Template dan dokumen mengikuti language snapshot serta menampilkan nilai resmi IDR.
- Pesan dan provider log tidak memuat data highly sensitive.
- Notifikasi kandidat Lost & Found tidak membocorkan secret attributes; retry tidak membuat claim/handover/shipment ganda dan perubahan status membatalkan reminder yang tidak lagi relevan.
