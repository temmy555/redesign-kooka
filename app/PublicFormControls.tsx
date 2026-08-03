"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export type PublicSelectOption = {
  value: string;
  label: string;
  description?: string;
};

export function PublicSelect({
  ariaLabel,
  name,
  onChange,
  options,
  value,
  variant = "booking",
}: {
  ariaLabel: string;
  name?: string;
  onChange: (value: string) => void;
  options: PublicSelectOption[];
  value: string;
  variant?: "booking" | "compact";
}) {
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const selected = options.find((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );

  useEffect(() => {
    function close(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function openMenu() {
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(
        Math.max(rect.width, variant === "compact" ? 112 : 150),
        window.innerWidth - 24,
      );
      const estimatedHeight = Math.min(options.length * 52 + 16, 320);
      const placeBelow =
        rect.bottom + 12 + estimatedHeight <= window.innerHeight ||
        rect.top < estimatedHeight + 12;
      setMenuStyle({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: placeBelow
          ? Math.min(
              rect.bottom + 12,
              window.innerHeight - estimatedHeight - 12,
            )
          : Math.max(12, rect.top - estimatedHeight - 12),
        width,
      });
    }
    setOpen(true);
  }

  function choose(option: PublicSelectOption) {
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      openMenu();
      return;
    }
    if (event.key === "ArrowDown") {
      setActiveIndex((current) => Math.min(current + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (options[activeIndex]) {
      choose(options[activeIndex]);
    }
  }

  return (
    <div className={`public-select public-select--${variant}`} ref={wrapperRef}>
      {name ? <input name={name} type="hidden" value={value} /> : null}
      <button
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`public-select-trigger ${open ? "is-open" : ""}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        type="button"
      >
        <span>{selected?.label ?? value}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-label={ariaLabel}
              className="public-select-menu"
              id={listboxId}
              ref={menuRef}
              role="listbox"
              style={menuStyle}
            >
              {options.map((option, index) => (
                <button
                  aria-selected={option.value === value}
                  className={`public-select-option ${index === activeIndex ? "is-active" : ""}`}
                  key={option.value}
                  onClick={() => choose(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  <span>
                    <strong>{option.label}</strong>
                    {option.description ? (
                      <small>{option.description}</small>
                    ) : null}
                  </span>
                  {option.value === value ? <b aria-hidden="true">✓</b> : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
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

export function PublicDateField({
  ariaLabel,
  locale,
  max,
  min,
  name,
  onChange,
  value,
}: {
  ariaLabel: string;
  locale: "id" | "en";
  max?: string;
  min?: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const calendarId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const selected = parseIso(value);
  const [open, setOpen] = useState(false);
  const [calendarStyle, setCalendarStyle] = useState<CSSProperties>();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  const days = useMemo(() => monthDays(visibleMonth), [visibleMonth]);
  const localeTag = locale === "id" ? "id-ID" : "en-US";
  const weekdays =
    locale === "id"
      ? ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  useEffect(() => {
    function close(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !calendarRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const display = selected.toLocaleDateString(localeTag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="public-date" ref={wrapperRef}>
      <input name={name} type="hidden" value={value} />
      <button
        aria-controls={calendarId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${ariaLabel}: ${display}`}
        className={`public-date-trigger ${open ? "is-open" : ""}`}
        onClick={() => {
          setVisibleMonth(
            new Date(selected.getFullYear(), selected.getMonth(), 1),
          );
          const rect = wrapperRef.current?.getBoundingClientRect();
          if (rect) {
            const width = Math.min(340, window.innerWidth - 36);
            const estimatedHeight = Math.min(394, window.innerHeight - 36);
            const placeBelow =
              rect.bottom + 12 + estimatedHeight <= window.innerHeight ||
              rect.top < estimatedHeight + 12;
            setCalendarStyle({
              left: Math.max(
                18,
                Math.min(rect.left, window.innerWidth - width - 18),
              ),
              maxHeight: estimatedHeight,
              top: placeBelow
                ? Math.min(
                    rect.bottom + 12,
                    window.innerHeight - estimatedHeight - 18,
                  )
                : Math.max(18, rect.top - estimatedHeight - 12),
              width,
            });
          }
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
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-label={`${locale === "id" ? "Kalender" : "Calendar"} ${ariaLabel}`}
              className="public-calendar"
              id={calendarId}
              ref={calendarRef}
              role="dialog"
              style={calendarStyle}
            >
              <div className="public-calendar-header">
                <div>
                  <small>
                    {locale === "id" ? "Pilih tanggal" : "Choose date"}
                  </small>
                  <strong>
                    {visibleMonth.toLocaleDateString(localeTag, {
                      month: "long",
                      year: "numeric",
                    })}
                  </strong>
                </div>
                <div>
                  <button
                    aria-label={
                      locale === "id" ? "Bulan sebelumnya" : "Previous month"
                    }
                    onClick={() =>
                      setVisibleMonth(
                        (current) =>
                          new Date(
                            current.getFullYear(),
                            current.getMonth() - 1,
                            1,
                          ),
                      )
                    }
                    type="button"
                  >
                    ←
                  </button>
                  <button
                    aria-label={
                      locale === "id" ? "Bulan berikutnya" : "Next month"
                    }
                    onClick={() =>
                      setVisibleMonth(
                        (current) =>
                          new Date(
                            current.getFullYear(),
                            current.getMonth() + 1,
                            1,
                          ),
                      )
                    }
                    type="button"
                  >
                    →
                  </button>
                </div>
              </div>
              <div className="public-calendar-weekdays" aria-hidden="true">
                {weekdays.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="public-calendar-grid" role="grid">
                {days.map((day) => {
                  const dayIso = isoDate(day);
                  const outside = day.getMonth() !== visibleMonth.getMonth();
                  const disabled = Boolean(
                    (min && dayIso < min) || (max && dayIso > max),
                  );
                  return (
                    <button
                      aria-label={day.toLocaleDateString(localeTag, {
                        dateStyle: "full",
                      })}
                      aria-selected={dayIso === value}
                      className={`${outside ? "is-outside" : ""} ${dayIso === value ? "is-selected" : ""}`}
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
              <div className="public-calendar-footer">
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
                  {locale === "id" ? "Hari ini" : "Today"}
                </button>
                <span>{display}</span>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function nextPublicDate(value: string, days = 1) {
  const date = parseIso(value);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}
