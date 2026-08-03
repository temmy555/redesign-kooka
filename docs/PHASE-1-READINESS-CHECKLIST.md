# Phase 1 Readiness Checklist — KOOKA Residence

| Informasi           | Nilai                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Versi               | 1.2 Implementation Roadmap Alignment                                                                         |
| Tanggal             | 2 Agustus 2026                                                                                               |
| Scope               | Configuration, architecture/build, UAT, dan go-live gates                                                    |
| Status implementasi | Shared foundation sampai RBAC dan employee identity (Langkah 7) selesai; Shared platform services berikutnya |
| Baseline            | [PRD.md](PRD.md) 2.1 dan [SCOPE-DECISION-REGISTER.md](SCOPE-DECISION-REGISTER.md)                            |

## 1. Cara menggunakan

- `[P0]`: wajib diputuskan sebelum arsitektur/data model atau backlog terkait dibekukan.
- `[P1]`: wajib selesai sebelum UAT end-to-end.
- `[GO]`: wajib selesai sebelum Go/No-Go produksi.
- Checkbox hanya dicentang bila ada owner, keputusan/evidence, dan lokasi penyimpanan yang jelas.
- Pertanyaan Phase 2/3 tidak memblokir Phase 1 kecuali ditandai dependency.
- Checklist ini tidak mengizinkan implementasi; Owner tetap memberi perintah tahap berikutnya secara terpisah.

## 2. Baseline dan ownership

- [x] `[P0]` PRD 2.1 Scope Addendum dan scope freeze dibuat.
- [x] `[P0]` Scope Decision Register dibuat.
- [ ] `[P0]` Owner/decision maker, Front Office lead, Cleaning lead, content owner, dan implementation lead ditetapkan.
- [ ] `[P0]` Owner menandatangani bahwa deferred/manual/out-of-scope tidak menjadi launch gate Phase 1.
- [ ] `[P0]` Change-request approver serta format impact decision disetujui.
- [ ] `[P1]` RACI operasional, field/action permission, mandatory reason/evidence, serta monitoring owner per modul didokumentasikan.

## 3. Property, room, dan inventory

- [x] `[P0]` Model unit fleksibel disetujui: internal ID stabil, nomor tampilan string sederhana/berurutan, `sort_order`, serta room type terpisah; estimasi sekitar 15 unit tidak menjadi hard limit.
- [ ] `[P0]` Estimasi sekitar 15 unit diverifikasi dan daftar final nomor kamar, room type tiap unit, amenity, extra-bed eligibility, serviceability, serta block awal disetujui.
- [x] `[P0]` Model standard/max adult-child-total, hard physical maximum, bed configuration, unit override berizin, extra-bed eligibility/maximum/capacity increment disetujui; default usia awal `0–2/3–11/12+` tetap configurable.
- [ ] `[P0]` Nilai aktual standard/max occupancy, bed configuration, amenity, extra-bed eligibility, dan unit override per room type/unit disetujui.
- [ ] `[P0]` Jumlah/stok extra bed serta mode tracked/non-tracked ditetapkan.
- [x] `[P0]` Default check-in `14:00` dan checkout `12:00` Asia/Jakarta disetujui sebagai konfigurasi versioned/effective-dated, bukan hardcoded.
- [x] `[P0]` Earliest early check-in dan latest late checkout disetujui sebagai field konfigurasi Owner dengan version/effective date, permission, validation, dan audit; tidak hardcoded.
- [ ] `[P0]` Nilai produksi earliest/latest early-late limit, same-day turnover/cleaning-inspection buffer, overnight-extension threshold, block/OoO rules, dan availability restrictions diisi sebelum UAT.
- [ ] `[P1]` Initial room mapping, maintenance blocks, dan Opening Booking/block direkonsiliasi.
- [ ] `[P1]` Assignment, room move, extension conflict, partial multi-room, dan last-unit concurrency scenarios lulus UAT.

