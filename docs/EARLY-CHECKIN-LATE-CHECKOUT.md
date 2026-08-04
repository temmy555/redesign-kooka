# Early Check-in, Late Checkout, dan Waktu Kedatangan — KOOKA Residence

| Informasi        | Nilai                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Versi            | 1.2 Draft                                                              |
| Tanggal          | 4 Agustus 2026                                                         |
| Scope            | Phase 1 — Front Office approval, readiness, turnover, dan folio charge |
| Sumber kebutuhan | [PRD.md](PRD.md)                                                       |

## 1. Keputusan utama

- Jam standar default adalah check-in `14:00` dan checkout `12:00` dalam zona waktu `Asia/Jakarta`; keduanya dapat dikonfigurasi oleh pengguna berizin.
- Jam standar adalah acuan informasi dan perencanaan, bukan batas kedatangan yang memblokir transaksi.
- Early check-in dan late arrival/check-in tidak memiliki cutoff jam global. Front Office memutuskan langsung di lokasi sesuai kesiapan kamar, masa booking yang masih berlaku, dan kondisi operasional.
- Sistem tidak membatalkan booking atau menandai no-show otomatis hanya karena tamu datang lebih malam.
- Early check-in dan late checkout hanya dapat disetujui langsung oleh Front Office/Owner.
- Customer dapat menyampaikan perkiraan waktu kedatangan atau permintaan, tetapi hal tersebut bukan jaminan.
- Early check-in hanya disetujui jika unit telah kosong, assigned, dan `Ready for Check-in`.
- Late checkout ditolak bila unit dibutuhkan tamu berikutnya, next guest sudah menunggu/akan segera datang, properti atau room type penuh sehingga tidak ada resolusi aman, atau waktu cleaning/inspection tidak cukup.
- Confirmed booking berikutnya tidak boleh digeser atau dibatalkan otomatis untuk memenuhi late checkout.

### 1.1 Konfigurasi jam standar

- `standard_check_in_time` dan `standard_check_out_time` adalah konfigurasi properti yang terpisah, bukan nilai hardcoded.
- Konfigurasi memiliki version, effective date, actor/approver, reason, dan audit. Perubahan baru berlaku pada quote/booking sesuai effective period dan tidak diam-diam mengubah policy snapshot booking confirmed lama.
- Website, booking flow, confirmation, dokumen pre-arrival, admin, serta housekeeping memakai resolved configuration yang sama agar tidak menampilkan jam berbeda.
- Scheduled check-in/out berasal dari policy snapshot booking; actual check-in/out disimpan terpisah sebagai timestamp kejadian nyata.
- Early check-in berarti waktu sebelum scheduled check-in booking tersebut; late checkout berarti waktu setelah scheduled checkout.
- Tidak ada konfigurasi `earliest early check-in`, `latest late arrival`, atau cutoff no-show otomatis. Keputusan waktu kedatangan tetap berada pada Front Office.
- Late checkout juga tidak memakai batas jam global, tetapi setiap persetujuan tetap mencatat waktu sampai kapan kamar digunakan agar housekeeping dan kedatangan berikutnya dapat direncanakan.
- Fleksibilitas waktu tidak melewati masa booking secara diam-diam. Kedatangan setelah checkout asli atau penggunaan kamar yang masuk malam berikutnya diproses sebagai booking/amend/extension sesuai availability.
- Sistem memvalidasi format jam, timezone, effective-period overlap, serta dampaknya pada same-day turnover. Perubahan konfigurasi yang membuat waktu cleaning/inspection tidak aman harus diberi warning atau ditolak sesuai configuration permission/policy.

## 2. Data dan status permintaan

`Stay Timing Request` menyimpan:

- Jenis `Early Check-in` atau `Late Checkout`.
- Room stay/booking line dan unit bila sudah assigned.
- Requested time, approved time, submitted channel, requester, note, dan timestamp.
- Status, decision reason, actor/approver, conflict/readiness snapshot, charge/waiver reference, serta audit.

Lifecycle:

`Requested → Approved / Rejected / Cancelled → Completed`

