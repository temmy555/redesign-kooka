# POS, F&B, Services, dan Tours — KOOKA Residence

Dokumen keputusan produk untuk fondasi Phase 1 dan fitur penuh Phase 2.

- Status: disetujui untuk PRD.
- Scope: order/fulfillment lifecycle, payment dan folio posting, standalone/room charge/split settlement, charge privilege, resource scheduling, cancellation, void, refund, package linkage, dan shift control.
- Sumber kebutuhan: [PRD.md](PRD.md).

## 1. Prinsip utama

- Master menu/service/tour adalah katalog; order/booking adalah transaksi.
- Order/fulfillment status, payment status, dan folio posting status dipisahkan.
- Order cancellation tidak otomatis menghapus payment atau posted folio charge.
- Satu source transaction hanya boleh memposting satu charge sah; retry tidak membuat charge ganda.
- Standalone, room charge, dan split settlement memakai source order yang sama dan dapat diaudit.
- Extra bed tetap `Accommodation Add-on` dan bukan service/tour.
- Semua room rate `Room Only` terhadap makanan; F&B selalu menjadi order terpisah dan tidak ada breakfast included.

### 1.1 Intake pesanan melalui formulir kertas

- Formulir pesanan tersedia di kamar, diisi customer, lalu diserahkan ke Front Office.
- Customer tidak membuat cart/order langsung pada website dan tidak memerlukan login.
- Front Office membuat `Manual Paper Order` di sistem dengan paper-form/intake reference unik, room/contact context, item/quantity, modifier/note, requested time, source `Paper Room Form`, actor, serta input time.
- Reference disarankan pre-numbered. Bila kertas belum bernomor, sistem menghasilkan intake reference yang ditulis/ditempel pada form dan form ditandai `Processed` setelah order berhasil dibuat.
- Satu paper reference hanya dapat mempunyai satu active source order. Duplicate/correction memakai link dan reason; financial correction tetap melalui reversal.
- Sistem menjadi source of truth setelah input. Kertas adalah source evidence operasional dan mengikuti kebijakan penyimpanan/pemusnahan; scan bersifat opsional dan private bila digunakan.

## 2. POS/F&B order lifecycle

Status order/fulfillment:

- `Draft`: belum dikirim.
- `New`: order sudah dibuat.
- `Accepted`: diterima F&B.
- `Preparing`: sedang dibuat.
- `Ready`: siap disajikan/diambil.
- `Served`: sudah diserahkan.
- `Completed`: fulfillment selesai.
- `Cancelled`: fulfillment dibatalkan.

Cancellation reason minimal: customer request, unavailable item, duplicate, operational issue, quality issue, atau lainnya. Cancellation setelah `Preparing/Ready/Served` dapat membutuhkan waste/service-recovery note dan approval sesuai konfigurasi.

Order status tidak menunjukkan apakah tagihan telah dibayar atau diposting ke folio.

## 3. Payment dan folio posting

Setiap source transaction memiliki settlement route:

- `Standalone`: dibayar langsung dan menghasilkan receipt.
- `Room Charge`: debit diposting ke master folio booking/stay.
- `Split`: sebagian dibayar langsung dan sebagian diposting ke folio, bila fitur diaktifkan.

Folio posting status terpisah:

- `Not Posted`.
- `Posted`.
- `Reversed`.

Payment record tetap menggunakan lifecycle pembayaran yang berlaku. Contoh kombinasi valid: order `Completed`, payment balance `Unpaid`, folio posting `Posted`.

Mengubah settlement route sebelum financial posting diperbolehkan sesuai permission. Setelah payment/folio entry diposting, koreksi menggunakan void/reversal dan posting/allocation baru; tidak boleh mengedit source financial history.

Paper order tidak menentukan settlement hanya dari tulisan nomor kamar. Front Office memilih `Standalone` atau `Room Charge` setelah verifikasi. Standalone menghasilkan receipt/payment sendiri; room charge wajib melewati seluruh guard kamar/folio.

## 4. Room-charge guard

Room charge normal memerlukan:

- Stay `In House`.
- Active room assignment.
- Master folio dapat menerima charge.
- Nomor kamar dan Room Lead Guest diverifikasi staff.
- Charge privilege mengizinkan atau approval diperoleh.
- Billing bucket/payer tujuan dipilih bila booking memiliki beberapa payer.
- Amount, item, tax/service, room/stay, order source, actor, dan waktu tampil pada confirmation step.

Charge privilege minimal:

- `Allowed`.
- `Not Allowed`.
- `Approval Required`.

Saat Front Office berhasil melakukan check-in, sistem otomatis menetapkan
charge privilege menjadi `Allowed`. Dengan demikian pembayaran kamar yang
sudah lunas tidak menutup folio: tamu tetap dapat membebankan F&B dan charge
operasional lain ke kamar selama stay masih `In House`, assignment aktif, dan
folio tetap terbuka. Front Office tetap dapat mengubahnya menjadi `Not Allowed`
jika tamu meminta pembatasan; seluruh perubahan dicatat dalam audit log.

Sistem menampilkan konfirmasi seperti `Kamar 2 · Budi Santoso · KKA-... · Rp150.000`. Data yang diperlihatkan kepada role F&B dibatasi pada informasi verifikasi minimum.

High-value threshold, company-paid room, atau restricted billing bucket dapat memerlukan approval Front Office/Owner.

Posting ke booking mendatang atau stay yang sudah checkout tidak diperbolehkan pada alur normal. Koreksi khusus menggunakan permission, reason, folio-open/reopen guard, serta audit; alternatifnya transaksi diproses standalone.

## 5. POS item dan pricing snapshot

Order item menyimpan:

- Menu item/version, nama snapshot, quantity, modifier, notes.
- Unit price, discount, tax/service profile snapshot, rounding, dan total IDR.
- Service/business date.
- Cancellation/void quantity serta reason bila ada.
- Source package/component bila included.

Perubahan harga/menu master tidak mengubah order lama. Discount, complimentary, tax override, dan void dapat dilakukan Front Office berizin dengan reason, before/after, dan audit tanpa Owner approval.

Jika harga tercetak pada formulir berbeda dari active menu version, sistem menampilkan selisih. Front Office meminta konfirmasi tamu terhadap harga aktif atau menggunakan `Honor Printed Price/Manual Override` sesuai permission; snapshot, reason, guest informed, actor, dan audit disimpan tanpa Owner approval.

## 6. Services dan tours

Master menyimpan nama/deskripsi Indonesia-English, price basis, duration, capacity, schedule, resource/provider, meeting point, inclusions, restrictions, cancellation policy, tax/service profile, dan visibility.

Lifecycle fulfillment:

- `Requested`.
- `Reserved`.
- `Confirmed`.
- `In Progress`.
- `Completed`.
- `Cancelled`.
- `No Show`.

Payment dan folio posting tetap terpisah dari lifecycle tersebut.

Service/tour dapat:

- Standalone dengan booking code, folio/transaksi, invoice, dan payment sendiri.
- Terhubung ke lodging booking lalu diposting ke master folio.
- Menjadi fixed/optional package component.

Jika resource scheduling aktif, confirmation mengunci staf, kendaraan, guide, provider slot, atau kapasitas lain. Kegagalan resource tidak boleh meninggalkan partial service booking atau duplicate charge.

## 7. Package linkage

Package component membuat/reference tepat satu source POS order atau service/tour booking bila fulfillment perlu dikelola.

- Included component tidak diposting kembali sebagai retail charge jika nilainya sudah berada dalam package allocation.
- Upgrade, overage, quantity tambahan, atau non-included item diposting sebagai entry terpisah yang jelas.
- Package component ID/version disimpan pada source order dan folio entry.
- Retry tidak membuat source order atau folio posting kedua.

## 8. Cancellation, void, refund, dan service recovery

Keempatnya berbeda:

- `Cancel Order/Booking`: menghentikan fulfillment.
- `Void/Reversal`: membatalkan financial posting yang salah/tidak berlaku.
- `Refund`: mengembalikan payment yang telah diterima melalui refund record manual.
- `Service Recovery/Credit`: kompensasi berupa credit/discount beralasan.