## 4. Rate, payment, folio, dan dokumen

- [x] `[P0]` Model base rate + special-date + seasonal + weekday/weekend + promo/discount, deterministic priority, nightly snapshot, fallback, no-zero/no-rate sales guard, serta custom/admin rate berizin disetujui.
- [ ] `[P0]` Nominal base rate per room type, pola weekday/weekend, seasonal/special-date, promo awal, rounding, dan custom-rate reason categories diisi sebelum UAT.
- [x] `[P0]` Model tax dan service-charge terpisah, profile per kategori, inclusive/exclusive/No Tax, snapshot posting, invoice consistency, version/effective date, permission, dan audit disetujui; initial safe configuration `No Tax` tanpa menyimpulkan kewajiban pajak.
- [ ] `[P0]` Owner/pihak perpajakan memvalidasi profile produksi, rate, taxable base, calculation order, discount treatment, rounding, effective date, serta label invoice per room/F&B/add-on/service/tour/damage category.
- [x] `[P0]` Customer-created online booking wajib full payment 100% sebelum confirmation; deposit persentase/nominal tetap dan pay-at-property hanya untuk admin-created manual booking. Default deadline 2 jam, same-day/policy khusus 1 jam, reminder 30 menit, Payment Review Hold, partial-credit, dan expiry guard disetujui.
- [ ] `[P0]` Maximum Payment Review Hold/escalation, role yang boleh memilih deposit manual, default/limit persentase atau nominal, serta remaining-balance due rule untuk booking manual ditetapkan.
- [x] `[P0]` Model rekening/payment instruction terpusat, multi-account dengan explicit selection, booking snapshot, Owner high-risk approval dengan mandatory reason, security alert, dan targeted/approved-batch `Reissue Payment Instruction` disetujui.
- [ ] `[P0]` Data rekening produksi, rekening default/selection rule, Owner/approver, minimum notice, batch-reissue permission, serta text instruksi id/en diisi dan diverifikasi dua pihak sebelum UAT.
- [x] `[P0]` Front Office berizin dapat langsung menjalankan discount, custom price, complimentary, no-price-change, credit/adjustment, payment void/reversal, refund, damage charge, amendment adjustment, serta invoice void/supersede tanpa Owner approval/nominal limit; reason, before/after, actor, source, evidence bila relevan, dan append-only audit wajib.
- [ ] `[P0]` Field/action permission final, reason category, evidence requirement, guest-informed field, serta non-blocking exception report/alert per financial action dikonfigurasi sebelum UAT.
- [x] `[P0]` Amendment payment rule disetujui: pre-arrival delta debit harus verified sebelum apply dan booking lama tetap aman; in-house extension dapat apply sebagai outstanding folio setelah inventory aman; credit/refund tetap action terpisah oleh Front Office.
- [ ] `[P0]` Amendment hold deadline, default added-night rate treatment, early-departure charge/credit dan room-night-release policy, serta required guest/payment confirmation evidence ditetapkan.
- [x] `[P0]` Model document profile, proforma/invoice/receipt/refund-note/folio statement, combined/split/custom coverage, language/rendered snapshot, PDF/email, immutable issue, Front Office void/supersede, dan unique non-reused sequence disetujui.
- [ ] `[P0]` Data legal/display identity, alamat/kontak/logo/NPWP bila digunakan, footer/terms, prefix/sequence format, template id/en, tax labels, serta sample PDF setiap document type divalidasi sebelum UAT.
- [ ] `[P1]` Payment verification, reversal, allocation, invoice supersede, refund, dan reconciliation scenarios lulus UAT.
- [ ] `[GO]` Rekening/instruksi pada website, email, proforma, dan admin telah dicocokkan dua pihak.

## 5. Booking, guest, dan stay policies

