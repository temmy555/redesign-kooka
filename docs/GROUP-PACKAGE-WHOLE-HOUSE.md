# Multi-room, Group, Package, dan Whole House — KOOKA Residence

Dokumen keputusan produk untuk fondasi Phase 1 dan fitur lengkap Phase 2.

- Status: disetujui untuk PRD.
- Scope: definisi produk, proposal/hold, composite inventory, versioned components, pricing allocation, amend, stay operations, folio, dan invoice.
- Sumber kebutuhan: [PRD.md](PRD.md).

## 1. Definisi

- `Multi-room Booking`: satu reservation biasa berisi lebih dari satu kamar/booking line.
- `Group Booking`: umbrella booking dengan contact person, rooming list, beberapa room/stay, kemungkinan beberapa payer, serta jadwal pembayaran khusus.
- `Package`: produk bundling dengan komponen fixed dan optional seperti kamar, extra bed, F&B credit atau specific paid menu/order, transfer, service, atau tour. Tidak ada breakfast otomatis sebagai room inclusion.
- `Whole House`: produk exclusive-use yang mengonsumsi seluruh room unit dan shared facility/block yang didefinisikan.

Jenis tersebut tidak boleh disatukan menjadi satu `booking_type` tanpa component model, karena aturan inventory dan amend berbeda.

## 2. Multi-room

- Setiap kamar/quantity memiliki booking line dan stay instance sendiri.
- Semua kebutuhan room type/malam dikunci dalam satu transaction.
- Jika satu kamar tidak tersedia, create booking gagal seluruhnya dan menampilkan alternatif; sistem tidak membuat partial booking tanpa persetujuan customer terhadap selection baru.
- Check-in/out, Room Lead Guest, assignment, dan housekeeping tetap per room stay.
- Kode booking dan master folio tetap satu.

## 3. Group proposal, hold, dan reservation

Commercial proposal dipisahkan dari reservation status:

- Proposal status: `Draft`, `Sent`, `Accepted`, `Declined`, `Expired`, atau `Superseded`.
- Inventory hold status: `Active`, `Expired`, atau `Released`.
- Reservation tetap memakai lifecycle `Draft/On Hold/Confirmed/...` yang sudah ditetapkan.

`Inquiry/Quotation` tidak menahan inventory. Jika KOOKA menyetujui tentative allocation, sistem membuat `Tentative Hold` dengan deadline eksplisit. Proposal accepted kemudian membuat/mengamend booking secara transaksional; confirmation mengikuti payment/approval policy.

Group booking menyimpan contact person, organization/company opsional, rooming list version, arrival/departure pattern, payer routing, invoice recipient, notes, dan payment schedule.

## 4. Package component

Package definition memiliki version dan effective dates. Component minimal menyimpan:

- Jenis sumber: room, accommodation add-on, F&B credit/item, service, tour, transfer, atau facility.
- `Fixed` atau `Optional`.
- Quantity dan unit/basis, misalnya per room, per guest, per night, atau per stay.
- Included value/price allocation.
- Tax/service profile.
- Capacity/resource requirement.
- Cancellation/amend rule bila berbeda.

Fixed component otomatis dipilih dan dikunci. Optional component baru dikunci setelah customer/admin memilihnya. Booking menyimpan component version/snapshot sehingga perubahan master package tidak mengubah booking lama.

Package tidak menciptakan inventory baru. Inventory selalu berasal dari room units, add-on resource pool, service/tour resource, dan komponen fisik terkait.

## 5. Whole House

Whole House bukan room type sintetis dengan quantity satu. Ia merupakan sellable composite product dengan versioned component definition.

Component dapat mencakup:

- Daftar seluruh room unit fisik.
- Shared/public facilities yang menjadi eksklusif.
- Included add-ons/services.
- Maximum guest whole house.
- Operational setup dan cleaning requirement.

Availability Whole House hanya `Available` jika seluruh mandatory components tersedia pada seluruh periode. Confirmation mengunci semua komponen secara atomik. Jika satu komponen gagal, tidak ada partial hold/booking yang tertinggal.

Ketika Whole House held/confirmed:

- Room units komponennya tidak dapat dijual individual.
- Package/produk lain yang memakai unit/fasilitas sama juga tidak tersedia.
- Shared facilities yang eksklusif mendapat availability block terkait booking.
- Room assignment, guest allocation, dan housekeeping tetap tersedia per kamar untuk kebutuhan operasional.

## 6. Pricing dan component allocation

Model harga dapat:

- `Component Sum`: total dari komponen.
- `Bundled Fixed Price`: harga bundle berbeda dari retail component sum.
- `Manual/Contract Price`: harga khusus dengan permission dan approval.

