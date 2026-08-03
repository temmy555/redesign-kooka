# Scope Decision Register — KOOKA Residence

| Informasi           | Nilai                                     |
| ------------------- | ----------------------------------------- |
| Versi               | 1.1 Scope Addendum                        |
| Tanggal freeze      | 1 Agustus 2026                            |
| Tanggal addendum    | 2 Agustus 2026                            |
| PRD acuan           | [PRD.md](PRD.md) versi 2.1 Scope Addendum |
| Status implementasi | Belum dimulai                             |

## 1. Tujuan dan aturan penggunaan

Register ini menjadi ringkasan klasifikasi scope. Detail behavior, status, guard, dan acceptance criteria tetap berada pada PRD serta dokumen domain yang ditautkan.

Klasifikasi:

- `P1 Included`: wajib tersedia untuk Definition of Done Phase 1.
- `P2 Deferred`: disimpan dalam roadmap dan bukan launch gate Phase 1.
- `P3 Integration`: automation/integrasi eksternal setelah fondasi bisnis siap.
- `Manual/SOP`: dilakukan di luar modul khusus pada Phase 1; bila ada record sumber yang disebut, record tersebut tetap wajib digunakan.
- `Out`: tidak termasuk roadmap aktif/baseline.
- `Open Config`: nilai bisnis belum dipilih; bukan fitur baru.

Jika terdapat perbedaan, keputusan terbaru yang eksplisit pada PRD/dokumen domain mengalahkan ringkasan. Perubahan klasifikasi memerlukan change request.

## 2. Phase 1 Included

