# Mobile-first Employee Attendance

| Informasi                   | Nilai                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status                      | Attendance MVP mode bebas telah diimplementasikan: selfie privat, geofence server-side, check-in/out persisten, riwayat, laporan date range, dan Excel |
| Workstream                  | Phase 1B — Employee Attendance MVP dalam aplikasi utama                                                                                                |
| Tanggal keputusan           | 2 Agustus 2026                                                                                                                                         |
| Deployment                  | Satu deployable web application bersama landing, booking, dan admin                                                                                    |
| Hubungan dengan lodging MVP | Satu project; bukan launch gate Phase 1A lodging                                                                                                       |

## 1. Tujuan

KOOKA membutuhkan tampilan absensi mobile-first agar karyawan dapat melakukan absensi melalui browser ponsel atau tablet dengan:

- selfie yang diambil langsung saat absensi;
- lokasi perangkat yang harus berada di titik kerja yang telah dikonfigurasi;
- mode shift terjadwal; atau
- mode bebas tanpa shift yang tetap membentuk pasangan check-in dan check-out.

Modul ini berada di aplikasi KOOKA yang sama, bukan aplikasi native atau layanan API terpisah. Tujuannya adalah menghasilkan catatan kehadiran yang dapat dipercaya, mudah dipakai, dan dapat diaudit.

## 2. Keputusan deployment dan route

- Landing page, booking, customer lookup, admin operasional, admin attendance, dan employee attendance dibangun sebagai satu modular web application dan dideploy satu kali.
- Employee membuka route mobile-first `/staff/attendance`; route ini dapat dibuat installable sebagai PWA tanpa distribusi App Store/Play Store.
- Admin mengelola titik absensi melalui `Pengaturan → Absensi` pada `/staff/admin` di aplikasi yang sama.
- Server route handler untuk mutasi dan pembacaan data tetap berada dalam codebase, runtime, domain service, database, dan deployment yang sama. Route handler bukan microservice atau produk API terpisah.
- Semua route memakai identity, session, RBAC, audit, private storage, configuration, dan observability yang sama.
- Boundary modular tetap dipertahankan agar attendance tidak bercampur dengan reservation/folio, walaupun deployment-nya satu.

## 3. Rekomendasi batas MVP

### Route mobile-first karyawan

- Login memakai akun staf individual yang sama dengan platform KOOKA.
- Melihat status absensi hari ini: belum masuk, sedang bekerja, atau sudah selesai.
- Check-in dan check-out menggunakan kamera depan serta lokasi saat itu.
- Kamera otomatis aktif saat pertama membuka tab `Absen`, lalu dihentikan ketika pindah ke `Riwayat`/`Laporan`, selfie sudah diambil, atau halaman masuk background. Saat kembali dari background, karyawan mengaktifkannya lagi secara eksplisit; UI menyediakan `Aktifkan kamera`, `Matikan kamera`, dan `Ambil ulang`.
- Melihat riwayat absensi sendiri.
- Logout dan revoke session/perangkat bila ponsel hilang.
- Tidak menampilkan jadwal/shift hari ini dan tidak menyediakan form koreksi mandiri.

### Route admin attendance

- Mengelola employee profile minimum dan menghubungkannya dengan User/RBAC tanpa membuat akun ganda.
- Mengelola satu atau beberapa `Attendance Location` dengan latitude, longitude, radius, dan minimum GPS accuracy.
- Mengelola `Shift Template` serta assignment karyawan/tanggal.
- Menetapkan mode absensi per karyawan atau per assignment: `Scheduled Shift` atau `Free Mode`.
- Melihat kehadiran harian, keterlambatan, check-out belum lengkap, dan kejadian di luar geofence.
- Setelah karyawan meminta langsung di luar sistem, admin berizin melakukan koreksi dengan before/after value, alasan, actor, dan audit log; event asli tidak dihapus.
- Mengekspor rekap Excel berdasarkan rentang tanggal/karyawan/lokasi/status.

