# Guest Request dan Preferensi Tamu — KOOKA Residence

| Informasi | Nilai |
|---|---|
| Versi | 1.1 Draft |
| Tanggal | 1 Agustus 2026 |
| Scope | Phase 1 basic Guest Request |
| Sumber kebutuhan | [PRD.md](PRD.md) |

## 1. Tujuan

Guest Request menjaga permintaan tamu agar tidak hilang di WhatsApp, telepon, atau free-text booking. Modul ini mencatat permintaan, keputusan KOOKA, target waktu, dan hasilnya tanpa menggantikan workflow Cleaning, room allocation, F&B, service, maintenance, atau folio.

## 2. Batas domain

Guest Request berbeda dari:

- preferensi profil permanen customer; Phase 1 menyimpan kebutuhan pada booking/stay terkait;
- complaint/Guest Case, karena request bukan otomatis keluhan;
- Cleaning Task, order/service, Maintenance Issue, atau Accommodation Add-on, karena entity tersebut tetap menjadi sumber pelaksanaan dan tagihan;
- operational note, karena request mempunyai owner, target, dan lifecycle terstruktur.

Satu request dapat mereferensikan satu source action utama dan beberapa related records. Mengubah source action tidak boleh diam-diam menandai request selesai.

## 3. Sumber dan target request

Sumber:

- booking publik;
- input Front Office dari WhatsApp, email, telepon, atau tatap muka;
- check-in atau selama menginap;
- internal follow-up yang telah dikonfirmasi kepada tamu.

Target wajib eksplisit:

- seluruh booking;
- room stay/kamar tertentu;
- guest tertentu; atau
- pre-arrival sebelum unit dialokasikan.

Pada multi-room, sistem tidak menerapkan request ke semua kamar kecuali staf memilih target tersebut secara sadar.

## 4. Kategori dan field minimum

Kategori publik awal Phase 1:

- `Cleaning Request`;
- `Extra Guest / Extra Bed`;
- `Early Check-in`;
- `Late Checkout`;
- `Room Preference`;
- `Accessibility / Special Need`;
- `Other Request`.

F&B tidak masuk Guest Request karena pemesanan Phase 1 menggunakan formulir kertas yang dimasukkan Front Office. Tour/service, parking, dan baggage juga tidak menjadi kategori publik Phase 1 karena modul/proses tersebut ditunda atau tetap manual. Arrival coordination/ETA tetap memakai stay-timing field/workflow dan tidak perlu diduplikasi sebagai kategori publik.

Field minimum:

- source/channel dan waktu diterima;
- booking, room stay/room, atau guest target;
- category, customer-facing summary, dan internal note bila perlu;
- requested date/time, priority, owner/reviewer;
- status dan reason;
- confirmation/decision timestamp;
- linked Cleaning Task/order/service/add-on/maintenance record;
- created/updated actor dan audit reference.

`Cleaning Request` juga menyimpan preferred date/time window, indikator tamu sedang/akan keluar, serta explicit room-entry permission. Izin tersebut tidak mengalahkan tanda fisik DND yang masih terpasang.

Kategori, label Indonesia/English, default owner, target response, sensitivity, serta allowed public input dikonfigurasi dan diaudit.

## 5. Lifecycle

`Submitted → Under Review → Accepted → Fulfilled`

Alternatif:

- `Submitted/Under Review → Unable to Fulfill`;
- request aktif → `Cancelled`;
- `Accepted → Unable to Fulfill` hanya dengan alasan, komunikasi, dan audit bila kondisi berubah.

`Accepted` berarti KOOKA telah menyetujui komitmen yang tertulis. `Fulfilled` berarti kebutuhan benar-benar telah diselesaikan atau workflow sumber mencapai kondisi selesai yang sesuai.

Tidak ada generic status editor. Action minimum: `Submit`, `Review`, `Accept`, `Mark Unable`, `Fulfill`, dan `Cancel`.

## 6. Customer experience

- Booking publik menampilkan kategori yang aman dan relevan; kategori internal tidak ikut terlihat.
- Form selalu menyatakan bahwa request belum dijamin sampai dikonfirmasi KOOKA.
- Customer tidak memilih nomor kamar fisik melalui room preference.
- Request yang diterima setelah booking dapat dicatat Front Office karena customer tidak memiliki login.
- Konfirmasi `Accepted`, perubahan, atau `Unable to Fulfill` dikirim menggunakan template komunikasi resmi bila relevan.
- Lookup booking boleh menampilkan ringkasan request dan keputusan yang aman, tetapi tidak mengekspos internal note atau data sensitif.
- Target respons dapat dikonfigurasi per kategori, tetapi website tidak menjanjikan respons real-time.

