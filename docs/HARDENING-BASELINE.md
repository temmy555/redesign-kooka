# Phase 1A Hardening Baseline — Langkah 22B

## Status

Status implementasi: `IMPLEMENTED — UNVERIFIED`. Performance terhadap runtime lokal dan database recovery rehearsal lokal sudah lulus; browser/device matrix, private-storage restore evidence, AV engine, serta Owner risk acceptance masih menunggu.

Tidak ada nilai produksi, retention duration, atau accepted-risk keputusan Owner yang dibuat melalui hardening ini.

## Kontrol yang ditambahkan

### Request dan authorization

- Semua `/api/staff/**` tetap wajib memanggil `requireCurrentSession`; integration contract memeriksa seluruh route yang ada.
- Browser mutation staff melewati same-origin guard terpusat. Cross-site `Sec-Fetch-Site` dan foreign/malformed `Origin` ditolak sebelum session/RBAC service dijalankan.
- Session, named permission, property ownership, dan domain guard tetap authoritative; origin guard bukan pengganti RBAC.
- Response global membatasi framing, MIME sniffing, referrer leakage, opener, serta camera/geolocation/microphone/payment/USB permissions.
- Authorization matrix tersedia di [AUTHORIZATION-MATRIX.md](AUTHORIZATION-MATRIX.md).

### Upload, file sensitif, retention, dan audit

- Upload tetap dibatasi 15 MB dan hanya JPEG/PNG/PDF dengan content signature sesuai.
- PNG/JPEG terstruktur divalidasi terhadap maksimum sisi 12.000 px dan 40 juta pixel untuk menahan decompression bomb.
- Metadata PNG `eXIf/iTXt/tEXt/tIME/zTXt` dan JPEG APP1 EXIF/XMP dibuang sebelum hashing serta penyimpanan.
- File baru tetap `PENDING` sampai malware scan menghasilkan `CLEAN`; AV engine nyata masih menjadi production blocker.
- Retention dry-run bersifat pure/non-destructive, fail-closed tanpa policy, menerima effective policy snapshot, dan memblokir file yang mempunyai hold/reference aktif. Dry-run tidak menghapus file.
- Redaction diperluas untuk authorization/cookie/private credential dan token/code yang tertanam pada URL.

### Concurrency, idempotency, queue, email, dan PDF

- Disposable PostgreSQL gate menguji dua claim idempotency bersamaan dan memastikan hanya satu owner.
- Dua physical room-night claim yang bertabrakan dijalankan bersamaan dan harus menghasilkan tepat satu pemenang.
- Outbox tetap memakai `FOR UPDATE SKIP LOCKED`, lease recovery, exponential backoff, maksimum delapan attempt, dan dead letter.
- Email outbox memakai deterministic RFC Message-ID berdasarkan outbox event untuk membantu provider/recipient dedupe pada retry.
- Retry financial-document yang PDF-nya sudah tersimpan sekarang membaca PDF yang sama lalu mencoba pengiriman kembali. Sebelumnya retry berhenti sebagai `already-rendered`, sehingga email dapat terlewat setelah kegagalan SMTP.
- Exactly-once external email tidak dapat dijamin oleh transaksi database lokal; event completion, status notification, stable Message-ID, dan review dead-letter menjadi mitigasi. Ini harus tetap terlihat pada monitoring/UAT.

### Performance baseline

Dengan aplikasi lokal/target yang disetujui sedang berjalan:

```bash
npm run perf:baseline
```

Default menjalankan 60 request per skenario dengan concurrency 6 terhadap health dan public landing. Gate gagal bila failure rate melebihi 1% atau p95 melebihi 750 ms. Override eksplisit tersedia melalui `PERF_BASE_URL`, `PERF_REQUESTS`, `PERF_CONCURRENCY`, dan `PERF_P95_LIMIT_MS`. Target non-local ditolak kecuali `PERF_ALLOW_REMOTE=true` untuk mencegah load tidak sengaja.

Baseline ini sesuai skala awal guesthouse, bukan pengganti capacity test setelah media/content/traffic produksi tersedia.

Hasil lokal 2 Agustus 2026 dengan 60 request per skenario dan concurrency 6: health 0% failure/p95 387 ms; public landing 0% failure/p95 73 ms.

### Backup/restore rehearsal

```bash
npm run recovery:rehearse
```

Rehearsal hanya menerima PostgreSQL localhost. Script membuat custom-format `pg_dump`, membuat database sementara dengan nama per-process, menjalankan `pg_restore`, memvalidasi tabel migration/user/reservation/audit, lalu menghapus database dan dump sementara. Bila `RECOVERY_REHEARSAL_STORAGE_ROOT` diisi, private storage juga disalin ke lokasi sementara dan jumlah file diverifikasi.

Script tidak menyentuh production, tidak menggantikan encrypted off-server backup, dan tidak menjadi izin untuk blind restore setelah transaksi live.

Rehearsal database lokal 2 Agustus 2026 berhasil membuat dump, restore ke database sementara, memvalidasi tabel kritis, dan membersihkan seluruh artefak sementara. Private-storage rehearsal belum dijalankan karena root backup target belum ditentukan.

Verifikasi akhir 22B: format, zero-warning lint, strict type-check, 66 test files/579 tests, global coverage 87,16% statements/80,49% branches/90,24% functions/90,21% lines, Drizzle schema check, production build, production dependency audit, dan full dependency audit seluruhnya lulus dengan 0 vulnerability.

## Browser dan accessibility matrix

Baseline kode menyediakan semantic heading/table, label form, keyboard focus, skip link, responsive breakpoint, error/empty/loading state, dan reduced-motion. Sebelum status `DONE`, lakukan verifikasi minimal:

| Perangkat | Browser                             | Area wajib                                                          |
| --------- | ----------------------------------- | ------------------------------------------------------------------- |
| Desktop   | Chrome, Safari, Firefox terbaru     | Landing, booking, login, dashboard, room monitor                    |
| Tablet    | Safari iPad dan Chrome Android      | Login password, shared room monitor, signature/camera saat tersedia |
| Mobile    | Safari iPhone dan Chrome Android    | Landing/booking/sticky CTA dan staff responsive                     |
| Keyboard  | Desktop browser                     | Skip link, menu, form, dialog/action, visible focus                 |
| Assistive | VoiceOver atau screen reader setara | Heading, label, status/error announcement, table/card semantics     |

Browser/UAT evidence harus mencatat tanggal, device/browser version, role, scenario, hasil, defect, dan retest.

## Residual blocker sebelum 22B `DONE`

- AV engine nyata dan quarantine/scan worker belum tersedia.
- Full CSP nonce belum diaktifkan; perlu browser validation agar script Next.js tidak rusak.
- Performance baseline harus dijalankan terhadap build/runtime yang disetujui dengan data representatif.
- Browser/device/accessibility matrix belum mempunyai evidence lengkap.
- Encrypted off-server database/private-file backup, backup freshness monitoring, dan production-like restore evidence merupakan Langkah 24.
- Full end-to-end workflow dan sign-off staf tetap Langkah 23 UAT.
