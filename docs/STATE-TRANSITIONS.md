# State Transition Matrix — KOOKA Residence

| Informasi | Nilai |
|---|---|
| Versi | 1.13 Draft |
| Tanggal | 1 Agustus 2026 |
| Scope | Phase 1 — Core lodging MVP |
| Sumber kebutuhan | [PRD.md](PRD.md) |

Aturan perhitungan availability, hold, dan locking dirinci dalam [AVAILABILITY-INVENTORY.md](AVAILABILITY-INVENTORY.md).

## 1. Tujuan

Dokumen ini menjadi sumber aturan perubahan status untuk reservation, stay, payment, refund, kondisi unit, cleaning task, dan registrasi check-in. Tujuannya adalah mencegah perubahan status bebas yang menghasilkan kombinasi data tidak konsisten.

Setiap perubahan status harus dilakukan melalui action bisnis, bukan generic status dropdown. Contoh action: `Confirm Booking`, `Check In`, `Verify Payment`, `Start Cleaning`, atau `Complete Refund`.

## 2. Aturan umum

Setiap transition minimal menyimpan:

- Entity dan ID.
- Status asal dan tujuan.
- Action yang dijalankan.
- Aktor/pengguna atau system job.
- Timestamp Asia/Jakarta dan timestamp UTC.
- Alasan, jika diwajibkan.
- Nilai lama/baru yang relevan.
- Correlation/request ID agar satu workflow dapat ditelusuri.
- Side effect dan hasilnya, termasuk kegagalan.

Aturan implementasi:

- Backend memvalidasi transition; menyembunyikan tombol di UI saja tidak cukup.
- Action berisiko menggunakan database transaction dan concurrency/version check.
- Retry tidak boleh menghasilkan transition atau ledger entry ganda.
- Transition otomatis dilakukan oleh scheduled/background job yang tercatat sebagai system actor.
- Perubahan manual yang menyimpang dari alur normal memerlukan permission, alasan, dan audit.
- Nilai sensitif seperti nomor KTP, foto, tanda tangan, atau rekening tidak disalin ke audit log.

## 3. Reservation status

Status: `Draft`, `On Hold/Pending Payment`, `Confirmed`, `Completed`, `Cancelled`, `Expired`, dan `No Show`.

| Dari | Action → Ke | Aktor | Guard utama | Efek samping |
|---|---|---|---|---|
| `Draft` | Submit → `On Hold` | Customer, Admin | Data minimum valid; availability tersedia | Buat hold inventory dan payment deadline bila diperlukan |
| `Draft` | Abandon/expire → `Expired` | System | Draft melewati batas simpan | Bersihkan draft; lepaskan hold bila pernah dibuat |
| `Draft` | Cancel → `Cancelled` | Admin | Draft masih aktif | Catat alasan; lepaskan hold bila ada |
| `On Hold` | Confirm → `Confirmed` | System, Admin | Online source: 100% total verified; admin-created manual source: selected deposit/full/pay-at-property/corporate requirement terpenuhi dan diizinkan | Pertahankan inventory; kirim confirmation; audit source/policy konfirmasi |
| `On Hold` | Cancel → `Cancelled` | Front Office, Owner | Customer request/authorized source tercatat; sesuai kebijakan dan permission | Lepaskan inventory; catat cancellation consequence; refund tetap action terpisah |
| `On Hold` | Expire → `Expired` | System, Admin | Payment/confirmation deadline terlewati; tidak ada bukti/referensi tepat waktu dan tidak sedang `Payment Review Hold` | Lepaskan inventory secara atomik; batalkan reminder; antrekan notifikasi expiry |
| `Confirmed` | Cancel → `Cancelled` | Admin | Belum selesai; policy ditampilkan dan nominal manual/approval dicatat | Lepaskan inventory mendatang; refund tidak dibuat otomatis tanpa record |
| `Confirmed` | Mark no-show → `No Show` | Admin, Owner | Melewati arrival cutoff; system memberi `Possible No Show`; contact attempt dicatat | Perbarui stay dan terapkan policy; guaranteed booking default mempertahankan inventory sampai checkout asli |
| `Confirmed` | Complete → `Completed` | System, Admin | Seluruh stay selesai dan folio memenuhi aturan closure | Tutup lifecycle reservasi; kirim dokumen final |
| `Expired` | Reopen hold → `On Hold` | Admin, Owner | Availability diperiksa ulang; deadline baru dibuat | Buat hold baru; audit bahwa booking pernah expired |
| `No Show` | Reinstate → `Confirmed` | Admin, Owner | Tamu datang terlambat; jika commitment retained validasi assignment/readiness, jika released lakukan availability check baru | Aktifkan kembali reservation/stay tanpa menghapus histori no-show atau membuat commitment ganda |

