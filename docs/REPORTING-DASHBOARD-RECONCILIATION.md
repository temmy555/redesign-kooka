# Dashboard, Live Room Monitor, Reporting, dan Reconciliation — KOOKA Residence

| Informasi | Nilai |
|---|---|
| Versi | 1.0 Draft |
| Tanggal | 1 Agustus 2026 |
| Scope | Phase 1 operational visibility; Phase 2 reporting; Phase 3 cross-system reconciliation |
| Sumber kebutuhan | [PRD.md](PRD.md) |

## 1. Tujuan

Dokumen ini mengatur tampilan operasional, definisi metric, laporan, export, dan rekonsiliasi. Tujuannya adalah memberi tim satu gambaran kondisi properti tanpa mencampur occupancy, inventory, cleaning, payment, atau revenue menjadi status/angka yang ambigu.

## 2. Pemisahan kebutuhan

- **Dashboard operasional:** apa yang membutuhkan perhatian sekarang.
- **Live Room Monitor:** keadaan setiap kamar fisik pada satu halaman.
- **Laporan:** agregasi historis atau forecast berdasarkan definisi dan dimensi tanggal yang eksplisit.
- **Reconciliation:** pemeriksaan bahwa entity dan ledger yang saling berhubungan tetap konsisten.
- **Accounting integration:** pencatatan akuntansi resmi pada Phase 3; laporan operasional tidak boleh diklaim sebagai general ledger.

## 3. Live Room Monitor

### 3.1 Tujuan dan layout

`Live Room Monitor` atau `Room Status Board` wajib tersedia pada Phase 1 sebagai satu halaman berisi seluruh unit fisik. Karena jumlah kamar terbatas, tampilan utama menggunakan grid kartu tanpa pagination dan diurutkan berdasarkan `room_unit.sort_order`/nomor kamar.

Contoh ringkas:

```text
Kamar 1 · Deluxe
Occupied · In House
Rina P. +1 guest
Checkout 2 Agu · 12:00
Stayover Cleaning Requested

Kamar 2 · Executive
Vacant · Dirty
Cleaning In Progress
Next arrival 14:00 · Andi S.

Kamar 3 · Deluxe
Vacant · Inspected · Ready
Next arrival tomorrow

Kamar 4 · Family
Blocked · Maintenance
AC repair · until 3 Aug 16:00
```

### 3.2 Informasi setiap kartu kamar

Setiap kartu minimal menampilkan:

- Nomor kamar sebagai identitas utama.
- Room type sebagai atribut terpisah; nomor kamar tidak menyiratkan jenis kamar.
- Occupancy: `Vacant` atau `Occupied`.
- Stay indicator: `Due In`, `In House`, `Due Out`, `Late Checkout`, atau `Possible No Show` bila relevan.
- ETA, approved early-check-in time, late-checkout-until, Operational Occupancy Block, target ready time, dan timing conflict bila relevan.
- Nama `Room Lead Guest` yang sedang menghuni dan jumlah additional guest, sesuai hak akses.
- Actual/scheduled check-in dan checkout.
- Housekeeping condition: `Dirty`, `Cleaning`, `Cleaned`, atau `Inspected`.
- Serviceability: `In Service`, `Blocked`, `Out of Order`, atau maintenance aktif.
- Guest-requested cleaning, `Do Not Disturb`, `Unable to Access`, atau cleaning exception bila ada.
- Kedatangan berikutnya dan target ready time, terutama untuk same-day turnover.
- Alert konflik, outstanding action, atau status data stale.

Reservation, stay, occupancy, housekeeping, serviceability, cleaning task, dan payment tidak digabung menjadi satu warna/status. Kartu menampilkan badge terpisah agar `Occupied + Cleaning Requested` atau `Vacant + Dirty + Next Arrival` dapat dipahami dengan benar.

### 3.3 Sumber nama tamu

- Nama penghuni berasal dari active room/stay guest allocation, bukan otomatis dari booker.
- Nama utama adalah `Room Lead Guest`; jika terdapat tamu tambahan, tampilkan `+N guest` tanpa memenuhi kartu dengan seluruh nama.
- Setelah room move efektif, nama berpindah ke unit baru dalam transaksi yang sama dan tidak lagi tampil sebagai penghuni unit lama.
- Booking yang belum check-in tidak ditampilkan sebagai penghuni. Nama dapat muncul terpisah sebagai `Next Arrival` jika unit sudah dialokasikan.
- Unit tanpa active assignment tidak boleh menampilkan nama hanya karena booking memiliki room type yang sama.

### 3.4 Privasi dan RBAC

