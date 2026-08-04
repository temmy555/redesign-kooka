# Availability dan Inventory Locking — KOOKA Residence

| Informasi        | Nilai                                                     |
| ---------------- | --------------------------------------------------------- |
| Versi            | 1.10 Draft                                                |
| Tanggal          | 1 Agustus 2026                                            |
| Scope            | Phase 1 core lodging; fondasi Phase 2 whole house/package |
| Sumber kebutuhan | [PRD.md](PRD.md)                                          |

## 1. Tujuan

Dokumen ini menjadi sumber aturan perhitungan availability, inventory hold, room assignment, room block, concurrency, dan pencegahan double booking.

Prinsip utamanya:

- Inventory berasal dari room unit fisik.
- Customer membeli room type dan quantity.
- Nomor kamar dapat dialokasikan kemudian.
- Search result adalah snapshot; booking hanya berhasil setelah final availability check transaksional.
- Hard overbooking tidak diizinkan, termasuk untuk Super Admin.

## 2. Room type dan room unit

### 2.1 Room type

Room type adalah kategori yang dilihat dan dipesan customer, misalnya `Deluxe`, `Executive`, atau `Family`.

Data minimal:

- Internal ID.
- Kode type unik.
- Nama/deskripsi Bahasa Indonesia dan English.
- Kapasitas, bed configuration, amenities, dan restriction.
- Status aktif.
- Rate plan dan media terkait.
- Standard/max adult, child, dan total occupancy.
- Extra-bed allowed, maximum extra beds, capacity increment, dan resource-tracking rule.

### 2.2 Room unit

Room unit adalah kamar fisik. KOOKA menggunakan nomor sederhana dan berurutan tanpa menyandikan jenis kamar pada nomornya.

Contoh:

| Nomor kamar | Room type |
| ----------- | --------- |
| `1`         | Deluxe    |
| `2`         | Executive |
| `3`         | Deluxe    |
| `4`         | Family    |

Data minimal:

- `internal_id`: identifier stabil yang tidak terlihat customer.
- `room_number`: label unik dalam properti, disimpan sebagai string walaupun saat ini direncanakan berupa angka sederhana.
- `sort_order`: urutan tampilan operasional.
- `room_type_id`: relasi ke jenis kamar, tidak disimpulkan dari nomor kamar.
- Floor/area opsional.
- Status aktif/nonaktif.
- Occupancy, housekeeping condition, dan serviceability yang terpisah.

Nomor kamar bukan database primary key. Perubahan nomor atau room type tidak boleh merusak histori. Perubahan room type hanya dapat dilakukan pengguna berizin, memiliki effective date, memeriksa booking mendatang, dan meninggalkan audit log.

Per 1 Agustus 2026, jumlah kamar diperkirakan sekitar **15 unit**, tetapi belum diverifikasi. Angka tersebut hanya input perencanaan dan tidak boleh menjadi batas sistem atau production inventory. Nomor final, room type setiap unit, capacity, amenity, extra-bed eligibility, serta serviceability awal wajib dikonfirmasi sebelum inventory produksi diaktifkan. Dengan estimasi tersebut, istilah yang digunakan adalah nomor kamar **sederhana dan berurutan** seperti `1`–`15`, bukan batas teknis satu digit.

## 3. Booking inventory dan room assignment

Customer memesan room type, quantity, serta tanggal. Contoh:

```text
Deluxe × 2
Check-in: 10 Agustus
Checkout: 12 Agustus
```

Booking langsung mengonsumsi dua inventory Deluxe meskipun belum dialokasikan ke Kamar 1 atau Kamar 3.

Room assignment memetakan booking line ke unit fisik:

```text
Booking line Deluxe #1 → Kamar 1
Booking line Deluxe #2 → Kamar 3
```

Aturan:

- Assignment tidak mengonsumsi inventory kedua kali.
- Booking dapat tetap unassigned sampai mendekati check-in.
- Check-in normal wajib memiliki assignment unit aktif.
- Booking multi-room memiliki satu assignment per kamar yang digunakan.
- Customer tidak dijanjikan nomor kamar saat booking; nomor dapat diberikan setelah assignment final.
- Room board menampilkan kamar per nomor dan menyediakan queue booking yang belum dialokasikan.

