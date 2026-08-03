# Master Data dan Configuration Governance — KOOKA Residence

| Informasi | Nilai |
|---|---|
| Versi | 1.1 Draft |
| Tanggal | 1 Agustus 2026 |
| Scope | Single-property Phase 1 foundation; master extension Phase 2–3 |
| Sumber kebutuhan | [PRD.md](PRD.md) |

## 1. Tujuan

Dokumen ini mengatur master data dan konfigurasi agar KOOKA dapat mengubah kebutuhan operasional tanpa developer, tetapi perubahan tidak merusak booking, inventory, folio, invoice, report, atau histori. Approval diterapkan berdasarkan risiko agar sistem tetap fleksibel untuk guesthouse dengan tim kecil.

## 2. Batas model properti

- Scope saat ini hanya satu properti: KOOKA Residence Surabaya.
- Data memiliki satu property root agar konfigurasi tidak menjadi global/hard-coded.
- UI, permission, reporting, dan workflow multi-property tidak termasuk Phase 1–3 saat ini.
- Perluasan multi-property hanya dilakukan melalui keputusan scope baru bila bisnis berkembang.

## 3. Kelompok master dan konfigurasi

### 3.1 Property dan operasi

- Nama, alamat, kontak, timezone Asia/Jakarta, locale default, dan jam operasional.
- Standard check-in/out, late-arrival/no-show cutoff, daily rollover, serta business-date rule.
- Cleaning SLA, target ready time, task template, maintenance category, dan block reason.
- Maintenance severity/SLA, return-to-service checklist, asset/category, serta versioned Damage Charge Catalog.
- Nomor WhatsApp resmi, email sender/reply-to, dan escalation contact.

### 3.2 Lodging inventory

- Room type, room unit, nomor/sort order, amenity, bed configuration, capacity, serta extra-bed eligibility.
- Room type/unit relationship, serviceability configuration, dan block rule.
- Accommodation add-on serta shared resource pool/allocation.

### 3.3 Commercial dan payment

- Rate plan, nightly rate/rule, restriction, package/channel override, discount, reason category, dan optional monitoring alert.
- Deposit/minimum payment, payment deadline, cancellation/no-show policy, tax, dan service charge.
- Rekening bank resmi, metode pembayaran, payment instruction, serta cash/pay-at-property permission.
- Bank instruction minimal menyimpan nama bank, nomor rekening, nama pemilik, currency IDR, status/effective period, serta text bilingual bila diperlukan. Beberapa rekening boleh aktif jika selection rule eksplisit; booking menyimpan resolved instruction snapshot.
- IDR sebagai base/transaction currency; USD/AUD exchange-rate display configuration.

### 3.4 Document dan communication

- Identitas legal dokumen, invoice/proforma/receipt/refund-note numbering dan layout reference.
- Document profile menyimpan legal/display name, alamat, kontak, logo, NPWP bila digunakan, footer/terms, language/layout/template reference, effective version, serta Owner-controlled sequence per document type.
- Notification template/version, language/fallback, reminder schedule, dan contact route.
- Policy document/version dan effective date.

### 3.5 Access dan approval

- Role, field/action permission, session/device policy, login security, mandatory reason/evidence, serta sensitive-data access. MFA tidak digunakan.
- Feature/deployment flag teknis tidak termasuk operational configuration dan tidak tersedia sebagai toggle bebas bagi staf.

### 3.6 Phase 2–3 extension

- Group/package/Whole House master dan resource components.
- POS menu/item/category, shift/cash rules, service/tour/resource/provider master.
- OTA/channel mapping, payment gateway/accounting mapping, serta integration schedule.

## 4. Source-of-truth boundary

- Operational master menjadi sumber capacity, price, tax, availability, schedule, payment, dan business rule.
- CMS hanya menyimpan editorial copy, translation, serta media; CMS tidak membuat nilai operasional tandingan.
- Historical booking/folio/document memakai snapshot/version reference, bukan membaca master aktif untuk menghitung ulang histori.
- Integration mapping menunjuk stable master ID dan tidak menggunakan nama tampilan sebagai key permanen.

