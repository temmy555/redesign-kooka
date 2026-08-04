# Conversation Transcript — Redesign Kooka

## Tujuan dokumen

Dokumen ini menyimpan handoff permintaan pengguna dan keputusan yang harus dipertahankan agar proyek dapat dilanjutkan tanpa kehilangan konteks. Ini bukan transkrip kata-per-kata dari percakapan yang tidak tersedia di workspace; isinya merekam seluruh konteks yang disertakan dalam handoff setup pada 1 Agustus 2026.

## Permintaan pengguna

> Buat dan siapkan project baru bernama “Redesign Kooka” untuk redesign landing page dan pembangunan sistem booking/operasional KOOKA Residence Surabaya.

Konteks wajib yang diberikan pengguna:

1. Website saat ini adalah <https://www.kookaresidencesby.com/> dan digunakan sebagai landing page serta pemesanan guesthouse.
2. Arah visual: **Urban Tropical Retreat** — boutique guesthouse yang tenang, hangat, hijau, dan personal.
3. Fondasi brand hijau dan hero properti asli dinilai baik, tetapi homepage terlalu panjang di mobile, navigasi terlalu padat, dan foto stock/Unsplash harus diganti foto asli.
4. Hero membutuhkan check-in, check-out, jumlah tamu, dan jumlah kamar.
5. Kamar menjadi fokus utama; services, tours, gym, dan F&B menjadi pendukung/upsell.
6. Website membutuhkan trust strip, testimoni terverifikasi, lokasi/jarak nyata, FAQ, dan sticky booking CTA pada mobile.
7. Pembayaran awal dilakukan manual melalui transfer bank, deposit, cash, bayar saat check-in, atau bayar saat checkout.
8. Sistem memberikan kode booking dan instruksi transfer; customer mengirim bukti serta kode melalui WhatsApp; admin memverifikasi manual.
9. Xendit belum digunakan karena verifikasi bisnis belum selesai.
10. Sistem admin membutuhkan login/RBAC dengan minimal role Super Admin/Owner, Admin/Front Office, Cleaning, dan F&B.
11. Admin mengelola booking online/manual, payment verification, status, room board, unassigned room, maintenance/block, room move, folio, invoice, refund, dan audit.
12. Sistem mendukung multi-room, group booking, package, whole house, serta refund manual melalui transfer.
13. Housekeeping memiliki task otomatis dan status `Assigned`, `In Progress`, `Cleaned`, `Inspected`.
14. CMS mengelola media dan detail kamar berbasis amenity master.
15. POS, services, dan tours dapat standalone atau masuk ke folio/tagihan kamar.
16. Reservation, stay, payment, room, cleaning, dan refund status harus dipisahkan.
17. Inventory berdasarkan unit fisik; booking boleh belum dialokasikan ke nomor kamar.
18. Satu booking memiliki folio berisi room charge, POS, service, payment, discount, dan refund.
19. Perubahan sensitif wajib memiliki audit log.
20. Delivery dibagi menjadi tiga fase: core lodging MVP; revenue extension; lalu automation/integration.

Tugas setup yang diminta:

- Membuat struktur project yang rapi.
- Menyalin PRD lengkap ke `docs/PRD.md` tanpa menghilangkan isi.
- Membuat `README.md` yang menjelaskan tujuan, scope, dan status.
- Membuat `docs/PROJECT-CONTEXT.md`.
- Membuat `docs/WEBSITE-AUDIT.md`.
- Membuat `docs/CONVERSATION-TRANSCRIPT.md`.
- Tidak memulai implementasi aplikasi.
- Melaporkan daftar file yang dibuat setelah setup selesai.

## Permintaan lanjutan — registrasi check-in opsional

Pengguna menambahkan kebutuhan bahwa saat tamu check-in, staf mungkin perlu meminta data KTP dan tanda tangan. Aplikasi web nantinya juga akan dibuka melalui tablet agar Front Office dapat mengambil foto dan tamu dapat langsung menandatangani di perangkat tersebut. Untuk tahap awal, proses ini harus opsional agar operasional tidak kaku.

Keputusan yang dicatat:

- Foto KTP/identitas dapat diambil dari kamera browser atau diunggah sebagai file.
- Foto tamu juga disediakan sebagai field opsional bila dibutuhkan operasional.
- Tanda tangan menggunakan signature pad yang mendukung jari atau stylus pada tablet.
- Staf/tamu dapat preview, retake, menghapus, dan mengulang sebelum menyimpan.
- Penolakan izin kamera memiliki fallback upload dan input manual.
- Seluruh langkah pada awalnya ditetapkan opsional secara default dan dapat dilewati tanpa menghalangi check-in; keputusan berikutnya mempertegas bahwa ketiganya selalu opsional pada Phase 1.
- Kelengkapan registrasi disimpan terpisah dari reservation, stay, payment, room, cleaning, dan refund status.
- KTP, nomor identitas, foto tamu, dan tanda tangan adalah data sensitif yang memerlukan private storage, encryption, RBAC, consent/purpose notice, audit trail, serta retention/deletion policy.
- Kebutuhan masuk Phase 1, tetapi belum diimplementasikan pada tahap setup dokumentasi ini.

## Permintaan lanjutan — multi-language dan preferensi mata uang

Pengguna menegaskan bahwa website sebelumnya sudah memiliki fitur multi-language dan pemilih mata uang. Fitur existing tersebut harus dipertahankan dalam redesign dengan kebutuhan berikut:

- Bahasa yang didukung adalah Bahasa Indonesia dan English.
- Harga dapat dilihat sebagai preferensi dalam IDR, USD, atau AUD.
- Harga USD/AUD bukan harga pasti dan hanya merupakan estimasi tampilan.
- Seluruh proses booking, tagihan, pembayaran, folio, invoice, dan refund tetap menggunakan rupiah/IDR.

Keputusan yang dicatat:

- Pilihan bahasa dan mata uang berlaku konsisten dari landing page sampai booking dan halaman status/instruksi pembayaran.
- Preferensi tidak boleh hilang saat berpindah halaman dan tidak boleh menghapus data form.
- CMS menyediakan konten customer-facing dalam kedua bahasa dengan fallback yang jelas.
- IDR adalah sumber kebenaran, mata uang kontraktual, dan mata uang ledger.
- USD/AUD diberi label `perkiraan/estimated`, tidak menjadi price lock, dan tidak disimpan sebagai nominal transaksi resmi.
- Total IDR tampil dominan pada review booking, instruksi pembayaran, invoice, serta komunikasi pembayaran.
- Jika kurs tidak tersedia atau kedaluwarsa, sistem kembali menampilkan IDR tanpa memblokir booking.
- Kebutuhan ini masuk Phase 1 dan belum diimplementasikan pada tahap dokumentasi.

## Keputusan review sistem — pemisahan status pembayaran

Pengguna menyetujui rekomendasi untuk memisahkan status saldo booking, status setiap payment record, dan status refund.

Keputusan final:

- Payment balance status dihitung otomatis dari folio: `No Payment Required`, `Unpaid`, `Partially Paid`, `Paid`, atau `Overpaid/Credit Balance`.
- Payment record memiliki lifecycle `Pending Verification`, `Verified`, `Rejected`, atau `Voided`.
- Refund record memiliki lifecycle `Requested`, `Approved`, `Rejected`, `Processing`, `Refunded`, `Failed`, atau `Cancelled`.
- Ringkasan partial/full refund dihitung dari refund yang berhasil dan tidak menjadi status satu record.
- Bukti transfer tidak mengurangi saldo sampai payment diverifikasi.
- Payment tidak dihapus; koreksi menggunakan reversal dengan histori dan alasan.
- Refund tidak menimpa histori payment asli.
- Reservation dan stay status tetap independen dari payment balance.

## Keputusan review sistem — status kamar dan stayover cleaning

Pengguna menyetujui pemisahan kondisi kamar dan menanyakan skenario ketika tamu masih menginap, sedang keluar, lalu meminta kamarnya dibersihkan.

Keputusan final:

- Kondisi unit dipisahkan menjadi occupancy, housekeeping condition, dan serviceability/block.
- Occupancy hanya `Vacant` atau `Occupied`; `Reserved`, `Due In`, dan `Due Out` berasal dari booking/assignment dan menjadi indikator turunan.
- Housekeeping condition: `Dirty`, `Cleaning`, `Cleaned`, atau `Inspected`.
- Serviceability: `In Service`, `Blocked`, atau `Out of Order`; block memiliki periode, jenis, alasan, pembuat/approver, dan audit.
- `Available to Sell` dan `Ready for Check-in` dihitung dari kombinasi inventory, assignment, occupancy, housekeeping, dan block.
- Tamu yang sedang keluar sementara tetap memiliki stay aktif dan occupancy kamar tetap `Occupied`.
- Permintaan tamu membuat task `Guest-Requested Stayover Cleaning`, bukan membuat kamar vacant atau tersedia dijual.
- Task menyimpan waktu, prioritas, notes, dan entry permission.
- Lifecycle task: `Requested`, `Assigned`, `In Progress`, `Cleaned`, `Inspected`, dengan exception `Deferred`, `Unable to Access`, atau `Cancelled`.
- Stayover cleaning tidak mengubah reservation status, stay status, atau inventory availability.

## Keputusan review sistem — state-transition matrix

Pengguna menyetujui pembuatan state-transition matrix sebelum pembahasan availability dan inventory locking.

Keputusan final:

- Dibuat dokumen [STATE-TRANSITIONS.md](STATE-TRANSITIONS.md) untuk Phase 1.
- Matrix mencakup reservation, stay, payment record, refund record, cleaning task, kondisi unit, dan registrasi check-in.
- Setiap transition menentukan actor, guard, side effect, exception/recovery path, permission, dan audit.
- Status tidak dapat diubah melalui generic status dropdown atau endpoint.
- Transition kritis harus transactional, idempotent, dan menggunakan concurrency/version check.
- Matrix menjadi sumber aturan backend, action UI, audit, dan acceptance test.

## Keputusan review sistem — availability, inventory locking, dan nomor kamar

Pengguna menyetujui rekomendasi availability/inventory serta menetapkan bahwa nomor kamar KOOKA sederhana dan berurutan. Permintaan awal menyebut “single digit”, lalu pada konfigurasi P0 diperjelas menjadi nomor sederhana seperti `1`–`15` karena estimasi properti sekitar 15 unit. Nomor kamar tidak membedakan jenis kamar; misalnya Kamar 1 dapat bertipe Deluxe dan Kamar 2 bertipe Executive.

Keputusan final:

- Dibuat [AVAILABILITY-INVENTORY.md](AVAILABILITY-INVENTORY.md) sebagai sumber aturan inventory Phase 1.
- Customer memesan room type dan quantity; nomor kamar dialokasikan kemudian.
- Booking unassigned tetap mengonsumsi inventory room type, sedangkan assignment tidak mengonsumsi ulang.
- Room unit memiliki internal ID stabil, `room_number` string, `sort_order`, dan `room_type_id` terpisah.
- Nomor kamar dapat berupa `1`, `2`, `3`, dan seterusnya serta tidak digunakan untuk menyimpulkan room type.
- Periode inventory menggunakan `[check-in, checkout)`.
- Checkout-session hold direkomendasikan 15 menit dan payment hold awal dua jam.
- Final booking melakukan availability recheck dan locking seluruh room type/malam secara transaksional.
- Create, amend, cancel, expire, serta inventory release bersifat idempotent.
- Amend menahan inventory baru sebelum melepas commitment lama.
- Whole house/package mengunci semua komponen secara atomik.
- Hard overbooking tidak diizinkan, termasuk bagi Super Admin; konflik eksternal/legacy masuk workflow `Needs Resolution`.

## Keputusan review sistem — pricing, room move, cancellation/refund, dan akses customer

Pengguna menyetujui pricing engine dengan penyesuaian bahwa admin menentukan sendiri perlakuan harga room move, sedangkan cancellation/refund mengikuti kebijakan tetapi nominalnya tetap diproses manual. Pengguna juga mengonfirmasi bahwa customer tidak memiliki login/account.

Keputusan final:

- Dibuat [PRICING-RATES.md](PRICING-RATES.md).
- Harga resmi IDR disimpan per booking line/malam dan booking memiliki immutable price/policy snapshot.
- Room move tidak otomatis reprice; admin memilih `No Price Change`, `Additional Charge`, atau `Price Reduction/Credit` dan memasukkan nominal manual.
- Room move adjustment menjadi folio item dengan reason, audit, approval limit, serta indikator guest informed/accepted untuk additional charge.
- Cancellation policy versioned dalam Bahasa Indonesia/English dan melekat pada booking.
- Cancellation fee serta refundable amount dimasukkan manual oleh admin; sistem hanya memberikan policy reference dan financial guard.
- Cancellation tidak otomatis membuat refund; refund tetap record dan transfer manual yang terpisah.
- Customer tidak memiliki akun/login.
- Customer lookup menggunakan booking code + email booking, generic errors, rate limiting, short-lived session, dan data exposure terbatas.
- Lookup tidak memberikan akses ke KTP/tanda tangan, bukti/notes internal pembayaran, rekening refund, internal notes, audit, atau data operasional sensitif.
- Perubahan/cancellation Phase 1 tetap melalui Front Office/WhatsApp.

## Keputusan review sistem — folio, invoice combined/split, dan tax

Pengguna menyetujui satu master folio untuk tracking seluruh transaksi. Invoice kamar dapat digabung dengan tagihan lain atau diterbitkan terpisah, tetapi combined dan split invoices harus menghasilkan nominal yang konsisten. Tax perlu fleksibel per room, F&B, tour, service, dan charge lain.

Keputusan final:

- Dibuat [FOLIO-FINANCIAL-LEDGER.md](FOLIO-FINANCIAL-LEDGER.md).
- Satu booking tetap memiliki satu master folio dengan immutable debit/credit entries.
- Invoice merupakan selection/allocation atas folio entries, bukan ledger baru.
- Invoice scope: combined, room-only, other-charges, dan custom berizin.
- Satu charge/tax entry hanya masuk satu active final invoice; combined tidak dapat aktif bersamaan dengan split coverage yang menduplikasi entry.
- Payment tetap satu folio entry dan dapat dialokasikan ke invoice tanpa membuat payment baru.
- Invoice document status dipisahkan dari settlement summary.
- Room/F&B/tour/service/package/fee/adjustment dapat menggunakan tax/service profile berbeda atau no-tax.
- Mode tax minimal no-tax, inclusive, exclusive, dan custom/manual berizin.
- Tax/service dihitung dan disnapshot ketika folio charge diposting; invoice tidak menghitung ulang.
- Combined dan split invoices mengambil entry yang sama sehingga total coverage harus konsisten.
- Posted folio/invoice tidak diedit; koreksi menggunakan reversal, adjustment, void/supersede, dan version baru.
- Checkout tidak otomatis menutup folio. Closure/reopen menggunakan guard, permission, reason, dan audit.

## Keputusan review sistem — same-day turnover dan konflik extension

Pengguna mengonfirmasi skenario customer hanya memesan tipe kamar tanpa mengetahui nomor kamar, termasuk kondisi ketika satu-satunya unit Deluxe ditempati sampai tanggal kedatangan booking berikutnya dan tamu in-house kemudian meminta extension.

Keputusan final:

- Checkout dan check-in pada tanggal yang sama tidak overlap, sehingga kamar tetap dapat dijual untuk malam setelah checkout.
- Availability untuk dijual dipisahkan dari readiness. Kamar baru dapat dipakai arrival berikutnya setelah checkout aktual dan cleaning/inspection selesai.
- Kedatangan setelah checkout pada hari yang sama membuat `Same-day Turnover` berprioritas tinggi.
- Extension merupakan permintaan inventory baru dan tidak otomatis mempertahankan kamar yang sedang ditempati.
- Booking confirmed yang sudah ada harus dilindungi; extension tidak boleh menggeser booking tersebut secara otomatis atau membuat hard overbooking.
- Resolusi admin: menolak extension, memindahkan tamu in-house, atau memindahkan/meng-upgrade booking mendatang ke inventory lain yang valid.
- Upgrade yang dilakukan KOOKA untuk penyelesaian operasional direkomendasikan sebagai `Complimentary Upgrade / No Price Change`. Guest-requested extension ke tipe lebih tinggi dapat dikenai tambahan harga atau diberikan waiver manual.
- Downgrade memerlukan persetujuan tamu dan price reduction/kompensasi yang tercatat.
- Sistem menyimpan booked room type, fulfilled room type, assignment aktual, price treatment, alasan, komunikasi/persetujuan tamu, dan audit.
- Perubahan commitment, assignment, stay dates, dan folio terkait harus atomik; kegagalan mempertahankan kondisi lama.

## Keputusan review sistem — daily close, guaranteed booking, dan late arrival

Pengguna menyetujui rekomendasi automatic daily rollover dan menegaskan bahwa booking online wajib membayar terlebih dahulu. Jika payment sudah terverifikasi tetapi tamu belum check-in dan terindikasi no-show, kamar harus tetap tersedia bagi customer apabila datang terlambat, termasuk pukul 00:00.

Keputusan final:

- Dibuat [STAY-OPERATIONS-DAILY-CLOSE.md](STAY-OPERATIONS-DAILY-CLOSE.md).
- Business date menggunakan Asia/Jakarta dengan rekomendasi rollover pukul 04:00 yang dapat dikonfigurasi.
- Daily close bersifat ringan, otomatis, idempotent, tidak memblokir Front Office, dan membawa exception yang belum selesai ke hari berikutnya.
- Booking online memenuhi payment policy sebelum reservation `Confirmed` memperoleh guarantee classification `Guaranteed`; keputusan P0 kemudian memperjelas bahwa online wajib full payment 100%, sedangkan bukti tepat waktu yang pending verification tetap menahan inventory sampai review selesai.
- Guarantee classification/basis dipisahkan dari reservation, stay, dan payment status.
- Guarantee berlaku untuk room type dan quantity, bukan nomor kamar tertentu.
- `Arrival Overdue/Possible No Show` adalah indikator dan tidak melepaskan inventory.
- No-show final memerlukan action manual dan contact attempt. Untuk guaranteed booking, inventory default `Retain Until Original Checkout`.
- `Mark No Show` dan `Release Remaining Nights` dipisahkan. Release guaranteed inventory membutuhkan permission tinggi, alasan, policy snapshot, konsekuensi finansial, dan audit.
- Tamu yang datang pukul 00:00 dapat check-in selama periode booking belum berakhir, commitment retained, assignment valid, dan unit ready.
- Late check-in tidak menggeser checkout, nightly price, atau tanggal stay secara otomatis.
- Jika commitment pernah dilepas, reinstate wajib melakukan availability check baru; sistem tidak boleh membuat overbooking.

## Keputusan review sistem — guest roles, flexible billing, capacity, dan extra bed

Pengguna menyetujui pemisahan Booker, Primary Guest, Room Lead Guest, Additional Guest, Payer, dan Invoice Recipient. Untuk group/multi-room, pengguna meminta tagihan fleksibel: dapat dijadikan satu atau dipisah. Pengguna juga menambahkan maximum guest per kamar serta extra bed yang hanya tersedia pada kamar tertentu.

Keputusan final:

- Dibuat [GUEST-OCCUPANCY-EXTRA-BED.md](GUEST-OCCUPANCY-EXTRA-BED.md).
- Setiap room stay memiliki Room Lead Guest dan dapat check-in/out secara independen; indikator partial dihitung dari stay instances.
- Satu master folio tetap menjadi sumber kebenaran.
- Invoice dapat combined, per room, per payer/guest, room-only, extras-only, atau custom selection tanpa duplicate charge/tax.
- Booker, payer, dan invoice recipient dapat berbeda.
- Room type menyimpan standard/max adult, child, total guest, extra-bed eligibility, maximum extra beds, dan capacity increment.
- Maximum physical occupancy tidak dapat dilewati.
- Extra guest dan extra bed disimpan terpisah.
- Extra bed dikategorikan `Accommodation Add-on`, bukan service/tour, karena terikat pada stay, room capacity, resource, harga per-night/per-stay, folio, dan housekeeping setup.
- Jika stok extra bed terbatas, room dan extra-bed inventory dikunci atomik.
- Extra-bed charge dapat digabung atau dipisah pada invoice serta memiliki tax/service profile sendiri.
- Room move/amend memvalidasi ulang capacity dan extra-bed allocation serta membuat setup/removal/relocation task.

## Keputusan review sistem — multi-room, group, package, dan Whole House

Pengguna menyetujui pembedaan multi-room, group booking, package, dan Whole House beserta rekomendasi inventory, pricing, amendment, dan billing.

Keputusan final:

