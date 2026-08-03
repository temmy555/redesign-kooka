# Master & Configuration Administration API

| Informasi | Nilai                                                            |
| --------- | ---------------------------------------------------------------- |
| Tanggal   | 2 Agustus 2026                                                   |
| Scope     | Implementation Batch 1 / Roadmap Langkah 9–11                    |
| Status    | Implemented; migration dan quality verification belum dijalankan |

## Boundary

Seluruh route berada di aplikasi Next.js yang sama, memakai session staf yang sama, active property server-side, PostgreSQL transaction, named permission, dan mandatory audit. Client tidak dapat memilih `propertyId`.

Route tidak membuat data produksi otomatis. Daftar kamar yang diperkirakan sekitar 15, nomor/type kamar, tarif, pajak, rekening, isi policy, dan profil dokumen tetap harus dimasukkan dari data real.

## Route

### `GET /api/staff/admin/configuration`

Mengembalikan property profile, seluruh setting version, resolved version yang berlaku pada waktu request, serta display exchange-rate snapshot. Membutuhkan `configuration.view`.

`POST` memakai field `action`:

- `UPDATE_PROPERTY_PROFILE`
- `PREVIEW_SETTING`
- `CREATE_SETTING_DRAFT`
- `REVIEW_SETTING`
- `PUBLISH_SETTING`
- `RETIRE_SETTING`

Setting menyimpan `values` sebagai versioned JSON, tetapi UI nantinya harus memberi form terstruktur—bukan generic JSON editor. Effective-period overlap untuk active/scheduled version ditolak PostgreSQL.

### `GET /api/staff/admin/room-master`

Mengembalikan amenity bilingual, seluruh room type/version, room unit beserta tiga dimensi state, dan shared resource pool. Membutuhkan `room_master.view`.

`POST` action:

- `CREATE_AMENITY`
- `PREVIEW_ROOM_TYPE`
- `CREATE_ROOM_TYPE_DRAFT`
- `REVIEW_ROOM_TYPE`
- `PUBLISH_ROOM_TYPE`
- `CREATE_ROOM_UNIT`
- `CHANGE_ROOM_UNIT_TYPE`
- `CREATE_RESOURCE_POOL`
- `ARCHIVE_MASTER`

Nomor kamar adalah string dan menerima nomor single digit seperti `1`, `2`, dan seterusnya. Jenis kamar disimpan melalui effective-dated `room_unit_type_periods`; nomor kamar tidak menyandikan jenis kamar.

Capacity reduction melakukan impact preview terhadap reservation room line aktif/mendatang. Archive room unit ditolak bila kamar occupied atau mempunyai active/future physical room-night claim. Archive room type ditolak bila masih direferensikan booking aktif/mendatang.

### `GET /api/staff/admin/commercial-master`

Mengembalikan tax/service profile, policy, masked payment instruction, document profile/sequence, rate plan/version, dan IDR→USD/AUD display snapshot. Membutuhkan `commercial.view`.

`POST` action:

- `CREATE_TAX_DRAFT`
- `CREATE_POLICY_DRAFT`
- `CREATE_PAYMENT_INSTRUCTION_DRAFT`
- `CREATE_EXCHANGE_RATE`
- `CREATE_DOCUMENT_PROFILE_DRAFT`
- `CREATE_DOCUMENT_SEQUENCE`
- `CREATE_RATE_PLAN_DRAFT`
- `REVIEW_VERSION`
- `PUBLISH_VERSION`
- `PREVIEW_RESOLVED_RATE`

Official currency selalu IDR. USD dan AUD hanya display preference berdasarkan snapshot yang memiliki source, `asOfAt`, expiry, dan rounding metadata.

Rate resolution deterministik:

1. Exact date override pada `rate_rule_dates`.
2. `SPECIAL_DATE`.
3. `SEASONAL`.
4. `WEEK_PATTERN`.
5. `BASE`.
6. Priority dan stable rule ID sebagai tie-breaker.

Rate nol ditolak. Complimentary/custom price nantinya menggunakan adjustment/discount beralasan, bukan master rate nol.

## Approval

- Draft dengan `approvalStatus=NOT_REQUIRED` dapat langsung dipublish oleh staf dengan permission manage.
- Draft `PENDING` hanya dapat direview oleh `configuration.approve` atau `commercial.approve` sesuai domain.
- Rate plan default tidak memerlukan Owner approval agar Front Office berizin dapat mengelola harga sesuai keputusan Owner; caller dapat mengirim `requiresApproval=true` untuk perubahan yang memang perlu four-eyes review.
- Tax, policy, payment instruction, dan document profile saat ini dibuat sebagai `PENDING` karena berdampak legal/keuangan.
- Permission Owner/Front Office aktif sesuai mapping role setelah login email/password; tidak ada MFA gate.

## Sensitive configuration

`DATA_ENCRYPTION_KEY` harus berupa base64 dari tepat 32 byte. AES-256-GCM dipakai untuk bank account number dan tax identity. Response, log, dan audit tidak mengembalikan ciphertext atau plaintext; payment instruction overview hanya menampilkan empat karakter terakhir.

Key wajib tersedia pada UAT/production. Rotation/multi-key keyring belum diaktifkan dan harus dibuat sebagai controlled migration sebelum mengganti key yang sudah mengenkripsi data.

## Migration

Migration `0007_master_configuration_controls` menambahkan:

- approval field yang belum tersedia pada baseline;
- lifecycle/approval checks;
- no-overlap exclusion untuk room type dan rate-plan version;
- non-zero rate guards;
- explicit rate-rule type;
- unique exchange-rate source time;
- named RBAC permissions untuk configuration, room master, dan commercial master.

Migration belum diterapkan ke database local pada saat dokumen ini ditulis. Jalankan hanya setelah environment lokal aktif dan review perubahan:

```bash
npm run db:status
npm run db:migrate
```

## Verification yang ditunda

Test focused untuk version lifecycle dan encryption sudah ditulis, tetapi belum dijalankan. Type-check, full unit/integration test, disposable migration, build, dan quality gate sengaja diserahkan kepada Owner sesuai keputusan 2 Agustus 2026.