`Cancelled` dan `Completed` bersifat terminal. Kebutuhan booking baru menggunakan clone/new booking, bukan menghapus histori atau mengubah status langsung.

## 4. Stay status

Stay status diterapkan per room stay, bukan hanya sekali pada header booking. Booking multi-room menghitung indikator `Partially Checked In` atau `Partially Checked Out` dari kumpulan stay dan tidak menyimpannya sebagai reservation status.

Status: `Not Started`, `Due In`, `In House`, `Due Out`, `Checked Out`, dan `No Show`.

| Dari | Action → Ke | Aktor | Guard utama | Efek samping |
|---|---|---|---|---|
| `Not Started` | Arrival date reached → `Due In` | System | Business date/tanggal kedatangan tercapai | Munculkan pada arrivals dan room-readiness queue |
| `Due In` | Check in → `In House` | Admin, Owner | Reservation confirmed; unit assigned dan ready; kapasitas valid; payment policy terpenuhi/override | Occupancy unit menjadi `Occupied`; catat check-in time dan petugas |
| `Due In` | Mark no-show → `No Show` | Admin, Owner | Arrival cutoff terlewati; contact attempt dicatat | Sinkronkan reservation no-show; guaranteed inventory tetap retained secara default; catat alasan |
| `In House` | Departure date reached → `Due Out` | System | Business date/tanggal checkout tercapai | Munculkan pada departures dan outstanding-balance queue |
| `In House` | Early checkout → `Checked Out` | Admin, Owner | Folio memenuhi checkout guard atau override | Occupancy menjadi `Vacant`; housekeeping `Dirty`; buat turnover task |
| `Due Out` | Checkout → `Checked Out` | Admin, Owner | Folio memenuhi checkout guard atau override | Occupancy menjadi `Vacant`; housekeeping `Dirty`; buat turnover task |
| `Due Out` | Extend stay → `In House` | Admin, Owner | Inventory seluruh malam tambahan berhasil diamankan; konflik booking confirmed sudah diselesaikan; harga/folio dikonfirmasi | Perpanjang commitment, assignment, departure date, dan nightly charge secara atomik; kirim perubahan |
| `No Show` | Late check-in → `In House` | Admin, Owner | Reservation direinstate; retained assignment/commitment valid dan unit ready, atau inventory baru berhasil diamankan bila sebelumnya released | Catat recovery serta actual check-in; departure date tidak bergeser otomatis |

Room move dan stayover cleaning tidak mengubah stay status. `Checked Out` bersifat terminal; koreksi setelah checkout dilakukan melalui reopen workflow berizin yang akan dirinci bersama folio lifecycle.

`Arrival Overdue/Possible No Show` adalah indikator turunan dan tidak mengubah reservation/stay status. Untuk booking online guaranteed, `Mark No Show` dan `Release Remaining Nights` adalah action terpisah. Default inventory disposition adalah `Retain Until Original Checkout`.

Front Office dengan permission khusus dapat menjalankan `Release Remaining Nights` tanpa Owner approval. Guard minimum: no-show/cancellation context valid, contact attempt dan reason tercatat, policy snapshot ditampilkan, affected nights/quantity eksplisit, financial consequence dicatat, serta release idempotent/concurrency-safe.

### 4.1 Check-in guard

Check-in normal memerlukan:

- Reservation `Confirmed`.
- Room assignment aktif dan tidak overlap.
- Kapasitas serta restriction unit sesuai.
- Unit memenuhi `Ready for Check-in`.
- Payment/deposit policy terpenuhi atau memiliki override berizin.
- Check-in registration tidak menjadi blocker selama KTP/foto/tanda tangan dikonfigurasi opsional.
- Room Lead Guest tersedia untuk room stay tersebut dan guest count tidak melebihi maximum occupancy.
- Required extra-bed allocation valid dan setup readiness terpenuhi atau memiliki override berizin yang sudah dikomunikasikan.

Override room readiness atau pembayaran memerlukan permission, alasan, dan audit log.

### 4.2 Checkout guard

Checkout normal memerlukan folio bersaldo nol. Alternatif yang diperbolehkan:

- Corporate billing yang valid.
- Pay-at-checkout sedang diselesaikan pada workflow yang sama.
- Override pengguna berizin dengan alasan.

Departure Clearance bersifat opsional. `Cleared`, `Issue Found`, atau `Skipped` tidak menggantikan checkout guard finansial; skip/issue checkout mengikuti permission, reason, dan audit yang berlaku.