| Domain                            | Baseline capability                                                                                                                                                                                                         | Dokumen utama                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Landing dan CMS dasar             | Homepage ringkas Urban Tropical Retreat, kamar sebagai fokus, authentic-media gate, bilingual content, review/publish dasar                                                                                                 | [WEBSITE-AUDIT.md](WEBSITE-AUDIT.md), [CMS-CONTENT-MEDIA.md](CMS-CONTENT-MEDIA.md)           |
| House Rules                       | Satu policy set bilingual/versioned, booking snapshot, online checkbox dan manual acknowledgement, unpublished-until-verified gate, tanpa automatic charge/refund/stay mutation                                             | [PRD.md](PRD.md), [CMS-CONTENT-MEDIA.md](CMS-CONTENT-MEDIA.md)                               |
| Bahasa dan mata uang              | Indonesia/English; tampilan IDR/USD/AUD; transaksi/ledger/dokumen resmi IDR                                                                                                                                                 | [PRD.md](PRD.md)                                                                             |
| Inventory                         | Room type sebagai kategori jual, unit fisik, hold/commitment, unassigned booking, block, locking, no hard overbooking                                                                                                       | [AVAILABILITY-INVENTORY.md](AVAILABILITY-INVENTORY.md)                                       |
| Booking                           | Public single/multi-room, booking manual, booking code, booking line, customer tanpa login                                                                                                                                  | [PRD.md](PRD.md), [STATE-TRANSITIONS.md](STATE-TRANSITIONS.md)                               |
| Payment manual                    | Online full-payment 100% via transfer; deposit persentase/nominal atau pay-at-property hanya untuk admin-created manual booking; WhatsApp proof handoff dan admin verification                                              | [FOLIO-FINANCIAL-LEDGER.md](FOLIO-FINANCIAL-LEDGER.md)                                       |
| Customer return dan communication | Booking code dengan email opsional, payment deadline/reminder, email transaksional, WhatsApp manual/deep link, internal alert                                                                                               | [NOTIFICATIONS-CUSTOMER-COMMUNICATION.md](NOTIFICATIONS-CUSTOMER-COMMUNICATION.md)           |
| Guest/occupancy                   | Booker/guest roles, Room Lead Guest, partial multi-room stay, adult/child/infant capacity, extra guest/extra bed                                                                                                            | [GUEST-OCCUPANCY-EXTRA-BED.md](GUEST-OCCUPANCY-EXTRA-BED.md)                                 |
| Stay timing                       | ETA, Front-Office-only early check-in/late checkout, operational block, extension threshold                                                                                                                                 | [EARLY-CHECKIN-LATE-CHECKOUT.md](EARLY-CHECKIN-LATE-CHECKOUT.md)                             |
| Amendment                         | Date shift, extension, shortening, early departure, partial multi-room, atomic inventory, price/folio delta                                                                                                                 | [BOOKING-STAY-AMENDMENTS.md](BOOKING-STAY-AMENDMENTS.md)                                     |
| Check-in registration             | Identity/KTP photo, guest photo, dan tablet/browser signature selalu optional Phase 1; independent skip tanpa check-in block, purpose notice, Owner/FO explicit access, private storage/audit, configurable retention/purge | [PRD.md](PRD.md), [SECURITY-PRIVACY-RETENTION.md](SECURITY-PRIVACY-RETENTION.md)             |
| Admin dan RBAC                    | Individual staff accounts, login email/password tanpa MFA, Owner/Admin/Cleaning/F&B roles, server-side permission, audit                                                                                                    | [SECURITY-PRIVACY-RETENTION.md](SECURITY-PRIVACY-RETENTION.md)                               |
| Room operations                   | Live Room Monitor, room board/calendar, assignment, unassigned queue, room move, shared-display masking                                                                                                                     | [REPORTING-DASHBOARD-RECONCILIATION.md](REPORTING-DASHBOARD-RECONCILIATION.md)               |
| Folio dan dokumen                 | Master folio, room/ancillary/payment/refund entries, combined/split/custom invoice, tax/service profile, PDF/print/email                                                                                                    | [FOLIO-FINANCIAL-LEDGER.md](FOLIO-FINANCIAL-LEDGER.md)                                       |
| Refund                            | Manual nominal/approval/transfer/reference/evidence/refund note; no automatic policy calculation                                                                                                                            | [FOLIO-FINANCIAL-LEDGER.md](FOLIO-FINANCIAL-LEDGER.md), [PRICING-RATES.md](PRICING-RATES.md) |
| Cleaning                          | Checkout/stayover/guest-request/room-move/deep/public tasks, assignment lifecycle, inspection, entry permission                                                                                                             | [STATE-TRANSITIONS.md](STATE-TRANSITIONS.md)                                                 |
| Maintenance/damage                | Issue, serviceability/block/OoO, return to service, damage catalog, assessment/approval, folio posting                                                                                                                      | [MAINTENANCE-ASSET-DAMAGE.md](MAINTENANCE-ASSET-DAMAGE.md)                                   |
| Lost & Found                      | Item/inquiry/claim, append-only custody, storage, pickup/shipping manual, retention/disposition                                                                                                                             | [LOST-FOUND-CUSTODY.md](LOST-FOUND-CUSTODY.md)                                               |
| F&B intake dasar                  | Paper order entered by Front Office, unique reference, standalone/room charge, price/tax snapshot, audit                                                                                                                    | [POS-SERVICES-TOURS.md](POS-SERVICES-TOURS.md)                                               |
| Guest Request                     | Structured category/target/status, not-guaranteed label, pre-arrival alert, routing to source workflow                                                                                                                      | [GUEST-REQUESTS-PREFERENCES.md](GUEST-REQUESTS-PREFERENCES.md)                               |
| Departure Clearance               | Optional per room stay, issue routing, skip/reason, no indefinite checkout lock                                                                                                                                             | [CHECKOUT-DEPARTURE-CLEARANCE.md](CHECKOUT-DEPARTURE-CLEARANCE.md)                           |
| Daily operations                  | Asia/Jakarta business date, rollover, guaranteed late arrival/no-show guard, lightweight daily close                                                                                                                        | [STAY-OPERATIONS-DAILY-CLOSE.md](STAY-OPERATIONS-DAILY-CLOSE.md)                             |
| Reporting/reconciliation          | Basic operational reports/CSV, occupancy definitions, exception queue, no silent auto-fix                                                                                                                                   | [REPORTING-DASHBOARD-RECONCILIATION.md](REPORTING-DASHBOARD-RECONCILIATION.md)               |
| Configuration governance          | Single-property master, version/effective date, snapshot, impact preview, approval, archive, export                                                                                                                         | [MASTER-DATA-CONFIGURATION-GOVERNANCE.md](MASTER-DATA-CONFIGURATION-GOVERNANCE.md)           |
| Greenfield launch                 | No legacy migration, Opening Booking/block only, UAT, Go/No-Go, rollback/offline, monitoring, hypercare                                                                                                                     | [GO-LIVE-CUTOVER-ROLLBACK.md](GO-LIVE-CUTOVER-ROLLBACK.md)                                   |

