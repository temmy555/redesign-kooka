# Dependency dan Quality Baseline — KOOKA Residence

| Informasi | Nilai          |
| --------- | -------------- |
| Versi     | 1.0            |
| Tanggal   | 2 Agustus 2026 |
| Roadmap   | Langkah 3      |

## Runtime baseline

| Kebutuhan            | Package                   | Catatan                                                                                              |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Web application      | Next.js, React, React DOM | Satu App Router application dan standalone VPS build                                                 |
| PostgreSQL           | Drizzle ORM, `pg`         | Runtime client baru dibuat pada Langkah 5                                                            |
| Staff authentication | Better Auth               | Auth contract dan adapter direkonsiliasi pada Langkah 6                                              |
| Queue/Redis          | BullMQ, ioredis           | Infrastructure Langkah 4; connection factory, transactional outbox, dan worker dibuat pada Langkah 8 |
| Validation           | Zod                       | Boundary environment, route, command, dan form                                                       |
| Structured logging   | Pino                      | Redaction dan request context dibuat pada Langkah 8                                                  |
| Email                | Nodemailer                | Local catcher (Mailpit) Langkah 4; SMTP adapter dibuat pada Langkah 8                                |
| PDF                  | PDF-Lib                   | Financial document renderer dibuat pada Langkah 17                                                   |

Package dipasang sekarang agar versi dan compatibility graph repeatable. Pemasangan package tidak berarti runtime service, authentication, email, queue, atau PDF workflow sudah diaktifkan.

## Quality baseline

- Node minimum `22.13.0`; `.nvmrc` menjadi versi CI reference.
- npm dikunci melalui `packageManager`; dependency memakai exact version dan `package-lock.json`.
- ESLint memakai Next.js Core Web Vitals dan TypeScript rules dengan zero-warning gate.
- Prettier memeriksa source/config yang dikelola. Generated Drizzle SQL/schema dan preview mockup tidak diubah otomatis.
- Vitest memisahkan unit dan integration folders; V8 coverage minimum 80% pada executable application/module/platform/job/storage code.
- GitHub Actions menjalankan clean install dan `npm run ci` pada push, pull request, atau manual dispatch.

## Security dan override register

| Override                                    | Alasan                                                                  | Removal trigger                                               |
| ------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `postcss 8.5.25`                            | Next.js stable masih mengunci versi yang terkena advisori               | Next.js stable membawa patched PostCSS                        |
| `sharp 0.35.3`                              | Next.js stable range belum mengambil patched major                      | Next.js stable mendukung patched Sharp langsung               |
| `cron-parser 5.7.0`                         | Tarball 5.6.2 milik BullMQ ditandai stale/deprecated                    | BullMQ membawa 5.7.0 atau lebih baru                          |
| `@esbuild-kit/core-utils → esbuild 0.25.12` | Menutup advisori loader transitive Drizzle Kit tanpa downgrade breaking | Drizzle Kit berhenti memakai deprecated `@esbuild-kit` loader |

Setiap override wajib diuji melalui clean install, `drizzle-kit check`, tests, dan production build. Override tidak boleh dihapus hanya untuk mengurangi jumlah konfigurasi.

## Commands

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run db:check
npm run build
npm run security:audit
npm run quality
```

`npm run quality` adalah command lokal yang setara dengan CI baseline. Command tidak memerlukan PostgreSQL atau Redis aktif pada Langkah 3; `db:check` hanya memvalidasi schema/config dan tidak membuka koneksi database.
