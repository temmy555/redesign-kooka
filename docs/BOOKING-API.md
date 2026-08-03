# Booking API — Technical Batch 2

Status: `IMPLEMENTED — UAT VERIFIED` pada 3 Agustus 2026. Alur publik telah diuji dari pencarian kamar sampai booking code, instruksi transfer, dan customer lookup.

## Public flow

1. `GET /api/booking/availability` menerima `checkInDate`, `checkoutDate`, `rooms`, `adults`, `children`, dan `infants`, lalu hanya menawarkan kombinasi tipe kamar + rate plan yang memiliki inventory, tarif online, dan payment instruction.
2. Customer menekan `Pilih kamar`; `POST /api/booking/quote` membuat snapshot harga/nightly tax/display estimate, mengembalikan policy version yang wajib disetujui, serta membuat checkout hold 15 menit. Header `Idempotency-Key` wajib.
3. Setelah customer mengisi nama, email, dan WhatsApp, `POST /api/booking/reservations` mengubah quote menjadi online reservation atomik. Online selalu membutuhkan 100% pembayaran IDR dan tidak menerima deposit.
4. Halaman sukses menampilkan booking code, batas pembayaran, rekening, nominal resmi IDR, dan tombol WhatsApp berisi pesan siap kirim. WhatsApp baru digunakan untuk mengirim booking code serta bukti transfer; Front Office tetap memverifikasi pembayaran di admin.
5. `POST /api/booking/lookup` memverifikasi booking code dan, bila diberikan, email tambahan dengan error generik serta rate limit, lalu membuat cookie session HttpOnly berumur 15 menit.
6. `GET /api/booking/lookup` menampilkan ringkasan booking, saldo IDR, status payment, payment instruction snapshot, serta WhatsApp deep link. Customer tidak memperoleh fitur login, ubah, atau cancel mandiri.

## Staff flow

- `POST /api/staff/bookings`, action `QUOTE` atau `RESERVE`, melayani manual single/multi-room booking. Deposit fixed/percentage serta pay-at-checkin/checkout hanya tersedia pada source admin.
- `POST /api/staff/payments`, action `RECORD_FOR_REVIEW`, mencatat bukti/referensi yang diterima Front Office dan melindungi inventory dari expiry selama review.
- Action `REVIEW` memverifikasi atau menolak payment. Online reservation hanya menjadi confirmed/guaranteed setelah verified payment mencapai 100% required amount.
- Action `VOID` membuat reversal folio untuk verified payment dan mengembalikan/menutup payment hold sesuai deadline.
- Action `CANCEL` pada staff booking membatalkan reservation, melepaskan room/extra-bed claim, membatalkan reminder, dan mencatat alasan/audit. Nominal refund tetap diproses manual sesuai kebijakan.

Semua mutation wajib membawa `Idempotency-Key`. Property scope dan permission staff diselesaikan server-side.

## Inventory dan worker

- Inventory dihitung dari unit fisik aktif serta effective-dated room-type mapping.
- Final quote mengunci baris `inventory_days` dalam urutan room type + stay date, memeriksa ulang capacity, lalu menulis checkout claims dalam transaksi yang sama.
- Reservation tidak memilih nomor kamar. Checkout hold dilepas dan diganti per-room/per-night menjadi `PAYMENT_HOLD` atau `COMMITTED` secara atomik.
- Extra bed memakai pool `EXTRA_BED`. Jika inventory tracking aktif, kapasitas ikut dikunci per tanggal pada quote dan dikonversi menjadi resource claim reservation. Harga/tax/service extra bed wajib berasal dari versioned property setting `EXTRA_BED_PRICING`; sistem menolak quote bila setting resmi belum tersedia dan tidak pernah memberi tarif nol implisit. Charge disimpan terpisah sebagai reservation add-on serta folio entry `EXTRA_BED`.
- Worker menangani quote expiry, reservation expiry, reminder/email, serta review-hold guard. Bukti yang tercatat sebelum deadline mencegah pelepasan inventory sampai admin mengambil keputusan.

## Konfigurasi

Default public payment deadline adalah 2 jam, atau 1 jam untuk same-day booking. Property setting aktif dengan code `BOOKING_PAYMENT` dapat mengisi `onlineDeadlineMinutes` dan `sameDayDeadlineMinutes` (15–1440 menit). Checkout quote hold saat ini 15 menit.

Setting `EXTRA_BED_PRICING` wajib berisi `nightlyRateIdr` bilangan bulat positif serta boolean `noTax`; field opsionalnya adalah `taxRate`, `serviceChargeRate`, `taxInclusive`, dan `serviceChargeInclusive`. Nilai tersebut di-snapshot pada quote/reservation/folio.

Production tetap memerlukan data room/rate/tax/policy/payment-instruction yang telah diverifikasi Owner. `uat:prepare` hanya membuat rekening, kurs, dan tarif sintetis bertanda UAT untuk pengujian lokal; data tersebut tidak digunakan sebagai nilai produksi.