## 4. Periode inventory

Gunakan interval `[check-in, checkout)`. Booking 10–12 Agustus mengonsumsi malam 10 dan 11 Agustus, tetapi tidak mengonsumsi malam 12 Agustus.

Dengan demikian, checkout dan check-in pada tanggal yang sama tidak dianggap overlap. Early check-in, late checkout, dan day-use memerlukan aturan operasional tambahan dan tidak mengubah prinsip inventory per malam tanpa konfigurasi khusus.

### 4.1 Same-day turnover

Contoh: Tamu A menempati Kamar 1 Deluxe pada 1–2 Agustus dan Tamu B memesan Deluxe pada 2–3 Agustus. Booking Tamu B valid karena kedua stay tidak memakai malam yang sama, meskipun Kamar 1 adalah satu-satunya unit Deluxe yang dapat memenuhi kedatangan tersebut.

Availability dan readiness harus dibedakan:

- Deluxe dapat dijual untuk malam 2 Agustus.
- Nomor kamar Tamu B boleh tetap unassigned sampai room planning diselesaikan.
- Kamar 1 baru dapat dipakai check-in setelah Tamu A benar-benar checkout dan unit memenuhi `Ready for Check-in`.
- Sistem membuat/menandai task `Same-day Turnover` berprioritas tinggi serta menampilkan arrival time dan target ready time kepada Front Office dan Housekeeping.
- Keterlambatan checkout atau cleaning menghasilkan operational alert, tetapi tidak menghapus booking confirmed atau mengubah inventory secara diam-diam.

### 4.2 Early check-in dan late checkout

- ETA atau request customer tidak menjadi inventory commitment maupun approval.
- Early check-in hanya dapat disetujui Front Office setelah unit assigned, previous stay checkout, dan `Ready for Check-in`.
- Late checkout intraday membuat `Operational Occupancy Block` pada room unit sampai approved time; block ini menjaga konflik waktu/turnover tetapi tidak mengonsumsi room night kedua.
- Next confirmed arrival, guest waiting/near arrival, insufficient cleaning/inspection buffer, atau full room type/property tanpa alternatif valid membuat late checkout ditolak.
- Crossing configured overnight threshold wajib memakai extension workflow dan inventory locking per malam.
- Confirmed booking mendatang tidak dilepas/dipindahkan otomatis untuk memenuhi request.
- Detail tersedia di [EARLY-CHECKIN-LATE-CHECKOUT.md](EARLY-CHECKIN-LATE-CHECKOUT.md).

## 5. Formula availability

Untuk setiap room type dan stay date:

```text
Available Quantity =
Active Physical Units
- Active Unit Blocks / Out of Order
- Confirmed Booking Commitments
- Active Hold Commitments
```

Aturan tambahan:

- Kondisi `Dirty` tidak otomatis mengurangi availability untuk tanggal mendatang, tetapi unit belum ready untuk check-in.
- Booking confirmed yang belum memiliki nomor kamar tetap mengurangi room-type availability.
- Room assignment tidak mengurangi availability lagi.
- Kapasitas tamu dan restriction diperiksa selain quantity availability.
- Search dapat menggunakan cache/read model, tetapi final write selalu menggunakan database source of truth.

### 5.1 Extra-bed resource availability

Extra bed adalah accommodation add-on/resource, bukan room type dan bukan generic service. Bila stok fisiknya terbatas, availability dihitung dari shared resource pool dikurangi allocation `Held/Committed/Assigned` untuk setiap malam `[check-in, checkout)`.

Room type menentukan apakah extra bed diizinkan, maksimum extra bed, serta tambahan kapasitas. Guest count di atas maximum occupancy selalu ditolak.

Jika extra bed diwajibkan oleh occupancy rule, final booking mengunci room-type inventory dan extra-bed resource dalam transaction yang sama. Kegagalan salah satu me-rollback seluruh booking/hold. Add-on dapat dikonfigurasi non-inventory-tracked jika stok fisik tidak perlu dihitung, tetapi room-capacity rule tetap berlaku.

## 6. Jenis inventory hold

