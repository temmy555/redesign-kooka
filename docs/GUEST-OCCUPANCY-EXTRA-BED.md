# Guest, Occupancy, Flexible Billing, dan Extra Bed — KOOKA Residence

Dokumen keputusan produk untuk Phase 1 dan fondasi group booking Phase 2.

- Status: disetujui untuk PRD.
- Scope: booker/guest roles, multi-room stay, partial check-in/out, flexible billing, room capacity, extra guest, serta extra bed.
- Sumber kebutuhan: [PRD.md](PRD.md).

## 1. Prinsip utama

- Orang yang memesan tidak selalu menjadi orang yang menginap atau membayar.
- Reservation, stay per kamar, guest registration, room assignment, dan billing harus dapat ditelusuri tanpa disatukan menjadi satu status.
- Satu booking memiliki satu master folio; combined maupun split billing tidak menduplikasi charge.
- Batas maksimum tamu adalah physical/safety constraint dan tidak dapat dilewati oleh override harga.
- Extra guest dan extra bed adalah dua konsep berbeda.
- Extra bed adalah `Accommodation Add-on`, bukan generic service/tour.

## 2. Peran orang dan organisasi

Peran minimal:

- `Booker/Booking Contact`: membuat booking, memiliki email lookup, menerima kode booking dan komunikasi.
- `Primary Guest`: tamu utama yang bertanggung jawab atas masa inap secara keseluruhan.
- `Room Lead Guest`: tamu utama untuk satu kamar/stay.
- `Additional Guest`: penghuni tambahan pada kamar.
- `Payer`: orang/perusahaan yang bertanggung jawab membayar charge tertentu.
- `Invoice Recipient`: orang/perusahaan yang menerima dokumen tertentu.
- `Authorized Contact`: kontak tambahan yang boleh berkoordinasi atau meminta perubahan sesuai scope izin; penuh pada Phase 2.

Satu person dapat memegang beberapa peran. Relasi peran disimpan pada booking/stay dan tidak dicampur menjadi satu field `customer_name`.

## 3. Struktur booking dan stay

- Satu booking memiliki satu atau lebih booking line.
- Setiap kamar yang benar-benar digunakan memiliki satu stay instance dan room assignment sendiri.
- Setiap stay minimal memiliki satu `Room Lead Guest` sebelum check-in kamar tersebut.
- Nama Room Lead Guest wajib; foto/nomor identitas/KTP dan tanda tangan selalu opsional pada Phase 1 dan dapat dilewati tanpa check-in block.
- Additional guest dapat ditambahkan sebelum atau saat check-in tanpa harus membuat akun customer.
- Guest registration dan data identitas melekat pada guest/stay yang benar, bukan otomatis pada Booker.

Multi-room mendukung check-in dan checkout per kamar. Indikator booking seperti `Partially Checked In` dan `Partially Checked Out` dihitung dari stay instances dan bukan reservation status baru.

## 4. Customer lookup dan privasi

- Lookup Phase 1 menggunakan booking code; email Booker bersifat opsional sebagai verifikasi tambahan.
- Booker dapat melihat ringkasan kamar, tanggal, room type, tagihan/dokumen yang memang ditujukan kepadanya, dan status umum.
- Lookup tidak menampilkan KTP, foto, tanda tangan, nomor identitas, atau data sensitif penghuni lain.
- Pergantian Booker/email utama dilakukan Front Office melalui verifikasi, alasan, dan audit.
- Group contact tidak otomatis memperoleh akses ke data identitas seluruh peserta.

## 5. Flexible billing untuk multi-room dan group

Satu booking tetap memiliki satu master folio. Setiap folio entry menyimpan sumber yang dapat ditelusuri: booking line, stay/room, guest/order, service date, charge category, dan payer/billing bucket bila ditentukan.

Invoice dapat dibuat sebagai:

- `Combined`: semua charge terpilih menjadi satu invoice.
- `Per Room`: satu invoice per kamar/stay.
- `Per Payer/Guest`: charge dikelompokkan berdasarkan payer yang ditentukan.
- `Room Only`: hanya room charge beserta tax/service component terkait.
- `Extras Only`: extra bed, extra guest, POS, service/tour, dan ancillary lain yang dipilih.
- `Custom Selection`: pilihan entry oleh admin berizin.

Aturan:

- Charge hanya diposting satu kali ke master folio.
- Satu charge/tax component tidak boleh berada pada dua active final invoices.
- Combined maupun split menggunakan nominal dan tax snapshot yang sama.
- Invoice recipient dapat berbeda per invoice tanpa mengubah Booker.
- Verified payment tetap satu payment entry dan dapat dialokasikan ke satu atau beberapa invoice tanpa membuat payment baru.
- Sebelum invoice final diterbitkan, admin dapat memindahkan whole charge ke billing bucket lain dengan reason dan audit.
- Setelah invoice issued, perubahan menggunakan void/supersede/reversal dan dokumen baru; invoice lama tidak diedit.
- Pembagian sebagian dari satu charge tidak dilakukan dengan menggandakan entry. Source charge harus sudah dipecah secara sah atau dikoreksi melalui reversal dan posting baru.

Rekomendasi Phase 1: combined, per-room, room-only, extras-only, dan custom selection ringan. Phase 2 menambahkan payer routing rules, company/master billing, authorized contacts, dan rooming-list billing penuh.

## 6. Model kapasitas kamar

Room type minimal memiliki konfigurasi:

- `standard_adults` dan `standard_children` atau standard occupancy yang setara.
- `max_adults`, `max_children`, dan `max_total_guests`.
- Bed configuration standar.
- `extra_bed_allowed`.
- `max_extra_beds` per kamar.
- Penambahan kapasitas per extra bed.
- Batas/aturan umur adult, child, dan infant yang dapat dikonfigurasi.
- Apakah guest di atas standard occupancy wajib extra bed atau boleh menggunakan existing bed sesuai policy.

Default kelompok usia yang disetujui untuk konfigurasi awal adalah `Infant 0–2`, `Child 3–11`, dan `Adult 12+`. Nilai ini tetap configurable/versioned dan dapat disesuaikan sebelum go-live bila house rules final berbeda. Semua kelompok tetap dicatat dalam total penghuni untuk kebutuhan keselamatan dan occupancy.

Room unit dapat memiliki override berizin bila kondisi fisik unit berbeda dari default room type. Override tidak boleh melebihi batas keselamatan yang ditetapkan properti.

Jika jumlah tamu melebihi `max_total_guests`, room type tidak tersedia walaupun customer bersedia membayar. Sistem menawarkan room type lain atau tambahan kamar.

Model kapasitas, hard maximum, unit override berizin, extra-bed eligibility, dan resource locking telah disetujui. Nilai kapasitas aktual per room type/unit serta jumlah fisik extra bed masih menunggu data properti dan tidak boleh diisi dengan angka perkiraan sebagai konfigurasi produksi.

Workflow minimum age/minor/guardian khusus ditunda ke Phase 2. Phase 1 tetap memakai adult/child/infant count dan capacity guard hanya untuk okupansi, tetapi tidak menyediakan field atau validasi minimum usia Booker/Room Lead Guest, adult-per-room guard, guardian linkage, atau family/group age exception. Room Lead Guest tetap digunakan sebagai penanggung jawab operasional kamar tanpa age verification. Bila KOOKA memiliki house rule usia, pemeriksaannya dilakukan manual di luar sistem; dokumen usia anak tidak dikumpulkan secara default.

## 7. Extra guest dan extra bed

`Extra Guest` adalah tambahan penghuni/occupancy dan dapat memiliki charge berdasarkan policy. `Extra Bed` adalah fasilitas fisik tambahan. Keduanya dapat terjadi bersama atau terpisah.

Contoh:

- Anak menggunakan existing bed: mungkin ada extra-guest charge tetapi tidak ada extra bed.
- Dua tamu standard meminta tempat tidur terpisah: dapat ada extra-bed charge tanpa menambah guest count, jika kamar mengizinkan.
- Tamu ketiga: membutuhkan extra guest dan satu extra bed bila aturan room type mensyaratkannya.

Extra bed dimodelkan sebagai `Accommodation Add-on` karena:

- Terikat pada booking line/stay dan room assignment.
- Memengaruhi validasi kapasitas serta room move.
- Umumnya dikenakan per malam atau per stay.
- Memerlukan setup/removal oleh Housekeeping.
- Dapat memiliki stok fisik terbatas.

Charge basis awal adalah `Per Night`. Jumlah stok fisik dan keputusan apakah resource memakai mode `Inventory Tracked` atau `Non-Inventory Tracked` masih menunggu verifikasi operasional.

Extra bed tidak memakai lifecycle service/tour seperti `Reserved/In Progress/Completed`. Lifecycle-nya mengikuti add-on allocation dan operational setup.

## 8. Resource inventory extra bed

Jika jumlah extra bed fisik terbatas, master add-on menyimpan shared resource pool dengan quantity. Allocation dibuat per malam menggunakan interval `[check-in, checkout)`.

Status allocation minimal:

- `Held`: ditahan bersama checkout/payment hold.
- `Committed`: booking confirmed.
- `Assigned`: dialokasikan ke room unit untuk setup.
- `Released`: dibatalkan, expired, checkout, atau tidak lagi diperlukan.