## 5. Stable identity dan nomor kamar

- Room unit memakai immutable internal `room_unit_id`.
- Nomor kamar sederhana seperti `1`, `2`, dan `3` merupakan display identifier yang unik dalam properti dan dapat memiliki `sort_order`.
- Nomor kamar tidak menentukan room type.
- Perubahan nomor atau room-type assignment menggunakan action khusus, impact check, permission, alasan, dan audit.
- Mengganti nomor tampilan tidak mengubah assignment, cleaning, maintenance, stay, atau histori unit karena relasi memakai internal ID.
- Master lain juga memakai immutable internal ID; perubahan nama/translation tidak mengubah referensi historis.

## 6. Version dan effective dating

Master/configuration yang berdampak pada transaksi memiliki versi dengan lifecycle:

- `Draft`: sedang disiapkan dan belum memengaruhi operasional.
- `Scheduled`: sudah disetujui dan akan aktif pada waktu tertentu.
- `Active`: versi yang digunakan sesuai effective period.
- `Retired`: tidak digunakan untuk transaksi baru tetapi tetap dapat direferensikan histori.

Setiap version minimal menyimpan:

- Stable parent/master ID dan version number.
- `effective_from` serta `effective_to` bila relevan.
- Status version dan approval state.
- Nilai lama/baru atau complete version snapshot.
- Creator, approver, activation actor/job, waktu, serta alasan.
- Reference ke impact preview dan affected entities.

Satu scope tidak boleh memiliki dua active version yang overlap kecuali hierarchy/override secara eksplisit mengizinkannya. Scheduled activation berjalan idempotent dan mengaktifkan seluruh version set secara atomik tanpa kondisi half-published.

## 7. Snapshot dan efek perubahan

| Perubahan master | Efek default |
|---|---|
| Room/nightly rate atau rate plan | Hanya quote/booking baru setelah effective time; booking lama tidak berubah |
| Deposit/cancellation/no-show policy | Booking baru menyimpan policy version; booking lama tetap memakai snapshot |
| Tax/service profile | Posted folio/invoice tidak dihitung ulang; transaksi baru memakai version yang berlaku |
| Rekening/payment instruction | Booking lama tidak berubah otomatis; replacement instruction memerlukan action explicit dan notifikasi |
| Room capacity/extra-bed rule | Booking lama tidak dibatalkan otomatis; conflict masuk impact/exception queue |
| Damage Charge Catalog | Assessment/folio lama mempertahankan price/tax snapshot; item baru berlaku menurut effective period |
| Room number/type relationship | Assignment lama tetap tertelusur; perubahan aktif hanya setelah conflict diselesaikan |
| Check-in/out atau operational cutoff | Berlaku sesuai effective date; stay aktif tidak berubah diam-diam |
| Notification template | Message lama mempertahankan rendered snapshot; message baru memakai version aktif |
| Role/permission | Berlaku ke request berikutnya; session berisiko dapat direvoke sesuai security rule |

Existing booking hanya berubah melalui amend/reissue action berizin. Action tersebut membuat snapshot/version baru, alasan, affected amount/rule, audit, serta customer notification bila relevan.

`Reissue Payment Instruction` wajib menargetkan booking tertentu atau approved batch dengan impact preview. Action menyimpan old/new instruction, actor/approver, reason, waktu, customer notification, dan tidak mengubah amount/payment status. Tidak tersedia silent global replacement.

## 8. Hierarki konfigurasi

Hierarchy dibuat terbatas dan eksplisit:

```text
Property default
    ↓
Room type / product
    ↓
Rate plan / package / approved channel override
```

- Tidak ada inheritance bebas yang sulit dilacak.
- Admin dapat melihat resolved value, source level, version, dan effective period.
- Contoh: payment deadline `1 jam` berasal dari same-day rate-plan override, sedangkan property default `2 jam`.
- Konflik override menghasilkan validation error atau impact warning, bukan pemilihan acak.
- Booking/quote menyimpan resolved value dan source/version yang digunakan.

## 9. Risk-based change control