Checkout selalu membuat unit `Vacant + Dirty`, membuat checkout turnover cleaning task, dan mencatat waktu/petugas aktual.

Extension yang gagal availability check tidak mengubah departure date, assignment, commitment, atau folio lama. Booking confirmed yang sudah ada tidak boleh digeser otomatis; admin harus memilih room move/upgrade yang valid atau menolak extension. Checkout dan arrival pada tanggal yang sama membuat task `Same-day Turnover` berprioritas tinggi, tetapi arrival tetap menunggu unit memenuhi `Ready for Check-in`.

## 5. Payment record status

Status: `Pending Verification`, `Verified`, `Rejected`, dan `Voided`.

| Dari | Action → Ke | Aktor | Guard utama | Efek samping |
|---|---|---|---|---|
| New | Record proof → `Pending Verification` | Admin, Owner | Amount, method, waktu, rekening tujuan, dan referensi dicatat | Masuk verification queue; belum memengaruhi saldo folio |
| New | Record received cash/direct payment → `Verified` | Admin, Owner | Pengguna memiliki permission direct verify | Posting payment ke folio; hitung ulang payment balance |
| `Pending Verification` | Verify → `Verified` | Admin, Owner | Dana dinyatakan diterima; amount IDR dikonfirmasi | Posting payment immutable; hitung saldo; evaluasi source-specific confirmation requirement |
| `Pending Verification` | Reject → `Rejected` | Admin, Owner | Alasan wajib | Tidak ada posting folio; simpan rejection evidence/notes |
| `Verified` | Void → `Voided` | Admin, Owner | Permission dan alasan; tidak boleh delete | Buat reversal folio; hitung ulang saldo; audit before/after |

`Rejected` dan `Voided` bersifat terminal. Bukti atau pembayaran pengganti dibuat sebagai payment record baru. Status saldo booking tetap dihitung dari folio dan bukan bagian dari lifecycle payment record.

## 6. Refund record status

Status: `Requested`, `Approved`, `Rejected`, `Processing`, `Refunded`, `Failed`, dan `Cancelled`.

| Dari | Action → Ke | Aktor | Guard utama | Efek samping |
|---|---|---|---|---|
| New | Request → `Requested` | Front Office, Owner | Nominal manual, policy/reason, tujuan, dan financial guard dicatat | Masuk refund work queue |
| `Requested` | Approve → `Approved` | Front Office, Owner | Tidak melebihi remaining verified-payment guard; actor memiliki permission | Kunci nilai yang diputuskan; catat actor; tidak memerlukan Owner approval |
| `Requested` | Reject → `Rejected` | Admin, Owner | Alasan wajib | Tutup request tanpa transfer |
| `Requested` | Cancel → `Cancelled` | Admin, Owner | Transfer belum dilakukan | Catat alasan |
| `Approved` | Start transfer → `Processing` | Admin, Owner | Data rekening tervalidasi; processor berizin | Catat processor dan waktu mulai |
| `Approved` | Cancel → `Cancelled` | Front Office, Owner | Belum ada transfer; alasan wajib | Lepaskan proses tanpa menghapus decision trail |
| `Processing` | Complete → `Refunded` | Admin, Owner | Referensi dan bukti transfer dicatat | Posting refund/relevant folio entries; buat refund note |
| `Processing` | Mark failed → `Failed` | Admin, Owner | Alasan kegagalan dicatat | Tetap berada di outstanding refund queue |
| `Failed` | Retry → `Processing` | Admin, Owner | Data tujuan/referensi diperiksa ulang | Buat attempt baru tanpa menghapus attempt lama |
| `Failed` | Cancel → `Cancelled` | Front Office, Owner | Keputusan pembatalan beralasan | Tutup workflow; histori gagal tetap ada |

`Refunded`, `Rejected`, dan `Cancelled` bersifat terminal. `Partially Refunded/Fully Refunded` adalah summary yang dihitung dari seluruh refund berhasil.

Front Office berizin boleh menjalankan `Request + Approve` sebagai satu action UI tervalidasi; sistem tetap menyimpan kedua status event, nominal/reason, actor, timestamp, dan guard result. Tidak ada antrean Owner approval. Transfer, completion, failure, dan retry tetap event terpisah agar uang keluar dapat direkonsiliasi.

## 7. Cleaning task status

Status utama: `Requested`, `Assigned`, `In Progress`, `Cleaned`, dan `Inspected`. Exception: `Deferred`, `Unable to Access`, dan `Cancelled`.

