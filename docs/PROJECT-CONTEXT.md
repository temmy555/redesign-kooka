# Project Context — Redesign Kooka

## Ringkasan

Redesign Kooka adalah proyek redesign landing page dan pembangunan sistem booking/operasional untuk **KOOKA Residence Surabaya**. Produk akhirnya menggabungkan website publik untuk pemasaran dan direct booking dengan aplikasi internal untuk front office, housekeeping, F&B, serta pengelolaan konten.

- Website saat ini: <https://www.kookaresidencesby.com/>
- Jenis bisnis: guesthouse / boutique residence.
- Pasar awal: Indonesia.
- Zona waktu operasional: Asia/Jakarta.
- Bahasa customer-facing: Bahasa Indonesia dan English.
- Mata uang transaksi: IDR; tampilan estimasi dapat dipilih dalam IDR, USD, atau AUD.
- Arah visual: **Urban Tropical Retreat** — tenang, hangat, hijau, dan personal.

PRD lengkap dan menjadi sumber kebutuhan utama: [PRD.md](PRD.md).

## Scope baseline

- PRD versi `2.0 Baseline` disetujui pada 1 Agustus 2026 setelah review sistem sampai Point 37.
- Addendum `2.1` pada 2 Agustus 2026 menetapkan Versi 01 sebagai arah landing terpilih serta menambahkan in-app Employee Attendance sebagai Phase 1B.
- Baseline membekukan klasifikasi fitur, bukan nilai konfigurasi dan bukan tanda bahwa implementasi telah dimulai.
- [SCOPE-DECISION-REGISTER.md](SCOPE-DECISION-REGISTER.md) mengelompokkan Phase 1, Phase 2 deferred, Phase 3 integration, manual/SOP, out of scope, dan open configuration.
- [PHASE-1-READINESS-CHECKLIST.md](PHASE-1-READINESS-CHECKLIST.md) menjadi gate konfigurasi, content, security, build, UAT, serta go-live.
- Fitur baru memerlukan change request dengan impact analysis dan Owner decision. Deferred item tidak masuk Phase 1 secara implisit.
- Baseline stack/deployment dan logical PostgreSQL schema telah disusun pada 2 Agustus 2026. Physical Drizzle schema, generated initial SQL, hard PostgreSQL constraints, dependency/quality foundation, local infrastructure, server-only database runtime, migration runner, synthetic dev seed, disposable verification, dan read-only health route telah dibuat. Local development database sudah dimigrasikan; production migration/seed, authentication, UI bisnis, domain workflow, dan deployment aktual belum dibuat.
- Owner menyetujui model room type/unit, nightly inventory claim, PostgreSQL row locking, physical assignment-night uniqueness, serta memberi mandat agar struktur database domain lain mengikuti rekomendasi teknis yang sesuai untuk KOOKA. Nilai real/configuration yang belum tersedia tetap open dan tidak diisi dengan asumsi produksi.

Arsitektur teknis: [TECHNICAL-ARCHITECTURE.md](TECHNICAL-ARCHITECTURE.md).

Blueprint database: [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md).

Urutan implementasi: [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md).

Aturan lifecycle dan perubahan status: [STATE-TRANSITIONS.md](STATE-TRANSITIONS.md).

Aturan availability dan inventory locking: [AVAILABILITY-INVENTORY.md](AVAILABILITY-INVENTORY.md).

Aturan pricing, room move adjustment, cancellation, dan refund manual: [PRICING-RATES.md](PRICING-RATES.md).

Aturan folio, invoice combined/split, payment allocation, dan tax: [FOLIO-FINANCIAL-LEDGER.md](FOLIO-FINANCIAL-LEDGER.md).

Aturan stay operations, business date, guaranteed late arrival, no-show, dan daily close: [STAY-OPERATIONS-DAILY-CLOSE.md](STAY-OPERATIONS-DAILY-CLOSE.md).

Aturan booker/guest, partial multi-room stay, flexible billing, capacity, dan extra bed: [GUEST-OCCUPANCY-EXTRA-BED.md](GUEST-OCCUPANCY-EXTRA-BED.md).

Aturan multi-room, group proposal/hold, package, dan Whole House: [GROUP-PACKAGE-WHOLE-HOUSE.md](GROUP-PACKAGE-WHOLE-HOUSE.md).

Aturan POS/F&B, services/tours, room charge, settlement, resource scheduling, void, dan refund: [POS-SERVICES-TOURS.md](POS-SERVICES-TOURS.md).

Aturan CMS, bilingual content, media, authenticity/rights, policy, trust provenance, preview, dan publish: [CMS-CONTENT-MEDIA.md](CMS-CONTENT-MEDIA.md).

Aturan security, privacy, sensitive file, customer lookup, audit access, retention/purge, dan backup: [SECURITY-PRIVACY-RETENTION.md](SECURITY-PRIVACY-RETENTION.md).

Aturan notifikasi, akses booking tanpa login, payment deadline, reminder, delivery, dan internal alert: [NOTIFICATIONS-CUSTOMER-COMMUNICATION.md](NOTIFICATIONS-CUSTOMER-COMMUNICATION.md).

Aturan dashboard, Live Room Monitor, metric, reporting, export, dan reconciliation: [REPORTING-DASHBOARD-RECONCILIATION.md](REPORTING-DASHBOARD-RECONCILIATION.md).

Aturan master data, configuration version/effective date, approval, impact checker, archive, dan secret boundary: [MASTER-DATA-CONFIGURATION-GOVERNANCE.md](MASTER-DATA-CONFIGURATION-GOVERNANCE.md).

Aturan greenfield initial setup, Opening Booking, Go/No-Go, cutover, rollback, offline recovery, dan hypercare: [GO-LIVE-CUTOVER-ROLLBACK.md](GO-LIVE-CUTOVER-ROLLBACK.md).

Aturan maintenance, serviceability, return-to-service, Guest Damage Incident, Damage Charge Catalog, assessment, dan folio posting: [MAINTENANCE-ASSET-DAMAGE.md](MAINTENANCE-ASSET-DAMAGE.md).

## Sasaran produk

1. Meningkatkan direct booking dan mengurangi ketergantungan pada OTA.
2. Menjadikan kamar dan ketersediaannya sebagai fokus utama pengalaman publik.
3. Menyatukan data reservasi, inventory fisik, tagihan, pembayaran, refund, dan operasional kamar.
4. Memberi tiap tim akses yang sesuai melalui RBAC dan prinsip least privilege.
5. Menyiapkan fondasi yang dapat dikembangkan bertahap tanpa mencampur status atau mengandalkan spreadsheet/chat sebagai sumber kebenaran.

## Keputusan pengalaman publik

- Homepage harus lebih ringkas, terutama di mobile.
- Navigasi disederhanakan agar jalur ke ketersediaan dan booking lebih jelas.
- Hero menggunakan foto/video properti asli dan memuat pencarian check-in, check-out, jumlah tamu, serta jumlah kamar.
- Kamar menjadi produk utama. Services, tours, gym, dan F&B ditempatkan sebagai pendukung dan upsell.
- Halaman membutuhkan trust strip, testimoni terverifikasi, informasi lokasi/jarak yang faktual, FAQ, dan sticky booking CTA di mobile.
- Foto stock/Unsplash harus diganti dengan aset properti asli sebelum publikasi final.
- Fitur existing untuk Bahasa Indonesia/English dan pilihan tampilan harga IDR/USD/AUD wajib dipertahankan dalam redesign.

## Keputusan bahasa dan mata uang

- Seluruh perjalanan customer—landing page, kamar, menu, services/tours, booking, instruksi pembayaran, dan status booking—mendukung Bahasa Indonesia dan English.
- Preferensi bahasa dan mata uang bertahan saat pengguna berpindah halaman atau memasuki booking flow.
- CMS menyimpan konten customer-facing dalam kedua bahasa dan menggunakan fallback ketika terjemahan belum lengkap.
- Harga dapat ditampilkan dalam IDR, USD, atau AUD.
- USD dan AUD hanya estimasi berdasarkan kurs referensi, bukan price lock atau mata uang tagihan.
- IDR tetap menjadi sumber kebenaran untuk rate, booking, folio, invoice, payment, refund, laporan, dan audit.
- Review booking dan instruksi pembayaran harus menampilkan total IDR secara dominan serta memberi label jelas pada estimasi USD/AUD.
- Jika kurs tidak tersedia/kedaluwarsa, sistem kembali ke tampilan IDR tanpa menghalangi booking.

## Keputusan pembayaran tahap awal

Metode yang didukung:

- Transfer bank.
- Deposit/uang muka.
- Tunai.
- Bayar saat check-in.
- Bayar saat checkout.
- Split payment bila diperlukan.

Alur yang disepakati:

1. Customer membuat booking.
2. Sistem menghasilkan kode booking, rincian tagihan, dan instruksi transfer.
3. Customer mengirim bukti transfer beserta kode booking melalui WhatsApp.
4. Admin memeriksa transfer dan mencatat hasil verifikasi di sistem.
5. Sistem memperbarui payment status dan dokumen pembayaran.

Xendit/payment gateway belum digunakan karena verifikasi bisnis belum selesai. WhatsApp adalah kanal konfirmasi, bukan sumber data resmi.

Konfigurasi awal:

- Checkout-session hold default 15 menit.
- Public online payment deadline default 2 jam; 1 jam hanya untuk same-day atau policy khusus admin.
- Reminder pembayaran dijadwalkan 30 menit sebelum deadline.
- Deadline dipenuhi ketika customer telah transfer dan menyerahkan bukti/referensi; bukan ketika admin selesai memverifikasi.
- Bukti tepat waktu membuat `Payment Review Hold` sehingga inventory tetap ditahan sampai review selesai.
- Tanpa bukti tepat waktu booking menjadi `Expired` dan inventory dilepas. Reopen membutuhkan availability recheck, hold baru, dan deadline baru.

## Keputusan akses customer