- Owner/Super Admin dan Front Office dapat melihat nama Room Lead Guest sesuai kebutuhan operasional.
- Cleaning secara default melihat nomor kamar, occupancy, cleaning instruction, jumlah tamu yang relevan, dan nama yang dimasking/initial bila identitas tidak diperlukan.
- F&B tidak memperoleh akses ke seluruh monitor kecuali diberikan permission operasional; pencarian room charge tetap memakai flow verifikasi tersendiri.
- `Shared Display/TV Mode` menyembunyikan atau memasking nama tamu, booking code, saldo, nomor telepon, serta informasi sensitif.
- Monitor tidak pernah menampilkan KTP, signature, guest photo, kontak, rekening, bukti pembayaran, internal financial notes, atau nilai folio penuh.
- Permission melihat unmasked guest name dan financial alert diverifikasi server-side serta dapat diaudit sesuai kebijakan akses.

### 3.5 Interaksi

- Filter: nomor/room type, occupancy, stay indicator, housekeeping, block/maintenance, arrival/departure, serta alert.
- Search dapat memakai nomor kamar dan nama tamu hanya bagi role yang diizinkan.
- Klik kartu membuka detail/drawer yang sesuai role.
- Quick action dapat menyediakan `Assign Room`, `Check In`, `Request/Start Cleaning`, `Inspect`, `Move Room`, `Check Out`, atau `Create Maintenance Issue`.
- Quick action tetap memanggil business action dan guard resmi; monitor bukan generic status editor.
- Tersedia display mode berukuran besar untuk tablet/monitor operasional dan compact mode untuk desktop.
- Label, icon, dan teks tetap digunakan; warna tidak menjadi satu-satunya pembeda status.

### 3.6 Near-real-time dan data freshness

- Perubahan check-in/out, room move, cleaning, assignment, maintenance, dan block memperbarui monitor tanpa refresh manual.
- Implementasi dapat memakai server event/websocket dengan fallback polling 15–30 detik; kompleksitas final dipilih saat arsitektur teknis.
- Halaman selalu menampilkan `Last updated` dan status koneksi.
- Ketika koneksi putus atau data melewati stale threshold, monitor menampilkan peringatan jelas dan tidak mengesankan bahwa data masih live.
- Reconnect/refetch tidak boleh menjalankan ulang business action atau menggandakan task.

## 4. Dashboard operasional berbasis role

### 4.1 Owner/Super Admin dan Front Office

- Arrivals, departures, In House, dan Possible No Show.
- Unassigned room dan room-readiness risk.
- Same-day turnover dan late checkout conflict.
- Early/late request pending, approved timing, next guest waiting/near arrival, dan insufficient-turnover alert.
- Departure Clearance not started/in progress/issue found/over-target/skipped, terpisah dari folio dan damage exception.
- Payment `Pending Verification`, payment deadline, outstanding balance menjelang checkout, dan refund queue.
- Dirty/cleaning/inspection/maintenance/block.
- Inventory conflict dan reconciliation exception.
- Tautan langsung ke Live Room Monitor.

### 4.2 Cleaning

- Task hari ini dan overdue.
- Prioritas berdasarkan target ready time/next arrival.
- `Requested`, `Assigned`, `In Progress`, `Cleaned`, `Inspected`, serta exception.
- Guest-requested stayover cleaning dan permission-to-enter.

### 4.3 F&B — Phase 2

- Open order dan antrean fulfillment.
- Room-charge pending/failed.
- Standalone settlement dan cash shift exception.
- Stock/item availability bila inventory F&B kelak diaktifkan.

## 5. Dimensi tanggal dan waktu

Setiap laporan menyatakan date dimension yang digunakan:

- `booking_created_at`: waktu reservasi dibuat.
- `stay_date`: malam menginap.
- `service_date`: tanggal kamar/service/POS dikonsumsi.
- `business_date`: tanggal operasional hotel.
- `posted_at`: waktu ledger entry diposting.
- `payment_received_at` dan `payment_verified_at`.
- `refund_completed_at`.
- `document_issued_at`.

Satu filter `Tanggal` generik tidak boleh diam-diam digunakan untuk semua laporan. UI menampilkan timezone Asia/Jakarta, `generated_at`, filter, dan data-as-of.

## 6. Definisi inventory dan occupancy

- `Physical Room Nights`: seluruh unit fisik × malam pada periode.
- `Out-of-Order/Blocked Room Nights`: unit yang tidak dapat dijual karena maintenance/block yang memenuhi policy exclusion.
- `Sellable Room Nights`: physical room nights dikurangi valid out-of-order/blocked room nights.
- `Actual Occupied Room Nights`: unit yang benar-benar `In House/Occupied` pada stay date, termasuk complimentary/internal-use yang benar-benar ditempati.
- `Paid Occupied Room Nights`: occupied room nights yang memiliki room charge non-zero setelah valid adjustment.
- `Confirmed Room Nights`: commitment confirmed untuk periode mendatang.
- `Held Room Nights`: checkout/payment/tentative hold aktif; dilaporkan terpisah dari confirmed.