| Dari | Action → Ke | Aktor | Guard utama | Efek samping |
|---|---|---|---|---|
| New | Create request → `Requested` | System, Admin | Unit/area dan task type valid | Masuk unassigned queue |
| `Requested` | Assign → `Assigned` | Admin, Cleaning lead | Assignee dan target time dipilih | Kirim/ tampilkan assignment |
| `Assigned` | Start → `In Progress` | Cleaning | Tidak ada task aktif konflik | Housekeeping condition menjadi `Cleaning` bila task kamar |
| `Assigned` | Defer → `Deferred` | Cleaning, Admin | Alasan dan waktu tindak lanjut wajib | Masuk deferred queue |
| `Assigned` | Unable to access → `Unable to Access` | Cleaning | Alasan seperti DND/tidak ada izin masuk | Beri alert ke Front Office bila perlu |
| `In Progress` | Finish cleaning → `Cleaned` | Cleaning | Checklist wajib selesai atau exception dicatat | Housekeeping condition menjadi `Cleaned` |
| `In Progress` | Defer/unable access → exception status | Cleaning, Admin | Alasan wajib | Simpan progres dan tindak lanjut |
| `Cleaned` | Pass inspection → `Inspected` | Inspector, Admin | Inspection checklist lulus | Housekeeping condition menjadi `Inspected`; hitung room readiness |
| `Cleaned` | Fail inspection → `In Progress` | Inspector, Admin | Item rework dan alasan dicatat | Kembalikan ke petugas/rework queue |
| `Deferred` | Reschedule/assign → `Assigned` | Admin, Cleaning lead | Jadwal/assignee baru tersedia | Aktifkan kembali task |
| `Unable to Access` | Retry → `Requested`/`Assigned` | Admin, Cleaning | Izin masuk atau jadwal baru dikonfirmasi | Aktifkan kembali task |
| Non-terminal | Cancel → `Cancelled` | Admin | Alasan wajib; checkout turnover membutuhkan permission khusus | Tutup task tanpa mengubah histori |

Untuk `Guest-Requested Stayover Cleaning`, stay dan occupancy tetap `In House/Occupied`. Task menyimpan request time, priority, notes, dan entry permission. Keberadaan fisik tamu di luar kamar tidak menjadi room occupancy status.

Phase 1 tidak memiliki status DND digital. Bila terdapat tanda fisik DND pada pintu, Cleaning memakai `Deferred` atau `Unable to Access` dengan reason `Physical DND Sign`; task tidak boleh menjadi `Cleaned/Inspected`, dan reservation/stay/occupancy/readiness tidak berubah.

## 8. Kondisi room unit

### 8.1 Occupancy

| Dari | Action → Ke | Guard | Efek samping |
|---|---|---|---|
| `Vacant` | Check in → `Occupied` | Stay berhasil check-in pada assignment aktif | Catat actual occupancy start |
| `Occupied` | Checkout → `Vacant` | Stay berhasil checkout | Housekeeping menjadi `Dirty`; buat turnover task |
| `Occupied` | Room move out → `Vacant` | Waktu efektif perpindahan tercapai | Housekeeping menjadi `Dirty`; buat room-move cleaning task |
| `Vacant` | Room move in → `Occupied` | Unit baru ready dan assignment tidak overlap | Catat assignment history; stay tetap sama |

Tamu keluar sementara dan stayover cleaning tidak mengubah occupancy.

### 8.2 Housekeeping condition

| Dari | Action → Ke | Sumber |
|---|---|---|
| `Inspected/Cleaned` | Mark dirty → `Dirty` | Checkout, room move, issue, atau manual berizin |
| `Dirty` | Start cleaning → `Cleaning` | Cleaning task `In Progress` |
| `Cleaning` | Finish cleaning → `Cleaned` | Cleaning task `Cleaned` |
| `Cleaned` | Pass inspection → `Inspected` | Cleaning task `Inspected` |
| `Cleaned/Inspected` | Rework required → `Dirty`/`Cleaning` | Inspection gagal atau issue baru |

### 8.3 Serviceability/block

| Dari | Action → Ke | Guard dan efek |
|---|---|---|
| `In Service` | Create block → `Blocked` | Block memiliki periode, jenis, alasan, dan creator; inventory overlap dicegah |
| `Blocked` | End/cancel block → `In Service` | Periode selesai atau pembatalan berizin; readiness dihitung ulang |
| `In Service/Blocked` | Mark out of order → `Out of Order` | Maintenance issue aktif; unit dikeluarkan dari inventory |
| `Out of Order` | Return to service → `In Service` | Blocking issue resolved/verified; tidak ada block lain; safety/function check dan cleaning/inspection requirement terpenuhi; readiness dihitung ulang |
| `Out of Order` | Schedule blocked period → `Blocked` | Perbaikan selesai tetapi unit tetap ditahan untuk alasan lain |

