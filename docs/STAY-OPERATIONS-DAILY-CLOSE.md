# Stay Operations dan Daily Close — KOOKA Residence

Dokumen keputusan operasional Phase 1.

- Zona waktu: Asia/Jakarta.
- Status: disetujui untuk PRD.
- Scope: business date, automatic rollover, arrival/departure exception, guaranteed late arrival, no-show, housekeeping generation, dan daily close.

## 1. Tujuan

Menjaga operasional harian tetap konsisten tanpa night audit manual yang kaku, terutama ketika ada late arrival setelah tengah malam, departure belum selesai, pembayaran masih diperiksa, atau kamar belum ready.

## 2. Waktu aktual, service date, dan business date

Sistem menyimpan tiga konteks waktu secara terpisah:

- `occurred_at`: timestamp aktual sebuah action.
- `service_date`: tanggal layanan/malam yang menjadi sumber charge atau pekerjaan.
- `business_date`: tanggal operasional yang sedang berjalan.

Semua timestamp disimpan secara konsisten dan ditampilkan dalam Asia/Jakarta. Rekomendasi awal business-date rollover adalah pukul `04:00` Asia/Jakarta dan dapat dikonfigurasi.

Contoh: booking arrival 1 Agustus yang check-in aktual pada 2 Agustus pukul 00:00 tetap merupakan late arrival untuk stay 1 Agustus. Tanggal checkout dan harga tidak bergeser otomatis karena tamu datang terlambat.

## 3. Model daily operations

Gunakan automatic rollover dengan exception checklist, bukan proses manual yang memblokir Front Office.

Status daily operations:

- `Open`: hari operasional aktif.
- `Needs Attention`: terdapat exception yang perlu ditangani.
- `Closed`: checklist minimum selesai.

Owner/Super Admin dapat melakukan `Close with Exceptions` dengan alasan wajib. Exception yang belum selesai dibawa ke hari berikutnya dan tidak dihapus.

Daily close tidak mengunci seluruh aplikasi. Check-in, checkout, payment verification, cleaning, dan emergency room move tetap dapat dijalankan sesuai guard serta permission.

## 4. Automatic rollover

Pekerjaan rollover harus idempotent dan aman diulang:

1. Menghitung indikator `Due In` dan `Due Out`.
2. Membuat task `Stayover` tanpa duplikasi hanya untuk tamu `In House` yang
   sudah melewati sedikitnya satu malam. Hari check-in tidak membuat task
   otomatis. Task `Checkout` dibuat setelah action checkout benar-benar selesai,
   sedangkan permintaan pembersihan tamu dibuat langsung oleh Front Office.
3. Menandai `Same-day Turnover` dan target ready time.
4. Menandai `Arrival Overdue / Possible No Show` setelah arrival cutoff.
5. Menampilkan booking yang belum memiliki room assignment.
6. Menampilkan arrival dengan unit belum ready.
7. Menampilkan departure yang belum checkout atau belum memperoleh extension.
8. Menampilkan pending payment verification, outstanding folio, dan refund tertunda.
9. Menampilkan maintenance/block conflict dan task otomatis yang gagal.
10. Mereconcile nightly room-charge snapshot untuk mendeteksi missing/duplicate entry tanpa memposting ulang charge yang sudah ada.

Untuk Phase 1, nightly room charge sudah dibuat dari booking price snapshot. Daily close tidak melakukan revenue recognition atau membuat room charge baru secara rutin.

## 5. Guaranteed online booking

Booking online mewajibkan pembayaran minimum sesuai policy sebelum dikonfirmasi. Setelah payment record memenuhi jumlah wajib dan berstatus `Verified`, reservation menjadi `Confirmed` dan guarantee classification menjadi `Guaranteed`.

Guarantee classification tidak menggantikan reservation, stay, atau payment status. Sistem menyimpan booking source, guarantee basis, required amount, policy version, payment record terverifikasi, dan waktu mulai berlaku. Online booking memerlukan full payment 100%; deposit/minimum amount hanya berlaku pada admin-created manual booking sesuai policy berizin.

Jika bukti pembayaran diterima sebelum deadline tetapi masih `Pending Verification`, sistem/admin menempatkan booking pada `Payment Review Hold`. Inventory tidak dilepas otomatis sampai bukti diterima atau ditolak oleh petugas berizin.

Guarantee berlaku untuk room type dan quantity yang dipesan, bukan nomor kamar tertentu. Front Office tetap dapat mengubah assignment unit selama type, kapasitas, restriction, readiness, serta hak tamu tetap terpenuhi.

## 6. Arrival overdue dan no-show

`Arrival Overdue / Possible No Show` adalah indikator turunan, bukan reservation status dan bukan perintah pelepasan inventory.

Aturan default untuk booking online guaranteed:

- Keterlambatan melewati expected arrival time tidak membatalkan booking.
- Tamu yang datang pukul 00:00 setelah tanggal arrival tetap dapat check-in.
- Bila belum datang sampai business-date rollover/cutoff, sistem memberi alert dan meminta Front Office mencoba menghubungi tamu.
- `Mark No Show` merupakan action manual oleh Front Office/Owner setelah cutoff dan contact attempt dicatat.
- Menandai `No Show` tidak otomatis melepas inventory untuk booking guaranteed.
- Room-type commitment dipertahankan sampai checkout asli untuk seluruh malam yang telah dijamin, kecuali tamu membatalkan atau Front Office berizin melakukan release eksplisit berdasarkan kebijakan yang berlaku.
- Multi-room guaranteed mempertahankan seluruh quantity kecuali customer dan Front Office menyepakati pelepasan sebagian secara eksplisit.