- Customer tidak memiliki akun, password, atau login.
- Customer lookup menggunakan kombinasi booking code dan email booking.
- Lookup hanya menampilkan ringkasan booking, status, nilai/instruksi IDR, dan dokumen customer yang diizinkan.
- Data KTP/tanda tangan, bukti dan notes pembayaran internal, rekening refund, internal notes, audit, serta data operasional tidak ditampilkan.
- Lookup menggunakan generic errors, rate limiting, attempt monitoring, dan short-lived session setelah validasi.
- Perubahan/cancellation pada Phase 1 dilakukan melalui Front Office/WhatsApp, bukan self-service lookup.
- Booking manual tanpa email tidak tersedia di lookup sampai Front Office menambahkan email valid.
- Halaman sukses dan lookup menampilkan booking code, nominal/deposit/saldo IDR, rekening resmi, deadline/countdown, status review, dokumen yang diizinkan, serta tombol WhatsApp.
- Email `Selesaikan Pembayaran Booking` menyediakan link `Lihat & Bayar Booking`; booking code boleh terisi otomatis, tetapi email/session valid tetap diperlukan.

## Keputusan notifikasi dan komunikasi

- Phase 1 menggunakan email transaksional, in-app alert, dan WhatsApp manual/deep link. WhatsApp Business API berada di Phase 3.
- Status WhatsApp manual hanya `Prepared`, `Opened`, atau `Handed Off`; tidak boleh mengklaim `Sent/Delivered/Read`.
- Booking/payment transaction tidak bergantung pada provider; business event diproses melalui transactional outbox dan idempotent worker dengan retry, dedupe, serta failure queue.
- Template customer bilingual, versioned, mengikuti language snapshot, menyimpan rendered snapshot, dan menampilkan IDR sebagai nilai resmi.
- Recipient dibedakan sebagai Booker/Contact Person, Primary/Room Lead Guest, Payer, dan Invoice Recipient.
- Scheduled reminder dibatalkan/diganti ketika booking confirmed, amended, cancelled, expired, atau deadline berubah.
- Internal alert memiliki `Open`, `Acknowledged`, `Resolved`, atau `Escalated`.
- Notifikasi tidak memuat KTP/foto/tanda tangan, rekening refund, internal payment evidence/notes, atau public link ke data sensitif.

## Keputusan pricing dan kebijakan

- Harga resmi disimpan dalam integer IDR dan dirinci per booking line/malam.
- Quote memiliki expiry dan booking menyimpan immutable price/policy snapshot.
- Harga tidak perlu diisi per tanggal setiap hari. Base rate per room type menjadi fallback; special-date, seasonal/rentang tanggal, serta weekday/weekend menjadi override, lalu promo/discount diterapkan bila rule mengizinkan.
- Prioritas default adalah special date → seasonal → weekday/weekend → base rate. Rule overlap/gap harus terlihat pada preview; tanpa resolved rate kamar tidak dijual online dan tidak pernah otomatis bernilai nol.
- Snapshot per stay date menyimpan nominal IDR serta source rule/version sehingga perubahan master hanya memengaruhi quote/booking baru. Nominal produksi masih menunggu pengisian Owner.
- Tax dan service charge dipisahkan serta dapat memiliki profile berbeda per room, F&B, add-on, service/tour, damage, atau charge lain. Initial safe configuration adalah `No Tax` sampai profile/rate/dokumen divalidasi Owner/pihak perpajakan; ini bukan kesimpulan kewajiban pajak.
- Tax/service dihitung dan disnapshot saat charge diposting. Combined/split invoice memakai component entries yang sama dan tidak menghitung ulang ketika profile master berubah.
- Room move tidak melakukan automatic repricing; admin memilih no price change, additional charge, atau price reduction/credit dengan nominal manual.
- Room move adjustment menjadi folio item, memiliki alasan/audit dan indikator guest informed/accepted bila dikenakan biaya; Front Office berizin tidak memerlukan Owner approval.
- Cancellation/payment policy versioned dalam Bahasa Indonesia/English dan booking menyimpan versi yang berlaku.
- Customer-created online booking wajib full payment 100% IDR sebelum `Confirmed`; deposit persentase/nominal tetap, pay-at-check-in, dan pay-at-checkout hanya dapat dipilih staf berizin saat membuat manual booking.
- Verified partial online payment tetap payment/folio credit tetapi tidak mengonfirmasi reservation. Jika booking expired, inventory dilepas tanpa menghapus credit; Front Office memproses rebooking/allocation atau refund manual.
- Cancellation fee dan refundable amount ditentukan manual oleh admin; sistem hanya menampilkan policy, ringkasan, dan financial guard.
- Cancellation tidak otomatis membuat refund. Refund tetap manual melalui record, Front Office decision, transfer, evidence, audit, dan refund note tanpa Owner approval.
- KOOKA tidak menyediakan breakfast included; semua room rate bersifat `Room Only` terhadap makanan.
- Semua makanan/minuman harus dipesan terpisah dengan item, quantity, harga, tax/service profile atau No Tax, fulfillment, dan order/folio source yang dapat ditelusuri.
- Package hanya dapat memuat F&B credit atau specific paid component secara eksplisit dan tidak membuat entitlement breakfast otomatis.
- Detail lengkap tersedia di [PRICING-RATES.md](PRICING-RATES.md).

## Keputusan master data dan configuration governance

- Sistem tetap single-property KOOKA Residence dengan satu property root; multi-property UI/workflow tidak masuk scope aktif.
- Operational master adalah source capacity, rate, tax, availability, payment, schedule, dan rule; CMS tetap untuk editorial copy/media.
- Master memakai stable internal ID. Nomor kamar sederhana adalah display identifier unik; perubahan nomor tidak memutus histori unit.
- Transaction-impacting configuration mempunyai version/effective period `Draft`, `Scheduled`, `Active`, atau `Retired`; approval state disimpan terpisah.
- Existing booking, posted folio, issued document, dan sent notification mempertahankan snapshot/version; perubahan master tidak berlaku retroaktif.
- Hierarchy dibatasi pada property default → room type/product → rate plan/package/approved channel override dan resolved-value view menunjukkan sumber/version.
- Approval berbasis risiko berlaku untuk high-risk master configuration: rekening, tax/service, invoice identity/sequence, maximum capacity, serta role/permission memerlukan Owner approval. Transaksi finansial operasional Front Office tidak memakai Owner approval limit.
- Owner self-approval high-risk memakai alasan wajib dan security event. Perubahan rekening selalu menghasilkan alert serta tidak mengganti instruksi lama tanpa explicit reissue.
- Rekening master menyimpan bank, nomor, nama pemilik, IDR, status/effective period, dan instruction text. Beberapa rekening dapat aktif hanya dengan selection rule eksplisit; booking menyimpan resolved instruction snapshot.
- `Reissue Payment Instruction` menargetkan booking terpilih atau approved batch dengan preview, old/new snapshot, notification, permission, dan audit; tidak ada silent global replacement atau perubahan payment status.
- Impact checker memeriksa booking/assignment/capacity/extra bed/block/rate/tax/policy/payment/document-sequence/recovery-access conflict sebelum activation.
- Conflict tidak mengubah/cancel booking otomatis. Referenced master diarchive/retired; rollback membuat version baru.
- Activation atomic/idempotent dengan version/concurrency guard. Integration secret disimpan sebagai secure credential reference dan tidak muncul pada UI/export/log/audit.

## Keputusan greenfield go-live

- Sistem baru tidak melakukan migrasi/import legacy booking, customer, payment, invoice, chat, identity document, user, configuration, atau audit.
- Production diisi dengan initial master/configuration yang divalidasi Owner; UAT/staging menggunakan dummy data terpisah.
- Bila tidak ada commitment yang overlap go-live, production dimulai tanpa booking.
- Reservation/stay lama yang masih mengonsumsi inventory dicatat manual sebagai `Opening Booking`; temporary Opening Inventory Block hanya menjadi fallback sampai data minimum siap.
- Historical completed booking tidak dibuat ulang sebagai transaction/ledger baru.
- Admin dan public booking memakai inventory source yang sama sejak aktivasi; booking entry lama disabled/redirected.
- Go/No-Go memvalidasi inventory, rekening, core flow, RBAC, notification, backup/restore, monitoring, critical issue, serta approval Owner/Front Office/implementation lead.
- Setelah live transaction, blind database restore dilarang sebagai rollback rutin. Gunakan disable flow, forward fix/data-compatible application rollback, dan reconciliation.
- System-unavailable workflow memakai Offline Operations Log; recovery menyimpan actual event time, actor, unique source reference, idempotency, dan audit.
- Hypercare default 14 hari dengan daily reconciliation serta exit approval.

## Peran dan akses minimum

- **Super Admin / Owner:** seluruh konfigurasi, user/role, laporan, refund, void, serta audit log.
- **Admin / Front Office:** booking online/manual, data tamu, alokasi dan perpindahan kamar, pembayaran, folio, invoice, checkout, serta operasional terkait.
- **Cleaning:** task housekeeping dan informasi kamar yang relevan tanpa akses ke detail finansial atau data pribadi berlebih.
- **F&B:** menu, POS, antrean order, transaksi standalone, dan room charge sesuai izin.

RBAC wajib diterapkan di server, bukan hanya melalui visibilitas menu.

## Keputusan domain dan data

### Status harus terpisah

Field berikut tidak boleh digabung:

- Reservation status.
- Stay status.
- Payment balance status yang dihitung dari folio.
- Payment record status untuk verifikasi setiap transaksi.
- Room occupancy status.
- Housekeeping condition.
- Room serviceability/block.
- Cleaning task status.
- Refund status.

Contoh yang valid: reservation `Confirmed`, stay `Not Started`, dan payment `Unpaid` untuk booking yang diizinkan membayar saat checkout.

Keputusan status pembayaran:

- Payment balance: `No Payment Required`, `Unpaid`, `Partially Paid`, `Paid`, atau `Overpaid/Credit Balance`; seluruhnya dihitung dari folio dan tidak diedit manual.
- Payment record: `Pending Verification`, `Verified`, `Rejected`, atau `Voided`.
- Refund record: `Requested`, `Approved`, `Rejected`, `Processing`, `Refunded`, `Failed`, atau `Cancelled`.
- `Partially Refunded/Fully Refunded` adalah ringkasan hasil perhitungan, bukan status satu refund record.
- Bukti transfer belum mengurangi saldo sampai diverifikasi.
- Payment terverifikasi dikoreksi melalui reversal, bukan penghapusan.
- Refund tidak mengubah atau menghapus histori payment asli.

Keputusan state-transition:

- Status tidak diedit melalui dropdown/update generik; pengguna menjalankan action bisnis seperti confirm, check-in, verify payment, checkout, atau complete cleaning.
- Backend memvalidasi status asal, tujuan, permission, guard, dan side effect.
- Transition kritis bersifat transaksional, idempotent, menggunakan concurrency/version check, dan meninggalkan audit event.
- Recovery dari expired/no-show/failed tetap mempertahankan histori serta melakukan availability atau validation check ulang.
- Matrix lengkap berada di [STATE-TRANSITIONS.md](STATE-TRANSITIONS.md).

### Inventory dan alokasi

- Inventory dihitung berdasarkan unit kamar fisik.
- Room type adalah kategori produk; room unit adalah kamar fisik.
- Nomor kamar menggunakan label sederhana dan berurutan seperti `1`, `2`, `3`; room type disimpan terpisah, misalnya Kamar 1 Deluxe dan Kamar 2 Executive.
- Nomor kamar disimpan sebagai string dan bukan primary key; setiap unit memiliki internal ID stabil dan `sort_order`.
- Jumlah kamar diperkirakan sekitar 15 unit tetapi belum diverifikasi. Estimasi bukan hard limit dan tidak boleh menjadi production inventory sebelum nomor, room type, capacity, amenity, extra-bed eligibility, serta kondisi awal setiap unit dikonfirmasi.
- Karena perkiraan melebihi sembilan kamar, keputusan lama “single digit” diperjelas menjadi nomor sederhana/berurutan seperti `1`–`15`; sistem tetap menerima string dan tidak menyandikan room type pada nomor.
- Booking dapat dibuat untuk room type tanpa langsung dialokasikan ke nomor kamar.
- Landing page dan pencarian ketersediaan menampilkan produk jual berdasarkan kombinasi room type dan maximum guest, bukan nomor kamar fisik.
- Dua varian dapat memakai display name yang sama, misalnya `Deluxe`, tetapi berbeda kapasitas seperti maksimum 2 dan maksimum 3 tamu. Keduanya disimpan sebagai room type/varian internal berbeda dengan stable ID serta code unik agar inventory, harga, dan kapasitas tidak tercampur.
- Nomor kamar fisik tidak ditampilkan atau dipilih customer; Front Office mengalokasikannya setelah booking berdasarkan varian yang dipesan, ketersediaan seluruh periode, serta kesiapan unit.
- Booking unassigned tetap mengonsumsi inventory room type; assignment tidak mengonsumsi inventory kedua kali.
- Stay date memakai interval `[check-in, checkout)`.
- Checkout-session hold direkomendasikan 15 menit dan payment hold awal dua jam.
- Final booking melakukan availability recheck serta locking semua room type/malam dalam satu transaction.
- Create/amend/cancel/expire/release inventory bersifat idempotent dan menggunakan concurrency/version check.
- Hard overbooking tidak diizinkan untuk role mana pun; konflik eksternal/legacy menggunakan workflow `Needs Resolution`.
- Whole house harus mengunci semua unit fisik yang menjadi komponennya.
- Maintenance, owner use, deep cleaning, dan block lain harus mengurangi unit yang dapat dijual.
- Kondisi unit dipisahkan menjadi occupancy (`Vacant/Occupied`), housekeeping (`Dirty/Cleaning/Cleaned/Inspected`), dan serviceability (`In Service/Blocked/Out of Order`).
- `Reserved`, `Due In`, `Due Out`, `Available to Sell`, dan `Ready for Check-in` merupakan assignment/indikator turunan, bukan satu room status yang diedit manual.
- Kamar dirty dapat tetap dijual untuk tanggal mendatang, tetapi tidak boleh digunakan check-in sebelum memenuhi aturan ready.
- Checkout dan check-in pada tanggal yang sama tidak overlap. Kedatangan tersebut tetap membutuhkan `Same-day Turnover` berprioritas tinggi dan hanya dapat check-in setelah unit ready.
- Extension adalah permintaan inventory baru. Booking confirmed mendatang tetap diprioritaskan dan tidak boleh digeser otomatis atau menyebabkan overbooking.
- Konflik extension diselesaikan dengan menolak extension, memindahkan tamu in-house, atau memindahkan/meng-upgrade booking mendatang ke inventory lain secara atomik.
- Perubahan operasional oleh KOOKA ke tipe lebih tinggi direkomendasikan sebagai `Complimentary Upgrade / No Price Change`; guest-requested extension dapat dikenakan tambahan harga atau waiver manual.
- Sistem membedakan booked room type, fulfilled room type, assignment aktual, dan price treatment agar histori serta inventory tetap dapat ditelusuri.
- Detail lengkap tersedia di [AVAILABILITY-INVENTORY.md](AVAILABILITY-INVENTORY.md).

### Stay operations, late arrival, dan daily close

- Business date memakai Asia/Jakarta dengan rekomendasi automatic rollover pukul 04:00 yang dapat dikonfigurasi.
- Daily rollover tidak memblokir Front Office; sistem membuat indikator, task, exception, dan reconciliation secara idempotent.
- Booking online wajib memperoleh verifikasi pembayaran 100% sebelum reservation menjadi `Confirmed` dengan guarantee classification `Guaranteed`; deposit hanya tersedia pada admin-created manual booking.
- Guarantee classification dan guarantee basis dipisahkan dari reservation, stay, serta payment status.
- Bukti tepat waktu yang masih pending verification menahan inventory sampai admin menyelesaikan review.
- `Arrival Overdue/Possible No Show` hanya indikator dan tidak melepas inventory.
- Guaranteed booking mempertahankan room type/quantity sampai checkout asli secara default, walaupun tamu belum check-in atau telah ditandai no-show.
- Mark no-show dan release inventory adalah action terpisah. Front Office dengan permission khusus dapat release guaranteed inventory tanpa Owner approval, tetapi wajib mencatat contact attempt, alasan, policy snapshot, affected nights/quantity, financial consequence, dan audit.
- Tamu yang datang pukul 00:00 tetap dapat check-in jika periodenya belum berakhir, commitment masih retained, dan unit ready; checkout serta harga tidak bergeser otomatis.
- Nomor kamar tidak dijamin, tetapi sistem wajib mempertahankan unit/type yang memenuhi booking.
- Detail lengkap tersedia di [STAY-OPERATIONS-DAILY-CLOSE.md](STAY-OPERATIONS-DAILY-CLOSE.md).

### Early check-in dan late checkout

- Jam standar default adalah check-in `14:00` dan checkout `12:00` dalam `Asia/Jakarta`; keduanya configurable, versioned/effective-dated, diaudit, dan disimpan sebagai policy snapshot booking agar perubahan tidak berlaku retroaktif diam-diam.
- Jam standar hanya menjadi acuan informasi dan perencanaan. Early check-in serta late arrival/check-in tidak memiliki cutoff jam global; Front Office memutuskan langsung di lokasi selama booking masih berlaku dan unit siap.
- Late checkout tidak memiliki batas jam global, tetapi harus mencatat waktu persetujuan, tidak boleh mengganggu booking berikutnya, dan berubah menjadi extension bila penggunaan masuk malam berikutnya.
- Customer dapat memberi ETA/request, tetapi approval hanya dilakukan langsung oleh Front Office/Owner dan tidak dijamin oleh booking online.
- Early check-in disetujui hanya jika reservation confirmed, unit assigned, previous guest telah checkout, dan unit memenuhi `Ready for Check-in`.
- Late checkout ditolak bila ada confirmed next guest yang menunggu/akan segera datang, turnover tidak cukup, properti/room type penuh tanpa alternatif valid, atau unit harus dikosongkan untuk kebutuhan operasional.
- Booking berikutnya tidak boleh digeser/dibatalkan otomatis demi late checkout.
- Late checkout intraday membuat `Operational Occupancy Block` dan memperbarui cleaning/target ready time tanpa otomatis menambah room night.
- Jika melewati overnight threshold, gunakan extension dengan inventory locking per malam.
- Early check-in/late checkout adalah `Accommodation Add-on`, bukan service/tour; charge/waiver memakai IDR/tax snapshot, approval, folio posting, dan audit.
- ETA malam tetap mengikuti guaranteed late-arrival policy dan tidak menggeser checkout atau harga.
- Detail lengkap tersedia di [EARLY-CHECKIN-LATE-CHECKOUT.md](EARLY-CHECKIN-LATE-CHECKOUT.md).

### Folio dan histori

- Istilah teknis `folio` tetap dipakai pada domain, database, API, dan audit sebagai buku besar transaksi booking. Pada antarmuka staf dan customer, gunakan bahasa umum sesuai konteks: `Tagihan & dokumen`, `Tagihan tamu`, `Sisa tagihan`, dan `Rincian tagihan`.

- Satu booking memiliki folio utama.
- Folio memuat immutable debit/credit entries untuk room, package, POS, service, discount, tax/service, payment, reversal, refund, dan saldo.
- Harga historis booking tidak berubah otomatis ketika master rate diubah.
- Pembayaran tidak dihapus; koreksi menggunakan void/reversal dengan alasan.
- Perubahan sensitif—harga, pembayaran, kamar, refund, pembatalan—wajib memiliki audit log.
- Checkout tidak otomatis menutup folio; folio tetap open jika balance/pending process belum selesai.
- Invoice dapat combined, room-only, other-charges, atau custom berizin tanpa memecah master folio.
- Satu folio entry hanya dapat masuk satu active final invoice; payment allocation tidak membuat payment baru.
- Room/F&B/tour/service dapat memiliki versioned tax/service profile berbeda, inclusive/exclusive, custom, atau no-tax.
- Invoice tidak menghitung ulang tax; combined dan split invoices mengambil tax snapshot entries yang sama.
- Document profile memuat legal/display name, alamat/kontak/logo, NPWP bila digunakan dan tervalidasi, footer/terms, layout/language version, serta sequence terpisah per proforma/invoice/receipt/refund note.
- Sequence unik/atomic/tidak digunakan ulang; dokumen issued menyimpan rendered snapshot. Front Office dapat issue/void/supersede dengan reason/audit tanpa Owner approval, sedangkan Owner mengelola identity/sequence master.
- Semua dokumen resmi bernilai IDR, mengikuti language snapshot `id/en`, dan mendukung PDF print/download serta email.
- Detail lengkap tersedia di [FOLIO-FINANCIAL-LEDGER.md](FOLIO-FINANCIAL-LEDGER.md).

