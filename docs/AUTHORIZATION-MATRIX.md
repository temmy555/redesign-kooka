# Authorization Matrix — Phase 1A

Semua route `/api/staff/**` wajib memiliki session individual. Mutasi browser melewati same-origin guard di `proxy.ts`; route/service tetap menjadi kontrol utama melalui named permission dan property boundary.

| Area API                          | Permission utama                                                                   | Role default yang relevan        | Data sensitif                 |
| --------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------- | ----------------------------- |
| Staff permission self-view        | session sendiri                                                                    | Semua staf                       | Tidak                         |
| Role grant/revoke                 | `identity.role.manage`                                                             | Owner                            | Ya, audit                     |
| Property/configuration            | configuration draft/review/publish permissions                                     | Owner                            | Ya                            |
| Commercial/rate/tax/policy        | commercial view/draft/review/publish permissions                                   | Owner, Front Office terbatas     | Ya                            |
| CMS/media/menu administration     | CMS/media/menu permissions                                                         | Owner/content staff terotorisasi | Media private sebelum publish |
| Booking/reservation               | `booking.manage`                                                                   | Owner, Front Office              | Guest PII                     |
| Front Office operational catalog  | `booking.manage`; hanya produk aktif, nomor kamar, dan status operasional          | Owner, Front Office              | Tidak                         |
| Payment/folio/invoice/refund      | `payment.manage`                                                                   | Owner, Front Office              | Financial                     |
| Stay/check-in/out                 | `stay.manage`; file identitas memerlukan permission file terpisah                  | Owner, Front Office              | Highly sensitive bila capture |
| Room board full                   | `stay.manage`                                                                      | Owner, Front Office              | Nama/kode booking             |
| Room board shared                 | `room.board.view`; masking dipaksa di service bila tanpa `stay.manage`             | Cleaning                         | Dimasking                     |
| Cleaning/maintenance/Lost & Found | housekeeping/property-operation permissions                                        | Cleaning, Front Office           | Minimum necessary             |
| F&B order                         | `fnb.order.manage`; room-charge guard juga memeriksa stay dan billing privilege    | F&B, Front Office                | Minimum room/lead guest       |
| Reporting/export/reconciliation   | `report.view`, `report.export`, `daily_operations.manage`, `reconciliation.manage` | Owner, Front Office              | Export dimasking              |

Aturan fail-closed:

- OWNER adalah Super Admin property dan menerima seluruh named permission yang terpasang melalui mapping `role_permissions`, bukan bypass pada authorization code. Permission baru pada migration berikutnya tetap harus secara eksplisit disejajarkan untuk OWNER.
- Cleaning dan F&B tidak mendapatkan `stay.manage`, `payment.manage`, atau permission file identitas melalui role default.
- `readStoredFile` memeriksa permission terhadap property pemilik file dan menolak bila scan belum `CLEAN`, file sudah dipurge, atau audit access gagal ditulis.
- Shared Room Monitor tidak dapat dinaikkan menjadi tampilan penuh hanya melalui parameter client.
- CSP penuh belum diaktifkan karena nonce untuk script Next.js harus diuji di browser; frame, MIME sniffing, referrer, opener, dan device permissions sudah dibatasi melalui response headers.
