# Reporting dan Daily Operations API

Dokumen ini menjelaskan implementasi Roadmap Langkah 21. Seluruh endpoint hanya untuk staf terautentikasi. PostgreSQL tetap sumber resmi; dashboard dan CSV membaca langsung tabel reservation, stay, room, folio, payment, refund, cleaning, dan maintenance.

## Prinsip utama

- Timezone operasional adalah `Asia/Jakarta`; business date memakai rollover default pukul `04:00`.
- `BUSINESS_DATE_ROLLOVER_HOUR` pada worker dapat diatur `0–23` tanpa mengubah kode.
- IDR adalah currency laporan resmi. Revenue, verified payment, refund, dan outstanding ditampilkan terpisah agar tidak dianggap nilai yang sama.
- Rollover tidak memposting room charge, mengakui revenue, memperbaiki folio/inventory otomatis, atau melepaskan guaranteed booking/no-show.
- Reconciliation exception adalah daftar pekerjaan untuk menyelesaikan masalah pada sumbernya, bukan ledger atau inventory kedua.
- Export Excel menyamarkan nama tamu, tidak memuat email/telepon/KTP/tanda tangan/destination refund, dibatasi 10.000 baris, dan tidak boleh di-cache.

## Permission

| Permission                | Kegunaan                            | Baseline role       |
| ------------------------- | ----------------------------------- | ------------------- |
| `report.view`             | Dashboard operasional dan keuangan  | Owner, Front Office |
| `report.export`           | CSV privacy-masked                  | Owner, Front Office |
| `daily_operations.manage` | Rollover manual/fallback            | Owner, Front Office |
| `reconciliation.manage`   | Menjalankan dan menangani exception | Owner, Front Office |

Permission diperiksa server-side. Cleaning dan F&B tetap memakai queue/modul minimumnya sendiri dan tidak otomatis memperoleh financial dashboard/export.

## `GET /api/staff/reports`

Query opsional:

- `businessDate=YYYY-MM-DD`
- `rangeStart=YYYY-MM-DD`
- `rangeEnd=YYYY-MM-DD`

Dashboard maksimal 31 hari dan mengembalikan metadata `timezone`, `businessDate`, `dataAsOf`, `metricVersion`, dan `currency`. Queue meliputi arrival, departure, upcoming tujuh hari, unassigned room, payment review, cleaning, maintenance, dan refund. Payment review lebih dari dua jam diberi indikator `STALE`; indikator tidak mengubah payment status.

Ringkasan memisahkan physical/occupied room, occupancy percentage, room revenue, total posted revenue, verified payments, refunded amount, dan open-folio outstanding.

## `POST /api/staff/reports`

Semua mutation memerlukan header `Idempotency-Key` maksimal 160 karakter.

### Rollover manual/fallback

```json
{
  "action": "RUN_DAILY_ROLLOVER",
  "businessDate": "2026-08-02"
}
```

Rollover membuat checkout/stayover cleaning task tanpa duplikasi, menjalankan reconciliation, dan menutup run sebagai `COMPLETED` atau `NEEDS_ATTENTION`. Business date yang sama hanya memiliki satu run; retry mengembalikan hasil yang sudah selesai.

Worker aplikasi juga menjalankan wake-up setiap satu menit. Redis hanya pemicu; advisory lock, unique business-day run, cleaning dedupe, reconciliation exception, summary, dan audit tersimpan atomik di PostgreSQL. Bila Redis/worker berhenti, staf dapat menjalankan fallback di atas; tidak ada transaksi booking yang hilang.

### Reconciliation manual

```json
{
  "action": "RUN_RECONCILIATION",
  "businessDate": "2026-08-02"
}
```

Pemeriksaan awal mencakup inventory overclaim, verified payment tanpa folio posting, duplicate source debit, room state versus active stay, dan refunded amount melebihi verified payment. Constraint database tetap pertahanan pertama untuk assignment/document overlap. Attendance readiness dilaporkan `DEFERRED_PHASE_1B` dan tidak memblokir Phase 1A daily close.

### Menangani exception

```json
{
  "action": "UPDATE_EXCEPTION",
  "exceptionId": "00000000-0000-4000-8000-000000000000",
  "transition": "RESOLVE",
  "reason": "Payment posting diperbaiki pada folio sumber",
  "resolutionReference": "FOLIO-ENTRY-REFERENCE"
}
```

Transition: `ACKNOWLEDGE`, `INVESTIGATE`, `RESOLVE`, atau `ACCEPT_WITH_REASON`. Dua transition penutup wajib mempunyai reason. Masalah yang terdeteksi lagi setelah ditutup dibuka kembali dengan fingerprint yang sama dan occurrence count bertambah.

### Export Excel

```json
{
  "action": "EXPORT_EXCEL",
  "reportCode": "BOOKINGS",
  "rangeStart": "2026-08-01",
  "rangeEnd": "2026-08-31"
}
```

`reportCode`: `DAILY_OPERATIONS`, `BOOKINGS`, `FINANCIAL_LEDGER`, `CLEANING`, atau `RECONCILIATION`. Rentang maksimal 366 hari. Response langsung berupa workbook `.xlsx` dengan `Cache-Control: private, no-store`, export ID, row count, expiry 15 menit, metadata filter/version, dan audit event. Retry dengan idempotency key yang sama menggunakan snapshot data laporan yang sama.

## Exit gate operasional

Sebelum UAT/go-live, jalankan reconciliation pada synthetic data. Semua critical exception harus diselesaikan pada entity sumber atau ditutup `ACCEPTED_WITH_REASON` oleh pihak berizin. `NEEDS_ATTENTION` tidak mengunci aplikasi, tetapi wajib terlihat pada dashboard dan daily review.
