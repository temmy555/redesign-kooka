# Checkout dan Flexible Departure Clearance — KOOKA Residence

| Informasi | Nilai |
|---|---|
| Versi | 1.0 Draft |
| Tanggal | 1 Agustus 2026 |
| Scope | Phase 1 — optional room inspection dan checkout coordination |
| Sumber kebutuhan | [PRD.md](PRD.md) |

## 1. Keputusan utama

- Pemeriksaan kamar sebelum checkout bersifat opsional dan fleksibel, bukan hard gate tanpa batas.
- Front Office dapat menyelesaikan, mencatat temuan, atau melewati pemeriksaan dengan alasan.
- Tamu tidak boleh ditahan terlalu lama hanya karena petugas pemeriksa belum tersedia.
- Departure Clearance terpisah dari stay, occupancy, payment, folio, cleaning, maintenance, Lost & Found, dan Guest Damage Assessment.
- Clearance dilakukan per room stay agar multi-room dapat checkout sebagian.

## 2. Status Departure Clearance

Status minimum:

- `Not Started`
- `In Progress`
- `Cleared`
- `Issue Found`
- `Skipped`

`Issue Found` bukan pernyataan bahwa tamu bersalah dan bukan charge. Temuan harus diteruskan ke entity/action sumber yang sesuai.

Setiap clearance menyimpan room stay, unit, requested/started/completed time, checker, checklist version/snapshot, result, notes, issue references, skip reason/actor, serta audit.

## 3. Alur checkout

1. Tamu memberi tahu Front Office bahwa akan checkout.
2. Front Office memulai Departure Clearance bila pemeriksaan akan dilakukan.
3. Front Office/Cleaning memeriksa checklist singkat dan mengirim hasil.
4. Temuan dibuat sebagai entity sumber; clearance tidak membuat charge/status lain secara otomatis.
5. Front Office meninjau folio, payment/refund/assessment exception, lalu menjalankan checkout atau override sesuai permission.
6. Actual checkout mengubah stay menjadi `Checked Out`, unit menjadi `Vacant + Dirty`, dan membuat turnover task secara idempotent.

Clearance dapat berjalan paralel dengan review folio agar waktu tunggu pendek.

## 4. Checklist minimum

- Kondisi kamar/fasilitas dan barang properti yang terlihat.
- Linen, handuk, remote, elektronik, serta perlengkapan utama.
- Extra bed/setup bila digunakan.
- Barang milik tamu yang tertinggal.
- Maintenance issue yang baru ditemukan.
- Manual F&B paper order/ancillary yang sudah diterima tetapi belum masuk sistem.

Key tracking tidak termasuk Phase 1. Pemeriksaan/pengembalian kunci tetap memakai SOP fisik di luar sistem.

## 5. Routing temuan

- Kerusakan/barang properti hilang → `Guest Damage Incident`; responsibility/amount tetap manual.
- Kerusakan fungsi/fasilitas → `Maintenance Issue`.
- Barang tamu tertinggal → `Found Item/Lost & Found`.
- Order makanan belum tercatat → `Manual Paper Order` dengan unique intake reference.
- Financial mismatch → folio adjustment/reversal/payment/refund action resmi.

Satu temuan boleh mereferensikan lebih dari satu workflow bila benar-benar diperlukan, tetapi tidak boleh memposting charge dua kali.

## 6. Flexible skip dan timeout

- Front Office dapat menjalankan `Skip Departure Clearance` dengan alasan seperti staff unavailable, guest urgent departure, policy exception, remote checkout, atau lainnya.
- Skip membutuhkan permission, actor, actual time, reason, serta guest informed note bila relevan.
- Sistem dapat menampilkan target/SLA rekomendasi, misalnya 5–10 menit, tetapi angka final dikonfigurasi Owner.
- Melewati target menghasilkan alert/decision prompt, bukan menahan checkout tanpa batas.
- `Issue Found` juga tidak otomatis memblokir checkout; Front Office menggunakan financial/assessment guard atau override yang berlaku.

## 7. Hubungan dengan folio dan damage charge

- Clearance status tidak mengubah folio balance atau payment status.
- Guest Damage Incident tidak otomatis membuat damage charge.
- Approved/posted damage charge menggunakan workflow assessment, approval, tax snapshot, invoice coverage, serta payment terpisah.
- Jika assessment belum selesai, Front Office dapat menunggu singkat, checkout dengan outstanding sesuai permission/policy, atau melakukan skip/waiver/reject melalui action resmi.
- Tidak ada action generic `Clear Folio` atau edit/delete posted charge.

## 8. Multi-room dan group

- Clearance dibuat per room stay/unit.
- Satu room stay dapat `Cleared/Skipped` dan checkout tanpa mengubah stay kamar lain.
- Booking/group reservation menjadi selesai hanya setelah seluruh room stay memenuhi lifecycle dan folio closure rule.
- Temuan ditautkan ke unit/stay yang benar agar payer/invoice routing dapat dipilih tanpa duplicate charge.

## 9. Dashboard dan audit

Front Office melihat:

- Departure hari ini: not started, in progress, cleared, issue found, skipped.
- Waktu tunggu dan overdue target.
- Folio/payment/refund/damage exception terpisah.
- Same-day next arrival dan target cleaning.

Audit wajib untuk start/result/skip, checker, checklist snapshot, issue links, reason, checkout override, serta waktu aktual. Evidence sensitif tetap memakai private access dan tidak muncul pada shared display.

## 10. Minimum acceptance tests

- Departure Clearance dapat dilewati dengan reason/permission tanpa membuat tamu tertahan atau mengubah data sumber secara diam-diam.
- `Issue Found` tidak otomatis membuat customer responsible, folio charge, maintenance block, atau Lost & Found outcome.
- Temuan damage/maintenance/lost-item/manual-order membuat atau mereferensikan entity sumber yang tepat.
- Actual checkout selalu menghasilkan `Checked Out`, `Vacant + Dirty`, dan tepat satu turnover task, baik clearance Cleared maupun Skipped.
- Clearance per room stay memungkinkan partial multi-room checkout.
- Clearance timeout menghasilkan alert, bukan permanent hard lock.
- Damage charge yang sama tidak diposting dua kali dari clearance dan checkout.
- Skip/result menyimpan actor, time, reason/checklist, dan audit.
- Shared display tidak menampilkan damage evidence atau detail finansial.

## 11. Konfigurasi sebelum implementasi

- Apakah clearance default dilakukan untuk semua stay atau hanya risk/selected cases.
- Target waktu pemeriksaan dan siapa yang bertugas per jam operasional.
- Checklist final serta item/kondisi yang masuk Damage Charge Catalog.
- Role/permission untuk skip, issue resolution, outstanding checkout, dan compensation.
- Retention untuk checklist note/photo/evidence.