### Guest, multi-room billing, dan extra bed

- Booker, Primary Guest, Room Lead Guest, Additional Guest, Payer, dan Invoice Recipient disimpan sebagai role terpisah; satu orang dapat memegang beberapa role.
- Setiap kamar memiliki stay/assignment dan Room Lead Guest sendiri sehingga multi-room dapat partial check-in/out.
- Satu master folio mendukung combined atau split invoice per room, payer/guest, room-only, extras-only, maupun custom selection tanpa duplicate charge/tax.
- Room type menyimpan standard/max occupancy, extra-bed eligibility, maximum extra beds, serta capacity increment.
- Maximum physical occupancy tidak dapat di-override.
- Model kapasitas disetujui, dengan default kelompok usia awal Infant `0–2`, Child `3–11`, dan Adult `12+`; nilai tetap configurable/versioned. Angka kapasitas aktual per tipe/unit masih menunggu data final.
- Extra guest dan extra bed berbeda. Extra bed adalah `Accommodation Add-on`, bukan service/tour.
- Bila stok extra bed terbatas, resource-nya ditahan/dikunci bersama room inventory dalam satu transaction.
- Extra-bed charge default `Per Night`, memiliki tax snapshot, masuk master folio, dan dapat digabung atau dipisah pada invoice. Jumlah fisik serta mode tracked/non-tracked masih menunggu data operasional.
- Booking extra bed membuat housekeeping setup/removal/relocation task.
- Detail lengkap tersedia di [GUEST-OCCUPANCY-EXTRA-BED.md](GUEST-OCCUPANCY-EXTRA-BED.md).

### Group, package, dan Whole House

- Multi-room create mengunci seluruh kebutuhan dan tidak meninggalkan partial booking bila satu line gagal.
- Group inquiry/quotation tidak menahan inventory; tentative hold memiliki deadline dan lifecycle terpisah dari reservation.
- Package memiliki versioned fixed/optional components; hanya komponen terpilih yang relevan dikunci.
- Whole House merupakan exclusive composite product, bukan room type quantity satu.
- Whole House mengunci seluruh mandatory room/facility components dan mencegah penjualan kamar individual yang overlap.
- Partial room release Whole House membutuhkan conversion ke multi-room/group dengan availability/pricing baru.
- Bundle fixed/manual price tetap memiliki component allocation IDR untuk tax, invoice, report, cancellation/refund reference, dan audit.
- Satu master folio dan flexible invoice tetap berlaku tanpa duplicate component charge.
- Detail lengkap tersedia di [GROUP-PACKAGE-WHOLE-HOUSE.md](GROUP-PACKAGE-WHOLE-HOUSE.md).

## Keputusan operasional utama

### Front office dan room board

- Admin melihat dan membuat booking online maupun manual.
- Room board/calendar memperlihatkan unit fisik, booking mendatang, booking tanpa alokasi, status kamar, maintenance, dan block.
- Room move mempertahankan booking dan folio, memeriksa konflik, menyimpan penyesuaian harga opsional, membuat cleaning task untuk kamar lama, dan mencatat audit.
- Phase 1 memiliki `Live Room Monitor/Pantauan Kamar`: seluruh unit fisik tampil dalam satu grid berurutan, lengkap dengan room type, occupancy, stay, active Room Lead Guest, check-in/out, housekeeping, cleaning, maintenance/block, next arrival, dan alert.
- Status pada kartu tetap terpisah; nama penghuni berasal dari active room/stay guest allocation dan tidak diambil sembarang dari booker.
- Owner/Front Office dapat melihat nama sesuai permission. Cleaning memperoleh data minimum; Shared Display Mode memasking nama, booking code, kontak, saldo, serta data sensitif.
- Monitor auto-refresh, menunjukkan last-updated/connection/stale warning, dan quick action tetap memakai state guard serta audit resmi.

### Dashboard, laporan, dan reconciliation

- Dashboard berbasis role menunjukkan pekerjaan/exception saat ini; laporan historis/forecast dipisahkan dari dashboard dan accounting ledger.
- Actual Occupancy, Forecast Occupancy, dan Held Inventory adalah metric terpisah.
- Complimentary room yang dihuni masuk actual occupancy tetapi tidak masuk paid ADR denominator.
- Valid maintenance/out-of-order dikeluarkan dari sellable-room denominator; physical capacity dan excluded nights tetap ditampilkan.
- ADR memakai net room revenue sebelum tax/service dibagi paid occupied room nights; RevPAR membaginya dengan sellable room nights.
- Charge, verified payment, refund, outstanding, tax/service, dan discount memakai laporan serta date dimension terpisah. Semua nilai resmi dalam IDR.
- Phase 1 memiliki basic report/CSV dan reconciliation exception untuk inventory, assignment, stay/room, cleaning, folio, invoice, payment, refund, source posting, serta block.
- Reconciliation tidak melakukan silent auto-fix. Koreksi memakai business action, permission, alasan, reversal/adjustment bila finansial, dan audit.

### Registrasi tamu saat check-in

- Front Office dapat mengambil foto KTP/identitas dan foto tamu melalui kamera browser atau mengunggah file.
- Tamu dapat memberi tanda tangan digital langsung pada tablet menggunakan jari atau stylus.
- Foto identitas, foto tamu, dan tanda tangan masing-masing selalu opsional pada Phase 1 agar check-in tidak kaku atau terhenti karena consent, perangkat, atau izin kamera.
- Front Office dapat melewati pengumpulan tersebut tanpa override, check-in block, atau perubahan reservation/stay/payment status; kelengkapannya disimpan dalam registration status tersendiri.
- Tersedia preview, retake, clear/redraw signature, upload fallback, dan input manual.
- KTP, nomor identitas, foto tamu, serta tanda tangan diperlakukan sebagai data sensitif: purpose notice dan hasil accepted/declined/skipped, private storage, encryption, RBAC, access audit, dan configurable retention/purge.
- Hanya Owner/Super Admin dan Front Office dengan permission khusus dapat mengaksesnya; Cleaning, F&B, customer lookup, shared display, invoice, serta notifikasi tidak dapat melihat data tersebut.
- Durasi retention dan event awal per kategori wajib diisi sebelum go-live. Setelah purge, hanya completion/consent status dan audit minimum yang boleh dipertahankan tanpa file, signature content, atau nomor identitas lengkap.

### Security, privacy, dan retention

- Data diklasifikasikan Public, Internal, Confidential, atau Highly Sensitive; classification menentukan masking, permission, audit, export, retention, dan purge.
- Setiap staf memakai akun individual dengan login email dan kata sandi biasa. MFA/TOTP tidak digunakan untuk role mana pun.
- SSO tidak diperlukan dan tidak termasuk roadmap aktif Phase 1–3.
- Permission sensitif dipisah untuk view, capture/upload, download, export, replace, purge, dan grant access serta diverifikasi server-side.
- KTP/signature/guest photo/payment evidence/refund account memakai private encrypted storage, short-lived signed access, secure upload, dan log/analytics exclusion.
- Customer lookup memakai booking code; email opsional sebagai verifikasi tambahan. Generic error, rate limit, short session, masking, dan pembatasan sensitive data tetap berlaku.
- Sensitive access dan permission changes masuk append-only audit/security event; anomalous access membuat alert/review.
- Retention versioned per category; hold-aware purge/anonymization mempertahankan financial/inventory history.
- Backup encrypted/monitored dan restore diuji; deleted data mengikuti backup-expiry strategy.
- Detail lengkap tersedia di [SECURITY-PRIVACY-RETENTION.md](SECURITY-PRIVACY-RETENTION.md).

### Housekeeping

- Task otomatis berasal dari checkout hari ini, stayover, room move, deep cleaning, dan fasilitas publik; task juga dapat dibuat dari permintaan tamu.
- Status utama task: `Requested` → `Assigned` → `In Progress` → `Cleaned` → `Inspected`; exception: `Deferred`, `Unable to Access`, atau `Cancelled`.
- Jika tamu yang masih menginap sedang keluar dan meminta cleaning, occupancy tetap `Occupied`. Sistem membuat `Guest-Requested Stayover Cleaning` dengan waktu, prioritas, catatan, dan izin masuk.
- Sistem tidak menganggap kamar vacant atau sellable hanya karena tamu sedang keluar sementara.
- Setelah checkout, unit hanya menjadi ready for check-in sesuai aturan inspection yang dikonfigurasi.

### Flexible Departure Clearance

- Pemeriksaan singkat sebelum checkout bersifat opsional/fleksibel per room stay dan tidak menahan tamu tanpa batas.
- Status `Not Started`, `In Progress`, `Cleared`, `Issue Found`, atau `Skipped` terpisah dari stay, payment, cleaning, maintenance, Lost & Found, serta damage assessment.
- Front Office dapat skip dengan permission, actor, waktu, dan alasan; target pemeriksaan hanya menghasilkan alert/decision prompt.
- Temuan dirutekan ke Guest Damage Incident, Maintenance Issue, Lost & Found, Manual Paper Order, atau folio action dan tidak otomatis menjadi charge/responsibility.
- Actual checkout setelah cleared/skipped tetap menghasilkan `Checked Out`, `Vacant + Dirty`, serta satu turnover task.
- Multi-room dapat clearance dan checkout per stay.
- Detail lengkap tersedia di [CHECKOUT-DEPARTURE-CLEARANCE.md](CHECKOUT-DEPARTURE-CLEARANCE.md).

### Maintenance, Out of Order, dan guest damage