### 6.1 Checkout-session hold

- Dibuat ketika customer sudah memilih kamar dan masuk tahap penyelesaian booking, bukan saat hanya melihat hasil pencarian.
- Rekomendasi default: 15 menit.
- Expired otomatis jika booking tidak disubmit.
- Tidak boleh diperpanjang terus-menerus oleh refresh atau retry tanpa batas.

### 6.2 Payment/confirmation hold

- Dibuat saat reservation menjadi `On Hold/Pending Payment`.
- Default: dua jam untuk transfer full-payment 100% booking publik.
- Deadline satu jam hanya digunakan untuk same-day booking atau policy khusus yang dikonfigurasi admin.
- Deadline mengukur transfer dan penyerahan bukti/referensi oleh customer, bukan waktu penyelesaian review admin.
- Memiliki deadline eksplisit pada Asia/Jakarta.
- Admin dapat memperpanjang dengan permission dan alasan.
- Booking pay-at-property yang sudah disetujui menjadi `Confirmed` dan tidak bergantung pada payment expiry.
- Bukti/referensi yang tercatat sebelum deadline mengubah hold menjadi `Payment Review Hold`; expiry job tidak boleh melepas inventory selama review admin masih terbuka.

Expiration harus mengubah reservation dan melepas inventory dalam transaksi yang sama. Retry expiration tidak boleh melepaskan inventory lebih dari sekali.

Booking yang sudah `Expired` tidak boleh langsung menerima pembayaran sebagai kelanjutan hold lama. Customer membuat booking baru, atau Front Office melakukan reopen setelah availability recheck dan membuat hold serta deadline baru.

## 7. Final availability check dan locking

Search result tidak menjamin inventory. Saat customer/admin mengonfirmasi booking:

1. Mulai database transaction.
2. Validasi request dan idempotency key.
3. Kunci inventory untuk semua `room_type + stay_date` yang diminta dalam urutan konsisten.
4. Hitung availability ulang.
5. Jika seluruh quantity tersedia, buat booking, booking lines, hold/commitment, dan folio.
6. Commit seluruh perubahan bersama-sama.
7. Jika salah satu malam tidak tersedia, rollback semuanya dan kembalikan availability terbaru.

Rekomendasi implementasi Phase 1 adalah inventory rows/lock keys per room type dan malam pada database transaksional. Distributed lock atau microservices tidak diperlukan untuk skala awal.

## 8. Idempotency dan concurrency

- Pembuatan booking memiliki idempotency key agar double click/retry menghasilkan satu booking dan satu kode.
- Amend, cancel, expire, dan release inventory juga idempotent.
- Entity version/concurrency check mencegah admin menimpa perubahan pengguna lain.
- Assigned room unit tidak boleh memiliki overlapping active assignment; enforcement dilakukan di database selain validasi aplikasi.
- Cache tidak menjadi sumber kebenaran availability.
- Konflik menghasilkan error terstruktur dan tidak meninggalkan partial booking, hold, folio, atau assignment.

## 9. Amend, cancel, expire, dan no-show

### Amend

- Sistem menahan kebutuhan inventory baru sebelum melepas commitment lama.
- Validasi tanggal, type, quantity, restriction, dan harga dilakukan ulang.
- Jika inventory baru tidak tersedia, booking lama tetap utuh.
- Upgrade/downgrade room type memindahkan commitment secara atomik.
- Date shift sebelum check-in mengunci seluruh interval baru dan hanya melepaskan interval lama dalam transaction apply yang sama.
- Shortening melepaskan hanya room nights/booking line yang dipilih setelah guest confirmation dan action berizin.
- Early departure tidak disimpulkan dari ketidakhadiran sementara; actual checkout dan release remaining nights adalah action eksplisit.
- Multi-room amendment menarget line/room stay tertentu dan tidak mengubah line lain secara implisit.
- Lifecycle dan cross-module rule lengkap tersedia di [BOOKING-STAY-AMENDMENTS.md](BOOKING-STAY-AMENDMENTS.md).

### Extension dan konflik booking mendatang