| Risiko | Contoh | Kontrol default |
|---|---|---|
| Rendah | Sort order, amenity relation, cleaning template | Admin berizin dapat activate; audit tetap wajib |
| Menengah | Rate, restriction, payment deadline, reminder schedule | Admin berizin; approval jika melewati threshold/scope |
| Tinggi | Rekening bank, tax/service, invoice identity/sequence, maximum capacity, serta role/permission | Owner approval, alasan, impact preview, dan audit |
| Sangat tinggi | Hard delete referenced master, histori rewrite, secret exposure, physical overbooking rule bypass | Action ditolak atau memakai controlled migration/workflow khusus |

Untuk high-risk change:

- Admin membuat draft dan mengirim `Pending Approval`.
- Owner melakukan approve/reject dengan alasan wajib dan seluruh action dicatat sebagai security/audit event.
- Owner dapat membuat serta mengaktifkan perubahan sendiri untuk operasi kecil, tetapi sistem menyimpan self-approval, alasan, dan security event.
- Perubahan rekening bank menghasilkan internal security alert dan preview customer-facing instruction.
- Rejection tidak menghapus draft/history; alasan disimpan.
- Perubahan yang sudah disetujui tetapi belum aktif dapat dibatalkan dengan permission dan audit.

Approval status dipisahkan dari configuration version status. Contohnya, version dapat `Draft` dengan approval `Pending`, atau `Scheduled` dengan approval `Approved`.

## 10. Impact checker

Sebelum approve/activate, sistem melakukan dependency dan conflict check minimal untuk:

- Menurunkan capacity di bawah guest count booking aktif/mendatang.
- Menonaktifkan extra bed yang sudah held/committed/assigned.
- Retire room type/unit yang memiliki booking, assignment, block, cleaning, atau integration mapping aktif.
- Mengubah room type unit ketika assignment/commitment mendatang menjadi tidak sesuai.
- Membuat maintenance block yang overlap confirmed assignment/commitment.
- Membuat effective-period overlap untuk rate, tax, policy, payment instruction, atau numbering sequence.
- Mengurangi inventory/quantity resource di bawah commitment.
- Membuat invoice/document number duplicate atau sequence mundur.
- Menonaktifkan payment method/bank instruction yang masih dipakai booking belum selesai.
- Retire damage catalog item yang masih dipakai draft/pending assessment atau membuat effective-period overlap.
- Mengubah role/permission yang menghilangkan recovery access Owner atau memberi staf kemampuan mengubah permission sendiri.

Impact preview menampilkan severity, jumlah serta reference entity terdampak, waktu efektif, dan required resolution. Konflik keras memblokir activation. Konflik yang dapat ditoleransi masuk exception queue dengan approval/alasan; tidak mengubah booking otomatis.

## 11. Archive dan deletion

- Referenced room, room type, amenity, rate plan, policy, tax profile, bank account, payment method, document profile, serta integration mapping tidak dapat hard-delete langsung.
- Gunakan `Inactive`, `Archived`, atau `Retired` agar tidak tersedia untuk transaksi baru.
- Reference check dan retention/hold rule dijalankan sebelum purge yang benar-benar diizinkan.
- Purge membutuhkan permission, alasan, audit, dan tidak boleh merusak financial/inventory referential integrity.
- Restore/rollback membuat version baru; version lama tidak diedit menjadi seolah-olah tidak pernah aktif.

## 12. Configuration UI

- Pengaturan dikelompokkan berdasarkan Property, Rooms, Commercial, Payment, Operations, Documents, Communication, Security, dan Integration.
- Search/filter, active/scheduled indicator, resolved-value view, history/diff, impact preview, approval queue, dan reference usage tersedia sesuai role.
- Form menyediakan validation, localized preview, invoice/payment-instruction preview, dan confirmation untuk perubahan berisiko.
- Perubahan massal memakai preview serta dry-run sebelum commit.
- UI tidak membuka generic JSON editor atau generic status field bagi staf operasional.
- Cache/in-memory configuration diinvalidasi setelah activation; failure activation tidak meninggalkan sebagian module memakai version baru.

## 13. Import, export, dan secret

### Phase 1

