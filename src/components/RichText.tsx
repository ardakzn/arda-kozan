import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { normalizeMarkdownText, slugifyHeading as slugifyHeadingStable } from '../lib/markdown';
import { withBaseUrl } from '../lib/paths';

type RichTextSize = 'normal' | 'small';
type MediaOptions = {
  startPaused?: boolean;
  intervalMs?: number;
};

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

function Carousel({
  items,
  media,
}: {
  items: { kind: 'image' | 'video'; alt: string; src: string }[];
  media?: MediaOptions;
}) {
  const IMAGE_SLIDE_MS = media?.intervalMs && media.intervalMs >= 500 ? media.intervalMs : 4500;
  const safeItems = useMemo(
    () =>
      items
        .filter((item) => isSafeUrl(item.src))
        .map((item) => ({ ...item, src: withBaseUrl(item.src) })),
    [items],
  );
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(!!media?.startPaused);
  const [togglePop, setTogglePop] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [animateTrack, setAnimateTrack] = useState(true);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const viewportWidthRef = useRef(0);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const swipeRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  }>({ pointerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false });
  const suppressToggleClickRef = useRef(false);
  const togglePopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (togglePopTimerRef.current) window.clearTimeout(togglePopTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setIsPaused(!!media?.startPaused);
  }, [media?.startPaused]);

  const triggerTogglePop = () => {
    if (togglePopTimerRef.current) window.clearTimeout(togglePopTimerRef.current);
    setTogglePop(true);
    togglePopTimerRef.current = window.setTimeout(() => {
      setTogglePop(false);
      togglePopTimerRef.current = null;
    }, 180);
  };

  const prevIndex = (i: number) => (i - 1 + safeItems.length) % safeItems.length;
  const nextIndex = (i: number) => (i + 1) % safeItems.length;

  const prev = () => {
    if (safeItems.length <= 1) return;
    setAnimateTrack(true);
    setIndex((i) => prevIndex(i));
  };

  const next = () => {
    if (safeItems.length <= 1) return;
    setAnimateTrack(true);
    setIndex((i) => nextIndex(i));
  };

  useEffect(() => {
    if (safeItems.length <= 1) return;
    if (isPaused) return;
    if (hovered || dragging) return;
    const currentItem = safeItems[index];
    if (currentItem?.kind === 'video') return;

    const t = window.setTimeout(() => {
      setIndex((i) => (i + 1) % safeItems.length);
    }, IMAGE_SLIDE_MS);

    return () => window.clearTimeout(t);
  }, [dragging, hovered, index, isPaused, safeItems]);

  useEffect(() => {
    const updateWidth = () => {
      const el = viewportRef.current;
      if (!el) return;
      viewportWidthRef.current = el.getBoundingClientRect().width;
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    for (const [idxRaw, el] of Object.entries(videoRefs.current)) {
      const idx = Number(idxRaw);
      if (!el) continue;
      if (idx === index && !isPaused) {
        void el.play().catch(() => {});
      } else {
        el.pause();
      }
    }
  }, [index, isPaused, safeItems.length]);

  if (safeItems.length === 0) return null;
  const current = safeItems[Math.max(0, Math.min(index, safeItems.length - 1))];

  const shouldIgnoreSwipeStart = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return !!target.closest('button, a, input, textarea, select, summary');
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (safeItems.length <= 1) return;
    if (shouldIgnoreSwipeStart(e.target)) return;
    if (e.button !== 0) return;

    const el = viewportRef.current;
    if (el) viewportWidthRef.current = el.getBoundingClientRect().width;

    setAnimateTrack(false);
    setDragging(true);
    swipeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
    };

    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const s = swipeRef.current;
    if (s.pointerId !== e.pointerId) return;
    s.lastX = e.clientX;
    s.lastY = e.clientY;

    const dx = s.lastX - s.startX;
    const dy = s.lastY - s.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!s.moved) {
      if (absX < 10) return;
      if (absX <= absY) return;
      s.moved = true;
      suppressToggleClickRef.current = true;
      window.setTimeout(() => {
        suppressToggleClickRef.current = false;
      }, 250);
    }

    if (s.moved) {
      e.preventDefault();
      const w = viewportWidthRef.current || 1;
      const clamped = Math.max(-w, Math.min(w, dx));
      setDragX(clamped);
    }
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const s = swipeRef.current;
    if (s.pointerId !== e.pointerId) return;

    const dx = s.lastX - s.startX;
    const dy = s.lastY - s.startY;

    swipeRef.current.pointerId = null;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const w = viewportWidthRef.current || 1;
    setAnimateTrack(true);

    if (absX < 50 || absX <= absY) {
      setDragX(0);
      window.setTimeout(() => {
        setDragging(false);
        setAnimateTrack(true);
      }, 200);
      return;
    }

    if (dx > 0) {
      setDragX(w);
      window.setTimeout(() => {
        setIndex((i) => prevIndex(i));
        setAnimateTrack(false);
        setDragX(0);
        setDragging(false);
        window.setTimeout(() => setAnimateTrack(true), 0);
      }, 200);
      return;
    }

    setDragX(-w);
    window.setTimeout(() => {
      setIndex((i) => nextIndex(i));
      setAnimateTrack(false);
      setDragX(0);
      setDragging(false);
      window.setTimeout(() => setAnimateTrack(true), 0);
    }, 200);
  };

  return (
    <div
      className="my-4"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={viewportRef}
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          const target = e.target as Element | null;
          if (target?.closest('button, a, input, textarea, select, summary')) return;
          if (suppressToggleClickRef.current) return;
          setIsPaused((v) => !v);
          triggerTogglePop();
        }}
      >
        <div className="relative w-full pt-[56.25%]">
          <div
            className={`absolute inset-0 flex ${animateTrack ? 'transition-transform duration-200 ease-out' : ''}`}
            style={{
              transform: `translateX(calc(-${index * 100}% + ${dragX}px))`,
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
                    loop={hovered || dragging}
                    autoPlay={i === index && !isPaused}
                    preload={i === index ? 'metadata' : 'none'}
                    className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                    onEnded={() => {
                      if (i !== index) return;
                      if (safeItems.length <= 1) return;
                      if (isPaused) return;
                      if (hovered || dragging) return;
                      setIndex((cur) => (cur + 1) % safeItems.length);
                    }}
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

        {isPaused && (
          <div className="absolute inset-0 z-20 grid place-items-center pointer-events-none">
            <div className="animate-play-idle motion-reduce:animate-none">
              <div
                className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-2 border-[#3be3ff] bg-[#081325] shadow-[0_0_0_10px_rgba(59,227,255,0.3),0_26px_64px_rgba(0,0,0,0.68)] transition-transform duration-200 ${
                  togglePop ? 'scale-110' : 'scale-100'
                }`}
              >
                <Play className="h-11 w-11 text-[#3be3ff] ml-1" />
              </div>
            </div>
          </div>
        )}

        {safeItems.length > 1 && (
          <div
            className={`pointer-events-none absolute inset-0 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'} sm:pointer-events-auto`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                prev();
              }}
              className="hidden sm:block pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-[#0e1526]/75 p-3 text-white shadow-lg transition hover:bg-[#0e1526] hover:-translate-x-0.5 active:scale-95 active:bg-[#0e1526] active:shadow-none"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4 text-[#f9b234]" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                next();
              }}
              className="hidden sm:block pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-[#0e1526]/75 p-3 text-white shadow-lg transition hover:bg-[#0e1526] hover:translate-x-0.5 active:scale-95 active:bg-[#0e1526] active:shadow-none"
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4 text-[#f9b234]" />
            </button>
          </div>
        )}

        {safeItems.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            {safeItems.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={() => setIndex(dotIdx)}
                className={`h-2.5 w-2.5 rounded-full border transition ${
                  dotIdx === index ? 'bg-[#3be3ff] border-[#3be3ff]/60' : 'bg-white/20 border-white/20 hover:bg-white/30'
                }`}
                aria-label={`Go to image ${dotIdx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
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
          return (
            <figure key={idx} className="my-4">
              <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <img src={src} alt={b.alt || 'image'} className="w-full" loading="lazy" />
                {b.alt && (
                  <figcaption className="absolute inset-x-0 bottom-0">
                    <div className="h-20 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 px-5 py-4">
                      <div className="max-w-full">
                        <div className="text-sm sm:text-base text-slate-100/90 font-normal italic leading-snug drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                          {b.alt}
                        </div>
                      </div>
                    </div>
                  </figcaption>
                )}
              </div>
            </figure>
          );
        }

        if (b.type === 'carousel') {
          return <Carousel key={idx} items={b.items} media={b.media} />;
        }

        if (b.type === 'video') {
          const safe = isSafeUrl(b.src);
          if (!safe) return null;
          const src = withBaseUrl(b.src);
          return <InlineVideo key={idx} src={src} media={b.media} />;
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
  media,
}: {
  src: string;
  media?: MediaOptions;
}) {
  const [isPaused, setIsPaused] = useState(!!media?.startPaused);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setIsPaused(!!media?.startPaused);
  }, [media?.startPaused]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isPaused) el.pause();
    else void el.play().catch(() => {});
  }, [isPaused]);

  return (
    <div className="my-4">
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 pt-[56.25%] cursor-pointer"
        onClick={() => setIsPaused((v) => !v)}
      >
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          loop
          autoPlay={!isPaused}
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {isPaused && (
          <div className="absolute inset-0 z-10 grid place-items-center pointer-events-none">
            <div className="animate-play-idle-sm motion-reduce:animate-none">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-[#3be3ff] bg-[#081325] shadow-[0_0_0_8px_rgba(59,227,255,0.28),0_20px_48px_rgba(0,0,0,0.68)]">
                <Play className="h-10 w-10 text-[#3be3ff] ml-1" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
