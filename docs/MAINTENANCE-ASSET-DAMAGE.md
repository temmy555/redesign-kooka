# Maintenance, Asset, dan Guest Damage Charge — KOOKA Residence

| Informasi | Nilai |
|---|---|
| Versi | 1.1 Draft |
| Tanggal | 1 Agustus 2026 |
| Scope | Phase 1 maintenance core dan guest damage charge; Phase 2 asset/preventive maintenance |
| Sumber kebutuhan | [PRD.md](PRD.md) |

## 1. Tujuan

Dokumen ini mengatur laporan kerusakan, maintenance workflow, dampaknya pada serviceability/inventory, return-to-service, serta penagihan barang rusak/hilang kepada customer. Maintenance, cleaning, room status, customer responsibility, dan folio charge tetap menjadi konsep terpisah yang saling direferensikan.

## 2. Pemisahan entity dan status

- **Maintenance Issue:** masalah/kerusakan yang perlu ditriase dan diselesaikan.
- **Maintenance Work/Assignment:** siapa mengerjakan, target, progres, vendor, dan hasil pekerjaan.
- **Room Serviceability:** `In Service`, `Blocked`, atau `Out of Order`.
- **Availability Block:** periode unit/fasilitas tidak boleh dijual/dipakai.
- **Cleaning Task:** kebersihan sebelum/sesudah perbaikan.
- **Guest Damage Incident:** assessment tanggung jawab customer terhadap barang rusak/hilang.
- **Damage Charge Assessment:** keputusan nominal, approval, dispute, dan folio posting.
- **Internal Maintenance Cost:** biaya material/vendor properti, terpisah dari nominal customer charge.

Menyelesaikan maintenance tidak berarti customer telah membayar. Menagih customer tidak berarti kamar sudah selesai diperbaiki atau siap dijual.

## 3. Maintenance issue

### 3.1 Lifecycle

Lifecycle utama:

```text
Reported → Triaged → Assigned → In Progress → Resolved → Verified → Closed
```

Waiting/exception states:

- `Waiting for Parts`.
- `Waiting for Vendor`.
- `Deferred`.
- `Cancelled`.
- `Reopened` melalui action yang mengembalikan issue ke proses aktif tanpa menghapus resolution sebelumnya.

Status `Resolved` berarti pekerjaan dilaporkan selesai. `Verified` berarti hasil telah diperiksa oleh role berizin. `Closed` berarti issue lifecycle ditutup; status ini tidak otomatis mengubah housekeeping, inventory block, atau folio.

### 3.2 Data minimum

- Issue number yang unik.
- Location: room unit, public facility, area, atau asset.
- Category/subcategory seperti AC, plumbing, electrical, Wi-Fi, door/security, hot water, furniture, linen, appliance, dan cosmetic.
- Description Indonesia/English internal label bila diperlukan.
- Source: Cleaning, Front Office, guest complaint, inspection, preventive check, atau manual.
- Reporter, reported-at, discovered-at, serta photos/attachments.
- Severity, guest/safety impact, occupancy context, dan permission-to-enter bila kamar dihuni.
- Assignee/internal staff atau vendor reference, target response/resolution, estimated return time.
- Work notes, materials, internal estimated/actual cost, resolution, verifier, dan evidence.
- Related booking/stay/room move/cleaning/block/damage incident bila relevan.

Sensitive guest data tidak disalin ke title, photo filename, atau generic maintenance note. Gunakan entity reference dan field berizin.

## 4. Severity dan initial response

| Severity | Contoh | Default response |
|---|---|---|
| `Critical/Safety` | Bahaya listrik, kebocoran besar, pintu tidak aman | Alert segera, triage prioritas, biasanya Out of Order |
| `High/Guest Impact` | AC/air panas tidak bekerja pada occupied room | Front Office alert, cepat ditangani, evaluasi room move |
| `Normal` | Kerusakan tidak menghalangi penggunaan utama | Jadwalkan tanpa otomatis block kamar |
| `Low/Preventive` | Cosmetic repair atau inspeksi berkala | Masuk planned work queue |

SLA acknowledgment/resolution dapat dikonfigurasi per severity dan jam operasional. Severity tidak otomatis mengubah serviceability; triage memilih disposition yang dapat diaudit.

## 5. Serviceability dan inventory impact

