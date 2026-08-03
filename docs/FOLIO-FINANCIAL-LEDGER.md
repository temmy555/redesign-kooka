# Folio, Invoice, Tax, dan Financial Ledger — KOOKA Residence

| Informasi | Nilai |
|---|---|
| Versi | 1.9 Draft |
| Tanggal | 1 Agustus 2026 |
| Scope | Phase 1 operational guest ledger dan dokumen finansial |
| Sumber kebutuhan | [PRD.md](PRD.md) |

## 1. Tujuan

Dokumen ini menjadi sumber aturan master folio, debit/credit entries, payment/refund posting, invoice combined/split, payment allocation, tax/service-charge configuration, document versioning, dan folio closure.

Ledger ini adalah guest operational ledger, bukan accounting general ledger penuh.

## 2. Master folio

- Satu booking memiliki satu master folio.
- Folio dibuat ketika booking berhasil dibuat, termasuk reservation `On Hold`.
- Semua room charge, ancillary charge, discount, adjustment, payment, reversal, dan refund berada pada folio yang sama.
- Multi-room tetap menggunakan master folio yang sama; setiap entry ditautkan ke booking line, stay date, dan room unit bila relevan.
- Booker, payer, dan invoice recipient dapat berbeda. Setiap entry dapat memiliki guest/order source serta billing bucket/payer routing tanpa mengubah master folio.
- Invoice adalah document view/allocation atas folio entries dan bukan ledger terpisah.

## 3. Debit, credit, dan saldo

| Entry | Sisi | Efek |
|---|---|---|
| Room/POS/service/tour charge | Debit | Menambah tagihan customer |
| Extra guest/bed, cancellation fee | Debit | Menambah tagihan customer |
| Approved guest damage/missing-item charge | Debit | Menambah tagihan customer sebagai kategori terpisah |
| Positive room-move adjustment | Debit | Menambah tagihan customer |
| Payment reversal | Debit | Mengembalikan kewajiban customer |
| Refund completed | Debit | Mengurangi credit balance customer setelah uang dikembalikan |
| Verified payment | Credit | Mengurangi tagihan customer |
| Discount/price reduction | Credit | Mengurangi tagihan customer |
| Charge reversal | Credit | Membatalkan charge tanpa menghapus histori |

```text
Folio Balance = Total Debit - Total Credit
```

- Balance positif: customer masih harus membayar.
- Balance nol: settled.
- Balance negatif: credit balance/properti memiliki kewajiban nilai kepada customer.

## 4. Folio entry

Setiap entry minimal menyimpan:

- Folio ID dan entry ID.
- Entry type/category.
- Debit atau credit.
- Amount IDR integer.
- Description Indonesia/English.
- Service/stay date.
- Source module dan source record ID.
- Booking line dan room unit jika relevan.
- Tax/service profile snapshot dan related component entries.
- Original/reversal entry ID.
- Posted by/at, reason, approver bila diperlukan.
- Idempotency key dan audit reference.

Sumber dapat berupa booking pricing, room move, POS order, service/tour, cancellation, payment, atau refund.

POS/service source menyimpan order/booking ID, settlement route, item/component version, stay/room, guest/payer/billing bucket, business/service date, dan posting state. Order cancellation tidak menghapus entry; posted correction memakai reversal.

## 5. Immutability dan reversal

- Posted entry tidak dapat diedit atau dihapus.
- Koreksi menggunakan reversal yang menunjuk original entry dan menyimpan alasan.
- Nominal baru diposting sebagai entry baru.
- Satu action/retry tidak boleh menghasilkan posting atau reversal ganda.
- Tidak tersedia action `Set Balance to Zero`; saldo hanya berubah melalui entry resmi.

## 6. Room charge posting

Untuk Phase 1, room charge per malam dibuat pada folio saat booking dibuat menggunakan booking price snapshot. Setiap entry menyimpan service date, booking line, room type, quantity, unit rate, dan total.

Jika booking expired/cancelled atau harga berubah, sistem membuat reversal/adjustment sesuai keputusan admin. Posting ini adalah ledger operasional untuk outstanding balance, bukan aturan accounting revenue recognition.

## 7. Booking deposit dan security deposit

### Booking deposit/down payment

- Merupakan payment di muka.
- Setelah verified, diposting sebagai credit dan mengurangi balance.
- Deposit persentase atau nominal tetap hanya dapat dipilih oleh staf berizin pada admin-created manual booking. Customer-created online booking wajib full payment 100% sebelum confirmation.
- Verified partial payment pada online booking tetap menjadi folio credit tetapi tidak memenuhi confirmation guard. Expiry melepaskan inventory tanpa menghapus credit; rebooking/allocation/refund diproses resmi dan diaudit.

