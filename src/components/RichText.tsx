import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus, X } from 'lucide-react';
import { normalizeMarkdownText, slugifyHeading as slugifyHeadingStable } from '../lib/markdown';
import { withBaseUrl } from '../lib/paths';

type RichTextSize = 'normal' | 'small';
type MediaOptions = {
  startPaused?: boolean;
  intervalMs?: number;
};

type MediaItem = { kind: 'image' | 'video'; alt: string; src: string };

type Block =
  | { type: 'heading'; level: 2 | 3; text: string; tocHidden?: boolean }
  | { type: 'image'; alt: string; src: string }
  | { type: 'video'; alt: string; src: string; media?: MediaOptions }
  | { type: 'carousel'; items: { kind: 'image' | 'video'; alt: string; src: string }[]; media?: MediaOptions }
  | { type: 'snippet'; id: string; caption?: string }
  | { type: 'youtube'; embedUrl: string }
  | { type: 'list'; items: string[] }
  | { type: 'spacer'; lines: number }
  | { type: 'paragraph'; text: string };

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  if (trimmed.startsWith('https://')) return true;
  if (trimmed.startsWith('http://')) return true;
  if (trimmed.startsWith('mailto:')) return true;
  return false;
}

function normalizeInputText(input: string): string {
  return normalizeMarkdownText(input);
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url.trim());
}

function parseMediaOptions(raw: string): MediaOptions | null {
  const inside = (raw || '').trim();
  if (!inside) return {};

  const pairs = inside.split(',').map((s) => s.trim()).filter(Boolean);
  const next: MediaOptions = {};

  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const key = pair.slice(0, eq).trim().toLowerCase();
    const value = pair.slice(eq + 1).trim().toLowerCase();

    if (key === 'start') {
      if (value === 'paused') next.startPaused = true;
      if (value === 'playing') next.startPaused = false;
      continue;
    }

    if (key === 'interval') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 500) next.intervalMs = Math.round(parsed);
      continue;
    }
  }

  return next;
}

function toYouTubeEmbedUrl(inputUrl: string): string | null {
  try {
    const u = new URL(inputUrl);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '');
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
    }

    if (host === 'youtube.com') {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
      }
      const embedMatch = u.pathname.match(/^\/embed\/([^/]+)$/);
      if (embedMatch) return `https://www.youtube.com/embed/${encodeURIComponent(embedMatch[1])}`;
    }
  } catch {
    // ignore
  }
  return null;
}

