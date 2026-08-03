"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { KookaSelect } from "./FormControls";
import styles from "../staff.module.css";

export default function FnbHistoryFilters({
  initialSearch,
  initialStatus,
}: {
  initialSearch: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  function apply(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    );
    if (search.trim()) next.set("search", search.trim());
    else next.delete("search");
    if (status === "ALL") next.delete("status");
    else next.set("status", status);
    next.set("page", "1");
    router.replace(`${pathname}?${next.toString()}`);
  }
  return (
    <form className={styles.historyFilters} onSubmit={apply}>
      <input
        aria-label="Cari pesanan F&B"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Cari kode, formulir, atau customer"
        type="search"
        value={search}
      />
      <KookaSelect
        ariaLabel="Filter status pesanan F&B"
        onChange={setStatus}
        options={[
          { value: "ALL", label: "Semua status" },
          { value: "ENTERED", label: "Baru masuk" },
          { value: "ACCEPTED", label: "Diterima" },
          { value: "PREPARING", label: "Disiapkan" },
          { value: "READY", label: "Siap disajikan" },
          { value: "SERVED", label: "Disajikan" },
          { value: "COMPLETED", label: "Selesai" },
          { value: "CANCELLED", label: "Dibatalkan" },
        ]}
        value={status}
      />
      <button className={styles.secondaryButton} type="submit">
        Terapkan
      </button>
    </form>
  );
}
