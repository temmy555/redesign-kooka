# Security, Privacy, Retention, dan Audit Access — KOOKA Residence

Dokumen keputusan keamanan Phase 1 dan peningkatan Phase 2.

- Status: disetujui untuk PRD.
- Scope: data classification, staff authentication, RBAC, sensitive-file storage, customer lookup, masking, access audit, retention/purge, backup, monitoring, dan incident readiness.
- Keputusan eksplisit: SSO/enterprise identity provider integration tidak diperlukan dan tidak masuk roadmap aktif.
- Sumber kebutuhan: [PRD.md](PRD.md).

## 1. Data classification

Klasifikasi minimum:

- `Public`: room/menu/service content, fasilitas, galeri, FAQ, public policy.
- `Internal`: room plan, housekeeping/maintenance task, internal operational notes.
- Formulir kertas F&B yang memuat room/name/order diperlakukan minimal `Internal/Confidential` sesuai isi dan tidak boleh dibiarkan terbuka setelah diproses.
- `Confidential`: nama, email, telepon, booking, payment metadata/evidence, invoice recipient, company details.
- `Highly Sensitive`: nomor/foto KTP/paspor, foto tamu, signature, refund bank account, private consent document.
- Lost & Found: deskripsi umum dapat `Internal/Confidential`; foto/ciri rahasia claim, alamat pengiriman, storage detail, identity-check evidence, dan high-value custody evidence minimal `Confidential` dan dapat `Highly Sensitive` sesuai kategori.

Setiap field/file category mempunyai classification, allowed permissions, masking rule, retention policy, export rule, dan audit requirement.

## 2. Staff account dan authentication

- Setiap staf memakai akun individual; shared account tidak diperbolehkan.
- Password disimpan dengan password hashing modern dan tidak pernah dapat dibaca kembali.
- Login staf memakai email dan kata sandi biasa. MFA/TOTP tidak digunakan untuk role mana pun pada scope guesthouse ini.
- Login memakai rate limiting, failed-attempt monitoring, temporary lock/challenge, dan generic error.
- Session memiliki idle timeout, absolute expiry, secure cookie/token handling, device/session list, revoke-all/revoke-device, dan logout.
- Perubahan password, email/login identifier, role, atau permission menghasilkan security event/audit.
- High-risk master configuration seperti rekening bank, tax, invoice identity/sequence, maximum capacity, serta role/permission memerlukan Owner approval atau Owner self-approval, alasan wajib, impact preview, serta security event. Transaksi finansial operasional Front Office tidak memakai Owner approval limit.
- Perubahan rekening bank selalu menghasilkan internal security alert; instruction lama tidak diganti massal tanpa explicit reissue workflow.
- Shared tablet tetap memakai akun individual atau fast user switch/lock; tidak menggunakan satu credential bersama.

SSO tidak diperlukan. Jika kebutuhan organisasi berubah jauh di masa depan, keputusan tersebut harus ditinjau ulang melalui scope baru dan bukan asumsi arsitektur Phase 1–3.

## 3. Authorization dan least privilege

Permission diperiksa server-side pada action dan field/file access, bukan hanya menyembunyikan menu.

- Owner/Super Admin: konfigurasi role, approval, audit, security/retention rule.
- Front Office: booking/stay/payment sesuai izin; akses KTP/signature hanya jika permission khusus diberikan.
- Cleaning: room/task/operational note minimum; tanpa payment, folio, KTP, signature, atau refund account.
- F&B: order, room number, Room Lead Guest identifier minimum, charge privilege, dan billing destination; tanpa data sensitif lodging.

KTP/identity photo, identity number, guest photo, dan check-in signature hanya dapat diakses Owner/Super Admin atau Front Office yang memperoleh permission khusus. Data tersebut tidak tersedia bagi Cleaning, F&B, customer booking lookup, shared display, invoice, atau notification payload.

Permission sensitif dipisahkan: `View`, `Capture/Upload`, `Download`, `Export`, `Replace`, `Delete/Purge`, dan `Grant Access`.

Configuration permissions dipisahkan menjadi `View`, `Create Draft`, `Submit`, `Approve/Reject`, `Schedule`, `Activate`, `Retire`, `Export`, dan `Manage Secret`. Owner approval tidak memberi staf permission langsung untuk melihat secret plaintext.

## 4. Sensitive data display

- List/search menampilkan masked values; full value hanya pada detail/action berizin.
- Live Room Monitor menampilkan active Room Lead Guest hanya kepada role yang membutuhkan; Cleaning memakai nama dimasking/initial atau label `Occupied` sesuai konfigurasi.
- `Shared Display/TV Mode` wajib memasking nama dan menyembunyikan booking code, kontak, saldo, financial alert detail, serta data sensitif. Mode layar bersama menggunakan auto-lock/session timeout yang dikonfigurasi.
- KTP/signature tidak muncul sebagai thumbnail pada general booking list.
- Refund bank account dan identity number dimasking secara default.
- Copy-to-clipboard, download, print, dan export dapat dibatasi/diaudit.
- Highly Sensitive content tidak masuk analytics payload, URL/query string, browser log, generic application log, email biasa, notification body, atau error tracking.

