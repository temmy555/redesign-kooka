# Greenfield Go-Live, Cutover, dan Rollback — KOOKA Residence

| Informasi        | Nilai                                           |
| ---------------- | ----------------------------------------------- |
| Versi            | 1.0 Draft                                       |
| Tanggal          | 1 Agustus 2026                                  |
| Scope            | Phase 1 production readiness dan initial launch |
| Sumber kebutuhan | [PRD.md](PRD.md)                                |

## 1. Keputusan utama

Sistem KOOKA diluncurkan sebagai greenfield system. Tidak ada migrasi otomatis atau massal dari website, spreadsheet, aplikasi, database, WhatsApp, invoice, atau sumber lama.

Tidak dibuat importer untuk:

- Booking dan stay historis yang telah selesai.
- Customer/guest historis.
- Payment, refund, folio, invoice, dan receipt lama.
- Riwayat WhatsApp atau email.
- KTP, guest photo, signature, consent, dan attachment lama.
- User, role, permission, configuration, atau audit lama.

Sistem baru menjadi sumber kebenaran untuk transaksi yang dibuat sejak waktu go-live. Setup master awal dan pencatatan komitmen kamar yang masih berlaku bukan migration pipeline.

## 2. Initial production setup

Sebelum booking online diaktifkan, data berikut dibuat langsung pada production melalui configuration UI atau controlled seed yang tervalidasi:

- Property identity, address, timezone Asia/Jakarta, contact, dan operating hours.
- Room type, room unit, nomor/sort order, capacity, amenity, bed, dan extra-bed rules.
- Rate plan/rate, availability restriction, deposit, payment deadline, serta cancellation/no-show policy.
- Tax/service profile, IDR base currency, serta USD/AUD display configuration.
- Rekening bank resmi, payment method, dan payment instruction.
- Check-in/out, business-date rollover, cleaning SLA/template, maintenance/block categories.
- Document identity dan number sequence untuk proforma, invoice, receipt, serta refund note.
- Notification template, provider/sender, WhatsApp number, dan reminder schedule.
- Staff user, role, field/action permission, mandatory reason/evidence, login email/password tanpa MFA, serta shared-device policy.
- Retention, backup, alert, dan security settings.

Owner atau approver yang ditetapkan menandatangani initial-configuration checklist. Test/dummy data tidak bercampur dengan production operational data.

## 3. Opening Booking dan opening block

Tidak ada migrasi booking lama. Namun, reservation/stay yang dibuat sebelum go-live tetapi masih mengonsumsi inventory pada atau setelah go-live harus direpresentasikan agar sistem tidak melakukan double booking.

Aturan:

- Bila tidak ada komitmen aktif/mendatang yang overlap go-live, sistem dimulai tanpa booking.
- Bila ada, Front Office membuat manual booking dengan source `Opening Booking` sebelum public availability dibuka.
- Opening Booking hanya berisi data yang diperlukan untuk operasi aktif: tanggal, room type/quantity, assignment bila ada, Room Lead Guest minimum, guest count, payment/opening balance yang benar-benar diperlukan, serta source note.
- Jika data tamu belum siap tetapi unit/tanggal harus dilindungi, admin dapat membuat temporary `Opening Inventory Block` dengan owner, reason, expiry/review time, dan audit.
- Block merupakan fallback sementara; reservation aktif sebaiknya dicatat sebagai Opening Booking agar check-in/out, folio, cleaning, dan report dapat berjalan.
- Historical completed stay tidak dibuat ulang sebagai Opening Booking.
- Opening Booking/payment tidak boleh dibuat seolah-olah transaksi baru tanpa source label serta audit yang jelas.

Front Office dan Owner merekonsiliasi seluruh room-night commitment yang overlap go-live sebelum aktivasi public booking.

## 4. Environment dan data test

- UAT/staging terpisah dari production dan menggunakan dummy/synthetic data.
- Production secret, rekening, dan personal data tidak disalin ke staging tanpa kebutuhan serta proteksi yang disetujui.
- Akun test berbeda dari akun production.
- Data dummy tidak dihapus dengan cara yang dapat menyentuh data production; production sebaiknya tidak menerima bulk dummy data.
- Production smoke test menggunakan test marker/channel yang jelas dan diselesaikan melalui action resmi seperti cancel/void/reversal, bukan direct database deletion.
- Feature/configuration activation memakai version dan effective time sesuai [MASTER-DATA-CONFIGURATION-GOVERNANCE.md](MASTER-DATA-CONFIGURATION-GOVERNANCE.md).

## 5. UAT dan operational rehearsal