- Maintenance Issue lifecycle dipisahkan dari occupancy, housekeeping, serviceability/block, cleaning, Guest Damage Incident, internal cost, folio charge, dan payment.
- Lifecycle utama: `Reported → Triaged → Assigned → In Progress → Resolved → Verified → Closed`, dengan waiting/deferred/cancelled/reopen path.
- Severity `Critical/Safety`, `High/Guest Impact`, `Normal`, atau `Low/Preventive`; triage memilih Monitor Only, Restricted Use, Planned Block, atau Out of Order.
- Blocked berarti downtime terencana/administratif; Out of Order berarti kerusakan tidak terencana/tidak aman/tidak layak.
- Occupied room tetap Occupied saat issue dilaporkan. Unsafe issue memicu room move workflow tanpa otomatis mengubah booking/folio.
- Return to Service memerlukan verification, tidak ada blocking issue, safety/function check, cleaning bila relevan, housekeeping inspection, dan audit.
- Guest Damage Incident menghubungkan booking/stay/unit/guest/item/evidence/communication/assessment tanpa otomatis menyatakan customer bersalah.
- Versioned Damage Charge Catalog menyediakan harga referensi/default integer IDR, charge basis, tax profile/No Tax, evidence, effective period, dan optional non-blocking alert threshold.
- Saat checkout, Front Office berizin menetapkan assessment dan memposting satu `Guest Damage Charge` debit ke master folio dengan quantity, unit price, catalog/tax snapshot, actor, reason, serta audit tanpa Owner approval. Charge dapat masuk combined atau other-charges/custom invoice.
- Internal maintenance cost tidak menjadi customer charge otomatis. Manual override, waiver, dispute, outstanding, dan reversal menyimpan reason/permission/audit.
- Booking deposit berbeda dari security/damage deposit. Lost & Found tetap entity/lifecycle terpisah.

### Lost & Found dan chain of custody

- Found Event/Item, Lost Inquiry, Ownership Claim, Custody Event, Storage Location, Return/Handover, Shipment, serta Disposition Approval disimpan sebagai entitas terpisah dari maintenance dan Guest Damage Incident.
- Status item, claim, dan pickup/shipment dipisahkan. Satu Found Item hanya dapat mempunyai satu verified owner aktif.
- Cleaning dapat membuat Found Item dari task, tetapi temuan tidak mengubah occupancy, readiness, stay, folio, atau menyelesaikan cleaning task otomatis.
- Found Item memiliki kode unik, konteks lokasi/waktu/room/stay, deskripsi/kondisi/foto minimum, storage/seal, high-value/sensitive flag, serta versioned retention deadline.
- Setiap perpindahan barang membuat append-only Custody Event; correction dibuat melalui event baru. Unsecured item, unknown storage, custody gap, dan seal mismatch menjadi exception.
- Verifikasi claim memakai kombinasi kontak booking, ciri rahasia, waktu/lokasi, dan proof. Booking code saja tidak cukup untuk barang high-value.
- Pickup oleh perwakilan membutuhkan authorization. Signature receipt melalui tablet bersifat opsional dan terpisah dari check-in signature.
- Pengiriman mempunyai lifecycle, tracking, cost/payer, proof, serta failure/return path. Closed stay folio tidak dibuka kembali hanya untuk shipping charge; gunakan standalone invoice/receipt.
- Retention/disposition dikonfigurasi per kategori; active claim/hold memblokir disposition. Uang, identitas, kartu, obat, hazardous/perishable, dan high-value mengikuti kontrol/policy khusus.
- Customer tidak memiliki portal Lost & Found pada fase awal; inquiry dan claim ditangani Front Office melalui WhatsApp/email/telepon/tatap muka.
- Detail lengkap tersedia di [LOST-FOUND-CUSTODY.md](LOST-FOUND-CUSTODY.md).

### CMS

- Admin dapat upload, mengurutkan, publish/unpublish, dan menghubungkan foto/video ke kamar, service, atau menu.
- Detail kamar menggunakan amenity master, termasuk no smoking, AC, air panas, Wi-Fi, bed type, kapasitas, serta atribut relevan lainnya.
- Operational master menjadi sumber capacity/rate/availability/amenity/rule; CMS mengelola editorial copy/media.
- Konten memakai Draft/In Review/Scheduled/Published/Archived, revision history, protected preview, dan permission publish terpisah.
- Field Indonesia/English memiliki completeness dan fallback utuh.
- Media memakai staging/processing, responsive variants, authenticity/source/rights classification, dan reusable relation.
- Room hero/minimum final gallery harus authentic; stock/Unsplash hanya placeholder sesuai production-readiness rule.
- Policy memiliki version/effective date dan booking snapshot; trust item membutuhkan provenance/verification.
- Referenced content/media diarchive sebelum audited purge dan tidak boleh merusak histori.
- Detail lengkap tersedia di [CMS-CONTENT-MEDIA.md](CMS-CONTENT-MEDIA.md).

### POS, services, dan tours

- Menu F&B ditampilkan pada website lengkap dengan harga dan ketersediaan.
- Customer memesan makanan menggunakan formulir kertas yang tersedia di kamar dan menyerahkannya kepada Front Office; tidak ada customer self-order/cart pada scope awal.
- Front Office memasukkan `Manual Paper Order` yang dapat berisi banyak menu dalam satu formulir. Setiap baris memiliki menu, quantity, dan catatan sendiri; pesanan juga dapat memiliki catatan keseluruhan.
- Nomor formulir tidak diketik staf. Sistem membuat reference unik secara atomik dengan format `YYMMDDNN` berdasarkan tanggal kalender Jakarta dan urutan harian per property, misalnya `26080301` untuk order pertama pada 3 Agustus 2026. Order code menggunakan bentuk `FNB-{nomor formulir}`.
- Form menyimpan room/contact context, source, actor, dan input time; kertas fisik ditandai processed dan mengikuti SOP penyimpanan/pemusnahan.
- Paper order dapat menjadi standalone atau room charge. Route dipilih staf setelah verifikasi; nomor kamar yang ditulis sendiri tidak cukup untuk posting ke folio.
- Active menu price/tax di sistem menjadi nilai posting. Selisih dengan harga tercetak memerlukan guest confirmation atau approved override yang diaudit.
- POS dapat berdiri sendiri atau dibebankan ke folio kamar aktif.
- Services/tours dapat standalone atau menjadi folio charge.
- Transaksi standalone memiliki invoice dan lifecycle status sendiri.
- Order/fulfillment, payment, dan folio posting status dipisahkan.
- Settlement dapat standalone, room charge, atau split bila diaktifkan; route change setelah posting memakai reversal/repost.
- Room charge normal membutuhkan stay In House, active assignment, Room Lead Guest verification, charge privilege, billing destination, dan confirmation.
- Service/tour memiliki resource scheduling dan lifecycle fulfillment sendiri tanpa mencampur payment status.
- Package linkage membuat satu source order/booking dan tidak memposting included value dua kali.
- Cancel fulfillment, financial void/reversal, refund, dan service-recovery credit adalah proses terpisah.
- Pesanan F&B baru langsung berstatus `Sedang diproses`; staf hanya perlu memakai aksi `Tandai selesai / disajikan` atau membatalkan dengan alasan. Status internal lama tetap dipetakan untuk menjaga histori dan audit.
- Detail lengkap tersedia di [POS-SERVICES-TOURS.md](POS-SERVICES-TOURS.md).

### Keluhan tamu dan service recovery

- Guest Case/ticket lengkap ditunda ke Phase 2 karena belum menjadi kebutuhan utama operasional awal.
- Phase 1 menyediakan operational note pada booking/stay untuk ringkasan keluhan, waktu/kanal, actor, keputusan, dan tindak lanjut.
- Keluhan dirutekan ke lifecycle sumber seperti Cleaning, Maintenance, Room Move, folio adjustment/reversal, Refund, Lost & Found, atau incident procedure; note tidak menggantikan status/action sumber.
- Kompensasi finansial memakai discount/folio credit/reversal resmi dengan Front Office permission, reason, dan audit tanpa Owner approval. Refund tetap menggunakan Refund Record terpisah.
- Insiden keselamatan, keamanan, cedera, atau privasi memakai incident procedure sederhana dan evidence sensitif tetap dibatasi.
- Phase 2 dapat menambahkan classification/severity, assignment, SLA/escalation, guest-response state, communication timeline, service-recovery decision, dashboard, satisfaction, dan analytics.

### Cash shift dan serah-terima Front Office

- Cash drawer/session, opening float, shift handover, cash count, variance approval, dan rekonsiliasi kas di dalam sistem ditunda ke Phase 2.
- Phase 1 tetap mencatat setiap pembayaran tunai sebagai Payment Record `Verified` dengan source booking/folio/order, nominal IDR, actor penerima, waktu aktual, receipt/reference, dan audit.
- Koreksi payment tunai memakai void/reversal dan tidak dapat dihapus karena cash session belum tersedia.
- Transfer bank tidak masuk perhitungan kas fisik.
- Serah-terima dan rekonsiliasi kas Phase 1 menggunakan SOP operasional di luar sistem.
- Phase 2 dapat menambahkan cash point/session lifecycle, opening float, expected-versus-actual cash, `Close with Variance`, approval threshold, handover checklist, serta cash-shift report. Attendance shift assignment minimum kini termasuk Phase 1B; advanced workforce roster/optimization dan petty cash tetap bukan kewajiban.

### Kunci dan akses kamar

- Inventory/serah-terima kunci, key deposit, master-key custody, checkout key exception, dan room-move key handover ditunda dari Phase 1.
- Penyerahan dan pengembalian kunci fisik Phase 1 memakai SOP operasional di luar sistem.
- Lost/damaged key dapat dibuat sebagai Guest Damage Incident dan memakai Damage Charge Catalog, tetapi tidak menimbulkan charge otomatis tanpa keputusan assessment Front Office yang tercatat.
- Phase 2 dapat menambahkan physical key record serta issue/return/lost/damaged tracking dan audit.
- Smart lock, key-card encoder, expiring PIN, dan hardware access log dipertimbangkan paling cepat Phase 3 setelah hardware/kebijakan dipastikan.

### Penitipan bagasi — ditunda

- Modul penitipan bagasi sebelum check-in atau setelah checkout ditunda ke Phase 2.
- Jika KOOKA menerima titipan pada Phase 1, Front Office menggunakan SOP, log, dan tag manual dengan lokasi penyimpanan terkendali serta verifikasi saat pengambilan.
- Titipan tidak mengubah reservation/stay, occupancy, room readiness, cleaning, checkout, atau folio. Kamar yang sudah tersedia untuk dijual tidak digunakan sebagai tempat menyimpan bagasi.
- Accepted luggage berbeda dari Lost & Found. Bagasi yang melewati batas pengambilan dialihkan ke Lost & Found melalui pencatatan custody yang mereferensikan log penitipan awal.
- Phase 2 dapat menambahkan record/tag unik, status `Received/In Storage/Released`, exception `Overdue/Unclaimed`, serta action konversi ke Lost & Found.

### Visitor/pengunjung non-menginap — ditunda