Metric awal:

- `Actual Occupancy % = Actual Occupied Room Nights / Sellable Room Nights`.
- `Forecast Occupancy % = Confirmed Room Nights / Sellable Room Nights`.
- Held inventory ditampilkan sebagai angka/rasio terpisah dan tidak menaikkan forecast confirmed.
- Complimentary/internal-use yang benar-benar dihuni masuk actual occupancy, tetapi ditampilkan terpisah dari paid nights.

Maintenance/block hanya dikeluarkan dari denominator jika memiliki periode, alasan, actor, dan status valid. Mengubah kamar menjadi blocked tidak boleh menjadi cara menaikkan occupancy secara manipulatif; laporan menyediakan gross physical capacity dan excluded room nights untuk audit.

## 7. Definisi rate dan revenue operasional

- `Net Room Revenue`: posted room charge setelah room discount/credit yang terkait, sebelum tax/service charge; tidak termasuk POS, tour, service, extra bed, payment, deposit, refund transfer, atau cancellation fee.
- `ADR = Net Room Revenue / Paid Occupied Room Nights`.
- `RevPAR = Net Room Revenue / Sellable Room Nights`.
- Complimentary room tidak masuk denominator ADR, tetapi jumlah dan nilainya dilaporkan terpisah.
- Cancellation/no-show fee, extra bed, F&B, tour, dan service memiliki kategori revenue operasional tersendiri.
- Tax dan service charge dilaporkan terpisah berdasarkan versioned posting snapshot.
- Semua agregasi resmi memakai IDR. USD/AUD hanya preferensi tampilan customer dan tidak menjadi basis report.

Istilah `Revenue Operasional` tidak diklaim sebagai accounting revenue recognition sebelum kebijakan akuntansi dan integrasi accounting Phase 3 ditetapkan.

## 8. Laporan minimum

### Phase 1

- Booking by created date, stay date, channel/source, room type, dan reservation status.
- Actual/forecast occupancy, confirmed, held, sellable, blocked, dan physical room nights.
- Room charge, discount/credit, tax/service charge, complimentary, cancellation/no-show fee.
- Verified payment by received/verified date dan method.
- Refund by lifecycle/completed date.
- Outstanding balance dan aging as-of date.
- Payment verification log.
- Cleaning task performance dan room turnaround time.
- Departure Clearance outcome/wait time/skip reason serta linked issue, tanpa menganggap issue sebagai guest responsibility.
- Unassigned room, room move, maintenance/block, dan operational exception.
- Maintenance response/resolution/downtime/internal cost serta damage assessment/posted/paid/outstanding/waived/disputed/reversed dalam kategori terpisah.
- Lost & Found item/inquiry/claim, time-to-secure, custody exception, pickup/shipment outcome, retention/disposition, dan biaya pengiriman dalam kategori terpisah dari room revenue.
- Early check-in/late checkout request/approval/rejection, add-on/waiver amount, operational block duration, serta same-day turnover impact.

### Phase 2

- ADR, RevPAR, source/channel performance, length of stay, lead time, cancellation, dan no-show trend.
- POS sales, item/category performance, shift/settlement variance.
- Manual Paper Order volume, duplicate/price-mismatch exception, standalone versus room-charge route, serta operator input.
- Service/tour fulfillment, utilization, sales, void, dan refund.
- Group/package/Whole House pickup, conversion, component allocation, dan revenue breakdown.

### Phase 3

- Accounting export/integration reconciliation.
- OTA/channel manager reconciliation.
- Payment gateway settlement/fee reconciliation.
- Cross-system discrepancy monitoring.

## 9. Financial report boundaries

Laporan berikut tidak boleh digabung menjadi satu angka uang masuk/revenue:

- Charge/operational revenue berdasarkan service/stay date.
- Verified cash/payment berdasarkan received/verified date dan method.
- Refund berdasarkan completed date.
- Outstanding/credit balance berdasarkan snapshot as-of.
- Invoice/document issuance berdasarkan issued date.

Folio charge bukan bukti uang sudah diterima. Payment/deposit juga bukan room revenue pada tanggal yang sama. Correction memakai reversal/new posting dan histori lama tetap dapat direproduksi.

## 10. Reconciliation

### Phase 1 consistency checks

