# Pricing dan Rate Rules — KOOKA Residence

| Informasi | Nilai |
|---|---|
| Versi | 1.9 Draft |
| Tanggal | 1 Agustus 2026 |
| Scope | Phase 1 pricing, room move adjustment, cancellation, dan refund manual |
| Sumber kebutuhan | [PRD.md](PRD.md) |

## 1. Tujuan

Dokumen ini menjadi sumber aturan perhitungan harga kamar, price quote, booking price snapshot, perubahan harga, room move adjustment, cancellation fee, dan refund amount.

Prinsip utama:

- Seluruh nilai transaksi resmi menggunakan IDR.
- Harga dapat dijelaskan per booking line, kamar, dan malam.
- Harga historis booking tidak berubah ketika master rate berubah.
- Perubahan harga dilakukan melalui adjustment, permission, alasan, dan audit.
- Room move tidak otomatis memaksa repricing.
- Cancellation fee dan refund amount ditentukan admin secara manual berdasarkan kebijakan yang berlaku.

## 2. Money model

- Nilai IDR selalu bilangan bulat rupiah. Penyimpanannya memakai `numeric(18,2)` agar PostgreSQL menghitung secara desimal eksak dan tidak pernah floating point; pecahan rupiah ditolak oleh `CHECK` constraint database, bukan hanya oleh pembulatan di application layer.
- USD/AUD hanya estimasi tampilan dan tidak menjadi ledger value.
- Setiap posted folio item dibulatkan ke rupiah penuh menggunakan aturan pembulatan konsisten.
- Total dihitung dari penjumlahan item yang sudah dibulatkan.
- Exchange-rate snapshot dapat disimpan untuk transparansi display, tetapi tidak mengubah nilai IDR.

## 3. Struktur rate

### 3.1 Base rate

Setiap room type memiliki harga dasar per malam dalam IDR. Harga dasar menjadi fallback sehingga Owner tidak perlu mengisi harga satu per satu untuk setiap tanggal.

### 3.2 Date/season override

Admin dapat menentukan rate override untuk tanggal/periode tertentu. Override memiliki room type/rate plan, start/end date, nilai IDR, status aktif, creator, dan audit.

Rule dapat memakai tanggal spesifik, rentang musim, atau pola hari dalam minggu seperti weekday/weekend. Nilai produksi akan diisi Owner melalui admin; sistem tidak mengharuskan daily manual entry.

### 3.3 Rate plan

Rate plan minimal memuat:

- Nama Indonesia/English.
- Room type.
- Inclusions non-makanan yang benar-benar berlaku; makanan tidak termasuk dalam room rate.
- Payment/deposit policy.
- Cancellation policy version.
- Restriction seperti minimum stay bila digunakan.
- Status aktif serta periode jual.

Phase 1 direkomendasikan memulai dengan `Standard Room Only` dan `Custom/Admin Rate`. Struktur dapat diperluas untuk flexible, non-refundable, corporate, long-stay, atau OTA pada fase berikutnya. Tidak ada `Standard with Breakfast`; semua F&B dipesan dan dihargai terpisah.

Payment requirement mengikuti booking source. Customer-created online booking selalu memiliki full-payment requirement 100% sebelum confirmation, terlepas dari rate plan. Deposit persentase/nominal tetap hanya dapat dipilih oleh staf berizin ketika membuat manual booking dan tersimpan pada booking policy snapshot.

Rekening transfer tidak termasuk konfigurasi rate plan. Seluruh rekening properti yang aktif berlaku untuk semua room type/rate plan dan ditampilkan sebagai pilihan setelah booking online dibuat. Reservation menyimpan daftar versi rekening yang ditawarkan agar histori tidak berubah ketika master rekening diperbarui.

### 3.4 Rate resolution dan coverage

Urutan resolusi default yang disetujui:

1. Harga tanggal khusus.
2. Harga seasonal/rentang tanggal.
3. Harga pola weekday/weekend.
4. Base rate.
5. Promo/discount diterapkan terhadap resolved nightly rate hanya bila eligibility dan stacking rule mengizinkan.

Admin UI harus mendeteksi rule overlap, menampilkan winning rule/preview calendar, dan memberi peringatan gap. Jika tidak ada rule yang cocok tetapi base rate aktif, sistem memakai base rate. Bila tidak ada resolved rate sama sekali, kamar/rate plan tidak boleh dijual online dan nominal tidak boleh menjadi nol secara implisit.

## 4. Nightly breakdown

Booking menyimpan harga per booking line dan malam:

| Stay date | Room type | Quantity | Unit rate | Total |
|---|---|---:|---:|---:|
| 10 Agustus | Deluxe | 2 | Rp800.000 | Rp1.600.000 |
| 11 Agustus | Deluxe | 2 | Rp900.000 | Rp1.800.000 |