## 4. Mode absensi

### 4.1 Scheduled Shift

- Admin membuat shift template berisi nama, waktu mulai, waktu selesai, timezone, check-in window, dan tolerance keterlambatan.
- Shift di-assign kepada karyawan pada tanggal tertentu.
- Check-in/out ditautkan ke shift assignment yang tepat.
- `Early`, `On Time`, `Late`, durasi kerja, atau exception merupakan hasil perhitungan; bukan alasan untuk menolak absensi yang valid secara lokasi/selfie kecuali kebijakan menyatakan lain.
- Shift lintas tengah malam harus didukung tanpa memecah attendance session secara keliru.

### 4.2 Free Mode

- Karyawan tidak memerlukan shift assignment untuk check-in.
- Check-in membuka satu attendance session dan check-out menutup session tersebut.
- Sistem mencegah dua session terbuka untuk karyawan yang sama.
- Batas maksimum session dan penanganan lupa check-out configurable; sistem tidak membuat check-out fiktif tanpa aturan dan audit.
- Free Mode bukan izin untuk absen dari sembarang tempat; geofence tetap berlaku kecuali ada correction/override berizin.

## 5. Selfie dan geofence

- Selfie diambil langsung dari kamera pada setiap check-in dan check-out; upload dari galeri tidak menjadi default MVP.
- Selfie hanya menjadi bukti kehadiran dan tidak digunakan untuk facial recognition/biometric matching pada MVP.
- File disimpan melalui private file-storage adapter—persistent local VPS volume pada Phase 1—dan tidak berada di URL publik, log, analytics, notification, atau export umum.
- Akses selfie dibatasi kepada Owner/Super Admin dan attendance admin yang diberi permission eksplisit; setiap view/download diaudit.
- Setiap attendance event menyimpan lokasi, GPS accuracy, waktu perangkat sebagai diagnostic metadata, dan waktu server sebagai waktu resmi.
- Server menghitung jarak terhadap titik yang dikonfigurasi. Client tidak boleh menentukan sendiri hasil `inside/outside geofence`.
- Radius geofence dan minimum accuracy configurable per lokasi.
- Lokasi tidak dilacak terus-menerus. Browser hanya meminta lokasi ketika karyawan menjalankan absensi.
- Stream kamera juga tidak dibiarkan hidup terus-menerus. Status `Kamera siap` hanya tampil bila video benar-benar sedang memutar stream aktif; stream yang dijeda tidak menampilkan panduan wajah seolah kamera masih hidup.
- MVP tidak menjanjikan pencegahan GPS spoofing secara mutlak. Sistem dapat menyimpan risk signal/device metadata dan mengirim kasus meragukan ke review tanpa tuduhan otomatis.
- Check-in/out reguler memerlukan koneksi ke server. Bila jaringan/perangkat gagal atau karyawan lupa checkout, karyawan menghubungi admin secara langsung; admin berizin mencatat actual time/reason/evidence secara auditabel.

## 6. Status yang harus dipisahkan

| Domain             | Status minimum                                   |
| ------------------ | ------------------------------------------------ |
| Shift Assignment   | `Scheduled`, `Cancelled`, `Completed`            |
| Attendance Session | `Open`, `Completed`, `Exception`, `Corrected`    |
| Attendance Event   | `Accepted`, `Needs Review`, `Rejected`, `Voided` |

- Check-in dan check-out adalah event append-only.
- Koreksi membuat correction record/event baru; tidak menimpa foto, lokasi, timestamp, atau actor asli.
- Attendance status tidak digabung dengan User status, employment status, atau payroll status.

## 7. Model data minimum

