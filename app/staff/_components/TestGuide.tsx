"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import styles from "../staff.module.css";

type Step = {
  id: string;
  actor: string;
  title: string;
  menu: string;
  href?: string;
  actions: string[];
  expected: string[];
  fixture?: string;
  note?: string;
};

type Flow = {
  id: string;
  title: string;
  description: string;
  steps: Step[];
};

const flows: Flow[] = [
  {
    id: "prepare",
    title: "1. Persiapan lingkungan dan master",
    description:
      "Dikerjakan sekali sebelum menguji transaksi. Gunakan akun Owner.",
    steps: [
      {
        id: "prepare-uat",
        actor: "Laptop / terminal",
        title: "Siapkan database UAT terpisah",
        menu: "Sebelum membuka aplikasi",
        actions: [
          "Jalankan npm run uat:prepare.",
          "Jalankan npm run uat:verify.",
          "Jalankan npm run dev:uat lalu buka http://localhost:3100/staff/login.",
          "Baca akun sintetis pada .data/uat/credentials.json. Jangan menyalin password ke screenshot.",
        ],
        expected: [
          "Server berjalan pada port 3100.",
          "Dataset memiliki kamar 1–6, BAR-UAT, empat booking, tiga pembayaran, cleaning task, dan dua menu F&B.",
        ],
      },
      {
        id: "owner-login",
        actor: "Owner",
        title: "Login dan periksa hak akses",
        menu: "Login → Hari ini",
        href: "/staff",
        actions: [
          "Login memakai akun OWNER dari credentials.json.",
          "Pastikan menu Front Office, Pantauan kamar, Housekeeping, F&B, Pengaturan, dan Panduan test terlihat.",
        ],
        expected: [
          "Tidak ada MFA.",
          "Dashboard harian tampil tanpa pesan akses dibatasi.",
        ],
      },
      {
        id: "room-master",
        actor: "Owner",
        title: "Uji jenis kamar, nomor kamar, dan extra bed",
        menu: "Pengaturan → Kamar",
        href: "/staff/admin",
        actions: [
          "Tambahkan jenis kamar TEST FAMILY dengan nama Indonesia/English dan kapasitas.",
          "Aktifkan opsi extra bed, isi maksimum dan tambahan kapasitas.",
          "Tambahkan nomor kamar 7 lalu pilih TEST FAMILY.",
          "Ubah jenis kamar 7 ke Deluxe UAT, kemudian periksa tabel Master kamar.",
          "Tambahkan resource EXTRA_BED bila belum tersedia.",
        ],
        expected: [
          "Jenis baru langsung aktif dan tersedia pada dropdown nomor kamar serta booking.",
          "Kamar tetap memakai nomor tunggal; jenisnya tercatat terpisah.",
          "Setiap perubahan meminta alasan dan muncul pada audit.",
        ],
      },
      {
        id: "commercial-master",
        actor: "Owner",
        title: "Uji harga, pajak, rekening, dan kebijakan",
        menu: "Pengaturan → Harga & pajak / Properti",
        href: "/staff/admin",
        actions: [
          "Buat profil tanpa pajak untuk kamar.",
          "Buat rate plan TEST-RATE untuk TEST FAMILY atau Deluxe UAT.",
          "Simpan rekening transfer sintetis, jangan rekening nyata saat UAT.",
          "Simpan kebijakan pembatalan/refund bilingual.",
          "Pada tab Properti, simpan check-in 14:00, checkout 12:00, deadline pembayaran 60 menit, dan harga extra bed.",
        ],
        expected: [
          "Rate plan tampil aktif dan dapat dipilih Front Office.",
          "Semua transaksi tetap IDR; USD/AUD hanya estimasi tampilan.",
        ],
      },
    ],
  },
  {
    id: "online-booking",
    title: "2. Website publik dan booking online",
    description: "Simulasikan perjalanan customer tanpa login akun.",
    steps: [
      {
        id: "landing",
        actor: "Customer",
        title: "Cari kamar dari landing page",
        menu: "Website publik → form pencarian hero",
        href: "/",
        actions: [
          "Ganti bahasa Indonesia/English dan currency IDR/USD/AUD.",
          "Pilih check-in, check-out, jumlah tamu, dan jumlah kamar.",
          "Cari ketersediaan lalu pilih tipe kamar dan rate plan.",
          "Isi data pemesan dan buat booking online.",
        ],
        expected: [
          "Dropdown/kalender tidak terpotong pada desktop maupun mobile.",
          "Nomor kamar tidak diperlihatkan kepada customer.",
          "Booking online meminta pembayaran penuh 100% dalam IDR.",
          "Customer memperoleh kode booking dan instruksi transfer.",
        ],
        note: "Jika alur checkout publik belum muncul dari landing, catat sebagai defect High karena ini jalur booking utama.",
      },
      {
        id: "customer-return",
        actor: "Customer",
        title: "Buka kembali booking tanpa login",
        menu: "Website publik → Cari booking",
        actions: [
          "Masukkan kode booking dan email yang sama.",
          "Periksa status pembayaran dan instruksi transfer.",
        ],
        expected: [
          "Booking ditemukan tanpa password/customer account.",
          "Data sensitif customer lain tidak terlihat.",
        ],
        fixture:
          "Alternatif fixture: UAT-UNPAID + email unpaid.uat@example.invalid.",
      },
    ],
  },
  {
    id: "front-office",
    title: "3. Booking manual, pembayaran, dan check-in",
    description:
      "Jalankan sebagai Front Office; Owner dapat mengamati audit dan pantauan kamar.",
    steps: [
      {
        id: "manual-booking",
        actor: "Front Office",
        title: "Buat booking manual multi-room",
        menu: "Front Office → Booking",
        href: "/staff/front-office",
        actions: [
          "Login akun FRONT_OFFICE.",
          "Pilih tanggal, rate plan, lalu tambahkan dua tipe/kamar pada satu booking.",
          "Isi dewasa, anak, extra bed, data pemesan, dan metode pembayaran manual.",
          "Uji deposit nominal/persentase; booking online tidak boleh memakai opsi ini.",
          "Klik cek harga & ketersediaan, kemudian buat booking.",
        ],
        expected: [
          "Satu kode booking memiliki beberapa room line.",
          "Booking boleh belum dialokasikan ke nomor kamar.",
          "Harga tersimpan sebagai snapshot dan tidak berubah saat master rate diedit.",
        ],
      },
      {
        id: "payment",
        actor: "Front Office",
        title: "Catat dan verifikasi pembayaran manual",
        menu: "Front Office → Pembayaran",
        href: "/staff/front-office",
        actions: [
          "Pilih booking baru atau UAT-INHOUSE.",
          "Catat transfer/cash dengan nominal IDR dan referensi.",
          "Pilih pembayaran pending lalu verifikasi; ulangi dengan pembayaran lain dan pilih Tolak.",
        ],
        expected: [
          "Status reservation, stay, dan payment tetap terpisah.",
          "Nominal tidak menerima huruf.",
          "Verifikasi dan penolakan tercatat pada audit.",
        ],
        fixture: "Fixture verifikasi: PAY-UAT-REVIEW.",
      },
      {
        id: "assign-checkin",
        actor: "Front Office",
        title: "Alokasikan nomor kamar dan check-in",
        menu: "Front Office → Check-in & kamar",
        href: "/staff/front-office",
        actions: [
          "Pilih UAT-ARRIVAL atau booking yang sudah dibayar.",
          "Pilih nomor kamar yang sesuai, isi alasan, lalu Alokasikan pertama kali.",
          "Pilih aksi Check-in dan simpan.",
          "Pada tablet, uji KTP/foto/signature satu per satu; lalu uji opsi Declined/Skipped karena semuanya opsional.",
        ],
        expected: [
          "Stay menjadi in house.",
          "Pantauan kamar menampilkan nomor, status occupied, dan nama tamu.",
          "File identitas/signature disimpan privat; check-in tetap dapat selesai saat capture dilewati.",
        ],
        fixture: "Fixture: UAT-ARRIVAL.",
      },
      {
        id: "room-move",
        actor: "Front Office",
        title: "Pindah kamar dan konflik inventory",
        menu: "Front Office → Check-in & kamar",
        href: "/staff/front-office",
        actions: [
          "Pindahkan tamu in-house ke kamar kosong dengan opsi tanpa perubahan harga.",
          "Ulangi skenario dengan tambahan charge atau credit harga.",
          "Coba pilih kamar occupied/blocked untuk memastikan sistem menolak.",
        ],
        expected: [
          "Assignment lama ditutup, assignment baru aktif.",
          "Cleaning task ROOM_MOVE dibuat untuk kamar lama.",
          "Perlakuan harga dan alasan tercatat.",
        ],
        fixture: "Fixture: UAT-INHOUSE.",
      },
    ],
  },
  {
    id: "during-stay",
    title: "4. Operasional selama tamu menginap",
    description:
      "Cleaning, maintenance, F&B, dan pantauan kamar memakai booking/folio yang sama.",
    steps: [
      {
        id: "guest-cleaning",
        actor: "Cleaning",
        title: "Tamu pergi dan meminta kamar dibersihkan",
        menu: "Housekeeping → Buat cleaning task",
        href: "/staff/housekeeping",
        actions: [
          "Login akun CLEANING.",
          "Pilih kamar tamu, jenis Permintaan tamu, izin Tamu mengizinkan.",
          "Proses Assigned → In Progress → Cleaned → Inspected.",
        ],
        expected: [
          "Task mencatat GUEST_REQUEST dan izin masuk.",
          "Stay/payment tidak berubah.",
          "Housekeeping kamar menjadi inspected setelah pemeriksaan.",
        ],
      },
      {
        id: "unable-cleaning",
        actor: "Cleaning",
        title: "Tidak dapat masuk / DND manual",
        menu: "Housekeeping → Update pekerjaan",
        href: "/staff/housekeeping",
        actions: [
          "Pilih task aktif.",
          "Pilih Tidak dapat masuk dan alasan Do not disturb atau akses ditolak.",
        ],
        expected: [
          "Status UNABLE_TO_ACCESS tersimpan tanpa menutup task secara diam-diam.",
        ],
      },
      {
        id: "maintenance",
        actor: "Cleaning / Owner",
        title: "Laporkan kerusakan kamar",
        menu: "Housekeeping → Laporkan maintenance",
        href: "/staff/housekeeping",
        actions: [
          "Pilih kamar, severity, dan dampak Blocked/Out of order.",
          "Proses Triaged → In Progress → Resolved → Verified.",
        ],
        expected: [
          "Kamar tidak tersedia untuk booking saat diblokir.",
          "Saat verified dan return to service, kamar kembali dapat dipakai sesuai status cleaning.",
        ],
      },
      {
        id: "fnb-room",
        actor: "F&B / Front Office",
        title: "Masukkan satu kertas berisi banyak menu ke folio kamar",
        menu: "F&B → Masukkan pesanan kertas",
        href: "/staff/fnb",
        actions: [
          "Login akun FNB.",
          "Pilih Bebankan ke kamar dan tamu in-house.",
          "Tambahkan Nasi Goreng UAT dan Teh UAT dalam satu formulir.",
          "Simpan lalu proses Accepted → Preparing → Ready → Served → Completed.",
        ],
        expected: [
          "Nomor formulir otomatis YYMMDDNN dan unik.",
          "Kedua menu berada pada satu order.",
          "Setiap line masuk folio yang sama dengan tax snapshot.",
        ],
      },
      {
        id: "fnb-standalone",
        actor: "F&B",
        title: "Pesanan standalone dan pembatalan",
        menu: "F&B",
        href: "/staff/fnb",
        actions: [
          "Buat order Standalone dan isi nama customer.",
          "Catat pembayaran sebesar total order dan terbitkan kuitansi.",
          "Buat order kedua lalu batalkan dengan alasan.",
        ],
        expected: [
          "Pembayaran harus sama dengan total.",
          "Order berbayar memiliki receipt.",
          "Pembatalan tidak menghapus jejak transaksi.",
        ],
      },
    ],
  },
  {
    id: "departure",
    title: "5. Folio, checkout, refund, dan laporan",
    description:
      "Selesaikan masa inap tanpa mencampur status stay, payment, dan refund.",
    steps: [
      {
        id: "folio-doc",
        actor: "Front Office",
        title: "Terbitkan invoice gabungan dan room-only",
        menu: "Front Office → Folio & dokumen",
        href: "/staff/front-office",
        actions: [
          "Pilih folio UAT-INHOUSE/DUEOUT.",
          "Terbitkan invoice Combined.",
          "Terbitkan dokumen Room only dan bandingkan room line yang sama.",
        ],
        expected: [
          "Combined mencakup room, F&B, damage, discount/payment sesuai coverage.",
          "Room-only tidak mengubah harga room line.",
          "Tax tiap layanan mengikuti snapshot masing-masing, bukan jenis invoice.",
        ],
      },
      {
        id: "damage-refund",
        actor: "Front Office",
        title: "Tambah biaya kerusakan dan refund manual",
        menu: "Front Office → Folio & dokumen",
        href: "/staff/front-office",
        actions: [
          "Isi barang rusak, nominal, dan alasan lalu tambahkan ke folio.",
          "Buat refund manual dengan nominal dan tujuan rekening sintetis.",
        ],
        expected: [
          "Damage menjadi debit folio.",
          "Refund berstatus request/pending dan tidak dianggap selesai sebelum transfer manual dicatat.",
        ],
        note: "Penyelesaian transfer refund melalui UI masih termasuk gap aktif; bila tombol completion belum tersedia, tandai BLOCKED, bukan PASS.",
      },
      {
        id: "checkout",
        actor: "Front Office + Cleaning",
        title: "Checkout fleksibel dan turnover",
        menu: "Front Office → Check-in & kamar",
        href: "/staff/front-office",
        actions: [
          "Pilih UAT-DUEOUT.",
          "Pilih Checkout, isi alasan, dan simpan.",
          "Login Cleaning dan selesaikan task checkout sampai Inspected.",
        ],
        expected: [
          "Stay menjadi checked out.",
          "Kamar vacant tetapi dirty sampai cleaning selesai.",
          "Kamar baru siap dijual setelah inspected.",
        ],
      },
      {
        id: "noshow",
        actor: "Front Office",
        title: "No-show tetapi kamar tetap ditahan",
        menu: "Front Office → Check-in & kamar",
        href: "/staff/front-office",
        actions: [
          "Tandai booking guaranteed sebagai no-show.",
          "Pastikan kamar belum dilepas.",
          "Uji Reopen no-show bila tamu datang tengah malam, lalu uji Release no-show secara manual.",
        ],
        expected: [
          "Mark no-show tidak otomatis menjual kamar ke tamu lain.",
          "Release adalah keputusan terpisah dan tercatat.",
        ],
      },
      {
        id: "report-audit",
        actor: "Owner",
        title: "Reconciliation, export, dan audit",
        menu: "Pengaturan → Laporan / Staf & audit",
        href: "/staff/admin",
        actions: [
          "Jalankan reconciliation untuk business date hari ini.",
          "Jalankan daily rollover sekali.",
          "Export booking, ledger, cleaning, dan reconciliation CSV.",
          "Periksa audit untuk room move, payment, master, F&B, dan refund.",
        ],
        expected: [
          "Tidak ada critical exception.",
          "CSV tidak membuka data sensitif berlebihan.",
          "Audit memuat actor, action, target, waktu, hasil, dan alasan.",
        ],
      },
    ],
  },
  {
    id: "cms-quality",
    title: "6. CMS, role, responsive, dan negative test",
    description:
      "Validasi pengalaman publik, batas permission, dan perilaku gagal.",
    steps: [
      {
        id: "cms",
        actor: "Owner",
        title: "Konten bilingual, media asli, dan menu",
        menu: "Pengaturan → Konten & menu",
        href: "/staff/admin",
        actions: [
          "Upload JPEG/PNG asli dengan alt text ID/EN dan sumber hak penggunaan.",
          "Buat kategori menu.",
          "Preview dan publish landing page lalu buka website publik.",
        ],
        expected: [
          "Tidak ada copy placeholder/unverified pada website.",
          "Foto asli dan alt text tampil.",
          "Menu/harga tampil; transaksi resmi tetap IDR.",
        ],
        note: "Pembuatan item menu serta publish/link/archive media masih perlu dicek; bila kontrol belum ada, catat BLOCKED.",
      },
      {
        id: "rbac",
        actor: "Owner + semua role",
        title: "Batas menu dan permission per role",
        menu: "Pengaturan → Staf & audit",
        href: "/staff/admin",
        actions: [
          "Berikan/cabut role pada akun sintetis dengan alasan.",
          "Login ulang sebagai Front Office, Cleaning, dan F&B.",
          "Coba membuka URL menu role lain secara langsung.",
        ],
        expected: [
          "Menu mengikuti role.",
          "Akses URL/API tanpa permission ditolak server, bukan hanya disembunyikan.",
          "Perubahan role tercatat di audit.",
        ],
      },
      {
        id: "responsive",
        actor: "Semua role",
        title: "Tablet, mobile, keyboard, dan error state",
        menu: "Semua halaman",
        actions: [
          "Uji desktop, lebar tablet, dan mobile.",
          "Buka dropdown/datepicker dekat tepi layar.",
          "Uji navigasi keyboard dan Escape pada dialog.",
          "Matikan koneksi saat submit lalu pastikan tidak terjadi transaksi ganda ketika diulang.",
        ],
        expected: [
          "Tidak ada popover terpotong atau kontrol native yang tidak konsisten.",
          "Focus terlihat dan dialog dapat ditutup.",
          "Error tampil di dalam aplikasi dan retry idempotent.",
        ],
      },
      {
        id: "attendance",
        actor: "Staff + Owner",
        title: "Absensi selfie dan geofence",
        menu: "Belum tersedia pada navigasi",
        actions: [
          "Jangan beri PASS sebelum route staff attendance, kamera selfie, geofence, history, dan admin monitor tersedia.",
        ],
        expected: [
          "Status saat ini: BLOCKED — implementasi UI/API attendance belum selesai dan koordinat/shift resmi belum diberikan.",
        ],
        note: "Fitur ini disetujui tetapi bukan bagian dataset Phase 1A. Jangan menganggap schema database saja sebagai fitur selesai.",
      },
    ],
  },
];

