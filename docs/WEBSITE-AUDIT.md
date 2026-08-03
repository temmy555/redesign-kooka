# Website Audit dan Arah Redesign

## Scope audit

Audit awal ini mendokumentasikan temuan dan keputusan yang telah disepakati untuk website KOOKA Residence Surabaya:

<https://www.kookaresidencesby.com/>

Dokumen ini adalah baseline redesign, bukan audit teknis baru terhadap versi live pada tanggal tertentu. Setiap angka rating, jarak, harga, kebijakan, dan ketersediaan harus diverifikasi dengan data operasional sebelum dipublikasikan.

## Ringkasan

Website saat ini sudah memiliki modal visual yang baik: warna hijau relevan dengan suasana properti dan hero menggunakan properti asli. Masalah utamanya adalah prioritas konten. Homepage terlalu panjang—terutama pada mobile—navigasi terlalu padat, dan kamar belum cukup dominan sebagai produk utama. Sebagian foto kamar masih berupa stock/Unsplash, sehingga kepercayaan dan akurasi ekspektasi tamu berisiko menurun.

Redesign diarahkan menjadi **Urban Tropical Retreat**: pengalaman boutique guesthouse yang tenang, hangat, hijau, dan personal. Fokus utamanya bukan menambah banyak seksi, melainkan memperjelas jalur dari inspirasi menuju pencarian ketersediaan dan booking.

## Temuan audit

### Kekuatan yang dipertahankan

- Fondasi brand hijau selaras dengan karakter tropical retreat.
- Hero properti asli memberi konteks dan rasa tempat.
- Website sudah berfungsi sebagai landing page sekaligus pintu masuk pemesanan guesthouse.
- Website sebelumnya sudah menyediakan Bahasa Indonesia/English dan pilihan tampilan harga; kapabilitas ini harus dipertahankan.
- Ragam services, tours, gym/play area, dan F&B memberi peluang upsell setelah kamar dipilih.

### Masalah prioritas tinggi

1. **Homepage terlalu panjang, khususnya pada mobile.** Hierarki melemah dan CTA booking mudah tenggelam.
2. **Navigasi terlalu padat.** Banyak pilihan bersaing sebelum pengguna memahami kamar dan ketersediaan.
3. **Foto kamar belum sepenuhnya autentik.** Stock/Unsplash tidak boleh menjadi representasi final produk yang dipesan.
4. **Hero belum menjadi alat pencarian booking.** Pengguna membutuhkan check-in, check-out, jumlah tamu, dan jumlah kamar langsung di area utama.
5. **Kamar belum menjadi fokus yang cukup kuat.** Fasilitas dan layanan pendukung seharusnya membantu keputusan booking, bukan berkompetisi dengannya.
6. **Sinyal kepercayaan belum lengkap.** Dibutuhkan trust strip, testimoni terverifikasi, lokasi/jarak nyata, FAQ, kebijakan ringkas, dan kanal bantuan.
7. **CTA mobile membutuhkan persistensi.** Sticky CTA membantu pengguna kembali ke pencarian/booking tanpa menggulir panjang.

## Arah visual: Urban Tropical Retreat

### Karakter

- **Tenang:** whitespace cukup, ritme konten tidak padat, motion halus dan seperlunya.
- **Hangat:** warna natural, pencahayaan foto yang manusiawi, dan copy yang ramah.
- **Hijau:** palet berasal dari lingkungan properti, bukan dekorasi generik.
- **Personal:** menonjolkan pengalaman menginap, detail layanan, dan manusia di balik hospitality.
- **Boutique:** editorial, terkurasi, serta menghindari pola katalog hotel massal.

### Prinsip aset

- Prioritaskan foto/video asli properti, kamar, taman, fasilitas, makanan, dan interaksi hospitality.
- Ganti semua stock/Unsplash sebelum rilis final.
- Tampilkan kondisi kamar dengan jujur: sudut lebar, detail bed/bathroom, view, akses, dan skala ruang.
- Gunakan cropping konsisten, alt text deskriptif, responsive images, compression, lazy loading, dan poster video.
- CMS perlu menandai placeholder/stock agar aset sementara tidak sengaja dipublikasikan.
- Gunakan production-readiness rule: hero kamar dan minimum gallery set harus authentic property assets; override sementara hanya oleh role berizin dengan alasan/audit.
- Harga, kapasitas, amenity, availability, dan rule publik harus membaca operational master, bukan copy CMS terpisah.

## Arsitektur homepage yang direkomendasikan

1. **Header ringkas** — Kamar, Fasilitas, Gallery, Menu, Lokasi, pemilih bahasa/mata uang, dan CTA `Cek Ketersediaan`.
2. **Hero + availability search** — media asli, value proposition, check-in, check-out, tamu, kamar, dan tombol pencarian.
3. **Trust strip** — lokasi, rating/testimoni terverifikasi, rekening pembayaran resmi, dan bantuan WhatsApp.
4. **Featured rooms** — maksimal tiga kategori utama, kapasitas, fasilitas kunci, harga mulai, dan detail.
5. **Packages/whole house** — ditampilkan secara ringkas sebagai pilihan grup/keluarga.
6. **Signature experience** — taman dan suasana KOOKA sebagai pembeda.
7. **Food preview** — menu pilihan dan harga, lalu tautan ke menu lengkap.
8. **Services/tours** — pendukung/upsell setelah proposisi kamar jelas.
9. **Editorial gallery** — aset autentik yang dikurasi.
10. **Testimoni, lokasi, FAQ, kebijakan ringkas, dan CTA akhir.**

