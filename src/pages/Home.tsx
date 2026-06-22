import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, Code2, Sparkles, X, FileDown, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { getProjectTags, loadProjectsList } from '../lib/projects';
import { useSiteRuntime } from '../lib/siteRuntime';
import type { ProjectWithDetails } from '../types/portfolio';
import { withBaseUrl } from '../lib/paths';

type FeaturedCard = {
  project: ProjectWithDetails;
  image?: string;
  video?: string;
  slug: string;
  tags: string[];
};

const featuredFallbackGradient =
  'radial-gradient(circle at 20% 25%, rgba(59, 227, 255, 0.22), transparent 55%), radial-gradient(circle at 80% 10%, rgba(249, 178, 52, 0.14), transparent 55%), linear-gradient(135deg, rgba(7, 11, 20, 0.95), rgba(16, 26, 47, 0.92))';

export default function Home() {
  const { site, t } = useSiteRuntime();
  const cvBaseUrl = withBaseUrl((site.links?.cv_pdf_url || '/assets/CV.pdf').trim() || '/assets/CV.pdf');
  const pdfUrl = `${cvBaseUrl}#zoom=page-width`;
  const email = (site.links?.email || 'hello@yourdomain.com').trim() || 'hello@yourdomain.com';

  const [featured, setFeatured] = useState<FeaturedCard[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [featuredVideoReady, setFeaturedVideoReady] = useState<Record<string, boolean>>({});
  const [featuredShowPlaceholder, setFeaturedShowPlaceholder] = useState<Record<string, boolean>>({});
  const [cvOpen, setCvOpen] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  const placeholderTimersRef = useRef<Record<string, number>>({});
  const carouselTimerRef = useRef<number | null>(null);
  const featuredVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const pendingRestartSlugRef = useRef<string | null>(null);
  const [mobileFeaturedOverlay, setMobileFeaturedOverlay] = useState(true);
  const mobileOverlayTimerRef = useRef<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const featuredSwipeRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  }>({ pointerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false });
  const suppressFeaturedClickRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await loadProjectsList();
        const ordered = list.slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        const pick = ordered.filter((p) => p.featured).slice(0, 4);
        const useList = pick.length > 0 ? pick : ordered.slice(0, 4);

        const mapped: FeaturedCard[] = useList.map((p) => ({
          project: p,
          image: ((p.thumbnail_image_url || '').trim() && withBaseUrl((p.thumbnail_image_url || '').trim())) || undefined,
          video: ((p.thumbnail_video_url || '').trim() && withBaseUrl((p.thumbnail_video_url || '').trim())) || undefined,
          slug: p.slug,
          tags: getProjectTags(p).slice(0, 3),
        }));

        setFeatured(mapped);
        setFeaturedVideoReady({});
        setFeaturedShowPlaceholder({});
        setSlideIndex(0);
      } catch (err) {
        console.error(err);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  const armMobileOverlay = (ms = 2200) => {
    if (mobileOverlayTimerRef.current) {
      window.clearTimeout(mobileOverlayTimerRef.current);
      mobileOverlayTimerRef.current = null;
    }

    setMobileFeaturedOverlay(true);
    mobileOverlayTimerRef.current = window.setTimeout(() => {
      setMobileFeaturedOverlay(false);
      mobileOverlayTimerRef.current = null;
    }, ms);
  };

  useEffect(() => {
    for (const key of Object.keys(placeholderTimersRef.current)) {
      window.clearTimeout(placeholderTimersRef.current[key]);
    }
    placeholderTimersRef.current = {};

    const next: Record<string, boolean> = {};
    for (const item of featured) {
      if (!item.video) continue;
      next[item.slug] = false;
      placeholderTimersRef.current[item.slug] = window.setTimeout(() => {
        setFeaturedShowPlaceholder((cur) => {
          if (featuredVideoReady[item.slug]) return cur;
          return { ...cur, [item.slug]: true };
        });
      }, 150);
    }
    setFeaturedShowPlaceholder(next);

    return () => {
      for (const key of Object.keys(placeholderTimersRef.current)) {
        window.clearTimeout(placeholderTimersRef.current[key]);
      }
      placeholderTimersRef.current = {};
    };
    // We intentionally only react to the featured list changing (not videoReady),
    // to avoid re-arming timers while videos are loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured.map((f) => f.slug).join('|')]);

  useEffect(() => {
    if (carouselTimerRef.current) {
      window.clearTimeout(carouselTimerRef.current);
      carouselTimerRef.current = null;
    }

    if (featured.length <= 1) return;
    if (carouselPaused) return;

    carouselTimerRef.current = window.setTimeout(() => {
      setSlideIndex((i) => (i + 1) % featured.length);
    }, 5000);

    return () => {
      if (carouselTimerRef.current) {
        window.clearTimeout(carouselTimerRef.current);
        carouselTimerRef.current = null;
      }
    };
  }, [carouselPaused, featured.length, slideIndex]);

  useEffect(() => {
    if (!isMobile) return;
    if (featured.length === 0) return;
    armMobileOverlay(2200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, slideIndex, featured.length]);

  useEffect(() => {
    if (slideIndex >= featured.length) setSlideIndex(0);
  }, [featured.length, slideIndex]);

  useEffect(() => {
    const activeItem = featured[slideIndex];
    const activeSlug = activeItem?.slug ?? null;

    for (const item of featured) {
      if (!item.video) continue;
      if (item.slug === activeSlug) continue;
      featuredVideoRefs.current[item.slug]?.pause();
    }

    if (!activeItem?.video || !activeSlug) return;

    const activeEl = featuredVideoRefs.current[activeSlug];
    if (!activeEl) return;

    const restart = () => {
      try {
        activeEl.pause();
      } catch {}

      try {
        activeEl.currentTime = 0;
        pendingRestartSlugRef.current = null;
      } catch {
        pendingRestartSlugRef.current = activeSlug;
      }

      void activeEl.play().catch(() => {});
    };

    // Always restart on slide change so the video starts from the beginning.
    restart();
  }, [featured, slideIndex]);

  const markFeaturedVideoReady = (slug: string, el?: HTMLVideoElement | null) => {
    setFeaturedVideoReady((cur) => ({ ...cur, [slug]: true }));
    const timer = placeholderTimersRef.current[slug];
    if (timer) window.clearTimeout(timer);
    setFeaturedShowPlaceholder((cur) => ({ ...cur, [slug]: false }));

    if (pendingRestartSlugRef.current !== slug) return;
    if (!el) return;

    try {
      el.currentTime = 0;
    } catch {
      // ignore
    }
    void el.play().catch(() => {});
    pendingRestartSlugRef.current = null;
  };

  const pauseCarousel = () => {
    if (carouselTimerRef.current) {
      window.clearTimeout(carouselTimerRef.current);
      carouselTimerRef.current = null;
    }
    setCarouselPaused(true);
  };

  const resumeCarousel = () => {
    setCarouselPaused(false);
  };

  const onFeaturedPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (featured.length <= 1) return;
    if (e.button !== 0) return;
    if (e.pointerType === 'mouse') return;

    if (isMobile) armMobileOverlay(10_000);

    featuredSwipeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
    };

    pauseCarousel();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onFeaturedPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const s = featuredSwipeRef.current;
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
      suppressFeaturedClickRef.current = true;
      window.setTimeout(() => {
        suppressFeaturedClickRef.current = false;
      }, 350);
    }

    if (s.moved) e.preventDefault();
  };

  const onFeaturedPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const s = featuredSwipeRef.current;
    if (s.pointerId !== e.pointerId) return;

    const dx = s.lastX - s.startX;
    const dy = s.lastY - s.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    featuredSwipeRef.current.pointerId = null;
    resumeCarousel();

    if (isMobile) armMobileOverlay(900);

    if (!s.moved) return;
    if (absX < 50 || absX <= absY) return;

    if (dx > 0) setSlideIndex((i) => (i - 1 + featured.length) % featured.length);
    else setSlideIndex((i) => (i + 1) % featured.length);
  };

  useEffect(() => {
    if (!cvOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCvOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [cvOpen]);

  useEffect(() => {
    if (!cvOpen) return;
    setPdfStatus('loading');
    const checkPdf = async () => {
      try {
        const res = await fetch(pdfUrl, { method: 'HEAD' });
        if (res.ok) {
          setPdfStatus('ready');
        } else {
          setPdfStatus('unavailable');
        }
      } catch {
        setPdfStatus('unavailable');
      }
    };
    void checkPdf();
  }, [cvOpen, pdfUrl]);

  const aboutLines = (t(site.home?.about_card_lines) || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div
      className="min-h-screen text-slate-100 relative overflow-x-hidden"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(59, 227, 255, 0.08), transparent 25%), radial-gradient(circle at 80% 10%, rgba(249, 178, 52, 0.08), transparent 25%), linear-gradient(135deg, #060b16 0%, #0e1526 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(59, 227, 255, 0.05), transparent 50%)' }}
      ></div>

      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative space-y-12">
        {featured.length > 0 && (
          <section className="space-y-3">
            <div
              className="group relative w-screen sm:w-full left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 overflow-hidden rounded-3xl bg-[#0f172a]/80 shadow-2xl shadow-black/30"
              onMouseEnter={pauseCarousel}
              onMouseLeave={resumeCarousel}
              onFocusCapture={pauseCarousel}
              onBlurCapture={resumeCarousel}
            >
              <div
                className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
                  isMobile ? (mobileFeaturedOverlay ? 'opacity-100' : 'opacity-0') : 'opacity-0 sm:group-hover:opacity-100'
                }`}
              >
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
              </div>

              <div
                className="flex w-full transition-transform duration-700 ease-in-out touch-pan-y will-change-transform"
                style={{ transform: `translate3d(-${slideIndex * 100}%, 0, 0)` }}
                onPointerDown={onFeaturedPointerDown}
                onPointerMove={onFeaturedPointerMove}
                onPointerUp={onFeaturedPointerUp}
                onPointerCancel={onFeaturedPointerUp}
              >
                {featured.map((item, itemIdx) => (
                  <Link
                    key={item.slug}
                    to={`/project/${item.slug}`}
                    onClick={(e) => {
                      if (!suppressFeaturedClickRef.current) return;
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className={[
                      'group relative flex-none w-full pt-[68%] sm:pt-0 sm:h-[360px] md:h-[420px] block overflow-hidden',
                      itemIdx === 0 ? '' : '-ml-px',
                    ].join(' ')}
                  >
                    <div className="absolute inset-0" style={{ backgroundImage: featuredFallbackGradient }} />
                    {!item.video && item.image && (
                      <img
                        src={item.image}
                        alt={t(item.project.title)}
                        className="absolute inset-0 w-full h-full object-cover transform-gpu scale-[1.08] sm:scale-100"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    {item.video && (
                      <video
                        ref={(el) => {
                          featuredVideoRefs.current[item.slug] = el;
                        }}
                        src={item.video}
                        muted
                        playsInline
                        loop
                        preload="metadata"
                        className={`absolute inset-0 w-full h-full object-cover transform-gpu scale-[1.08] sm:scale-100 transition-opacity duration-200 ${
                          featuredVideoReady[item.slug] ? 'opacity-100' : 'opacity-0'
                        }`}
                        onLoadedData={(e) => markFeaturedVideoReady(item.slug, e.currentTarget)}
                        onError={(e) => {
                          (e.currentTarget as HTMLVideoElement).style.display = 'none';
                        }}
                      />
                    )}

                    {item.video && !featuredVideoReady[item.slug] && featuredShowPlaceholder[item.slug] && (
                      <div className="absolute inset-0 transition-opacity duration-200">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#060b16]/75 via-[#060b16]/45 to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="relative w-[84%] max-w-[720px] rounded-3xl border border-white/10 bg-[#0b1221]/40 backdrop-blur-sm p-6 shadow-2xl shadow-black/40">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 grid place-items-center">
                                <div className="w-0 h-0 border-y-[9px] border-y-transparent border-l-[14px] border-l-white/70 translate-x-[1px]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="h-3 w-44 rounded-full bg-white/10 motion-reduce:animate-none animate-pulse" />
                                <div className="mt-3 h-3 w-72 max-w-full rounded-full bg-white/10 motion-reduce:animate-none animate-pulse" />
                              </div>
                            </div>
                            <div className="mt-6 h-2 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full w-1/3 bg-white/15 motion-reduce:animate-none animate-pulse" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div
                      className={`absolute inset-0 transition-opacity duration-300 bg-gradient-to-t from-[#060b16]/85 via-[#060b16]/35 to-transparent ${
                        isMobile ? (mobileFeaturedOverlay ? 'opacity-100' : 'opacity-0') : 'opacity-0 sm:group-hover:opacity-100'
                      }`}
                    ></div>
                    <div className="absolute inset-0 flex items-end">
                      <div className="p-4 sm:p-6 md:p-8 space-y-2.5 max-w-2xl">
                        <h3
                          className={`text-2xl sm:text-3xl md:text-4xl leading-tight font-semibold text-white transition-all duration-300 ${
                            isMobile
                              ? mobileFeaturedOverlay
                                ? 'opacity-100 translate-y-0'
                                : 'opacity-0 translate-y-1 pointer-events-none'
                              : 'opacity-0 translate-y-2 sm:group-hover:opacity-100 sm:group-hover:translate-y-0'
                          }`}
                        >
                          {t(item.project.title)}
                        </h3>
                        <div
                          className={`transition-all duration-300 ${
                            isMobile
                              ? mobileFeaturedOverlay
                                ? 'opacity-100 translate-y-0'
                                : 'opacity-0 translate-y-1 pointer-events-none'
                              : 'opacity-0 translate-y-2 sm:group-hover:opacity-100 sm:group-hover:translate-y-0'
                          }`}
                        >
                          <p className="text-xs sm:text-sm text-slate-200/90 line-clamp-2">{t(item.project.summary)}</p>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2.5 sm:mt-3">
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2.5 py-0.5 text-[11px] sm:px-3 sm:py-1 sm:text-xs font-semibold rounded-full border border-white/10 text-[#3be3ff] bg-[#3be3ff]/10"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                {featured.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (carouselTimerRef.current) {
                        window.clearTimeout(carouselTimerRef.current);
                        carouselTimerRef.current = null;
                      }
                      setSlideIndex(i);
                    }}
                    className={`w-2 h-2 rounded-full transition ${i === slideIndex ? 'bg-[#3be3ff]' : 'bg-white/40'}`}
                    aria-label={`Slide ${i + 1}`}
                  ></button>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#101a2f] border border-white/5 text-xs uppercase tracking-[0.2em] text-slate-300">
              <Sparkles className="w-4 h-4 text-[#3be3ff]" />
              {t(site.home?.badge) || 'Case Studies'}
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-white">
                {t(site.home?.headline) || 'Developer-focused, minimal portfolio'}
              </h1>
              <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">{t(site.home?.lead)}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/projects"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#3be3ff] text-slate-950 font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition"
              >
                {t(site.home?.cta_projects) || 'Browse projects'} <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setCvOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f9b234] text-slate-950 font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition"
              >
                {t(site.home?.cta_cv) || 'View CV'} <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-slate-100 hover:border-[#f9b234] transition"
              >
                {t(site.home?.cta_email) || 'Email'} <Mail className="w-4 h-4 text-[#f9b234]" />
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-[#3be3ff] blur-3xl opacity-10"></div>
            <div className="relative rounded-3xl overflow-hidden border border-white/5 bg-[#101a2f]/90 shadow-2xl shadow-cyan-500/10">
              <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-2 h-2 rounded-full bg-[#3be3ff]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#f9b234]"></div>
                  <div className="w-2 h-2 rounded-full bg-white/50"></div>
                  <span className="ml-2 uppercase tracking-[0.2em]">{t(site.home?.about_card_title) || 'Quick summary'}</span>
                </div>
                <Code2 className="w-5 h-5 text-[#3be3ff]" />
              </div>
              <div className="p-6 space-y-3 text-sm text-slate-200 leading-relaxed">
                {aboutLines.length > 0 ? (
                  aboutLines.map((line, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-[#3be3ff] mt-0.5" />
                      <p className="flex-1">{line}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400">-</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>

      {cvOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-2 md:px-4 py-4 md:py-8">
          <div className="absolute inset-0" onClick={() => setCvOpen(false)} aria-hidden="true"></div>
          <div
            className="relative bg-[#0f172a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
            style={{ width: '98vw', height: '95vh', maxWidth: 'none', maxHeight: '95vh' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0b1221]">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#f9b234]">{t(site.home?.cv_modal_kicker) || 'CV Preview'}</p>
                <h3 className="text-lg font-semibold text-white">{t(site.home?.cv_modal_title) || 'View and download the PDF'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setCvOpen(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-white/5 bg-[#0b1221]/80 text-sm text-slate-200">
              <FileDown className="w-4 h-4 text-[#f9b234]" />
              <a
                href={pdfUrl}
                download
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f9b234] text-slate-950 font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition"
              >
                {t(site.home?.cv_modal_download) || 'Download PDF'}
              </a>
              <span className="text-slate-500">{t(site.home?.cv_modal_or) || 'or'}</span>
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-[#3be3ff] hover:text-[#f9b234] transition">
                {t(site.home?.cv_modal_open_new_tab) || 'Open in new tab'}
              </a>
            </div>

            <div className="flex-1 bg-black/30 rounded-b-3xl">
              <div className="w-full h-full">
                {pdfStatus === 'loading' && (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm gap-2">
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-white/20 border-t-[#f9b234] animate-spin"></span>
                    {t(site.home?.cv_modal_loading) || 'Loading PDFÔÇĞ'}
                  </div>
                )}
                {pdfStatus === 'ready' && (
                  <object data={pdfUrl} type="application/pdf" className="w-full h-full" style={{ width: '100%', height: '100%' }}>
                    <div className="p-4 text-sm text-slate-200">{t(site.home?.cv_modal_pdf_fallback) || 'Your browser cannot preview PDFs.'}</div>
                  </object>
                )}
                {pdfStatus === 'unavailable' && (
                  <div className="w-full h-full flex items-center justify-center p-4 text-sm text-slate-200 text-center">
                    {t(site.home?.cv_modal_unavailable) || 'Preview is unavailable right now, but you can download the PDF above.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
