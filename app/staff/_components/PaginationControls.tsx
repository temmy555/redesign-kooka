"use client";

import { KookaSelect } from "./FormControls";
import { usePathname, useRouter } from "next/navigation";
import {
  pageNumbers,
  type PaginationMeta,
} from "../../../src/platform/pagination";
import styles from "../staff.module.css";

export default function PaginationControls({
  pagination,
  pageSizes,
  onPageChange,
  onPageSizeChange,
  pageParam = "page",
  pageSizeParam = "pageSize",
}: {
  pagination: PaginationMeta;
  pageSizes: readonly number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageParam?: string;
  pageSizeParam?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  if (pagination.totalItems === 0) return null;
  const pages = pageNumbers(pagination.page, pagination.totalPages);
  function navigate(page: number, pageSize = pagination.pageSize) {
    const next = new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    );
    next.set(pageParam, String(page));
    next.set(pageSizeParam, String(pageSize));
    router.replace(`${pathname}?${next.toString()}`);
  }
  function changePage(page: number) {
    if (onPageChange) onPageChange(page);
    else navigate(page);
  }
  function changePageSize(pageSize: number) {
    if (onPageSizeChange) onPageSizeChange(pageSize);
    else navigate(1, pageSize);
  }
  return (
    <nav aria-label="Navigasi halaman" className={styles.paginationBar}>
      <span className={styles.paginationSummary}>
        {pagination.from}–{pagination.to} dari {pagination.totalItems} data
      </span>
      <div className={styles.paginationSize}>
        <span>Baris</span>
        <KookaSelect
          ariaLabel="Jumlah baris per halaman"
          onChange={(value) => changePageSize(Number(value))}
          options={pageSizes.map((size) => ({
            value: String(size),
            label: String(size),
          }))}
          value={String(pagination.pageSize)}
        />
      </div>
      {pagination.totalPages > 1 ? (
        <div className={styles.paginationPages}>
          <button
            disabled={pagination.page === 1}
            onClick={() => changePage(pagination.page - 1)}
            type="button"
          >
            Sebelumnya
          </button>
          {pages.map((page, index) => {
            const previous = pages[index - 1];
            return (
              <span key={page}>
                {previous && page - previous > 1 ? <i>…</i> : null}
                <button
                  aria-current={page === pagination.page ? "page" : undefined}
                  className={
                    page === pagination.page ? styles.paginationCurrent : ""
                  }
                  onClick={() => changePage(page)}
                  type="button"
                >
                  {page}
                </button>
              </span>
            );
          })}
          <button
            disabled={pagination.page === pagination.totalPages}
            onClick={() => changePage(pagination.page + 1)}
            type="button"
          >
            Berikutnya
          </button>
        </div>
      ) : null}
    </nav>
  );
}