- Dibuat [GROUP-PACKAGE-WHOLE-HOUSE.md](GROUP-PACKAGE-WHOLE-HOUSE.md).
- Multi-room create mengunci seluruh line secara atomik dan tidak membuat partial booking tanpa selection baru yang disetujui.
- Group proposal/quotation dipisahkan dari reservation; inquiry tidak menahan inventory, sedangkan active tentative hold memiliki deadline.
- Package memakai versioned fixed/optional components; fixed otomatis dikunci dan optional hanya setelah dipilih.
- Whole House merupakan composite exclusive-use product, bukan synthetic room type.
- Whole House mengunci seluruh mandatory room unit/resource/facility block secara atomik dan mencegah penjualan individual.
- Partial release Whole House hanya melalui conversion ke multi-room/group dengan inventory dan pricing snapshot baru.
- Harga package/Whole House dapat component-sum, bundled fixed, atau manual/contract berizin.
- Bundled price tetap memiliki component allocation IDR yang merekonsiliasi total untuk tax, invoice, report, cancellation/refund reference, dan audit.
- Satu master folio mendukung combined/split invoices tanpa duplicate charge/tax.
- Data foundation disiapkan Phase 1; proposal, builder, public/admin flow, dan conversion UI lengkap di Phase 2.

## Keputusan review sistem — POS, F&B, services, dan tours

Pengguna menyetujui rekomendasi pemisahan lifecycle POS/service, payment, folio posting, room-charge guard, cancellation, void/reversal, refund, serta resource scheduling.

Keputusan final:

- Dibuat [POS-SERVICES-TOURS.md](POS-SERVICES-TOURS.md).
- POS order/fulfillment status dipisahkan dari payment dan folio posting status.
- Settlement route dapat standalone, room charge, atau split bila diaktifkan.
- Room charge normal hanya untuk stay In House dengan active assignment, Room Lead Guest verification, charge privilege, billing destination, folio guard, dan confirmation step.
- High-value/company room charge dapat memerlukan Front Office/Owner approval.
- Route change setelah posting memakai reversal/repost; histori tidak diedit.
- Services/tours memiliki fulfillment lifecycle dan resource/provider scheduling terpisah.
- Package included component membuat/reference satu source order/booking dan tidak memposting retail charge ganda.
- Cancel fulfillment, financial void/reversal, refund, dan service-recovery credit merupakan action terpisah.
- Item/service tax snapshot konsisten untuk combined/split invoices.
- Phase 1 menyiapkan source reference, charge privilege, billing bucket, idempotent posting, tax, dan package linkage; fitur penuh di Phase 2.

## Keputusan review sistem — CMS, content, media, dan localization

Pengguna menyetujui rekomendasi pemisahan operational master dan editorial CMS, bilingual workflow, media authenticity/rights, policy versioning, trust provenance, preview/publish, archive, dan production readiness.

Keputusan final:

- Dibuat [CMS-CONTENT-MEDIA.md](CMS-CONTENT-MEDIA.md).
- Operational capacity, rate, availability, amenity, price, tax, schedule, dan rule tidak diduplikasi sebagai CMS copy.
- Content lifecycle: Draft, In Review, Scheduled, Published, Archived dengan revision history; restore membuat revision baru.
- Edit/review/publish/policy/trust/override/archive/purge menggunakan permission terpisah.
- Indonesia/English fields memiliki translation completeness dan fallback utuh.
- Media upload memakai staging, validation/security scan, sensitive metadata stripping, responsive variants, poster, processing status, dan reusable relations.
- Authentic/stock/pending classification serta source/rights/consent/license metadata disimpan.
- Room hero dan minimum final photo set wajib authentic sesuai production-readiness rule; stock/Unsplash hanya placeholder.
- Policy memiliki version/effective date dan booking snapshot; trust claim memerlukan provenance serta verification.
- Protected preview, transactional publish/schedule, cache invalidation, dan no half-published page menjadi requirement.
- Referenced content/media tidak hard-delete langsung dan memakai archive/reference resolution/audited purge.

## Keputusan review sistem — security, privacy, retention, dan audit access

Pengguna menyetujui rekomendasi data classification, individual accounts, MFA role sensitif, server-side RBAC, private file storage, customer lookup protection, audit access, retention/purge, backup, dan monitoring. Pengguna menegaskan SSO tidak diperlukan dan harus dihapus dari rencana.

Keputusan final:

- Dibuat [SECURITY-PRIVACY-RETENTION.md](SECURITY-PRIVACY-RETENTION.md).
- Data diklasifikasikan Public/Internal/Confidential/Highly Sensitive dan memiliki masking/permission/audit/retention rules.
- Staff shared account dilarang; akun individual dan MFA Owner/Front Office sensitif menjadi requirement.
- SSO/enterprise identity provider integration tidak masuk Phase 1, Phase 2, Phase 3, atau roadmap aktif.
- Permission View/Capture/Download/Export/Replace/Purge/Grant Access sensitive data dipisah dan server-side.
- Sensitive files menggunakan private encrypted storage, short-lived signed access, secure upload, safe object naming, dan exclusion dari logs/analytics/email biasa.
- Customer lookup menggunakan code+email dengan generic error, rate limiting, short session, masking, dan no sensitive exposure.
- Sensitive access/permission changes masuk append-only audit; suspicious access menghasilkan alert/review queue.
- Retention versioned per category; purge/anonymization memeriksa hold dan menjaga financial/inventory referential integrity.
- Backup encrypted/monitored, restore tested, dan sensitive deletion mengikuti backup-expiry strategy.

## Keputusan review sistem — customer return flow, payment deadline, dan notifikasi

Pengguna menanyakan bagaimana customer yang sudah booking tetapi belum membayar dapat kembali ke pemesanannya, bagaimana notifikasi bekerja tanpa login, dan apakah payment deadline sebaiknya satu jam. Pengguna kemudian menyetujui rekomendasi dan meminta melanjutkan ke poin berikutnya.

Keputusan final:

- Dibuat [NOTIFICATIONS-CUSTOMER-COMMUNICATION.md](NOTIFICATIONS-CUSTOMER-COMMUNICATION.md).
- Customer tetap tidak memiliki akun/login dan kembali menggunakan booking code + email booking dengan short-lived session.
- Halaman sukses menampilkan booking code, ringkasan, nominal/deposit IDR, rekening resmi, deadline/countdown, serta tombol WhatsApp.
- Sistem mengirim email `Selesaikan Pembayaran Booking` dengan link `Lihat & Bayar Booking`; code boleh terisi otomatis, tetapi email/session valid tetap diwajibkan.
- Website tidak memproses pembayaran; customer transfer di luar sistem lalu mengirim bukti/referensi melalui WhatsApp.
- Checkout-session hold default 15 menit. Public online payment deadline default 2 jam; 1 jam hanya untuk same-day booking atau policy khusus admin.
- Reminder pembayaran dijadwalkan 30 menit sebelum deadline.
- Deadline berlaku untuk transfer dan penyerahan bukti/referensi, bukan waktu review admin.
- Bukti tepat waktu membuat payment `Pending Verification` dan `Payment Review Hold`; inventory tidak dilepas sampai admin memutuskan.
- Tanpa bukti tepat waktu, booking `Expired` dan inventory dilepas. Booking expired memerlukan booking baru atau reopen oleh Front Office setelah availability recheck serta hold/deadline baru.
- Phase 1 memakai email, in-app alert, dan WhatsApp manual/deep link. WhatsApp manual hanya `Prepared/Opened/Handed Off`, bukan delivery claim.
- Notification foundation memakai business event, transactional outbox, retry/backoff, dedupe, bilingual versioned template/rendered snapshot, serta failure review queue.
- Scheduled notification dibatalkan/diganti setelah state/deadline berubah. Internal alert memakai `Open/Acknowledged/Resolved/Escalated`.
- Pesan tidak memuat data Highly Sensitive dan mengarahkan customer ke akses aman bila detail diperlukan.

## Keputusan review sistem — dashboard, Live Room Monitor, reporting, dan reconciliation

Pengguna menyetujui rekomendasi pemisahan dashboard operasional, laporan, metric, dan reconciliation. Pengguna menambahkan kebutuhan satu halaman yang menampilkan seluruh kamar beserta status dan nama tamu yang sedang menghuni sebagai pantauan live.

Keputusan final:

- Dibuat [REPORTING-DASHBOARD-RECONCILIATION.md](REPORTING-DASHBOARD-RECONCILIATION.md).
- Phase 1 memiliki `Live Room Monitor/Pantauan Kamar` berupa grid seluruh unit fisik tanpa pagination dan berurutan berdasarkan nomor/sort order.
- Setiap kartu menampilkan room number/type, occupancy, stay indicator, active Room Lead Guest, additional guest count, check-in/out, housekeeping, cleaning/exception, maintenance/block, next arrival, dan alert.
- Reservation, stay, occupancy, housekeeping, cleaning, serviceability, dan payment tidak digabung menjadi satu status/warna.
- Nama penghuni berasal dari active room/stay guest allocation, bukan otomatis booker. Booking unassigned tidak ditampilkan sebagai penghuni unit tertentu.
- Room move efektif memindahkan nama/status ke unit baru secara atomik dan mengubah unit lama menjadi vacant/dirty.
- Owner/Front Office dapat melihat nama sesuai permission. Cleaning melihat data minimum/nama masking; Shared Display Mode memasking nama, booking code, kontak, saldo, dan data sensitif.
- Monitor auto-refresh, menampilkan last-updated/connection/stale warning, filter/search berizin, serta quick action dengan business guard resmi.
- Actual Occupancy, Forecast Occupancy, dan Held Inventory dipisahkan. Complimentary occupied room masuk actual occupancy tetapi tidak masuk paid ADR.
- Valid maintenance block dikeluarkan dari sellable-room denominator, sementara physical capacity/exclusion tetap terlihat untuk audit.
- Room charge, ancillary, payment, refund, outstanding, tax/service, dan discount dilaporkan terpisah menggunakan date dimension eksplisit dan IDR.
- Reconciliation Phase 1 memeriksa inventory, assignment, stay/room, cleaning, folio, invoice, payment, refund, source posting, dan block; mismatch masuk exception queue tanpa silent auto-fix.
- Phase 2 menambahkan ADR/RevPAR dan revenue reports lebih lengkap; Phase 3 menambahkan cross-system/accounting reconciliation.

## Keputusan review sistem — master data dan configuration governance

Pengguna menyetujui rekomendasi single-property configuration, version/effective date, snapshot historis, approval berdasarkan risiko, impact checker, stable room identity, archive, dan secret boundary.

Keputusan final:

- Dibuat [MASTER-DATA-CONFIGURATION-GOVERNANCE.md](MASTER-DATA-CONFIGURATION-GOVERNANCE.md).
- Sistem memakai satu property root untuk KOOKA Residence; fitur multi-property tidak masuk scope aktif.
- Operational master menjadi source capacity/rate/tax/availability/payment/schedule/rule; CMS tetap editorial.
- Room/master memakai stable internal ID. Nomor kamar sederhana tetap unik sebagai display identifier dan tidak menentukan room type.
- Transaction-impacting configuration memiliki `Draft`, `Scheduled`, `Active`, dan `Retired` version dengan effective period; approval state dipisahkan.
- Existing booking, posting, document, dan notification mempertahankan version/snapshot; perubahan master tidak berlaku retroaktif.
- Hierarchy dibatasi pada property default → room type/product → rate plan/package/approved channel override dengan resolved-value/source/version view.
- Low-risk configuration dapat diaktifkan Admin berizin; rekening bank, tax/service, invoice identity/sequence, maximum capacity, permission, dan approval limit memerlukan Owner approval.
- Owner dapat self-approve high-risk dengan MFA/re-authentication, alasan, dan security event. Bank change selalu memicu alert dan tidak mengubah instruction lama tanpa explicit reissue.
- Impact checker memeriksa konflik booking, assignment, capacity, extra bed, block, rate/tax/policy, payment method, document sequence, dan recovery access sebelum activation.
- Conflict tidak mengubah/cancel booking otomatis. Referenced master diarchive/retired dan rollback membuat version baru.
- Activation transactional/idempotent; secret integration disimpan sebagai secure credential reference serta tidak muncul pada UI/export/diff/audit/log.
- Phase 1 menyediakan master/config UI, approval, impact preview, history/diff, archive/audit, resolved-value view, dan export; CSV bulk import masuk Phase 2.

## Keputusan review sistem — greenfield go-live, cutover, dan rollback

Pengguna menegaskan sistem baru tidak perlu memigrasikan data dari sistem lama dan harus langsung dimulai sebagai sistem baru. Rekomendasi migrasi kemudian dihapus dan diganti dengan greenfield launch readiness.

Keputusan final:

- Dibuat [GO-LIVE-CUTOVER-ROLLBACK.md](GO-LIVE-CUTOVER-ROLLBACK.md).
- Tidak ada legacy importer/migration untuk booking, customer, payment, invoice, WhatsApp, identity document, user, configuration, atau audit lama.
- Production hanya menerima initial master/configuration yang divalidasi Owner; UAT/staging memakai dummy data terpisah.
- Jika tidak ada commitment lama yang overlap go-live, production dimulai kosong.
- Reservation/stay lama yang masih mengonsumsi inventory dicatat manual sebagai `Opening Booking`; temporary Opening Inventory Block hanya fallback.
- Historical completed booking tidak dibuat ulang sebagai transaksi/ledger production.
- Admin dan public booking diaktifkan pada inventory source yang sama; booking CTA lama dinonaktifkan/redirect.
- Go/No-Go memeriksa inventory, rekening, core flow, RBAC, notification, backup/restore, monitoring, critical issue, serta approval Owner/Front Office/implementation lead.
- Setelah transaksi live, rollback tidak menggunakan blind database restore; prioritas disable flow, forward fix/data-compatible application rollback, serta reconciliation.
- Outage memakai Offline Operations Log dan recovery entry `Offline Recovery` dengan actual timestamp, actor, unique reference, idempotency, serta audit.
- Hypercare default 14 hari dengan daily operational/financial reconciliation dan exit checklist.

## Keputusan review sistem — maintenance, Out of Order, dan harga barang rusak

Pengguna menyetujui rekomendasi maintenance lifecycle, serviceability/block, return-to-service, guest damage separation, dan Lost & Found boundary. Pengguna menambahkan kebutuhan daftar harga barang yang dirusak customer agar dapat dimasukkan ke tagihan saat checkout.

Keputusan final:

- Dibuat [MAINTENANCE-ASSET-DAMAGE.md](MAINTENANCE-ASSET-DAMAGE.md).
- Maintenance Issue, work/internal cost, occupancy, housekeeping, serviceability/block, cleaning, Guest Damage Incident, damage assessment, folio charge, dan payment status dipisahkan.
- Maintenance lifecycle: `Reported → Triaged → Assigned → In Progress → Resolved → Verified → Closed`, lengkap dengan waiting/deferred/cancelled/reopen path.
- Severity tidak otomatis memblokir room; triage memilih Monitor Only, Restricted Use, Planned Block, atau Out of Order.
- Occupied room tetap Occupied saat issue dilaporkan; unsafe issue memicu room move workflow.
- Return to Service memerlukan verification, tidak ada blocking issue, safety/function check, cleaning/inspection bila relevan, dan audit.
- Guest Damage Incident tidak otomatis menetapkan customer responsibility atau membuat charge.
- Versioned Damage Charge Catalog menyimpan item/category bilingual, charge basis, harga reference/default integer IDR, tax profile/No Tax, evidence requirement, effective period, approval threshold, dan audit.
- Harga catalog hanya reference/default; Front Office/Owner tetap melakukan manual assessment berdasarkan evidence/policy. Internal repair cost disimpan terpisah.
- Approved assessment memposting tepat satu `Guest Damage Charge` debit ke master folio dengan quantity, unit price, catalog/tax snapshot, actor, dan approval reference.
- Damage charge dapat masuk combined atau other-charges/custom invoice tanpa double coverage dan dilaporkan terpisah dari room/POS/service revenue.
- Manual override, waiver, dispute, outstanding checkout, reversal, serta guest communication mempunyai reason/permission/audit; checkout tidak otomatis berarti accepted/paid.
- Booking deposit tetap berbeda dari security/damage deposit. Lost & Found memakai entity/lifecycle terpisah.

## Keputusan review sistem — Lost & Found, klaim, dan chain of custody

Pengguna menyetujui Point 18 mengenai Lost & Found sebagai modul operasional terpisah.

Keputusan final:

- Dibuat [LOST-FOUND-CUSTODY.md](LOST-FOUND-CUSTODY.md).
- Found Event/Item, Lost Inquiry, Ownership Claim, Custody Event, Storage Location, Return/Handover, Shipment, serta Disposition Approval dipisahkan dari maintenance, cleaning, Guest Damage Incident, dan folio.
- Item, claim, pickup, dan shipment memiliki lifecycle masing-masing; satu Found Item hanya dapat mempunyai satu verified owner aktif.
- Found Item menyimpan kode unik, waktu/lokasi/room/stay context, description/condition/photo minimum, storage/seal, high-value/sensitive flag, retention policy version, dan deadline.
- Cleaning dapat membuat Found Item dari cleaning task, tetapi temuan tidak mengubah occupancy/readiness atau menyelesaikan task secara otomatis.
- Setiap transfer barang membuat append-only Custody Event. Correction memakai event baru; unsecured item, unknown storage, custody gap, dan seal mismatch masuk exception.
- High-value claim tidak dapat diverifikasi hanya dengan booking code; gunakan contact match, secret attribute, waktu/lokasi, proof, dan review reason.
- Customer tidak memiliki portal Lost & Found pada fase awal; inquiry/claim ditangani Front Office melalui kanal komunikasi resmi.
- Pickup representative membutuhkan authorization. Signature serah-terima via tablet bersifat opsional dan terpisah dari check-in signature.
- Shipment menyimpan alamat sensitif, kurir/tracking/biaya/payer/evidence dan failure/return path. Closed stay folio tidak dibuka hanya untuk shipping charge; standalone invoice/receipt digunakan.
- Retention/disposition dikonfigurasi per kategori dan memeriksa active claim/hold, contact/approval, evidence, serta aturan lokal. Uang, identitas, kartu, obat, hazardous/perishable, dan high-value memiliki kontrol khusus.
- Workflow dasar masuk Phase 1; barcode/QR, matching/storage enhancement masuk Phase 2; courier integration hanya dipertimbangkan Phase 3 bila diperlukan.

## Keputusan review sistem — keluhan tamu dan service recovery ditunda

Pengguna menilai modul keluhan lengkap belum terlalu dibutuhkan dan menyetujui rekomendasi untuk menundanya.

Keputusan final:

- Phase 1 tidak membangun Guest Case/ticket management lengkap.
- Front Office dapat mencatat ringkasan keluhan, waktu/kanal, actor, keputusan, dan tindak lanjut sebagai operational note pada booking/stay.
- Keluhan diarahkan ke workflow sumber: Cleaning Task, Maintenance Issue, Room Move, folio adjustment/reversal, Refund Record, Lost & Found, atau incident procedure.
- Kompensasi tidak mengedit/menghapus posted charge; gunakan discount/folio credit/reversal resmi dengan reason, approval, source reference, dan audit.
- Refund tetap memakai Refund Record terpisah.
- Insiden keselamatan, keamanan, cedera, atau privasi tetap membutuhkan incident procedure sederhana dan controlled evidence.
- Guest Case lengkap—classification/severity, assignment, SLA/escalation, guest response, communication timeline, service-recovery decision, satisfaction, dan analytics—dipindahkan ke Phase 2.

## Keputusan review sistem — cash shift dan rekonsiliasi kas ditunda

Pengguna memilih menunda fitur serah-terima shift Front Office dan rekonsiliasi cash drawer.

Keputusan final:

- Phase 1 tidak membangun cash point/session, opening float, expected-versus-actual cash, actual count, variance approval, atau shift handover di dalam sistem.
- Setiap pembayaran tunai tetap menjadi Payment Record `Verified` dengan source booking/folio/order, nominal IDR, petugas penerima, waktu aktual, receipt/reference, dan audit.
- Transfer bank tidak diperlakukan sebagai kas fisik.
- Koreksi payment tunai tetap memakai void/reversal; payment tidak dapat dihapus.
- Serah-terima dan rekonsiliasi kas Phase 1 dijalankan melalui SOP operasional di luar sistem.
- Cash session lifecycle, opening float, variance, approval, handover checklist, serta cash-shift summary dipindahkan ke Phase 2. Keputusan ini kemudian dilengkapi: attendance shift assignment minimum masuk Phase 1B, sementara advanced workforce roster/optimization dan petty cash tetap dapat ditinjau terpisah.

## Keputusan review sistem — pengelolaan kunci kamar ditunda