Room assignment ke nomor kamar tidak mengubah harga selama room type tetap sama.

## 5. Urutan perhitungan

Urutan deterministik Phase 1:

1. Resolve nightly room rate: special date → seasonal → weekday/weekend → base rate.
2. Rate-plan adjustment.
3. Extra guest/extra bed.
4. Package/add-on.
5. Discount.
6. Service charge jika digunakan.
7. Tax jika digunakan.
8. Rounding.
9. Grand total IDR.

Tax/service charge dapat inclusive atau exclusive sesuai konfigurasi Owner. Nilai dan aturan resmi harus dikonfirmasi sebelum implementasi.

## 6. Price quote

Price quote sementara memuat:

- Quote ID dan expiry.
- Room type, quantity, stay dates, guest count.
- Nightly breakdown.
- Extra guest/bed, package/add-on, discount.
- Tax/service dan grand total IDR.
- Rate plan, payment policy, dan cancellation policy version.
- Display estimate USD/AUD bila dipilih.

Quote direkomendasikan berlaku mengikuti checkout-session hold, default 15 menit. Final booking melakukan availability dan price recheck dalam transaction. Jika harga berubah, customer harus melihat dan menyetujui quote baru sebelum booking dibuat.

## 7. Booking price snapshot

Saat booking berhasil dibuat, simpan snapshot:

- Nightly rates dan quantity.
- Rate plan serta inclusions.
- Extra guest/bed dan add-on.
- Discount.
- Tax/service configuration.
- Payment dan cancellation policy version.
- Package/component version.
- Total resmi IDR.

Perubahan master rate/policy tidak memperbarui booking lama. Perubahan booking menggunakan adjustment atau snapshot version baru dengan histori.

Snapshot disimpan per stay date agar kombinasi weekday, weekend, seasonal, special-date, dan discount dapat dijelaskan. Setiap nightly snapshot minimal menyimpan resolved amount IDR, source rule/type/version, room type/rate plan, discount reference bila ada, serta calculation timestamp. Nilai yang tampil dalam USD/AUD hanya estimasi dan tidak menggantikan snapshot resmi IDR.

## 8. Amend booking

- Malam yang tidak berubah mempertahankan harga historis secara default.
- Malam baru menggunakan rate yang berlaku saat amend.
- Malam/quantity yang dihapus diproses sebagai adjustment sesuai keputusan admin.
- Sistem menampilkan perbandingan harga lama dan baru sebelum konfirmasi.
- Admin dapat memilih `Keep Original Rate/No Price Change` dengan permission dan alasan.
- Amend inventory dan pricing disimpan atomik; kegagalan tidak mengubah booking lama.
- Date shift/extension/shortening menampilkan old total, new total, delta IDR, tax/service delta, payment/outstanding impact, dan refund decision terpisah.
- Early departure tidak otomatis menghapus charge atau menghasilkan refund; admin mengikuti policy snapshot dan membuat adjustment/credit serta Refund Record bila disetujui.
- Pre-arrival amendment dengan delta debit menunggu verified additional payment sebelum apply; in-house extension dapat apply dengan outstanding folio atas action Front Office setelah inventory terkunci.
- Multi-room amendment menghitung delta per booking line dan payer/billing destination tanpa mengubah line lain.
- Detail lifecycle tersedia di [BOOKING-STAY-AMENDMENTS.md](BOOKING-STAY-AMENDMENTS.md).

## 9. Room move dan price treatment

Room move tidak melakukan automatic repricing. Sistem boleh menampilkan selisih rate sebagai referensi, tetapi admin menentukan perlakuan final.

Pilihan:

- `No Price Change`: incidental/operational move, maintenance, complimentary upgrade, atau keputusan lain tanpa biaya.
- `Additional Charge`: upgrade atau guest-requested move yang dikenakan biaya.
- `Price Reduction/Credit`: downgrade, kompensasi, atau service recovery.

Data wajib:

- Unit dan room type lama/baru.
- Effective date-time.
- Price treatment.
- Nominal adjustment manual IDR; nol untuk `No Price Change`.
- Reason category dan notes.
- Indikator guest informed/accepted bila ada additional charge.
- Actor, approver bila melewati limit, dan audit.

Kategori alasan minimal: maintenance/property issue, operational move, guest-requested upgrade, guest-requested move, complimentary upgrade, downgrade, service recovery, atau lainnya.

Adjustment ditambahkan sebagai folio item seperti `Room Move Adjustment` atau credit/discount. Nightly charge historis tidak dihapus atau diedit diam-diam.

Aturan konflik extension:

- Jika KOOKA memindahkan booking mendatang ke tipe lebih tinggi untuk melindungi booking confirmed dan menyelesaikan konflik operasional, gunakan `Complimentary Upgrade / No Price Change` sebagai rekomendasi default.
- Jika tamu in-house meminta extension dan hanya tipe lebih tinggi yang tersedia, admin dapat memilih `Additional Charge` atau memberi waiver melalui `No Price Change`.
- Downgrade memerlukan persetujuan tamu dan `Price Reduction/Credit` atau kompensasi yang dicatat.
- Booked room type dan harga awal tetap tersimpan; fulfilled room type, adjustment, alasan, dan approval dicatat terpisah.

### 9.1 Extra guest dan extra bed

- Extra guest dan extra bed adalah charge category terpisah.
- Extra bed menggunakan kategori `Accommodation Add-on / Extra Bed`, bukan service/tour.
- Charge basis dapat `Per Night` atau `Per Stay`; rekomendasi default `Per Night`.
- Harga, quantity, service date/nightly breakdown, tax/service profile, discount, dan policy disnapshot pada booking/folio.
- Complimentary extra bed memakai zero/no-price treatment atau discount dengan Front Office permission, mandatory reason, dan audit tanpa Owner approval.
- Amend tanggal, guest count, room move, atau add/remove extra bed menghitung adjustment/reversal tanpa menghapus charge historis.

### 9.2 Early check-in dan late checkout

- Keduanya menggunakan kategori `Accommodation Add-on`, bukan service/tour.
- Price treatment dapat `Free`, `Fixed Amount`, `Percentage of Nightly Rate`, `Manual Amount`, atau `Complimentary/Waived`.
- Charge menyimpan request/approved time, add-on/version, price basis/snapshot, amount IDR, service date, room stay, tax/service profile atau No Tax, actor, reason, serta audit.
- Approval operasional tidak otomatis memposting charge atau menandai payment; posting memakai source uniqueness/idempotency.
- Waiver/manual amount dapat diisi Front Office berizin tanpa Owner approval; reason wajib dan posted correction memakai reversal/credit tanpa mengedit charge lama.
- Late checkout melewati overnight threshold menggunakan extension/nightly pricing, bukan add-on intraday semata.
- Detail operasional tersedia di [EARLY-CHECKIN-LATE-CHECKOUT.md](EARLY-CHECKIN-LATE-CHECKOUT.md).

## 10. Multi-room pricing

- Setiap booking line memiliki nightly breakdown sendiri.
- Partial cancellation satu line/unit tidak mengubah line lain.
- Charge dapat ditelusuri ke booking line, room type, stay date, quantity, dan assignment bila tersedia.
- Room assignment tidak menjadi sumber harga.

### 10.1 Package dan Whole House

- Pricing mode dapat `Component Sum`, `Bundled Fixed Price`, atau `Manual/Contract Price` berizin.
- Semua mode menyimpan alokasi IDR per component untuk tax/service, invoice split, report, cancellation/refund reference, dan audit.
- Total component allocation ditambah explicit discount/rounding harus sama dengan total resmi bundle.
- Component retail price hanya reference bila bundle memakai fixed/manual price.
- Package/Whole House menyimpan component, rate, tax/service, policy, dan allocation snapshot; perubahan master tidak mengubah booking lama.
- Optional component yang ditambah/dihapus memakai availability recheck dan financial adjustment/reversal.

## 11. Discount, custom rate, dan complimentary

- Discount dapat berupa fixed amount atau percentage serta memiliki scope booking, booking line, atau malam.
- Discount stacking hanya berlaku jika rule mengizinkan.
- Total tidak boleh menjadi negatif.
- Front Office berizin dapat langsung memasukkan discount, custom rate, complimentary, credit, atau waiver tanpa nominal/persentase approval limit dan tanpa Owner approval.
- Custom rate menyimpan nilai lama/baru, alasan, actor, timestamp, source/policy reference, dan guest-informed indicator bila relevan.
- Complimentary menggunakan zero-rate/official adjustment dengan alasan dan audit, bukan menghapus room charge.
- Optional high-value alert/report bersifat monitoring dan tidak menahan perubahan. Correction tetap menggunakan adjustment/reversal resmi.

## 12. Cancellation policy

Cancellation policy dikelola sebagai konten/versioned policy dalam Bahasa Indonesia dan English:

- Policy ID/version.
- Judul dan isi.
- Effective date.
- Status draft/published.
- Creator/publisher dan audit.

Policy dapat dibedakan menurut booking source/rate plan—misalnya online full-payment versus admin-created manual/deposit/pay-at-property—dan memuat cancellation window, no-show wording, fee/refund reference, serta contact channel. Nilai window/fee/refund produksi akan diisi kemudian.

Booking menyimpan policy version yang berlaku saat dibuat. Perubahan policy kemudian tidak mengubah booking historis.

