"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PublicLocale } from "../../src/modules/content/contracts";
import {
  galleryCategoryLabel,
  type PublicGalleryCategory,
  type PublicGalleryItem,
} from "../../src/modules/content/public-gallery";
import KookaLogo from "../KookaLogo";

type GalleryFilter = "ALL" | PublicGalleryCategory;

export default function GalleryPage({
  items,
  locale,
}: {
  items: PublicGalleryItem[];
  locale: PublicLocale;
}) {
  const [filter, setFilter] = useState<GalleryFilter>("ALL");
  const [activeId, setActiveId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const categories = useMemo<GalleryFilter[]>(
    () => [
      "ALL",
      ...(
        ["ROOMS", "SPACES", "FACILITIES", "DINING", "VIDEOS"] as const
      ).filter((category) => items.some((item) => item.category === category)),
    ],
    [items],
  );
  const visibleItems = useMemo(
    () =>
      filter === "ALL"
        ? items
        : items.filter((item) => item.category === filter),
    [filter, items],
  );
  const activeIndex = activeId
    ? visibleItems.findIndex((item) => item.id === activeId)
    : -1;
  const activeItem = activeIndex >= 0 ? visibleItems[activeIndex] : null;

  const closeLightbox = useCallback(() => setActiveId(null), []);
  const showPrevious = useCallback(() => {
    if (activeIndex < 0 || visibleItems.length < 2) return;
    const previousIndex =
      (activeIndex - 1 + visibleItems.length) % visibleItems.length;
    setActiveId(visibleItems[previousIndex]?.id ?? null);
  }, [activeIndex, visibleItems]);
  const showNext = useCallback(() => {
    if (activeIndex < 0 || visibleItems.length < 2) return;
    const nextIndex = (activeIndex + 1) % visibleItems.length;
    setActiveId(visibleItems[nextIndex]?.id ?? null);
  }, [activeIndex, visibleItems]);

  useEffect(() => {
    if (!activeItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeItem, closeLightbox, showNext, showPrevious]);

  return (
    <main id="top" className="public-gallery-page">
      <header className="gallery-site-header">
        <a
          aria-label="KOOKA Residence home"
          className="gallery-brand"
          href={`/?locale=${locale}`}
        >
          <KookaLogo
            className="brand-logo gallery-brand-logo"
            priority
            sizes="146px"
          />
        </a>
        <div className="gallery-header-actions">
          <div className="gallery-language" aria-label="Language">
            <a
              className={locale === "en" ? "is-active" : undefined}
              href="/gallery?locale=en"
            >
              EN
            </a>
            <span aria-hidden="true" />
            <a
              className={locale === "id" ? "is-active" : undefined}
              href="/gallery?locale=id"
            >
              ID
            </a>
          </div>
          <a className="gallery-back-link" href={`/?locale=${locale}#gallery`}>
            ← {locale === "id" ? "Kembali ke KOOKA" : "Back to KOOKA"}
          </a>
        </div>
      </header>

      <section className="gallery-page-hero">
        <p className="gallery-page-eyebrow">
          {locale === "id" ? "Galeri KOOKA" : "The KOOKA gallery"}
        </p>
        <div>
          <h1>
            {locale === "id" ? (
              <>
                Ruang untuk berhenti <em>sejenak.</em>
              </>
            ) : (
              <>
                Spaces to pause <em>and breathe.</em>
              </>
            )}
          </h1>
          <p>
            {locale === "id"
              ? "Jelajahi kamar, taman, dan sudut-sudut tenang yang membentuk pengalaman menginap di KOOKA Residence."
              : "Explore the rooms, garden, and quiet corners that shape a stay at KOOKA Residence."}
          </p>
        </div>
      </section>

      <section className="gallery-browser" aria-labelledby="gallery-grid-title">
        <div className="gallery-browser-heading">
          <div>
            <p className="gallery-page-eyebrow">
              {items.length} {locale === "id" ? "momen" : "moments"}
            </p>
            <h2 id="gallery-grid-title">
              {locale === "id" ? "Lihat lebih dekat" : "A closer look"}
            </h2>
          </div>
          <div
            className="gallery-filters"
            aria-label={locale === "id" ? "Filter galeri" : "Gallery filters"}
          >
            {categories.map((category) => (
              <button
                aria-pressed={filter === category}
                className={filter === category ? "is-active" : undefined}
                key={category}
                onClick={() => {
                  setFilter(category);
                  setActiveId(null);
                }}
                type="button"
              >
                {galleryCategoryLabel(category, locale)}
              </button>
            ))}
          </div>
        </div>

        {visibleItems.length ? (
          <div className="gallery-masonry">
            {visibleItems.map((item, index) => (
              <button
                aria-label={`${locale === "id" ? "Buka" : "Open"} ${item.caption}`}
                className={`gallery-tile gallery-tile-${(index % 6) + 1}`}
                key={item.id}
                onClick={() => setActiveId(item.id)}
                type="button"
              >
                <Image
                  alt={item.alt}
                  fill
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                  src={
                    item.kind === "VIDEO" ? item.poster || item.src : item.src
                  }
                />
                <span className="gallery-tile-shade" aria-hidden="true" />
                {item.kind === "VIDEO" ? (
                  <span className="gallery-play-mark" aria-hidden="true">
                    ▶
                  </span>
                ) : null}
                <span className="gallery-tile-meta">
                  <small>{galleryCategoryLabel(item.category, locale)}</small>
                  <strong>{item.caption}</strong>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="gallery-empty">
            {locale === "id"
              ? "Belum ada media yang dipublikasikan untuk kategori ini."
              : "No published media is available in this category yet."}
          </p>
        )}
      </section>

      <section className="gallery-page-cta">
        <p className="gallery-page-eyebrow">KOOKA Residence Surabaya</p>
        <h2>
          {locale === "id"
            ? "Temukan kamar untuk Anda."
            : "Find your place to stay."}
        </h2>
        <a
          className="gallery-cta-button"
          href={`/?locale=${locale}#availability`}
        >
          {locale === "id" ? "Cek ketersediaan" : "Check availability"} →
        </a>
      </section>

      <footer className="gallery-page-footer">
        <KookaLogo className="brand-logo gallery-brand-logo" sizes="146px" />
        <p>© 2026 KOOKA Residence · Urban Tropical Retreat in Surabaya.</p>
      </footer>

      {activeItem ? (
        <div className="gallery-lightbox-shell">
          <button
            aria-label={locale === "id" ? "Tutup galeri" : "Close gallery"}
            className="gallery-lightbox-backdrop"
            onClick={closeLightbox}
            type="button"
          />
          <section
            aria-label={activeItem.caption}
            aria-modal="true"
            className="gallery-lightbox"
            onTouchEnd={(event) => {
              const start = touchStartX.current;
              touchStartX.current = null;
              if (start === null) return;
              const end = event.changedTouches[0]?.clientX;
              if (end === undefined || Math.abs(end - start) < 52) return;
              if (end < start) showNext();
              else showPrevious();
            }}
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0]?.clientX ?? null;
            }}
            role="dialog"
          >
            <button
              aria-label={locale === "id" ? "Tutup" : "Close"}
              className="gallery-lightbox-close"
              onClick={closeLightbox}
              ref={closeButtonRef}
              type="button"
            >
              ×
            </button>
            <div className="gallery-lightbox-media">
              {activeItem.kind === "VIDEO" ? (
                <video
                  autoPlay
                  controls
                  key={activeItem.id}
                  muted
                  playsInline
                  poster={activeItem.poster}
                  src={activeItem.src}
                />
              ) : (
                <Image
                  alt={activeItem.alt}
                  fill
                  priority
                  sizes="100vw"
                  src={activeItem.src}
                />
              )}
            </div>
            <div className="gallery-lightbox-caption">
              <span>
                {activeIndex + 1} / {visibleItems.length}
              </span>
              <div>
                <small>
                  {galleryCategoryLabel(activeItem.category, locale)}
                </small>
                <strong>{activeItem.caption}</strong>
              </div>
            </div>
            {visibleItems.length > 1 ? (
              <>
                <button
                  aria-label={
                    locale === "id" ? "Media sebelumnya" : "Previous media"
                  }
                  className="gallery-lightbox-nav is-previous"
                  onClick={showPrevious}
                  type="button"
                >
                  ←
                </button>
                <button
                  aria-label={
                    locale === "id" ? "Media berikutnya" : "Next media"
                  }
                  className="gallery-lightbox-nav is-next"
                  onClick={showNext}
                  type="button"
                >
                  →
                </button>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