Pengguna memilih menunda fitur pencatatan kunci dan akses kamar.

Keputusan final:

- Phase 1 tidak membangun key inventory, issue/return, key deposit, master-key custody, checkout exception, atau room-move key handover di dalam sistem.
- Kunci fisik ditangani melalui SOP operasional di luar sistem.
- Lost/damaged key dapat dicatat sebagai Guest Damage Incident dan memilih item Damage Charge Catalog, tetapi customer charge tetap memerlukan manual assessment/approval.
- Physical key tracking dipindahkan ke Phase 2.
- Smart lock, key-card encoder, temporary PIN, dan hardware access log dipertimbangkan Phase 3 setelah jenis hardware serta kebijakan keamanan ditetapkan.

## Keputusan review sistem — early check-in dan late checkout melalui Front Office

Pengguna menyetujui early check-in dan late checkout diproses langsung oleh Front Office. Jika kamar sudah dibutuhkan/ditunggu tamu berikutnya atau kondisi penuh, permintaan harus ditolak.

Keputusan final:

- Customer boleh menyampaikan ETA/request, tetapi bukan jaminan dan tidak ada self-service approval.
- Early check-in hanya disetujui jika reservation confirmed, unit assigned, previous stay telah checkout, serta unit `Ready for Check-in`.
- Late checkout ditolak ketika confirmed next guest menunggu/akan segera datang, cleaning/inspection window tidak cukup, properti/room type penuh tanpa alternatif valid, atau ada operational requirement.
- Confirmed next booking tidak digeser/dibatalkan otomatis.
- Late checkout intraday membuat operational occupancy block berbasis waktu dan memperbarui target housekeeping tanpa otomatis menambah room night.
- Late checkout melewati overnight threshold diproses sebagai extension dengan inventory check/locking.
- Early check-in/late checkout merupakan Accommodation Add-on dengan price/tax snapshot, folio posting, waiver/approval, dan audit.
- ETA malam tidak mengubah guaranteed late arrival, checkout, nightly breakdown, atau harga.
- Dibuat [EARLY-CHECKIN-LATE-CHECKOUT.md](EARLY-CHECKIN-LATE-CHECKOUT.md).

## Keputusan review sistem — tidak ada breakfast included

Pengguna menegaskan bahwa guesthouse tidak menyediakan breakfast. Semua makanan harus dipesan secara terpisah.

Keputusan final:

- Semua room rate dan booking adalah `Room Only` terhadap makanan.
- Website, room detail, rate plan, booking summary, invoice, serta komunikasi tidak boleh menyatakan breakfast/meal included.
- Seluruh F&B dibuat sebagai order terpisah dengan item, quantity, harga, tax/service profile atau No Tax, fulfillment, payment/folio posting, dan source reference.
- Package tidak membuat breakfast entitlement otomatis; jika diperlukan, package dapat memuat F&B credit atau specific paid menu/order secara eksplisit.
- Asumsi breakfast dihapus dari amenity, rate-plan recommendation, package example, dan pertanyaan terbuka PRD.

## Keputusan review sistem — pesanan makanan melalui formulir kertas

Pengguna menetapkan bahwa tamu memesan makanan dengan formulir kertas yang disediakan di kamar, menyerahkannya ke Front Office, lalu Front Office memasukkan order ke sistem secara manual. Order dapat standalone maupun room charge.

Keputusan final:

- Tidak ada customer self-order/cart/login pada scope awal.
- Form kertas menggunakan paper-form/intake reference unik; setelah input berhasil, form ditandai `Processed` dan mengikuti SOP retention/pemusnahan.
- Front Office membuat source order resmi dengan item, quantity, note, room/contact context, requested time, source, actor, dan input time.
- Standalone menghasilkan receipt/payment sendiri. Room charge memerlukan stay In House, active assignment, guest verification, charge privilege, payer/billing bucket, folio guard, dan confirmation.
- Nomor kamar pada kertas saja tidak cukup dan satu reference tidak boleh membuat dua active order.
- Harga/tax posting berasal dari active menu version. Printed-price mismatch memerlukan guest confirmation atau approved override dengan reason/audit.
- Basic manual paper-order entry masuk Phase 1; dedicated POS/F&B UI, shift, split settlement, dan richer workflow tetap Phase 2.

## Keputusan review sistem — flexible Departure Clearance

Pengguna menyetujui pemeriksaan checkout yang tidak kaku dan meminta proses dibuat fleksibel.

Keputusan final:

- Departure Clearance bersifat opsional per room stay dengan status `Not Started`, `In Progress`, `Cleared`, `Issue Found`, atau `Skipped`.
- Front Office dapat skip dengan permission, actor, waktu, dan alasan; target pemeriksaan tidak menjadi hard lock tanpa batas.
- Tamu tidak ditahan terlalu lama hanya karena checker belum tersedia.
- Temuan hanya membuat/reference Guest Damage Incident, Maintenance Issue, Lost & Found, Manual Paper Order, atau financial action; tidak otomatis menyatakan guest responsible atau membuat charge.
- Actual checkout setelah clearance/skip tetap membuat stay Checked Out, unit Vacant + Dirty, dan tepat satu turnover task.
- Multi-room clearance/checkout dilakukan per room stay.
- Dibuat [CHECKOUT-DEPARTURE-CLEARANCE.md](CHECKOUT-DEPARTURE-CLEARANCE.md).

## Keputusan review sistem — penitipan bagasi ditunda

Pengguna memilih menunda fitur penitipan bagasi sebelum check-in atau setelah checkout karena belum menjadi prioritas operasional saat ini.

Keputusan final:

- Modul penitipan bagasi dipindahkan ke Phase 2.
- Bila KOOKA menerima titipan pada Phase 1, proses menggunakan SOP, log, dan tag manual yang terkendali.
- Titipan tidak menahan checkout, tidak membuat folio tetap terbuka, dan tidak mengubah stay, occupancy, room readiness, atau cleaning.
- Accepted luggage bukan Lost & Found. Bagasi overdue/unclaimed baru dialihkan ke Lost & Found melalui pencatatan custody yang tetap mereferensikan catatan penitipan awal.
- Kebijakan penerimaan, batas waktu, barang terlarang/high-value, storage, dan verifikasi pickup wajib ditetapkan sebelum praktik manual dijalankan.

## Keputusan review sistem — Visitor Log ditunda

Pengguna memilih menunda fitur untuk pengunjung non-menginap.

Keputusan final:

- Visitor Log dipindahkan ke Phase 2.
- Jika visitor diperbolehkan pada Phase 1, jam/area/jumlah pengunjung dan proses masuk-keluar menggunakan kebijakan serta catatan manual Front Office.
- Visitor tidak mengubah inventory, occupancy, room stay, kapasitas menginap, atau folio secara otomatis.
- Visitor yang akhirnya menginap wajib ditambahkan sebagai Additional Guest melalui workflow resmi dan melewati capacity/extra guest/extra bed/identity guard.
- Data visitor dikumpulkan seminimal mungkin; KTP/foto identitas tidak menjadi default.
- Phase 2 dapat menambahkan host reference, lifecycle entry/exit, overdue alert, emergency headcount, dan badge termasking pada Live Room Monitor.

## Keputusan review sistem — parkir dan kendaraan ditunda

Pengguna memilih menunda fitur permintaan, status, dan kapasitas parkir.

Keputusan final:

- Parking/vehicle module dipindahkan ke Phase 2.
- Phase 1 hanya menampilkan fasilitas/kebijakan parkir yang terverifikasi dan menggunakan catatan/konfirmasi manual bila diperlukan.
- Booking kamar tidak otomatis menjamin tempat parkir; keterbatasan wajib dijelaskan sebagai subject to availability atau konfirmasi manual.
- Catatan kendaraan tidak mengubah inventory, stay, occupancy, atau folio. Nomor polisi tidak ditampilkan pada shared display.
- Biaya parkir, bila ada, dapat dimasukkan manual sebagai Accommodation Add-on dengan nominal IDR dan tax/No Tax snapshot.
- Phase 2 dapat menambahkan capacity/request/confirmation/waitlist/arrival/departure/overflow workflow; numbered slot, valet, EV, smart gate, dan ANPR bukan kebutuhan awal.

## Keputusan review sistem — special request dan preferensi tamu

Pengguna menyetujui rekomendasi Guest Request dasar pada Phase 1.

Keputusan final:

- Request dapat masuk dari booking publik atau dicatat Front Office dari WhatsApp/telepon/interaksi langsung.
- Pada keputusan awal, request memakai lifecycle `Requested/Under Review/Accepted/Unable to Fulfill/Fulfilled/Cancelled`; keputusan kategori terbaru mengganti label awal `Requested` menjadi `Submitted` tanpa mengubah makna lifecycle lainnya.
- Website menyatakan request belum dijamin sampai dikonfirmasi KOOKA; Accepted tidak sama dengan Fulfilled.
- Request tidak mengubah inventory, assignment, price, cleaning, order/service, payment, atau folio otomatis.
- Kebutuhan diteruskan ke workflow sumber seperti Cleaning Task, room allocation preference, F&B/order, service, maintenance, atau Accommodation Add-on.
- Request berbayar memerlukan konfirmasi harga/tax dan source charge/order resmi. Data aksesibilitas/alergi/kesehatan dibatasi pada minimum necessary.
- Dibuat [GUEST-REQUESTS-PREFERENCES.md](GUEST-REQUESTS-PREFERENCES.md).

## Keputusan review sistem — Do Not Disturb tetap manual

Pengguna menegaskan DND masih ditangani manual: tamu meminta/menggunakan tanda `Do Not Disturb` yang digantung pada pintu. Fitur digital ditunda.

Keputusan final:

- Phase 1 tidak memiliki status/entity/badge DND digital.
- Tanda fisik pada pintu menjadi instruksi privasi utama dan tidak boleh diabaikan Cleaning.
- Bila tanda ditemukan, Cleaning Task menjadi `Deferred` atau `Unable to Access` dengan reason `Physical DND Sign`, bukan `Cleaned/Inspected`.
- Catatan ini tidak mengubah stay, occupancy, readiness, inventory, atau folio.
- Front Office mengoordinasikan ulang izin/jadwal secara manual; request cleaning sebelumnya tidak mengesampingkan tanda fisik yang masih aktif.
- Emergency/welfare entry mengikuti SOP dan incident procedure. Digital DND dapat dipertimbangkan Phase 2 bila nanti diperlukan.

## Keputusan review sistem — kontak darurat ditunda

Pengguna memilih menunda fitur kontak darurat tamu.

Keputusan final:

- Phase 1 tidak memiliki field/status/workflow emergency contact khusus.
- Kontak booker dan guest yang sudah ada menjadi jalur komunikasi utama.
- Bila kontak alternatif benar-benar diperlukan, Front Office hanya mencatat data minimum sekali pada restricted booking/stay note.
- Data tidak disalin ke berbagai note/chat, shared display, invoice, atau laporan umum dan tidak digunakan untuk marketing.
- Tidak ada foto KTP emergency contact dan data tersebut bukan guard booking/check-in.
- Emergency contact tetap berbeda dari kebijakan minor/guardian, persetujuan medis/legal, dan incident procedure; fitur terstruktur dapat ditinjau di Phase 2.

## Keputusan review sistem — minor/guardian workflow ditunda

Pengguna memilih menunda fitur khusus anak di bawah umur dan wali.

Keputusan final:

- Phase 1 tidak membangun guardian assignment, room-to-guardian linkage, atau exception approval khusus.
- Adult/child/infant count serta standard/max adult, child, total guest, extra guest, dan extra-bed capacity guard tetap berlaku.
- Pada tahap diskusi ini, minimum usia Booker/Room Lead Guest, adult-per-room rule, dan family/group exception sempat diarahkan ke house rules/manual Front Office review; keputusan tersebut kemudian diperjelas dan digantikan oleh keputusan terbaru bahwa tidak ada age guard di sistem Phase 1.
- Exact birth date, KTP anak, kartu keluarga, dan akta kelahiran tidak diminta secara default.
- Manual exception memakai restricted operational note; emergency contact bukan guardian dan capacity limit tidak dioverride.
- Structured responsible-adult linkage, adjacent-room rule, approval/audit, dan guardian acknowledgement dapat dipertimbangkan Phase 2.

## Keputusan review sistem — security/damage deposit ditunda

Pengguna meminta langsung melanjutkan ke Point 34 sehingga Point 33 security/damage deposit dicatat sebagai ditunda.

Keputusan final:

- Phase 1 tidak membangun penerimaan, balance, allocation, automatic deduction, hold/dispute, atau refund security deposit.
- Booking deposit/down payment tetap payment credit terhadap tagihan booking dan tidak boleh dianggap sebagai jaminan kerusakan.
- Guest Damage Charge tetap melalui incident, assessment/approval, folio debit, payment, serta reversal/refund resmi.
- Dana jaminan tidak boleh disamarkan sebagai room payment atau generic charge.
- Security deposit terstruktur dapat dipertimbangkan Phase 2 setelah policy, nominal, metode, allocation, refund, dispute, dan reconciliation diputuskan.

## Keputusan review sistem — booking/stay amendment

Pengguna menyetujui Point 34 mengenai perpanjangan, pemendekan, early departure, dan perubahan tanggal.

Keputusan final:

- Amendment Phase 1 diproses Front Office dengan lifecycle `Draft/Pending Guest Confirmation/Applied/Rejected/Cancelled`.
- Date move, extension, shortening, early departure, serta partial multi-room amendment didukung.
- New inventory dikunci sebelum old commitment dilepas; apply atomic/idempotent dan failure mempertahankan kondisi lama.
- Confirmed booking tidak digeser oleh extension. Front Office memilih same-room extension, room move/type alternative, atau rejection.
- Unchanged nights mempertahankan snapshot; new nights memakai current/approved rate; removed nights memakai adjustment/credit dan refund manual sesuai policy.
- Early departure memisahkan actual checkout, room dirty/cleaning, inventory release, financial decision, serta Refund Record.
- Multi-room target eksplisit; before/after, delta, guest confirmation, actor/approver, document/notification, dan audit disimpan.
- Dibuat [BOOKING-STAY-AMENDMENTS.md](BOOKING-STAY-AMENDMENTS.md).

## Keputusan review sistem — Point 35 dan 36 ditunda

Pengguna meminta langsung melanjutkan dari Point 34 ke Point 37; Point 35 dan 36 ditunda.

- House-rules violation/security incident module ditunda ke Phase 2. Phase 1 memakai policy, SOP, restricted note, dan source action tanpa automatic responsibility/charge/eviction/stay mutation.
- Digital Front Office operational handover ditunda ke Phase 2. Phase 1 memakai SOP/catatan manual serta dashboard/entity sumber; handover bukan source of truth dan tidak menyalin data sensitif.

## Keputusan review sistem — Point 37 scope freeze

Pengguna menyetujui konsolidasi keseluruhan hasil pembahasan sebagai scope baseline sebelum pekerjaan implementasi dimulai.

Keputusan final:

- PRD ditetapkan sebagai **2.0 Baseline** per 1 Agustus 2026.
- Setiap kapabilitas diklasifikasikan sebagai Phase 1, Phase 2, Phase 3, manual/SOP sementara, out of scope, atau open configuration.
- Dibuat [SCOPE-DECISION-REGISTER.md](SCOPE-DECISION-REGISTER.md) sebagai sumber keputusan scope dan [PHASE-1-READINESS-CHECKLIST.md](PHASE-1-READINESS-CHECKLIST.md) sebagai gate kesiapan konfigurasi, UAT, serta go-live.
- Pertanyaan bernomor yang masih terbuka diperlakukan sebagai **Open Configuration Register**, bukan fitur baru dan tidak otomatis membuka kembali scope.
- Definition of Done Phase 1 diperbaiki agar tidak menjadikan POS lengkap, services/tours lengkap, CMS lengkap, atau laporan Phase 2 sebagai syarat peluncuran Phase 1.
- Fitur baru atau perubahan klasifikasi setelah baseline wajib dicatat sebagai change request dengan alasan, fase target, dampak inventory/financial/security/data, dependency, acceptance criteria, dan persetujuan Owner.
- Scope freeze tidak memberi otorisasi untuk membuat kode, schema database, memilih stack, memasang dependency, menyiapkan environment, atau melakukan deployment.
- Handoff berikutnya adalah melengkapi konfigurasi P0; architecture/backlog dan implementasi hanya dimulai atas instruksi Owner yang terpisah.

## Keputusan konfigurasi P0 — inventory kamar, kapasitas, dan extra bed

Pengguna memulai pembahasan konfigurasi P0 dan menyampaikan bahwa data kamar sebenarnya masih menunggu; jumlah keseluruhan diperkirakan sekitar 15 unit. Pengguna kemudian menyetujui rekomendasi model capacity dan extra bed sementara nilai aktual tetap terbuka.

Keputusan saat ini:

- Estimasi sekitar 15 kamar dicatat sebagai provisional, bukan inventory produksi dan bukan hard limit sistem.
- Nomor kamar tetap sederhana dan berurutan tanpa menyandikan room type. Karena estimasi melebihi sembilan unit, istilah “single digit” diperjelas menjadi nomor seperti `1`–`15`, disimpan sebagai string dengan internal ID stabil dan `sort_order`.
- Customer tetap memesan room type; unit fisik dialokasikan kemudian.
- Daftar final nomor, room type, capacity, amenity, extra-bed eligibility, serviceability, dan block awal wajib diverifikasi sebelum UAT inventory/go-live.
- Model standard/max adult-child-total, bed configuration, hard physical maximum, unit override berizin, extra-bed eligibility, maximum, serta capacity increment disetujui.
- Default kelompok usia awal adalah Infant `0–2`, Child `3–11`, dan Adult `12+`; seluruhnya tetap dihitung pada total occupancy dan nilai dapat dikonfigurasi/versioned.
- Extra bed tetap `Accommodation Add-on`, default charge `Per Night`, masuk folio, serta hanya meningkatkan capacity jika room type/unit mengizinkan.
- Nilai kapasitas aktual, aturan existing-bed versus required-extra-bed, jumlah fisik extra bed, dan mode tracked/non-tracked tetap menunggu data/policy operasional.

### Jam check-in dan checkout

- Pengguna menetapkan default check-in `14:00` dan checkout `12:00`, tetapi meminta keduanya tetap dapat dikonfigurasi.
- Jam disimpan sebagai konfigurasi properti versioned/effective-dated dalam Asia/Jakarta dan bukan nilai hardcoded.
- Website, booking, confirmation, operasional, dan housekeeping harus memakai resolved configuration yang sama.
- Scheduled time mengikuti policy snapshot booking, sedangkan actual check-in/out merupakan timestamp terpisah; perubahan konfigurasi tidak mengubah booking confirmed atau histori secara diam-diam.
- Pengguna kemudian memutuskan earliest early check-in dan latest late checkout juga configurable serta akan diisi sendiri nanti. Model field, permission, version/effective date, validation, dan audit dianggap disetujui; nilai produksi tetap open configuration sebelum UAT.
- Minimum turnover buffer dan overnight extension threshold tetap menjadi open configuration terpisah.

### Harga kamar dan nightly snapshot

- Pengguna meminta penjelasan snapshot dan apakah harga harus diisi setiap tanggal, lalu menyetujui rekomendasi model rate.
- Base rate per room type menjadi fallback agar Owner tidak perlu mengisi harga setiap hari.
- Override dapat memakai special date, seasonal/rentang tanggal, serta pola weekday/weekend. Promo/discount diterapkan setelah resolved rate bila eligibility/stacking mengizinkan.
- Prioritas default: special date → seasonal → weekday/weekend → base rate. Overlap/gap ditampilkan pada preview calendar.
- Bila tidak ada resolved rate, kamar/rate plan tidak dijual online dan sistem tidak pernah menganggap harga nol.
- Booking menyimpan immutable nightly price snapshot per stay date beserta source rule/version. Perubahan master tidak mengubah booking lama; amendment memakai aturan snapshot/current-approved yang sudah ditetapkan.
- Nominal IDR dan rate plan yang benar-benar diaktifkan tetap akan diisi Owner sebelum UAT; USD/AUD hanya estimasi tampilan.

### Tax dan service charge

- Pengguna menyetujui tax dan service charge sebagai konfigurasi terpisah dengan profile per room, extra guest/bed, F&B, service/tour, early/late add-on, damage, serta ancillary lain.
- Mode mendukung `No Tax`, inclusive, exclusive, service-only, kombinasi tax+service, dan custom/manual berizin.
- Initial safe configuration adalah `No Tax` sampai Owner/pihak perpajakan memvalidasi rate, base, order, rounding, effective date, dan label invoice. Keputusan ini bukan kesimpulan mengenai kewajiban pajak KOOKA.
- Tax/service disnapshot saat folio charge diposting; combined/split invoice mengambil entries yang sama dan tidak menghitung ulang akibat perubahan master.
- Profile produksi serta persentase sebenarnya tetap open configuration sebelum UAT.