`Expired` dapat digunakan bila waktu permintaan terlewati tanpa keputusan. Status request terpisah dari reservation, stay, occupancy, housekeeping, payment, dan folio.

## 3. Estimated Time of Arrival

- Customer boleh mengisi ETA pada booking atau memberitahukannya melalui Front Office.
- ETA adalah informasi operasional, bukan approval early check-in, nomor kamar, atau perubahan tanggal.
- ETA malam tidak mengubah kebijakan guaranteed late arrival. Tamu yang datang pukul 00:00 tetap dapat check-in bila commitment dipertahankan dan check-in guard terpenuhi.
- Tidak ada jam terakhir check-in selama periode booking belum berakhir. Front Office dapat menerima kedatangan malam atau dini hari tanpa membuka inventory baru bila commitment masih dipertahankan.
- ETA tidak menggeser checkout, nightly breakdown, atau harga.
- Perubahan ETA memperbarui prioritas/visibility operasional tetapi tidak membuat inventory commitment baru.

## 4. Early check-in guard

Front Office hanya dapat approve jika:

- Reservation sudah `Confirmed` dan stay `Due In`.
- Unit fisik telah assigned dan tidak overlap.
- Previous stay telah benar-benar checkout; occupancy unit `Vacant`.
- Housekeeping, serviceability, maintenance/block, extra-bed setup, dan inspection memenuhi `Ready for Check-in`.
- Kapasitas, guest allocation, pembayaran, serta check-in guard lain valid.
- Waktu yang disetujui tidak membuat konflik operasional lain.

Jika unit belum siap atau masih ditempati, request ditolak atau dibiarkan menunggu keputusan; sistem tidak boleh mengubah readiness/occupancy secara paksa. Actual check-in tetap dilakukan melalui action `Check In` ketika tamu benar-benar masuk.

## 5. Late checkout guard

Sebelum approve, sistem menampilkan:

- Next assigned/unassigned arrival yang membutuhkan room type/unit.
- Expected arrival/approved early check-in tamu berikutnya.
- Cleaning dan inspection duration/target ready time.
- Alternative unit/type yang benar-benar tersedia bila diperlukan.
- Maintenance, block, room move, waktu penggunaan yang disetujui, serta folio/payment impact.

Late checkout wajib ditolak jika:

- Ada confirmed next arrival dan waktu tersisa tidak cukup untuk checkout, cleaning, inspection, serta target ready time.
- Next guest sudah menunggu atau kedatangannya sudah dekat sehingga service commitment tidak dapat dipenuhi.
- Properti/room type penuh dan tidak ada unit alternatif valid yang ready.
- Terdapat maintenance/block/operational requirement yang membutuhkan unit dikosongkan.
- Penggunaan kamar masuk malam berikutnya dan harus diproses sebagai extension, tetapi inventory malam berikutnya tidak tersedia.

Alternatif tidak boleh dibuat diam-diam. Room move/upgrade untuk booking berikutnya hanya melalui workflow resmi, availability check, approval/guest communication yang diperlukan, dan price treatment yang tercatat.

## 6. Operational occupancy block dan inventory

- Inventory menginap tetap memakai interval malam `[check-in, checkout)`.
- Late checkout yang masih berada dalam hari keberangkatan membuat `Operational Occupancy Block` dari scheduled checkout sampai approved time pada unit fisik.
- Block berbasis waktu mencegah unit dianggap siap/tersedia secara operasional dan memperbarui cleaning target, tetapi tidak membuat room-night charge baru secara otomatis.
- Jika approved time masuk malam berikutnya, permintaan harus diubah menjadi stay extension dan menjalankan inventory locking per malam.
- Early check-in tidak membuat malam sebelumnya terjual ulang atau mengubah arrival date tanpa amend resmi.

## 7. Housekeeping dan room readiness

- Approved late checkout memperbarui expected checkout, cleaning start window, target ready time, priority, dan same-day-turnover alert.
- Jika terdapat next arrival, dashboard menampilkan risiko keterlambatan serta countdown terhadap target ready time.
- Early check-in approval hanya terjadi setelah cleaning/inspection selesai; approval tidak menutup task secara otomatis.
- Actual checkout tetap membuat unit `Vacant + Dirty` dan turnover task sesuai lifecycle normal.
- Actual early check-in membuat stay `In House` serta room `Occupied` melalui check-in action normal.