- Master/configuration dikelola melalui admin UI.
- Export untuk audit/backup memuat version, actor, approval, effective dates, dan reference IDs tanpa secret plaintext.
- Initial production seed memakai controlled implementation script atau admin workflow tervalidasi; tidak mengambil legacy operational history.

### Phase 2

- CSV import menyediakan template version, validation, row-level errors, preview/dry-run, idempotency, dan all-or-nothing untuk satu logical change set.
- Bulk export mengikuti permission, masking, audit, dan short-lived download.

### Phase 3

- Integration credential disimpan melalui secret manager/encrypted credential store dan hanya direferensikan dengan credential ID.
- API key/token tidak muncul pada diff, export, audit payload, application log, atau UI setelah disimpan.
- Rotation/revocation memakai action khusus dan security event.

## 14. Audit dan reliability

Setiap perubahan menyimpan:

- Master/config ID, version, actor, approver, dan activation source.
- Before/after atau complete version reference.
- Timestamp UTC dan Asia/Jakarta, effective period, reason, serta correlation ID.
- Impact-check result, override/exception, dan downstream notification/cache result.

Activation menggunakan transaction/concurrency/version check. Retry dengan idempotency key tidak membuat version atau activation ganda. Kegagalan notification/cache refresh tidak menghapus change; failure masuk operational alert/retry queue.

## 15. Phase delivery

### Phase 1

- Single-property root dan operational master utama.
- Room/type/amenity/capacity/extra-bed master.
- Maintenance category/severity/SLA dan Damage Charge Catalog/reference-price master.
- Rate, tax/service, payment/deposit/deadline, policy, bank instruction, serta document configuration.
- Operation/cleaning/no-show/business-date configuration.
- Role/permission, mandatory reason/evidence, non-blocking monitoring alert, dan risk-based configuration approval.
- Version/effective date, snapshot, impact preview, archive, audit, resolved-value view, serta configuration export.

### Phase 2

- Group/package/Whole House, POS, service/tour/resource master.
- CSV bulk import/export, advanced approval, completeness, dan richer impact analysis.

### Phase 3

- OTA/payment/accounting mapping, secure credentials, sync configuration, serta cross-system validation.

## 16. Minimum acceptance tests

- Perubahan rate tidak mengubah quote expired/booking lama dan berlaku pada quote baru sesuai effective time.
- Perubahan tax/service tidak menghitung ulang posted folio atau invoice lama.
- Perubahan policy/template menyisakan exact version/rendered snapshot pada histori.
- Rekening baru tidak mengganti instruksi booking lama tanpa explicit reissue; reissue memiliki approval/audit dan notification.
- Admin tidak dapat mengaktifkan high-risk change tanpa approval yang valid.
- Owner self-approval high-risk memerlukan alasan dan menghasilkan security/audit event.
- Capacity reduction atau extra-bed deactivation yang berkonflik tidak membatalkan booking otomatis.
- Room number tetap unik; perubahan display number tidak memutus assignment/cleaning/maintenance history.
- Retire referenced room/type/rate/tax/bank tidak menghapus histori dan tidak tersedia pada transaksi baru.
- Scheduled activation berjalan tepat sekali dan tidak menghasilkan dua active version overlap.
- Resolved-value view menunjukkan source dan version yang sama dengan snapshot booking.
- Rollback membuat version baru dan tidak mengedit version historis.
- CSV dry-run Phase 2 tidak menulis data; commit gagal tidak meninggalkan partial change set.
- Secret integration tidak muncul kembali pada UI/export/log/audit setelah disimpan.

## 17. Pertanyaan konfigurasi sebelum implementasi

- Identitas legal properti/invoice dan format sequence dokumen.
- Rekening bank resmi, owner/approver, dan prosedur verifikasi perubahan rekening.
- Approval threshold untuk rate, discount, void, refund, serta room-charge value.
- Daftar Admin yang boleh membuat medium/high-risk draft.
- Effective-time default serta minimum notice untuk perubahan rate/policy/payment instruction.
- Master data awal: room type, unit, amenity, capacity, extra bed, tax/service, rate, policy, dan cleaning template.