### Pembayaran booking online dan deposit manual

- Pengguna memutuskan customer-created online booking wajib membayar penuh 100% sebelum confirmation.
- Deposit berdasarkan persentase atau nominal tetap hanya dapat dipilih staf berizin ketika membuat booking melalui admin; pay-at-check-in/checkout juga tetap berada pada jalur manual/channel berizin.
- Booking source dan payment requirement disnapshot serta tidak dapat diubah diam-diam untuk melewati full-payment guard.
- Verified partial payment pada online booking tetap payment/folio credit dan mengurangi outstanding, tetapi reservation belum `Confirmed` sampai total 100% terverifikasi.
- Jika deadline terlewati, inventory dilepas sesuai expiry guard tanpa menghapus payment credit; Front Office menangani rebooking/allocation atau refund manual dengan reason, permission, dan audit.
- Deadline publik tetap default 2 jam, same-day/policy khusus 1 jam, reminder 30 menit sebelum deadline, serta bukti tepat waktu masuk `Payment Review Hold`.
- Maximum review hold, role/default/limit deposit manual, dan jatuh tempo sisa tagihan manual tetap open configuration.

### Rekening dan payment instruction

- Pengguna menyetujui rekening bank sebagai master configuration, bukan teks bebas.
- Data minimum: bank, nomor rekening, nama pemilik, currency IDR, status/effective period, dan instruction text; beberapa rekening dapat aktif hanya dengan selection rule eksplisit.
- Booking menyimpan payment-instruction snapshot sehingga pergantian master tidak mengubah instruksi lama secara diam-diam.
- Perubahan rekening memerlukan Owner approval/self-approval dengan MFA/re-authentication, reason, impact preview, audit, serta security alert.
- Replacement instruction menggunakan `Reissue Payment Instruction` untuk booking terpilih atau approved batch, dengan preview, old/new snapshot, notification, dan audit. Reissue tidak mengubah amount atau payment status.
- Data rekening produksi, default selection, minimum notice, serta batch-reissue permission tetap akan diisi sebelum UAT/go-live.

### Kewenangan finansial Front Office

- Pengguna menolak kebutuhan Owner approval untuk harga, discount, dan tindakan finansial operasional lain; Front Office berizin harus dapat menjalankannya langsung selama seluruh perubahan tercatat.
- Cakupan direct action: custom price, discount, complimentary/waiver, room-move price treatment, amendment credit/adjustment, payment verification/void-reversal, refund, damage charge, serta invoice void/supersede.
- Tidak ada nominal/persentase approval limit atau status `Pending Owner Approval` yang menahan transaksi Front Office.
- Kontrol pengganti: field/action permission, mandatory reason, before/after value, actor/timestamp, source/policy reference, evidence/guest-informed field bila relevan, immutable posting/document history, reversal/supersede correction, serta append-only audit.
- Optional high-value alert/exception report hanya untuk monitoring dan tidak memblokir action.
- Owner tetap mengendalikan role/permission serta high-risk master configuration seperti rekening, tax/service, invoice identity/sequence, dan maximum capacity. Front Office tidak dapat menaikkan permission sendiri, menghapus audit, atau mengedit posted history.
- Refund di atas remaining verified-payment value tetap diblokir sebagai hard financial guard; tidak ada approval override untuk membuat refund melebihi dana yang tersedia.

### Pembayaran tambahan amendment

- Pengguna menyetujui rekomendasi payment treatment untuk date move/extension/amendment yang menambah harga.
- Pre-arrival amendment dengan delta debit tetap pada `Pending Guest Confirmation`; payment requirement/status tetap terpisah dan amendment baru diterapkan setelah tambahan pembayaran terverifikasi. Booking/inventory lama tetap aman selama amendment belum apply.
- New inventory memakai amendment hold berdeadline dan dilepas idempotent bila pembayaran gagal/expired tanpa merusak booking lama.
- In-house extension dapat langsung diterapkan Front Office setelah inventory aman; delta diposting sebagai outstanding folio dan tidak dianggap paid.
- Delta credit menggunakan adjustment/credit. Overpayment/early departure tidak membuat refund otomatis; Front Office membuat Refund Record manual bila diputuskan.
- Tidak ada Owner approval; before/after, inventory result, delta, actor, reason, confirmation/payment evidence, posting, dan audit tetap wajib.
- Nilai deadline amendment hold serta detail early-departure release/charge masih open configuration.

### Invoice dan dokumen customer

- Pengguna menyetujui document profile configurable untuk nama/legal display name, alamat, telepon, email, logo, NPWP bila digunakan/tervalidasi, footer/terms, language/layout, dan effective version.
- Jenis dokumen: proforma/payment instruction, invoice, receipt, refund note, serta folio statement.
- Invoice coverage tetap combined, room-only, other-charges, per-room/per-payer/extras, atau custom dari satu master folio tanpa duplicate entry/tax.
- Sequence terpisah per document type, atomic/unik/tidak mundur/tidak digunakan ulang; nomor voided/superseded tetap dipertahankan.
- Front Office berizin dapat issue, void, dan supersede dokumen tanpa Owner approval dengan reason serta audit; Owner mengendalikan legal identity dan sequence master.
- Dokumen memakai language snapshot `id/en`, IDR sebagai nilai resmi, rendered snapshot immutable, dan dapat dicetak/diunduh PDF atau dikirim email.
- Data identitas legal, NPWP bila digunakan, prefix/format sequence, template, tax label, dan sample PDF masih akan diisi/divalidasi sebelum UAT.

### Cancellation dan no-show policy

- Pengguna menyetujui cancellation policy bilingual, configurable, versioned/effective-dated, dan disnapshot pada booking; policy dapat dibedakan per online/manual source atau rate plan.
- Customer tidak melakukan self-cancellation melalui lookup. Front Office memproses request dari kanal resmi, menentukan fee/credit/refund manual tanpa Owner approval, dan menyimpan reason/audit.
- Cancellation melepaskan inventory melalui action resmi tetapi tidak otomatis membuat refund; Refund Record/transfer/evidence/refund note tetap terpisah.
- Online full-paid booking bersifat guaranteed. `Arrival Overdue/Possible No Show` hanya indikator, dan `Mark No Show` tidak melepaskan inventory; default tetap `Retain Until Original Checkout` agar tamu dapat datang terlambat.
- Front Office dengan permission khusus dapat menjalankan separate `Release Remaining Nights` tanpa Owner approval dengan contact attempt, reason, policy snapshot, affected nights/quantity, financial consequence, notification, dan audit.
- Cancellation window/fee/refund wording, arrival cutoff, contact-attempt minimum, release rule, serta notification template tetap akan diisi sebelum UAT.

### Minimum age Booker/Room Lead Guest — ditunda

- Pengguna memutuskan fitur minimum usia tidak perlu masuk ke sistem pada Phase 1 dan ditunda.
- Sistem tidak menyimpan atau memvalidasi minimum usia Booker maupun Room Lead Guest, tidak menerapkan adult-per-room guard, tidak membuat guardian linkage, dan tidak meminta bukti usia anak.
- Room Lead Guest tetap dipertahankan sebagai penanggung jawab operasional kamar, tetapi tanpa age verification atau age-based check-in block.
- Adult/Child/Infant count serta default kategori usia yang telah disepakati tetap dipakai hanya untuk perhitungan kapasitas kamar dan extra bed; kategori ini bukan verifikasi usia/legal responsibility.
- Jika KOOKA memiliki house rule usia, Front Office menanganinya manual di luar sistem. Workflow terstruktur baru dipertimbangkan kembali pada Phase 2 bila benar-benar diperlukan.

### Privasi foto KTP, foto tamu, dan tanda tangan check-in — disetujui

- Pengguna menyetujui rekomendasi privasi untuk fitur registrasi check-in opsional.
- Foto KTP/identitas, foto tamu, dan tanda tangan dapat dilewati secara independen tanpa override, check-in block, atau perubahan reservation/stay/payment status.
- Sebelum capture, sistem menampilkan purpose notice, status opsional, jenis data, dan informasi penyimpanan; hasil accepted/declined/skipped serta policy version dicatat.
- Hanya Owner/Super Admin dan Front Office dengan explicit permission yang dapat capture atau melihat data. Cleaning, F&B, customer lookup, shared display, invoice, serta notifikasi tidak memiliki akses.
- Permission view, capture/upload, download, export, replace, dan delete/purge dipisahkan; seluruh akses/perubahan sensitif diaudit tanpa menyalin content ke audit log.
- Retention dikonfigurasi per kategori dengan event awal, hold, purge/anonymization, dan backup expiry. Angka produksi, named permission, serta teks purpose/consent id/en tetap harus diisi sebelum go-live.
- Setelah purge, completion/consent status dan audit minimum dapat dipertahankan tanpa file, signature content, atau nomor identitas lengkap.

### House Rules terpusat — disetujui

- Pengguna menyetujui satu House Rules customer-facing dalam Bahasa Indonesia dan English, dengan version/effective date, review/publish workflow, serta snapshot pada booking.
- Online booking merekam checkbox acknowledgement beserta policy version, language, timestamp, dan channel. Checkbox tidak mewajibkan check-in signature.
- Front Office dapat memberikan policy melalui link, WhatsApp, email, atau print dan mencatat `Provided/Acknowledged/Declined`; check-in acknowledgement dapat dicatat tanpa tanda tangan digital.
- Struktur minimum mencakup check-in/out dan early/late, occupancy/extra guest/extra bed, smoking, noise, visitor, cleaning/DND/room entry, key, damage, parking, baggage, payment, cancellation/refund, serta no-show/late arrival.
- Informasi yang belum terverifikasi tidak dipublikasikan sebagai janji. Parking/baggage/manual facility hanya dapat dilabeli subject to availability/Front Office confirmation setelah proses operasional disetujui.
- House Rules tidak otomatis membuat charge/refund, menetapkan responsibility, membatalkan booking, mengusir tamu, atau mengubah stay/folio; action tetap melalui workflow sumber.
- Teks dan nilai produksi bilingual tetap harus diisi serta lolos publish gate sebelum booking publik diaktifkan.

### Guest Request Phase 1 — kategori dan routing disetujui

- Pengguna menyetujui kategori publik Cleaning Request, Extra Guest/Extra Bed, Early Check-in, Late Checkout, Room Preference, Accessibility/Special Need, dan Other Request.
- Status menggunakan `Submitted`, `Under Review`, `Accepted`, `Unable to Fulfill`, `Cancelled`, dan `Fulfilled`; `Accepted` bukan `Fulfilled`.
- Front Office menjadi reviewer utama. Response target configurable dan website tidak menjanjikan respons real-time.
- Cleaning Request menyimpan preferred time, guest-out indicator, serta explicit room-entry permission; tanda DND fisik tetap mengalahkan izin lama.
- Cleaning hanya menerima linked Cleaning Task dan informasi minimum setelah request diterima; Cleaning/F&B tidak dapat melihat note sensitif.
- Paid request baru diterima setelah scope/harga IDR/tax dimasukkan, customer confirmation dicatat, dan source add-on/action dibuat.
- F&B tetap memakai formulir kertas; tour/service, parking, dan baggage tidak menjadi kategori publik Phase 1.
- Label bilingual, target produksi, named permission, retention, template, dan bukti konfirmasi diselesaikan menjelang UAT, bukan blocker technical architecture.

## Keputusan lanjutan — arah landing page Versi 01

Pengguna memilih Versi 01 sebagai arah landing page yang disukai.

Keputusan/asisten:

- Versi 01 menjadi design direction terpilih untuk handoff desain berikutnya.
- Hero menggunakan foto courtyard KOOKA dari website yang ada; kamar, taman, menu, dan galeri memakai aset yang tersedia atau foto hospitality serupa untuk membantu visualisasi.
- Copy Versi 01 diadaptasi dari website KOOKA yang ada, termasuk narasi rumah taman, tipe kamar/harga awal, lokasi, dan kontak.
- Keputusan produk terbaru tetap mengalahkan isi website lama: tidak ada breakfast included, makanan terpisah, transaksi resmi IDR, dan nomor kamar dialokasikan Front Office.

## Keputusan lanjutan — mobile employee attendance

Pengguna menambahkan kebutuhan tampilan mobile absensi karyawan yang sederhana:

- absensi dengan selfie;
- lokasi pada titik yang telah ditentukan;
- shift dapat ditentukan; dan
- tersedia mode bebas tanpa shift.

Keputusan/rekomendasi yang disimpan:

- Kebutuhan disetujui sebagai `Phase 1B Employee Attendance MVP`, satu project tetapi bukan launch gate `Phase 1A Core Lodging MVP`.
- Rekomendasi awal menggunakan shared backend/routes, identity/RBAC, object storage, audit, dan database source of truth; tidak dibuat database mobile tandingan.
- Scheduled Shift memakai shift template/assignment; Free Mode tidak membutuhkan assignment tetapi tetap memakai geofence dan pasangan check-in/out.
- Selfie diambil saat check-in dan check-out, disimpan privat, tidak digunakan untuk facial recognition pada MVP, dan aksesnya memakai explicit permission/audit.
- Server time adalah waktu resmi dan geofence dihitung server-side. Continuous/background location tracking tidak dilakukan.
- Pada rekomendasi awal, correction tidak menghapus attendance event asli dan menggunakan request/review. Keputusan berikutnya menyederhanakan intake menjadi permintaan langsung kepada admin.
- Payroll, full HRIS, advanced workforce scheduling, face recognition, continuous tracking, dan attendance hardware integration tidak termasuk Attendance MVP.
- Detail tersimpan pada [MOBILE-ATTENDANCE.md](MOBILE-ATTENDANCE.md).
- Implementasi attendance belum dimulai; stack, lokasi/radius, shift window, permissions, dan retention masih open configuration.

### Koreksi arsitektur deployment attendance

Pengguna menegaskan bahwa API bukan aplikasi/service terpisah. Targetnya adalah cukup melakukan satu deployment aplikasi, termasuk fitur admin absensi.

Keputusan final:

- Landing/booking, admin operasional, admin attendance, dan employee attendance berada dalam satu modular web application, satu build, dan satu deployment.
- Employee memakai route mobile-first/PWA `/staff/attendance` melalui browser ponsel atau tablet; aplikasi native dan app-store binary tidak diperlukan untuk MVP.
- Admin attendance berada pada route `/admin/attendance` di aplikasi yang sama.
- Server route handler tetap tersedia untuk aksi UI, tetapi merupakan bagian internal dari codebase/runtime yang sama dan bukan API service/backend terpisah.
- Seluruh route memakai session/RBAC, domain service, database, private object storage, audit, configuration, dan observability yang sama.
- Keputusan ini menggantikan wording sebelumnya yang dapat dibaca sebagai mobile/API deployment terpisah.

### Penyederhanaan layar staff dan koreksi absensi

Pengguna menegaskan bahwa shift hari ini tidak perlu ditampilkan dan form permintaan koreksi tidak diperlukan.

Keputusan final:

- Route karyawan hanya menampilkan status absensi, tombol check-in/check-out, dan riwayat absensi sendiri.
- Shift template/assignment tetap dikelola admin dan digunakan sistem untuk perhitungan attendance, tetapi jadwal shift hari ini tidak ditampilkan kepada karyawan.
- Jika lupa checkout atau ada kesalahan, karyawan meminta koreksi langsung kepada admin melalui komunikasi operasional di luar sistem.
- Admin berizin melakukan koreksi langsung tanpa request/approval workflow di aplikasi.
- Event asli tetap append-only; koreksi wajib menyimpan actor, waktu, alasan, before/after, evidence bila diperlukan, dan audit.

## Keputusan yang dipertahankan

### Produk dan desain

- Redesign mengutamakan direct booking, kamar, autentisitas aset, dan pengalaman mobile ringkas.
- Services, tours, gym, dan F&B tidak dihilangkan; posisinya adalah supporting content/upsell.
- Data trust seperti testimoni, rating, lokasi, jarak, dan harga tidak boleh dibuat-buat dan harus diverifikasi.
- Kapabilitas existing Bahasa Indonesia/English serta tampilan IDR/USD/AUD dipertahankan dalam redesign.

### Pembayaran

- MVP tidak bergantung pada payment gateway.
- Customer mendapat kode booking dan instruksi pembayaran.
- Bukti dikirim melalui WhatsApp; verifikasi resmi dicatat admin di sistem.
- Pembayaran dapat penuh, deposit, tunai, saat check-in, saat checkout, atau kombinasi sesuai kebijakan/izin.
- Koreksi pembayaran menggunakan void/reversal, bukan penghapusan histori.
- Seluruh transaksi resmi tetap menggunakan IDR; USD/AUD hanya estimasi tampilan.

### Model operasional

- Inventory room type dan unit fisik dibedakan.
- Booking dapat unassigned sampai admin menentukan unit.
- Status reservation, stay, payment balance, payment record, room occupancy, housekeeping condition, serviceability/block, cleaning task, dan refund terpisah.
- Booking memiliki folio sebagai ledger room charge dan ancillary charge.
- Room move mempertahankan booking/folio, memeriksa konflik, memperbarui status kamar, memicu cleaning bila relevan, dan diaudit.
- Akses pengguna mengikuti RBAC dan least privilege.
- Registrasi check-in dapat memuat foto identitas/KTP, foto tamu, dan tanda tangan digital, tetapi ketiganya selalu opsional pada Phase 1 serta memiliki status kelengkapan sendiri.
- Sistem diluncurkan secara greenfield tanpa legacy migration; hanya commitment yang masih berlaku dicatat sebagai Opening Booking/block agar inventory aman.

### Delivery

- **Phase 1:** landing/CMS dasar, Bahasa Indonesia/English, tampilan IDR/USD/AUD, lodging booking, pembayaran manual dalam IDR, registrasi check-in opsional, admin/RBAC, room board/move, folio/dokumen/refund, cleaning, serta greenfield Go-Live/rollback/hypercare.
- **Phase 1B:** route mobile-first/PWA employee attendance dengan selfie/geofence, Scheduled Shift/Free Mode, status/riwayat pribadi, serta direct audited correction dan admin attendance dalam aplikasi/deployment utama; bukan lodging launch gate.
- **Phase 2:** group/package/whole house, POS, services/tours, CMS lengkap, laporan.
- **Phase 3:** WhatsApp API, payment gateway, OTA/channel manager, accounting/inventory integration.

## Keputusan setup oleh asisten

- `docs/PRD.md` dijadikan salinan lengkap sumber PRD, bukan ringkasan.
- README menjadi entry point singkat untuk tujuan, scope fase, status, struktur, dan tautan dokumen.
- `PROJECT-CONTEXT.md` menyimpan keputusan domain/operasional yang harus terus dibawa selama implementasi.
- `WEBSITE-AUDIT.md` memisahkan kekuatan, masalah, arah desain, struktur homepage, serta checklist konten.
- Implementasi aplikasi terpadu, pemilihan stack, schema database, dependency, dan deployment sengaja belum dimulai sesuai batas tugas.

## Sumber PRD

Sumber pada saat setup:

`/Users/temmykurniawan/Documents/Codex/2026-08-01/https-www-kookaresidencesby-com/outputs/PRD-KOOKA-Residence.md`

Salinan project: [PRD.md](PRD.md).

## Next handoff

Sebelum implementasi dimulai, tinjau pertanyaan terbuka pada PRD bersama Owner/Front Office, terutama inventory fisik, kebijakan pembayaran, tarif, role/field-action permission, mandatory reason/evidence, legal invoice, kebutuhan F&B/service, keamanan booking lookup, dan retensi data.

# Catatan 2 Agustus 2026 — Stack VPS dan PostgreSQL schema