## 8. Pricing dan folio

Early check-in/late checkout merupakan `Accommodation Add-on`, bukan service/tour.

Price treatment:

- `Free` sesuai policy.
- `Fixed Amount` IDR.
- `Percentage of Nightly Rate`.
- `Manual Amount` sesuai permission.
- `Complimentary/Waived` oleh Front Office berizin dengan reason dan audit tanpa Owner approval.

Charge menyimpan add-on type/version, requested/approved time, price basis/snapshot, nominal IDR, tax/service profile atau No Tax, room stay, service date, actor, serta approval. Posting bersifat idempotent; koreksi memakai reversal/credit dan bukan edit/delete. Approval operasional dan posting/payment status tetap terpisah.

## 9. Tampilan Front Office

Room board/Live Room Monitor menampilkan:

- ETA bila relevan.
- `Early Check-in Requested/Approved at HH:mm`.
- `Late Checkout Requested/Approved until HH:mm`.
- Next arrival, target ready time, cleaning risk, dan conflict badge.
- Status stale/last updated seperti monitor utama.

Action minimum: `Request`, `Approve`, `Reject`, `Cancel`, `Complete`, serta `Convert to Extension`. UI tidak menyediakan approval otomatis kepada customer.

## 10. Notifikasi dan audit

- Front Office dapat mengirim keputusan secara manual/email/WhatsApp sesuai kanal yang tersedia.
- Pesan menyatakan bahwa request belum dijamin sebelum `Approved` dan menampilkan approved time/charge IDR bila ada.
- Perubahan/revocation setelah approval memerlukan reason, guest communication, dan audit.
- Audit menyimpan request/approved time, conflicts/readiness snapshot, actor, reason, price treatment, charge/reversal reference, dan affected cleaning/room plan.

## 11. Minimum acceptance tests

- Customer ETA tidak otomatis membuat early check-in approved atau mengubah tanggal booking.
- Early check-in ditolak jika previous guest masih `In House`, unit belum assigned, atau unit belum `Ready for Check-in`.
- Approved early check-in belum mengubah stay menjadi `In House` sampai actual check-in dilakukan.
- Late checkout ditolak saat next confirmed guest menunggu/dekat datang atau turnover window tidak cukup.
- Properti/room type penuh tanpa alternatif valid membuat late checkout ditolak.
- Confirmed next booking tidak bergeser atau batal otomatis karena late checkout request.
- Approved late checkout membuat operational time block, memperbarui housekeeping target, dan terlihat pada room board.
- Block tidak membuat tambahan room night atau charge otomatis.
- Late checkout yang masuk malam berikutnya memakai extension workflow dan gagal atomik bila inventory tidak tersedia.
- Add-on charge/waiver mempunyai IDR/tax snapshot, reason/approval, dan retry tidak memposting dua kali.
- Rejection/cancellation tidak mengubah stay, inventory, cleaning, atau folio tanpa action sumber.
- Late arrival/ETA malam tidak menggeser checkout atau harga guaranteed booking.
- Default konfigurasi baru menampilkan check-in `14:00` dan checkout `12:00`; perubahan efektif hanya memakai version yang sesuai dan tidak menulis ulang actual/scheduled time historis.

## 12. Konfigurasi sebelum implementasi

- Tidak perlu mengisi earliest/latest arrival limit; sistem memakai kebijakan `Flexible Front Office` tanpa cutoff otomatis.
- Minimum cleaning/inspection buffer serta threshold `next guest sudah dekat`.
- Aturan perubahan late checkout menjadi extension bila penggunaan masuk malam berikutnya.
- Pricing mode dan tax/service profile untuk early check-in/late checkout.
- Approval threshold untuk manual amount/complimentary waiver.
- Apakah customer dapat memasukkan request pada form booking atau hanya ETA, sementara request tetap diproses Front Office.