Extension stay diperlakukan sebagai amend yang meminta inventory baru untuk malam tambahan. Tamu yang sedang menginap tidak otomatis memiliki prioritas atas commitment yang sudah dimiliki booking mendatang.

Urutan guard:

1. Kunci booking, assignment, dan inventory room type/malam yang relevan.
2. Periksa availability untuk seluruh malam tambahan.
3. Jika tersedia tanpa konflik, perpanjang commitment, stay, assignment, dan nightly charge secara atomik.
4. Jika tidak tersedia, jangan mengubah departure date atau commitment lama; tampilkan booking terdampak dan alternatif resolusi.

Prioritas inventory:

1. Booking `Confirmed` yang sudah ada dilindungi.
2. Active hold dilindungi sampai deadline/expiry sesuai kebijakan.
3. Extension baru disetujui hanya setelah kebutuhan inventory tambahan berhasil diamankan.

Pilihan resolusi konflik:

- Tolak extension bila tidak ada alternatif yang valid.
- Pindahkan tamu in-house ke unit/type lain untuk malam tambahan.
- Pindahkan atau upgrade booking mendatang ke type lain yang benar-benar tersedia; perubahan demi kebutuhan operasional KOOKA direkomendasikan sebagai `Complimentary Upgrade / No Price Change`.
- Gunakan `Additional Charge`, `No Price Change`, atau `Price Reduction/Credit` sesuai penyebab, persetujuan, dan keputusan admin.

Sebelum konfirmasi, sistem memvalidasi kapasitas, bed type, amenity/restriction, kesiapan operasional, serta inventory type pengganti. Downgrade tidak boleh dilakukan tanpa persetujuan tamu dan kompensasi/price reduction yang dicatat.

Resolusi harus memindahkan room-type commitment dan assignment terkait dalam satu transaction. Jika satu langkah gagal, booking, commitment, departure date, dan assignment lama tetap utuh.

Data historis minimal menyimpan:

- `booked_room_type` asli.
- `fulfilled_room_type` setelah resolusi bila berbeda.
- Room assignment aktual.
- Price treatment dan adjustment IDR.
- Reason category, catatan, indikator guest informed/accepted, aktor, waktu, dan audit.

### Partial cancellation

- Hanya quantity dan stay dates yang dibatalkan yang dilepas.
- Folio, cancellation fee, dan refundable amount diputuskan/dicatat manual sesuai policy dan terpisah dari inventory release.

### Expired/cancelled

- Active hold/commitment dilepas tepat satu kali.
- Reopen selalu melakukan availability check dan membuat hold baru.

### No-show

- Sistem memberi indikator `Arrival Overdue/Possible No Show` setelah expected arrival terlewati; indikator tidak membatasi late check-in, melepas inventory, atau mengubah status booking.
- Pada Phase 1, Front Office mengonfirmasi no-show secara manual setelah contact attempt.
- Booking online yang full payment 100%-nya telah verified adalah guaranteed. Default inventory disposition ketika no-show adalah `Retain Until Original Checkout` untuk seluruh room type/quantity yang dijamin.
- `Mark No Show` dan `Release Remaining Nights` adalah action terpisah. Front Office berizin dapat melakukan release tanpa Owner approval, tetapi wajib mencatat contact attempt, alasan, policy snapshot, konsekuensi finansial, affected nights/quantity, dan audit.
- Late arrival dengan commitment retained menggunakan reinstate workflow tanpa membuat commitment baru; sistem tetap memvalidasi assignment/readiness.
- Jika inventory sebelumnya dilepas manual, reinstate wajib melakukan availability check baru dan tidak boleh membuat hard overbooking.
- Late arrival tidak menggeser checkout atau harga secara otomatis.

## 10. Room move dan perubahan room type

Room move dalam room type yang sama hanya mengubah assignment secara atomik. Commitment room-type tidak berubah.

Upgrade/downgrade ke room type berbeda:

1. Periksa availability room type baru.
2. Tahan commitment baru.
3. Hitung penyesuaian harga atau simpan `no price change` dengan alasan.
4. Tutup assignment lama dan aktifkan assignment baru pada effective time.
5. Lepaskan commitment lama.
6. Buat cleaning task unit lama dan audit seluruh perubahan.