- [x] `[P0]` Model cancellation/no-show disetujui: bilingual versioned policy snapshot, Front-Office-only cancellation, manual fee/credit/refund, no automatic refund, guaranteed `Retain Until Original Checkout`, serta separate Front Office `Release Remaining Nights` dengan contact/reason/policy/financial/audit guard.
- [ ] `[P0]` Nilai production cancellation window/fee/refund wording per online/manual rate policy, arrival/no-show cutoff, contact-attempt minimum, releasable nights rule, dan customer notification template disetujui.
- [x] `[P0]` Boundary usia Phase 1 disetujui: sistem tidak menyimpan/memvalidasi minimum age Booker atau Room Lead Guest, tidak menerapkan adult-per-room/guardian guard, dan tidak meminta bukti usia anak; Adult/Child/Infant tetap hanya untuk capacity guard dengan default kategori yang telah disetujui.
- [x] `[P0]` Model House Rules disetujui: satu policy bilingual versioned/effective-dated, booking snapshot, online checkbox acknowledgement, manual provided/acknowledged/declined record tanpa signature requirement, serta no automatic financial/stay mutation.
- [ ] `[P0]` House Rules full text/summary/checkbox/manual acknowledgement id/en dan nilai smoking, noise, occupancy/extra guest/bed, visitor, parking, DND/room entry, key, baggage, damage, cancellation/refund/no-show dipastikan, direview, dan dipublikasikan konsisten.
- [x] `[P0]` Model optional check-in disetujui: KTP/identity photo, guest photo, dan signature dapat dilewati secara independen tanpa override/check-in block; capture memakai purpose notice, private storage, Owner/Front-Office-only explicit permission, access audit, serta configurable category retention/purge.
- [ ] `[P0]` Final purpose/consent text id/en, named production permission per sensitive action, dan retention duration/event/hold/purge/backup-expiry KTP/photo/signature ditetapkan sebelum go-live.
- [x] `[P0]` Model Guest Request disetujui: kategori publik awal, Front-Office owner, lifecycle Submitted/Review/Accept/Fulfill, no real-time promise, cleaning entry/DND guard, minimal Cleaning access, F&B/manual-deferred exclusions, serta paid-request confirmation-before-accept.
- [ ] `[P1]` Label/copy id/en, response/overdue target produksi, named permission, sensitive retention, notification template, serta channel/evidence paid-request confirmation dikonfigurasi sebelum UAT.
- [ ] `[P1]` Check-in, partial check-in/out, flexible clearance, early/late request, extension, date shift, shortening, dan early departure lulus UAT.

## 6. Cleaning, maintenance, damage, dan Lost & Found

- [ ] `[P0]` Cleaning task types, default creation time, assignment, checklist, inspection, DND/entry permission, priority, dan target-ready rules disetujui.
- [ ] `[P0]` Maintenance category/severity/SLA, block disposition, Return to Service verifier, dan evidence policy ditetapkan.
- [ ] `[P0]` Damage Charge Catalog initial items/price basis/tax/evidence/optional-alert/dispute rules disetujui.
- [ ] `[P0]` Lost & Found storage, code/seal, high-value threshold, claim verifier, retention/disposition, pickup/shipping, dan restricted evidence rules ditetapkan.
- [ ] `[P1]` Checkout→dirty→cleaned→inspected, room move, DND unable-access, maintenance block/return, damage posting, serta Lost & Found custody scenarios lulus UAT.

## 7. F&B paper-order baseline

- [x] `[TECH]` Public menu, menu master/version, paper-order API, standalone payment/receipt, guarded room charge, audit, cancellation/reversal, dan migration `0011` tersedia.
- [ ] `[P0]` Menu item, active IDR price, availability, tax/No Tax, dan printed-form version disetujui.
- [ ] `[P0]` Paper reference format, required fields, processed marking, storage/destruction, dan price-mismatch policy ditetapkan.
- [ ] `[P0]` Standalone versus room-charge verification, charge privilege, payer, approval, cancellation/reversal, dan receipt rule ditetapkan.
- [ ] `[P1]` Duplicate paper reference, wrong-room prevention, price mismatch, standalone payment, room charge, cancellation, dan reversal lulus UAT.

