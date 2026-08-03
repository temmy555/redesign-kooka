# Phase 1A UAT — KOOKA Residence

## Tujuan dan batas

UAT memvalidasi workflow operasional Phase 1A dengan data sintetis. UAT bukan pengganti automated test, bukan data produksi, dan belum menjadi persetujuan go-live. Attendance tetap berada pada Phase 1B.

Local UAT memakai database khusus `kooka_phase1_uat_test`, runtime development lokal pada port `3100`, private file directory khusus, dan akun beralamat `.invalid`. Runtime lokal sengaja memakai cookie HTTP non-production; UAT VPS nantinya wajib memakai HTTPS/secure cookie. Data kamar, tarif, tamu, serta transaksi di dalamnya tidak boleh disalin menjadi master produksi.

## Menyiapkan local UAT

Prasyarat: local infrastructure sehat dan `.env.local` sudah tersedia.

```bash
npm run uat:prepare
npm run uat:verify
npm run dev:uat
```

Buka `http://localhost:3100/staff/login`. Kredensial acak disimpan lokal dengan permission file terbatas di `.data/uat/credentials.json` dan di-ignore dari repository. Seluruh role memakai login email dan kata sandi biasa tanpa MFA/TOTP; permission aktif langsung mengikuti role setelah login berhasil.

Setelah login, buka menu **Panduan test** atau langsung ke `http://localhost:3100/staff/test-guide`. Halaman ini adalah jalur pengujian utama yang lebih mudah diikuti: enam tahap berurutan, langkah klik per skenario, actor/role, data UAT yang dipakai, hasil yang harus terlihat, tautan langsung ke fitur, pencarian, dan checklist lokal. Gunakan tabel scenario pack di bawah sebagai ringkasan/evidence ID; gunakan halaman Panduan test ketika menjalankan alurnya.

`uat:prepare` bersifat idempoten. Database hanya dapat dihapus bila nama target tepat, property marker `KOOKA-UAT` tersedia, dan `ALLOW_UAT_RESET=YES` diberikan secara eksplisit:

```bash
ALLOW_UAT_RESET=YES npm run uat:reset
```

## Dataset sintetis

| Area          | Fixture                                                     |
| ------------- | ----------------------------------------------------------- |
| Property      | `KOOKA-UAT`, ditandai sebagai synthetic                     |
| Role          | Owner, Front Office, Cleaning, F&B                          |
| Kamar         | No. 1–6; 4 Deluxe UAT dan 2 Executive UAT                   |
| Kondisi kamar | vacant/inspected, occupied, dirty, cleaning, dan blocked    |
| Tarif         | BAR-UAT IDR; angka hanya untuk pengujian                    |
| Booking       | `UAT-UNPAID`, `UAT-ARRIVAL`, `UAT-INHOUSE`, `UAT-DUEOUT`    |
| Payment       | verified transfer, pending verification, dan verified cash  |
| Housekeeping  | stayover guest-away request, checkout turnover, public area |
| F&B           | dua menu sintetis dengan harga IDR                          |

## Aturan pencatatan

Setiap skenario diisi `PASS`, `FAIL`, atau `BLOCKED`. `PASS` hanya diberikan setelah actor role terkait menjalankan alur melalui UI. Screenshot/evidence tidak boleh memuat kata sandi, nomor identitas, atau data tamu nyata. Defect dicatat pada [UAT-DEFECT-REGISTER.md](UAT-DEFECT-REGISTER.md) dan hasil keseluruhan pada [UAT-EVIDENCE.md](UAT-EVIDENCE.md).

Severity:

- `Critical`: kebocoran data/permission, inventory oversell, ledger salah, transaksi ganda, atau aplikasi tidak dapat dipakai.
- `High`: workflow utama tidak dapat selesai dan tidak ada workaround aman.
- `Medium`: workflow masih dapat selesai dengan workaround yang terdokumentasi.
- `Low`: copy, layout, atau polish yang tidak mengubah hasil transaksi.

## Scenario pack

### Owner / Super Admin

| ID     | Skenario                               | Hasil yang diharapkan                                                           |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------- |
| OWN-01 | Login email dan kata sandi             | Permission Owner langsung aktif sesuai role                                     |
| OWN-02 | Buka seluruh menu Staff                | Admin, Front Office, Room, Housekeeping, F&B, report terlihat sesuai permission |
| OWN-03 | Periksa master room/type/rate/tax      | No. kamar tunggal dan tipe terpisah; angka UAT mudah dikenali                   |
| OWN-04 | Periksa audit setelah perubahan master | Actor, waktu, before/after/reason tersedia                                      |
| OWN-05 | Jalankan reconciliation/report/export  | Tidak ada critical exception; IDR konsisten                                     |
| OWN-06 | CMS bilingual dan currency display     | ID/en serta IDR/USD/AUD hanya display preference; transaksi tetap IDR           |