- Pengguna mempertimbangkan VPS Hostinger KVM 2 dengan 2 vCPU, 8 GB RAM, 100 GB NVMe, dan 8 TB bandwidth untuk aplikasi KOOKA.
- Pengguna menginginkan Next.js, PostgreSQL, Redis, dan local storage pada satu VPS, kemudian menyetujui rekomendasi arsitekturnya.
- Keputusan: gunakan satu modular monolith dan satu deployment untuk landing/booking, customer lookup, admin, CMS, serta route mobile-first/PWA attendance; attendance tidak mempunyai backend/API deployment terpisah.
- Baseline stack dicatat sebagai Next.js 16 App Router, React 19, TypeScript, PostgreSQL 18, Drizzle ORM + `node-postgres`, Better Auth + custom RBAC, Redis/BullMQ, persistent local private storage, Docker Compose, dan reverse proxy.
- `Local storage` pada keputusan ini berarti private persistent VPS volume dan bukan browser `localStorage`. Database/file wajib dibackup ke lokasi kedua dan diuji restore.
- Pengguna meminta melanjutkan ke schema/database PostgreSQL.
- Assistant menyusun logical schema blueprint tanpa memulai migration atau application code. Model menggunakan satu PostgreSQL database, satu property root, UUID internal, IDR official, dan modular domain tables.
- Inventory menggunakan type-level nightly claim agar booking tetap mengurangi availability walaupun nomor kamar belum ditentukan. Physical assignment memakai assignment night unik untuk mencegah satu room unit dipakai dua booking pada malam yang sama.
- Reservation, stay, payment, refund, occupancy, housekeeping, serviceability, cleaning, registration, dan attendance tetap mempunyai lifecycle terpisah.
- Satu reservation memiliki satu master folio. Combined/split/room-only invoice memilih coverage dari folio entries yang sama dan tidak membuat ledger kedua.
- Customer tetap tidak memiliki account; customer lookup memakai booking code + matching email dan short-lived lookup session.
- Attendance memakai user/employee/RBAC/database/file/audit yang sama. Tidak ada employee correction-request table; admin correction mempertahankan event asli.
- Dokumen yang dibuat: [TECHNICAL-ARCHITECTURE.md](TECHNICAL-ARCHITECTURE.md) dan [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md).
- Pengguna menyetujui model room type/unit, inventory day/claim, PostgreSQL row locking, physical assignment-night uniqueness, serta contoh same-day turnover, extension conflict, dan guaranteed no-show retention.
- Pengguna meminta agar pembahasan database lainnya mengikuti rekomendasi Assistant yang paling cocok untuk project KOOKA.
- Keputusan: logical database blueprint menjadi approved baseline. Struktur reservation/guest/stay, folio/payment/refund/document, operations, CMS/F&B, attendance, file/audit/idempotency/outbox mengikuti rekomendasi pada blueprint. Nilai produksi yang belum diketahui tetap open configuration dan tidak diisi dengan asumsi.
- Pembuatan physical Drizzle schema, SQL migration, dependency, atau application code tetap belum dimulai dan menunggu instruksi implementasi terpisah.
- Pengguna kemudian meminta melanjutkan. Assistant membatasi pekerjaan pada physical database foundation dan tidak membangun landing/admin UI, API route, atau domain workflow.
- Mockup landing yang berada di `outputs/landing-page-mockup` terdeteksi masih memakai SQLite/Cloudflare D1 khusus preview; mockup tidak diubah agar preview tetap aman.
- Physical PostgreSQL/Drizzle definitions dibuat terpisah pada `src/db/schema`, bersama root `drizzle.config.ts`, generated initial SQL pada `drizzle`, hard constraints, dan migration plan.
- Schema mencakup Phase 1A/1B sesuai baseline, termasuk shared identity/RBAC, configuration versioning, room/inventory, reservation/stay, folio/payment/refund/document, operations, CMS/F&B/notification, attendance, file/audit/outbox, dan Lost & Found. Tabel Phase 2 spekulatif tetap tidak dibuat.
- Cross assignment-versus-block conflict diperkuat melalui common `room_unit_night_claims` dengan satu active claim per unit/malam.
- Drizzle Kit berhasil menghasilkan initial SQL untuk 128 tables dan `drizzle-kit check` lulus. SQL dasar dan hard constraints berhasil dijalankan pada PostgreSQL 18 disposable.
- Smoke test berhasil memverifikasi active-property uniqueness, room-type effective-period exclusion, physical room-night collision, one-open-attendance-session, dan immutable audit protection. Instance PostgreSQL test dihentikan setelah validasi; tidak ada production database yang disentuh.
- Pengguna meminta agar langkah implementasi disusun terlebih dahulu sehingga dapat dikerjakan satu per satu.
- Assistant membuat [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md) dengan 31 langkah bernomor `0–30`, dependency flow, status, tujuan, pekerjaan, Owner input, verification, dan exit gate.
- Langkah 0 Product Baseline serta Langkah 1 Architecture/Physical Database berstatus `DONE`. Langkah 2 Canonical Application Root menjadi satu-satunya langkah `NEXT`.
- Phase 1A dijalankan sampai Go-Live/Hypercare sebelum default sequence melanjutkan Phase 1B Attendance. Attendance boleh dimulai setelah shared foundation bila terdapat workstream terpisah, tetapi bukan lodging launch gate.
- Perintah Owner “lanjut” berikutnya secara default hanya mengotorisasi Roadmap Langkah 2; langkah berikutnya baru dimulai setelah exit gate dilaporkan lulus.

# Catatan 2 Agustus 2026 — Roadmap Langkah 2 selesai

- Owner meminta melanjutkan phase/langkah berikutnya; sesuai roadmap, pekerjaan dibatasi hanya pada Langkah 2 Canonical Application Root.
- Root project dibentuk menjadi canonical Next.js 16 App Router, React 19, dan strict TypeScript application dengan target standalone untuk deployment VPS.
- Struktur `app`, `src/modules`, `src/platform`, `src/db`, `src/jobs`, `src/storage`, dan `tests` dibuat. Database runtime, Docker, authentication, API bisnis, dan feature workflow tidak dimulai.
- Preview Versi 01 pada `outputs/landing-page-mockup` dipertahankan sebagai referensi terpisah; konfigurasi SQLite/Cloudflare D1 preview tidak dibawa ke production root dan nested worktree tetap bersih.
- Next.js diperbarui ke rilis stabil `16.2.12`. Override `postcss` `8.5.25` dan `sharp` `0.35.3` diterapkan karena dependency bawaan rilis stabil masih terdeteksi advisori; production audit kemudian melaporkan 0 vulnerability.
- Full audit masih melaporkan 4 advisori moderate dev-only melalui dependency transitive Drizzle Kit (`@esbuild-kit`/`esbuild`). Auto-fix ditolak karena menyarankan downgrade breaking ke Drizzle Kit lama; evaluasi compatibility dipindahkan ke Langkah 3.
- Verifikasi Langkah 2 lulus: strict type-check, foundation smoke test 2/2, optimized production build, standalone server/route smoke test, `drizzle-kit check`, dan production dependency audit.
- Langkah 2 berstatus `DONE`. Default perintah “lanjut” berikutnya hanya mengotorisasi Langkah 3 Dependency dan Quality Foundation.

# Catatan 2 Agustus 2026 — Roadmap Langkah 3 selesai

- Owner meminta melanjutkan langkah berikutnya; pekerjaan dibatasi pada Dependency dan Quality Foundation tanpa memulai local infrastructure atau fitur bisnis.
- Runtime dependency PostgreSQL, Better Auth, Redis/BullMQ, validation, structured logging, SMTP email, dan PDF dipilih serta dikunci exact bersama dependency tooling.
- Node/npm baseline, `.nvmrc`, `.npmrc`, package lock, ESLint zero-warning, Prettier, Vitest unit/integration structure, V8 coverage threshold 80%, dan command `npm run quality` ditambahkan.
- Testing strategy mencatat prioritas inventory concurrency, idempotency, authorization, financial ledger, private file, notification/job recovery, operational recovery, dan attendance.
- GitHub Actions quality workflow memakai clean `npm ci` dan quality command yang sama dengan local developer.
- ESLint 10 tidak digunakan karena plugin transitive Next.js masih mendukung sampai ESLint 9; baseline dikunci ke latest-compatible ESLint 9.
- BullMQ stale `cron-parser` dan advisory transitive Drizzle Kit/`@esbuild-kit` diselesaikan melalui patched overrides yang diuji, bukan melalui downgrade breaking.
- Clean `npm ci` lulus. Quality gate final lulus dengan 3 test files/4 tests, foundation coverage 100%, Drizzle schema check, Next.js production build, dan audit seluruh dependency 0 vulnerability.
- Preview landing Versi 01 tetap bersih/tidak berubah. PostgreSQL, Redis, local email catcher, private upload volume, database runtime, auth, dan API bisnis belum diaktifkan.
- Langkah 3 berstatus `DONE`; default perintah “lanjut” berikutnya hanya mengotorisasi Langkah 4 Local Infrastructure.

# Catatan 2 Agustus 2026 — Roadmap Langkah 4 selesai

- Owner meminta melanjutkan langkah berikutnya; pekerjaan dibatasi pada Local Infrastructure tanpa membuat database runtime aplikasi atau fitur bisnis.
- Docker Compose dibuat untuk PostgreSQL `18.4-alpine3.23`, Redis `8.8.1-alpine3.23`, Mailpit `v1.30.5`, dan Alpine `3.23.5` private-volume initializer.
- Root command `infra:up/down/status/health/config` ditambahkan. Saat pertama dijalankan, script menghasilkan password local acak dalam `.env.infrastructure` yang di-ignore dan bermode `0600`.
- Port PostgreSQL standar `5432` terdeteksi telah dipakai instalasi PostgreSQL lain milik laptop. Service tersebut tidak dihentikan; host port KOOKA dipindahkan ke `55432`, Redis `56379`, Mailpit SMTP `11025`, dan UI `18025`.
- Project bridge network dipakai karena Docker Desktop menghapus host binding efektif ketika service hanya berada pada `internal` network. Seluruh published port tetap eksplisit `127.0.0.1`, sehingga tidak terbuka ke LAN/internet.
- Environment validator serta template local/test/UAT/production dibuat. UAT/production menolak localhost dan Mailpit; private storage di bawah `public` ditolak.
- Startup dan health lulus untuk PostgreSQL, Redis, Mailpit, serta private volume. Persistence probe setelah restart lulus pada PostgreSQL, Redis AOF, Mailpit data, dan private file; marker database/Redis/private-file kemudian dibersihkan.
- Quality gate lulus dengan 5 test files/11 tests, coverage 100%, build berhasil, dan dependency audit bersih. Preview landing Versi 01 tetap tidak berubah.
- Local services dibiarkan berjalan agar dapat langsung dipakai Langkah 5. Belum ada application DB client, migration runner, production migration, auth, atau API bisnis.
- Langkah 4 berstatus `DONE`; default perintah “lanjut” berikutnya hanya mengotorisasi Langkah 5 Database Runtime dan Migration Workflow.

# Catatan 2 Agustus 2026 — Roadmap Langkah 5 selesai

- Owner meminta melanjutkan langkah berikutnya; pekerjaan dibatasi pada Database Runtime dan Migration Workflow tanpa memulai authentication atau fitur bisnis.
- Runtime memakai `node-postgres` pool konservatif dan Drizzle client dengan marker server-only. Inisialisasi lazy menjaga build tidak memerlukan database aktif.
- Generated schema dan hard PostgreSQL constraints direkonsiliasi menjadi dua executable migration batch. Runner mencatat SHA-256 checksum, execution time, dan applied time, memakai PostgreSQL advisory lock, serta transaction per migration.
- `.env.local` dapat dibuat otomatis dari ignored local infrastructure credentials tanpa menimpa file yang sudah ada.
- Reset memiliki guard ketat untuk APP_ENV test, explicit reset flag, dan nama database dengan segmen test. Local runner menolak production migration.
- Synthetic dev seed hanya membuat placeholder property dan empat role baseline secara idempoten. Tidak ada room number, room type, rate, rekening, guest, atau booking yang diisi dari asumsi; estimasi 15 kamar tetap open configuration.
- Disposable PostgreSQL verification lulus: empty migrate, second-run idempotency, hard-constraint smoke test, dan reset/recreate. Database disposable kemudian dihapus.
- Dua migration batch diterapkan pada database development lokal KOOKA; pengulangan migration dan seed sama-sama idempoten. Read-only database health query melaporkan schema/history siap.
- `GET /api/health` ditambahkan sebagai platform health route generik, bukan API bisnis, dan tidak membocorkan error koneksi.
- Production database tidak disentuh. Langkah 5 berstatus `DONE`; default perintah “lanjut” berikutnya hanya mengotorisasi Langkah 6 Staff Authentication.

# Catatan 2 Agustus 2026 — Perbaikan inkonsistensi dokumen baseline

- Owner meminta perbaikan inkonsistensi yang ditemukan pada pembacaan menyeluruh dokumen sebelum melanjutkan Langkah 6.
- Dependency flow pada [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md) Bagian 3 masih menulis Langkah 5 sebagai `NEXT` padahal tabel Bagian 2 dan detail Bagian 4 sudah `DONE`. Diagram diselaraskan: Langkah 5 `DONE`, Langkah 6 `NEXT`.
- PRD Bagian 3.1 menyebut “bukan 123 fitur baru” sedangkan Open Configuration Register Bagian 27 berisi 134 item. Angka diperbaiki menjadi 134.
- Struktur tree `docs/` pada README belum memuat DATABASE-RUNTIME, DEPENDENCY-QUALITY-BASELINE, LOCAL-INFRASTRUCTURE, dan TESTING-STRATEGY meskipun keempatnya sudah ada pada daftar Dokumen. Tree dilengkapi menjadi 34 file dan diurutkan alfabetis.
- Ditemukan perbedaan keputusan tipe nominal: physical schema memakai `numeric(18,2)` melalui helper `money()`, sedangkan PRD Bagian 6.9 dan PRICING-RATES Bagian 2 menulis “integer rupiah”.

Keputusan Owner:

- Storage tetap `numeric(18,2)` agar PostgreSQL memakai aritmetika desimal eksak dan tidak pernah floating point. Skema tidak diregenerate.
- Aturan whole-rupiah ditegakkan database melalui `CHECK`, bukan hanya pembulatan di application layer.
- Batch baru `0002_whole_rupiah_amounts` dibuat karena `0001` sudah memiliki checksum tercatat dan file applied tidak boleh diedit. Batch menambahkan 39 `CHECK` pada seluruh kolom nominal IDR resmi.
- `booking_quotes.display_total` sengaja dikecualikan karena menyimpan estimasi tampilan USD/AUD yang boleh berpecahan dan bukan nilai ledger IDR.
- Wording DATABASE-SCHEMA, PRD, PRICING-RATES, DATABASE-RUNTIME, dan MIGRATION-PLAN diselaraskan pada keputusan yang sama.
- Contract test migration diperluas untuk menjaga urutan batch, jumlah 39 guard, serta pengecualian `display_total`.
- Verifikasi yang lulus: prettier, ESLint zero-warning, strict type-check, manifest resolve, panjang identifier di bawah batas 63 karakter PostgreSQL tanpa tabrakan nama, dan seluruh tabel/kolom target cocok dengan generated SQL.
- Belum dijalankan pada sandbox karena tidak tersedia PostgreSQL dan `node_modules` terpasang untuk macOS: `npm run db:migrate`, `npm run db:test`, serta `npm run quality` penuh. Ketiganya dijalankan Owner pada environment lokal sebelum Langkah 6 dimulai.
- Scope Phase 1, klasifikasi fitur, dan roadmap tidak berubah. Perbaikan ini bukan change request.

# Catatan 2 Agustus 2026 — Roadmap Langkah 6 selesai

- Owner meminta melanjutkan langkah berikutnya; pekerjaan dibatasi pada Staff Authentication tanpa memulai RBAC/permission enforcement atau fitur bisnis.
- Auth-table contract direkonsiliasi terhadap Better Auth 1.6.25 dengan membaca source `better-auth`/`@better-auth/core` terpasang langsung (bukan asumsi dokumentasi umum): default field Session (`token`), Verification (`value`), dan Account (`accountId`) ternyata disimpan Better Auth apa adanya, bukan hash — dibuktikan lewat `internal-adapter.mjs`/`with-hooks.mjs` yang menunjukkan hook `before` tidak bisa menghash token tanpa merusak nilai yang dikembalikan ke pemanggil (cookie session).
- Keputusan: kolom `auth_sessions.token_hash`, `auth_verifications.value_hash`, dan `auth_accounts.provider_account_id` di-rename menjadi `token`, `value`, `account_id` (migration `0003_auth_contract_alignment`) agar nama kolom jujur terhadap apa yang benar-benar tersimpan. Proteksi mengandalkan cookie HttpOnly/Secure/SameSite, TLS, dan database privat — bukan at-rest hashing. `auth_accounts.password_hash` tidak diubah karena memang berisi hash asli (Better Auth menghash password sebelum menyentuh adapter). `auth_verifications` juga mendapat kolom `updated_at` karena Better Auth meng-update baris verification in-place, berbeda dari tabel audit append-only KOOKA lainnya.
- MFA foundation ditambahkan: `users.two_factor_enabled` dan tabel baru `two_factor_credentials` (migration `0004_two_factor_foundation`) untuk plugin `twoFactor` Better Auth. Ini hanya mekanisme; enrollment UI dan gate wajib per role (Owner/Super Admin, Front Office) tetap pekerjaan Langkah 7.
- `src/platform/auth.ts` memasang Better Auth server-only: Drizzle adapter dengan `modelName`/`fields` mapping ke tabel existing, email/password login (`minPasswordLength: 12`, generic error bawaan Better Auth), rate limit in-memory dengan rule lebih ketat untuk endpoint sign-in/sign-up/reset-password, `advanced.database.generateId: false` supaya Postgres `uuidv7()` tetap sumber id (bukan id non-UUID bawaan Better Auth yang akan melanggar tipe kolom `uuid`), serta hook `emailNormalized` dihitung server-side lewat `databaseHooks.user.create/update.before`.
- Login/logout/password-reset menulis baris `security_events` (`AUTH_SESSION_CREATED`, `AUTH_SESSION_REVOKED`, `AUTH_PASSWORD_RESET`) lewat `databaseHooks.session.create/delete.after` dan `emailAndPassword.onPasswordReset`. Penulisan best-effort di luar transaction Better Auth, dicatat sebagai keterbatasan.
- Sign-up publik dimatikan (`disableSignUp: true`) pada instance yang dipasang ke `app/api/auth/[...all]/route.ts`. Provisioning staff memakai instance server-only terpisah `getStaffProvisioningAuth()` (sign-up diaktifkan, tidak pernah dipasang ke route publik) sampai Langkah 7 menyediakan provisioning flow yang digerbang permission Owner; belum ada CLI/UI provisioning.
- `src/platform/session.ts` menyediakan `getCurrentSession`/`requireCurrentSession` untuk Server Component/route berikutnya, membaca cookie dari `headers()` sendiri (client tidak pernah dipercaya untuk identitas). Belum melakukan permission check apa pun — itu Langkah 7.
- `BETTER_AUTH_SECRET` ditambahkan ke `applicationEnvironmentSchema` (minimum 32 karakter) dan ke seluruh template environment (`local`, `test`, `uat`, `production`); `.env.local` diisi secret nyata hasil `openssl rand -base64 32`.
- Verifikasi yang lulus di sandbox: `npm run typecheck` (strict, terhadap type Better Auth 1.6.25 asli — sempat menemukan dan memperbaiki dua bug nyata: `additionalFields.type` perlu literal type, dan singleton module-level perlu inference lokal karena `ReturnType<typeof betterAuth>` generik menyebabkan mismatch), `npm run lint` zero-warning, dan `npx prettier --check`.
- Belum bisa dijalankan dari sandbox ini: `npm run test` (vitest gagal karena native binding rolldown hanya tersedia untuk macOS di `node_modules` yang termount), `npm run db:migrate`, `npm run db:test`, serta `npm run quality` penuh. Owner perlu menjalankan keempatnya di environment lokal.
- Belum diimplementasikan/dikompromikan secara sadar (dicatat, bukan disembunyikan): (1) idle timeout dan absolute expiry baru didekati lewat `expiresIn`/`updateAge` bawaan Better Auth (rolling expiry dari aktivitas terakhir), bukan ceiling yang benar-benar independen dari aktivitas; (2) CSRF/session-fixation/shared-device-logout baru diverifikasi lewat pembacaan source Better Auth dan type-check, belum lewat test end-to-end nyata terhadap Postgres; (3) nilai `expiresIn`/`updateAge`/`freshAge` (8 jam/15 menit) adalah pilihan sendiri karena dokumen SECURITY-PRIVACY-RETENTION tidak menetapkan angka; (4) `severity`/`result`/`category` pada `security_events` memakai kosakata sendiri karena belum ada taksonomi baku.
- Langkah 6 berstatus `DONE` dengan catatan verifikasi di atas; default perintah "lanjut" berikutnya hanya mengotorisasi Langkah 7 RBAC dan Employee Identity.

# Catatan 2 Agustus 2026 — Roadmap Langkah 7 selesai