- Visitor Log ditunda ke Phase 2.
- Bila visitor diperbolehkan pada Phase 1, Front Office menggunakan kebijakan dan catatan manual untuk jam/area kunjungan, host, waktu masuk/keluar, serta pemeriksaan orang yang belum keluar.
- Visitor bukan guest menginap dan tidak mengubah inventory, reservation, room stay, occupancy, kapasitas menginap, atau folio.
- Visitor yang akhirnya menginap harus ditambahkan sebagai Additional Guest melalui workflow resmi, termasuk pemeriksaan capacity, identity policy, extra guest, dan extra bed.
- Pengumpulan data visitor harus minimum; KTP/foto identitas tidak menjadi default. F&B/service tetap standalone atau room charge setelah host verification.
- Phase 2 dapat menambahkan lifecycle `Expected/On Site/Exited/Denied/Cancelled`, overdue alert, emergency headcount, serta badge termasking pada Live Room Monitor.

### Parkir dan kendaraan tamu — ditunda

- Parking/vehicle module ditunda ke Phase 2.
- Phase 1 hanya memuat fasilitas/kebijakan parkir terverifikasi dan dapat memakai booking/stay note atau log manual bila kendaraan perlu dicatat.
- Booking kamar tidak otomatis menjamin parkir. Kapasitas terbatas harus dikomunikasikan sebagai `subject to availability` atau memerlukan konfirmasi manual.
- Catatan kendaraan tidak mengubah reservation, room inventory, stay, occupancy, atau folio. Nomor polisi bersifat data terbatas dan tidak tampil pada shared display.
- Biaya parkir, bila ada, dapat dimasukkan manual sebagai `Accommodation Add-on / Parking` dengan service date, nominal IDR, tax/No Tax, source, reason, dan audit.
- Phase 2 dapat menambahkan kapasitas per vehicle type, request/confirmed/waitlist, arrival/departure, overflow parking, serta badge termasking; slot mapping/valet/EV/smart gate/ANPR hanya bila diperlukan.

### Special request dan preferensi tamu

- Phase 1 memiliki Guest Request ringan dari booking publik atau input Front Office, dengan kategori terstruktur dan optional note.
- Request ditautkan secara eksplisit ke booking, room stay/kamar, atau guest; multi-room tidak menerapkan request ke semua kamar secara implisit.
- Status `Submitted`, `Under Review`, `Accepted`, `Unable to Fulfill`, `Fulfilled`, atau `Cancelled` terpisah dari reservation, stay, cleaning, order/service, payment, dan folio.
- Website memberi label not guaranteed sampai KOOKA mengonfirmasi. Accepted dan Fulfilled adalah dua keputusan berbeda.
- Request tidak mengubah harga, assignment, inventory, capacity, cleaning, order, atau folio otomatis. Cleaning/F&B/service/add-on/maintenance dibuat melalui workflow sumber dan dapat direferensikan.
- Request berbayar memerlukan konfirmasi scope/harga/tax dan source order/charge resmi; request sendiri bukan ledger entry.
- Pre-arrival checklist/dashboard menampilkan target, prioritas, near-due/overdue, dan owner. Data alergi/aksesibilitas/kesehatan menggunakan minimum necessary, access restriction, masking, dan retention.
- Detail lengkap tersedia di [GUEST-REQUESTS-PREFERENCES.md](GUEST-REQUESTS-PREFERENCES.md).

Keputusan kategori Phase 1:

- Kategori publik: Cleaning Request, Extra Guest/Extra Bed, Early Check-in, Late Checkout, Room Preference, Accessibility/Special Need, dan Other Request.
- Front Office menjadi reviewer utama; target respons configurable dan tidak dijanjikan real-time.
- Cleaning Request memuat preferred time, guest-out indicator, serta explicit entry permission; DND fisik yang masih terpasang tetap tidak boleh diabaikan.
- Cleaning hanya menerima linked Cleaning Task dengan informasi minimum. Cleaning/F&B tidak melihat catatan sensitif Guest Request.
- Paid request memerlukan input scope/harga IDR/tax, customer confirmation tercatat, dan source add-on/action sebelum `Accepted`; `Accepted` tetap berbeda dari `Fulfilled`.
- F&B tetap melalui formulir kertas. Tour/service, parking, dan baggage tidak menjadi kategori publik Guest Request Phase 1.

### Do Not Disturb — manual, fitur digital ditunda

- Phase 1 menggunakan tanda fisik DND yang digantung tamu pada pintu; tidak ada entity/status/badge digital tersendiri.
- Cleaning tidak masuk ketika tanda DND ditemukan dan mengubah task menjadi `Deferred` atau `Unable to Access` dengan reason `Physical DND Sign`.
- Catatan tersebut tidak mengubah reservation, stay, occupancy, readiness, inventory, atau folio dan tidak menandai task sebagai selesai.
- Front Office mengoordinasikan izin/jadwal baru secara manual. Request cleaning lama tidak membolehkan staf mengabaikan tanda DND yang masih terpasang.
- Emergency/welfare entry mengikuti SOP dan incident procedure, bukan digital override Phase 1.
- Digital DND/effective window/prolonged alert/clearance/emergency override dapat ditinjau pada Phase 2 bila diperlukan.

### Kontak darurat tamu — ditunda

- Field/workflow emergency contact khusus ditunda ke Phase 2.
- Phase 1 menggunakan booker/guest contact yang sudah ada sebagai jalur utama.
- Jika alternatif benar-benar diperlukan, Front Office menyimpan minimum data sekali pada restricted booking/stay note; tidak disalin ke chat/note lain, shared display, invoice, atau report umum.
- Penggunaan hanya untuk emergency/safety/welfare atau saat tamu tidak dapat dihubungi, bukan marketing. Tidak ada foto KTP dan tidak menjadi guard booking/check-in.
- Emergency contact tidak menggantikan minor/guardian, medical/legal consent, atau incident procedure.
- Phase 2 dapat menambahkan structured field, `Provided/Declined/Not Provided`, primary/additional contacts, purpose notice, access audit, dan retention.

### Minimum age/minor/guardian workflow — ditunda

- Structured minimum-age check, minor/guardian assignment, room linkage, dan exception approval ditunda ke Phase 2.
- Phase 1 tetap mengumpulkan adult/child/infant count dan menerapkan standard/max adult, child, total capacity, extra guest, serta extra-bed guard.
- Sistem Phase 1 tidak menyimpan atau memvalidasi minimum usia Booker/Room Lead Guest, tidak menerapkan adult-per-room guard, dan tidak membuat family/group age exception. Room Lead Guest tetap ada sebagai peran operasional tanpa age verification.
- Jika KOOKA memiliki house rule usia, Front Office menanganinya secara manual di luar sistem; aturan tersebut bukan booking/check-in hard gate.
- Phase 1 tidak meminta exact birth date, KTP anak, kartu keluarga, atau akta lahir secara default.
- Manual exception memakai restricted operational note; emergency contact tidak dianggap sebagai guardian dan capacity limit tidak boleh dioverride.
- Phase 2 dapat menambahkan responsible-adult link, detailed age validation, adjacent-room rule, exception approval/audit, dan guardian acknowledgement.

### Security/damage deposit — ditunda

- Security/damage deposit workflow ditunda ke Phase 2.
- Booking deposit/down payment Phase 1 adalah payment credit terhadap tagihan booking, bukan dana jaminan.
- Phase 1 tidak mempunyai deposit liability balance, damage allocation, automatic deduction, deposit hold/dispute, atau remainder-refund workflow.
- Guest Damage Charge tetap menggunakan incident, Front Office assessment decision, folio debit, payment, serta reversal/refund terpisah.
- Dana jaminan tidak boleh disamarkan sebagai room payment atau generic charge. Aktivasi nanti memerlukan policy dan fitur terstruktur.
- Phase 2 dapat menambahkan segregated deposit record/balance, receipt, authorized allocation, manual remainder refund, hold/dispute, reconciliation, dan audit.

### Booking/stay amendment — Phase 1

- Front Office memproses date move, extension, shortening, early departure, dan partial multi-room amendment; customer tidak mengubah sendiri melalui lookup.
- Lifecycle `Draft/Pending Guest Confirmation/Applied/Rejected/Cancelled` terpisah dari reservation, stay, payment/refund, dan cleaning.
- Apply bersifat atomic/idempotent: lock new inventory before releasing old; failure mempertahankan booking/assignment/folio lama.
- Confirmed booking dilindungi dari extension. Same room, room move/type alternative, atau rejection dipilih berdasarkan availability; price treatment memakai charge/no-change/credit dengan permission.
- Unchanged nights mempertahankan snapshot; new nights memakai current/approved rate; removed nights menggunakan adjustment/credit tanpa edit posted entry.
- Pre-arrival amendment dengan delta debit menunggu tambahan pembayaran verified sebelum apply dan tidak melepas booking lama; in-house extension dapat langsung apply sebagai outstanding folio setelah inventory aman.
- Early departure memisahkan actual checkout, room dirty/cleaning, inventory release, manual policy/fee/credit, dan Refund Record.
- Multi-room menarget booking line/room stay eksplisit dan menyesuaikan guest/add-on/service/cleaning hanya bila dipilih.
- Before/after, delta IDR, guest/payment confirmation, actor/decision maker, policy/rate version, notification/document, dan audit disimpan. Detail ada di [BOOKING-STAY-AMENDMENTS.md](BOOKING-STAY-AMENDMENTS.md).

### House-rules/security incident module — ditunda

- House Rules customer-facing tetap masuk Phase 1 sebagai satu policy set Indonesia/English yang versioned, effective-dated, reviewed/published, dan disnapshot pada booking.
- Online booking mencatat checkbox acknowledgement beserta policy version, language, timestamp, dan channel; checkbox tidak mewajibkan tanda tangan digital. Manual booking/check-in dapat mencatat policy provided/acknowledged/declined serta channel.
- Struktur mencakup check-in/out dan early/late, occupancy/extra guest/bed, smoking, noise, visitor, cleaning/DND/room entry, key, damage, parking, baggage, payment, cancellation/refund, serta no-show/late arrival.
- Nilai belum terverifikasi tidak dipublikasikan sebagai janji. Parking/baggage/manual facility hanya memakai label subject to availability/Front Office confirmation setelah prosesnya disetujui.
- Policy acknowledgement tidak otomatis membuat charge/refund, responsibility, cancellation, eviction, atau perubahan stay/folio.
- Modul violation/warning/escalation/security incident ditunda ke Phase 2.
- Phase 1 memakai house rules, SOP, restricted operational note, dan source workflow seperti Maintenance, Damage Incident, Room Move, Cleaning, folio action, atau emergency procedure.
- Note tidak otomatis menyatakan responsibility, membuat charge, eviction, stay mutation, atau room block; evidence sensitif memakai restricted access.

