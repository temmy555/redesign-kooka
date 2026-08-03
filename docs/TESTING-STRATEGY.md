# Testing Strategy — KOOKA Residence

| Informasi | Nilai                                                   |
| --------- | ------------------------------------------------------- |
| Versi     | 1.0                                                     |
| Tanggal   | 2 Agustus 2026                                          |
| Scope     | Automated quality baseline untuk modular monolith KOOKA |

## Tujuan

Testing menjaga inventory, pembayaran, folio, akses sensitif, dan operasional kamar tanpa menjadikan seluruh suite lambat. Test mengikuti piramida: banyak unit test, integration test pada boundary penting, dan sedikit end-to-end test untuk perjalanan kritis.

## Lapisan test

| Lapisan     | Fokus                                                                          | Kapan dijalankan                      |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------- |
| Static      | ESLint, strict TypeScript, formatting, dependency audit                        | Setiap perubahan dan CI               |
| Unit        | Rule murni, validation, calculation, state guard, rendering kecil              | Setiap perubahan dan CI               |
| Integration | PostgreSQL constraint/transaction, route contract, storage/email/Redis adapter | CI yang mempunyai service dependency  |
| End-to-end  | Booking, payment review, check-in/out, folio, cleaning, attendance             | Menjelang UAT dan release             |
| Operational | Migration, backup/restore, offline procedure, queue recovery                   | Release dan production-readiness gate |

## Coverage policy

- Executable code pada `app`, `src/modules`, `src/platform`, `src/jobs`, dan `src/storage` mempunyai threshold awal minimum 80% untuk statements, branches, functions, dan lines.
- Declarative Drizzle schema tidak dihitung sebagai line coverage. Schema diverifikasi melalui `drizzle-kit check`, disposable PostgreSQL migration, hard-constraint test, dan integration test.
- Coverage bukan pengganti scenario kritis. Inventory concurrency, idempotency, authorization, ledger consistency, private-file access, serta retry/recovery wajib mempunyai test eksplisit.
- Generated output, preview mockup, dan vendor dependency tidak dihitung.

## Prioritas scenario per domain

1. Availability: last-room concurrency, hold expiry, extension conflict, block-versus-assignment, dan guaranteed late arrival.
2. Finance: append-only folio, allocation, split/combined invoice consistency, tax snapshot, reversal, manual refund, dan duplicate prevention.
3. Security: server-side RBAC, customer lookup enumeration protection, sensitive-file authorization, session revoke, rate limit, dan audit trail.
4. Stay/operations: partial multi-room stay, room move, optional identity/signature, cleaning transitions, DND exception, maintenance block, dan damage posting.
5. Attendance: geofence/accuracy, selfie evidence, Scheduled Shift/Free Mode, duplicate event, cross-midnight, dan audited admin correction.
6. Communication/jobs: transactional outbox, dedupe, retry/backoff, stale job cancellation, PDF/email failure, dan dead-letter handling.

## Commands

```bash
npm run test
npm run test:unit
npm run test:integration
npm run test:coverage
npm run db:test
npm run quality
```

`npm run quality` adalah gate lokal/CI lengkap: format check, lint, type-check, coverage, schema check, production build, serta audit dependency. `npm run db:test` adalah gate eksplisit yang memerlukan PostgreSQL lokal: command membuat database test disposable, menjalankan migration dua kali, constraint smoke test, reset/recreate, lalu menghapus database test tersebut.

## Definition of Done untuk fitur

- Acceptance criteria mempunyai test pada lapisan termurah yang memberikan keyakinan cukup.
- Happy path, validation failure, permission denial, retry/idempotency, dan audit side effect diuji bila relevan.
- Bug fix menyertakan regression test.
- Tidak ada secret, data tamu nyata, KTP, selfie, signature, atau bukti transfer nyata di fixture.
- Quality gate lulus dan gap yang sengaja ditunda dicatat pada roadmap/readiness checklist.