- Booking line/commitment sesuai dengan room-type inventory per malam.
- Tidak ada active room assignment overlap pada unit yang sama.
- Active assignment/stay/room occupancy konsisten.
- Checkout menghasilkan `Vacant + Dirty` dan cleaning task yang tepat.
- Cleared maupun skipped Departure Clearance mengarah ke tepat satu checkout/turnover side effect; issue reference tidak membuat damage charge ganda.
- Folio debit, credit, dan derived balance konsisten.
- Satu folio entry tidak tercakup dua active final invoice.
- Verified payment memiliki posting dan allocation yang valid.
- Refund tidak melebihi refundable verified payment/credit yang disetujui.
- Posted room move/POS/service source reference tidak ganda.
- Paper/intake reference tidak menghasilkan lebih dari satu active source order; price override mempunyai reason/approval dan room charge mempunyai valid active-stay reference.
- Approved damage assessment mempunyai maksimal satu active source posting; maintenance internal cost tidak berubah menjadi customer charge otomatis.
- Block/maintenance tidak diam-diam menimpa confirmed commitment.
- Lost & Found hanya memiliki satu verified owner aktif per item; released outcome mempunyai custody/handover/disposition reference dan shipment failed/returned tidak dianggap delivered.
- Approved late checkout tidak overlap secara operasional dengan next assigned arrival/target-ready guard dan add-on source tidak diposting dua kali.

Ketidaksesuaian membuat `Reconciliation Exception` dengan severity, entity references, detected-at, owner, status, notes, dan resolution reference. Job tidak memperbaiki ledger/inventory sensitif secara diam-diam. Koreksi dilakukan melalui action resmi, permission, alasan, reversal/adjustment bila finansial, serta audit.

Status exception: `Open`, `Acknowledged`, `Investigating`, `Resolved`, atau `Accepted with Reason`. Retry detection bersifat idempotent dan tidak menggandakan exception aktif yang sama.

## 11. Filter, export, dan reproducibility

- Filter minimal: date range/dimension, business date, room type/unit, channel/source, reservation/stay/payment status, payer, dan category.
- Export Phase 1 menggunakan CSV; PDF hanya untuk dokumen yang membutuhkan layout resmi.
- Setiap export menyimpan generated-at, actor, filters, timezone, metric version, dan data-as-of.
- Permission report dan export dipisahkan; field sensitif dimasking atau dikeluarkan berdasarkan role.
- Export data customer/financial dicatat pada audit log dan menggunakan secure short-lived download.
- Report historis menggunakan immutable posting serta versioned metric definition agar dapat dijelaskan setelah konfigurasi berubah.
- Late posting dapat muncul menurut service date dan posting date; kedua dimensi harus dapat ditelusuri.

## 12. Minimum acceptance tests

- Seluruh unit fisik muncul tepat sekali pada Live Room Monitor dan berurutan berdasarkan nomor/sort order.
- Kamar occupied menampilkan active Room Lead Guest yang benar, bukan booker atau tamu booking lain.
- Booking unassigned tidak menampilkan nama pada unit sembarang.
- Room move efektif memindahkan nama/status ke unit baru dan membuat unit lama vacant/dirty tanpa tampilan ganda.
- Checkout, cleaning, inspection, maintenance, dan block memperbarui monitor tanpa refresh manual atau menunjukkan warning bila koneksi stale.
- Shared Display Mode memasking nama dan menyembunyikan financial/sensitive data.
- Cleaning tidak dapat mengambil full guest identity melalui monitor tanpa permission.
- Warna bukan satu-satunya cara membedakan status.
- Held booking tidak dihitung sebagai confirmed forecast occupancy.
- Complimentary occupied room masuk actual occupancy tetapi tidak masuk paid ADR denominator.
- Valid maintenance exclusion mengurangi sellable room nights dan tetap terlihat pada gross/exclusion report.
- Room, ancillary, payment, refund, dan outstanding report menghasilkan angka terpisah dalam IDR.
- Duplicate invoice coverage, posting, assignment overlap, atau refund invalid menghasilkan reconciliation exception.
- Reconciliation rerun tidak menggandakan exception dan tidak mengubah ledger secara otomatis.
- Export menyimpan actor, filters, timezone, metric version, dan masking sesuai permission.
- Lost & Found dashboard/report tidak mengekspos secret claim attribute, alamat, storage detail, atau private evidence kepada role/export yang tidak berizin.
- Approved timing tampil dengan waktu yang benar; late-checkout operational block dan cleaning target hilang/selesai hanya melalui action sumber yang valid.

## 13. Keputusan yang perlu dikonfigurasi sebelum implementasi

- Nama produk final: `Live Room Monitor`, `Room Status Board`, atau label Indonesia `Pantauan Kamar`.
- Stale threshold, refresh fallback, dan perangkat shared display yang digunakan.
- Apakah Cleaning melihat initial/nama singkat atau hanya `Occupied`.
- Jenis block yang valid untuk dikeluarkan dari sellable-room denominator.
- Batas nominal/aging bucket dan jadwal distribusi report.
- Metric/version approval owner dan accounting mapping pada Phase 3.
- Lost & Found high-value threshold, retention/disposition report scope, serta siapa yang boleh melihat/export detail custody.