### Security/damage deposit

- Workflow ditunda ke Phase 2 dan tidak digunakan pada Phase 1.
- Jika kelak diaktifkan, dana merupakan liability/titipan terpisah dari room revenue dan booking-payment credit.
- Deposit memerlukan segregated record/balance, receipt, authorized allocation, remainder refund, hold/dispute, reconciliation, dan audit.
- Damage charge tetap diposting sebagai debit terpisah; penggunaan deposit tidak boleh menghapus charge atau histori refund.

Kedua istilah tidak boleh dicampur dalam data atau dokumen. Phase 1 tidak boleh menyamarkan security deposit sebagai booking payment atau generic folio charge.

## 8. Folio lifecycle

Status utama: `Open` dan `Closed`.

- Folio `Open` sejak booking dibuat.
- Folio dapat tetap `Open` setelah stay `Checked Out` jika masih ada outstanding balance, pending verification, atau pending refund.
- Reservation menjadi `Completed` hanya setelah seluruh stay selesai dan folio memenuhi closure rule.

Closure guard normal:

- Seluruh stay selesai.
- Tidak ada pending payment verification.
- Tidak ada pending refund/reversal.
- Balance nol; atau corporate billing/Owner override memiliki reason dan audit.

Reopen mengubah `Closed → Open` melalui action berizin. `Reopened` adalah audit event, bukan status permanen. Reopen menyimpan reason, actor, waktu, dokumen terdampak, dan membuat document version baru bila perlu.

## 9. Invoice dari master folio

Invoice memilih folio entries; invoice tidak menghitung ulang harga, discount, tax, atau service charge.

Invoice scope:

- `Combined`: room dan seluruh ancillary charges terpilih.
- `Room Only`: room-related charges, discounts, tax, dan service charge terkait.
- `Other Charges`: POS/F&B, service/tour, dan component charges terkait.
- `Custom Selection`: hanya untuk pengguna berizin.

Satu folio charge hanya boleh berada pada satu active final invoice. Proforma atau folio statement boleh menampilkan ringkasan yang overlap karena bukan final invoice.

Jika combined invoice harus diganti menjadi split invoices:

1. Combined invoice menjadi `Voided` atau `Superseded`.
2. Folio entries tetap utuh.
3. Room-only dan other-charges invoices baru diterbitkan.
4. Histori, reason, actor, dan hubungan dokumen tersimpan.

## 10. Invoice line dan coverage

Setiap invoice line menunjuk folio entry asal. Sistem dapat menampilkan:

- Folio entry sudah masuk invoice mana.
- Entry belum diinvoicing.
- Invoice active, voided, atau superseded.
- Source booking/POS/service/tour/room move.

Total seluruh active split invoices untuk coverage yang sama harus sama dengan combined representation dari folio entries yang sama.

## 11. Payment allocation

Verified payment tetap satu folio credit entry. Allocation hanya menghubungkan nilai payment ke satu atau lebih invoice dan tidak membuat payment baru.

Aturan:

- Total allocation tidak boleh melebihi nilai verified payment yang tersedia.
- Payment yang belum dialokasikan tetap menjadi unallocated folio credit.
- Allocation dapat manual; default strategy seperti oldest-issued-first dapat dikonfigurasi.
- Perubahan allocation memerlukan reason/audit dan tidak mengubah original payment.
- Invoice settlement summary dihitung dari allocation, terpisah dari document status.

Document status: `Draft`, `Issued`, `Voided`, `Superseded`.

Settlement summary: `Unpaid`, `Partially Paid`, `Paid`, `Overpaid/Credit`.

## 12. Dokumen customer

Document profile yang disetujui menyimpan nama/legal display name properti, alamat, telepon, email, logo, NPWP bila digunakan dan telah divalidasi, footer/terms, template/layout reference, serta effective version. Field produksi diisi Owner sebelum UAT; sistem tidak mengarang identitas legal atau nomor pajak.

Semua dokumen memakai language snapshot booking/recipient (`id`/`en`) dengan fallback terkontrol dan nilai resmi IDR. Dokumen dapat dirender PDF untuk print/download serta dikirim melalui email. Rendered/issued document menyimpan snapshot agar perubahan template/profile tidak menulis ulang dokumen lama.

### Proforma/payment instruction

Dibuat setelah booking dan memuat nightly breakdown, total IDR, required payment sesuai source—100% untuk customer-created online atau deposit/full policy pada admin-created manual—deadline, kebijakan, serta instruksi transfer.

### Receipt

Dibuat hanya untuk verified payment dan memuat amount received, method, waktu, reference, allocation bila ada, serta remaining folio balance.

### Invoice

