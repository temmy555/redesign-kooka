"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import styles from "../staff.module.css";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

function digitsOnly(value: string) {
  const trimmed = value.trim();
  const databaseDecimal = /^\d+\.\d{1,2}$/u.test(trimmed);
  const normalized = databaseDecimal
    ? String(Math.trunc(Number(trimmed)))
    : value;
  const digits = normalized.replace(/\D/gu, "");
  return digits.replace(/^0+(?=\d)/u, "");
}

function groupDigits(value: string) {
  return digitsOnly(value).replace(/\B(?=(\d{3})+(?!\d))/gu, ".");
}

export function MoneyInput({
  ariaLabel,
  disabled = false,
  onChange,
  placeholder = "0",
  required = false,
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <div className={styles.moneyControl}>
      <span aria-hidden="true">Rp</span>
      <input
        aria-label={ariaLabel}
        disabled={disabled}
        inputMode="numeric"
        onChange={(event) => onChange(digitsOnly(event.target.value))}
        placeholder={placeholder}
        required={required}
        type="text"
        value={groupDigits(value)}
      />
    </div>
  );
}

export function FileField({
  accept,
  capture,
  file,
  helper,
  label,
  onChange,
}: {
  accept: string;
  capture?: "environment" | "user";
  file: File | null;
  helper?: string;
  label: string;
  onChange: (file: File | null) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.fieldGroup}>
      <span>{label}</span>
      <input
        accept={accept}
        aria-label={label}
        capture={capture}
        className={styles.fileInputHidden}
        id={inputId}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        ref={inputRef}
        type="file"
      />
      <div className={styles.filePicker}>
        <button
          className={styles.filePickerButton}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5" />
          </svg>
          {file
            ? "Ganti file"
            : capture
              ? "Ambil atau pilih foto"
              : "Pilih file"}
        </button>
        <div className={styles.filePickerMeta}>
          <strong>{file?.name ?? "Belum ada file dipilih"}</strong>
          <small>
            {file
              ? `${Math.max(1, Math.round(file.size / 1024)).toLocaleString("id-ID")} KB`
              : (helper ?? "File belum dipilih")}
          </small>
        </div>
        {file ? (
          <button
            aria-label={`Hapus ${file.name}`}
            className={styles.filePickerClear}
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              onChange(null);
            }}
            type="button"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function MultiFileField({
  accept,
  files,
  helper,
  label,
  maximumFiles = 20,
  onChange,
}: {
  accept: string;
  files: File[];
  helper?: string;
  label: string;
  maximumFiles?: number;
  onChange: (files: File[]) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  return (
    <div className={styles.fieldGroup}>
      <span>{label}</span>
      <input
        accept={accept}
        aria-label={label}
        className={styles.fileInputHidden}
        id={inputId}
        multiple
        onChange={(event) =>
          onChange(Array.from(event.target.files ?? []).slice(0, maximumFiles))
        }
        ref={inputRef}
        type="file"
      />
      <div className={styles.filePicker}>
        <button
          className={styles.filePickerButton}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5" />
          </svg>
          {files.length ? "Ganti pilihan" : "Pilih beberapa foto"}
        </button>
        <div className={styles.filePickerMeta}>
          <strong>
            {files.length
              ? `${files.length} foto dipilih`
              : "Belum ada foto dipilih"}
          </strong>
          <small>
            {files.length
              ? `${Math.max(1, Math.round(totalSize / 1024)).toLocaleString("id-ID")} KB · maks. ${maximumFiles} foto`
              : (helper ?? `Maksimum ${maximumFiles} foto`)}
          </small>
        </div>
        {files.length ? (
          <button
            aria-label="Hapus semua foto terpilih"
            className={styles.filePickerClear}
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              onChange([]);
            }}
            type="button"
          >
            ×
          </button>
        ) : null}
      </div>
      {files.length ? (
        <small className={styles.fileSelectionSummary}>
          {files.map((file) => file.name).join(" · ")}
        </small>
      ) : null}
    </div>
  );
}