`Available to Sell` dan `Ready for Check-in` adalah hasil perhitungan, bukan status yang diedit manual.

## 9. Check-in registration status

Status: `Not Started`, `Partial`, `Complete`, dan `Skipped`.

| Dari | Action → Ke | Guard dan efek |
|---|---|---|
| `Not Started` | Save partial → `Partial` | Minimal satu field/media tersimpan |
| `Not Started` | Complete → `Complete` | Field operasional minimum selesai; setiap optional KTP/photo/signature sudah `Captured`, `Declined`, atau `Skipped` |
| `Not Started` | Skip → `Skipped` | Diizinkan karena fitur opsional; catat petugas |
| `Partial` | Complete → `Complete` | Field operasional minimum selesai; sisa optional KTP/photo/signature ditandai captured/declined/skipped |
| `Partial` | Skip remainder → `Skipped` | Simpan data yang ada; catat petugas |
| `Skipped` | Resume → `Partial`/`Complete` | Tamu/staf melanjutkan kemudian |
| `Complete` | Authorized data removal → `Partial` | Permission, alasan, dan audit wajib |

Registration status tidak mengubah reservation, stay, payment, occupancy, atau room readiness. KTP/identity photo, guest photo, dan signature selalu opsional pada Phase 1; decline/skip tidak memerlukan override dan tidak memblokir check-in.

## 10. Workflow lintas entity

### 10.1 Booking online dengan transfer

1. Reservation `Draft → On Hold` dan inventory hold dibuat.
2. Sistem membuat deadline default dua jam, mengantrekan email instruksi, dan menjadwalkan reminder 30 menit sebelum deadline.
3. Payment proof/referensi yang diterima tepat waktu dicatat sebagai `Pending Verification`; payment balance tetap `Unpaid` dan inventory menjadi `Payment Review Hold`.
4. Payment `Verified` diposting ke folio.
5. Booking online hanya menjadi `Confirmed` jika verified total mencapai 100%; partial verified tetap folio credit dan outstanding. Admin-created manual booking mengikuti deposit/full/pay-at-property policy yang dipilih staf berizin.
6. Jika deadline terlewati tanpa bukti/referensi tepat waktu, reservation menjadi `Expired` dan inventory dilepas.
7. Booking expired hanya dapat dibuka kembali setelah availability recheck serta pembuatan hold/deadline baru.

Jika online booking expired setelah menerima verified partial payment, inventory tetap dilepas tetapi payment/folio credit tidak dihapus. Front Office memproses rebooking dan allocation baru atau refund manual sesuai policy, permission, serta audit.

### 10.2 Check-in

1. Backend menjalankan check-in guard.
2. Stay `Due In → In House`.
3. Assigned room occupancy `Vacant → Occupied`.
4. Actual check-in time dan petugas dicatat.
5. Registration dapat tetap `Not Started`, `Partial`, atau `Skipped` bila opsional.

### 10.3 Tamu keluar sementara dan meminta cleaning

1. Reservation tetap `Confirmed`; stay tetap `In House`; occupancy tetap `Occupied`.
2. Buat `Guest-Requested Stayover Cleaning` berstatus `Requested`.
3. Simpan entry permission dan waktu yang diminta.
4. Task bergerak melalui cleaning lifecycle tanpa melepaskan inventory.
5. Jika kamar tidak dapat diakses, gunakan `Unable to Access`/`Deferred` dan beri tahu Front Office.

### 10.4 Checkout

1. Front Office dapat menjalankan Departure Clearance atau melewatinya dengan reason/permission.
2. Temuan dibuat/reference pada entity sumber tanpa automatic charge/status mutation.
3. Backend menjalankan checkout guard.
4. Stay menjadi `Checked Out`.
5. Occupancy menjadi `Vacant`; housekeeping menjadi `Dirty`.
6. Checkout turnover task dibuat secara idempotent.
7. Reservation menjadi `Completed` hanya jika seluruh stay selesai dan folio memenuhi closure rule.

### 10.5 Room move

1. Validasi unit baru, overlap, kapasitas, readiness, waktu efektif, dan penyesuaian harga.
2. Pada waktu efektif, assignment lama ditutup dan assignment baru diaktifkan dalam satu transaksi.
3. Unit lama `Occupied → Vacant` dan housekeeping menjadi `Dirty`.
4. Unit baru `Vacant → Occupied`.
5. Stay, booking code, dan folio tetap sama; cleaning task unit lama dibuat bila diperlukan.