### Front Office operational handover — ditunda

- Digital non-financial shift handover/checklist/acknowledgement ditunda ke Phase 2.
- Phase 1 memakai SOP/catatan manual dan membaca status dari dashboard/entity sumber; handover bukan source of truth kedua.
- Handover tidak menyalin data sensitif dan tidak mengubah status modul. Financial/cash handover tetap lifecycle terpisah.

### Dokumen keuangan

- Sistem mendukung proforma/instruksi pembayaran, invoice, receipt, dan refund note.
- Dokumen dapat dicetak sebagai PDF dan dikirim melalui email.
- Refund dilakukan manual melalui transfer serta menyimpan approval, processor, referensi, bukti, nilai, dan status.

## Keputusan in-app employee attendance

- Pada 2 Agustus 2026, Owner menambahkan kebutuhan tampilan mobile sederhana untuk absensi karyawan.
- Attendance MVP mendukung check-in/out dengan selfie yang diambil langsung serta validasi titik/geofence yang telah dikonfigurasi.
- Sistem mendukung dua mode: `Scheduled Shift` dengan template/assignment dan `Free Mode` tanpa shift assignment.
- Free Mode tetap menggunakan geofence dan menghasilkan satu session check-in/out; mode bebas bukan izin absen dari lokasi mana saja.
- Waktu server menjadi waktu resmi. Lokasi/geofence dihitung server-side; client tidak dipercaya untuk menentukan role, distance, official time, atau acceptance.
- Selfie disimpan privat, tidak digunakan untuk facial recognition pada MVP, tidak muncul pada export umum, dan aksesnya menggunakan explicit permission serta audit.
- Continuous/background location tracking tidak dilakukan. Lokasi hanya diminta ketika karyawan menjalankan absensi.
- Kamera attendance mengikuti lifecycle privasi mobile: aktif otomatis hanya ketika langkah selfie pertama kali dibuka, berhenti saat pindah tab internal, selfie selesai, atau browser masuk background, dan memerlukan aktivasi eksplisit setelah kembali dari background. Tombol aktifkan, matikan, dan ambil ulang tersedia; label siap hanya boleh tampil untuk stream yang benar-benar hidup.
- Karyawan tidak memiliki form correction request dan tidak melihat shift hari ini. Jika lupa checkout atau ada kesalahan, karyawan meminta langsung kepada admin di luar sistem; admin berizin mengoreksi dengan before/after, reason, actor, dan audit tanpa menghapus event asli.
- Keputusan final adalah satu modular web application dan satu deployment untuk landing/booking, admin operasional termasuk admin attendance, serta route mobile-first/PWA karyawan. Server route handler, identity/session/RBAC, audit, private file-storage adapter, dan database berada dalam aplikasi yang sama; Phase 1 memakai persistent local VPS volume dan tidak ada API service, backend, atau deployment attendance terpisah.
- Attendance diklasifikasikan sebagai `Phase 1B`: scope disetujui tetapi bukan launch gate `Phase 1A Core Lodging MVP`.
- Payroll, full HRIS, advanced workforce scheduling, face recognition, continuous tracking, dan attendance hardware integration tidak termasuk MVP.
- Detail requirement, data model, UI/server route minimum, security, acceptance criteria, serta open configuration berada di [MOBILE-ATTENDANCE.md](MOBILE-ATTENDANCE.md).

## Fase delivery

### Phase 1 — Core lodging MVP

Landing/CMS dasar, Bahasa Indonesia/English, tampilan harga IDR/USD/AUD, lodging booking, pembayaran transfer manual dalam IDR, customer return flow tanpa login, email/WhatsApp manual dan internal alert, booker/guest roles, partial multi-room stay, maximum occupancy dan extra bed, booking/stay amendment, ETA/early check-in/late checkout via Front Office, Guest Request/special preference dasar, flexible Departure Clearance, basic manual F&B paper-order entry untuk standalone/room charge, registrasi check-in opsional melalui kamera/signature pad, admin/RBAC, Live Room Monitor, room board dan room move, maintenance/Out of Order/Damage Charge Catalog, Lost & Found/claim/custody/pickup-shipping/retention, master/configuration governance, basic report/reconciliation, folio/invoice/refund, cleaning, serta greenfield Go-Live/rollback/hypercare.

### Phase 1B — Employee Attendance MVP

Route mobile-first/PWA absensi dengan selfie/geofence, Scheduled Shift/Free Mode, status/riwayat pribadi tanpa tampilan shift hari ini atau form correction request, serta route admin attendance/dashboard/direct correction/export dalam aplikasi utama. Seluruhnya memakai satu build dan deployment dengan shared security/storage/database. Workstream ini dapat berjalan setelah fondasi arsitektur siap dan tidak memblokir go-live Phase 1 lodging.

### Phase 2 — Revenue extension

Group/package/whole house, POS, services/tours, Guest Case/complaint/SLA/service recovery/analytics, house-rules/security incident management, cash point/session dan Front Office financial/operational handover, physical room-key tracking, penitipan bagasi/tag/custody/pickup/overdue-to-Lost-&-Found, Visitor Log/entry-exit/emergency headcount, parking request/capacity/waitlist/arrival-departure, digital DND/effective window/alert/clearance, structured emergency contact/access/retention, minimum-age validation serta minor/guardian/responsible-adult linkage dan exception approval, security/damage deposit balance/allocation/refund/dispute, asset registry/preventive maintenance/vendor cost, Lost & Found barcode/QR dan enhanced storage/shipping, corresponding master data, CSV import/dry-run, CMS lengkap, ADR/RevPAR, serta laporan revenue/operasional yang lebih lengkap.

### Phase 3 — Automation dan integration

WhatsApp API, payment gateway, OTA/channel manager, accounting, secure integration credential/mapping, cross-system reconciliation, inventory integration, smart-lock/key-card integration, serta courier integration hanya bila diperlukan.

## Keputusan arsitektur dan batas setup saat ini

- Aplikasi menggunakan satu modular monolith dan satu deployment pada VPS Hostinger.
- Baseline stack: Next.js 16 App Router, React 19, TypeScript, PostgreSQL 18, Drizzle ORM + `node-postgres`, Better Auth + custom RBAC, Redis/BullMQ, persistent local private storage, Docker Compose, serta reverse proxy.
- Landing/booking, customer lookup, admin, CMS, dan route mobile-first/PWA attendance memakai aplikasi, identity, RBAC, database, audit, storage, dan deployment yang sama.
- Seluruh identitas visual KOOKA pada landing page, alur booking/customer, login/sidebar staf, PWA, serta invoice kamar/combined/F&B memakai satu aset resmi `public/images/kooka-logo-official.png`. Pada permukaan hijau gelap, aset transparan yang sama ditampilkan sebagai wordmark ivory tanpa kotak; invoice, login, dan permukaan terang mempertahankan warna logo asli.
- VPS KVM 2—2 vCPU, 8 GB RAM, 100 GB NVMe, 8 TB bandwidth—diterima sebagai titik awal dengan monitoring, resource limit, backup off-server, dan restore test.
- PostgreSQL logical schema sudah diblueprint. Physical Drizzle definitions dan initial SQL sudah tersedia serta lolos disposable database test; belum pernah dijalankan terhadap production.
- Local storage berarti persistent private VPS volume, bukan browser `localStorage` dan bukan ephemeral container filesystem.
- Canonical application root, exact dependency lock, strict TypeScript, quality/CI baseline, standalone build, environment validation/separation, local PostgreSQL/Redis/Mailpit/private-volume infrastructure, database pool/Drizzle client, migration runner, synthetic seed, dan platform health route sudah tersedia. Authentication, server route handler bisnis, production infrastructure, serta deployment aktual belum dibuat.

## Open configuration sebelum implementasi/go-live

Daftar bernomor lengkap terdapat pada bagian “Open Configuration Register” di [PRD.md](PRD.md). Item dikelompokkan dan diprioritaskan pada [PHASE-1-READINESS-CHECKLIST.md](PHASE-1-READINESS-CHECKLIST.md); tidak seluruhnya menjadi blocker untuk memulai desain.