## 8. Role, security, privacy, dan retention

- [ ] `[P0]` Named role/permission matrix untuk Owner, Front Office, Cleaning, dan F&B disetujui sampai field/file/action level.
- [x] `[P0]` Login email/password tanpa MFA, individual account, rate limit, session revoke, shared-tablet session/lock, dan access-review policy ditetapkan.
- [ ] `[P0]` Data classification dan retention untuk booking/contact, KTP/photo/signature, payment proof, refund bank, damage, Lost & Found, request sensitif, notification, audit, dan backup disetujui.
- [ ] `[P0]` Privacy notice, consent/purpose text, data-subject request, hold, purge/anonymization, dan backup-expiry procedure ditetapkan.
- [ ] `[P1]` Server-side authorization, masking, signed file access, audit events, rate limiting, session security, upload validation, dan purge dry-run diuji.
- [ ] `[GO]` Production user/access list direview dan akun dummy/test dinonaktifkan.

## 9. Website, CMS, translation, dan media

- [ ] `[P0]` Final sitemap/navigation, homepage section order, CTA, booking flow, FAQ/policy placement, dan sticky mobile CTA disetujui.
- [ ] `[P0]` Bahasa default/fallback, translation owner, formatting, dan bilingual template completeness rule ditetapkan.
- [ ] `[P0]` Sumber kurs USD/AUD, refresh/stale threshold, rounding, serta label Estimated/Approx. disetujui.
- [ ] `[P0]` Minimum authentic photos per room type, required shot list, rights/source, alt text, dan placeholder prohibition disetujui.
- [ ] `[P1]` Room descriptions, amenities, rates/policies, menu, location/distance, trust strip, verified testimonials, FAQ, dan contact facts lengkap dalam id/en.
- [ ] `[P1]` Responsive image/video processing, performance, accessibility, metadata, canonical/hreflang, preview/review/publish lulus QA.
- [ ] `[GO]` Tidak ada stock/Unsplash pada room hero/final gallery dan seluruh trust/location claims memiliki evidence.

## 10. Communication dan customer documents

- [ ] `[P0]` Official WhatsApp number, service hours, after-hours message, email provider/domain, reply-to, dan sender identity ditetapkan.
- [ ] `[P0]` Template id/en untuk booking created, payment reminder/expiry/review/verified/rejected, confirmed, amended, pre-arrival, cancelled, refund, invoice, dan operational exception disetujui.
- [ ] `[P0]` Recipient routing, dedupe, resend permission, failure escalation, dan WhatsApp manual status wording ditetapkan.
- [ ] `[P1]` Transactional outbox, retry/backoff, stale reminder cancellation, email rendering, link security, dan delivery logging lulus UAT.

## 11. Architecture dan build gate — sedang berjalan

- [x] `[P0]` Owner memberi perintah terpisah untuk memulai arsitektur/database foundation dan meminta implementation roadmap berurutan.
- [x] `[P0]` Architecture decision, stack, deployment model, storage, database, background-job boundary, dan observability baseline didokumentasikan.
- [x] `[P0]` Canonical application root dan repository layout final diselesaikan pada Roadmap Langkah 2; mockup preview tetap terpisah dan tidak berubah.
- [x] `[P0]` Exact dependency lock, Node/npm baseline, zero-warning lint, formatter, strict type-check, test/coverage policy, schema/build/security gate, dan CI baseline diselesaikan pada Roadmap Langkah 3.
- [x] `[P0]` Environment validation/separation, ignored local secret, PostgreSQL/Redis/Mailpit/private volume, loopback binding, persistence, serta executable local health foundation diselesaikan pada Roadmap Langkah 4.
- [x] `[P0]` Server-only database pool/Drizzle client, checksum migration history, advisory lock, synthetic dev seed, disposable reset/test, hard-constraint smoke test, dan read-only health route diselesaikan pada Roadmap Langkah 5 tanpa production migration.
- [x] `[P0]` Data model/status/action contracts dipetakan ke PRD dan State Transition Matrix; physical Drizzle schema serta PostgreSQL constraint validation tersedia.
- [x] `[P1]` Test strategy mencakup concurrency, idempotency, permission, financial ledger, inventory, file privacy, notification, offline recovery, dan restore; implementation scenario mengikuti langkah domain terkait.
- [ ] `[P1]` Definition of Done per backlog item serta traceability ke acceptance criteria tersedia.

