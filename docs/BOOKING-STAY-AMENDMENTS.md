# Booking dan Stay Amendments — KOOKA Residence

| Informasi | Nilai |
|---|---|
| Versi | 1.1 Draft |
| Tanggal | 1 Agustus 2026 |
| Scope | Phase 1 date change, extension, shortening, dan early departure |
| Sumber kebutuhan | [PRD.md](PRD.md) |

## 1. Tujuan

Amendment mengubah tanggal, room nights, atau booking line secara terkendali tanpa kehilangan inventory lama, menggeser booking confirmed, mengedit histori harga, atau mencampur actual stay dengan keputusan finansial.

Customer tidak melakukan self-service mutation pada Phase 1. Front Office memproses permintaan dari kanal resmi dan menyimpan bukti konfirmasi.

## 2. Jenis amendment

- `Pre-arrival Date Shift`: memindahkan interval sebelum check-in.
- `Extension`: menambah malam sebelum atau saat in-house.
- `Pre-arrival Shortening`: menghapus malam sebelum check-in.
- `Early Departure`: tamu mengakhiri room stay lebih awal.
- `Partial Multi-room Amendment`: hanya booking line/room stay tertentu berubah.
- `Guest Count/Add-on Adjustment`: dapat menyertai amendment tetapi capacity, extra guest, extra bed, dan source charge tetap divalidasi pada workflow masing-masing.

Cancellation seluruh booking tetap memakai cancellation action. Late checkout intraday memakai Stay Timing Request; melewati overnight threshold dikonversi menjadi extension.

## 3. Lifecycle

`Draft → Pending Guest Confirmation → Applied`

Alternatif terminal: `Rejected` atau `Cancelled`.

- Draft tidak mengubah inventory/folio.
- Pending dapat membuat short amendment hold pada new nights bila dikonfigurasi.
- Applied bersifat terminal; koreksi dibuat sebagai amendment/reversal baru.
- Reject/Cancel melepaskan amendment hold secara idempotent dan mempertahankan booking lama.

## 4. Data minimum

- amendment code dan type;
- booking serta booking line/room stay target;
- source/channel dan requested time;
- before/after dates, type, quantity, guest/add-on context;
- old/new inventory requirement;
- old/new nightly breakdown, total IDR, tax/service, dan delta;
- policy/rate snapshot serta price treatment;
- customer confirmation evidence/status;
- actor/decision maker, reason, created/applied time;
- affected assignment, cleaning, add-on/resource, folio, document, notification, dan audit references.

## 5. Atomic inventory apply

Urutan apply:

1. Lock booking/version, target lines/stays, assignments, holds, dan affected room nights.
2. Validate dates, occupancy, room type, restrictions, physical unit conflict, blocks, add-on resources, serta next arrivals.
3. Create/commit new inventory requirements.
4. Update booking line/stay/assignment and dependent schedule.
5. Release only removed old room nights.
6. Post authorized financial adjustments and business event.
7. Commit transaction; notification/document processing berjalan melalui outbox.

Jika langkah sebelum commit gagal, tidak ada perubahan parsial. Cache bukan source of truth dan retry memakai idempotency key.

## 6. Extension

- Confirmed booking/active hold yang lebih dahulu memiliki commitment tetap dilindungi.
- Same-room extension hanya berlaku bila semua additional nights aman.
- Jika unit sama tidak tersedia, Front Office dapat memilih room move/type alternative untuk interval tambahan atau menolak.
- Perubahan booking mendatang tidak otomatis; jika KOOKA memilih upgrade operasional, gunakan `Complimentary Upgrade / No Price Change` sebagai default recommendation Front Office.
- Guest-requested higher type dapat memakai `Additional Charge` atau waiver oleh Front Office. Downgrade memerlukan guest acceptance dan credit/compensation.
- Extension tidak mengubah tanggal/commitment lama sebelum alternative apply berhasil.

## 7. Date shift sebelum check-in

- Seluruh interval baru divalidasi, bukan hanya tanggal awal/akhir.
- New commitment diperoleh sebelum old commitment dilepas dalam transaction yang sama.
- Jika new dates gagal, booking lama tetap confirmed dan utuh.
- Room type/quantity/capacity/add-on diperiksa ulang.
- Revised confirmation menyatakan tanggal, harga, payment/outstanding, serta policy snapshot baru yang relevan.

## 8. Shortening dan early departure

### Pre-arrival shortening

- Hanya selected nights/lines yang dilepas setelah apply.
- Cancellation/shortening fee, credit, dan refundable amount diputuskan manual berdasarkan policy snapshot.

### Early departure

- Tamu harus mengonfirmasi bahwa room stay berakhir; keluar sementara bukan early departure.
- Actual checkout menghasilkan `Checked Out`, unit `Vacant + Dirty`, serta satu turnover task.
- Future room nights dilepas hanya melalui authorized action dan dapat dijual kembali setelah inventory commitment dilepas; physical ready tetap mengikuti cleaning/inspection.
- Financial outcome terpisah: no credit, partial credit, waived charge, atau manual refund sesuai policy dan keputusan Front Office berizin.
- Refund membutuhkan Refund Record; folio entry lama tidak dihapus.