- Jumlah room type, unit fisik, dan komposisi whole house.
- Booking online wajib lunas 100%; yang masih terbuka adalah role/default/limit deposit manual, remaining-balance due rule, dan maximum Payment Review Hold. Payment deadline awal sudah disepakati 2 jam dengan exception 1 jam untuk same-day/policy khusus.
- Cancellation/no-show production values masih perlu diisi: window/fee/refund wording per channel/rate policy, contact-attempt SOP, release rule, dan customer notification. Tidak ada arrival cutoff otomatis; model versioned policy/manual Front Office decision/no automatic refund sudah disetujui.
- Struktur tarif, pajak/service charge, corporate/OTA/long-stay/seasonal rate, serta jam/ketersediaan pemesanan F&B.
- Approval limit untuk discount, complimentary, void, dan refund.
- Identitas legal invoice, provider/domain email, reply-to, serta kebijakan penyimpanan data.
- Purpose/consent text Indonesia/English, named production permission per action, serta duration/event/hold/purge/backup-expiry untuk foto KTP/identitas, foto tamu, dan tanda tangan; sifat opsional serta akses Owner/Front-Office-only sudah diputuskan.
- House Rules full text/summary/checkbox/manual-acknowledgement copy Indonesia/English serta nilai produksi smoking, noise, visitor, occupancy/extra bed, DND/room entry, key, damage, parking, baggage, cancellation/refund, dan no-show; model version/snapshot/acknowledgement sudah diputuskan.
- Sumber kurs, jadwal pembaruan, batas kurs kedaluwarsa, aturan pembulatan, dan default bahasa.
- Kebutuhan KDS/printer dapur, resource scheduling services, upload bukti di website, dan proteksi booking lookup.
- Nama fitur Pantauan Kamar, visibilitas nama untuk Cleaning/shared display, stale threshold, serta definisi maintenance exclusion.
- Data rekening produksi/default selection, minimum notice dan batch-reissue permission, master-data go-live sign-off, legal/document profile serta prefix/sequence format, dan room-number change timing.
- Target greenfield cutover, Opening Booking/block yang overlap, Go/No-Go owner, incident disable permission, Offline Operations Log, dan hypercare window.
- Maintenance SLA/verifier, Damage Charge Catalog price/tax/evidence/optional alert threshold, serta guest dispute/outstanding policy.
- Trigger/kebijakan aktivasi security deposit Phase 2, nominal/metode, balance/allocation, remainder refund, dispute/hold, approval, dan reconciliation.
- Amendment payment-hold deadline, rate treatment, early-departure policy/inventory release, required confirmation evidence, partial multi-room authority, serta revised document/notification; payment-before-apply/outstanding principle sudah diputuskan.
- Trigger/scope Phase 2 untuk house-rules/security incident module dan digital Front Office operational handover.
- Lost & Found retention per kategori, high-value threshold, storage/seal/dual-custody, claim/disposition approver, representative pickup, kurir/asuransi/biaya, authority transfer, dan disposal notice.
- Trigger aktivasi Guest Case Phase 2, classification/severity, SLA/escalation owner, dan compensation approval threshold.
- Cash point yang digunakan, opening float, SOP serah-terima manual Phase 1, variance threshold/approver, serta scope cash session Phase 2.
- Jenis kunci/hardware, jumlah salinan, SOP issue/return/master key Phase 1, serta trigger key-tracking Phase 2.
- Jam standar check-in/out telah diputuskan `14:00`/`12:00` sebagai acuan, bukan cutoff. Early/late arrival dan late checkout memakai keputusan Flexible Front Office tanpa earliest/latest global; turnover buffer, aturan extension ke malam berikutnya, add-on price/tax, dan apakah form publik hanya ETA atau menerima request masih perlu diisi sebelum UAT.
- Nomor/field formulir F&B, processed marking, retention/pemusnahan, dan kebijakan printed-price mismatch.
- Default/risk-based Departure Clearance, target/checker, skip/outstanding permission, checklist, serta retention evidence.
- Kebijakan menerima titipan bagasi, batas waktu, barang terlarang/high-value, format tag/log dan verifikasi pickup Phase 1, serta trigger alih ke Lost & Found.
- Kebijakan visitor, jam/area/jumlah, data minimum dan retention log manual, host confirmation/emergency headcount, serta trigger menjadi Additional Guest.
- Kapasitas/kebijakan parkir, apakah dapat dijamin, harga/tax bila berbayar, kebutuhan/retention nomor polisi, proses konfirmasi/overflow, dan trigger modul Phase 2.
- Label/copy Guest Request id/en, response/overdue target produksi, named permission, sensitive-field retention, serta channel/evidence konfirmasi paid request; kategori, owner utama, dan lifecycle sudah diputuskan.
- SOP tanda fisik DND, follow-up/reschedule Cleaning, emergency/welfare entry authority, dan trigger kebutuhan digital DND Phase 2.
- Kapan emergency contact tambahan diperlukan, field/target minimum, role/purpose/retention, serta batasnya terhadap minor/guardian dan incident procedure.
- Jika diprioritaskan kembali pada Phase 2: minimum Booker/Room Lead Guest age, adult-per-room rule, family/group exception, serta minimum evidence tanpa excessive child-document collection.
- Minimum browser/perangkat attendance, PWA enablement, titik/radius/accuracy geofence, selfie check-in/out policy, shift template/window/tolerance, Free Mode eligibility/max duration, direct-admin correction permission, retention selfie/lokasi, device policy, dan support contact.

## Next handoff

Technical Batch 1–6 (Langkah 9–21), Langkah 22A Staff UI Foundation, dan technical hardening Langkah 22B sudah ditulis dengan status `IMPLEMENTED — UNVERIFIED`; authentication/RBAC/shared platform Langkah 6–8 sudah `DONE`. Hardening 22B menghasilkan same-origin staff mutation guard, security headers, authorization matrix seluruh staff API, upload dimension/metadata sanitization, retention dry-run fail-closed, audit URL/header redaction, concurrency/idempotency database gates, stable email Message-ID, PDF/email retry recovery, performance baseline, dan localhost-only recovery rehearsal. Automated test dengan coverage threshold, format, zero-warning lint, strict type-check, schema/build/security checks, disposable PostgreSQL verification sampai `0012`, local performance 0% failure dengan p95 di bawah 750 ms, dan database dump/restore rehearsal telah lulus. Migration `0000`–`0013` sudah diterapkan ke database development lokal. Migration `0013` menetapkan OWNER sebagai Super Admin property dengan seluruh named permission terpasang melalui mapping RBAC, tanpa authorization bypass; menu operasional yang sudah memiliki UI telah diverifikasi langsung. Keputusan 2 Agustus 2026 menetapkan login email/password biasa tanpa MFA untuk seluruh role; plugin, MFA gate, dan halaman enrollment telah dihapus, sedangkan tabel migration lama dipertahankan sebagai kompatibilitas. AV engine, full CSP, private-storage restore, form/action UI lanjutan, browser/device/accessibility evidence, final nilai produksi, serta UAT Owner/staf tetap tertunda. Roadmap berikutnya adalah Langkah 23—UAT preparation dan execution. Production migration tetap hanya dijalankan setelah environment, backup/restore, configuration P0, dry-run, dan deployment checklist disetujui.

## 4 Agustus 2026 — Checkout parsial booking multi-room

- Checkout diproses per kamar/reservation room, bukan langsung menutup seluruh booking.
- Setelah satu kamar selesai checkout, assignment fisiknya dilepas dan line kamar berubah menjadi `COMPLETED`; kamar lain dalam booking yang sama tetap aktif.
- Line kamar yang sudah selesai tidak boleh kembali muncul sebagai `Belum dialokasikan` pada meja operasional. Riwayatnya tetap tersimpan untuk audit, sedangkan daftar check-in/kamar hanya menampilkan line yang masih aktif.
- Booking dan tagihan utama baru ditutup setelah seluruh line kamar selesai checkout dan saldo tagihan booking sudah nol.

## 4 Agustus 2026 — Rekening transfer berlaku global

- Rekening bank merupakan konfigurasi properti KOOKA, bukan bagian dari jenis kamar atau harga kamar.
- Seluruh rekening yang aktif ditampilkan kepada setiap tamu setelah booking online; tamu bebas memilih salah satunya untuk transfer.
- Reservation menyimpan daftar versi rekening yang ditawarkan saat booking dibuat. Perubahan atau penonaktifan master rekening tidak mengubah instruksi historis booking yang sudah ada.
- Front Office memilih rekening penerima ketika mencatat pembayaran transfer agar tujuan dana dapat diaudit.
- Booking online hanya memerlukan minimal satu rekening properti aktif. Rate plan tidak lagi menyimpan pilihan rekening tertentu.

## 3 Agustus 2026 — Pagination riwayat operasional

- Daftar yang terus bertambah memakai pagination server-side: booking dan pembayaran 20 baris (opsi 20/50/100), F&B 10 baris (opsi 10/20/50), attendance 25 baris (opsi 25/50/100), serta audit 50 baris (opsi 50/100).
- Setiap daftar menampilkan rentang seperti `1–20 dari 247 data`, pencarian/filter yang kembali ke halaman pertama, nomor halaman, dan tombol sebelumnya/berikutnya. Urutan default adalah data terbaru lebih dahulu.
- Antrean operasional yang membutuhkan tindakan tetap dipisahkan dari riwayat. Booking aktif, pembayaran menunggu verifikasi, dan pesanan F&B belum selesai tetap tersedia untuk form dan metrik walaupun riwayat sedang berada di halaman lain.
- Ekspor Excel attendance selalu mengambil seluruh hasil filter rentang tanggal dan pencarian, bukan hanya baris pada halaman aktif.
- Detail F&B tertutup secara default agar daftar panjang mudah dipindai. Live Room Monitor dan jadwal housekeeping hari ini tidak memakai pagination karena merupakan papan kondisi operasional saat ini, bukan riwayat transaksi.

## 4 Agustus 2026 — Email customer dibatasi menjadi tiga jenis

- Email customer Phase 1 hanya dikirim ketika bukti pembayaran dicatat, ketika pembayaran terverifikasi dan booking pertama kali memenuhi ambang konfirmasi, serta ketika Front Office menerbitkan dokumen invoice/tagihan untuk dikirim.
- Booking baru, instruksi transfer, reminder deadline, pembayaran rejected/voided/partial, cancellation, dan expiry tidak mengirim email. Informasi tersebut tetap tersedia pada halaman `Cek Booking`, antarmuka staf, audit log, dan WhatsApp manual.
- Email bukti pembayaran dan konfirmasi memakai template HTML KOOKA yang profesional, responsif, bilingual, menonjolkan status dan kode booking, serta menyediakan link kembali ke halaman booking. Plain-text fallback tetap disimpan.
- Email konfirmasi memakai idempotency key per reservation dan hanya dibuat saat ambang pembayaran wajib pertama kali terpenuhi agar pelunasan/tambahan pembayaran berikutnya tidak mengirim konfirmasi berulang.
- Email dokumen memakai tampilan branded dan tetap melampirkan PDF. Reset password staf tetap dipertahankan sebagai komunikasi keamanan akun internal, bukan email customer booking.

## 4 Agustus 2026 — Cleaning kamar terisi atas permintaan tamu

- Menu Housekeeping menyediakan bagian `Permintaan tamu untuk membersihkan kamar` untuk kamar yang masih dihuni.
- Permintaan manual dibuat sebagai `GUEST_REQUEST` dengan izin masuk `GRANTED`; catatan dapat menjelaskan bahwa tamu sedang pergi atau permintaan khusus lainnya.
- Tombol pekerjaan memakai lifecycle cleaning task `Requested → In Progress → Cleaned → Inspected`, bukan aksi cepat kesiapan kamar kosong.
- Aksi cepat pada Pantauan Kamar tetap khusus kamar vacant. Occupancy kamar tidak berubah ketika tugas pembersihan stayover/permintaan tamu dimulai atau diselesaikan.