## 2A. Phase 1B — Employee Attendance MVP

Phase 1B adalah scope yang disetujui sebagai module dan route dalam aplikasi/deployment utama, tetapi bukan launch gate Phase 1A Core Lodging MVP.

| Domain                        | Baseline capability                                                                                                | Dokumen utama                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Mobile-first attendance route | Staff login, selfie camera, location capture, geofence validation server-side, check-in/out, personal history      | [MOBILE-ATTENDANCE.md](MOBILE-ATTENDANCE.md) |
| Attendance mode               | Scheduled Shift dengan template/assignment dan Free Mode tanpa shift assignment                                    | [MOBILE-ATTENDANCE.md](MOBILE-ATTENDANCE.md) |
| Attendance admin route        | Employee link, location/shift master, daily monitor, exception, direct audited correction, CSV recap               | [MOBILE-ATTENDANCE.md](MOBILE-ATTENDANCE.md) |
| Single-deployment foundation  | Satu modular web app, shared session/RBAC, server route handler, private storage, database, idempotency, dan audit | [MOBILE-ATTENDANCE.md](MOBILE-ATTENDANCE.md) |

## 3. Phase 2 Deferred

| Domain                               | Deferred capability                                                                                    | Phase 1 boundary                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Group/package/Whole House            | Proposal/hold, rooming list, component builder, composite conversion, full billing routing             | Phase 1 supports single/multi-room booking and data foundation only                                                 |
| Full POS                             | Dedicated F&B workflow, split settlement, shift, KDS/QR enhancement, reports                           | Front Office paper-order entry only                                                                                 |
| Services/tours                       | Standalone/folio service lifecycle, resource scheduling, invoice/status                                | Not a Phase 1 operational module                                                                                    |
| CMS/revenue reports lengkap          | Advanced media, scheduled publishing, richer trust workflow, ADR/RevPAR/channel reports                | CMS/reporting dasar only                                                                                            |
| Guest Case                           | Complaint classification/severity/SLA/escalation/service recovery/analytics                            | Operational note + source workflow/SOP                                                                              |
| House-rules/security incident module | Violation/warning/escalation/restricted case timeline                                                  | Policy, SOP, restricted note/source action                                                                          |
| Cash/shift                           | Cash drawer/session, float/count/variance, financial handover                                          | Individual Payment Record + manual cash SOP                                                                         |
| FO operational handover              | Shift window, unresolved item links, acknowledgement/escalation                                        | Manual SOP; dashboard/entity source of truth                                                                        |
| Physical key tracking                | Key inventory, issue/return/lost/damaged, move handover, checkout exception                            | Manual key SOP                                                                                                      |
| Baggage storage                      | Tag/custody/pickup/overdue-to-Lost-&-Found                                                             | Manual SOP/log/tag if accepted                                                                                      |
| Visitor Log                          | Entry/exit/host/overdue/emergency headcount                                                            | Policy and manual log if visitors allowed                                                                           |
| Parking module                       | Capacity/request/waitlist/arrival/departure/overflow                                                   | Verified public policy + manual confirmation/note                                                                   |
| Digital DND                          | Effective window/alert/clearance/override                                                              | Physical door hanger; Cleaning Deferred/Unable to Access                                                            |
| Emergency contact                    | Structured contacts/status/purpose/access/retention                                                    | Booker/guest contact; one restricted note only if needed                                                            |
| Minimum age/minor/guardian           | Minimum-age fields/validation, guardian link, responsible-adult/adjacent-room rule, exception approval | No age enforcement in system; Adult/Child/Infant capacity counts only; any house rule is handled outside the system |
| Security deposit                     | Segregated liability balance/allocation/refund/dispute                                                 | Not accepted as booking payment/generic charge; booking deposit remains separate                                    |
| Maintenance expansion                | Asset registry, preventive schedule, vendor/warranty/spare usage                                       | Reactive issue/damage/room serviceability only                                                                      |
| Lost & Found enhancement             | Barcode/QR, assisted matching, bulk check, enhanced shipping                                           | Manual code/custody/matching/shipping                                                                               |

## 4. Phase 3 Integration