Sistem tidak menghitung cancellation fee atau refundable amount secara otomatis pada Phase 1. Saat cancellation, sistem menampilkan policy version serta ringkasan finansial; admin memasukkan secara manual:

- Cancellation fee/charge adjustment IDR.
- Waiver/credit bila ada.
- Refundable amount yang diputuskan Front Office.
- Alasan, notes, actor, dan audit.

Cancellation hanya dilakukan Front Office berdasarkan request customer dari kanal resmi; halaman lookup tidak menyediakan self-service mutation. Cancellation melepaskan inventory dan mengubah reservation status, tetapi tidak otomatis membuat atau menyelesaikan refund.

## 13. Refund manual

Refund amount ditentukan admin secara manual berdasarkan policy dan keputusan operasional.

Sistem menampilkan guard summary:

```text
Verified payments
- Successful refunds
= Maximum remaining payment value available for refund guard
```

Guard ini bukan keputusan kebijakan. Sistem tidak menentukan nominal yang seharusnya direfund, tetapi:

- Menolak nominal melebihi nilai pembayaran terverifikasi yang masih tersedia; tidak ada Owner override untuk melewati hard financial guard.
- Memperhitungkan refund berhasil sebelumnya.
- Memerlukan reason, destination account, actor/processor, transfer reference, evidence, dan audit tanpa Owner approval.
- Menjaga refund sebagai lifecycle terpisah dari cancellation dan payment.
- Menghasilkan refund note setelah transfer selesai.
- Mencegah duplicate refund akibat retry/double click.

Refund dapat dibuat untuk cancellation atau kompensasi lain selama reason dan permission valid.

## 14. Harga publik dan mata uang tampilan

- Sebelum tanggal dipilih, website dapat menampilkan `Mulai dari Rp...` dengan konteks bahwa harga bergantung tanggal dan availability.
- Setelah tanggal dipilih, tampilkan nightly breakdown dan total IDR.
- USD/AUD selalu berlabel perkiraan/estimated.
- Review booking, payment instruction, invoice, payment, dan refund menampilkan IDR secara dominan.

### 14.1 Tax dan service-charge profile

- Room, F&B, tour, service, package, fee, dan room-move adjustment dapat memakai profile berbeda atau `No Tax`.
- Mode: `No Tax`, `Inclusive`, `Exclusive`, atau `Custom/Manual` berizin.
- Profile menyimpan rate/fixed amount, effective date, calculation order, discount treatment, rounding, version, dan scope default.
- Tax/service dihitung serta disnapshot ketika folio charge diposting, bukan ketika invoice dibuat.
- Manual tax/no-tax override membutuhkan permission, alasan, dan audit.
- Service charge dipisahkan dari tax walaupun memakai calculation engine yang sama.
- Detail ledger/invoice tersedia di [FOLIO-FINANCIAL-LEDGER.md](FOLIO-FINANCIAL-LEDGER.md).

## 15. Permission dan audit

Action sensitif:

- Set custom rate.
- Add/remove discount melalui reversal.
- No-price-change room move.
- Additional charge atau credit room move.
- Complimentary.
- Cancellation fee/waiver.
- Refund amount dan override guard.

Setiap action menyimpan actor, before/after, reason, timestamp, approver bila diwajibkan, dan related booking/folio item. Posted item tidak dihapus; koreksi menggunakan reversal/adjustment.

## 16. Minimum acceptance tests

- Harga booking dapat dijelaskan per booking line dan malam.
- Perubahan master rate tidak mengubah booking snapshot.
- Quote expired direprice sebelum booking.
- Perubahan tanggal mempertahankan malam lama dan menghitung malam baru sesuai rule.
- Room move tipe sama tidak mengubah harga kecuali admin menambah adjustment.
- Admin dapat memilih room move additional charge, no price change, atau credit dengan audit.
- Cancellation fee dan refundable amount hanya berasal dari input manual admin.
- Cancellation tidak otomatis membuat refund.
- Refund manual tidak dapat melebihi guard tanpa Owner override.
- Retry tidak membuat duplicate adjustment/refund.
- USD/AUD display tidak mengubah nilai IDR.
- Extra guest dan extra bed menghasilkan charge category terpisah.
- Extra-bed charge per-night/per-stay memiliki price/tax snapshot dan amend menggunakan adjustment/reversal.
- Bundle fixed/manual price memiliki component allocation yang merekonsiliasi total dan mempertahankan tax/policy snapshot.
- Early/late add-on menyimpan IDR/tax snapshot; approval retry tidak memposting charge ganda dan complimentary menyimpan reason/approval.

## 17. Ditunda ke fase berikutnya

- Dynamic/yield pricing otomatis.
- Competitor-based pricing.
- Promo stacking engine kompleks.
- Corporate contract rate kompleks.
- OTA rate parity automation.