- `EmployeeProfile`: user reference, employee code, display name, active state, default attendance mode.
- `AttendanceLocation`: name, coordinates, radius, minimum accuracy, active/effective period.
- `ShiftTemplate`: name, start/end time, check-in window, late tolerance, timezone.
- `ShiftAssignment`: employee, business date, template, location/allowed locations, status.
- `AttendanceSession`: employee, mode, business date, shift assignment optional, check-in/out summaries, calculated duration, exception flags.
- `AttendanceEvent`: session, event type, server time, device time, coordinates, accuracy, geofence result, distance, selfie object reference, device/session metadata, status.
- `AttendanceCorrection`: target event/session, corrected values, mandatory reason, evidence optional, admin actor, correction timestamp, dan before/after snapshot.
- `AuditEvent`: actor, action, target, timestamp, reason, before/after, device/session reference.

## 8. Arsitektur satu aplikasi dan route handler

- Gunakan satu modular monolith dan satu database source of truth untuk landing/booking, admin, serta attendance.
- Sediakan UI route mobile-first dan admin route di aplikasi yang sama; jangan membuat backend, API service, repository, atau deployment kedua khusus attendance.
- Business rules berada di application/domain service yang sama dan dipakai oleh route karyawan maupun route admin.
- Selfie menggunakan secure same-application upload ke private file-storage adapter; route handler menyimpan opaque object reference setelah validasi.
- Waktu resmi berasal dari server dengan timezone operasional `Asia/Jakarta` dan business date yang eksplisit.
- Route mutasi memakai idempotency key, authorization server-side, validation, transaction, concurrency guard, dan audit.
- Karena same-origin web/PWA, gunakan secure HttpOnly session cookie, CSRF protection, session rotation, serta revoke session/device; tidak perlu mobile token system terpisah.
- Server tidak bergantung pada status visual client dan tidak mempercayai user ID, distance, role, atau timestamp resmi yang dikirim client.

### UI route saat ini

```text
/staff/attendance
/staff/admin                  # tab Pengaturan → Absensi
```

### Internal route handler minimum

Path dapat mengikuti convention framework saat implementasi. Daftar berikut adalah kontrak logis dalam aplikasi yang sama, bukan service API terpisah.

```text
POST   /app-route/auth/login
POST   /app-route/auth/logout
GET    /app-route/attendance/today
POST   /app-route/attendance/selfie-upload
POST   /app-route/attendance/check-in
POST   /app-route/attendance/check-out
GET    /app-route/attendance/history
GET    /app-route/attendance/locations/eligible

GET    /app-route/admin/attendance/daily
GET    /app-route/admin/attendance/exceptions
POST   /app-route/admin/attendance/corrections
GET    /app-route/admin/attendance/export
```

Route handler master data/assignment mengikuti resource `employees`, `attendance-locations`, `shift-templates`, dan `shift-assignments`, dengan permission terpisah untuk view, create, edit, assign, correct-attendance, export, dan access-selfie.

### Route handler yang telah diimplementasikan

```text
GET    /api/staff/attendance
POST   /api/staff/attendance                   # multipart selfie + check-in/out
GET    /api/staff/attendance?view=report&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET    /api/staff/attendance/locations
POST   /api/staff/attendance/locations         # validasi geofence server-side
GET    /api/staff/admin/attendance-locations
POST   /api/staff/admin/attendance-locations
```

- Mutasi check-in/out mewajibkan `Idempotency-Key` dan menyimpan waktu server sebagai waktu resmi.
- Selfie disimpan sebagai `SENSITIVE_EMPLOYEE_DATA` pada private file storage dengan purpose `ATTENDANCE_SELFIE`; nama file, koordinat, atau identitas karyawan tidak digunakan sebagai storage key.
- Satu session aktif/non-voided diizinkan per employee dan business date pada MVP mode bebas.
- Server memvalidasi ulang titik, radius, akurasi, profil employee aktif, kepemilikan selfie, dan status session di dalam alur mutasi.
- Riwayat hanya mengambil session milik user yang login. Laporan seluruh karyawan memerlukan `attendance.report.view`.

## 9. Acceptance criteria MVP

