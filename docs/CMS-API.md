# CMS dan Public Landing API

Dokumen ini menjelaskan implementasi Technical Batch 4 untuk landing page Versi 01, konten bilingual, dan media autentik KOOKA. Seluruh route berada di aplikasi Next.js yang sama; tidak ada CMS atau API service terpisah.

## Batas source of truth

- CMS mengelola editorial copy, urutan section, translation, dan hubungan media.
- Operational master tetap menjadi sumber resmi room type, kapasitas, extra bed, amenity, rate, tax, dan availability.
- Draft CMS ditolak apabila mencoba menyimpan field operasional seperti price, rate, capacity, availability, tax, atau inventory.
- Landing hanya menampilkan room type yang aktif dan memiliki media autentik berstatus `PUBLISHED` serta file scan `CLEAN`.
- IDR adalah mata uang transaksi. IDR/USD/AUD pada landing adalah preferensi tampilan yang diteruskan ke pencarian booking; konversi harga memakai quote/rate snapshot pada domain booking, bukan CMS.

## Public route

### `GET /api/content/landing?locale=id|en`

Menghasilkan section landing yang sudah dipublikasikan dan room data dari operational master. `locale` default `id`. Response dapat di-cache singkat dengan stale revalidation.

Jika belum ada revisi CMS yang dipublikasikan, route menggunakan approved bilingual baseline yang tidak memuat harga, kapasitas, testimonial, atau klaim jarak yang belum diverifikasi.

### `GET /api/content/media/:assetId`

Mengirim image public hanya jika media berstatus `PUBLISHED`, file lulus scan, belum dipurge, dan klasifikasinya memang `PUBLIC_CONTENT/CMS_MEDIA`. Nama/path storage internal tidak diekspos.

### `GET /booking?...`

Menerima `checkInDate`, `checkoutDate`, `rooms`, `adults`, `children`, `infants`, `locale`, dan `currency`. Halaman memanggil availability resmi dan menampilkan hasil menurut room type. Tahap saat ini menyediakan pencarian dan jalur menghubungi Front Office; checkout booking penuh tetap mengikuti domain reservation yang sudah tersedia dan perlu UI lanjutan sebelum UAT customer.

### `GET /preview?token=...&locale=id|en`

Preview dilindungi token HMAC berumur maksimum 60 menit dan selalu `noindex`. Token mengikat property serta page version; preview tidak mengubah status publikasi.

## Staff CMS route

Seluruh route staff memakai session, active property, RBAC, audit, dan error contract yang sama dengan aplikasi utama.

### `GET /api/staff/admin/content`

Menampilkan page/revision overview.

### `POST /api/staff/admin/content`

Action:

- `CREATE_DRAFT`: membuat revisi bilingual atomik.
- `SUBMIT_REVIEW`: memindahkan draft ke `IN_REVIEW`.
- `PUBLISH`: memublikasikan revisi yang lolos readiness gate dan mengarsipkan versi publik sebelumnya.
- `RESTORE`: menyalin versi lama menjadi draft baru; history tidak ditimpa.
- `CREATE_PREVIEW`: membuat preview token sementara.

Publication gate mewajibkan section `HERO`, `TRUST_STRIP`, `ROOM_COLLECTION`, `EDITORIAL_FEATURE`, `LOCATION`, `FAQ`, dan `CTA`; translation Indonesia/English lengkap; serta hero memakai media properti autentik yang sudah dipublikasikan dan lulus scan.

## Staff media route

### `GET /api/staff/admin/media`

Menampilkan status asset, metadata hak penggunaan, status scan, dan ukuran file.

### `POST /api/staff/admin/media`

Multipart upload image dengan field `file`, `title`, `altId`, `altEn`, `captionId`, `captionEn`, `rightsSource`, dan `authenticPropertyMedia`. Upload selalu masuk private staging dengan status asset `DRAFT` dan status scan file `PENDING`.

### `PATCH /api/staff/admin/media`

Action:

- `PUBLISH`: hanya setelah scan `CLEAN`, rights source dan alt text bilingual lengkap.
- `ARCHIVE`: menghentikan penggunaan public tanpa menghapus history.
- `LINK`: mengaitkan media ke `CONTENT_SECTION`, `ROOM_TYPE_HERO`, atau `ROOM_TYPE_GALLERY` dengan target dan urutan tervalidasi dalam property yang sama.

## Permission baseline

- Owner: view/edit/review/publish/preview content dan manage/publish media.
- Front Office: view/edit/preview content dan manage media.
- Front Office tidak dapat memublikasikan content/media pada baseline; Owner melakukan publication control.

Semua perubahan sensitif menyimpan actor, target, before/after yang relevan, reason, dan timestamp dalam audit log. Publication juga membuat transactional outbox event `cms.content.published`.

## Batas sebelum UAT/production

- Final bilingual copy, foto asli per room type, verified testimonial, alamat/jarak, FAQ/policy, dan official contact harus diisi Owner.
- AV engine nyata harus dihubungkan ke hook malware scan; media `PENDING` tidak dapat dipublikasikan.
- Sumber kurs, refresh/stale threshold, rounding, dan label estimasi USD/AUD harus dikonfigurasi.
- Migration `0010` sudah lulus pada PostgreSQL disposable; penerapan ke development utama/UAT dan accessibility/browser/performance QA tetap wajib sebelum production.
- UI staff visual untuk mengoperasikan CMS belum menjadi bagian route implementation ini; API dan domain workflow sudah tersedia.