## 11. Action/API dan concurrency

Gunakan action spesifik seperti:

- `submitBooking`, `confirmBooking`, `cancelBooking`, `expireBooking`.
- `checkInStay`, `extendStay`, `checkOutStay`, `markNoShow`.
- `startDepartureClearance`, `clearDeparture`, `recordDepartureIssue`, `skipDepartureClearance`.
- `requestEarlyCheckIn`, `approveEarlyCheckIn`, `rejectEarlyCheckIn`, `requestLateCheckout`, `approveLateCheckout`, `rejectLateCheckout`, `cancelStayTimingRequest`, `convertLateCheckoutToExtension`.
- `recordPayment`, `verifyPayment`, `rejectPayment`, `voidPayment`.
- `requestRefund`, `approveRefund`, `startRefund`, `completeRefund`, `failRefund`.
- `assignCleaning`, `startCleaning`, `completeCleaning`, `inspectCleaning`.
- `createRoomBlock`, `closeRoomBlock`, `moveRoom`.
- `submitPosOrder`, `acceptPosOrder`, `startPreparing`, `markReady`, `serveOrder`, `completePosOrder`, `cancelPosOrder`.
- `createManualPaperOrder`, `markPaperOrderProcessed`, `flagDuplicatePaperOrder`.
- `postStandaloneSettlement`, `postRoomCharge`, `reversePosCharge`.
- `requestService`, `reserveService`, `confirmService`, `startService`, `completeService`, `cancelService`, `markServiceNoShow`.
- `reportMaintenance`, `triageMaintenance`, `assignMaintenance`, `startMaintenance`, `waitForParts`, `resolveMaintenance`, `verifyMaintenance`, `closeMaintenance`, `reopenMaintenance`.
- `markOutOfOrder`, `returnToService`, `createGuestDamageIncident`, `submitDamageAssessment`, `approveDamageCharge`, `postDamageCharge`, `waiveDamageCharge`, `disputeDamageCharge`, `reverseDamageCharge`.
- `reportFoundItem`, `secureFoundItem`, `moveFoundItem`, `submitOwnershipClaim`, `verifyOwnershipClaim`, `rejectOwnershipClaim`, `schedulePickup`, `handoverFoundItem`, `prepareShipment`, `markShipmentDelivered`, `returnShipmentToStorage`, `approveDisposition`, `disposeFoundItem`.

Setiap action menerima entity version/idempotency key bila relevan. Konflik versi, inventory, atau transition menghasilkan error terstruktur dan tidak boleh meninggalkan partial side effect.

## 12. Minimum acceptance tests

- Dua request konfirmasi/check-in/payment yang sama tidak menghasilkan double transition atau double posting.
- Status tidak dapat dilewati melalui generic update endpoint.
- Booking pay-at-checkout dapat `Confirmed/In House` dengan payment balance `Unpaid`.
- Payment `Pending Verification` tidak mengurangi saldo; `Verified` mengurangi saldo; `Voided` membuat reversal.
- Booking expired melepaskan inventory tepat sekali.
- Payment `Pending Verification` yang received-at-nya sebelum deadline mencegah expiry sampai review selesai.
- Reminder terjadwal dibatalkan ketika booking confirmed, cancelled, expired, atau deadline diubah.
- Arrival overdue tidak melepas guaranteed inventory; mark no-show mempertahankannya sampai checkout asli secara default.
- Reinstate late arrival dengan retained commitment tidak membuat inventory commitment kedua.
- Check-in menolak unit yang belum ready kecuali override valid.
- Checkout menghasilkan `Vacant + Dirty` dan tepat satu turnover task.
- Stayover cleaning mempertahankan `In House + Occupied`.
- Multi-room dapat check-in/out per room stay tanpa mengubah stay lain secara keliru.
- Check-in menolak maximum occupancy atau required extra bed yang tidak valid.
- Failed inspection mengembalikan task untuk rework dan unit belum ready.
- Refund gagal dapat dicoba ulang tanpa menghapus attempt sebelumnya.
- Maintenance `Resolved` tidak otomatis membuat room In Service/Ready; verification dan readiness guard tetap wajib.
- Damage assessment yang sama tidak menghasilkan folio charge ganda ketika action di-retry.
- Lost & Found custody correction tidak menimpa event lama; hanya satu verified owner aktif dan failed shipment kembali ke storage melalui event baru.
- Early/late request tidak mengubah stay otomatis; late checkout ditolak saat next guest/turnover/full-occupancy guard gagal dan approval retry tidak menggandakan block/charge.
- Setiap transition sensitif memiliki aktor, waktu, alasan bila diwajibkan, dan audit event.

