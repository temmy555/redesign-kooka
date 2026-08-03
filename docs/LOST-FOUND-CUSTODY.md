# Lost & Found, Chain of Custody, dan Pengembalian — KOOKA Residence

| Informasi | Nilai |
|---|---|
| Versi | 1.0 Draft |
| Tanggal | 1 Agustus 2026 |
| Scope | Phase 1 operational workflow; Phase 2 enhancement |
| Sumber kebutuhan | [PRD.md](PRD.md) |

## 1. Tujuan

Modul ini mencatat barang milik tamu yang ditemukan atau dilaporkan hilang, menjaga rantai penguasaan barang, memverifikasi klaim kepemilikan, serta mengelola pengambilan, pengiriman, dan disposition setelah masa simpan berakhir.

Lost & Found tidak menggunakan lifecycle maintenance atau Guest Damage Incident. Barang milik properti yang rusak/hilang akibat tamu tetap masuk Guest Damage Incident; barang milik tamu yang tertinggal masuk Lost & Found.

Bagasi yang diterima secara resmi sebelum check-in atau setelah checkout bukan Lost & Found. Modul penitipan bagasi ditunda ke Phase 2; Phase 1 memakai SOP/log/tag manual bila layanan diberikan. Bagasi overdue/unclaimed hanya masuk Lost & Found melalui alih custody yang mereferensikan catatan penitipan awal.

## 2. Batas domain dan entitas

Entitas minimum:

- `Found Event`: konteks satu kejadian penemuan; dapat mengelompokkan beberapa barang dari kamar/area dan waktu yang sama.
- `Found Item`: satu barang atau kelompok barang biasa yang dapat dilacak. Barang bernilai tinggi/sensitif selalu memiliki record individual.
- `Lost Inquiry`: laporan tamu mengenai barang yang hilang, meskipun belum ada barang yang cocok.
- `Ownership Claim`: permohonan kepemilikan atas satu Found Item.
- `Custody Event`: perpindahan, penyimpanan, pemeriksaan, sealing, atau perubahan penjagaan barang.
- `Return/Handover`: penyerahan langsung kepada pemilik/perwakilan.
- `Shipment`: pengiriman melalui kurir beserta biaya dan tracking.
- `Storage Location`: lokasi penyimpanan terkendali.
- `Disposition Approval`: persetujuan transfer ke pihak berwenang, donasi, atau pemusnahan.

Satu Lost Inquiry dapat belum memiliki kandidat. Satu Found Item dapat menerima beberapa klaim, tetapi hanya satu pemilik yang dapat berstatus terverifikasi pada satu waktu.

## 3. Status yang dipisahkan

### 3.1 Item custody status

Lifecycle normal:

`Reported → Secured/In Storage → Released`

Outcome terminal setelah release:

- `Returned to Owner`
- `Transferred to Authority`
- `Donated`
- `Disposed`
- `Cancelled/Duplicate`

`Released` bukan bukti bahwa barang telah diterima customer. Outcome, recipient, evidence, serta waktu penyerahan tetap wajib dicatat.

### 3.2 Claim status

`Unclaimed → Claim Submitted → Under Review → Verified`

Jalur lain: `Rejected` atau `Withdrawn`. Rejected claim tidak mengubah status item dan tidak menghapus evidence/reason.

### 3.3 Handover atau shipment status

- Pengambilan: `Pickup Scheduled → Ready for Pickup → Handed Over` atau `Cancelled/Failed`.
- Pengiriman: `Shipment Prepared → Shipped/In Transit → Delivered` atau `Failed/Returned to KOOKA`.

Claim, custody item, dan delivery status tidak boleh digabung menjadi satu field.

## 4. Pencatatan barang ditemukan

Found Item minimal menyimpan:

- Kode unik, contoh `LNF-260801-A12`.
- Tanggal/waktu ditemukan, room unit atau public area, dan booking/room stay bila diketahui.
- Penemu, penerima pertama, serta petugas yang membuat record.
- Kategori, nama/deskripsi, warna, merek, jumlah, dan kondisi.
- Foto seperlunya dengan klasifikasi akses private.
- Lokasi penyimpanan, nomor sealed bag/label bila dipakai.
- Penanda `High Value` atau `Sensitive`.
- Retention policy/version dan calculated retention deadline.
- Catatan dan audit perubahan.

Foto hanya merekam informasi yang diperlukan. Detail rahasia yang dapat dipakai untuk klaim—misalnya isi dompet atau tanda khusus—dapat disimpan sebagai restricted verification attributes dan tidak dibagikan kepada calon pengklaim.

## 5. Chain of custody

Setiap perubahan penguasaan membuat append-only Custody Event yang mencatat:

- Dari siapa/lokasi mana dan kepada siapa/lokasi mana.
- Tanggal/waktu aktual dan petugas pencatat.
- Kondisi sebelum/sesudah.
- Nomor seal/label sebelum/sesudah bila relevan.
- Alasan atau action, seperti `Found`, `Secured`, `Moved Storage`, `Taken for Verification`, `Returned`, atau `Disposed`.
- Tanda tangan/foto/evidence opsional sesuai tingkat risiko.

Custody Event tidak diedit atau dihapus. Koreksi dibuat sebagai event baru yang merujuk event sebelumnya dan menjelaskan alasan. Sistem memberi exception apabila barang belum diamankan, lokasi tidak diketahui, atau urutan custody mempunyai gap.

## 6. Barang bernilai tinggi atau sensitif

Kategori minimal meliputi uang tunai, kartu bank, KTP/paspor/dokumen identitas, kunci, obat, perhiasan, telepon/laptop, serta barang berbahaya atau mudah rusak.

Kontrol tambahan:

- Penyimpanan terkunci dengan permission terbatas dan access audit.
- Detail/foto tidak tampil pada shared display, notifikasi biasa, export umum, atau pencarian customer.
- Uang tunai menyimpan nominal dan mata uang dengan verifikasi dua staf; transaksi ini bukan payment booking atau folio entry.
- Sealed bag/label dan dua-person handover dapat diwajibkan per kategori.
- Disposition high-value/sensitive memerlukan Owner/Super Admin atau role khusus.
- Dokumen identitas, kartu bank, uang tunai, obat, dan barang berbahaya mengikuti kebijakan khusus serta validasi aturan lokal sebelum diserahkan ke pihak berwenang atau dimusnahkan.

## 7. Lost Inquiry dan matching

Front Office membuat Lost Inquiry dari laporan via WhatsApp, email, telepon, atau tatap muka karena customer tidak memiliki login.

Data minimum:

- Nama dan kontak pelapor.
- Booking code, tanggal menginap, room/area bila diketahui.
- Deskripsi barang, ciri rahasia, perkiraan lokasi/waktu terakhir terlihat.
- Search status, petugas, catatan pencarian, dan candidate Found Items.

Sistem tidak menampilkan daftar lengkap atau foto penuh semua barang kepada customer. Matching Phase 1 dilakukan manual; kandidat hanya membantu staf menelusuri item dan tidak membuktikan kepemilikan.

## 8. Verifikasi klaim kepemilikan

Booking code saja tidak cukup untuk barang bernilai tinggi. Verifikasi dapat menggunakan kombinasi:

- Booking code dan kecocokan kontak booking.
- Deskripsi/ciri rahasia yang belum pernah diinformasikan staf.
- Lokasi serta waktu kehilangan.
- Bukti kepemilikan, seperti serial number atau foto lama.
- Pemeriksaan identitas secara visual saat pengambilan jika proporsional.

Hasil verifikasi mencatat reviewer, waktu, evidence reference, keputusan, dan alasan. Sistem tidak menyimpan salinan identitas baru bila pemeriksaan visual sudah cukup. Klaim ganda atau meragukan dieskalasikan dan barang tetap disimpan.

## 9. Pengambilan langsung dan perwakilan

Handover langsung mencatat:

- Jadwal dan waktu aktual.
- Petugas yang menyerahkan.
- Penerima, metode pemeriksaan identitas minimum, dan hubungan dengan claimant.
- Kondisi barang.
- Receipt/tanda tangan digital opsional melalui tablet atau perangkat lain.

Perwakilan memerlukan nama, otorisasi dari verified claimant, dan verification note. Tanda tangan Lost & Found menjadi dokumen serah-terima tersendiri; tidak memakai atau mengubah tanda tangan registrasi check-in.

## 10. Pengiriman dan biaya

Shipment menyimpan alamat sebagai data sensitif, courier, service, tracking number, biaya, pihak pembayar, dispatch time, proof, serta delivery outcome.

- Biaya pengiriman dapat ditagihkan melalui standalone invoice/receipt dan pembayaran manual.
- Folio stay yang sudah ditutup tidak dibuka kembali hanya untuk biaya pengiriman.
- Jika folio masih open, penggunaan folio hanya boleh dilakukan sesuai policy, permission, dan persetujuan payer.
- Kegagalan atau barang kembali ke KOOKA membuat custody event baru dan mengembalikan item ke storage, bukan dianggap delivered.
- Tanggung jawab, asuransi, dan jenis kurir untuk high-value item harus ditetapkan dalam kebijakan sebelum digunakan.

## 11. Retention dan disposition

Retention dikonfigurasi berdasarkan kategori dan versi kebijakan:

- Barang berbahaya, mudah rusak, atau higienis mempunyai masa simpan singkat.
- Barang biasa mempunyai masa simpan standar.
- High-value item mempunyai masa simpan dan approval lebih ketat.
- Identitas, kartu bank, uang tunai, obat, dan kunci mengikuti kebijakan khusus.

Sebelum disposition, sistem memeriksa deadline, active claim/inquiry, dispute/hold, contact attempt yang diwajibkan, permission/approval, dan local-policy requirement. Disposal, donation, atau authority transfer membuat custody event dan evidence. Periode final ditetapkan Owner setelah kebijakan lokal divalidasi; tidak di-hard-code tanpa persetujuan.

## 12. Hubungan dengan housekeeping, maintenance, dan damage

- Cleaning dapat membuat Found Event/Found Item langsung dari cleaning task.
- Menemukan barang tidak mengubah occupancy, housekeeping condition, room readiness, reservation, stay, atau folio.
- Barang berbahaya dapat membuat Cleaning/Maintenance Issue terpisah dengan cross-reference.
- Barang tamu yang ditemukan tidak otomatis membuat Guest Damage Charge.
- Barang milik KOOKA yang rusak/hilang dan diduga menjadi tanggung jawab tamu masuk Guest Damage Incident, bukan Lost & Found milik tamu.
- Pembuatan Lost & Found tidak menutup cleaning task secara otomatis; checklist cleaning tetap harus selesai.

## 13. Notifikasi

Notifikasi customer dapat digunakan untuk:

- Memberi tahu bahwa kandidat barang ditemukan tanpa mengungkap detail rahasia.
- Meminta informasi verifikasi.
- Mengonfirmasi klaim, jadwal pickup, handover, pengiriman, tracking, delivery, atau kegagalan pengiriman.
- Memberi pengingat sebelum retention deadline bila diwajibkan policy.

Alert internal minimum:

- High-value/sensitive item baru.
- Barang `Reported` tetapi belum `Secured`.
- Claim menunggu review atau terjadi multiple claims.
- Pickup overdue, shipment failed/returned, atau retention deadline mendekat.
- Custody gap, seal mismatch, atau disposition menunggu approval.

Pesan tidak memuat foto penuh, ciri rahasia, alamat lengkap, isi dokumen, atau lokasi storage.

## 14. Dashboard dan laporan

Dashboard minimum menampilkan jumlah unsecured item, high-value item, claim pending, pickup overdue, shipment failed, retention deadline mendekat, disposition pending, dan custody exception.

Report minimum:

- Found Items menurut waktu, lokasi, kategori, dan status.
- Time-to-secure, custody gaps, dan transfer history.
- Claim submitted/verified/rejected dan waktu penyelesaian.
- Pickup/shipment outcome serta biaya pengiriman, terpisah dari revenue kamar.
- Retention/disposition menurut policy version, approver, dan outcome.

Export mengikuti RBAC, masking, secure short-lived download, dan audit.

## 15. Permission dan audit

- Cleaning: melaporkan barang, foto minimum, dan menyerahkan kepada lokasi/petugas yang ditentukan; tidak memverifikasi klaim atau melakukan disposition.
- Front Office: membuat inquiry, matching, memproses klaim/pickup/shipment, dan mengelola barang biasa sesuai izin.
- Owner/Super Admin: menangani high-value exception, klaim konflik, authority transfer, donation/disposal, serta policy/retention.

Audit wajib untuk create/update item, sensitive view/download, claim decision, custody transfer, storage change, seal change, handover/signature, shipment, retention override, disposition, export, dan correction. Audit tidak menyalin file, ciri rahasia, nomor identitas, atau alamat lengkap.

## 16. Phase delivery

### Phase 1

- Found Event/Item, Lost Inquiry, manual matching, claim verification, storage location, append-only custody, pickup/shipping manual, optional tablet signature receipt, manual/email notification, configurable retention/disposition, RBAC, audit, dashboard, dan basic report.

### Phase 2

- Barcode/QR label, matching assistance, richer storage dashboard, bulk inventory check, dan shipping workflow yang lebih lengkap.
- Penitipan bagasi dengan record/tag unik, status penerimaan/penyimpanan/pengambilan, exception overdue/unclaimed, dan konversi terkontrol ke Lost & Found.

### Phase 3

- Courier integration hanya jika volume serta manfaat operasional membenarkan kompleksitasnya.

Customer self-service portal tidak direkomendasikan pada fase awal; laporan dan klaim tetap melalui Front Office.

## 17. Minimum acceptance tests

- Cleaning dapat membuat Found Item dari task tanpa mengubah occupancy/readiness atau menyelesaikan cleaning otomatis.
- Setiap item memperoleh kode unik dan retention deadline berdasarkan policy version.
- High-value item tidak dapat digabung sebagai satu record umum dan memerlukan kontrol tambahan.
- Perpindahan barang selalu membuat append-only Custody Event; correction tidak menimpa event lama.
- Sistem memberi exception pada unsecured item, unknown storage, custody gap, atau seal mismatch.
- Lost Inquiry dapat disimpan tanpa Found Item dan kandidat tidak otomatis memverifikasi claim.
- Booking code saja ditolak sebagai satu-satunya bukti klaim high-value.
- Hanya satu verified owner aktif per Found Item; multiple claim dieskalasikan.
- Pickup oleh perwakilan memerlukan authorization note dan evidence minimum.
- Tanda tangan handover terpisah dari check-in signature.
- Failed/returned shipment mengembalikan barang ke custody/storage dan tidak dianggap delivered.
- Closed folio tidak dibuka otomatis untuk shipping charge.
- Barang dengan active claim/hold tidak dapat didisposition karena deadline.
- Cleaning tidak dapat melihat claim evidence/address; shared display dan notification tidak mengekspos foto/detail sensitif.
- Lost & Found tidak otomatis membuat maintenance issue, Guest Damage Charge, payment, atau folio posting.

## 18. Keputusan sebelum implementasi

- Masa simpan per kategori dan aturan lokal untuk uang, identitas, kartu, obat, serta barang berbahaya.
- Definisi serta threshold `High Value`.
- Lokasi storage, penomoran bag/seal, dan kebutuhan dual custody.
- Role verifier claim, approver disposition, dan dua-person cash verification.
- Kebijakan perwakilan, minimum identity check, dan receipt/signature.
- Kurir, asuransi, biaya, tanggung jawab, serta allowed destination.
- Jumlah contact attempt dan waktu pemberitahuan sebelum disposition.
- Format kode item dan kebutuhan barcode/QR Phase 2.
