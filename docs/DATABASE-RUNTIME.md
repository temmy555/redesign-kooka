# Database Runtime dan Migration Workflow

| Informasi | Nilai                                                            |
| --------- | ---------------------------------------------------------------- |
| Versi     | 1.0                                                              |
| Tanggal   | 2 Agustus 2026                                                   |
| Roadmap   | Langkah 5                                                        |
| Status    | Local development selesai; production migration belum dijalankan |

## Runtime

Aplikasi memakai `node-postgres` connection pool dan Drizzle ORM hanya pada server. Modul database diberi marker `server-only`, dibuat secara lazy agar build tidak memerlukan koneksi aktif, dan memakai default pool konservatif untuk satu VPS:

- maksimum 8 koneksi per process;
- connection timeout 5 detik;
- idle timeout 10 detik;
- application name `kooka-web`.

Nilai tersebut dapat diubah melalui environment dengan batas validasi. Health endpoint `GET /api/health` menjalankan query read-only dan hanya mengembalikan status generik; detail error koneksi tidak dikirim ke client.

## Migration batches

Manifest executable berada pada `database/migrations/manifest.mjs` dan urutannya wajib dipertahankan:

1. `0000_vengeful_raider` — generated PostgreSQL tables, foreign keys, checks, dan indexes.
2. `0001_hard_constraints` — `btree_gist`, exclusion constraints, reversal foreign keys, serta append-only triggers.
3. `0002_whole_rupiah_amounts` — `CHECK` penolak pecahan rupiah pada 39 kolom nominal IDR resmi. `booking_quotes.display_total` dikecualikan karena menyimpan estimasi tampilan USD/AUD, bukan nilai ledger IDR.
4. `0003_auth_contract_alignment` — rename `auth_sessions.token_hash` → `token`, `auth_verifications.value_hash` → `value`, dan `auth_accounts.provider_account_id` → `account_id` agar sesuai default field contract Better Auth 1.6.25 (Langkah 6). Nama kolom lama menyiratkan hashing yang tidak pernah dilakukan Better Auth secara default; proteksi bergantung pada cookie HttpOnly/Secure/SameSite, TLS, database privat, serta expiry pendek dan single-use untuk verification value.
5. `0004_two_factor_foundation` — artefak kompatibilitas lama berupa `users.two_factor_enabled` dan `two_factor_credentials`. Runtime tidak memakai MFA dan authorization tidak membaca field tersebut; migration dipertahankan agar checksum/riwayat database tidak ditulis ulang.
6. `0005_rbac_baseline_catalog` — katalog `permissions` dan mapping `role_permissions` untuk empat role baseline (Langkah 7). Scaffold berdasarkan deskripsi role yang sudah disetujui pada `docs/SECURITY-PRIVACY-RETENTION.md` §3, bukan final named permission matrix; keputusan akhir tetap Owner input. `roles` turut di-insert ulang (idempoten) agar production tidak bergantung pada `db:seed:dev`.
7. `0006_platform_safety_hardening` — state/lease constraint outbox serta exclusion constraint agar grant role untuk user/role/property yang sama tidak mempunyai periode overlap.
8. `0007_master_configuration_controls` — approval/lifecycle field dan constraint, room-type/rate-plan period exclusion, non-zero rate, rule type, exchange-rate uniqueness, serta RBAC Batch 1 Langkah 9–11. Batch ini masih pending pada database development sampai Owner menjalankan migration.

Runner menyimpan ID, SHA-256 checksum, deskripsi, durasi, dan waktu penerapan pada `kooka_schema_migrations`. Perubahan isi migration yang sudah diterapkan ditolak sebagai checksum mismatch. PostgreSQL advisory lock mencegah dua runner menerapkan migration bersamaan dan setiap batch baru berjalan dalam transaction tersendiri.

Workflow lokal secara eksplisit menolak `APP_ENV=production`. Production migration baru dibuat sebagai deployment step setelah backup/restore, environment, dry-run, dan approval gate tersedia.

## Local commands

Pastikan local infrastructure aktif:

```bash
npm run infra:up
npm run env:local
npm run db:status
npm run db:migrate
npm run db:seed:dev
npm run db:health
```

`env:local` membuat `.env.local` bermode `0600` dari ignored `.env.infrastructure` bila file belum ada. File yang sudah ada tidak ditimpa.

Seed development bersifat idempoten dan hanya membuat satu property sintetis serta empat role baseline. Seed tidak membuat nomor kamar, room type, tarif, rekening, customer, booking, atau data produksi dari estimasi 15 kamar.

## Disposable verification

Dengan PostgreSQL lokal aktif:

```bash
npm run db:test
```

Command hanya menerima host loopback, memakai database bernama tetap `kooka_step5_test`, lalu memverifikasi:

- migration dari empty database;
- second-run idempotency;
- active-property uniqueness;
- effective room-type-period exclusion;
- physical room-night collision;
- single open attendance session;
- append-only audit protection;
- schema reset dan migrate ulang.

Database disposable dihapus setelah test. Command `db:reset:test` memiliki guard tambahan: `APP_ENV=test`, `ALLOW_DATABASE_RESET=YES`, dan nama database harus memiliki segmen `test`. Command tersebut tidak boleh diarahkan ke database development, UAT, atau production.

## Bootstrap Owner pertama

Deployment baru dapat membuat satu Owner awal melalui `POST /api/setup/bootstrap-owner`. Route ini:

- hanya aktif bila `OWNER_BOOTSTRAP_TOKEN` minimal 32 karakter tersedia;
- membutuhkan header `Authorization: Bearer <token>`;
- membuat account staff, active property bila belum ada, employee profile, serta grant `OWNER` dalam alur bootstrap satu kali;
- memakai advisory lock, mandatory audit, dan menolak request berikutnya setelah Owner aktif tersedia.

Contoh body:

```json
{
  "name": "Nama Owner",
  "email": "owner@example.com",
  "password": "password-minimal-12-karakter",
  "employeeCode": "OWNER-001",
  "propertyCode": "KOOKA-SBY",
  "propertyName": "KOOKA Residence Surabaya"
}
```

Hapus `OWNER_BOOTSTRAP_TOKEN` dari environment dan restart web process segera setelah response `201`. Owner dapat login menggunakan email/password dan permission aktif mengikuti role yang telah diberikan.