- `In Service`: unit masih dapat digunakan/dijual sesuai readiness lainnya.
- `Blocked`: downtime terencana/administratif dengan start/end period, misalnya planned maintenance.
- `Out of Order`: kerusakan tidak terencana, tidak aman, atau tidak layak digunakan.

Maintenance disposition minimal:

- `Monitor Only`: issue aktif tanpa block.
- `Restricted Use`: issue perlu perhatian tetapi unit tetap In Service dengan internal warning.
- `Create Planned Block`: membuat block terjadwal.
- `Mark Out of Order`: mengeluarkan unit dari sellable inventory.

Setiap block/Out of Order menyimpan issue reference, start/end atau expected return, reason, actor/approver, dan audit. Open-ended Out of Order wajib muncul sebagai exception dan direview berkala.

Block yang overlap confirmed commitment tidak boleh aktif diam-diam. Sistem membuat conflict dan meminta room move/type change, complimentary upgrade, block-period adjustment, atau cancellation decision sesuai permission. Physical overbooking tetap dilarang.

## 6. Occupied room dan guest impact

- Maintenance issue tidak mengubah reservation, stay, payment, occupancy, atau cleaning secara otomatis.
- Kamar dapat tetap `Occupied + In Service` untuk issue kecil.
- Permission-to-enter menyimpan `Guest Permission Granted`, `Coordinate with Front Office`, `Do Not Disturb`, atau waktu yang disetujui.
- Critical/unsafe issue memicu Front Office alert dan evaluasi room move.
- Room move mengikuti workflow inventory/pricing yang sudah ditetapkan; unit lama menjadi `Vacant + Dirty` dan dapat tetap `Out of Order`.
- Compensation/service-recovery credit kepada tamu merupakan folio adjustment berizin, bukan internal maintenance cost.
- Expected return time dan next-arrival conflict muncul di Live Room Monitor/operational dashboard.

## 7. Return to Service

`Return to Service` adalah action terpisah dengan guard:

1. Blocking maintenance issue minimal `Resolved` dan telah `Verified` sesuai severity.
2. Tidak ada issue/block aktif lain yang melarang unit digunakan.
3. Safety/function checklist lulus.
4. Cleaning task dibuat bila pekerjaan menimbulkan kotoran/debu atau linen impact.
5. Housekeeping mencapai kondisi/inspection yang diwajibkan untuk check-in readiness.
6. Actor, actual return time, note, dan evidence tersimpan.

Maintenance verified dapat mengubah serviceability ke `In Service`, tetapi `Ready for Check-in` tetap merupakan hasil kombinasi occupancy, housekeeping, block, assignment, dan operational guard.

## 8. Guest Damage Incident

Guest damage/missing-item assessment dapat dibuat dari optional Departure Clearance, cleaning report, maintenance issue, Front Office, atau guest acknowledgement. Status `Issue Found` pada clearance tidak otomatis menetapkan responsibility atau memposting charge; detail clearance tersedia di [CHECKOUT-DEPARTURE-CLEARANCE.md](CHECKOUT-DEPARTURE-CLEARANCE.md).

Data minimum:

- Booking, room stay, room unit, guest/payer reference, dan incident time.
- Damage/missing item category dan related asset/catalog item.
- Description, quantity, condition, photos/evidence, reporter, serta witness/note bila ada.
- Related maintenance issue dan internal repair/replacement estimate.
- Guest communication status: `Not Yet Informed`, `Informed`, `Accepted`, `Disputed`, atau `Unavailable`.
- Assessment status, approver, resolution, dan folio posting reference.

Guest Damage Incident tidak menentukan kesalahan atau tagihan secara otomatis. Front Office/Owner menilai bukti dan kebijakan secara manual.

## 9. Damage Charge Catalog

Damage Charge Catalog menyediakan daftar harga referensi IDR untuk barang rusak atau hilang, misalnya linen, handuk, kunci, remote, kaca, furniture, appliance, atau fasilitas lain.

Setiap versioned catalog item menyimpan:

- Stable item ID, code, category, serta label Indonesia/English.
- Unit of measure dan default quantity.
- Charge basis: `Fixed Replacement Price`, `Reference Price`, `Actual Repair/Replacement Cost`, atau `Manual Assessment`.
- Reference/default amount dalam integer IDR dan optional reference range/non-blocking alert threshold.
- Tax/service profile atau `No Tax` yang dapat dikonfigurasi; sistem tidak menentukan perlakuan legal secara hard-coded.
- Effective period, active/retired status, version, creator/approver, dan audit.
- Evidence requirement, guest acknowledgement requirement, serta optional high-value monitoring rule.
- Optional asset/category applicability dan internal note.