const storageKey = "kooka-uat-progress-v2";

export default function TestGuide() {
  const [done, setDone] = useState<string[]>([]);
  const [activeFlow, setActiveFlow] = useState(flows[0]!.id);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const timer = window.setTimeout(
            () => setDone(parsed.filter((item) => typeof item === "string")),
            0,
          );
          return () => window.clearTimeout(timer);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    return undefined;
  }, []);

  const allSteps = flows.flatMap((flow) => flow.steps);
  const visibleFlows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    if (!normalized) return flows.filter((flow) => flow.id === activeFlow);
    return flows
      .map((flow) => ({
        ...flow,
        steps: flow.steps.filter((step) =>
          [step.title, step.actor, step.menu, ...step.actions, ...step.expected]
            .join(" ")
            .toLocaleLowerCase("id-ID")
            .includes(normalized),
        ),
      }))
      .filter((flow) => flow.steps.length);
  }, [activeFlow, query]);

  function toggle(id: string) {
    setDone((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  const progress = Math.round(
    (done.filter((id) => allSteps.some((step) => step.id === id)).length /
      allSteps.length) *
      100,
  );

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>UAT end-to-end</span>
          <h1>Panduan test</h1>
          <p>
            Ikuti urutan dari persiapan master sampai checkout. Centang hanya
            setelah hasil aktual sesuai.
          </p>
        </div>
        <div
          className={styles.testProgress}
          aria-label={`Progres ${progress}%`}
        >
          <strong>{progress}%</strong>
          <span>
            {done.length} / {allSteps.length} skenario
          </span>
        </div>
      </header>

      <section className={styles.testGuideIntro}>
        <div>
          <strong>Aturan sederhana</strong>
          <p>
            PASS bila seluruh hasil sesuai. Jika tombol belum ada, pilih BLOCKED
            di catatan Anda. Jika hasil salah, catat defect beserta role,
            halaman, data, expected, actual, dan screenshot tanpa password/KTP.
          </p>
        </div>
        <label>
          Cari skenario
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Contoh: refund, room move, F&B…"
          />
        </label>
      </section>

      <nav className={styles.testFlowNav} aria-label="Tahapan UAT">
        {flows.map((flow) => {
          const complete = flow.steps.every((step) => done.includes(step.id));
          return (
            <button
              className={
                activeFlow === flow.id && !query ? styles.testFlowActive : ""
              }
              key={flow.id}
              onClick={() => {
                setActiveFlow(flow.id);
                setQuery("");
              }}
              type="button"
            >
              <span>{complete ? "✓" : flow.title.split(".")[0]}</span>
              {flow.title.replace(/^\d+\.\s*/u, "")}
            </button>
          );
        })}
      </nav>

      <div className={styles.testFlowStack}>
        {visibleFlows.map((flow) => (
          <section key={flow.id}>
            <div className={styles.testFlowHeading}>
              <h2>{flow.title}</h2>
              <p>{flow.description}</p>
            </div>
            <div className={styles.testStepList}>
              {flow.steps.map((step, index) => {
                const checked = done.includes(step.id);
                return (
                  <article
                    className={`${styles.testStep} ${checked ? styles.testStepDone : ""}`}
                    key={step.id}
                  >
                    <button
                      aria-label={`${checked ? "Batalkan selesai" : "Tandai selesai"}: ${step.title}`}
                      className={styles.testCheck}
                      onClick={() => toggle(step.id)}
                      type="button"
                    >
                      {checked ? "✓" : String(index + 1).padStart(2, "0")}
                    </button>
                    <div className={styles.testStepBody}>
                      <div className={styles.testStepHeader}>
                        <div>
                          <span>{step.actor}</span>
                          <h3>{step.title}</h3>
                          <small>{step.menu}</small>
                        </div>
                        {step.href ? (
                          <Link href={step.href}>Buka halaman →</Link>
                        ) : null}
                      </div>
                      {step.fixture ? (
                        <p className={styles.testFixture}>{step.fixture}</p>
                      ) : null}
                      <div className={styles.testColumns}>
                        <div>
                          <strong>Yang dilakukan</strong>
                          <ol>
                            {step.actions.map((action) => (
                              <li key={action}>{action}</li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <strong>Hasil yang harus terlihat</strong>
                          <ul>
                            {step.expected.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {step.note ? (
                        <p className={styles.testWarning}>{step.note}</p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className={styles.testGuideFooter}>
        <p>
          Checklist disimpan hanya di browser ini dan tidak mengubah transaksi.
        </p>
        <button
          onClick={() => {
            setDone([]);
            window.localStorage.removeItem(storageKey);
          }}
          type="button"
        >
          Reset checklist lokal
        </button>
      </div>
    </>
  );
}