- Owner meminta melanjutkan langkah berikutnya; pekerjaan dibatasi pada RBAC dan Employee Identity tanpa memulai shared platform services atau fitur bisnis.
- Skema `roles`/`permissions`/`user_roles`/`role_permissions`/`employee_profiles` sudah ada sejak Langkah 1, jadi Langkah 7 tidak menambah tabel baru. Yang ditambahkan adalah data katalog dan kode enforcement-nya.
- Katalog permission baseline (`database/migrations/after-drizzle/0005_rbac_baseline_catalog.sql`) dipindahkan dari pola dev-seed-only menjadi migration idempoten agar identik di semua environment. Katalog ini eksplisit ditulis sebagai scaffold, diturunkan kalimat demi kalimat dari deskripsi role yang sudah disetujui di `docs/SECURITY-PRIVACY-RETENTION.md` §3, bukan keputusan bisnis baru — final named permission matrix tetap Owner input yang belum diberikan (checklist Phase 1 §7 tetap unchecked). Permission sensitif (KTP, signature, payment evidence, selfie, export) dikatalogkan dengan flag `sensitive=true` tapi sengaja tidak digrant ke role manapun secara default, sesuai kalimat "akses KTP/signature hanya jika permission khusus diberikan".
- Owner baseline sengaja dibatasi ke permission governance saja (role/permission/employee/audit/security config), tidak dibundel dengan permission operasional Front Office — keputusan ini eksplisit di komentar migration, bukan Owner tidak bisa mengerjakan booking, hanya perlu digrant role `FRONT_OFFICE` tambahan lewat mekanisme grant yang sama.
- `src/platform/authorization.ts`: `getActivePermissionCodes`/`hasPermission`/`requirePermission` join `user_roles`(effective-dated, property-scoped) → `role_permissions` → `permissions`. Dua deny-all gate ditambahkan khusus untuk skenario test "inactive employee" yang diminta roadmap: akun `users.status` non-ACTIVE, dan `employee_profiles.employment_status` non-ACTIVE (menang bahkan bila role grant lupa direvoke). User tanpa employee profile sama sekali tidak ikut terblokir gate kedua karena `EmployeeProfile` memang optional per desain schema Langkah 1.
- `src/platform/rbac-admin.ts`: `grantUserRole`/`revokeUserRole` menolak actor menargetkan diri sendiri (`SelfRoleEditError`, dicek sebelum permission check) — ini guard privilege-escalation eksplisit yang diminta roadmap sebagai skenario "self-role-edit", bukan kelalaian. `docs/SECURITY-PRIVACY-RETENTION.md` §2 sebenarnya mengizinkan "Owner self-approval dengan MFA/re-authentication" untuk perubahan config berisiko tinggi, tapi mekanisme re-authentication itu belum ada (bergantung Langkah 8), jadi self-role-edit tetap hard-deny sampai mekanisme itu dibangun, bukan setengah-jadi. Revoke memakai `UPDATE user_roles SET effective_to = now()` (bukan reversal-row insert) karena `user_roles` terbukti tidak termasuk tabel yang dilindungi trigger append-only immutability di `0001_hard_constraints.sql` — dicek langsung ke migration tersebut sebelum memutuskan pola mana yang dipakai.
- Helper `recordSecurityEvent` yang sebelumnya private di `src/platform/auth.ts` (Langkah 6) diekstrak menjadi `src/platform/security-events.ts` supaya dipakai bersama oleh auth (login/logout/password-reset) dan RBAC admin (`RBAC_ROLE_GRANTED`/`RBAC_ROLE_REVOKED`), sesuai kalimat "Perubahan password, MFA, email/login identifier, role, atau permission menghasilkan security event/audit" di SECURITY-PRIVACY-RETENTION §2.
- `src/platform/property.ts` menambah `getActivePropertyId()` (melempar error eksplisit, bukan menebak, bila 0 atau >1 property berstatus ACTIVE) karena setiap `user_roles` grant wajib property-scoped.
- Dua route demonstrasi default-deny dibuat untuk memenuhi exit gate secara konkret (sebelumnya tidak ada satu pun protected business route selain auth/health): `GET /api/staff/me/permissions` (session-gated, mengembalikan permission milik caller sendiri — 401 tanpa session) dan `POST`/`DELETE /api/staff/role-grants` (permission-gated `identity.role.manage` — 401 tanpa session, 403 tanpa permission atau saat self-target, 200 pada actor yang diizinkan). Property id server selalu resolve sendiri lewat `getActivePropertyId()`, tidak pernah dari body request client.
- Verifikasi yang lulus di sandbox: `npm run typecheck` dan `npm run lint` zero-warning terhadap seluruh modul baru, termasuk lima file unit test baru (`authorization`, `rbac-admin`, `property`, dan dua route test) yang memakai mock chainable untuk query builder Drizzle.
- Belum bisa dijalankan dari sandbox ini: `npm run test`, `npm run db:migrate`, `npm run db:test`, `npm run quality` penuh — keterbatasan sama seperti Langkah 6 (native binary vitest/drizzle-kit hanya untuk macOS pada `node_modules` yang termount). Owner perlu menjalankan di environment lokal.
- Belum diimplementasikan/dikompromikan secara sadar: (1) tidak ada UI menu/navigation staff sama sekali — "menu navigation disusun dari permission" baru berlaku di level API sampai step domain yang punya halaman staff dibangun; (2) tidak ada test end-to-end nyata terhadap Postgres untuk skenario privilege-escalation/cross-role/self-role-edit/inactive-employee/direct-route — baru diverifikasi lewat unit test dengan database di-mock; (3) `db:seed:dev` masih meng-insert role secara terpisah (kini redundant tapi harmless karena idempoten) dan sengaja tidak dihapus untuk menghindari perubahan di luar scope Langkah 7 terhadap kode Langkah 5.
- Langkah 7 berstatus `DONE` dengan catatan verifikasi di atas; default perintah "lanjut" berikutnya hanya mengotorisasi Langkah 8 Shared Platform Services.

# Catatan 2 Agustus 2026 — Roadmap Langkah 8 selesai

- Owner meminta melanjutkan langkah berikutnya; pekerjaan dibatasi pada Shared Platform Services tanpa memulai fitur bisnis domain (property/configuration administration adalah Langkah 9).
- Seluruh tabel yang dibutuhkan (`stored_files`, `file_access_events`, `audit_events`, `idempotency_keys`, `outbox_events`, `job_executions`) sudah ada sejak migration fondasi Langkah 1 — dicek langsung ke `src/db/schema/system.ts` sebelum mulai menulis kode. Langkah 8 karena itu tidak menambah migration baru sama sekali, murni application-layer di `src/platform/`.
- `src/platform/clock.ts`: `getBusinessDate()` dihitung dari `Intl.DateTimeFormat` dengan `timeZone: "Asia/Jakarta"`, rollover default pukul 04:00 sesuai PRD §19.1, parameter rollover hour bisa di-override per pemanggilan tapi tidak di-hardcode — nilai final tetap konfigurasi Langkah 9 (property/configuration admin), bukan keputusan Langkah 8.
- `src/platform/redaction.ts` sengaja key-name denylist (substring match tanpa word-boundary, supaya `ktpNumber` tetap tertangkap), bukan value-shape scanner — dipakai bersama oleh `src/platform/logger.ts` (bukan Pino `redact` bawaan yang path-based dan tidak menjangkau nested object dinamis) dan `src/platform/audit.ts`.
- `src/platform/idempotency.ts`: klaim key memakai `INSERT ... ON CONFLICT DO NOTHING RETURNING` (atomik) alih-alih read-then-write, supaya dua request bersamaan dengan key sama tidak pernah sama-sama mengira mereka pemilik key tersebut. Key `FAILED` bisa direklaim untuk retry (memenuhi kalimat roadmap "failed job dapat diulang"); key dengan `requestHash` berbeda pada key yang sama menghasilkan `IdempotencyConflictError`, bukan silent overwrite.
- `src/platform/outbox.ts`: claim query pakai Drizzle `.for("update", {skipLocked:true})` (dicek dulu ke `node_modules/drizzle-orm/pg-core/query-builders/select.types.d.ts` bahwa API ini benar-benar ada) di dalam `getDatabase().transaction()`, supaya banyak worker/loop iteration bisa mengklaim baris outbox berbeda tanpa saling memblokir. Retry pakai exponential backoff (30 detik, dobel tiap attempt, maksimum 1 jam) dan pindah ke `DEAD_LETTER` setelah 8 percobaan. `job_executions` dipakai sebagai completion-guard: `wasOutboxEventAlreadyCompleted()` dicek sebelum handler topic dijalankan, supaya retry pada event yang sebenarnya sudah selesai tidak menjalankan efek samping (mis. kirim email) dua kali — ini konkretisasi kalimat roadmap "retry tidak menggandakan record" untuk lapisan outbox, terpisah dari idempotency service di atas.
- `src/platform/queue.ts` + `scripts/worker.mjs` + `scripts/lib/outbox-worker.mjs`: BullMQ hanya membawa sinyal "drain tick" repeatable (bukan payload bisnis) — outbox table di PostgreSQL tetap satu-satunya sumber resmi pekerjaan tertunda, sesuai batasan TECHNICAL-ARCHITECTURE §4 bahwa Redis harus aman hilang tanpa kehilangan transaksi bisnis yang sudah commit. `maxRetriesPerRequest: null` dipasang pada koneksi ioredis yang dipakai BullMQ, sesuai warning runtime BullMQ sendiri (dicek ke `node_modules/bullmq/dist/esm/classes/redis-connection.js`). Proses worker sengaja ditulis sebagai `scripts/worker.mjs` (plain Node, bukan TypeScript) mengikuti konvensi `scripts/db.mjs` yang sudah ada — proyek ini tidak punya TS runtime loader (tsx/ts-node) untuk proses berdiri sendiri di luar build Next.js, dan menambah dependency baru untuk itu dianggap keputusan yang lebih baik menunggu kebutuhan nyata. Konsekuensinya: `scripts/lib/outbox-worker.mjs` menduplikasi (raw SQL) semantik `src/platform/outbox.ts` secara manual — trade-off yang dicatat sadar, bukan kelalaian.
- `src/platform/file-storage.ts`: `saveStoredFile()` memvalidasi MIME allowlist (JPEG/PNG/PDF) + magic-byte signature + ukuran maksimum 15MB sebelum menulis; storage key selalu opaque (`propertyId/shard/randomUUID+extension`, tidak pernah dari nama file asli), sesuai larangan "object names tidak boleh berisi nama tamu/email/KTP/kode booking penuh" di TECHNICAL-ARCHITECTURE §5 dan SECURITY-PRIVACY-RETENTION §5. `readStoredFile()` menolak file yang `scanStatus` bukan `CLEAN` atau sudah purged. Satu keputusan disengaja yang berbeda dari pola best-effort audit di modul lain: bila penulisan `file_access_events` gagal, `readStoredFile()` **fail closed** (melempar `FileNotAccessibleError`, tidak mengembalikan bytes) — karena baca dokumen sensitif (mis. scan KTP) tanpa jejak audit dianggap risiko lebih besar daripada permintaan baca yang gagal. `runMalwareScan()` adalah hook eksplisit tanpa AV engine sungguhan; `noopMalwareScanner` tidak dipasang otomatis di manapun supaya gapnya tetap terlihat di code review, bukan default tersembunyi.
- `src/platform/email.ts`: adapter Nodemailer tipis di atas `SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM` (Mailpit di development dari Langkah 4, relay nyata di uat/production); komentar eksplisit bahwa pengiriman email fitur bisnis nyata (konfirmasi booking, reminder) seharusnya dipanggil dari dalam outbox job handler, bukan langsung dari request handler, supaya retryable.
- `src/platform/errors.ts`: kontrak `AppError`/`toErrorResponse` dengan 7 kode generik; unknown error selalu menjadi `INTERNAL_ERROR` dengan pesan generik di response (pesan asli hanya untuk log server), memenuhi "error contract" di TECHNICAL-ARCHITECTURE §7.
- `GET /api/health` diperluas dengan `src/platform/health.ts` (`checkRedisHealth`, `checkOutboxHealth`): database tetap kritis (503 bila gagal, short-circuit sebelum cek Redis/outbox), Redis/outbox backlog (pending event lebih tua dari 5 menit) hanya menghasilkan `status: "degraded"` (tetap 200) karena keduanya non-authoritative — proses masih bisa melayani pekerjaan booking-critical walau Redis mati.
- Verifikasi yang lulus di sandbox: `npm run typecheck`, `npm run lint` (zero-warning), dan `npm run format:check` untuk seluruh modul baru (`clock`, `redaction`, `logger`, `audit`, `idempotency`, `redis`, `outbox`, `queue`, `file-storage`, `email`, `errors`, `health`) plus perubahan `app/api/health/route.ts`, `scripts/worker.mjs`, `scripts/lib/outbox-worker.mjs`, dan `package.json` (`npm run worker`). Sebelas file test baru ditulis (`clock`, `redaction`, `errors`, `idempotency`, `audit`, `outbox`, `file-storage`, `email`, `queue`, `platform-health`, plus pembaruan `health-route`), semuanya lulus `tsc`/`eslint` dengan mock chainable ala Langkah 7, tapi belum pernah benar-benar dieksekusi Vitest.
- Belum bisa dijalankan dari sandbox ini: `npm run test`, `npm run db:migrate`, `npm run db:test`, `npm run quality` penuh — keterbatasan sama seperti Langkah 6/7 (native binary Vitest/`rolldown` hanya untuk macOS pada `node_modules` yang termount; dicoba langsung dan errornya dikonfirmasi "Cannot find native binding"). Owner perlu menjalankan `npm run quality` di mesin lokal, termasuk memverifikasi worker proses benar-benar berjalan terhadap Redis/PostgreSQL nyata (belum pernah dieksekusi live sama sekali di sandbox ini).
- Belum diimplementasikan/dikompromikan secara sadar: (1) `runMalwareScan` adalah hook tanpa AV engine sungguhan — integrasi ClamAV/sejenisnya menunggu kebutuhan nyata; (2) `scripts/lib/outbox-worker.mjs` menduplikasi logika SQL `src/platform/outbox.ts` secara manual karena keterbatasan toolchain (dijelaskan di atas) — risiko keduanya bisa tidak sinkron bila salah satu diubah tanpa mengubah yang lain; (3) `handlers` di `scripts/worker.mjs` masih kosong (`{}`) karena belum ada domain topic outbox nyata — akan diisi module domain terkait yang butuh email/PDF/reminder; (4) `MAX_FILE_BYTES` (15MB), MIME allowlist (JPEG/PNG/PDF saja), dan retry policy outbox (8 percobaan, backoff 30 detik–1 jam) adalah default konservatif penulis, bukan angka yang sudah disetujui Owner; (5) tidak ada HTTP route demonstrasi untuk file-storage (berbeda dari Langkah 7 yang punya route demo eksplisit) karena belum ada fitur bisnis nyata yang butuh upload/download — adapter baru benar-benar dipakai saat module domain terkait (mis. KTP tamu di Langkah 16) dibangun; (6) idle-worker `.on("failed", ...)` hanya menangani kegagalan tick BullMQ itu sendiri, bukan kegagalan `processNextOutboxEvent` di dalamnya (yang memang sudah punya penanganan sendiri lewat `failOutboxEvent`, jadi tidak seharusnya pernah melempar ke level ini, tapi belum pernah diverifikasi lewat integration test nyata).
- Langkah 8 berstatus `DONE` dengan catatan verifikasi di atas; default perintah "lanjut" berikutnya hanya mengotorisasi Langkah 9 Property dan Configuration Administration.

# Catatan 2 Agustus 2026 — Technical Batch 5 dijalankan

- Owner meminta melanjutkan Batch 5. Scope dipetakan ke Roadmap Langkah 20: public menu dan basic manual F&B paper-order entry; reporting Langkah 21 belum dimulai.
- Public landing sekarang dapat menampilkan menu bilingual yang bersumber dari active menu item/version, availability, dan tax/service configuration. IDR tetap currency resmi; USD/AUD hanya estimasi preferensi dari exchange-rate snapshot yang belum kedaluwarsa. Bila belum ada menu resmi, section tidak ditampilkan dan tidak ada placeholder.
- Menu administration route ditambahkan untuk kategori, draft item/version, activation, dan sold-out/availability. Tax profile version wajib milik property yang sama; perubahan master dan availability memiliki permission serta audit.
- Front Office dapat memasukkan nomor formulir kertas unik sebagai standalone atau room charge. Retry wajib `Idempotency-Key`; order item menyimpan menu version, active price, entered price, discount, tax/service, override reason, guest informed, dan actor snapshot.
- Room charge wajib melewati active in-house stay, active physical-room assignment, open folio, active billing bucket, exact room/Room Lead Guest verification, dan charge privilege `ALLOWED`. Satu item diposting sebagai satu immutable folio source debit.
- Pengguna kemudian menegaskan bahwa setiap tamu yang sudah check-in harus langsung dapat membebankan pesanan ke kamar. Keputusannya: check-in otomatis mengaktifkan charge privilege `ALLOWED`; pembayaran kamar yang sudah lunas tidak menutup folio, sehingga F&B maupun charge lain tetap dapat ditambahkan sampai stay selesai atau Front Office membatasi hak charge tersebut.
- Standalone payment disimpan terpisah dari fulfillment status, harus sama dengan order total, serta menghasilkan receipt snapshot. Cancellation menghentikan fulfillment dan membuat credit reversal terhadap posted folio debit; payment yang sudah diterima tidak dihapus dan tetap memerlukan refund manual terpisah.
- Migration `0011_fnb_paper_orders` menambah room charge privilege, billing bucket linkage, service/discount amount, standalone payment/receipt tables, status/lifecycle constraint, single active menu version, dan Front Office F&B grants.
- Focused test dan seluruh test suite lulus: 55 test files / 505 tests. Coverage global lulus threshold. Format, lint, strict type-check, schema check, dan production build juga lulus. Disposable PostgreSQL verification lulus sampai migration `0011` termasuk empty migrate, idempotency, hard constraints, concurrent outbox, dan reset/recreate.
- Langkah 20 berstatus `IMPLEMENTED — UNVERIFIED`. Data menu/tax/jam produksi, aturan nomor/tanda Processed/retensi kertas, final price-mismatch wording, serta UAT masih Owner input. Roadmap `NEXT` berpindah ke Langkah 21 Reporting dan Daily Operations.

# Catatan 2 Agustus 2026 — Technical Batch 6 / Langkah 21 dijalankan

- Owner meminta melanjutkan Langkah 21 Reporting dan Daily Operations.
- Implementasi menambahkan satu dashboard direct-source untuk arrival, departure, upcoming, unassigned room, payment review, cleaning, maintenance, dan refund. Summary memisahkan occupancy, posted revenue, verified payment, refund, dan open-folio outstanding dalam IDR.
- Automatic daily rollover berjalan melalui worker wake-up satu menit dengan configurable `BUSINESS_DATE_ROLLOVER_HOUR` default `04:00` Asia/Jakarta. Redis hanya pemicu; PostgreSQL advisory lock, unique business-day run, cleaning dedupe, reconciliation, summary, dan audit menjadi authoritative control. Endpoint staff menyediakan fallback manual idempoten.
- Rollover tidak memposting room charge/revenue, memperbaiki inventory/folio otomatis, atau melepas guaranteed late-arrival/no-show. Critical mismatch menghasilkan `NEEDS_ATTENTION`, bukan mengunci aplikasi.
- Reconciliation exception memakai stable fingerprint, severity/lifecycle terpisah, occurrence counter, assignment, acknowledgement/investigation, serta resolution/accepted-with-reason yang wajib reason. Masalah yang terdeteksi kembali dibuka ulang tanpa membuat source of truth kedua.
- CSV mendukung daily operations, booking, financial ledger, cleaning, dan reconciliation; permission dicek server-side, nama tamu dimasking, data sensitif tidak diekspor, formula injection dicegah, range/row dibatasi, response `no-store`, dan metadata/audit disimpan.
- Migration `0012_reporting_daily_operations` menambahkan exception/export tables, single business-day-run guard, constraints, indexes, dan permission `report.view`, `report.export`, `daily_operations.manage`, `reconciliation.manage` untuk Owner/Front Office.
- Focused test 36 skenario disusul full 59 test files/541 tests, global coverage threshold, format, zero-warning lint, strict type-check, schema check, production build, serta dependency audit 0 vulnerability semuanya lulus. Disposable PostgreSQL verification sampai migration `0012` juga lulus termasuk clean/idempotent automatic rollover dan nol unresolved critical exception pada synthetic data. Status Langkah 21 tetap `IMPLEMENTED — UNVERIFIED` sampai final permission/value produksi dan UAT Owner; roadmap `NEXT` berpindah ke Langkah 22 Phase 1A hardening.

# Catatan 2 Agustus 2026 — Hardening review Langkah 6–8