Pada mobile, CTA booking tetap terlihat melalui sticky action yang tidak menutupi konten atau kontrol penting.

## Bahasa dan tampilan mata uang

- Pertahankan Bahasa Indonesia dan English pada seluruh halaman publik serta booking flow.
- Language switcher dan currency selector harus mudah ditemukan tetapi tidak mengalahkan CTA booking.
- Pertahankan pilihan tampilan `IDR`, `USD`, dan `AUD` secara konsisten antarhalaman.
- USD/AUD diberi label `perkiraan/estimated`; nilai resmi booking dan pembayaran selalu IDR.
- Pada review booking, instruksi transfer, invoice, dan status pembayaran, IDR harus tampil dominan untuk mencegah salah persepsi.
- Pemilihan bahasa/mata uang tidak boleh menghapus input pencarian atau data booking yang sedang diisi.
- Formatting tanggal, angka, dan harga mengikuti locale; konten yang belum diterjemahkan menggunakan fallback yang utuh.

## Prioritas pengalaman booking

- Pencarian ketersediaan adalah primary action.
- Form pertama meminta data minimum: tanggal, jumlah tamu, dan jumlah kamar.
- Hasil menonjolkan kamar tersedia, kapasitas, harga, kebijakan, dan foto asli.
- Add-on F&B, services, dan tours muncul setelah pilihan kamar atau pada tahap upsell yang relevan.
- Booking selesai menghasilkan kode booking, proforma/instruksi transfer, deadline, dan tombol WhatsApp dengan pesan terisi.
- Status pembayaran tidak boleh disamakan dengan status reservasi atau stay.

## Trust dan informasi faktual

- Gunakan testimoni dari sumber yang dapat diverifikasi dan tampilkan provenance/platform bila diizinkan.
- Jarak ke landmark harus dihitung dari lokasi sebenarnya dan menggunakan moda yang jelas, misalnya jarak jalan atau estimasi waktu berkendara.
- Harga `mulai dari` harus menyebut konteks dan mengikuti availability/rate yang aktual.
- Rekening transfer resmi, kebijakan deposit, batas pembayaran, pembatalan, check-in/out, serta refund harus mudah ditemukan.
- WhatsApp membantu customer, tetapi kode booking dan status resmi tetap berada di sistem.

## Prinsip mobile dan aksesibilitas

- Desain dimulai dari lebar 360 px.
- Kurangi seksi berulang dan gunakan progressive disclosure untuk detail sekunder.
- Jaga target sentuh, label form, navigasi keyboard, contrast, alt text, dan pesan error yang jelas.
- Hero media tidak boleh menghambat interaksi pencarian atau Core Web Vitals.
- Sticky CTA harus menghormati safe area dan tidak menutupi footer/form.

## Checklist konten sebelum rilis

- [ ] Seluruh room type memiliki foto asli yang lengkap dan akurat.
- [ ] Stock/Unsplash sudah diganti atau tidak dipublikasikan.
- [ ] Kapasitas, bed type, amenity, smoking policy, dan aksesibilitas tervalidasi.
- [ ] Harga, pajak/service charge, deposit, cancellation, dan check-in/out tervalidasi.
- [ ] Seluruh konten customer-facing tersedia dalam Bahasa Indonesia dan English atau memiliki fallback yang disetujui.
- [ ] Harga IDR/USD/AUD konsisten; USD/AUD berlabel estimasi dan total pembayaran IDR tampil dominan.
- [ ] Rating dan testimoni memiliki sumber yang dapat diverifikasi.
- [ ] Alamat, peta, jarak, dan estimasi perjalanan diperiksa ulang.
- [ ] Rekening pembayaran dan nama pemilik rekening resmi dikonfirmasi.
- [ ] Menu F&B dan harga terkini tersedia.
- [ ] Services/tours memiliki harga, durasi, kapasitas, jadwal, dan kebijakan.
- [ ] Semua media memiliki alt text, ukuran optimal, dan izin penggunaan.
- [ ] Setiap media memiliki classification authentic/stock/pending, source, serta rights/consent yang relevan.
- [ ] Draft/review content tidak dapat muncul publik; preview dilindungi dan tidak diindeks.
- [ ] Flow booking dan pesan WhatsApp diuji pada mobile.

## Indikator keberhasilan redesign

- Pengguna dapat memulai pencarian ketersediaan langsung dari hero.
- Jalur mobile dari landing page ke booking lebih singkat dan mudah dipahami.
- Kamar menjadi konten paling dominan sebelum upsell.
- Tidak ada aset stock yang tampil sebagai representasi kamar final.
- Conversion pencarian ke booking, direct booking, engagement room detail, dan drop-off per langkah dapat diukur.