Room inventory dan extra-bed inventory diperiksa serta dikunci dalam transaction yang sama. Jika kamar tersedia tetapi extra bed wajib tidak tersedia, booking tidak boleh berhasil sebagian.

Jika KOOKA tidak perlu melacak stok, add-on dapat dikonfigurasi `Non-Inventory Tracked`; kemampuan room type dan maximum extra beds tetap divalidasi.

## 9. Booking dan amend flow

1. Customer memilih jumlah adult/child dan distribusi tamu per kamar.
2. Sistem memeriksa standard occupancy, maximum occupancy, dan extra-bed rule.
3. Sistem menawarkan atau mewajibkan extra bed sesuai room policy.
4. Harga, unit charge, jumlah malam, tax/service, dan total IDR ditampilkan transparan.
5. Final booking mengunci room inventory dan required extra-bed resource secara atomik.
6. Booking menyimpan price/rule snapshot.

Tambah/hapus extra bed, perubahan guest count, perubahan tanggal, dan room move selalu melakukan validation serta availability check ulang. Kegagalan mempertahankan konfigurasi lama.

Room move hanya boleh menuju kamar yang memenuhi occupancy dan extra-bed rule. Allocation extra bed dipindahkan ke unit baru secara atomik dan setup/removal task dibuat sesuai kebutuhan.

## 10. Pricing, folio, dan tax

Extra bed memiliki:

- Harga IDR.
- Charge basis configurable: `Per Night` atau `Per Stay`; rekomendasi default `Per Night`.
- Quantity dan nightly/service-date breakdown.
- Tax/service profile versioned atau `No Tax`.
- Price/policy snapshot pada booking.

Charge masuk master folio sebagai kategori `Accommodation Add-on / Extra Bed`, bukan `Service/Tour`. Extra-guest charge menggunakan kategori terpisah agar laporan serta kebijakan dapat dibedakan.

Extra-bed/extra-guest charge dapat muncul pada combined invoice, invoice kamar, extras-only invoice, payer invoice, atau custom invoice tanpa mengubah nilai sumbernya.

## 11. Housekeeping dan readiness

- Booking confirmed dengan extra bed membuat task `Extra Bed Setup` untuk room unit setelah assignment tersedia.
- Task menampilkan quantity, target ready time, catatan setup, dan room move bila ada.
- Checkout/cancellation/room move dapat membuat task `Extra Bed Removal/Relocation`.
- Bila extra bed merupakan requirement booking yang sudah dibayar, setup menjadi bagian arrival-readiness checklist. Override membutuhkan alasan dan konfirmasi bahwa tamu sudah diinformasikan.
- Housekeeping hanya melihat informasi operasional yang diperlukan dan tidak melihat billing atau dokumen identitas.

## 12. Permission dan audit

- Front Office dapat mengubah guest allocation, add/remove extra bed, memilih billing scope, dan invoice recipient sesuai permission.
- Override harga, complimentary extra bed, payer transfer, dan invoice correction dapat dilakukan Front Office berizin dengan reason/audit tanpa Owner approval; perubahan capacity master tetap high-risk configuration Owner.
- Maximum physical occupancy tidak dapat di-override oleh role mana pun.
- Audit menyimpan guest/room allocation, capacity calculation, extra-bed allocation, harga, payer/billing bucket, invoice coverage, aktor, waktu, dan alasan.

## 13. Minimum acceptance tests

- Booker dapat berbeda dari Primary Guest, Room Lead Guest, Payer, dan Invoice Recipient.
- Setiap room stay memiliki Room Lead Guest sebelum check-in; KTP/foto/tanda tangan tetap opsional.
- Multi-room dapat partially check-in/out tanpa mengubah reservation status secara keliru.
- Satu master folio dapat menghasilkan combined atau split invoice tanpa charge/tax ganda.
- Invoice dapat dipisah per room, payer, room-only, extras-only, atau custom selection.
- Guest count di atas maximum occupancy ditolak untuk semua role.
- Kamar yang tidak mengizinkan extra bed tidak dapat dipesan dengan required extra bed.
- Booking terakhir untuk stok extra bed terbatas hanya berhasil satu kali pada concurrent request.
- Booking room + required extra bed berhasil atau gagal seluruhnya.
- Extra-bed charge memiliki nightly/service-date breakdown serta tax snapshot.
- Extra-bed setup/removal task dibuat idempotent dan mengikuti room move.
- Menghapus/amend extra bed tidak menghapus histori folio; gunakan reversal/adjustment sesuai lifecycle.