- Owner meminta pengecekan ulang Langkah 6–8, lalu mengotorisasi seluruh perbaikan yang direkomendasikan.
- Review menemukan lima risiko utama: outbox tetap `PENDING` setelah claim, idempotency domain/completion tidak satu transaction, mandatory audit masih best-effort, password recovery tidak mempunyai sender serta bootstrap Owner belum ada, dan worker production selalu bergantung `.env.local`.
- Outbox diperbaiki memakai state `PROCESSING`, lease owner 30 menit, stale-lease recovery, conditional completion/failure berdasarkan pemilik lease, serta transaction atomik untuk status terminal dan `job_executions`. Adapter raw worker diselaraskan dan disposable PostgreSQL concurrency test membuktikan dua worker hanya menghasilkan satu claim.
- Idempotency diperbaiki sehingga callback domain menerima transaction yang sama dengan claim/completion. Owner binding, expiry, stale `PROCESSING`, replay response, conflict hash, serta rollback dijaga dalam satu transaction.
- `recordAuditEvent` menjadi mandatory/fail-closed dan menerima transaction handle. Best-effort hanya tersedia melalui nama eksplisit `recordBestEffortAuditEvent`. Grant/revoke role, upload metadata, dan purge metadata menulis mutation serta audit secara atomik.
- Password recovery Better Auth sekarang memasukkan `auth.password-reset` ke outbox dengan token satu jam; worker mempunyai SMTP handler nyata. Email/address tidak dicatat plaintext pada structured log.
- `POST /api/setup/bootstrap-owner` ditambahkan sebagai route satu kali dengan bearer secret minimal 32 karakter, timing-safe comparison, advisory lock, active property bootstrap, staff account, employee profile, OWNER grant, dan mandatory audit. Secret wajib dihapus setelah bootstrap.
- Permission dari role `OWNER`/`FRONT_OFFICE` ditahan server-side sampai MFA aktif. Private-file read kini mewajibkan named permission dan memeriksanya di storage adapter sebelum membaca bytes.
- Worker menerima production environment langsung dan hanya memakai `.env.local` sebagai fallback development. Migration `0006_platform_safety_hardening` menambah outbox status/lease guard dan mencegah periode role grant overlap.
- Verifikasi final: formatting, ESLint zero-warning, strict typecheck, 180+ automated tests dengan coverage threshold, Drizzle schema check, Next.js production build, production/all dependency audit 0 vulnerability, disposable PostgreSQL migration/concurrency/reset test, serta local development migration `0000`–`0006` seluruhnya `applied`.
- Status Langkah 6, 7, dan 8 tetap `DONE` setelah hardening review. Nilai permission matrix produksi, AV engine nyata, serta browser/UAT scenario tetap mengikuti langkah konfigurasi/domain/UAT terkait dan bukan critical defect fondasi.

# Catatan 2 Agustus 2026 — Technical Batch 3 dijalankan

- Owner meminta langsung menjalankan Batch 3 (Roadmap Langkah 15–18) setelah Batch 2 dan focused test sebelumnya selesai.
- Room operations layer ditambahkan: Live Room Monitor, Shared Display masking, physical room-night assignment collision guard, room block/Out of Order, serta room move dengan price treatment `NO_CHANGE|CHARGE|CREDIT`, incidental no-charge, audit, dan automatic cleaning task kamar lama.
- Stay business actions ditambahkan untuk due-in/check-in/due-out/check-out/no-show. Check-in capture KTP/foto/signature tetap opsional dengan outcome capture/decline/skip/failure; identity number terenkripsi. Early/late decision berada di Front Office. Flexible Departure Clearance tidak memaksa folio lunas sebelum checkout. Guaranteed no-show mempertahankan kamar sampai action release eksplisit.
- Master folio API ditambahkan untuk immutable posting/reversal, tax components, combined/room-only/custom coverage yang memakai nilai entry sama, payment allocation, refund manual beserta attempt/proof, dan PDF/email worker melalui outbox/private local storage.
- Housekeeping/property operations ditambahkan: daily checkout/stayover task generation, room-move/deep/public/guest-request task, `GUEST_AWAY_REQUEST`, DND/deferred/unable-to-access, Cleaned→Inspected readiness, maintenance return-to-service guard, damage assessment→folio, dan Lost & Found item/claim/custody.
- Migration `0009_operational_workflows`, focused contract test, serta `docs/OPERATIONS-API.md` ditulis. Roadmap mengarahkan `NEXT` ke Langkah 19.
- Pemeriksaan lanjutan memperbaiki format dua service dan tipe JSON extra-bed snapshot. Formatting, zero-warning lint, strict type-check, 201 automated tests, schema check, production build, dan production/all dependency audit 0 vulnerability lulus. Full quality masih gagal karena coverage global 21,56% belum memenuhi threshold 80%; migration dan database concurrency test Batch 3 belum dijalankan. Langkah 15–18 tetap `IMPLEMENTED — UNVERIFIED`.
- Gap yang belum boleh dianggap selesai sebelum exit gate: amendment kompleks extension/date move/shortening/partial multi-room, financial document void/supersede, Lost & Found pickup/shipping/disposition action, automatic daily scheduler wiring, serta integration/concurrency verification.

## 2 Agustus 2026 — Eksekusi roadmap dipadatkan dan Technical Batch 1

User menanyakan mengapa roadmap sangat panjang dan apakah implementasi dapat langsung dikerjakan tanpa membahas setiap langkah. Disepakati bahwa roadmap tetap menjadi traceability checklist, tetapi pekerjaan teknis dipadatkan menjadi batch besar: Langkah 9–11, 12–14, 15–18, 19–21, attendance, kemudian final hardening/UAT/deployment.

User meminta build dan quality check ditunda serta akan menjalankannya sendiri. Disepakati agent tetap menulis guard, audit, security, migration, dan focused test yang relevan, tetapi tidak menjalankan full build/quality. Status harus membedakan `IMPLEMENTED — UNVERIFIED` dari `DONE`.

Atas perintah “laksanakan”, Technical Batch 1 (Langkah 9–11) dikerjakan:

- property profile dan versioned operational setting;
- lifecycle Draft/Scheduled/Active/Retired, approval terpisah, effective date, impact preview, resolved-value view, archive, advisory lock, dan audit;
- amenity bilingual, room type/version/capacity/extra-bed, room unit nomor string termasuk single digit, effective room type period, separate room state, dan shared resource pool;
- rate/tax/policy/payment instruction/document profile/sequence serta IDR→USD/AUD display snapshot;
- deterministic rate resolution special date → seasonal → weekday → base dan larangan implicit zero rate;
- AES-256-GCM untuk bank account/tax identity dan masked response;
- migration `0007_master_configuration_controls` dan named permissions;
- focused test version lifecycle serta encryption ditulis, tetapi tidak dijalankan.

Tidak ada data produksi kamar, tarif, pajak, rekening, atau policy yang dibuat. Migration `0007`, type-check, test, build, dan quality tetap pending untuk dijalankan Owner.

## 2 Agustus 2026 — Technical Batch 4 dijalankan

Owner meminta menjalankan Batch 4. Implementasi dibatasi pada Roadmap Langkah 19: CMS dan public landing Versi 01; F&B paper-order belum dimulai.

- Landing production Versi 01 dibuat responsive/mobile dengan booking search, sticky mobile CTA, ID/EN, preferensi IDR/USD/AUD, authentic KOOKA baseline images, serta canonical/hreflang/Open Graph metadata.
- Public landing membaca room type/capacity/extra bed/amenity dari operational master dan tidak menggandakan price/capacity/availability di CMS. Room tanpa authentic published media tidak ditampilkan.
- CMS mendukung revision bilingual, review, protected preview, publish, archive/restore, readiness gate, mandatory audit, dan transactional outbox. Approved baseline aman dipakai sebelum final CMS publication tanpa menampilkan klaim operasional yang belum diverifikasi.
- Media memakai private staging, rights source, alt text bilingual, scan gate, publish/archive, public delivery, dan link tervalidasi ke CMS section atau room type hero/gallery.
- Migration `0010_cms_public_landing`, route documentation, OG image, serta focused route/service/public-page test ditambahkan.
- Format, lint, strict type-check, schema check, dan production build lulus. Seluruh 53 test file/467 test lulus dengan coverage 87,73% statements, 80% branches, 92,26% functions, dan 91,08% lines; audit production/all dependency menemukan 0 vulnerability.
- Disposable PostgreSQL verification lulus sampai migration `0010`. Penerapan `0007`–`0010` ke database development utama, final bilingual content/media/facts, AV engine nyata, staff CMS visual UI, serta browser/accessibility/performance QA masih tertunda. Status Langkah 19 adalah `IMPLEMENTED — UNVERIFIED`; Langkah 20 menjadi `NEXT`.

## 2 Agustus 2026 — Langkah 22A Staff UI Foundation dijalankan

- Setelah membahas urutan Langkah 22, Owner mengotorisasi 22A terlebih dahulu. Roadmap diperjelas menjadi 22A Staff UI Foundation dan 22B Phase 1A Hardening agar UI operasional tidak tercampur dengan security/performance/UAT hardening.
- Login staf dibuat di `/staff/login` menggunakan Better Auth email/password dan challenge MFA/TOTP yang sama. Tidak ada signup/customer login/SSO; redirect hanya boleh menuju route `/staff`.
- Shell operasional responsive menampilkan menu sesuai named permission. Owner, Front Office, Cleaning, dan F&B tetap memakai satu login masing-masing dan melihat area kerjanya tanpa aplikasi atau API terpisah.
- Dashboard Harian membaca direct-source reporting dan menampilkan occupancy, arrival/departure, unassigned room, payment review, outstanding folio, serta operational/reconciliation attention. Refresh berlangsung berkala dan kegagalan refresh mempertahankan data terakhir dengan peringatan.
- Live Room Monitor menampilkan seluruh unit fisik beserta nomor kamar, occupancy, stay, housekeeping, serviceability, next arrival, dan filter status. Refresh berlangsung berkala.
- Review UI menemukan celah privacy pada room board: role dengan `room.board.view` secara teori dapat meminta non-shared response. Service diperbaiki sehingga role tanpa `stay.manage` selalu dipaksa memakai shared display; nama tamu dan kode booking dimasking di server.
- Workspace baca dasar Housekeeping dan F&B dibuat agar kedua role memiliki landing operasional dalam login yang sama. Action booking/payment/check-in/folio/housekeeping/F&B serta administration UI lengkap tetap menjadi pekerjaan lanjutan dan tidak diklaim selesai pada 22A.
- State loading/error/empty/access denied, responsive mobile/tablet, focus state, skip link, dan reduced-motion baseline tersedia. Browser/device/accessibility QA dan UAT staf nyata masih pending sehingga 22A berstatus `IMPLEMENTED — UNVERIFIED`.

## 2 Agustus 2026 — Langkah 22B Phase 1A Hardening dijalankan

- Owner meminta langsung melanjutkan 22B. Scope mencakup authorization/concurrency, sensitive upload/retention/audit, queue/email/PDF failure recovery, performance, accessibility/browser baseline, dependency review, dan backup/restore rehearsal.
- Seluruh `/api/staff/**` dikunci oleh session contract test dan mutasi browser mendapat same-origin guard terpusat. Security headers membatasi framing, MIME sniffing, referrer, opener, serta device permissions. Session/named permission/property/domain guard tetap authoritative.
- Upload JPEG/PNG/PDF tetap signature-checked dan maksimal 15 MB. Image terstruktur sekarang dibatasi sisi 12.000 px/40 juta pixel; PNG metadata eXIf/text/time dan JPEG APP1 EXIF/XMP dibuang sebelum hash/storage. File tetap tidak dapat dibaca sebelum scan `CLEAN`.
- Retention dry-run non-destructive ditambahkan: tidak mengarang durasi, fail-closed tanpa effective policy, dan memblokir hold/reference aktif. Redaction diperluas untuk authorization/cookie/private credential serta token/code pada URL.
- Review worker menemukan retry financial-document berhenti ketika PDF sudah rendered, sehingga email dapat terlewat setelah SMTP gagal. Retry sekarang membaca PDF yang sama dan mencoba delivery kembali. Semua email worker memakai stable Message-ID berdasarkan outbox event sebagai dedupe reference; exactly-once external SMTP tetap tidak dapat dijamin dan wajib dimonitor.
- Disposable PostgreSQL gate lulus untuk concurrent one-owner idempotency key, concurrent physical room-night collision, outbox lease/recovery, migration idempotency, hard constraints, daily rollover replay/reconciliation, dan reset/recreate.
- Local performance baseline 60 request per skenario/concurrency 6 menghasilkan 0% failure; health p95 387 ms dan public landing p95 73 ms, di bawah gate 750 ms.
- Database recovery rehearsal lokal berhasil membuat custom dump, restore ke database sementara, memvalidasi migration/user/reservation/audit tables, lalu membersihkan database/dump sementara. Private-storage restore belum dijalankan karena root backup target belum ditentukan.
- Browser-control automation tidak tersedia pada workspace ini. Browser/device/screen-reader matrix, AV engine nyata, full CSP nonce, private-storage restore evidence, dan Owner accepted-risk/UAT masih pending; 22B berstatus `IMPLEMENTED — UNVERIFIED` dan roadmap `NEXT` berpindah ke Langkah 23 UAT preparation/execution.
- Verifikasi final lulus: format, zero-warning lint, strict type-check, 66 test files/579 tests, global coverage 87,16% statements/80,49% branches/90,24% functions/90,21% lines, schema check, production build, serta production/all dependency audit 0 vulnerability. Tidak ada migration baru atau data production yang dibuat pada 22B.

## 2 Agustus 2026 — Login lokal dan enrollment MFA disiapkan

- Owner menanyakan apakah login sudah dapat diuji, lalu mengotorisasi penyiapan login lokal.
- Error halaman login akibat server component memanggil helper dari client module diperbaiki dengan memisahkan helper redirect aman ke module netral.
- Route `/staff/security` ditambahkan untuk enrollment MFA/TOTP menggunakan setup key manual, backup code, dan verifikasi kode enam digit. Menu ini selalu tersedia bagi staf yang sudah login.
- Permission Owner/Front Office tetap kosong sampai MFA terverifikasi. Halaman `/staff` menyediakan jalur menuju keamanan akun sehingga enrollment tidak mengalami deadlock.
- Bootstrap Owner sempat mengungkap kontrak Better Auth: field `emailNormalized` wajib untuk provisioning validator tetapi dilarang pada public auth. Konfigurasi dipisahkan sehingga hanya auth provisioning server-only yang menerima field tersebut, sementara public auth tetap menolaknya dan database hook tetap menghitung ulang nilainya.
- Migration development lokal `0009`–`0012` diterapkan; seluruh migration `0000`–`0012` kini applied pada database lokal.
- Satu akun Owner khusus pengujian lokal dibuat. Bootstrap token langsung dihapus kembali dari `.env.local`; kredensial tidak dicatat di repository.
- Login email/password, session cookie, akses `/staff/security`, serta kondisi permission kosong sebelum MFA diuji melalui server lokal dan berhasil. Enrollment MFA sengaja diselesaikan oleh Owner sendiri agar setup key dan backup code hanya diketahui pemilik akun.

## 2 Agustus 2026 — Runtime dashboard Server/Client boundary diperbaiki

- Owner melaporkan runtime error pada `/staff`: React menolak object dengan prototype `null` yang dikirim Server Component ke Client Component.
- Penyebabnya adalah `Object.groupBy()` pada queue dashboard reporting. Fungsi tersebut memang menghasilkan null-prototype object; JSON API dapat menanganinya, tetapi React Server Component tidak.
- Queue grouping diganti dengan reduce ke plain object tanpa mengubah isi/status data. Tes regresi memastikan prototype queue adalah `Object.prototype`.
- Focused test 37 skenario, zero-warning lint, dan strict type-check lulus. Verifikasi langsung memakai sesi Owner di Chrome menampilkan dashboard lengkap dan tidak menghasilkan console error.

## 2 Agustus 2026 — OWNER disejajarkan sebagai Super Admin

- Owner melaporkan bahwa akun Owner hanya menampilkan Hari Ini dan Keamanan akun tanpa menu operasional lain.
- Audit menemukan migration scaffold lama sengaja membatasi OWNER ke governance/reporting, sedangkan UI governance belum dibangun. Hal ini tidak lagi sesuai keputusan final bahwa OWNER adalah Super Admin.
- Owner mengotorisasi rekomendasi agar OWNER menerima seluruh named permission yang sudah terpasang tanpa perlu role Front Office kedua.
- Migration `0013_owner_super_admin_alignment` menambahkan seluruh permission terpasang ke mapping `role_permissions` OWNER secara idempoten, termasuk permission sensitif, tanpa bypass pada authorization code. MFA, property boundary, permission checks, dan audit tetap berlaku.
- Migration `0013` diterapkan ke database development lokal dan berstatus applied. Role lain tidak diubah.
- Verifikasi langsung melalui sesi Owner menampilkan menu Hari Ini, Pantauan Kamar, Housekeeping, F&B, dan Keamanan akun tanpa console error. Halaman konfigurasi/CMS/user-role/audit visual tetap menunggu batch UI berikutnya meskipun permission API-nya sudah dimiliki Owner.
- Verifikasi final lulus: 581 automated tests, format, zero-warning lint, strict type-check, schema check, production build, serta disposable PostgreSQL sampai migration `0013` termasuk empty migrate dan migration idempotency.

## 2 Agustus 2026 — Technical Batch 7 Admin & Operational UI dijalankan

- Owner meminta melanjutkan Batch 7 setelah permission OWNER disejajarkan sebagai Super Admin.
- Route `/staff/front-office` ditambahkan sebagai meja kerja booking manual multi-room, pembayaran, check-in/out/no-show, optional registrasi KTP/foto/tanda tangan, initial room assignment, maintenance block, room move dengan perlakuan harga, folio, dokumen keuangan, damage charge, dan refund manual.
- Upload check-in capture memakai private storage classification sensitive guest data. Camera/file picker dan signature canvas mendukung tablet; seluruh capture tetap opsional dan outcome Declined/Skipped/Failed dapat dicatat tanpa menghambat check-in.
- `/staff/housekeeping` sekarang dapat membuat daily task dan mengubah cleaning status; `GUEST_AWAY_REQUEST` dipertahankan untuk permintaan membersihkan kamar ketika tamu sedang pergi. `/staff/fnb` dapat memasukkan paper order standalone/room charge dari menu aktif serta memproses status order.
- Route `/staff/admin` menyediakan workspace permission-aware untuk property configuration, room unit/amenity, commercial/tax/display rate, CMS authentic media, menu, staff role, audit, daily rollover, reconciliation, dan CSV export. Tidak ada JSON editor atau kebutuhan mengakses database langsung.
- Route pendukung property-scoped ditambahkan untuk booking/payment queue, F&B in-house room lookup, team/audit overview, dan private check-in file upload. Permission tetap diperiksa server-side; mutation domain tetap memakai idempotency, audit, dan guard service yang sudah ada.
- Tidak ada data produksi kamar, harga, tax, rekening, atau identitas tamu yang diisi dan tidak ada migration baru.
- Verifikasi lulus: format, zero-warning lint, strict type-check, 67 test files/590 tests, coverage 86,59% statements/80,18% branches/89,19% functions/89,49% lines, production build, serta browser smoke test login/route protection tanpa console error.
- Authenticated transaction UAT per Owner/Front Office/Cleaning/F&B, tablet camera permission, signature canvas nyata, screen-reader, serta final device matrix tetap Langkah 23. Karena itu Langkah 22C berstatus `IMPLEMENTED — UNVERIFIED` dan Langkah 23 menjadi `NEXT`.

## 2 Agustus 2026 — Langkah 23 UAT foundation dijalankan

- Owner mengotorisasi Langkah 23 setelah Technical Batch 7. Dibuat database lokal khusus `kooka_phase1_uat_test`, runtime port 3100/build directory terpisah, private UAT storage, credential acak yang di-ignore, reset guard, dan credential rotation yang mencabut sesi lama.
- Dataset sintetis mencakup Owner, Front Office, Cleaning, F&B, kamar no. 1–6, Deluxe/Executive UAT, rate/tax UAT, booking belum bayar/due-in/in-house/due-out, payment review, folio, room assignment/state, tiga cleaning task termasuk permintaan saat tamu sedang pergi, serta dua menu F&B.
- Scenario pack, evidence sheet, dan defect register dibuat. Human UAT hanya boleh diberi PASS oleh pengguna role terkait; automated test tidak dianggap sign-off.
- `uat:prepare` dan `uat:verify` lulus seluruh pemeriksaan. Credential login dan landing permission empat role lulus. Owner/Front Office sengaja belum MFA agar enrollment dilakukan tester sendiri.
- Browser smoke login Cleaning sampai halaman Housekeeping lulus; tiga task dan `GUEST_AWAY_REQUEST` tampil tanpa console error. Status task tidak diubah karena mutation tersebut dicadangkan untuk human UAT.
- Dua masalah environment lokal ditemukan saat browser test: blocked dev origin menyebabkan form belum terhidrasi dan secure cookie pada HTTP local menyebabkan session hilang. Keduanya diperbaiki secara terbatas untuk local UAT dan lulus retest; UAT/production VPS tetap wajib HTTPS secure cookie.
- Langkah 23 berstatus `IMPLEMENTED — UNVERIFIED`; exit gate belum lulus sampai human UAT, MFA, device/tablet camera/signature, accessibility matrix, defect retest operasional, dan sign-off per role selesai. Langkah 24 tetap menunggu.