- Karyawan dapat check-in dan check-out pada mode shift maupun Free Mode.
- Check-in/out diterima hanya setelah selfie, lokasi, accuracy, authentication, permission, idempotency, dan geofence divalidasi server.
- Check-in kedua ditolak bila masih ada session terbuka, tanpa membuat event duplikat.
- Retry karena jaringan tidak menggandakan attendance event.
- Server time menjadi waktu resmi dan device time hanya metadata.
- Shift lintas tengah malam menghasilkan satu session yang benar.
- Admin dapat melihat absensi harian dan exception tanpa membuka selfie secara default.
- Karyawan hanya melihat riwayat sendiri; role operasional lain tidak otomatis melihat seluruh data absensi.
- Route karyawan tidak menampilkan shift hari ini dan tidak mempunyai form correction request.
- Admin berizin dapat mengoreksi lupa checkout atau kesalahan lain secara langsung; koreksi mempertahankan event asli dan mencatat actor, alasan, before/after, serta audit.
- Selfie dan detail koordinat tidak masuk export Excel umum; export hanya memuat status/geofence summary sesuai permission.
- Employee yang nonaktif atau session yang dicabut tidak dapat melakukan absensi.
- Landing/booking, admin attendance, dan employee attendance dapat dijalankan dari satu build serta satu deployment aplikasi.
- Employee attendance berfungsi dari browser mobile yang didukung tanpa instalasi aplikasi native.

## 10. Out of scope Attendance MVP

- Payroll, perhitungan gaji, pajak karyawan, slip gaji, dan integrasi bank.
- Full HRIS, recruitment, performance review, training, asset HR, atau employee document management.
- Cuti/izin/sakit lengkap dan approval workflow kompleks.
- Roster/workforce optimization, auto-scheduling, shift bidding, swap marketplace, dan forecasting.
- Facial recognition, face matching, biometric identity decision, atau liveness vendor berbayar.
- Continuous/background location tracking, route tracking, dan monitoring aktivitas karyawan.
- Jaminan mutlak mendeteksi fake GPS, rooted/jailbroken device, atau manipulasi hardware.
- Kiosk attendance, fingerprint machine, NFC, QR attendance, dan hardware integration.
- Native Android/iOS application, binary store release, serta backend/API service yang dideploy terpisah.

## 11. Open configuration

1. Minimum browser/perangkat Android dan iOS yang didukung serta apakah PWA install prompt diaktifkan.
2. Nilai produksi untuk titik absensi, koordinat, radius, dan maksimum GPS accuracy; semuanya dapat diatur melalui `Pengaturan → Absensi`.
3. Apakah semua karyawan wajib selfie pada check-in dan check-out; rekomendasi MVP: ya pada keduanya.
4. Shift template produksi, check-in window, tolerance terlambat, dan aturan shift lintas tengah malam.
5. Karyawan/role mana yang memakai Free Mode serta maksimum durasi session.
6. Kebijakan lupa check-out, batas waktu koreksi admin, role admin berizin, dan evidence minimum.
7. Named permissions untuk master lokasi/shift, correction, export, serta view/download selfie.
8. Masa simpan selfie, koordinat detail, attendance event, correction, audit, dan backup expiry.
9. Apakah perangkat pribadi diizinkan dan SOP ketika izin kamera/lokasi ditolak.
10. Support contact serta icon final PWA; nama dan manifest dasar telah tersedia.

## 12. Delivery boundary

- Workstream ini diberi label `Phase 1B` agar dapat dikerjakan setelah application/security foundation siap tanpa menjadikan attendance sebagai launch gate bagi `Phase 1A Core Lodging MVP`.
- Attendance harus menjadi module dan kumpulan route di dalam satu deployable application agar tidak menghasilkan auth, employee, audit, file storage, database, atau deployment tandingan.
- Pemilihan web framework, PWA capability, database schema final, backlog, dan implementasi dilakukan melalui tahap arsitektur terpisah setelah open configuration prioritas disetujui.