Walaupun customer melihat satu package/whole-house price, sistem menyimpan alokasi nilai IDR per komponen untuk tax/service calculation, invoice split, reporting, cancellation/refund reference, dan audit.

Invariants:

- Total component allocation termasuk discount/rounding yang eksplisit sama dengan total resmi package.
- Tax/service memakai component profile/version dan disnapshot saat posting.
- Component retail rate dapat disimpan sebagai reference, tetapi bukan otomatis nilai kontraktual bundle.
- Harga historis tidak berubah ketika master component/rate diperbarui.

## 7. Folio, payer, dan invoice

- Satu booking tetap memiliki satu master folio.
- Folio entry ditautkan ke package component, booking line/stay/room, service date, guest/order, dan payer/billing bucket bila relevan.
- Invoice dapat combined, per room, per payer/company, room-only, component/category-specific, extras-only, atau custom selection.
- Combined dan split mengambil folio entries serta tax snapshot yang sama tanpa duplicate coverage.
- Payment schedule group tidak membuat payment fiktif; payment record hanya dibuat ketika pembayaran benar-benar dicatat.
- Payment dapat dialokasikan ke satu/lebih invoice tanpa menduplikasi payment entry.

## 8. Amend dan cancellation

Multi-room/group dapat menambah, mengurangi, atau mengubah sebagian booking line setelah inventory recheck serta financial adjustment.

Package:

- Optional component dapat ditambah/dihapus sesuai availability dan policy.
- Fixed component hanya dapat diubah melalui package amendment/versioned override berizin.
- Kegagalan mengamankan component baru mempertahankan booking lama.

Whole House:

- Tidak boleh melepas satu room component sambil mempertahankan klaim exclusive-use Whole House.
- Pengurangan kamar mengubah produk menjadi multi-room/group booking melalui explicit conversion workflow.
- Conversion menahan inventory/pricing baru, membuat snapshot baru, menutup/release composite commitment lama hanya setelah sukses, dan meninggalkan audit.

Cancellation fee/refundable amount tetap dimasukkan manual berdasarkan policy snapshot; release inventory dan refund record merupakan proses terpisah.

## 9. Operasional

- Group/Whole House dapat check-in/out secara parsial per room stay tanpa mengubah reservation status secara keliru.
- Rooming list dapat diimpor/diedit pada Phase 2 dan memiliki version/audit.
- Maximum occupancy divalidasi per room dan whole-house total bila dikonfigurasi.
- Housekeeping task tetap per room/facility agar pekerjaan dapat ditugaskan dan diinspeksi.
- Package service/tour/F&B component membuat source order/booking yang dapat dilacak dan tidak memposting folio charge ganda.

## 10. Phase delivery

Phase 1 menyiapkan:

- Booking line/stay per room.
- Composite/component model dan version reference.
- Inventory lock keys yang dapat mengunci seluruh komponen.
- Folio source reference dan invoice selection.

Phase 2 mengaktifkan:

- Group proposal, tentative hold, rooming list, dan payment schedule.
- Package builder dan optional component selection.
- Whole House public/admin booking flow.
- Payer routing, company billing, serta conversion/amend UI lengkap.

## 11. Permission dan audit

- Tentative hold extension, manual/contract price, fixed-component override, Whole House conversion, dan release composite inventory memerlukan permission.
- Audit minimal menyimpan proposal/version, component snapshot, inventory commitments, pricing allocation, tax profile, payer routing, actor, time, reason, dan before/after.
- Maximum physical capacity dan hard overbooking tidak dapat di-override oleh role mana pun.

## 12. Minimum acceptance tests

- Multi-room create berhasil seluruhnya atau gagal tanpa partial booking.
- Inquiry/quotation tidak mengurangi availability; active tentative hold menguranginya sampai deadline.
- Retry proposal acceptance tidak membuat booking atau commitment ganda.
- Package fixed component otomatis dikunci; optional component tidak dikunci sebelum dipilih.
- Perubahan master package tidak mengubah component snapshot booking lama.
- Whole House unavailable jika satu mandatory room/facility tidak tersedia.
- Whole House confirmation mengunci semua component dan mencegah penjualan kamar individual.
- Whole House gagal tidak meninggalkan partial hold/block.
- Partial room release pada Whole House ditolak sampai conversion workflow berhasil.
- Bundled total sama dengan component allocation plus explicit discount/rounding.
- Combined/split invoice tidak menduplikasi component charge atau tax.
- Package service/tour/F&B component hanya membuat satu source order dan satu folio posting yang sah.
