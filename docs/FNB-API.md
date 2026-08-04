# F&B Paper-Order API

Status: Technical Batch 5 / Roadmap Langkah 20 telah diimplementasikan dan lulus automated test serta disposable PostgreSQL migration test. Input multi-menu dan penomoran formulir harian telah lulus browser smoke; human UAT dan data menu produksi masih menunggu Owner.

## 1. Prinsip transaksi

- Customer memesan memakai formulir kertas; Front Office memasukkan pesanan ke sistem.
- Satu formulir dapat berisi 1–50 baris menu. Setiap baris menyimpan menu, quantity, dan catatan khususnya sendiri.
- `paperReference` dibuat server secara atomik dengan format `YYMMDDNN` berdasarkan tanggal kalender Jakarta dan urutan harian per property. Contoh order pertama pada 3 Agustus 2026 adalah `26080301`; order code-nya `FNB-26080301`.
- Seluruh mutation wajib memakai `Idempotency-Key`.
- Order/fulfillment, pembayaran standalone, dan folio posting tetap merupakan state terpisah.
- Seluruh nilai resmi disimpan dan diproses dalam IDR. USD/AUD hanya estimasi tampilan dari exchange-rate snapshot yang belum kedaluwarsa.
- Menu item menyimpan versi, harga, tax/service, override, alasan, dan konfirmasi tamu sebagai snapshot transaksi.
- Room charge hanya dapat diposting ke stay aktif dengan assignment aktif, folio terbuka, billing bucket aktif, privilege `ALLOWED`, serta verifikasi nomor kamar dan Room Lead Guest.
- Pembatalan tidak menghapus charge. Debit folio dibalik dengan credit reversal; pembayaran standalone yang sudah diterima ditandai untuk proses refund manual terpisah.

## 2. Public menu

`GET /api/content/menu?locale=id|en`

Tidak memerlukan login. Response berisi kategori aktif, item/version aktif, availability, harga IDR, estimasi total setelah tax/service, serta kurs preferensi USD/AUD yang masih valid. Landing endpoint `GET /api/content/landing` juga menyertakan objek `menu` yang sama.

Menu kosong tidak menghasilkan placeholder atau klaim yang belum diverifikasi pada landing page.

## 3. Menu administration

`GET /api/staff/admin/menu`

Memerlukan staff login dan permission `commercial.view`.

`POST /api/staff/admin/menu`

Memerlukan `Idempotency-Key`. Action:

- `CREATE_CATEGORY` — membuat kategori bilingual.
- `CREATE_ITEM_VERSION` — membuat draft item/version dengan harga IDR dan optional tax profile version milik property yang sama.
- `ACTIVATE_ITEM_VERSION` — menjadikan versi aktif dan me-retire versi aktif sebelumnya.
- `SET_AVAILABILITY` — sold-out/available switch tanpa mengubah histori versi/harga.

Create/activate memerlukan `commercial.manage`; availability memerlukan `fnb.order.manage`. Perubahan dicatat di audit log.

## 4. Manual paper order

`GET /api/staff/fnb/orders`

Mengembalikan queue order terbaru bagi user dengan `fnb.order.manage`.

`POST /api/staff/fnb/orders`

Seluruh action memerlukan staff login dan `Idempotency-Key`:

- `CREATE_PAPER_ORDER`
  - `settlementRoute`: `STANDALONE` atau `ROOM_CHARGE`.
  - Mengirim `items` berisi 1–50 menu aktif dan available; satu formulir/pesanan dapat membawa banyak menu sekaligus.
  - Front Office tidak mengisi nomor formulir. Server mengalokasikan nomor berikutnya secara transaction-safe sehingga dua staf yang menyimpan bersamaan tidak memperoleh nomor yang sama.
  - Printed-price override wajib menyimpan `unitPriceOverrideIdr`, `overrideReason`, dan `guestInformed: true`.
  - `ROOM_CHARGE` juga wajib mengirim `roomStayId`, `expectedRoomNumber`, dan `expectedLeadGuestName`; `billingBucketId` optional dan default memilih bucket aktif `MAIN`.
- `SET_ROOM_CHARGE_PRIVILEGE`
  - Nilai: `ALLOWED`, `NOT_ALLOWED`, atau `APPROVAL_REQUIRED`.
  - Memerlukan `stay.manage` dan reason.
- `TRANSITION_ORDER`
  - Pesanan baru langsung masuk ke `Sedang diproses (PREPARING)`, lalu staf mengubahnya ke `Selesai/disajikan (SERVED)`.
  - Status lama `ACCEPTED`, `READY`, dan `COMPLETED` tetap dikenali untuk kompatibilitas data serta audit, tetapi tidak menjadi langkah wajib di antarmuka.
- `CANCEL_ORDER`
  - Dapat dilakukan dari status yang belum terminal dan membuat reversal bagi folio debit yang sudah ada.
- `RECORD_STANDALONE_PAYMENT`
  - Method: `CASH`, `BANK_TRANSFER`, atau `OTHER`.
  - Nominal harus sama dengan total order dan menghasilkan payment record serta receipt snapshot.

## 5. Permission baseline

- Front Office: menu commercial master, paper order, standalone payment, room charge, dan verifikasi minimum room/lead guest.
- F&B: order, charge, dan guest lookup minimum sesuai permission yang sudah ada.
- KTP, signature, payment evidence lodging, refund bank, dan internal stay note tidak menjadi bagian response F&B.

## 6. Error contract

Error mengikuti contract API project:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Room charge privilege is not allowed"
  }
}
```

Status umum: `400` invalid input/idempotency, `401` unauthenticated, `403` forbidden, `404` target tidak ditemukan, `409` conflict/state guard, dan `500` internal error yang tidak mengekspos detail database.

## 7. Yang masih menunggu Owner/UAT

- Menu/nama/deskripsi/harga/tax/hours produksi.
- Bentuk/penempatan nomor pada kertas fisik, tanda `Processed`, serta retensi/pemusnahan formulir.
- Keputusan price mismatch final dan wording konfirmasi tamu.
- UAT duplicate reference, wrong room, changed price, standalone payment/receipt, room charge, cancellation/reversal, dan refund manual setelah pembayaran.