## 13. Folio lifecycle

- Booking creation membuat folio `Open`.
- `Open → Closed` hanya melalui `closeFolio` setelah seluruh stay selesai, tidak ada pending payment/refund, dan balance nol atau closure override/corporate billing valid.
- `Closed → Open` hanya melalui `reopenFolio` berizin dengan reason, audit, dan document impact tracking.
- Checkout tidak otomatis menutup folio.
- Reservation menjadi `Completed` hanya setelah folio closure guard terpenuhi.
- Posted folio entry tidak memiliki edit/delete transition; hanya reversal dan entry baru.
- Detail tersedia di [FOLIO-FINANCIAL-LEDGER.md](FOLIO-FINANCIAL-LEDGER.md).

## 14. POS order dan service booking

POS order status: `Draft`, `New`, `Accepted`, `Preparing`, `Ready`, `Served`, `Completed`, atau `Cancelled`.

Service/tour status: `Requested`, `Reserved`, `Confirmed`, `In Progress`, `Completed`, `Cancelled`, atau `No Show`.

Payment status dan folio posting status (`Not Posted`, `Posted`, `Reversed`) disimpan terpisah. Cancel fulfillment tidak otomatis mengubah payment/posting. Posted financial correction menggunakan reversal; refund memakai refund record.

Room-charge action memerlukan stay `In House`, active assignment, Room Lead Guest verification, charge privilege, billing destination, folio guard, permission, serta idempotency key.

Manual Paper Order menggunakan paper/intake reference sebagai idempotency/source key. `Processed` pada kertas hanya menandai intake telah dimasukkan dan tidak mengubah order fulfillment, payment, atau folio posting status.

## 15. Maintenance dan guest damage

Maintenance Issue: `Reported → Triaged → Assigned → In Progress → Resolved → Verified → Closed`, dengan `Waiting for Parts`, `Waiting for Vendor`, `Deferred`, `Cancelled`, dan action `Reopen` sebagai jalur exception/recovery.

Maintenance issue tidak mengubah room serviceability otomatis. Triage menjalankan disposition `Monitor Only`, `Restricted Use`, `Create Planned Block`, atau `Mark Out of Order`. Return-to-service memerlukan verification serta room-readiness guard dan tidak menutup cleaning/block secara diam-diam.

Guest Damage Assessment: `Draft → Pending Approval → Approved → Posted`; alternative `Waived`, `Rejected/Not Guest Responsibility`, `Disputed`, atau `Cancelled`. Front Office berizin dapat melakukan `Approve` dan `Post` tanpa Owner approval; nama status menandakan keputusan assessment, bukan hierarki jabatan. Posted correction menggunakan folio reversal/credit dan tidak menghapus incident/assessment.

UI boleh menyediakan action `Approve & Post` untuk Front Office, tetapi backend tetap menyimpan decision dan posting sebagai event terpisah/idempotent agar failure posting tidak menghilangkan keputusan assessment.

Guest Damage Incident, maintenance work/internal cost, catalog price, folio posting, payment, dan dispute state disimpan terpisah. Detail tersedia di [MAINTENANCE-ASSET-DAMAGE.md](MAINTENANCE-ASSET-DAMAGE.md).

## 16. Lost & Found

Found Item custody: `Reported → Secured/In Storage → Released`, dengan terminal outcome `Returned to Owner`, `Transferred to Authority`, `Donated`, `Disposed`, atau `Cancelled/Duplicate`.

Ownership Claim: `Unclaimed → Claim Submitted → Under Review → Verified`; alternatif `Rejected` atau `Withdrawn`. Satu item hanya dapat memiliki satu verified owner aktif.

Pickup: `Pickup Scheduled → Ready for Pickup → Handed Over`; alternatif `Cancelled/Failed`. Shipment: `Shipment Prepared → Shipped/In Transit → Delivered`; alternatif `Failed/Returned to KOOKA`.

- Item/claim/pickup/shipment status disimpan terpisah.
- `Secure/Move/Release/Return/Dispose` selalu membuat append-only Custody Event; correction membuat event baru.
- `Verify Claim` high-value memerlukan lebih dari booking code dan mencatat reviewer/evidence/reason.
- `Dispose/Donate/Transfer to Authority` memerlukan retention eligibility, tidak ada active claim/hold, approval, evidence, dan policy/local-rule guard.
- Failed/returned shipment membuat custody event dan mengembalikan item ke storage; tidak menjadi `Delivered`.
- Workflow tidak mengubah occupancy, room readiness, cleaning, maintenance, Guest Damage Incident, atau folio otomatis.
- Detail tersedia di [LOST-FOUND-CUSTODY.md](LOST-FOUND-CUSTODY.md).