function parseBlocks(input: string): Block[] {
  const lines = normalizeInputText(input).split('\n');
  const blocks: Block[] = [];
  let pendingMedia: MediaOptions | null = null;

  let i = 0;
  const consumeParagraph = () => {
    const parts: string[] = [];
    const startIndex = i;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) break;
      if (/^#{2,3}!\s+/.test(line) || /^#{2,3}\s+/.test(line)) break;
      if (/^-\s+/.test(line)) break;
      if (/^!\[[^\]]*]\([^)]+\)\s*$/.test(line.trim())) break;
      parts.push(line);
      i += 1;
    }
    const text = parts.join('\n').trim();
    if (text) blocks.push({ type: 'paragraph', text });
    if (!text && i === startIndex) {
      // Avoid stalling on incomplete markdown tokens like "## " or "- ".
      i += 1;
    }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (!line.trim()) {
      let blanks = 0;
      while (i < lines.length && !lines[i].trim()) {
        blanks += 1;
        i += 1;
      }
      blocks.push({ type: 'spacer', lines: blanks });
      continue;
    }

    const h = line.match(/^(##|###)(!)?\s+(.+)$/);
    if (h) {
      const level = h[1] === '##' ? 2 : 3;
      const tocHidden = !!h[2];
      blocks.push({ type: 'heading', level, text: (h[3] || '').trim(), tocHidden });
      i += 1;
      continue;
    }

    const img = line.trim().match(/^!\[([^\]]*)]\(([^)]+)\)\s*$/);
    if (img) {
      const items: { kind: 'image' | 'video'; alt: string; src: string }[] = [];

      const pushItem = (m: RegExpMatchArray) => {
        const alt = (m[1] || '').trim();
        const src = (m[2] || '').trim();
        items.push({ kind: isVideoUrl(src) ? 'video' : 'image', alt, src });
      };

      pushItem(img);
      i += 1;

      // If multiple images appear back-to-back (optionally separated by blank lines),
      // render them as a lightweight carousel. Stop at blank lines before non-image content
      // so we can preserve intentional spacing.
      while (i < lines.length) {
        const nextRaw = lines[i];
        if (!nextRaw.trim()) {
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j += 1;
          if (j >= lines.length) break;
          const nextNonEmpty = lines[j].trim();
          const nextIsImage = /^!\[([^\]]*)]\(([^)]+)\)\s*$/.test(nextNonEmpty);
          if (!nextIsImage) break;
          i = j;
        }
        const next = lines[i].trim();
        const m = next.match(/^!\[([^\]]*)]\(([^)]+)\)\s*$/);
        if (!m) break;
        pushItem(m);
        i += 1;
      }

      if (items.length <= 1) {
        const item = items[0];
        if (item.kind === 'video') blocks.push({ type: 'video', alt: item.alt, src: item.src, media: pendingMedia || undefined });
        else blocks.push({ type: 'image', alt: item.alt, src: item.src });
      } else {
        blocks.push({ type: 'carousel', items, media: pendingMedia || undefined });
      }
      pendingMedia = null;
      continue;
    }

    const yt = line.trim().match(/^@youtube\(([^)]+)\)\s*$/i);
    if (yt) {
      const url = yt[1].trim();
      const embedUrl = toYouTubeEmbedUrl(url);
      if (embedUrl) {
        blocks.push({ type: 'youtube', embedUrl });
      } else {
        blocks.push({ type: 'paragraph', text: line });
      }
      i += 1;
      continue;
    }

    const media = line.trim().match(/^@media\(([^)]*)\)\s*$/i);
    if (media) {
      pendingMedia = parseMediaOptions(media[1]);
      i += 1;
      continue;
    }

    const snippet = line.trim().match(/^@snippet\(([^)]+)\)\s*$/i);
    if (snippet) {
      const inside = snippet[1].trim();
      const comma = inside.indexOf(',');
      const id = (comma === -1 ? inside : inside.slice(0, comma)).trim();
      const rawCaption = comma === -1 ? '' : inside.slice(comma + 1).trim();
      const caption =
        rawCaption.length > 1 &&
        ((rawCaption.startsWith('"') && rawCaption.endsWith('"')) || (rawCaption.startsWith("'") && rawCaption.endsWith("'")))
          ? rawCaption.slice(1, -1).trim()
          : rawCaption;
      blocks.push({ type: 'snippet', id, caption: caption || undefined });
      i += 1;
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trimEnd();
        const m = l.match(/^-+\s+(.+)$/);
        if (!m) break;
        items.push(m[1].trim());
        i += 1;
      }
      if (items.length > 0) blocks.push({ type: 'list', items });
      continue;
    }

    consumeParagraph();
  }

  return blocks;
}

function renderInline(text: string, size: RichTextSize) {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const [full, label, hrefRaw] = match;
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const href = hrefRaw.trim();
    if (isSafeUrl(href)) {
      parts.push(
        <a
          key={`${match.index}-${full}`}
          href={href}
          target={href.startsWith('/') ? undefined : '_blank'}
          rel={href.startsWith('/') ? undefined : 'noreferrer'}
          className={size === 'small' ? 'text-[#3be3ff] hover:text-[#f9b234] underline underline-offset-2' : 'text-[#3be3ff] hover:text-[#f9b234] underline underline-offset-2'}
        >
          {label}
        </a>,
      );
    } else {
      parts.push(full);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function MediaLightbox({
  item,
  onClose,
}: {
  item: MediaItem | null;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!item) return;
    setZoom(1);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))));
      if (event.key === '-') setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))));
      if (event.key === '0') setZoom(1);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [item, onClose]);

  if (!item) return null;

  const isVideo = item.kind === 'video';

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/95 text-white"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
          aria-label="Close media viewer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {!isVideo && (
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))));
            }}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))));
            }}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex h-full w-full items-center justify-center p-4 sm:p-8" onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video
            src={item.src}
            controls
            autoPlay
            loop
            playsInline
            className="max-h-full max-w-full rounded-lg bg-black object-contain"
          />
        ) : (
          <div className="h-full w-full overflow-auto">
            <div className="flex min-h-full min-w-full items-center justify-center">
              <img
                src={item.src}
                alt={item.alt || 'media'}
                className="max-h-full max-w-full rounded-lg object-contain transition-transform duration-150"
                style={{ transform: `scale(${zoom})` }}
              />
            </div>
          </div>
        )}
      </div>

      {item.alt && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-5 pt-16 text-center text-sm text-slate-100/90">
          {item.alt}
        </div>
      )}
    </div>
  );
}

function OpenMediaButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/45 text-white opacity-0 shadow-lg transition hover:bg-black/65 group-hover:opacity-100 focus:opacity-100"
      aria-label="Open media fullscreen"
    >
      <Maximize2 className="h-4 w-4" />
    </button>
  );
}

