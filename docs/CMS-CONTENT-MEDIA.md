# CMS, Content, Media, dan Localization — KOOKA Residence

Dokumen keputusan produk untuk CMS Phase 1 dan perluasan Phase 2.

- Status: disetujui untuk PRD.
- Scope: operational master vs editorial content, bilingual fields, workflow/revision, media processing, authenticity/rights, policy versioning, trust content, preview/publish, cache, archive, permission, dan production readiness.
- Sumber kebutuhan: [PRD.md](PRD.md).

## 1. Sumber kebenaran

Pisahkan:

- `Operational/Product Master`: room capacity, bed/extra-bed rule, amenity relation, rate, availability, menu/service price, tax/service profile, schedule, serta resource rules.
- `Editorial CMS`: title, short/long description, storytelling, caption, media order, page section, FAQ, SEO, dan promotional copy.

Public page membaca operational data langsung dari master yang relevan. CMS tidak menyimpan salinan teks bebas untuk harga, kapasitas, availability, atau rule yang dapat berbeda dari booking engine.

Perubahan master operasional mengikuti permission/audit domain terkait dan tidak dapat dilewati melalui CMS publish.

## 2. Content workflow

Status konten:

- `Draft`.
- `In Review`.
- `Scheduled`.
- `Published`.
- `Archived`.

Setiap revision menyimpan content entity, locale, field changes, actor, timestamp, reason/comment, publish/effective time, dan previous version. Restore membuat revision baru; histori tidak ditimpa.

Edit dan publish adalah permission terpisah. Admin dapat menyiapkan draft; kebijakan, claim penting, rekening pembayaran, dan content berisiko dapat memerlukan Owner/Publisher approval.

## 3. Bahasa dan localization

Bahasa customer-facing: Bahasa Indonesia (`id`) dan English (`en`). Field translatable minimal:

- Title, summary, description, CTA label.
- Caption dan alt text.
- FAQ, policy, menu/service/tour copy.
- Slug, page title, meta description, dan social metadata.

Sistem menghitung translation completeness per entity/locale. Missing locale memakai fallback yang disetujui secara utuh dan tidak menampilkan translation key, field kosong, atau paragraf campuran tanpa sengaja.

Locale URL/metadata memakai canonical dan `hreflang` yang sesuai. Mengganti bahasa tidak menghilangkan search/booking state.

## 4. Media asset dan relation

Media asset disimpan sekali dan dapat direlasikan ke banyak room type, menu, service/tour, page, gallery, atau campaign tanpa upload file ganda.

Metadata minimal:

- Original file, mime type, size, dimensions/duration, checksum.
- Title, alt text, caption per locale.
- Category, tags, focal point, crop/aspect preference.
- Order, featured/hero flag, visibility.
- Relation type/entity.
- Creator/uploader, created/updated time.
- Authenticity/source classification dan usage rights.

Relation menyimpan context-specific order/crop/featured agar satu asset dapat digunakan berbeda pada halaman yang berbeda.

## 5. Upload dan processing

Upload masuk staging dan belum otomatis publik. Pipeline minimal:

- Validate type, extension/signature, size, dimensions, dan duration.
- Malware/security scan.
- Strip metadata sensitif seperti GPS/EXIF yang tidak diperlukan.
- Generate responsive sizes, thumbnails, WebP/AVIF bila didukung, serta optimized fallback.
- Video poster/thumbnail dan configurable size/duration limit.
- Record processing status/error dan retry secara idempotent.

Original/private source tidak memakai permanent public URL. Public derivatives hanya tersedia ketika media relation/content telah published.

Hero memakai performance budget; video tidak autoplay dengan suara. Media di bawah fold menggunakan lazy loading.

## 6. Authenticity dan usage rights

Classification minimal:

- `Authentic Property Asset`.
- `Stock/Placeholder`.
- `Pending Verification`.

Simpan source/creator, ownership/license note, consent/release bila relevan, dan license expiry jika ada.

Production-readiness rule:

- Hero room wajib authentic property asset.
- Setiap published room type memiliki minimum authentic photo set yang dikonfigurasi, mencakup representasi ruang utama serta detail penting.
- Stock/Unsplash hanya untuk staging/placeholder dan tidak menjadi representasi final kamar.
- Sistem memberi blocking error untuk production-ready/publish rule yang disepakati atau explicit Owner override dengan reason selama masa persiapan.

Foto yang mengandung tamu/staf memerlukan consent/usage basis yang tercatat sesuai kebijakan KOOKA.

## 7. Policy content

Payment, cancellation, refund, privacy, house rules, check-in/out, deposit, dan policy lain memiliki:

- Versi Indonesia/English.
- Draft/review/published status.
- Effective start/end.
- Approver dan audit.
- Customer-facing summary dan full text.

Booking menyimpan exact published policy version/snapshot yang berlaku saat dibuat. Unpublish/update tidak mengubah booking historis.

Khusus House Rules Phase 1:

- Satu policy set bilingual menjadi sumber customer-facing untuk check-in/out, early/late request, occupancy/extra guest/extra bed, smoking, noise, visitor, cleaning/DND/room entry, key, damage, parking, baggage, payment, cancellation/refund, dan no-show/late arrival.
- Online booking merekam checkbox acknowledgement, exact policy version/snapshot, language, timestamp, dan channel; checkbox tidak bergantung pada check-in signature.
- Manual booking dapat mencatat `Provided/Acknowledged/Declined` beserta delivery channel tanpa mengubah reservation, payment, stay, atau folio secara otomatis.
- Nilai yang belum diverifikasi tidak dapat dipublikasikan sebagai fakta/janji. Wording `subject to availability and Front Office confirmation` hanya dipakai untuk proses manual/terbatas yang telah disetujui.
- Summary, full text, checkbox copy, serta manual acknowledgement copy Indonesia/English harus lengkap sebelum publish.

## 8. Trust content

Testimonial, rating, distance/location, facility claim, award, dan factual trust item menyimpan provenance:

- Source/platform dan source reference.
- Display permission/consent bila diperlukan.
- Verified by/at.
- Valid-through/review date bila relevan.
- Measurement/mode untuk distance atau travel-time claim.

Content yang belum verified tidak boleh ditampilkan sebagai fakta. Harga `mulai dari` membaca rate/availability source dan menyertakan context; bukan angka statis CMS.

## 9. Preview, publish, dan cache

- Draft preview menggunakan protected, short-lived preview link dan tidak diindeks search engine.
- Publish/schedule action transactional terhadap revision/status.
- Publish menghasilkan content version/event untuk cache/CDN invalidation.
- Public render tidak menampilkan half-published relations atau media processing yang belum sukses.
- Rollback/restore menghasilkan published revision baru dan invalidation baru.

## 10. Archive dan deletion

- Published/referenced content atau media tidak dapat hard-delete langsung.
- Gunakan unpublish/archive terlebih dahulu.
- Sistem menampilkan semua references sebelum purge.
- Purge mengikuti permission, retention/rights requirement, audit, dan storage cleanup job.
- Historical booking/policy/invoice reference tidak boleh rusak akibat penghapusan CMS master.

## 11. Roles dan permission

Permission granular minimal:

- Edit content.
- Upload/manage media.
- Review content.
- Publish/unpublish/schedule.
- Manage policy/trust source.
- Override production-readiness rule.
- Archive/purge.

Owner/Super Admin menetapkan publisher/approval policy. Audit mencatat preview-token creation, publish, policy/trust changes, override, archive, dan purge.

## 12. Phase delivery

Phase 1:

- Core page/room content dan amenity relation.
- Indonesia/English fields dan fallback.
- Draft/review/publish, revision history, dan protected preview.
- Image upload/processing, ordering, authentic/placeholder classification.
- Policy version/effective date dan booking snapshot.
- Basic production-readiness checklist.

Phase 2:

- Gallery/video/menu/service/tour CMS lengkap.
- Scheduled publishing, completeness dashboard, advanced reusable sections.
- Trust-content provenance workflow dan richer media rights management.
- Bulk operation/import serta content reporting.

## 13. Minimum acceptance tests

- CMS copy tidak dapat mengubah operational capacity/rate/availability.
- Draft/In Review content tidak muncul di public page.
- Published bilingual content menampilkan locale benar atau fallback utuh.
- Translation key/empty required field tidak pernah tampil publik.
- Media gagal processing tidak dapat menjadi public hero.
- Satu asset dapat direlasikan ke beberapa entity tanpa duplicate file.
- Room production readiness menolak missing authentic hero/minimum photo set sesuai rule.
- Stock/placeholder tidak tampil sebagai final room representation.
- Perubahan master price/capacity langsung konsisten pada public operational display tanpa copy divergence.
- Booking lama tetap menunjuk policy version/snapshot yang berlaku saat dibuat.
- Trust claim tanpa provenance/verification tidak dapat published sebagai verified fact.
- Restore content membuat revision baru dan tidak menghapus histori.
- Referenced media tidak dapat hard-delete tanpa archive/reference resolution dan permission.
- Publish/rollback melakukan cache invalidation dan tidak menghasilkan half-published page.