Minimal lakukan satu end-to-end operational rehearsal setelah critical issue dari technical testing selesai. Skenario minimum:

- Search availability dan booking single/multi-room.
- Manual/Opening Booking dan room assignment.
- Payment instruction, WhatsApp deep link, Pending Verification, verify/reject, dan expiry.
- Customer booking lookup memakai code; email opsional sebagai verifikasi tambahan.
- Check-in dengan registration capture di-skip serta digunakan.
- Live Room Monitor, room move, extend, late arrival, no-show, dan same-day turnover.
- Folio, combined/split invoice, payment allocation, checkout, refund request, dan document PDF/email.
- Stayover/guest-requested cleaning, checkout cleaning, inspection, maintenance/block.
- Role restriction untuk Owner, Front Office, Cleaning, dan F&B foundation.
- Email/provider failure, retry, stale monitor, reconciliation exception, dan system-unavailable procedure.

Hasil UAT menyimpan tester, environment/version, waktu, expected/actual result, evidence, severity, owner, retest, dan approval. Critical issue harus selesai atau memiliki explicit no-go decision.

## 6. Cutover sequence

```text
Production infrastructure ready
→ Initial master/configuration approved
→ Staff account/password login ready
→ Opening Booking/block recorded if needed
→ Inventory and financial opening checks
→ Backup and restore verification
→ Production smoke test
→ Go/No-Go approval
→ Admin operational mode active
→ Public website/booking activated
→ Old booking entry points disabled/redirected
→ Hypercare and daily reconciliation
```

Admin operation dan public booking harus memakai inventory source yang sama. Public booking tidak diaktifkan lebih dahulu sementara Front Office masih bekerja pada sumber inventory berbeda.

## 7. Old website dan entry-point cutover

- Domain utama tetap dipertahankan.
- URL penting lama dipetakan ke page baru menggunakan 301 redirect bila berubah.
- Booking CTA/form lama dinonaktifkan atau diarahkan ke booking engine baru pada waktu cutover.
- Tidak ada dua public booking flow aktif yang tidak memakai inventory yang sama.
- Canonical, localized URL/hreflang, sitemap, robots rule, analytics consent, conversion event, email link, dan WhatsApp link diperiksa.
- Website lama dapat disimpan sebagai archive/backup terbatas, tetapi bukan operational source atau tempat menerima booking baru.

## 8. Go/No-Go gate

Go-live hanya disetujui bila:

- Seluruh room type/unit/number/capacity/extra-bed setup telah ditandatangani.
- Opening Booking/block yang relevan tidak overlap atau kehilangan commitment.
- Rate, tax/service, policy, rekening, serta instruction customer telah diverifikasi.
- Availability dan concurrency test lulus tanpa oversell.
- Booking/payment/folio/invoice/refund/check-in/out/cleaning core flow lulus.
- Staff accounts, password login, RBAC, shared-display privacy, dan audit berfungsi; tidak ada MFA.
- Email/WhatsApp manual link, document rendering, backup, restore, monitoring, alert, serta support contact siap.
- Critical UAT issues berstatus resolved; high-risk exception mempunyai keputusan Owner.
- Owner, Front Office lead, dan implementation lead memberi approval.

Go/No-Go decision menyimpan waktu, application/config version, approver, exception, contingency, serta evidence/checklist.

## 9. Rollback boundaries

### 9.1 Sebelum live transaction

Jika belum ada booking/payment/check-in production, technical deployment dapat dikembalikan ke application version sebelumnya dan activation dijadwalkan ulang. Initial configuration/data tetap dipertahankan atau diperbaiki melalui versioned action.

### 9.2 Setelah live transaction

Database tidak boleh sekadar direstore ke backup sebelum go-live karena dapat menghilangkan booking, payment, check-in, atau audit yang baru terjadi.

Prioritas:

1. Disable public booking/affected feature dengan controlled switch.
2. Pertahankan database dan capture incident timestamp/scope.
3. Gunakan forward fix atau rollback application yang kompatibel dengan data.
4. Rekonsiliasi seluruh transaksi sejak incident/cutover.
5. Gunakan reversal/adjustment/action resmi bila koreksi bisnis diperlukan.
6. Aktifkan kembali hanya setelah smoke test serta Owner/operational approval.

Restore database merupakan disaster-recovery action terakhir dengan restore point, data-loss assessment, replay/re-entry plan, reconciliation, approval, dan incident record; bukan rollback rutin.

## 10. System-unavailable procedure

Jika sistem tidak dapat dipakai:

- Public booking dinonaktifkan atau menampilkan kontak Front Office bila availability tidak dapat dijamin.
- Front Office memakai controlled `Offline Operations Log` untuk booking/walk-in, payment, check-in/out, room assignment/move, cleaning, dan maintenance yang benar-benar terjadi.
- Setiap entry memiliki temporary reference, actual event time, actor, customer/room minimum, amount/method bila finansial, dan evidence reference.
- Jangan menjanjikan availability tanpa pemeriksaan inventory yang dapat dipercaya.
- Setelah pulih, staff berizin memasukkan data dengan source `Offline Recovery`, actual event timestamp, reference unik, dan audit.
- Re-entry menggunakan idempotency/dedupe check dan direkonsiliasi sebelum log ditutup.
- Emergency print/export, jika digunakan, memuat data minimum, disimpan aman, dibatasi waktunya, dan dimusnahkan/diarsipkan sesuai retention rule.

## 11. Monitoring dan hypercare

Hypercare default berlangsung 14 hari setelah aktivasi public booking.

Review harian minimum:

- Booking created/confirmed/expired dan inventory commitment.
- Unassigned/overlap/Opening Booking exception.
- Payment pending/rejected/verified dan outstanding.
- In House, arrival/departure/no-show, room readiness, cleaning, serta maintenance.
- Folio/invoice/payment/refund reconciliation.
- Notification failure, stale Live Room Monitor, security alert, backup, dan scheduled job.
- Customer issue dan operational workaround.

Issue memiliki severity, owner, response target, workaround, resolution, verification, dan retrospective reference. Hypercare selesai setelah critical issue nol, daily reconciliation stabil, dan Owner/Front Office menandatangani exit checklist.

## 12. Ownership

- **Owner:** final Go/No-Go, rekening/tax/policy/config approval, accepted risk, dan rollback/resume approval.
- **Front Office lead:** opening commitment, operational UAT, readiness, offline log, dan daily reconciliation.
- **Cleaning lead/user:** housekeeping workflow rehearsal dan room-readiness validation.
- **Implementation lead:** deploy/version, monitoring, backup/restore, rollback technical, dan issue coordination.
- **Content owner:** bilingual content, authentic media, policy/trust readiness, redirect, serta public-page validation.

Satu orang dapat memegang beberapa peran pada tim kecil, tetapi approval/action tetap tercatat dengan akun individual.

## 13. Phase delivery

Greenfield go-live adalah exit requirement Phase 1, bukan fitur migrasi tersendiri.

- Phase 1: initial setup, Opening Booking/block bila perlu, UAT/rehearsal, Go/No-Go, cutover, rollback/offline procedure, redirect, monitoring, dan 14-day hypercare.
- Phase 2/3: module release mengikuti gate/rehearsal/rollback pattern yang sama tanpa mengasumsikan reimport data production.
- Legacy migration/importer tetap out of scope kecuali Owner membuat scope baru di masa depan.

## 14. Minimum acceptance tests

- Tidak ada legacy booking/customer/payment/invoice/chat/identity data yang dimigrasikan otomatis.
- Production dapat dimulai kosong ketika tidak ada commitment yang overlap go-live.
- Opening Booking atau block melindungi seluruh room-night commitment yang masih berlaku sebelum public booking aktif.
- Booking historical completed tidak dibuat ulang menjadi transaksi production.
- UAT dan production data terpisah; dummy data tidak muncul pada report customer/operational production.
- Go/No-Go ditolak ketika rekening, inventory, critical flow, backup/restore, atau critical issue belum valid.
- Admin dan public booking membaca inventory source yang sama saat diaktifkan.
- Old booking CTA tidak menerima booking setelah cutover.
- Failure setelah live transaction tidak menggunakan blind database restore dan tidak menghapus booking/payment baru.
- Offline Recovery menjaga actual event time, source reference, actor, idempotency, dan audit.
- Redirect, canonical/hreflang, sitemap, analytics/consent, email, dan WhatsApp link lulus smoke test.
- Hypercare review dan exit checklist dapat ditelusuri.

## 15. Keputusan sebelum go-live

- Target tanggal/jam cutover dan maintenance window.
- Daftar Opening Booking/block yang overlap tanggal tersebut, bila ada.
- Nama Owner, Front Office lead, implementation lead, dan content owner untuk Go/No-Go.
- Kanal dukungan, severity, response target, dan siapa yang dapat disable/re-enable public booking.
- Format Offline Operations Log dan lokasi penyimpanan aman.
- Apakah hypercare 14 hari cukup atau perlu diperpanjang berdasarkan okupansi/season.
