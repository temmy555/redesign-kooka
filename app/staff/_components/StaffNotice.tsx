"use client";

import { useEffect } from "react";

import styles from "../staff.module.css";

export type StaffNoticeMessage = {
  tone: "success" | "error";
  message: string;
} | null;

export default function StaffNotice({
  notice,
  onDismiss,
}: {
  notice: StaffNoticeMessage;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!notice) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", closeOnEscape);
    const timeout =
      notice.tone === "success"
        ? window.setTimeout(onDismiss, 4_000)
        : undefined;
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      if (timeout) window.clearTimeout(timeout);
    };
  }, [notice, onDismiss]);

  if (!notice) return null;
  const success = notice.tone === "success";
  return (
    <div
      className={styles.staffNoticeOverlay}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onDismiss();
      }}
    >
      <section
        aria-describedby="staff-notice-message"
        aria-labelledby="staff-notice-title"
        aria-live="assertive"
        aria-modal="true"
        className={`${styles.staffNoticeDialog} ${
          success ? styles.staffNoticeSuccess : styles.staffNoticeError
        }`}
        role="alertdialog"
      >
        <span aria-hidden="true" className={styles.staffNoticeIcon}>
          {success ? "✓" : "!"}
        </span>
        <div className={styles.staffNoticeCopy}>
          <strong id="staff-notice-title">
            {success ? "Berhasil" : "Tidak dapat diproses"}
          </strong>
          <p id="staff-notice-message">{notice.message}</p>
        </div>
        <button autoFocus onClick={onDismiss} type="button">
          Tutup
        </button>
      </section>
    </div>
  );
}