## 5. Private file storage dan access

KTP/paspor, guest photo, signature, payment evidence, refund proof, maintenance/damage evidence, Lost & Found photo/claim/custody/shipping evidence, dan sensitive attachment:

- Disimpan melalui private file-storage adapter. Phase 1 memakai persistent local VPS volume di luar public web root; adapter dapat dipindahkan ke S3-compatible object storage kemudian.
- Tidak memiliki permanent public URL.
- Diakses melalui short-lived signed URL/action setelah authorization check.
- Upload memvalidasi extension, content signature, MIME, size, dimension; menjalankan malware scan; dan menolak executable/unsafe content.
- Metadata GPS/EXIF yang tidak diperlukan dihapus.
- Object key tidak memuat nama, nomor identitas, email, booking code penuh, atau data personal lain.
- Preview/download mempunyai audit dan expiry.

## 6. Consent dan purpose

- Sebelum capture/upload, tampilkan purpose notice, jenis data, optional/required status, serta informasi penyimpanan secara ringkas.
- Consent/policy version, accepted/declined/skipped, actor/guest, channel/device, dan waktu disimpan.
- Foto KTP/identitas, foto tamu, dan tanda tangan masing-masing selalu opsional pada Phase 1. Decline/skip, kamera ditolak/tidak tersedia, atau upload gagal tidak menghalangi check-in dan tidak memerlukan override.
- Perubahan purpose memerlukan version baru dan tidak berlaku surut diam-diam. Perubahan menjadi mandatory berada di luar keputusan Phase 1 dan memerlukan scope/policy review baru.

## 7. Customer booking lookup

- Customer tidak memiliki login/account.
- Lookup memakai high-entropy booking code + matching booking email.
- Error generik tidak mengungkap field yang benar.
- Rate limiting, attempt monitoring, bot/abuse protection, short-lived lookup session, dan audit digunakan.
- Data ditampilkan minimum dan dimasking.
- KTP, signature, refund account, payment evidence/internal notes, audit, serta sensitive co-guest data tidak pernah tampil.
- Perubahan/cancellation Phase 1 tetap melalui Front Office/WhatsApp dengan verification procedure.

## 8. Audit access dan security event

Append-only audit/security event minimal mencatat:

- Login success/failure, logout, session revoke, serta password/security setting change.
- Role/permission/grant change.
- View/download/print/export/replace/delete sensitive data.
- Booking, room, price, payment, refund, folio, invoice, policy, dan retention override.
- Actor/system, target object, action, timestamp, request/correlation ID, result, reason, device/IP metadata yang proporsional, dan approval.

Audit tidak menyimpan secret, password, OTP, full identity number, signature content, bank account penuh, atau file body.

Suspicious patterns seperti bulk identity download, repeated lookup failures, unusual permission changes, atau repeated failed login menghasilkan alert/review queue.

## 9. Retention policy

Retention dikonfigurasi per category:

- Contact/booking guest data.
- Identity number/document/photo/signature.
- Payment evidence dan refund bank/proof.
- Invoice/folio/payment/refund records.
- Operational note/attachment.
- Audit/security event.
- CMS original/media rights records.
- Lost & Found item/claim/custody/shipment evidence dan alamat pengiriman, dengan event basis per kategori serta disposition/hold rule.
- Formulir kertas F&B atau scan opsional, dengan retention singkat sesuai SOP setelah order/system/audit record aman.

Rule menyimpan duration/event basis, archive period, purge method, approver, applicable hold, dan effective version. Durasi final ditetapkan Owner setelah memvalidasi kebutuhan operasional, kontraktual, akuntansi, sengketa, dan kewajiban yang berlaku.

Untuk KTP/identity photo, identity number, guest photo, dan signature, duration produksi tidak di-hardcode dan wajib diisi sebelum go-live. Setelah content dipurge, sistem boleh mempertahankan completion/consent status dan audit minimum selama tidak menyimpan kembali file, signature content, atau nomor identitas lengkap.

## 10. Purge, anonymization, dan legal/dispute hold

Purge workflow:

1. Data melewati retention threshold.
2. Sistem memeriksa booking/folio state, dispute/incident/legal hold, serta reference yang masih wajib.
3. Generate review/approval bila dikonfigurasi.
4. Delete sensitive object atau anonymize personal fields tanpa merusak financial/inventory history.
5. Catat category/object reference, actor/job, policy version, waktu, hasil, dan exception tanpa menyalin deleted content.

Hold memiliki reason, scope, creator/approver, start/end/review date, dan audit. Hold expiry tidak otomatis purge tanpa re-evaluation.

## 11. Backup dan recovery