Untuk complimentary upgrade booking mendatang, commitment harus benar-benar dipindahkan dari room type yang dipesan ke room type yang dipenuhi agar inventory lama bebas. Harga dan `booked_room_type` asli tetap tersimpan sebagai histori; fulfillment dan assignment aktual disimpan terpisah.

## 11. Maintenance dan availability block

Block minimal menyimpan:

- Room unit.
- Start/end date-time.
- Jenis: maintenance, owner use, deep cleaning, atau administrative block.
- Alasan, creator, approver, dan audit.

Block yang overlap dengan confirmed booking tidak boleh diaktifkan diam-diam. Admin harus memindahkan booking, mengganti room type, mengubah periode block, atau menyelesaikan konflik melalui workflow berizin.

Maintenance Issue tidak selalu mengeluarkan unit dari inventory. Setelah triage, disposition dapat `Monitor Only`, `Restricted Use`, `Create Planned Block`, atau `Mark Out of Order`. `Blocked` digunakan untuk downtime terencana/administratif; `Out of Order` untuk kerusakan tidak terencana, tidak aman, atau tidak layak.

Return-to-service memerlukan blocking issue resolved/verified, tidak ada block lain, safety/function check, cleaning bila relevan, serta housekeeping inspection sesuai readiness rule. Detail maintenance dan guest damage tersedia di [MAINTENANCE-ASSET-DAMAGE.md](MAINTENANCE-ASSET-DAMAGE.md).

## 12. Whole house dan package

Whole House/package memiliki versioned component definition. Package component dapat `Fixed` atau `Optional`; fixed dikunci otomatis dan optional hanya ketika dipilih.

Whole House adalah composite exclusive-use product dan bukan room type sintetis. Booking Whole House mengunci seluruh mandatory room unit, resource, dan shared-facility block dalam satu transaksi. Jika satu komponen tidak tersedia, seluruh booking gagal dan tidak meninggalkan partial hold/block.

Group inquiry/quotation tidak mengurangi availability. Tentative allocation membuat active hold berbatas deadline yang mengurangi availability dan dilepas idempotent saat expired/rejected.

Whole House yang aktif mencegah kamar individual serta package lain dengan component overlap tersedia pada periode yang sama. Partial room release ditolak sampai conversion ke multi-room/group berhasil mengamankan inventory/pricing baru secara atomik.

Booking historis tetap memakai component version yang berlaku saat dibuat meskipun master package kemudian berubah.

Fitur penjualan whole house/package penuh berada di Phase 2, tetapi model inventory Phase 1 tidak boleh menutup kemungkinan komitmen komposit ini.

## 13. Hard overbooking dan conflict workflow

Hard overbooking tidak diizinkan pada Phase 1, termasuk oleh Super Admin. Permission tidak boleh membuat jumlah commitment melebihi inventory fisik.

Jika booking eksternal/legacy sudah menciptakan konflik, sistem membuat `Inventory Conflict / Needs Resolution` yang:

- Tidak dianggap availability normal.
- Menampilkan booking, type/unit, tanggal, dan tingkat konflik.
- Memerlukan room move, perubahan type/tanggal, atau pembatalan.
- Menyimpan resolver, resolution, waktu, dan audit.

Super Admin tetap dapat override harga, payment policy, room readiness, restriction tertentu, atau deadline pembayaran sesuai permission, tetapi bukan physical capacity.

## 14. Availability restrictions

Availability search minimal memeriksa:

- Kapasitas dewasa/anak dan extra bed.
- Maximum total guest, extra-bed eligibility per room type/unit, maximum extra beds, dan shared extra-bed resource availability bila dilacak.
- Minimum/maximum stay.
- Same-day booking cutoff.
- Advance booking window.
- Closed to arrival/departure.
- Unit block/out-of-order.
- Package/whole-house component.
- Validitas check-in sebelum checkout.

Restriction kompleks dapat diaktifkan bertahap, tetapi field dan rule evaluation harus memiliki arah yang jelas.

## 15. Room board

Room board diurutkan dengan `sort_order` dan menampilkan nomor kamar sederhana:

```text
Kamar 1 · Deluxe   · Occupied · Stayover
Kamar 2 · Executive · Vacant  · Dirty
Kamar 3 · Deluxe   · Vacant   · Inspected · Ready
Kamar 4 · Family   · Blocked  · Maintenance
```

Queue booking tanpa assignment ditampilkan terpisah. Drag/drop assignment tetap menjalankan validation dan transaction; UI tidak dapat melewati overlap atau room-type rules.

Phase 1 juga menyediakan `Live Room Monitor/Room Status Board` dalam satu halaman untuk seluruh unit fisik. Setiap kartu memisahkan badge occupancy, stay, housekeeping, cleaning, serta serviceability; menampilkan active Room Lead Guest sesuai permission, checkout, next arrival, dan alert. Booking unassigned tidak boleh ditempelkan ke unit sembarang.

Monitor juga menampilkan approved early check-in time, late-checkout-until, Operational Occupancy Block, target ready time, dan next-arrival conflict.

Monitor diperbarui near-real-time, menampilkan last-updated/stale warning, memiliki Shared Display Mode yang memasking nama, dan tidak mengubah status melalui generic edit. Detail metric, RBAC, refresh, serta acceptance test tersedia di [REPORTING-DASHBOARD-RECONCILIATION.md](REPORTING-DASHBOARD-RECONCILIATION.md).

## 16. Minimum acceptance tests

- Booking 10–12 Agustus tidak konflik dengan booking baru yang check-in 12 Agustus.
- Dua request bersamaan untuk unit terakhir hanya menghasilkan satu booking berhasil.
- Double click/retry menghasilkan satu booking, satu folio, dan satu inventory commitment.
- Booking unassigned tetap mengurangi room-type availability.
- Assignment unit tidak mengurangi inventory kedua kali.
- Amend gagal tidak merusak booking dan commitment lama.
- Cancel/expire melepaskan inventory tepat satu kali.
- Dirty room dapat dijual untuk tanggal mendatang tetapi tidak lolos check-in readiness.
- Block overlap confirmed booking ditolak sampai konflik diselesaikan.
- Whole-house booking gagal seluruhnya jika satu komponen tidak tersedia.
- Inquiry tidak menahan inventory; tentative group hold menahan lalu release tepat satu kali saat deadline.
- Package optional component tidak mengurangi inventory sebelum dipilih.
- Whole House mencegah kamar/fasilitas komponennya dijual melalui produk lain.
- Partial release Whole House ditolak tanpa successful conversion workflow.
- Tidak ada role yang dapat melakukan hard overbooking.
- Room number sederhana tampil menurut `sort_order` dan tidak digunakan untuk menyimpulkan room type.
- Guest count di atas maximum occupancy selalu ditolak.
- Required extra bed pada kamar yang tidak mengizinkan membuat booking gagal.
- Room + required extra-bed resource dikunci atomik dan tidak dapat oversold oleh request bersamaan.
- Live Room Monitor menampilkan seluruh unit tepat sekali; active guest mengikuti assignment aktual dan berpindah atomik ketika room move efektif.
- Shared Display Mode memasking nama serta tidak menampilkan booking code, kontak, saldo, atau data sensitif.
- Early check-in ditolak jika previous guest belum checkout atau unit belum ready.
- Late checkout ditolak saat next confirmed guest menunggu/dekat tiba atau turnover window tidak cukup.
- Operational Occupancy Block intraday tidak membuat room night kedua; crossing overnight threshold menggunakan extension.

## 17. Pertanyaan konfigurasi

- Durasi checkout-session hold final.
- Durasi payment hold per channel/customer type.
- SOP contact attempt serta kebijakan manual pelepasan no-show; tidak ada arrival cutoff otomatis.
- Restriction mana yang aktif pada Phase 1.
- Verifikasi estimasi sekitar 15 unit serta daftar final nomor kamar, room type, kapasitas, amenity, extra-bed eligibility, serviceability, dan block awal.
- Jam standar default telah ditetapkan check-in `14:00` dan checkout `12:00` Asia/Jakarta. Earliest/latest early-late limit juga configurable dan akan diisi Owner; nilai produksi, turnover buffer minimum, dan overnight extension threshold masih terbuka sebelum UAT.