## 9. Pricing, folio, dan payment

- Unchanged nights mempertahankan original rate/tax/policy snapshot.
- Added nights memakai current atau specifically approved rate.
- Removed/changed nights memakai adjustment/credit atau reversal/new posting; posted charge tidak diedit.
- Preview menampilkan old total, new total, delta IDR, tax/service delta, verified payments, outstanding/overpayment, dan proposed financial action.
- Additional balance tidak otomatis dianggap paid.
- `Pre-arrival amendment` dengan delta debit tetap berstatus `Pending Guest Confirmation`; separate payment requirement/guard harus terpenuhi sebelum menjadi `Applied`. Tambahan saldo harus terverifikasi, booking/inventory lama tetap utuh, dan new-night amendment hold memiliki deadline serta dilepas bila payment gagal/expired.
- `In-house extension/amendment` dengan delta debit boleh langsung `Applied` oleh Front Office setelah inventory aman. Delta diposting sebagai outstanding folio dan tidak dianggap paid sampai Payment Record terverifikasi.
- Delta credit diposting sebagai adjustment/credit. Overpayment tidak membuat refund otomatis; Front Office membuat Refund Record manual bila diputuskan.
- Refund tidak otomatis dibuat dari overpayment atau early departure.

## 10. Multi-room dan dependency

- Target booking line/room stay wajib eksplisit.
- Guest allocation, payer/billing bucket, invoice coverage, extra bed, service, cleaning, dan room assignment lain tidak berubah kecuali dipilih.
- Jika amendment membuat group/package/whole-house constraint tidak valid, apply ditolak atau memerlukan conversion workflow resmi.
- Extra-bed resource dan room inventory yang wajib harus berhasil diamankan secara atomik.

## 11. Cleaning dan room operations

- Extension memperbarui due-out dan menunda/mengganti turnover task yang belum dimulai secara idempotent.
- Shortening/early departure memperbarui checkout target dan membuat tepat satu turnover task saat actual checkout.
- Room move untuk extension menghasilkan setup/removal/relocation serta old-room cleaning sesuai effective time.
- Task yang sudah berjalan tidak dihapus; perubahan memakai cancel/defer/replacement reason dan audit.

## 12. Dokumen dan notifikasi

- Applied amendment membuat business event `Booking Amended`.
- Revised confirmation dikirim bila customer-facing dates/room type/guest count berubah.
- Proforma/invoice mengikuti financial impact; issued invoice tidak diedit dan memakai adjustment/void/supersede sesuai aturan.
- Scheduled reminder lama dibatalkan/diganti berdasarkan state/tanggal/deadline baru.
- WhatsApp manual tidak diklaim delivered tanpa bukti channel.

## 13. Permission dan audit

Permission dipisahkan untuk draft, hold, apply, price override, no-price-change, credit, release nights, early checkout, invoice supersede, serta refund.

Audit menyimpan before/after, target, inventory result, quote/delta, policy/rate version, confirmation/payment evidence, actor/decision maker, reason, timestamp, idempotency reference, serta linked source actions. Tidak ada Owner approval limit untuk price/credit/no-change/refund action Front Office.

## 14. Minimum acceptance tests

- Date shift gagal mempertahankan booking/inventory/folio lama.
- Dua amendment bersamaan tidak dapat menjual unit terakhir dua kali.
- Extension tidak menggeser confirmed next booking.
- Same-room unavailable menawarkan valid alternative atau rejection tanpa partial change.
- Unchanged nights mempertahankan snapshot; added nights memakai current/approved rate.
- Pre-arrival delta debit belum menerapkan amendment sampai tambahan pembayaran verified; in-house delta debit dapat menjadi outstanding folio atas action Front Office setelah inventory aman.
- Early departure tidak disimpulkan dari tamu yang keluar sementara.
- Early checkout membuat Vacant + Dirty dan tepat satu turnover task.
- Inventory release, financial credit, dan refund adalah action terpisah.
- Partial multi-room amendment tidak mengubah line lain.
- Retry apply tidak menggandakan hold, commitment, charge, credit, cleaning task, document, atau notification.
- Issued invoice tidak diedit dan old document tetap dapat ditelusuri.
- Reminder lama dibatalkan setelah amendment applied/cancelled.

## 15. Keputusan sebelum implementasi

- Amendment-hold duration dan expiry behavior.
- Default rate treatment untuk added nights.
- Front Office price/credit/no-change permission, mandatory reason/evidence, dan non-blocking monitoring alert bila digunakan; tidak ada Owner approval limit.
- Early-departure charge/credit policy dan release authority.
- Durasi/deadline amendment payment hold untuk pre-arrival; prinsip payment-before-apply versus in-house outstanding sudah disetujui.
- Partial multi-room authority/customer confirmation.
- Revised confirmation/proforma/invoice notification matrix.