No-show handling dan inventory disposition harus terpisah:

- `Retain Until Original Checkout` — default booking online guaranteed.
- `Release Remaining Nights` — action manual berizin, alasan wajib, policy snapshot ditampilkan, konsekuensi refund/kompensasi dicatat, dan tidak digunakan sebagai default awal.

Sistem tidak boleh menjual ulang inventory yang masih `Retain Until Original Checkout`.

## 7. Late check-in

Jika booking masih `Due In/Arrival Overdue`, Front Office melakukan check-in normal setelah unit assigned dan ready.

Jika booking sudah ditandai `No Show` tetapi inventory masih dipertahankan, Front Office menjalankan `Reinstate and Check In`; tidak diperlukan pencarian inventory baru karena commitment belum dilepas. Sistem tetap memvalidasi assignment, readiness, kapasitas, policy pembayaran, dan audit.

Jika inventory pernah dilepas secara manual, reinstate wajib melakukan availability check baru. Kegagalan availability tidak boleh membuat overbooking; Front Office harus menawarkan alternatif atau menyelesaikan sesuai kebijakan.

Late check-in tidak menggeser checkout, nightly breakdown, atau harga secara otomatis. Perubahan tanggal membutuhkan amend/extension tersendiri dan pemeriksaan inventory baru.

Jika tamu baru datang setelah waktu checkout asli, stay sudah berakhir dan tidak dapat direinstate sebagai check-in biasa. Front Office membuat booking/amend baru sesuai availability dan memproses konsekuensi finansial berdasarkan policy snapshot.

## 8. Exception checklist

Exception minimal:

- Arrival overdue/contact pending.
- Possible no-show belum diputuskan.
- Departure overdue atau late-checkout risk.
- Same-day arrival dengan unit belum ready.
- Booking confirmed belum assigned.
- Pending payment verification/payment overdue.
- Folio outstanding atau pending refund/reversal.
- Housekeeping overdue/failed inspection.
- Maintenance/block conflict.
- Automatic job gagal atau reconciliation mismatch.

Contoh late-checkout risk: kamar seharusnya checkout, tetapi belum checkout dan memiliki arrival berikutnya. Sistem menampilkan booking terdampak, target ready time, alternatif room move/upgrade, serta action checkout, extension, room move, atau contact guest.

### 8.1 Approved early check-in dan late checkout

- ETA/request tidak mengubah stay. Hanya Front Office/Owner berizin yang dapat approve.
- Early check-in memerlukan previous checkout, active assignment, dan `Ready for Check-in`; actual stay menjadi `In House` hanya saat check-in action.
- Late checkout wajib ditolak bila next confirmed guest menunggu/dekat tiba, turnover window tidak cukup, atau properti/type penuh tanpa alternatif valid.
- Approved late checkout intraday membuat Operational Occupancy Block, memperbarui expected checkout serta housekeeping target, dan muncul pada exception/dashboard.
- Bila melewati overnight threshold, gunakan extension; kegagalan inventory mempertahankan checkout lama dan request ditolak.
- Detail tersedia di [EARLY-CHECKIN-LATE-CHECKOUT.md](EARLY-CHECKIN-LATE-CHECKOUT.md).

## 9. Permission, notification, dan audit

- Front Office dapat menghubungi tamu, mencatat contact attempt, menandai no-show, reinstate, dan check-in sesuai permission.
- Front Office dengan permission `Release Guaranteed Inventory` dapat menjalankan action tanpa Owner approval. Action wajib menyimpan contact attempt, reason, policy snapshot, affected nights/quantity, financial consequence, dan audit.
- Sistem menyimpan cutoff, actor, waktu, alasan, contact attempt, inventory disposition, policy version, notifikasi, serta financial consequence.
- Customer late arrival dapat menerima pengingat bahwa kamar masih ditahan tetapi waktu checkout tidak berubah.
- Semua action harus idempotent dan memakai concurrency/version check.

## 10. Minimum acceptance tests

- Booking online tidak memperoleh guarantee classification `Guaranteed` sebelum pembayaran minimum verified.
- Bukti tepat waktu yang masih pending verification menahan inventory sampai review selesai.
- Arrival overdue tidak mengubah booking menjadi no-show dan tidak melepas inventory.
- Booking guaranteed yang belum check-in tetap mengurangi availability sampai checkout asli.
- Tamu guaranteed dapat check-in pukul 00:00 tanpa kehilangan booking; departure date tetap sama.
- Mark no-show pada guaranteed booking mempertahankan inventory dengan disposition default.
- Reinstate booking dengan commitment retained tidak membuat commitment kedua.
- Release remaining nights membutuhkan permission, policy/reason, audit, dan melepas inventory tepat satu kali.
- Daily rollover retry tidak membuat task, alert, atau reconciliation entry ganda.
- Exception yang belum selesai tetap terlihat setelah business date berganti.
- Early/late request tidak mengubah stay tanpa approval/action; approved late checkout conflict tetap terlihat hingga actual checkout selesai.
