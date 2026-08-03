# PostgreSQL / Drizzle Migration Plan

Status: implementation foundation; no production migration has been executed.

## Source layout

```text
drizzle.config.ts
src/db/schema/
├── common.ts
├── property.ts
├── identity.ts
├── system.ts
├── configuration.ts
├── lodging-master.ts
├── lodging.ts
├── finance.ts
├── operations.ts
├── content-commerce.ts
├── attendance.ts
├── lost-found.ts
└── index.ts

database/migrations/after-drizzle/
├── 0001_hard_constraints.sql
├── 0002_whole_rupiah_amounts.sql
├── 0003_auth_contract_alignment.sql
├── 0004_two_factor_foundation.sql
├── 0005_rbac_baseline_catalog.sql
├── 0006_platform_safety_hardening.sql
├── 0007_master_configuration_controls.sql
├── 0008_booking_transaction_flow.sql
├── 0009_operational_workflows.sql
├── 0010_cms_public_landing.sql
├── 0011_fnb_paper_orders.sql
├── 0012_reporting_daily_operations.sql
├── 0013_owner_super_admin_alignment.sql
├── 0014_financial_document_render_guard.sql
├── 0015_attendance_location_configuration.sql
└── 0016_attendance_event_persistence.sql
```

Mockup pada `outputs/landing-page-mockup` tetap merupakan preview dan tidak diubah. Konfigurasi SQLite/D1 di dalam mockup bukan database production KOOKA.

## Executable migration order

`database/migrations/manifest.mjs` adalah urutan executable yang dipakai runner:

1. `drizzle/0000_vengeful_raider.sql` — seluruh initial greenfield tables/indexes hasil generate dan review.
2. `database/migrations/after-drizzle/0001_hard_constraints.sql` — constraint/trigger PostgreSQL yang tidak direpresentasikan penuh oleh Drizzle schema.
3. `database/migrations/after-drizzle/0002_whole_rupiah_amounts.sql` — `CHECK` yang menolak pecahan rupiah pada 39 kolom nominal IDR resmi, mengecualikan `booking_quotes.display_total` yang menyimpan estimasi tampilan USD/AUD.
4. `database/migrations/after-drizzle/0003_auth_contract_alignment.sql` — rename kolom `auth_sessions`/`auth_verifications`/`auth_accounts` agar cocok dengan default field contract Better Auth 1.6.25 (Langkah 6).
5. `database/migrations/after-drizzle/0004_two_factor_foundation.sql` — artefak kompatibilitas lama (`users.two_factor_enabled` dan `two_factor_credentials`). MFA telah dihapus dari keputusan produk; migration tetap dipertahankan agar checksum/riwayat database tidak ditulis ulang.
6. `database/migrations/after-drizzle/0005_rbac_baseline_catalog.sql` — katalog `permissions` dan `role_permissions` baseline (Langkah 7), scaffold pending Owner's final permission matrix.
7. `database/migrations/after-drizzle/0006_platform_safety_hardening.sql` — outbox processing/lease state guard dan non-overlapping user-role grant periods setelah hardening review Langkah 6–8.
8. `database/migrations/after-drizzle/0007_master_configuration_controls.sql` — lifecycle/approval/overlap/pricing constraint serta RBAC configuration, room master, dan commercial master untuk implementation Batch 1 (Langkah 9–11).
9. `database/migrations/after-drizzle/0008_booking_transaction_flow.sql` — payment-term snapshot reservation, quote-rate foreign key, serta index expiry/payment/customer lookup untuk Technical Batch 2 (Langkah 12–14).
10. `database/migrations/after-drizzle/0009_operational_workflows.sql` — operational indexes, room-move/block/damage/payment-allocation constraints, financial-document render lookup, serta permission catalog Technical Batch 3 (Langkah 15–18).
11. `database/migrations/after-drizzle/0010_cms_public_landing.sql` — lifecycle CMS bilingual, single published revision, authentic/scanned public media gate, public lookup index, serta permission catalog Technical Batch 4 (Langkah 19).
12. `database/migrations/after-drizzle/0011_fnb_paper_orders.sql` — public menu, input pesanan kertas oleh Front Office, privilege room charge, pembayaran/receipt standalone, dan permission Technical Batch 5 (Langkah 20).
13. `database/migrations/after-drizzle/0012_reporting_daily_operations.sql` — reconciliation exception, report export metadata, single business-day run, serta permission dashboard/rollover/reconciliation/export Technical Batch 6 (Langkah 21).
14. `database/migrations/after-drizzle/0013_owner_super_admin_alignment.sql` — keputusan final bahwa OWNER adalah Super Admin property dengan seluruh named permission yang telah terpasang, tanpa authorization bypass.
15. `database/migrations/after-drizzle/0014_financial_document_render_guard.sql` — mengizinkan renderer PDF memasang file hasil render satu kali sambil mempertahankan immutability versi dokumen keuangan.
16. `database/migrations/after-drizzle/0015_attendance_location_configuration.sql` — periode efektif titik absensi, index/constraint lokasi, permission view/manage/report, serta grant Owner dan Front Office.
17. `database/migrations/after-drizzle/0016_attendance_event_persistence.sql` — satu session attendance non-voided per employee/business date, index riwayat event per employee, dan guard status event.

