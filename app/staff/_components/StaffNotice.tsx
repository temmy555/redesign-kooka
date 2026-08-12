"use client";

import { useEffect } from "react";

import styles from "../staff.module.css";

export type StaffNoticeMessage = {
  tone: "success" | "error";
  message: string;
} | null;

export function canDismissStaffNoticePassively(notice: StaffNoticeMessage) {
  return notice?.tone === "error";
}

export default function StaffNotice({
  notice,
  onDismiss,
}: {
  notice: StaffNoticeMessage;
  onDismiss: () => void;
}) {
  const passiveDismissalAllowed = canDismissStaffNoticePassively(notice);
  useEffect(() => {
    if (!passiveDismissalAllowed) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onDismiss, passiveDismissalAllowed]);

  if (!notice) return null;
  const success = notice.tone === "success";
  return (
    <div
      className={styles.staffNoticeOverlay}
      onMouseDown={(event) => {
        if (passiveDismissalAllowed && event.currentTarget === event.target)
          onDismiss();
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
          {success ? "OK" : "Tutup"}
        </button>
      </section>
    </div>
  );
}