function Carousel({ items, media }: { items: MediaItem[]; media?: MediaOptions }) {
  const SLIDE_MS = media?.intervalMs && media.intervalMs >= 500 ? media.intervalMs : 4500;
  const safeItems = useMemo(
    () =>
      items
        .filter((item) => isSafeUrl(item.src))
        .map((item) => ({ ...item, src: withBaseUrl(item.src) })),
    [items],
  );
  const [index, setIndex] = useState(0);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (!timerRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const goNext = () => {
    if (safeItems.length <= 1) return;
    setIndex((i) => (i + 1) % safeItems.length);
  };

  const goPrev = () => {
    if (safeItems.length <= 1) return;
    setIndex((i) => (i - 1 + safeItems.length) % safeItems.length);
  };

  useEffect(() => {
    clearTimer();
    if (safeItems.length <= 1 || lightboxItem) return;

    const currentItem = safeItems[index];
    if (!currentItem) return;

    if (currentItem.kind !== 'video') {
      timerRef.current = window.setTimeout(goNext, SLIDE_MS);
      return clearTimer;
    }

    const video = videoRefs.current[index];
    if (!video) return;

    const scheduleVideoAdvance = () => {
      clearTimer();
      const durationMs = Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : 0;
      const waitMs = durationMs > 0 ? Math.max(SLIDE_MS, durationMs) : SLIDE_MS;
      video.loop = waitMs > durationMs && safeItems.length > 1;
      timerRef.current = window.setTimeout(goNext, waitMs);
    };

    const onEnded = () => {
      if (safeItems.length > 1) goNext();
    };

    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      // ignore
    }
    video.muted = true;
    void video.play().catch(() => {});

    if (Number.isFinite(video.duration) && video.duration > 0) scheduleVideoAdvance();
    else video.addEventListener('loadedmetadata', scheduleVideoAdvance, { once: true });

    video.addEventListener('ended', onEnded);

    return () => {
      clearTimer();
      video.removeEventListener('ended', onEnded);
    };
  }, [index, lightboxItem, safeItems, SLIDE_MS]);

  useEffect(() => {
    for (const [idxRaw, el] of Object.entries(videoRefs.current)) {
      const idx = Number(idxRaw);
      if (!el) continue;
      if (idx !== index || lightboxItem) {
        el.pause();
      }
    }
  }, [index, lightboxItem]);

  useEffect(() => clearTimer, []);

  if (safeItems.length === 0) return null;
  const current = safeItems[Math.max(0, Math.min(index, safeItems.length - 1))];

  return (
    <div className="my-4">
      <div
        className="group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-black/20 select-none"
        onClick={() => setLightboxItem(current)}
      >
        <div className="relative w-full pt-[56.25%]">
          <div
            className="absolute inset-0 flex transition-transform duration-500 ease-out"
            style={{
              transform: `translateX(-${index * 100}%)`,
            }}
          >
            {safeItems.map((item, i) => (
              <div key={`${item.src}-${i}`} className="relative h-full w-full flex-none">
                {item.kind === 'video' ? (
                  <video
                    ref={(el) => {
                      videoRefs.current[i] = el;
                    }}
                    src={item.src}
                    muted
                    playsInline
                    loop={safeItems.length <= 1}
                    autoPlay={i === index && !lightboxItem}
                    preload={i === index ? 'metadata' : 'none'}
                    className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                    onError={(e) => {
                      (e.currentTarget as HTMLVideoElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <img src={item.src} alt={item.alt || 'image'} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                )}
              </div>
            ))}
          </div>
        </div>

        <OpenMediaButton onClick={() => setLightboxItem(current)} />

        {safeItems.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goPrev();
              }}
              className="absolute left-3 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/45 text-white opacity-0 shadow-lg transition hover:bg-black/65 active:scale-95 group-hover:opacity-100 focus:opacity-100"
              aria-label="Previous media"
            >
              <ChevronLeft className="h-4 w-4 text-[#f9b234]" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goNext();
              }}
              className="absolute right-3 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/45 text-white opacity-0 shadow-lg transition hover:bg-black/65 active:scale-95 group-hover:opacity-100 focus:opacity-100"
              aria-label="Next media"
            >
              <ChevronRight className="h-4 w-4 text-[#f9b234]" />
            </button>
          </>
        )}

        {current.alt && (
          <div className="absolute inset-x-0 bottom-0">
            <div className="h-20 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-5 py-4">
              <div className="max-w-full">
                <div className="text-sm sm:text-base text-slate-100/90 font-normal italic leading-snug drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                  {current.alt}
                </div>
              </div>
            </div>
          </div>
        )}

        {safeItems.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-2">
            {safeItems.map((_, dotIdx) => (
              <span
                key={dotIdx}
                className={`h-2.5 w-2.5 rounded-full border transition ${
                  dotIdx === index ? 'bg-[#3be3ff] border-[#3be3ff]/60' : 'bg-white/20 border-white/20'
                }`}
              />
            ))}
          </div>
        )}
      </div>
      <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
    </div>
  );
}