- WhatsApp Business API after business verification and template readiness.
- Payment gateway after business verification; verified gateway events must map to existing payment lifecycle.
- OTA/channel manager and dynamic pricing.
- Accounting and F&B inventory integration with cross-system reconciliation.
- Smart lock/key-card/PIN integration after hardware/security decision.
- Optional courier, maintenance vendor, or IoT integration only when volume/value supports it.

## 5. Manual/SOP Phase 1

| Process                      | Manual boundary                                                                | System record/source that remains authoritative                |
| ---------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Transfer proof               | Customer sends proof + booking code via WhatsApp                               | Payment verification/payment record                            |
| F&B ordering                 | Guest fills paper form; FO enters it                                           | Manual Paper Order/POS source record                           |
| DND                          | Physical door hanger                                                           | Cleaning Task exception only                                   |
| Cash handover/reconciliation | Manual cash SOP                                                                | Individual Payment Records                                     |
| Physical keys                | Manual issue/return SOP                                                        | Operational note/Damage Incident if relevant                   |
| Baggage                      | Manual log/tag if accepted                                                     | Lost & Found only after controlled overdue transfer            |
| Visitors                     | Policy/manual log if allowed                                                   | Additional Guest workflow if visitor stays overnight           |
| Parking                      | Policy/manual confirmation/note                                                | Optional manual Accommodation Add-on if charged                |
| Emergency contact            | Booker/guest contact; restricted note only if essential                        | Booking/stay restricted note                                   |
| Minimum age/minor/guardian   | No structured age check; any house rule is handled manually outside the system | Adult/child/infant capacity data only                          |
| House-rule/security incident | SOP/restricted note/emergency procedure                                        | Maintenance/Damage/Room Move/folio/source action as applicable |
| Front Office handover        | Manual SOP/checklist                                                           | Dashboard and source entities; no duplicate status             |

## 6. Out of Scope

- Customer account/login/password dan customer self-service mutation.
- SSO/enterprise identity provider integration.
- Breakfast included atau automatic meal entitlement; semua tarif Room Only terhadap makanan.
- Customer self-order/cart untuk F&B pada baseline.
- Automatic cancellation/refundable amount decision; nominal tetap manual.
- Automatic damage responsibility/charge atau automatic security-deposit deduction.
- Legacy historical migration/importer; go-live greenfield dengan Opening Booking/block saja.
- Multi-property operation pada baseline.
- Accounting general ledger penuh, payroll/full HRIS, advanced workforce scheduling/roster optimization, petty cash, dan full procurement. Employee directory minimum serta attendance shift assignment Phase 1B tetap termasuk.
- Native Android/iOS application dan binary app-store release; Employee Attendance Phase 1B menggunakan route mobile-first/PWA pada aplikasi utama.
- Guaranteed hard overbooking atau silent inventory override.

## 7. Open Configuration

Open configuration tidak memperluas fitur. Kelompok utamanya:

- property/room inventory, room type, capacity, amenities, extra-bed resource;
- rates, tax/service, discount/override limits, payment/deadline, bank instruction;
- booking/amendment/cancellation/no-show/check-in/out/early-late/refund policies;
- invoice identity/sequence, document templates, notification provider/template/timing;
- role/permission/login security, data retention, privacy consent, audit/access policy;
- cleaning/maintenance/damage/Lost & Found operating thresholds and owners;
- website translations, authentic media, menu/prices, trust evidence, location facts;
- attendance platform/device, work location/radius/GPS accuracy, shift/Free Mode rules, correction, privacy/retention, dan mobile distribution;
- go-live owners/date, Opening Booking/block, UAT, offline/rollback, hypercare.

Nomor lengkap tersedia pada Bagian 27 [PRD.md](PRD.md); gate tersedia pada [PHASE-1-READINESS-CHECKLIST.md](PHASE-1-READINESS-CHECKLIST.md).

## 8. Change control setelah freeze

Change request minimum memuat:

1. masalah/tujuan dan bukti kebutuhan;
2. klasifikasi phase yang diminta;
3. dampak UX, inventory, pricing/folio, data/privacy/security, permission/audit, notification/reporting;
4. schema/migration/backfill impact;
5. test/UAT/go-live/rollback impact;
6. estimasi waktu/biaya dan item scope yang ditukar bila perlu;
7. Owner decision, tanggal efektif, serta dokumen baseline yang diperbarui.

Perubahan nilai konfigurasi yang sudah berada dalam capability baseline mengikuti approval/configuration governance dan tidak selalu menjadi scope change.