### Front Office

| ID    | Skenario                                          | Hasil yang diharapkan                                                             |
| ----- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| FO-01 | Login email dan kata sandi                        | Permission Front Office langsung aktif sesuai role                                |
| FO-02 | Cari `UAT-UNPAID` dengan code+email               | Booking ditemukan tanpa customer login; deadline dan IDR official terlihat        |
| FO-03 | Verifikasi `PAY-UAT-REVIEW`                       | Status payment berubah tanpa mengubah reservation/stay secara implisit            |
| FO-04 | Check-in `UAT-ARRIVAL` ke kamar 1                 | Stay menjadi in-house dan occupancy room berubah; optional capture boleh dilewati |
| FO-05 | Ambil foto/signature pada perangkat kamera/tablet | Capture bekerja; setiap item dapat dilewati secara independen                     |
| FO-06 | Room move dengan no-change/charge/credit          | Pilihan financial eksplisit dan audit tersedia                                    |
| FO-07 | Folio combined dan room-only                      | Coverage dapat dipilih tetapi total line/IDR tetap konsisten                      |
| FO-08 | Tambah damage lalu refund manual                  | Entry dan dokumen terpisah, alasan/audit tercatat                                 |
| FO-09 | Checkout `UAT-DUEOUT` fleksibel                   | Stay/room/cleaning berubah; outstanding handling tidak dipaksa kaku               |
| FO-10 | Tandai no-show guaranteed                         | Kamar tetap ditahan sampai release manual dilakukan                               |

### Cleaning

| ID    | Skenario                             | Hasil yang diharapkan                                                      |
| ----- | ------------------------------------ | -------------------------------------------------------------------------- |
| HK-01 | Login dan buka queue                 | Hanya menu/field housekeeping yang berwenang terlihat                      |
| HK-02 | Proses stayover `GUEST_AWAY_REQUEST` | Requested → Assigned/In Progress → Cleaned → Inspected sesuai permission   |
| HK-03 | Catat unable to access               | Status `UNABLE_TO_ACCESS` dan alasan tercatat tanpa mengubah stay/payment  |
| HK-04 | Proses turnover dan public area      | Target kamar/public area jelas; nama tamu sensitif tidak dibuka berlebihan |

### F&B

| ID     | Skenario                                | Hasil yang diharapkan                                                |
| ------ | --------------------------------------- | -------------------------------------------------------------------- |
| FNB-01 | Login dan lihat menu UAT                | Menu/harga IDR aktif terlihat tanpa menu admin lain                  |
| FNB-02 | Input paper order standalone            | Reference unik, total konsisten, status dapat diproses               |
| FNB-03 | Input room charge ke `UAT-INHOUSE`      | Kamar/tamu aktif dapat dipilih dan entry masuk folio yang sama       |
| FNB-04 | Coba duplicate paper reference/reversal | Duplicate ditolak; reversal membuat jejak, bukan menghapus transaksi |

### Content owner / website

| ID     | Skenario                        | Hasil yang diharapkan                                                   |
| ------ | ------------------------------- | ----------------------------------------------------------------------- |
| CMS-01 | Edit preview id/en              | Kedua bahasa lengkap dan fallback terlihat jelas                        |
| CMS-02 | Upload/order/publish media asli | File privat/publik sesuai tujuan; alt text dan sumber tersedia          |
| CMS-03 | Cek mobile landing/booking CTA  | Hero search dan sticky CTA dapat dipakai tanpa homepage terlalu panjang |
| CMS-04 | Ubah display currency           | USD/AUD berlabel estimasi; checkout dan dokumen tetap IDR               |

## Exit gate

Langkah 23 selesai hanya bila:

1. seluruh scenario P0 dan build-critical P1 telah dijalankan;
2. Owner, Front Office, Cleaning, F&B, serta content owner mengisi sign-off;
3. tidak ada unresolved Critical/High defect;
4. reconciliation tidak memiliki critical exception;
5. camera/signature diuji pada perangkat target, bukan hanya desktop simulator;
6. final browser/device/accessibility evidence tercatat.