- Interim invoice dapat diterbitkan setelah booking confirmed bila diperlukan.
- Final invoice dapat diterbitkan saat checkout.
- Invoice menyimpan snapshot line dan total saat `Issued`.
- Invoice issued tidak diedit; koreksi menggunakan folio adjustment/reversal dan document version/void/supersede.
- Front Office berizin dapat issue, void, atau supersede invoice tanpa Owner approval. Reason, affected coverage, old/new document link, actor, waktu, dan audit wajib.

### Refund note

Dibuat hanya setelah refund berstatus `Refunded`.

### Folio statement

Menampilkan seluruh charge, invoices, payment allocations, refunds, debit/credit total, serta master balance meskipun invoice dipisah.

## 13. Document numbering

Sequence terpisah, unik, dan tidak digunakan ulang, misalnya:

```text
PRO-202608-0001
INV-202608-0001
RCT-202608-0001
RFN-202608-0001
```

Format final dikonfigurasi setelah identitas legal invoice dikonfirmasi.

Sequence dipisahkan per document type, atomic/concurrency-safe, tidak mundur, tidak didaur ulang, dan tidak menggunakan ulang nomor dokumen voided/superseded. Owner mengelola format/sequence master; Front Office hanya menerbitkan dokumen melalui action resmi.

## 14. Tax dan service-charge profile

Tax/service charge dihitung ketika folio charge diposting dan disimpan sebagai snapshot. Invoice hanya menampilkan component entries tersebut.

Keputusan konfigurasi P0:

- Tax dan service charge merupakan komponen/profile terpisah.
- Room, extra guest/bed, F&B, service/tour, early check-in/late checkout, damage charge, dan ancillary lain dapat mempunyai profile berbeda.
- `No Tax` menjadi initial safe configuration sampai Owner/pihak yang menangani perpajakan mengonfirmasi profile, rate, calculation order, rounding, effective date, serta label dokumen yang benar. Ini bukan kesimpulan mengenai kewajiban pajak KOOKA.
- Profile produksi harus diaktifkan secara eksplisit; sistem tidak boleh menambahkan persentase asumsi atau menghitung tax/service tersembunyi.

Mode:

- `No Tax/Non-Taxable`.
- `Tax Inclusive`.
- `Tax Exclusive`.
- `Custom/Manual` untuk pengguna berizin.

Tax profile minimal menyimpan:

- Nama dan label Indonesia/English.
- Rate percentage atau fixed amount.
- Inclusive/exclusive mode.
- Effective date dan status aktif.
- Default scope/category.
- Calculation order dan discount treatment.
- Rounding rule.
- Version, creator/approver, dan audit.

Tax/service profile dapat menjadi default pada room rate/rate plan, menu category/item, tour, service, package component, cancellation fee, guest damage catalog/item, room-move adjustment, atau custom charge. Admin berizin dapat memilih profile lain, `No Tax`, atau manual rate/amount dengan reason dan audit.

Service charge dipisahkan dari tax walaupun menggunakan calculation engine serupa. Invoice dapat menampilkan subtotal, service charge, tax, dan grand total secara terpisah.

Nilai/rate aktual harus dikonfirmasi Owner/pihak yang menangani perpajakan sebelum digunakan.

## 15. Tax snapshot dan konsistensi invoice

Setiap taxable charge menyimpan:

- Tax/service profile dan version.
- Taxable base.
- Rate/fixed amount.
- Tax/service amount.
- Inclusive/exclusive.
- Discount/calculation order.
- Rounding result.

Perubahan master profile tidak mengubah folio/invoice lama. Koreksi menggunakan reversal dan posting baru.

Invariants:

- Combined invoice dan split invoices menggunakan entries yang sama.
- Room-only invoice menyertakan room tax/service components.
- Other-charges invoice menyertakan tax/service components sumbernya.
- Tax tidak dihitung ulang saat document rendering.
- Total split invoices sama dengan combined representation untuk coverage yang sama.
- Satu charge/tax component tidak dapat masuk ke dua active final invoices.

## 16. Multi-room dan group

Phase 1:

- Satu master folio.
- Entry dapat difilter per booking line/room/source.
- Combined atau split invoice per room, payer/guest, room-only, extras-only, atau custom entry selection.
- Invoice recipient dapat berbeda per invoice.
- Extra-bed dan extra-guest charge ditelusuri ke booking line/stay serta dapat mengikuti invoice kamar atau extras invoice.
- Guest Damage Charge ditelusuri ke incident, assessment, catalog/version, room stay, quantity, unit price, tax snapshot, evidence/approval reference; dapat masuk combined atau other-charges/custom invoice.
- Early check-in/late checkout charge memakai `Accommodation Add-on` source, approved-time dan price/tax snapshot; operational approval tidak sama dengan posting/payment, dan retry tidak membuat debit ganda.

