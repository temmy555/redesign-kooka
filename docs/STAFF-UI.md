# Staff UI — Langkah 22A dan Technical Batch 7

## Tujuan

Langkah 22A menyediakan fondasi antarmuka operasional yang memakai autentikasi, permission, dan service bisnis yang sudah ada. UI tidak membuat sumber status, harga, inventory, atau identitas tamu kedua.

Customer tidak memiliki akun atau login. `/staff/login` hanya untuk karyawan; customer mengakses booking melalui kode booking pada alur publik, dengan email opsional sebagai verifikasi tambahan.

## Route yang tersedia

| Route                 | Fungsi                                    | Permission utama                     |
| --------------------- | ----------------------------------------- | ------------------------------------ |
| `/staff/login`        | Login email dan kata sandi biasa          | Staff account aktif                  |
| `/staff`              | Dashboard Harian atau landing sesuai role | `report.view` atau role area         |
| `/staff/rooms`        | Live Room Monitor                         | `stay.manage` atau `room.board.view` |
| `/staff/front-office` | Booking, payment, stay, room, folio       | Booking/payment/stay permissions     |
| `/staff/housekeeping` | Cleaning dan Maintenance workflow         | `housekeeping.task.manage`           |
| `/staff/fnb`          | Paper-order dan status F&B                | `fnb.order.manage`                   |
| `/staff/admin`        | Master, CMS, staf, audit, dan report      | Sesuai permission area               |

Seluruh route selain login dilindungi session di server. Menu hanya muncul bila permission yang sesuai aktif. Menyembunyikan menu bukan security control utama; setiap page, API, dan service tetap memeriksa permission di server.

## Perilaku utama

### Login dan satu identitas staf

- Memakai Better Auth yang sama dengan fondasi autentikasi proyek.
- Tidak menggunakan MFA/TOTP atau langkah enrollment untuk role mana pun. Permission aktif langsung mengikuti role setelah login berhasil.
- Tidak menyediakan self-signup, customer login, atau SSO.
- Redirect setelah login dibatasi hanya ke route `/staff` untuk mencegah open redirect.
- Role Owner, Front Office, Cleaning, dan F&B tetap memakai satu akun masing-masing; fitur yang terlihat mengikuti permission aktif.

### Dashboard Harian

- Membaca `getOperationalDashboard` melalui `/api/staff/reports`.
- Menampilkan occupancy, arrival, departure, unassigned room, payment review, outstanding folio, serta operational/reconciliation attention.
- Nilai keuangan ditampilkan dalam IDR karena IDR adalah currency transaksi resmi.
- Refresh otomatis setiap 30 detik ketika tab terlihat.
- Bila refresh gagal, data terakhir tetap terlihat disertai peringatan agar Front Office tidak mengira layar masih live.

### Live Room Monitor

- Satu kartu mewakili satu unit kamar fisik dan selalu menampilkan nomor kamar.
- Status occupancy, stay, housekeeping, serviceability, dan next arrival tetap terpisah.
- Menyediakan filter Semua, Dihuni, Siap, Dibersihkan, dan Perlu perhatian.
- Refresh otomatis setiap 15 detik ketika tab terlihat.
- Owner/Front Office dengan `stay.manage` dapat melihat identitas operasional yang diperlukan.
- Role yang hanya memiliki `room.board.view` selalu masuk shared display: nama tamu dan kode booking dimasking di server, termasuk bila client mencoba meminta tampilan penuh.

### Housekeeping dan F&B

- Housekeeping menampilkan queue cleaning/maintenance, membuat jadwal harian, serta mengubah status Assigned, In Progress, Cleaned, Inspected, Deferred, dan Unable to Access. `GUEST_AWAY_REQUEST` tersedia sebagai alasan ketika tamu sedang pergi dan meminta kamar dibersihkan.
- F&B memasukkan formulir pesanan kertas sebagai standalone atau room charge, memilih kamar/tamu in-house, memilih menu/harga aktif, dan mengubah status sampai Completed.

### Front Office dan Owner/Admin — Batch 7

- Booking manual single/multi-room memakai alur quote lalu reserve agar inventory dan harga snapshot tetap authoritative.
- Form booking membaca katalog operasional khusus Front Office melalui permission `booking.manage`. Rate plan aktif dan tipe kamar aktif dapat dipilih tanpa memberi Front Office akses pengubahan master data.
- Pemilihan tanggal memakai kalender aplikasi berbahasa Indonesia; dropdown Front Office memakai listbox yang konsisten, menampilkan kode/keterangan penting, serta memiliki empty state yang jelas.
- Tamu tetap memilih tipe kamar saat booking. Nomor kamar fisik tersedia pada workflow alokasi, check-in, dan pindah kamar; status occupancy, housekeeping, dan serviceability ditampilkan terpisah.
- Antrean booking/pembayaran dapat dipilih langsung; payment manual dapat dicatat, diverifikasi, atau ditolak.
- Stay workflow mencakup check-in/out, no-show dengan room retained/release, initial room assignment, maintenance block, dan room move dengan no-change/charge/credit.
- KTP/foto tamu/tanda tangan bersifat opsional. Foto memakai camera/file picker browser; tanda tangan memakai canvas tablet. File disimpan privat sebagai sensitive guest data lalu direferensikan oleh registration record.
- Folio workspace menerbitkan proforma/invoice/receipt/refund note/folio statement secara combined atau room-only, mencatat damage charge, dan membuat refund manual.
- Owner/Admin workspace menyediakan profil properti, room unit/amenity, tax dan kurs tampilan, CMS authentic media, menu category, staff role, audit trail, daily rollover, reconciliation, serta export Excel.
- Semua form terstruktur; pengguna tidak diminta menulis JSON atau mengakses database langsung.

## State dan aksesibilitas baseline

- Empty state, loading, refresh error, stale timestamp, dan access denied tersedia.
- Layout responsive untuk desktop, tablet, dan mobile.
- Tersedia visible focus state, skip link, semantic heading/table, serta reduced-motion support.
- Browser/device matrix, screen-reader pass, dan UAT operasional nyata belum dilakukan; pekerjaan tersebut termasuk Langkah 22B/UAT.

## Batas verifikasi

Attendance PWA tetap Langkah 26–29. UAT transaksi per role, permission kamera pada tablet nyata, signature canvas, screen-reader pass, dan browser/device matrix final dilakukan pada Langkah 23.

Business service dan API yang telah ada tidak dihapus. Layar action berikutnya harus memanggil service/API tersebut dan mempertahankan permission, idempotency, audit, serta state transition guard yang sama.

## Verifikasi

Verifikasi otomatis 22A mencakup:

- filtering navigasi berdasarkan permission;
- sanitasi redirect login dan redirect session aktif;
- state credential login biasa serta error generik;
- dashboard data/alert/fallback;
- room filtering, status, shared display, dan empty state;
- server page access untuk reporting, room, housekeeping, dan F&B;
- room-service privacy guard agar role room-board-only tidak dapat membuka nama tamu atau kode booking;
- zero-warning lint, strict type-check, global coverage threshold, dan production build.

Status tetap `IMPLEMENTED — UNVERIFIED` sampai browser/device QA serta UAT Owner, Front Office, Cleaning, dan F&B selesai.

Technical Batch 7 menambah SSR/component smoke test, route authorization/error test, serta baseline lint, strict type-check, coverage, dan production build. Perbaikan katalog Front Office menambah service/route authorization test dan component smoke test untuk kalender/dropdown. Browser smoke test memastikan route staf yang belum login diarahkan ke login tanpa console error; authenticated per-role UAT tetap belum diklaim selesai.