export function ActionDialog({
  children,
  confirmDisabled = false,
  confirmLabel = "Konfirmasi",
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  children?: ReactNode;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    function close(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onCancel, open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className={styles.dialogBackdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCancel();
      }}
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.actionDialog}
        role="dialog"
      >
        <div className={styles.dialogHeading}>
          <div>
            <small>Konfirmasi tindakan</small>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button aria-label="Tutup dialog" onClick={onCancel} type="button">
            ×
          </button>
        </div>
        {description ? (
          <p className={styles.dialogDescription}>{description}</p>
        ) : null}
        <div className={styles.dialogContent}>{children}</div>
        <div className={styles.dialogActions}>
          <button
            className={styles.secondaryButton}
            onClick={onCancel}
            type="button"
          >
            Kembali
          </button>
          <button
            className={styles.primaryButton}
            disabled={confirmDisabled}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function ReasonDialog({
  confirmLabel,
  description,
  label = "Alasan / catatan",
  minLength = 3,
  onCancel,
  onChange,
  onConfirm,
  open,
  title,
  value,
}: {
  confirmLabel?: string;
  description?: string;
  label?: string;
  minLength?: number;
  onCancel: () => void;
  onChange: (value: string) => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  value: string;
}) {
  return (
    <ActionDialog
      confirmDisabled={value.trim().length < minLength}
      confirmLabel={confirmLabel}
      description={description}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={open}
      title={title}
    >
      <label className={styles.dialogField}>
        {label}
        <textarea
          autoFocus
          maxLength={1_000}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Tuliskan alasan agar riwayat operasional tetap jelas…"
          value={value}
        />
        <small>{value.trim().length} / 1.000 karakter</small>
      </label>
    </ActionDialog>
  );
}

export function KookaSelect({
  ariaLabel,
  disabled = false,
  emptyMessage = "Belum ada pilihan tersedia",
  onChange,
  options,
  placeholder = "Pilih opsi",
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  emptyMessage?: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value: string;
}) {
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const enabledOptions = options.filter((option) => !option.disabled);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function openMenu() {
    if (disabled) return;
    const index = enabledOptions.findIndex((option) => option.value === value);
    setActiveIndex(Math.max(0, index));
    setOpen(true);
  }

  function choose(option: SelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
    }
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key))
        openMenu();
      return;
    }
    if (event.key === "ArrowDown") {
      setActiveIndex((current) =>
        Math.min(current + 1, enabledOptions.length - 1),
      );
    }
    if (event.key === "ArrowUp") {
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
    if (["Enter", " "].includes(event.key) && enabledOptions[activeIndex]) {
      choose(enabledOptions[activeIndex]);
    }
  }

  return (
    <div className={styles.selectControl} ref={wrapperRef}>
      <button
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`${styles.selectTrigger} ${open ? styles.selectTriggerOpen : ""}`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        type="button"
      >
        <span className={selected ? "" : styles.selectPlaceholder}>
          {selected?.label ?? placeholder}
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>
      {open ? (
        <div
          aria-label={ariaLabel}
          className={styles.selectMenu}
          id={listboxId}
          role="listbox"
        >
          {options.length === 0 ? (
            <p className={styles.selectEmpty}>{emptyMessage}</p>
          ) : (
            options.map((option) => {
              const enabledIndex = enabledOptions.findIndex(
                (item) => item.value === option.value,
              );
              const active = enabledIndex === activeIndex;
              const isSelected = option.value === value;
              return (
                <button
                  aria-selected={isSelected}
                  className={`${styles.selectOption} ${active ? styles.selectOptionActive : ""}`}
                  disabled={option.disabled}
                  key={option.value}
                  onClick={() => choose(option)}
                  onMouseEnter={() => {
                    if (enabledIndex >= 0) setActiveIndex(enabledIndex);
                  }}
                  role="option"
                  type="button"
                >
                  <span>
                    <strong>{option.label}</strong>
                    {option.description ? (
                      <small>{option.description}</small>
                    ) : null}
                  </span>
                  {isSelected ? <b aria-hidden="true">✓</b> : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function parseIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function DateField({
  ariaLabel,
  max,
  min,
  onChange,
  value,
}: {
  ariaLabel: string;
  max?: string;
  min?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const calendarId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = parseIso(value);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  const days = useMemo(() => monthDays(visibleMonth), [visibleMonth]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function changeMonth(offset: number) {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  const display = selected.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className={styles.dateControl} ref={wrapperRef}>
      <button
        aria-controls={calendarId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${ariaLabel}: ${display}`}
        className={`${styles.dateTrigger} ${open ? styles.dateTriggerOpen : ""}`}
        onClick={() => {
          setVisibleMonth(
            new Date(selected.getFullYear(), selected.getMonth(), 1),
          );
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        type="button"
      >
        <span>{display}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
        </svg>
      </button>
      {open ? (
        <div
          aria-label={`Kalender ${ariaLabel}`}
          className={styles.calendarPopover}
          id={calendarId}
          role="dialog"
        >
          <div className={styles.calendarHeader}>
            <div>
              <small>Pilih tanggal</small>
              <strong>
                {visibleMonth.toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                })}
              </strong>
            </div>
            <div>
              <button
                aria-label="Bulan sebelumnya"
                onClick={() => changeMonth(-1)}
                type="button"
              >
                ←
              </button>
              <button
                aria-label="Bulan berikutnya"
                onClick={() => changeMonth(1)}
                type="button"
              >
                →
              </button>
            </div>
          </div>
          <div className={styles.calendarWeekdays} aria-hidden="true">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className={styles.calendarGrid} role="grid">
            {days.map((day) => {
              const dayIso = isoDate(day);
              const outside = day.getMonth() !== visibleMonth.getMonth();
              const disabled = Boolean(
                (min && dayIso < min) || (max && dayIso > max),
              );
              return (
                <button
                  aria-label={day.toLocaleDateString("id-ID", {
                    dateStyle: "full",
                  })}
                  aria-selected={dayIso === value}
                  className={`${styles.calendarDay} ${outside ? styles.calendarDayOutside : ""} ${dayIso === value ? styles.calendarDaySelected : ""}`}
                  disabled={disabled}
                  key={dayIso}
                  onClick={() => {
                    onChange(dayIso);
                    setOpen(false);
                  }}
                  role="gridcell"
                  type="button"
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className={styles.calendarFooter}>
            <button
              onClick={() => {
                const today = isoDate(new Date());
                if ((!min || today >= min) && (!max || today <= max)) {
                  onChange(today);
                  setOpen(false);
                }
              }}
              type="button"
            >
              Hari ini
            </button>
            <span>{display}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function nextDate(value: string, days = 1) {
  const date = parseIso(value);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}