Phase 2:

- Payer/billing routing rules dan folio window/subfolio yang lebih lengkap.
- Transfer whole charge antarwindow dengan reason/audit; partial line split memerlukan source breakdown atau reversal/posting baru.
- Company/master billing dan invoice per guest/perusahaan yang lebih kompleks.
- Package/Whole House folio entries menyimpan component snapshot/allocation; combined dan component-split invoice memakai source entries yang sama.
- POS/service order memiliki satu source-of-truth; standalone/room/split settlement serta package linkage tidak boleh membuat duplicate charge.

## 17. Permission dan approval

Front Office berizin dapat menambah charge, memverifikasi payment, membuat discount/complimentary/adjustment, memilih invoice scope, mengalokasikan payment, melakukan payment void/reversal, memproses refund, serta void/supersede invoice secara langsung jika business guard terpenuhi. Tindakan tersebut tidak memakai Owner approval atau nominal limit.

Guest Damage Charge hanya dapat diposting dari assessment `Approved`; status ini dapat ditetapkan Front Office berizin dan bukan Owner approval. Manual amount di luar reference range membutuhkan reason/evidence dan dapat memicu non-blocking alert, tetapi tidak masuk approval queue. Dispute/waiver tidak diubah menjadi posted charge tanpa keputusan Front Office yang tercatat.

Owner/Super Admin mengendalikan role/permission, rekening, tax/service master, folio reopen/closure override, dan high-risk configuration. Owner tetap dapat melakukan action Front Office, tetapi bukan approver wajib untuk transaksi operasional.

Custom tax/no-tax override, invoice void/supersede, payment reallocation, folio reopen, dan balance override selalu membutuhkan permission, reason, serta audit. Front Office tidak dapat mengubah role sendiri, menghapus audit, atau mengedit posted entry.

## 18. Idempotency dan transaction

Action berikut harus idempotent:

- Post room/POS/service charge.
- Post verified payment.
- Post room-move/cancellation adjustment.
- Post approved guest damage charge.
- Reverse charge/payment.
- Post completed refund.
- Issue/void/supersede invoice.
- Allocate payment.
- Close/reopen folio.

Konflik atau retry tidak boleh membuat duplicate entry/document/allocation atau partial side effect.

## 19. Minimum acceptance tests

- Satu booking memiliki satu master folio dan seluruh source charge dapat ditelusuri.
- Posted item tidak dapat diedit/dihapus; correction menggunakan reversal.
- Payment verified dan refund completed masing-masing memposting tepat satu entry.
- Checkout dengan outstanding balance menjaga folio tetap open.
- Closed folio hanya dapat direopen dengan permission dan audit.
- Combined invoice memuat room, ancillary, tax, dan service-charge entries yang dipilih.
- Room-only + other-charges active invoices sama dengan combined representation entries yang sama.
- Satu charge tidak dapat masuk ke dua active final invoices.
- Payment allocation tidak melebihi verified payment dan tidak membuat payment baru.
- Invoice issued tidak dapat diedit; gunakan void/supersede/version baru.
- Tax profile room/F&B/tour/service dapat berbeda atau `No Tax`.
- Perubahan tax master tidak mengubah historical folio/invoice.
- Tax/no-tax manual override membutuhkan permission, reason, dan audit.
- Booking deposit dan security deposit tidak tercampur.
- Combined atau split per-room/per-payer/extras invoice mengambil master entries yang sama tanpa duplicate coverage.
- Booker, payer, dan invoice recipient dapat berbeda tanpa memindahkan atau menggandakan payment.
- Extra-bed charge dicatat sebagai accommodation add-on terpisah dari service/tour dan extra-guest charge.
- Damage catalog price/tax version tersnapshot; perubahan master tidak mengubah assessment/folio lama.
- Approved damage assessment memposting tepat satu debit ketika di-retry; internal maintenance cost tidak diposting otomatis.
- Damage charge dapat masuk combined atau other-charges/custom invoice tanpa duplicate coverage; waiver/dispute/reversal mempertahankan reason, approval, dan histori.
- Bundled package/Whole House total direkonsiliasi dengan component allocation dan explicit discount/rounding tanpa membuat balancing entry tersembunyi.
- Retry POS/service posting menghasilkan satu entry; order cancel, financial reversal, dan refund tetap dapat ditelusuri terpisah.

## 20. Di luar scope

- Accounting general ledger penuh.
- Revenue recognition/accounting period close.
- Bank reconciliation otomatis.
- E-faktur atau integrasi pajak otomatis.
- Complex corporate accounts receivable.