Jika order dibatalkan sebelum posting/payment, tidak ada financial reversal. Jika sudah diposting, sistem membuat reversal. Jika payment sudah diterima dan perlu dikembalikan, refund record dibuat terpisah oleh Front Office berizin dengan reason/evidence/audit.

## 9. Tax, invoice, dan billing

- Item/menu/service/tour dapat memiliki tax/service profile versioned atau `No Tax`.
- Tax/service disnapshot ketika charge diposting.
- Combined maupun split invoice mengambil source folio entries yang sama dan tidak menghitung ulang tax.
- Standalone order/service menghasilkan receipt/invoice sendiri.
- Room charge dapat mengikuti combined, per-room, per-payer, extras-only, atau custom invoice.
- Payment allocation tidak membuat payment record baru.

## 10. Shift dan operational control

Phase 2 POS minimal mendukung:

- Open/close shift dengan actor dan waktu.
- Ringkasan order, gross/net sales, payment method, room charge, discount, complimentary, cancellation, void, refund reference, serta variance/cash count bila cash digunakan.
- Sold-out/unavailable item dan availability hours.
- Handoff order yang belum selesai.
- Audit untuk perubahan setelah shift close.

Recipe costing, ingredient stock, procurement, kitchen display, automated printer, provider settlement, dan accounting integration berada di fase berikutnya.

## 11. Permission dan data exposure

- F&B mengelola order serta settlement sesuai permission tetapi tidak dapat mengubah booking/rate/refund kamar.
- Front Office dapat menyetujui room charge, memilih billing bucket, atau memproses service/tour booking.
- Owner mengatur role/permission dan tax/service master; Front Office berizin dapat menjalankan complimentary, void, serta correction langsung dengan reason/audit.
- F&B hanya melihat room number, Room Lead Guest atau identifier minimum, charge privilege, dan payer/bucket yang diperlukan; tidak melihat KTP, signature, payment evidence, refund bank, atau internal stay notes.

## 12. Phase delivery

Phase 1 menyiapkan:

- Folio source module/record reference.
- Billing bucket/payer dan charge privilege.
- Idempotent posting/reversal.
- Tax/service profile dan invoice coverage.
- Package component linkage.
- Basic manual paper-order entry oleh Front Office, unique intake reference, active menu price/tax snapshot, order lifecycle dasar, standalone receipt/payment, room-charge guard/posting, dan audit.

Phase 2 mengaktifkan dedicated POS/F&B UI, shift, richer menu availability, service/tour booking, resource scheduling, split settlement, QR/menu enhancement, serta operational reports. Paper-order intake tetap didukung.

Phase 3 dapat menambahkan ingredient inventory, recipe costing, kitchen display/printer automation, provider settlement, dan accounting integration.

## 13. Minimum acceptance tests

- Order `Completed` tidak otomatis dianggap paid.
- Cancelling order tidak menghapus payment/folio entry.
- Standalone order menghasilkan receipt tanpa lodging folio.
- Room charge menolak stay yang belum check-in/sudah checkout pada alur normal.
- Room charge memerlukan active assignment, Room Lead Guest verification, charge privilege, dan billing destination.
- Retry room-charge posting menghasilkan tepat satu folio debit.
- Mengubah settlement setelah posting menggunakan reversal/repost tanpa menghapus histori.
- Split settlement tidak membuat total payment/charge melebihi order total.
- Service/tour resource terakhir tidak dapat dikonfirmasi dua kali oleh concurrent request.
- Package included component tidak memposting retail charge ganda.
- Cancelled posted order membuat reversal; refund hanya dibuat bila payment perlu dikembalikan.
- Item tax snapshot tidak berubah ketika master tax/menu diperbarui.
- F&B tidak dapat melihat data identitas atau pembayaran lodging yang tidak relevan.
- Satu paper reference tidak dapat membuat dua active order; retry input mengembalikan order yang sama atau duplicate warning.
- Room number pada kertas tanpa active-stay/guest verification tidak dapat diposting ke folio dan dapat dialihkan menjadi standalone.
- Printed-price mismatch memerlukan guest confirmation atau approved override dan menyimpan snapshot/reason/audit.
- Menandai kertas `Processed` tidak mengubah order menjadi paid/served; status order, payment, dan folio posting tetap terpisah.