## 2 Agustus 2026 — MFA dibatalkan; login biasa menjadi keputusan final

- Owner mengoreksi requirement karena MFA dinilai berlebihan untuk skala operasional guesthouse. Seluruh staf memakai login email dan kata sandi biasa tanpa MFA/TOTP, termasuk Owner dan Front Office.
- Plugin `twoFactor`, challenge kode autentikator, halaman/menu enrollment `/staff/security`, serta permission gate berbasis `two_factor_enabled` dihapus dari runtime.
- Setelah login berhasil, permission langsung mengikuti role/property yang aktif. Kontrol yang tetap berlaku adalah akun individual, password hashing, rate limiting, session revoke, server-side RBAC, masking/private-file permission, dan audit/security event.
- High-risk master configuration tetap memakai Owner approval/self-approval, mandatory reason, impact preview, audit, dan security alert, tetapi tidak membutuhkan MFA.
- Fixture UAT, credential smoke, scenario pack, readiness status, PRD, security policy, project context, dan roadmap diselaraskan agar tidak lagi menunggu enrollment MFA.
- Migration `0004_two_factor_foundation` yang pernah diterapkan tidak ditulis ulang atau dihapus. Kolom `users.two_factor_enabled` dan tabel `two_factor_credentials` dipertahankan sebagai artefak kompatibilitas yang tidak digunakan runtime agar checksum dan riwayat migration tetap aman.

## 3 Agustus 2026 — Pesanan F&B multi-menu dan nomor formulir otomatis

- Owner mengoreksi bahwa satu formulir kertas harus dapat memuat banyak menu makanan, bukan hanya satu menu.
- Front Office sekarang dapat menambahkan beberapa menu ke keranjang pesanan yang sama, mengatur quantity dan catatan per menu, menghapus baris, melihat estimasi total, lalu menyimpan seluruhnya sebagai satu food order.
- Nomor formulir tidak lagi menjadi input manual. Sistem mengalokasikan nomor harian per property secara atomik dengan format `YYMMDDNN` memakai tanggal kalender Jakarta; contoh order pertama pada 3 Agustus 2026 adalah `26080301`.
- Order code mengikuti nomor formulir, misalnya `FNB-26080301`. Browser smoke menyimpan dua menu dalam satu room-charge order ke Kamar 2 dan menampilkan nomor/kode tersebut tanpa console error.

## 3 Agustus 2026 — Public booking mandiri dan konfirmasi transfer

- Owner menegaskan customer harus dapat booking sendiri sampai memperoleh instruksi pembayaran; WhatsApp tidak boleh menggantikan proses booking.
- Public availability diubah menjadi katalog visual dengan foto, kapasitas, jumlah tersedia, tarif online, dan CTA `Pilih kamar`.
- Checkout publik kini membuat quote/hold, meminta data pemesan serta policy acknowledgement, lalu membuat reservation online tanpa akun customer.
- Halaman sukses menampilkan booking code, total 100% IDR, deadline, rekening, dan langkah transfer. WhatsApp digunakan setelah booking terbentuk untuk mengirim kode serta bukti transfer kepada Front Office.
- Ditambahkan halaman customer lookup dengan booking code + email, tanpa customer login, untuk melihat stay, status, tagihan, rekening, dan tautan konfirmasi WhatsApp.
- UAT menambahkan payment instruction terenkripsi, deadline sintetis 60 menit, serta snapshot kurs USD/AUD. Alur berhasil diuji end-to-end sampai customer lookup; rekening UAT bukan data produksi.

## 3 Agustus 2026 — Status booking customer dibuat menonjol

- Owner menilai badge kecil `Terkonfirmasi` pada detail booking tidak cukup jelas dan meminta status menjadi informasi utama bagi customer.
- Customer lookup sekarang menampilkan panel status besar dengan keadaan visual berbeda untuk menunggu pembayaran, sedang diverifikasi, terkonfirmasi, dibatalkan, dan kedaluwarsa.
- Booking yang sudah dikonfirmasi dan pembayarannya terverifikasi menampilkan ucapan personal, informasi bahwa pembayaran sudah terverifikasi, serta pesan bahwa KOOKA menunggu kedatangan tamu pada tanggal check-in.
- Setelah pembayaran lunas, instruksi transfer tidak lagi ditampilkan. Bagian tersebut diganti informasi kedatangan, petunjuk menunjukkan kode booking ke Front Office, dan jalur WhatsApp bila tamu perlu menghubungi KOOKA.
- Penanda `Pembayaran terverifikasi` hanya tampil berdasarkan status pembayaran/guarantee yang valid, bukan sekadar status reservasi.

## 3 Agustus 2026 — Akses lookup dari landing page dan kode booking saja

- Owner melaporkan bahwa akses ke detail booking belum terlihat dari landing page.
- Tautan `Lihat booking` ditambahkan ke navigasi utama serta bagian Bantuan di footer, dalam bahasa Indonesia dan Inggris.
- Customer sekarang dapat membuka detail hanya dengan kode booking. Email menjadi verifikasi tambahan yang opsional; jika diisi, email tetap wajib cocok dengan data reservasi.
- Lookup memakai booking code acak berentropi tinggi, session singkat, generic error, audit/security event, dan pembatasan percobaan per alamat IP.
- Email saja tidak dijadikan kunci akses karena satu email dapat memiliki beberapa reservasi dan mudah diketahui pihak lain.

## 3 Agustus 2026 — Jenis kamar customer dan katalog kamar landing

- Owner meminta detail booking customer menampilkan jenis kamar, bukan nomor urut reservasi seperti `#1`.
- Customer lookup sekarang mengambil nama jenis kamar dari room type master yang aktif dan menggunakan kode room type sebagai fallback. Nomor kamar fisik tetap tidak ditampilkan sebelum dialokasikan Front Office.
- Landing page tidak lagi menyembunyikan jenis kamar yang belum memiliki media CMS. Seluruh room type publik tetap tampil dan memakai gambar editorial fallback sampai foto autentik diunggah.
- Semua CTA `Cek tanggal`, `Cek ketersediaan`, `Booking`, dan sticky mobile sekarang secara eksplisit menggulir ke form pencarian, mengubah URL ke `#availability`, serta memfokuskan datepicker check-in.

## 3 Agustus 2026 — Varian kapasitas room type dan layout operasi kamar

- Owner menegaskan bahwa pilihan kamar di landing page dan hasil availability harus berdasarkan room type serta maximum guest, bukan nomor kamar fisik.
- Display name room type boleh sama tetapi kapasitas berbeda, misalnya `Deluxe` maksimum 2 tamu dan `Deluxe` maksimum 3 tamu. Sistem memperlakukannya sebagai dua varian jual dengan stable ID dan internal code berbeda agar inventory, harga, kapasitas, dan assignment unit tidak tercampur.
- Public availability tetap menampilkan setiap varian sebagai kartu terpisah dengan maximum guest dan jumlah kamar tersedia. Customer tidak memilih atau melihat nomor kamar; Front Office mengalokasikan unit fisik kemudian.
- Layout kartu `Alokasi kamar pertama`, `Pindah kamar`, dan `Blokir kamar / maintenance` dirapikan menjadi susunan dua kolom bertingkat tanpa ruang kosong besar; pada layar sempit kembali menjadi satu kolom berurutan.

## 3 Agustus 2026 — Pengaturan titik absensi dan geofence

- Owner menyetujui seluruh rekomendasi pengaturan lokasi absensi dan meminta semuanya dilaksanakan.
- Titik absensi dikelola dari `Pengaturan → Absensi`, bukan melalui database atau file konfigurasi. Owner dan Front Office dapat melihat serta mengelolanya sesuai permission.
- Setiap titik menyimpan kode, nama, latitude, longitude, radius, batas maksimum akurasi GPS, status aktif/nonaktif, periode efektif, dan alasan perubahan. Koordinat dapat diisi dari lokasi perangkat saat ini serta dibuka di peta untuk pemeriksaan.
- Halaman mobile `/staff/attendance` mengirim koordinat dan akurasi aktual ke server. Server—bukan browser—menghitung jarak terhadap seluruh titik aktif dan menentukan apakah karyawan berada dalam jangkauan.
- Tombol absensi hanya siap bila perangkat berada dalam radius serta memenuhi batas akurasi. Kondisi di luar area, akurasi rendah, izin lokasi ditolak, dan belum ada titik aktif ditampilkan secara berbeda.
- Fondasi shift tetap tersedia untuk pengembangan berikutnya, tetapi alur operasional saat ini memakai mode bebas tanpa menampilkan shift hari ini atau form koreksi karyawan.

## 3 Agustus 2026 — Check-in/out attendance disimpan nyata

- Owner mencoba tombol absensi dan melaporkan bahwa hasilnya belum tersimpan. Hal tersebut benar karena tahap sebelumnya masih berupa layout interaktif dengan validasi geofence.
- Alur absensi kemudian disambungkan ke PostgreSQL: check-in membuat attendance session mode bebas dan event `CHECK_IN`; check-out membuat event `CHECK_OUT`, menutup session, dan menghitung durasi.
- Selfie dikirim bersama mutasi, divalidasi sebagai JPEG/PNG, disimpan pada private file storage sebagai data sensitif karyawan, lalu direferensikan oleh attendance event. File baru dibersihkan kembali bila transaksi absensi gagal atau request idempoten hanya memutar ulang hasil lama.
- Server memvalidasi ulang profil employee aktif, titik aktif/periode, radius, GPS accuracy, kepemilikan selfie, session hari berjalan, dan idempotency key. Client tidak dapat menentukan sendiri hasil geofence atau waktu resmi.
- Riwayat contoh dan laporan contoh dihapus. Menu `Riwayat saya` sekarang mengambil session milik akun login; menu `Laporan` mengambil data aktual seluruh karyawan berdasarkan Hari ini/7 hari/Bulan ini dan dapat diekspor ke CSV.
- Migration `0016_attendance_event_persistence` diterapkan ke database UAT tanpa reset atau penghapusan data.

## 3 Agustus 2026 — Laporan attendance memakai date range dan Excel

- Owner meminta filter laporan attendance memakai rentang tanggal, dengan tanggal awal dan akhir default pada hari berjalan.
- Preset `Hari ini`, `7 hari`, dan `Bulan ini` diganti dua datepicker konsisten untuk `Dari tanggal` serta `Sampai tanggal`, disertai tombol `Tampilkan` dan pencarian nama karyawan.
- API laporan menerima `startDate` dan `endDate`, mewajibkan keduanya diisi bersama, memvalidasi urutan tanggal, dan membatasi rentang maksimum 366 hari agar query tetap aman.
- Ekspor CSV diganti menjadi workbook Excel `.xlsx` asli. File memuat periode, tanggal, kode/nama karyawan, jam masuk/keluar, durasi, lokasi, dan status; selfie serta koordinat detail tetap tidak ikut diekspor.
- Tampilan desktop dan mobile, datepicker yang tidak terpotong, build produksi, lint, typecheck, dan seluruh test suite diverifikasi tanpa error.

## 3 Agustus 2026 — Logo resmi diseragamkan di seluruh aplikasi

- Owner meminta seluruh logo KOOKA, termasuk landing page, menggunakan logo yang telah dipakai pada invoice.
- Aset tunggal `public/images/kooka-logo-official.png` sekarang menjadi sumber logo untuk header dan footer landing, halaman hasil/sukses/lookup booking, login staf, sidebar operasional, PWA, serta dokumen invoice kamar/combined/F&B.
- Monogram teks `K` dan wordmark buatan di antarmuka dihapus. Setelah evaluasi visual, bidang krem pada header/footer/sidebar juga dihapus karena tampak seperti stiker. Aset transparan yang sama kini dirender sebagai wordmark ivory pada latar hijau gelap, sedangkan warna asli tetap dipakai pada invoice, login, dan permukaan terang.

## 3 Agustus 2026 — Lifecycle kamera attendance diperbaiki

- Owner menemukan pratinjau kamera menjadi gelap setelah berpindah tab, sementara status masih menyatakan kamera siap. Penyebabnya adalah elemen video baru tidak lagi terhubung ke stream lama yang tetap tersimpan.
- Kamera kini aktif otomatis ketika langkah `Absen` pertama kali dibuka dan berhenti ketika pindah ke `Riwayat`/`Laporan`, selfie selesai, halaman masuk background, atau track kamera berakhir.
- Setelah kembali dari background, kamera tidak menyala diam-diam dan pengguna menekan `Aktifkan kamera`. Kontrol `Matikan kamera` dan `Ambil ulang` juga tersedia.
- Status `Kamera siap` hanya muncul bila video memiliki dimensi valid dan track live. Saat dijeda, UI menampilkan `Kamera dijeda` tanpa panduan wajah palsu.

## 3 Agustus 2026 — Pagination tabel yang terus bertambah

**Pengguna:** Menanyakan bagaimana menangani data tabel yang makin lama makin banyak pada laporan attendance, pesanan F&B, dan daftar booking, lalu menyetujui penerapan rekomendasi.

**Keputusan/asisten:** Menerapkan pagination server-side dengan ukuran halaman berbeda sesuai kepadatan data. Booking/pembayaran memakai 20 baris, F&B 10, attendance 25, dan audit 50; masing-masing memiliki pilihan ukuran halaman, pencarian/filter, jumlah total, rentang baris, serta navigasi halaman. Antrean aktif dipisah dari riwayat agar tindakan operasional tidak hilang ketika membuka halaman riwayat lain. Export Excel attendance mengambil seluruh data yang cocok dengan filter. Live Room Monitor dan housekeeping hari ini tetap tanpa pagination.

## 4 Agustus 2026 — Rekening transfer tidak dibedakan per kamar

**Pengguna:** Menanyakan mengapa setiap kamar/harga dapat memakai rekening berbeda dan menyatakan hal tersebut tidak perlu. Instruksi transfer seharusnya menampilkan seluruh rekening bank yang tersedia agar tamu dapat memilih salah satunya.

**Keputusan/asisten:** Menyetujui rekening sebagai master konfigurasi global properti. Pilihan rekening di form harga kamar dihapus. Semua rekening aktif ditampilkan pada halaman sukses dan lookup booking; reservation menyimpan seluruh versi rekening sebagai snapshot. Saat bukti transfer dicatat, Front Office memilih rekening KOOKA yang benar-benar menerima dana. Availability online hanya mensyaratkan minimal satu rekening properti aktif, bukan relasi rekening pada setiap rate plan.

## 4 Agustus 2026 — Waktu kedatangan dibuat fleksibel

**Pengguna:** Meminta early check-in dan late check-in dibuat fleksibel tanpa batas jam karena kebijakan guesthouse masih menyesuaikan kondisi langsung di tempat dan perlu melayani tamu, termasuk tamu dari luar negeri.

**Keputusan/asisten:** Jam check-in `14:00` dan checkout `12:00` tetap dipakai sebagai jadwal standar untuk informasi serta perencanaan, bukan cutoff transaksi. Early check-in dan late arrival/check-in diputuskan langsung oleh Front Office tanpa earliest/latest global selama masa booking masih berlaku, kamar assigned, dan kamar siap. Sistem tidak membuat no-show otomatis karena keterlambatan. Late checkout juga tidak memakai batas jam global, tetapi harus memperhatikan booking berikutnya; bila penggunaan masuk malam berikutnya, proses berubah menjadi extension dengan pemeriksaan inventory. Semua keputusan sensitif tetap menyimpan actor, alasan, dan audit.

## 4 Agustus 2026 — Istilah folio disederhanakan pada antarmuka

**Pengguna:** Meminta istilah `folio` diganti dengan bahasa yang lebih umum agar mudah dipahami staf guesthouse.

**Keputusan/asisten:** Istilah teknis `folio` tetap dipertahankan pada struktur internal agar buku besar transaksi, API, audit, dan histori tidak berubah. Pada antarmuka, istilah tersebut diganti secara kontekstual menjadi `Tagihan & dokumen`, `Tagihan tamu`, `Sisa tagihan`, atau `Rincian tagihan`. Pesan error operasional juga menggunakan istilah tagihan dalam bahasa Indonesia.

## 4 Agustus 2026 — Status F&B disederhanakan

**Pengguna:** Meminta langkah status F&B dikurangi karena alur sebelumnya terlalu banyak, dengan usulan pesanan langsung diproses lalu selesai/disajikan.

**Keputusan/asisten:** Pesanan baru langsung berstatus `Sedang diproses`. Staf cukup menekan `Tandai selesai / disajikan` setelah pesanan diserahkan, atau membatalkannya dengan alasan. Status lama tetap dikenali dan dikelompokkan ke label sederhana agar data historis serta audit tidak rusak.

## 4 Agustus 2026 — Checkout sebagian pada booking multi-room

**Pengguna:** Melaporkan bahwa ketika satu kamar dari booking multi-room Nana di-checkout, kamar tersebut muncul kembali sebagai belum dialokasikan. Tampilan baru benar setelah kamar kedua ikut checkout.

**Keputusan/asisten:** Penyebabnya adalah line kamar yang sudah `COMPLETED` masih ikut dalam data operasional setelah assignment aktifnya dilepas. Data operasional dan pilihan kamar diperbaiki agar hanya memuat line `ACTIVE`. Checkout kamar pertama sekarang menghilangkan kamar tersebut dari antrean operasional tanpa mengganggu kamar kedua; booking utama tetap aktif sampai semua kamar selesai checkout.

## 4 Agustus 2026 — Status Pantauan Kamar diperjelas secara visual

**Pengguna:** Meminta kondisi kamar lebih mudah disadari karena warna sebelumnya hanya terlihat pada garis tepi dan badge yang terlalu lembut.

**Keputusan/asisten:** Seluruh permukaan kartu sekarang memakai warna status yang konsisten, bukan hanya garis samping. `Siap` memakai hijau, `Terisi` jingga hangat, `Perlu dibersihkan` kuning, dan `Perlu perhatian` merah. Border, strip atas, nomor kamar, badge kontras, latar kartu, serta footer memakai tone yang sama agar status dapat dikenali cepat tanpa hanya bergantung pada teks.

## 4 Agustus 2026 — Email customer hanya tiga jenis

**Pengguna:** Meminta email customer dibatasi menjadi bukti pembayaran telah dicatat, pembayaran terverifikasi/booking terkonfirmasi, dan invoice. Email status pembayaran yang sebelumnya hanya berupa teks juga diminta memiliki tampilan profesional.

**Keputusan/asisten:** Email booking baru/instruksi pembayaran, reminder deadline, payment rejected/voided/partial, cancellation, dan expiry dihentikan. Email bukti pembayaran serta konfirmasi memakai template HTML KOOKA responsif dengan status yang jelas, kode booking, link melihat booking, identitas properti, dan plain-text fallback. Konfirmasi hanya dikirim ketika ambang pembayaran wajib pertama kali terpenuhi sehingga pembayaran tambahan tidak menghasilkan email berulang. Email dokumen juga memakai body branded dengan PDF terlampir. Reset password staf tetap dipertahankan sebagai email keamanan internal.

## 4 Agustus 2026 — Permintaan cleaning untuk kamar yang sedang dihuni

**Pengguna:** Melaporkan tugas yang dibuat melalui `Tambahkan kamar untuk dibersihkan` gagal saat dimulai dengan pesan bahwa kamar yang sedang ditempati tidak dapat diubah melalui aksi cepat.

**Keputusan/asisten:** Penyebabnya adalah tombol Housekeeping salah memakai jalur quick room status yang memang hanya aman untuk kamar kosong. Tugas manual diubah menjadi `GUEST_REQUEST` dan seluruh progresnya memakai transition cleaning task sehingga kamar occupied dapat dibersihkan tanpa mengubah status okupansi. Teks antarmuka diperjelas untuk menunjukkan bahwa fitur digunakan ketika tamu masih menginap, meminta pembersihan, dan sudah memberikan izin masuk.