- Backup database/object metadata terenkripsi dan aksesnya dibatasi.
- Backup job dimonitor dan restore test dilakukan terjadwal.
- Sebelum Go/No-Go Phase 1, backup dan restore procedure wajib diuji pada environment yang sesuai tanpa menimpa production live.
- Setelah live transaction, restore point harus disertai data-loss assessment, replay/re-entry plan, reconciliation, Owner approval, dan incident record.
- Recovery objective ditentukan sebelum production.
- Sensitive purge/deletion mempunyai backup-expiry strategy; backup bukan penyimpanan permanen untuk data yang sudah dipurge.
- Restore tidak boleh diam-diam memublikasikan file sensitif atau mengaktifkan kembali revoked access/session.
- Recovery action diaudit.

## 12. Monitoring dan incident readiness

Minimum monitoring:

- Authentication/authorization failure spikes.
- Sensitive file access/download anomalies.
- Booking lookup abuse.
- Upload scan failures.
- Audit/backup/retention job failures.
- Privilege escalation/change.
- Lost & Found high-value access, custody gap, seal mismatch, unusual claim decision, dan disposition/retention override.

Tersedia incident record/runbook sederhana: containment, account/session revoke, evidence preservation, impact assessment, owner notification, recovery, dan follow-up. Detail komunikasi/regulatory response ditentukan sebelum production bersama pihak yang berwenang memberi nasihat.

## 13. Phase delivery

Phase 1 wajib:

- Individual accounts, password security, rate limiting, session revoke, dan login biasa tanpa MFA.
- Server-side RBAC dan field/file permissions.
- Private encrypted storage, signed URL, secure upload, masking.
- Customer lookup protection.
- Guest-name RBAC, Live Room Monitor Shared Display Mode, masking, serta shared-device auto-lock.
- Risk-based configuration permission/approval, mandatory reason, bank-change security alert, impact preview, dan secret reference boundary.
- Sensitive access audit/security events.
- Versioned configurable retention, manual/assisted purge, backup/restore test.
- Lost & Found purpose-based access, private evidence/address, append-only custody audit, category-based retention, dan disposition guard.

Phase 2:

- Automated retention queues/approvals, privacy export/anonymization workflow.
- Anomaly alerts, bulk export controls, richer incident/security dashboard.
- Scheduled access review dan device/session administration.

SSO tidak termasuk Phase 1, Phase 2, atau Phase 3 saat ini.

## 14. Minimum acceptance tests

- Shared staff credential tidak dapat digunakan sebagai configured user pattern; semua action memiliki actor individual.
- Owner/Front Office sensitive access mengikuti explicit permission, masking, dan audit; tidak ada MFA.
- Cleaning/F&B tidak dapat memanggil API sensitive fields walaupun mencoba URL langsung.
- Masked field tidak membuka full value tanpa explicit permission/action.
- Shared Display Mode tidak menampilkan full guest name, booking code, kontak, saldo, atau sensitive detail setelah refresh/reconnect.
- Sensitive file tidak dapat diakses dengan permanent/public URL atau expired signed URL.
- View/download/export KTP/signature/refund account menghasilkan audit event.
- Skip/decline setiap field check-in sensitif tidak memblokir check-in dan tidak memerlukan override.
- Cleaning, F&B, customer lookup, shared display, invoice, dan notification payload tidak dapat mengakses KTP/identity photo, guest photo, identity number, atau signature.
- Sensitive data tidak muncul di application logs, analytics, URL, atau error payload.
- Maintenance/damage evidence tidak tampil pada Shared Display/notification dan hanya dapat diakses role yang relevan melalui private authorized access.
- Lost & Found photo, secret claim attribute, address, storage detail, dan custody evidence tidak tampil pada shared display/notifikasi umum serta tidak dapat diakses Cleaning setelah handoff tanpa permission.
- Active Lost & Found claim/dispute/hold mencegah disposition/purge; custody event tidak dapat diedit atau dihapus.
- Booking lookup brute-force mendapat generic response/rate limit dan tidak mengekspos co-guest sensitive data.
- Retention purge ditolak ketika hold aktif dan berhasil idempotent ketika eligible.
- Anonymization mempertahankan financial/inventory referential integrity.
- Backup restore test berhasil dan tidak mengaktifkan revoked session/access.
- Permission change dan bulk sensitive access menghasilkan security event/alert.
- Admin tidak dapat activate high-risk configuration tanpa approval; Owner self-approval membutuhkan reason dan menghasilkan security event.
- Integration secret tidak muncul kembali pada UI, export, diff, audit payload, analytics, atau application log.
- Staging/UAT tidak mengandung production personal data tanpa kebutuhan dan kontrol yang disetujui; dummy data tidak muncul dalam production.
- Offline Operations Log dan emergency export memuat data minimum, disimpan aman, aksesnya dibatasi, dan ditutup/dimusnahkan sesuai retention setelah recovery.