Harga catalog adalah default/reference, bukan bukti otomatis bahwa customer wajib membayar. Perubahan catalog tidak mengubah damage assessment atau folio posting lama karena charge menyimpan price/tax snapshot.

Internal actual repair/replacement cost disimpan terpisah. Customer charge dapat sama, lebih rendah, waived, atau memakai actual cost sesuai policy dan Front Office permission; perbedaan harus mempunyai reason. Phase 1 tidak menghitung depreciation otomatis.

## 10. Damage charge assessment dan folio posting

Assessment lifecycle:

```text
Draft → Pending Approval → Approved → Posted
```

Alternative outcomes:

- `Waived`.
- `Rejected/Not Guest Responsibility`.
- `Disputed`.
- `Cancelled` sebelum posting.
- Posted charge dikoreksi melalui folio reversal/credit; assessment/posting history tidak dihapus.

Alur checkout:

1. Front Office membuka Guest Damage Incident.
2. Pilih catalog item atau manual item berizin.
3. Masukkan quantity; sistem mengambil default/reference IDR serta tax profile version.
4. Front Office berizin dapat menyesuaikan nominal dengan reason/evidence; reference-range breach boleh memicu alert tetapi tidak memerlukan Owner approval.
5. Lampirkan evidence dan catat guest informed/accepted/disputed/unavailable.
6. Front Office berizin menetapkan keputusan assessment; `Approved` bukan Owner approval.
7. Sistem memposting satu `Guest Damage Charge` debit ke master folio dengan incident, catalog version, room stay, quantity, unit price, tax snapshot, actor, dan decision reference.
8. Charge dapat masuk combined invoice atau other-charges/custom invoice tanpa double coverage.

Posting memakai idempotency/source uniqueness agar retry tidak membuat charge ganda. Damage Charge adalah category finansial tersendiri dan tidak masuk room revenue, POS, service/tour revenue, atau internal maintenance cost.

## 11. Checkout, dispute, dan settlement

- Checkout menampilkan damage assessment/charge yang belum selesai sebagai exception.
- `Disputed` tidak diubah menjadi `Accepted` hanya karena customer checkout.
- Sesuai permission/policy, Front Office dapat menunda posting, memposting approved charge sebagai outstanding, atau waive/reject assessment.
- Checkout dengan outstanding balance mengikuti folio closure guard; reservation/folio tidak dibuat lunas secara fiktif.
- Guest dapat menerima invoice/other-charge document yang merinci item, quantity, unit price, tax bila ada, dan total.
- Damage charge yang dibayar menggunakan payment record biasa; tidak membuat payment status khusus.
- Booking deposit/down payment tetap berbeda dari security/damage deposit.
- Jika security/damage deposit kelak digunakan, deposit terverifikasi dialokasikan melalui folio/payment allocation; charge tetap diposting sebagai debit tersendiri dan sisa deposit/refund direkonsiliasi.

## 12. Permission dan audit

- Cleaning: report issue/damage/missing item, photo, dan note minimum; tidak menetapkan customer responsibility, price, block, atau folio charge.
- Front Office: triage, assign, create block/request Out of Order, create/approve/post/waive damage assessment, memilih catalog/manual amount, serta membuat reversal/compensation dengan mandatory reason dan audit; tidak memerlukan Owner approval finansial.
- Owner: mengelola role/permission dan high-risk master, serta menangani long block/critical serviceability disposition; bukan approver wajib untuk damage charge, waiver, atau compensation Front Office.
- Vendor tidak perlu login Phase 1; staf mencatat assignment/work result dan vendor reference.
- Return-to-service/verification permission dapat dipisahkan dari worker yang menandai resolved.

Audit wajib untuk severity, disposition, block, assignee, expected return, internal cost, resolution/verification, catalog version/price, amount override, guest communication, approval, posting, reversal, waiver, dan return-to-service.

## 13. Dashboard, alert, dan report

Dashboard/Live Room Monitor menampilkan:

- Active maintenance badge, severity, status, assignee, dan expected return.
- Out of Order/planned block serta next-arrival conflict.
- Guest-impact issue, overdue SLA, waiting parts/vendor, verification, dan cleaning/return-to-service requirement.
- Damage assessment pending decision/disputed pada checkout tanpa menampilkan evidence sensitif pada shared display.

Report minimum:

- Maintenance issue count, response/resolution time, overdue, reopen, dan recurring category/unit.
- Downtime physical/sellable room nights dan reason.
- Internal maintenance cost by room/category/vendor.
- Guest-impact issue dan related room move/compensation.
- Damage assessment: proposed, approved, posted, paid/outstanding, waived, disputed, dan reversed.
- Damage charge amount by catalog/category, terpisah dari room/ancillary revenue.

## 14. Lost & Found boundary

Lost & Found tidak memakai maintenance lifecycle karena membutuhkan item custody, storage location, owner/claim verification, handover/shipping, disposal, serta retention yang berbeda.

- Cleaning dapat membuat Lost & Found report dari task yang sama.
- Report tersebut memiliki entity/lifecycle terpisah dan hanya mereferensikan room/stay/guest sesuai izin.
- Lost & Found tidak otomatis membuat maintenance issue atau damage charge.
- Detail workflow Lost & Found ditetapkan dalam [LOST-FOUND-CUSTODY.md](LOST-FOUND-CUSTODY.md).

## 15. Phase delivery

### Phase 1

- Maintenance issue lifecycle, severity, assignment, photo/evidence, SLA/alert, block/Out of Order, guest permission, room-move link, resolution, verification, return-to-service, cleaning link, dan audit.
- Guest Damage Incident, versioned Damage Charge Catalog, manual assessment/approval/dispute, folio posting, tax snapshot, invoice, reversal/waiver, serta report dasar.

### Phase 2

- Asset registry, asset lifecycle, preventive-maintenance schedule, recurring work order, richer vendor/cost, warranty, inspection template, dan basic spare-part usage.

### Phase 3

- Vendor portal/integration atau IoT alert hanya bila kebutuhan operasional nyata membenarkan kompleksitasnya.

## 16. Minimum acceptance tests

- Issue kecil dapat aktif tanpa mengubah occupied room menjadi Vacant/Out of Order.
- Critical issue dapat membuat Out of Order dan conflict workflow tanpa membatalkan confirmed booking otomatis.
- Block/Out of Order mengurangi sellable inventory sesuai period/reason dan tetap terlihat pada physical-capacity report.
- Occupied unsafe room move mempertahankan booking/folio dan membuat unit lama Vacant + Dirty + Out of Order.
- Resolved issue tidak membuat unit Ready sebelum verification/cleaning/readiness guard terpenuhi.
- Return-to-service ditolak bila blocking issue lain masih aktif.
- Cleaning dapat melapor foto/issue tetapi tidak menetapkan price, responsibility, block, atau folio charge.
- Catalog item menyimpan version/effective date, reference IDR, charge basis, tax profile/No Tax, evidence rule, dan optional monitoring alert.
- Perubahan harga catalog tidak mengubah assessment/folio lama.
- Damage assessment tidak memposting charge sebelum keputusan eksplisit Front Office dan tidak membuat charge otomatis dari maintenance issue.
- Quantity × unit price + tax snapshot menghasilkan folio damage charge yang benar dan hanya diposting sekali saat retry.
- Combined maupun other-charge invoice mengambil entry damage yang sama tanpa double coverage.
- Manual amount override, waiver, dispute, dan reversal menyimpan reason, permission, serta audit.
- Internal maintenance cost tidak menjadi customer charge atau revenue secara otomatis.
- Disputed damage tidak dianggap accepted/paid hanya karena checkout.
- Shared display tidak menampilkan damage evidence atau financial detail.
- Lost & Found report tidak berubah menjadi maintenance/damage charge tanpa action terpisah.

## 17. Keputusan sebelum implementasi

- Daftar awal barang/kategori dan harga referensi Damage Charge Catalog.
- Charge basis, tax/No Tax, evidence, optional alert threshold, dan allowed override per item/category.
- Siapa verifier maintenance dan approver high-value damage charge.
- SLA acknowledgment/resolution per severity dan jam operasional.
- Batas long block/high internal cost yang memerlukan Owner approval.
- Kebijakan guest acknowledgement, dispute, outstanding checkout, security/damage deposit, dan compensation.
- Asset/category awal serta kebutuhan preventive maintenance Phase 2.