Urutan engineering, verification, dan exit gate dijaga pada [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md).

## 12. UAT dan go-live

- [x] `[P1]` Local UAT environment/data menggunakan synthetic data dan terpisah dari development/production; UAT VPS production-like tetap bagian Langkah 24.
- [ ] `[P1]` Owner, Front Office, Cleaning, F&B, dan content owner sign-off tercatat.
- [ ] `[P1]` Basic reports/reconciliation tidak memiliki unresolved critical exception.
- [ ] `[GO]` Production initial master/config export dan four-eyes validation selesai.
- [ ] `[GO]` Opening Booking/block dan inventory room-night reconciliation selesai.
- [ ] `[GO]` Backup/restore test, offline operations log, rollback rehearsal, monitoring/alert, dan incident contacts selesai.
- [ ] `[GO]` Website lama/CTA redirect dan public booking enable/disable authority diuji.
- [ ] `[GO]` Go/No-Go decision tercatat dan 14-day hypercare owner/review cadence siap.

## 13. Exit criteria per tahap

### Boleh mulai arsitektur/backlog

- Scope baseline dan change control tersedia.
- P0 property/inventory, financial policy, role/security, dan core operational policy memiliki owner serta keputusan awal.
- Owner memberi perintah tahap berikutnya.

### Boleh mulai UAT end-to-end

- Seluruh P0 dan build-critical P1 selesai.
- Traceability acceptance tests tersedia.
- Test data, role, template, document, dan production-like configuration siap.

### Boleh Go/No-Go

- Seluruh `[GO]` selesai dengan evidence.
- Tidak ada critical inventory, payment, permission/privacy, checkout/cleaning, backup/restore, atau reconciliation exception.
- Deferred feature tidak dipakai sebagai alasan menerima partial/unsafe workaround di production.

## 14. Phase 1B Employee Attendance — gate terpisah

Checklist berikut hanya menjadi gate untuk aplikasi Employee Attendance dan tidak memblokir launch Phase 1A Core Lodging MVP.

- [ ] `[P0]` Minimum browser/perangkat mobile, PWA enablement, izin kamera/lokasi, dan fallback UX diputuskan.
- [ ] `[P0]` Titik absensi, koordinat, radius, minimum akurasi GPS, dan timezone produksi ditetapkan.
- [ ] `[P0]` Shift template, Free Mode eligibility, check-in window, toleransi terlambat, overnight shift, dan lupa check-out ditetapkan.
- [ ] `[P0]` Permission admin untuk koreksi langsung, masa simpan selfie/lokasi, privacy notice, dan access-audit policy disetujui.
- [ ] `[P0]` Single-deployment route contract, same-origin session/CSRF, private upload, idempotency, server time, dan server-side geofence disetujui.
- [ ] `[P1]` Check-in/out Scheduled Shift dan Free Mode, geofence boundary, GPS tidak akurat, duplicate submit, offline/failure recovery, serta correction lulus UAT.
- [ ] `[P1]` Admin monitor, exception handling, restricted selfie access, employee self-history, dan privacy-safe export lulus UAT.
- [ ] `[GO]` Employee/location/shift master produksi, support contact, revoke access, monitoring, backup/restore, serta rollout route/PWA dalam deployment utama siap.