export default function RichText({
  text,
  className,
  size = 'normal',
  snippetRenderer,
  headingIdPrefix = '',
}: {
  text: string | null | undefined;
  className?: string;
  size?: RichTextSize;
  snippetRenderer?: (id: string, caption?: string) => React.ReactNode | null | undefined;
  headingIdPrefix?: string;
}) {
  if (!text) return null;
  const blocks = parseBlocks(text);
  if (blocks.length === 0) return null;

  const headingCounts = new Map<string, number>();

  return (
    <div className={className}>
      {blocks.map((b, idx) => {
        if (b.type === 'heading') {
          const Tag = b.level === 2 ? 'h2' : 'h3';
          const base = `${headingIdPrefix}${slugifyHeadingStable(b.text) || 'section'}`;
          const count = (headingCounts.get(base) || 0) + 1;
          headingCounts.set(base, count);
          const id = count === 1 ? base : `${base}-${count}`;
          return (
            <Tag
              key={idx}
              id={id}
              className={
                size === 'small'
                  ? 'text-sm font-semibold text-white mt-2 mb-1'
                  : b.level === 2
                    ? 'text-xl font-semibold text-white mt-5 mb-2'
                    : 'text-lg font-semibold text-white mt-4 mb-2'
              }
            >
              {b.text}
            </Tag>
          );
        }

        if (b.type === 'image') {
          const safe = isSafeUrl(b.src);
          if (!safe) return null;
          const src = withBaseUrl(b.src);
          return <InlineImage key={idx} src={src} alt={b.alt || 'image'} />;
        }

        if (b.type === 'carousel') {
          return <Carousel key={idx} items={b.items} media={b.media} />;
        }

        if (b.type === 'video') {
          const safe = isSafeUrl(b.src);
          if (!safe) return null;
          const src = withBaseUrl(b.src);
          return <InlineVideo key={idx} src={src} alt={b.alt || 'video'} media={b.media} />;
        }

        if (b.type === 'snippet') {
          const node = snippetRenderer ? snippetRenderer(b.id, b.caption) : null;
          if (!node) {
            return (
              <div key={idx} className="my-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                Unknown snippet: <span className="font-mono text-xs">{b.id}</span>
              </div>
            );
          }

          return <React.Fragment key={idx}>{node}</React.Fragment>;
        }

        if (b.type === 'youtube') {
          return (
            <div key={idx} className="my-4">
              <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 pt-[56.25%]">
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={b.embedUrl}
                  title="YouTube video"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          );
        }

        if (b.type === 'list') {
          return (
            <ul key={idx} className={size === 'small' ? 'list-disc pl-5 space-y-1 text-xs text-slate-200' : 'list-disc pl-6 space-y-1 text-sm text-slate-200'}>
              {b.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInline(item, size)}</li>
              ))}
            </ul>
          );
        }

        if (b.type === 'spacer') {
          const height = Math.min(b.lines, 6) * (size === 'small' ? 8 : 12);
          return <div key={idx} style={{ height }} />;
        }

        return (
          <p
            key={idx}
            className={
              size === 'small'
                ? 'text-xs text-slate-200 leading-relaxed whitespace-pre-wrap mt-3 first:mt-0'
                : 'text-sm md:text-base text-slate-300 leading-relaxed whitespace-pre-wrap mt-3 first:mt-0'
            }
          >
            {renderInline(b.text, size)}
          </p>
        );
      })}
    </div>
  );
}

function InlineVideo({
  src,
  alt,
}: {
  src: string;
  alt: string;
  media?: MediaOptions;
}) {
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const item: MediaItem = { kind: 'video', src, alt };

  return (
    <div className="my-4">
      <div
        className="group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-black/20 pt-[56.25%]"
        onClick={() => setLightboxItem(item)}
      >
        <video
          src={src}
          muted
          playsInline
          loop
          autoPlay
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />
        <OpenMediaButton onClick={() => setLightboxItem(item)} />
      </div>
      <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
    </div>
  );
}

function InlineImage({ src, alt }: { src: string; alt: string }) {
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const item: MediaItem = { kind: 'image', src, alt };

  return (
    <figure className="my-4">
      <div
        className="group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-black/20"
        onClick={() => setLightboxItem(item)}
      >
        <img src={src} alt={alt} className="w-full" loading="lazy" />
        <OpenMediaButton onClick={() => setLightboxItem(item)} />
        {alt && (
          <figcaption className="absolute inset-x-0 bottom-0">
            <div className="h-20 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-5 py-4">
              <div className="max-w-full">
                <div className="text-sm sm:text-base text-slate-100/90 font-normal italic leading-snug drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                  {alt}
                </div>
              </div>
            </div>
          </figcaption>
        )}
      </div>
      <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
    </figure>
  );
}
