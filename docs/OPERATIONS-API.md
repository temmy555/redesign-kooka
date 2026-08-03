# Operations API — Technical Batch 3

Status: `IMPLEMENTED — UNVERIFIED` pada 2 Agustus 2026. Formatting, zero-warning lint, strict type-check, 201 automated tests, schema check, production build, dan dependency audit telah lulus. Full quality masih gagal karena coverage global 21,56% belum memenuhi threshold 80%; migration dan database concurrency test Batch 3 juga belum dijalankan.

Seluruh endpoint hanya untuk staff session, discope ke active property di server, memeriksa permission server-side, dan mewajibkan header `Idempotency-Key` pada mutation.

## Room board dan physical allocation

- `GET /api/staff/room-board` menampilkan setiap unit aktif sekali, nomor/type kamar, occupancy, housekeeping, serviceability, active stay/guest, next arrival, timestamp, dan stale threshold 60 detik.
- Query `?display=shared` mengaktifkan Shared Display Mode: nama tamu dimasking dan booking code hanya menampilkan empat karakter terakhir.
- `POST /api/staff/room-board`:
  - `ASSIGN`: memastikan booking line assignable, physical room type cocok, room in service, belum ada assignment aktif, lalu membuat physical claim per room-night. Unique partial index database menjadi collision guard untuk dua admin.
  - `BLOCK`: membuat room block dan physical room-night claims serta mengubah serviceability menjadi Blocked/Out of Order.
  - `MOVE`: mengunci assignment lama/tujuan, memindahkan claim mulai effective date, mencatat price treatment `NO_CHANGE|CHARGE|CREDIT`, dapat menandai incidental no-charge, membuat folio adjustment jika ada, dan otomatis membuat cleaning task kamar lama.

Reservation tetap memilih tipe kamar, bukan nomor kamar. Nomor kamar baru menjadi physical allocation operasional.

## Stay dan check-in/out

`POST /api/staff/stays` menerima business action berikut:

- `MARK_DUE_IN`, `CHECK_IN`, `MARK_DUE_OUT`, `CHECK_OUT`, `MARK_NO_SHOW`, `REOPEN_NO_SHOW`, dan `RELEASE_NO_SHOW`.
- `CAPTURE_CHECKIN` untuk KTP/passport, guest photo, atau signature. Capture tetap opsional; outcome dapat `CAPTURED`, `DECLINED`, `SKIPPED`, atau `FAILED`. File harus sudah disimpan melalui private file adapter dan identity number disimpan terenkripsi.
- `TIMING_DECISION` untuk early check-in/late checkout/decline oleh Front Office.

Check-in normal memerlukan physical assignment, room in service, dan housekeeping `INSPECTED`; override harus eksplisit dan beralasan. Checkout tidak dipaksa menunggu folio lunas: Departure Clearance dapat `CLEARED`, `ISSUE_FOUND`, atau `SKIPPED`, sementara folio tetap dapat ditindaklanjuti. Checkout membuat turnover cleaning task.

Guaranteed no-show tidak otomatis melepas assignment/room. Front Office harus menjalankan `RELEASE_NO_SHOW` jika kamar memang boleh dijual kembali. Ini menjaga kamar tersedia bagi tamu berbayar yang baru tiba larut malam.

## Folio, document, allocation, dan refund

- `GET /api/staff/folios?folioId=...` memberikan satu master folio dan balance `DEBIT - CREDIT`.
- `POST_ENTRY` menulis entry immutable. Net, discount, service charge, tax, dan total divalidasi; room, F&B, tour/service, damage, discount, dan adjustment dapat memakai konfigurasi tax masing-masing melalui tax snapshot/version.
- `REVERSE_ENTRY` membuat entry lawan dan menunjuk original; tidak mengubah atau menghapus entry lama.
- `ISSUE_DOCUMENT` mendukung `COMBINED`, `ROOM_ONLY`, atau `CUSTOM` coverage untuk proforma, invoice, receipt, refund note, dan folio statement. Semua scope mengambil amount/tax yang sama dari folio entry; tidak ada perhitungan harga berbeda antara combined dan room-only.
- Final invoice coverage bersifat unik per entry. Snapshot, nomor sequence, totals, dan coverage dibuat atomik; PDF render + optional email dilakukan worker melalui durable outbox `financial-document.render` dan private local storage.
- `ALLOCATE_PAYMENT` menghubungkan verified payment ke issued document tanpa melebihi nominal payment.
- `REQUEST_REFUND` mencatat refund manual yang dapat langsung ditangani Front Office sesuai keputusan Owner; rekening tujuan terenkripsi. `COMPLETE_REFUND` mencatat attempt, transfer reference, proof file, status, dan folio entry.

## Housekeeping dan property operations

- `GET /api/staff/operations` menampilkan queue cleaning, maintenance, dan Lost & Found.
- `CREATE_CLEANING` mendukung checkout, stayover, room move, deep clean, public area, dan guest request. Untuk permintaan saat tamu sedang pergi, gunakan `taskType=GUEST_REQUEST`, `entryPermission=GRANTED`, dan reason/status event `GUEST_AWAY_REQUEST`.
- `TRANSITION_CLEANING` memakai state `REQUESTED → ASSIGNED → IN_PROGRESS → CLEANED → INSPECTED`, plus `DEFERRED`, `UNABLE_TO_ACCESS`, dan `CANCELLED`. DND fisik dicatat dengan `GUEST_DND`; room readiness baru `INSPECTED` setelah inspection.
- `GENERATE_DAILY_CLEANING` membuat checkout/stayover task yang belum ada untuk business date secara idempotent.
- Maintenance issue membawa severity dan serviceability impact. Return to service hanya bersama status `VERIFIED` dan ditolak jika issue pemblokir lain masih aktif.
- Damage assessment memakai reference catalog opsional, nominal manual, tax snapshot, dan dapat membuat folio charge kategori `DAMAGE`.
- Lost & Found mencatat item code, lokasi, seal/high-value marker, retention date, encrypted claimant contact, verification, serta custody event.

## Gap verifikasi

Status ini belum berarti exit gate lulus. Sebelum UAT wajib ditambahkan test route/service Batch 1–3 sampai coverage global memenuhi 80%, lalu dijalankan migration pada database disposable serta concurrency test khusus double assignment, document sequence, duplicate coverage, refund retry, dan room return-to-service.