Karena ini initial greenfield schema, domain batch di bawah telah direkonsiliasi menjadi satu generated migration pertama. Perubahan berikutnya wajib dibuat sebagai file migration baru; file yang sudah applied tidak boleh diedit. Runner mencatat SHA-256 checksum, memakai advisory lock, dan menjalankan setiap migration baru di dalam transaction.

## Logical domain batches

1. `0000_foundation`: property, staff identity/RBAC, employee profile, file metadata, audit, idempotency, outbox, security event.
2. `0001_configuration`: versioned settings, policy, tax, bank/payment instruction, exchange rate, document profile/sequence.
3. `0002_lodging_master`: amenity, room type/version, room unit/type period/state, rate plan/rules, extra-bed resource pool.
4. `0003_reservation_inventory`: quote, reservation/guest/stay, room nights, type inventory claims, physical room-night claims, assignment/move/block, lookup session.
5. `0004_finance`: master folio, immutable entries, payments, refunds, financial documents and coverage.
6. `0005_operations`: optional check-in capture, housekeeping, maintenance, damage, departure clearance, guest request, amendment, daily run.
7. `0006_content_commerce`: bilingual CMS/media, menu, manual paper-order entry, notification messages.
8. `0007_attendance`: location, shift, session, append-only event, direct admin correction.
9. `0008_lost_found`: item, evidence, claim, and custody chain.
10. `0009_hard_constraints`: exclusion constraints, self-reversal foreign keys, and immutable-history triggers.

Daftar ini menjelaskan dependency domain dan tetap menjadi panduan untuk migration delta berikutnya. Drizzle-generated SQL harus direview dan committed; `drizzle-kit push` tidak boleh digunakan terhadap production.

## Required validation before first migration

- Lock the exact Better Auth package/adapter version and reconcile its required auth column contract with `users`, `auth_sessions`, `auth_accounts`, and `auth_verifications`.
- Jalankan production dry-run pada clone/disposable database setelah environment dan backup/restore tersedia.
- Pastikan checksum/status seluruh migration cocok sebelum deployment.
- Gunakan controlled production master setup; jangan membawa synthetic dev seed atau estimasi 15 kamar.
- Run concurrency tests for inventory claim, assignment/block collision, payment verification, document numbering, and attendance double-submit.
- Verify rollback by forward-fix or restoring a disposable test database. Production data migrations do not use blind down-migrations.

Local disposable PostgreSQL validation sebelumnya telah lulus sampai migration `0013`, termasuk empty migrate, migration idempotency, hard constraints, concurrent idempotency ownership, physical room-night collision, concurrent outbox lease/recovery, clean/idempotent daily rollover reconciliation tanpa critical exception pada synthetic data, serta reset/recreate. Migration berikutnya tetap wajib melewati validasi yang sama sebelum production. Tidak ada production migration yang dijalankan.

## Transaction services required

Schema constraints are necessary but not sufficient. Application services must lock rows in deterministic order and execute these workflows atomically:

- booking/hold/confirm/expire;
- assignment, room move, block, and stay extension;
- payment verify/void and refund completion;
- folio post/reversal and document issue/coverage;
- checkout with room-state and cleaning-task creation;
- attendance check-in/out and direct admin correction.

Redis/BullMQ may coordinate jobs and retries, but PostgreSQL remains the source of truth and primary concurrency boundary.