## 17. Early check-in dan late checkout request

Stay Timing Request: `Requested → Approved / Rejected / Cancelled → Completed`; optional `Expired` bila waktu terlewati tanpa keputusan.

- Hanya Front Office/Owner berizin yang dapat approve/reject.
- Early approval memerlukan reservation confirmed, active assignment, previous stay checkout, dan `Ready for Check-in`; actual check-in tetap action terpisah.
- Late approval memerlukan no next-arrival conflict, turnover buffer cukup, dan tidak full tanpa alternatif valid.
- Approval late checkout intraday membuat Operational Occupancy Block dan memperbarui housekeeping target.
- Crossing overnight threshold memakai `Convert to Extension`; gagal inventory tidak mengubah departure/assignment/folio lama.
- Rejection/cancellation tidak mengubah stay, occupancy, inventory, cleaning, atau folio.
- Add-on posting/payment mempunyai lifecycle terpisah. Detail tersedia di [EARLY-CHECKIN-LATE-CHECKOUT.md](EARLY-CHECKIN-LATE-CHECKOUT.md).

## 18. Flexible Departure Clearance

Status: `Not Started`, `In Progress`, `Cleared`, `Issue Found`, atau `Skipped`.

- Clearance dibuat per room stay dan bersifat opsional.
- `Issue Found` hanya merujuk Guest Damage Incident, Maintenance Issue, Lost & Found, Manual Paper Order, atau financial action; tidak membuat charge otomatis.
- `Skip` memerlukan permission, actor, time, dan reason. Target pemeriksaan menghasilkan alert, bukan permanent hard lock.
- Actual checkout tetap membuat `Checked Out`, `Vacant + Dirty`, serta satu turnover task setelah checkout guard berhasil.
- Multi-room dapat clearance/checkout parsial. Detail tersedia di [CHECKOUT-DEPARTURE-CLEARANCE.md](CHECKOUT-DEPARTURE-CLEARANCE.md).

## 19. Guest Request

Status: `Requested`, `Under Review`, `Accepted`, `Unable to Fulfill`, `Fulfilled`, atau `Cancelled`.

- `Review` menetapkan owner/reviewer dan dapat memperbarui target/prioritas tanpa mengubah modul sumber.
- `Accept` menyimpan actor, waktu, target, serta catatan komitmen; request berbayar memerlukan konfirmasi scope/harga/tax dan source action resmi.
- `Fulfill` memerlukan catatan/bukti minimum atau referensi workflow sumber yang telah mencapai kondisi selesai yang sesuai.
- `Unable to Fulfill` dan `Cancelled` menyimpan alasan dan actor; customer communication dibuat bila relevan.
- Status request tidak mengubah reservation, stay, assignment, inventory, cleaning, order/service, payment, atau folio otomatis.
- Data sensitif termasking dan tidak tampil pada shared display. Detail tersedia di [GUEST-REQUESTS-PREFERENCES.md](GUEST-REQUESTS-PREFERENCES.md).

## 20. Booking/Stay Amendment

Status: `Draft`, `Pending Guest Confirmation`, `Applied`, `Rejected`, atau `Cancelled`.

- `Submit for Confirmation` menyimpan before/after preview, inventory/price delta, policy/rate version, expiry bila hold dibuat, dan actor.
- `Apply` mengunci new inventory sebelum melepas old commitment dalam satu transaction; failure tidak mengubah booking lama.
- `Apply Extension` melindungi confirmed booking dan memerlukan alternatif/rejection bila malam tambahan tidak tersedia.
- `Apply Shortening/Early Departure` memisahkan inventory release, actual checkout, cleaning, folio adjustment, dan refund decision.
- `Reject/Cancel` melepaskan amendment hold tepat satu kali dan tidak mengubah reservation/stay/folio lama.
- Multi-room target eksplisit. Customer notification/document dan audit mengikuti impact. Detail tersedia di [BOOKING-STAY-AMENDMENTS.md](BOOKING-STAY-AMENDMENTS.md).

## 21. Perlu ditinjau kembali saat sistem berkembang

- Night audit/business date dan automatic posting room charge.
- Reopen stay setelah checkout.
- Automated payment gateway reconciliation pada Phase 3.
- OTA/channel-manager conflict resolution pada Phase 3.