## 7. Routing ke workflow sumber

| Jenis kebutuhan | Source of truth pelaksanaan |
|---|---|
| Cleaning saat tamu pergi/stayover | Cleaning Task |
| Posisi/karakter kamar | Room allocation preference dan assignment guard |
| Kerusakan/fasilitas bermasalah | Maintenance Issue |
| Extra guest/bed atau early/late yang disetujui | Accommodation Add-on/stay-timing workflow dan folio posting |

Guest Request hanya menyimpan konteks serta tautan. Source workflow mengendalikan assignment, fulfillment, posting, correction, dan statusnya sendiri.

Phase 1 menggunakan tanda fisik Do Not Disturb. Cleaning request atau entry permission yang tersimpan tidak membolehkan staf mengabaikan tanda yang masih terpasang; task menjadi `Deferred/Unable to Access` dan Front Office mengoordinasikan ulang secara manual.

## 8. Request berbayar

- `Accepted` tidak otomatis memposting charge.
- Sebelum `Accepted`, Front Office mengisi scope, harga IDR, tax/service profile atau `No Tax`, waktu layanan, serta payer/billing destination, lalu memperoleh konfirmasi customer melalui kanal yang dicatat.
- Source order/add-on dibuat dengan unique reference agar retry tidak menghasilkan charge ganda.
- Perubahan/cancellation setelah posting mengikuti reversal/refund workflow sumber, bukan mengedit request atau folio entry lama.

## 9. Dashboard dan alert

Front Office menjadi reviewer/owner utama seluruh Guest Request dan melihat:

- request baru dan belum direview;
- request kedatangan hari ini/besok;
- accepted request yang belum memiliki source action bila dibutuhkan;
- near-due, overdue, unable, atau berubah setelah accepted;
- request multi-room yang targetnya belum jelas;
- linked task/order yang cancelled/failed sementara request masih accepted.

Alert tidak menandai request fulfilled secara otomatis. Staf harus menyelesaikan melalui action berizin.

## 10. Privasi dan akses

- Kumpulkan kebutuhan praktis, bukan diagnosis atau riwayat kesehatan lengkap.
- Alergi, aksesibilitas, kesehatan, dan internal note sensitif memakai least privilege serta masking.
- Cleaning hanya menerima Cleaning Task yang telah dirutekan beserta informasi minimum untuk pelaksanaan; Cleaning tidak melihat note aksesibilitas/kesehatan, harga, atau free text sensitif. F&B tidak memperoleh akses ke Guest Request Phase 1.
- Shared display tidak menampilkan catatan sensitif; Live Room Monitor hanya boleh menampilkan badge operasional generik kepada role yang relevan.
- Audit mencatat view/update sensitif tanpa menyalin isi sensitif ke log.
- Retention mengikuti booking/stay dan kebijakan data sensitif; legal/safety hold dapat menunda purge.

## 11. Audit dan koreksi

Audit wajib untuk create, target/category change, assign owner, accept/reject, target-time change, sensitive view, link/unlink source action, fulfill, cancel, dan correction.

Perubahan setelah accepted menyimpan nilai lama, nilai baru, actor, waktu, alasan, serta kebutuhan komunikasi ulang. Record yang telah digunakan tidak dihapus untuk menyembunyikan histori.

## 12. Minimum acceptance tests

- Request publik selalu tampil sebagai not guaranteed sebelum accepted.
- Multi-room request tidak diterapkan ke semua kamar tanpa target eksplisit.
- Accepted tidak mengubah room assignment, inventory, cleaning, order, payment, atau folio.
- Cleaning request membuat/referensi Cleaning Task dan occupancy tetap sesuai room stay.
- Request berbayar tidak menghasilkan charge tanpa source action dan konfirmasi harga/tax.
- Fulfilled memerlukan evidence/note minimum atau source workflow yang selesai.
- Source task cancelled/failed saat request masih accepted menghasilkan exception.
- Unable/Cancelled menyimpan reason dan communication requirement.
- Sensitive request tidak tampil pada shared display atau role tanpa izin.
- Retry create/link/post tidak membuat request, task, order, atau folio charge ganda.

## 13. Keputusan sebelum implementasi

- Label Indonesia/English serta response/fulfillment target produksi per kategori.
- Named Front Office permission untuk accept, mark unable, fulfill, serta akses field sensitif.
- Template/kanal customer confirmation.
- Data minimum serta retention untuk allergy/accessibility/health need.
- Approval dan price-confirmation rule untuk request berbayar.
