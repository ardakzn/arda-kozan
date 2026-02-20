import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUp, ArrowUpRight, Calendar, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import type { ProjectWithDetails } from '../types/portfolio';
import InteractiveCodeViewer from '../components/InteractiveCodeViewer';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { loadProjectsList } from '../lib/projects';
import { loadSnippetsFromFile, type CodeSnippetWithAnnotations } from '../lib/snippets';
import RichText from '../components/RichText';
import { useSiteRuntime } from '../lib/siteRuntime';
import { extractMarkdownHeadings } from '../lib/markdown';
import type { LocalizedString } from '../types/i18n';
import { withBaseUrl } from '../lib/paths';

const uiProjectNotFound: LocalizedString = { en: 'Project not found', tr: 'Proje bulunamadı' };
const uiBackHome: LocalizedString = { en: 'Back to home', tr: 'Ana sayfaya dön' };
const uiBackProjects: LocalizedString = { en: 'Back to projects', tr: 'Tüm projelere dön' };
const uiTocTitle: LocalizedString = { en: 'Table of contents', tr: 'İçindekiler' };
const uiOverviewLabel: LocalizedString = { en: 'Overview', tr: 'Genel' };
const uiSectionLabel: LocalizedString = { en: 'Section', tr: 'Bölüm' };
const uiScrollTop: LocalizedString = { en: 'Scroll to top', tr: 'Yukarı çık' };
const uiClose: LocalizedString = { en: 'Close', tr: 'Kapat' };

export default function ProjectDetail() {
  const { t } = useSiteRuntime();
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [snippets, setSnippets] = useState<CodeSnippetWithAnnotations[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightSection, setHighlightSection] = useState<string | null>(null);
  const [heroVideoReady, setHeroVideoReady] = useState(false);
  const [heroShowPlaceholder, setHeroShowPlaceholder] = useState(false);

  const [showFloatingNav, setShowFloatingNav] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [mobileTocTop, setMobileTocTop] = useState<number>(0);
  const [tocExpandedBySection, setTocExpandedBySection] = useState<Record<string, boolean>>({});
  const [tocExpandedByGroup, setTocExpandedByGroup] = useState<Record<string, boolean>>({});

  const hasExtraContent = (project?.content_blocks?.length ?? 0) > 0;

  const snippetById = useMemo(() => {
    const map = new Map<string, CodeSnippetWithAnnotations>();
    for (const s of snippets || []) map.set(s.id, s);
    return map;
  }, [snippets]);

  const contentBlocks = useMemo(() => {
    const list = (project?.content_blocks || []).slice();
    const withOrder = list.map((b, idx) => ({ ...b, order_index: Number.isFinite(b.order_index) ? b.order_index : idx }));
    withOrder.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    return withOrder;
  }, [project?.content_blocks]);

  const localizedDescription = useMemo(() => (project ? t(project.description) : ''), [project, t]);
  const localizedTitle = useMemo(() => (project ? t(project.title) : ''), [project, t]);
  const localizedSummary = useMemo(() => (project ? t(project.summary) : ''), [project, t]);
  const projectLinks = useMemo(
    () => (project?.links || []).filter((link) => (link?.url || '').trim().length > 0),
    [project?.links],
  );
  const periodStart = (t(project?.period_start) || '').trim();
  const periodEnd = (t(project?.period_end) || '').trim();
  const periodLabel = periodStart && periodEnd ? `${periodStart} - ${periodEnd}` : periodStart || periodEnd;

  const getFaviconUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
    } catch {
      return '';
    }
  };

  const resolveProjectUrl = (url: string) => {
    const trimmed = (url || '').trim();
    if (!trimmed) return '';
    if (/^[a-zA-Z]+:\/\//.test(trimmed)) return trimmed;
    return withBaseUrl(trimmed);
  };

  const toc = useMemo(() => {
    const groupHeadings = (items: { id: string; label: string; level: 2 | 3 }[]) => {
      const groups: { id: string; label: string; children: { id: string; label: string }[] }[] = [];
      let current: { id: string; label: string; children: { id: string; label: string }[] } | null = null;

      for (const item of items) {
        if (item.level === 2) {
          current = { id: item.id, label: item.label, children: [] };
          groups.push(current);
          continue;
        }

        if (current) {
          current.children.push({ id: item.id, label: item.label });
        } else {
          groups.push({ id: item.id, label: item.label, children: [] });
        }
      }

      return groups;
    };

    const overviewHeadings = extractMarkdownHeadings(localizedDescription || '', 'overview--');
    const sections: {
      id: string;
      label: string;
      groups: { id: string; label: string; children: { id: string; label: string }[] }[];
    }[] = [
      { id: 'overview', label: t(uiOverviewLabel), groups: groupHeadings(overviewHeadings) },
    ];

    if (hasExtraContent) {
      contentBlocks.forEach((b, idx) => {
        const sectionId = `content-${b.id || idx}`;
        const headings = extractMarkdownHeadings(t(b.content) || '', `${sectionId}--`);
        sections.push({ id: sectionId, label: (t(b.title) || '').trim() || `${t(uiSectionLabel)} ${idx + 1}`, groups: groupHeadings(headings) });
      });
    }

    return sections;
  }, [contentBlocks, hasExtraContent, localizedDescription, t]);

  useEffect(() => {
    setTocExpandedBySection((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const sec of toc) {
        if (sec.groups.length === 0) {
          delete next[sec.id];
          continue;
        }
        if (next[sec.id] === undefined) next[sec.id] = true;
      }
      return next;
    });
  }, [toc]);

  useEffect(() => {
    setTocExpandedByGroup((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const sec of toc) {
        for (const g of sec.groups) {
          const key = `${sec.id}::${g.id}`;
          if (g.children.length === 0) {
            delete next[key];
            continue;
          }
          if (next[key] === undefined) next[key] = true;
        }
      }
      return next;
    });
  }, [toc]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    setMobileTocOpen(false);

    const siteHeader = document.getElementById('site-header');
    const tocBar = document.getElementById('project-toc-bar');
    const headerH = siteHeader ? siteHeader.getBoundingClientRect().height : 64;
    const tocH = tocBar ? tocBar.getBoundingClientRect().height : 0;
    const offset = headerH + tocH + 20;

    const rawTop = el.getBoundingClientRect().top + window.scrollY - offset;
    const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const top = Math.min(Math.max(0, rawTop), maxTop);
    window.scrollTo({ top, behavior: 'smooth' });

    setHighlightSection(id);
    window.setTimeout(() => setHighlightSection((cur) => (cur === id ? null : cur)), 900);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setHighlightSection('overview');
    window.setTimeout(() => setHighlightSection((cur) => (cur === 'overview' ? null : cur)), 900);
  };

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      try {
        const [list, snippetList] = await Promise.all([loadProjectsList(), loadSnippetsFromFile()]);
        const projectData = list.find((p) => p.slug === slug) || null;
        setProject(projectData as ProjectWithDetails | null);
        setSnippets(snippetList);
        setHeroVideoReady(false);
        setHeroShowPlaceholder(false);
      } catch (error) {
        console.error('Error loading project:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    if (!project?.thumbnail_video_url) {
      setHeroShowPlaceholder(false);
      return;
    }
    setHeroShowPlaceholder(false);
    const id = window.setTimeout(() => setHeroShowPlaceholder(true), 150);
    return () => window.clearTimeout(id);
  }, [project?.thumbnail_video_url, project?.slug]);

  useEffect(() => {
    const onScroll = () => setShowFloatingNav(window.scrollY > 320);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!hasExtraContent) setMobileTocOpen(false);
  }, [hasExtraContent]);

  useEffect(() => {
    if (!mobileTocOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileTocOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileTocOpen]);

  useEffect(() => {
    if (!mobileTocOpen) return;

    const recalc = () => {
      const header = document.getElementById('site-header');
      const bar = document.getElementById('project-toc-bar');
      const headerH = header ? header.getBoundingClientRect().height : 0;
      const barH = bar ? bar.getBoundingClientRect().height : 0;
      setMobileTocTop(headerH + barH + 8);
    };

    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, { passive: true });
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc);
    };
  }, [mobileTocOpen]);

  useEffect(() => {
    const onOverlay = (e: Event) => {
      const detail = (e as CustomEvent).detail as { source?: string; open?: boolean } | undefined;
      if (!detail) return;
      if (detail.source === 'nav' && detail.open) setMobileTocOpen(false);
    };

    window.addEventListener('codefolio:overlay', onOverlay as EventListener);
    return () => window.removeEventListener('codefolio:overlay', onOverlay as EventListener);
  }, []);

  const renderSnippet = (id: string, caption?: string) => {
    const snip = snippetById.get(id) || null;
    if (!snip) return null;
    const summaryText = (caption || '').trim() || (t(snip.description) || '').trim();
    return (
      <details className="group my-4 rounded-3xl border border-white/5 bg-[#101a2f]/70 overflow-hidden shadow-lg shadow-black/20">
        <summary className="cursor-pointer select-none px-5 py-4 flex items-start justify-between gap-4 hover:bg-white/5 transition [&::-webkit-details-marker]:hidden [&::marker]:hidden">
          <div className="min-w-0">
            <div className="text-base font-semibold text-white truncate">{t(snip.title) || snip.id}</div>
            {summaryText && <div className="text-sm text-slate-300 mt-1 line-clamp-2">{summaryText}</div>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-slate-100 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
              {(snip.language || '').toUpperCase()}
            </span>
            <ChevronDown className="w-5 h-5 text-slate-300 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="border-t border-white/5">
          <div className="p-4">
            <InteractiveCodeViewer snippet={snip} annotations={snip.annotations || []} hideHeader />
          </div>
        </div>
      </details>
    );
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-slate-100"
        style={{ background: 'linear-gradient(135deg, #060b16, #0e1526)' }}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/10 border-t-[#3be3ff]"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-slate-100"
        style={{ background: 'linear-gradient(135deg, #060b16, #0e1526)' }}
      >
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-semibold text-white">{t(uiProjectNotFound)}</h1>
          <Link to="/" className="inline-flex items-center gap-2 text-[#3be3ff] hover:text-[#f9b234] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t(uiBackHome)}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-slate-100 relative overflow-x-hidden"
      style={{
        background:
          'radial-gradient(circle at 15% 20%, rgba(59, 227, 255, 0.08), transparent 25%), radial-gradient(circle at 80% 10%, rgba(249, 178, 52, 0.08), transparent 25%), linear-gradient(135deg, #060b16 0%, #0e1526 100%)',
      }}
    >
      <div className="sticky top-0 z-50">
        <Navbar />

        {hasExtraContent && (
          <div id="project-toc-bar" className="min-[1700px]:hidden border-b border-white/5 bg-[#0c1324]/55 backdrop-blur">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
              <button
                type="button"
                onClick={() =>
                  setMobileTocOpen((v) => {
                    const next = !v;
                    window.dispatchEvent(new CustomEvent('codefolio:overlay', { detail: { source: 'toc', open: next } }));
                    return next;
                  })
                }
                className="w-full inline-flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#101a2f]/35 px-4 py-3 text-sm text-white hover:bg-[#101a2f]/50 transition active:scale-[0.99]"
                aria-expanded={mobileTocOpen}
                aria-controls="mobile-toc-panel"
              >
                <span className="font-semibold">{t(uiTocTitle)}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-200 transition-transform ${mobileTocOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {hasExtraContent && mobileTocOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 min-[1700px]:hidden"
            role="button"
            tabIndex={-1}
            aria-label="Close table of contents"
            onClick={() => setMobileTocOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMobileTocOpen(false);
            }}
          />
          <div
            id="mobile-toc-panel"
            className="fixed z-50 left-4 right-4 min-[1700px]:hidden"
            style={{ top: mobileTocTop }}
          >
            <div className="rounded-3xl border border-white/10 bg-[#101a2f]/95 backdrop-blur shadow-2xl shadow-black/40 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-white/10">
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-2 text-sm text-white hover:text-[#3be3ff] transition"
                  onClick={() => setMobileTocOpen(false)}
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t(uiBackProjects)}
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileTocOpen(false)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition active:scale-[0.98]"
                >
                  {t(uiClose)}
                </button>
              </div>

              <div className="max-h-[55vh] overflow-y-auto overflow-x-hidden p-2">
                {toc.map((sec) => (
                  <div key={sec.id} className="mb-2">
                    <div className="grid grid-cols-[1.25rem,1fr] items-center gap-2 px-1">
                      {sec.groups.length > 0 ? (
                        <button
                          type="button"
                          aria-label={tocExpandedBySection[sec.id] ? 'Collapse section' : 'Expand section'}
                          onClick={() => setTocExpandedBySection((cur) => ({ ...cur, [sec.id]: !cur[sec.id] }))}
                          className="inline-flex items-center justify-center w-5 h-5 rounded-md hover:bg-white/10 transition active:scale-[0.98]"
                        >
                          <ChevronRight
                            className={`w-4 h-4 text-slate-300 transition-transform ${
                              tocExpandedBySection[sec.id] ? 'rotate-90' : ''
                            }`}
                          />
                        </button>
                      ) : (
                        <span className="w-5 h-5" />
                      )}

                      <button
                        type="button"
                        onClick={() => scrollToSection(sec.id)}
                        className="min-w-0 text-left px-3 py-2 rounded-2xl border border-transparent bg-transparent text-slate-200 hover:bg-white/5 hover:border-white/10 transition active:scale-[0.98] active:bg-white/10"
                        title={sec.label}
                      >
                        <span className="block truncate text-sm font-semibold">{sec.label}</span>
                      </button>
                    </div>

                    {sec.groups.length > 0 && tocExpandedBySection[sec.id] && (
                      <div className="mt-1 space-y-0.5">
                        {sec.groups.map((g) => (
                          <div key={g.id} className="space-y-0.5">
                            <div className="grid grid-cols-[1.25rem,1fr] items-center gap-2 px-1" style={{ paddingLeft: 16 }}>
                              {g.children.length > 0 ? (
                                <button
                                  type="button"
                                  aria-label={
                                    tocExpandedByGroup[`${sec.id}::${g.id}`] ? 'Collapse group' : 'Expand group'
                                  }
                                  onClick={() =>
                                    setTocExpandedByGroup((cur) => ({
                                      ...cur,
                                      [`${sec.id}::${g.id}`]: !cur[`${sec.id}::${g.id}`],
                                    }))
                                  }
                                  className="inline-flex items-center justify-center w-5 h-5 rounded-md hover:bg-white/10 transition active:scale-[0.98]"
                                >
                                  <ChevronRight
                                    className={`w-4 h-4 text-slate-400 transition-transform ${
                                      tocExpandedByGroup[`${sec.id}::${g.id}`] ? 'rotate-90' : ''
                                    }`}
                                  />
                                </button>
                              ) : (
                                <span className="w-5 h-5" />
                              )}

                              <button
                                type="button"
                                onClick={() => scrollToSection(g.id)}
                                className="min-w-0 text-left px-3 py-1.5 rounded-2xl border border-transparent bg-transparent hover:bg-white/5 hover:border-white/10 transition active:scale-[0.98] active:bg-white/10"
                                title={g.label}
                              >
                                <span className="block truncate text-sm font-medium text-slate-300">{g.label}</span>
                              </button>
                            </div>

                            {g.children.length > 0 && tocExpandedByGroup[`${sec.id}::${g.id}`] && (
                              <div className="space-y-0.5" style={{ paddingLeft: 32 }}>
                                {g.children.map((c) => (
                                  <div key={c.id} className="grid grid-cols-[1.25rem,1fr] items-center gap-2 px-1">
                                    <span className="w-5 h-5" />
                                    <button
                                      type="button"
                                      onClick={() => scrollToSection(c.id)}
                                      className="min-w-0 text-left px-3 py-1.5 rounded-2xl border border-transparent bg-transparent hover:bg-white/5 hover:border-white/10 transition active:scale-[0.98] active:bg-white/10"
                                      title={c.label}
                                    >
                                      <span className="block truncate text-sm text-slate-400">{c.label}</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <aside className="hidden min-[1700px]:block fixed left-0 top-20 z-30 w-80 px-4">
        <div className="max-h-[calc(100vh-6rem)] overflow-hidden">
          <div className="px-1">
            <Link
              to="/projects"
              className="inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#101a2f]/35 backdrop-blur px-3 py-2 text-sm text-white hover:bg-[#101a2f]/50 transition"
            >
              <span className="inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 text-[#3be3ff]" />
                {t(uiBackProjects)}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-white/20"></span>
            </Link>
          </div>

          {hasExtraContent && (
            <div className="mt-5 px-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Contents</div>
                <span className="h-px flex-1 bg-white/10"></span>
              </div>

              <nav className="max-h-[calc(100vh-15rem)] overflow-y-auto overflow-x-hidden pr-1 space-y-1">
                {toc.map((sec) => (
                  <div key={sec.id} className="mb-2">
                    <div className="grid grid-cols-[1.25rem,1fr] items-center gap-2 px-1">
                      {sec.groups.length > 0 ? (
                        <button
                          type="button"
                          aria-label={tocExpandedBySection[sec.id] ? 'Collapse section' : 'Expand section'}
                          onClick={() => setTocExpandedBySection((cur) => ({ ...cur, [sec.id]: !cur[sec.id] }))}
                          className="inline-flex items-center justify-center w-5 h-5 rounded-md hover:bg-white/10 transition active:scale-[0.98]"
                        >
                          <ChevronRight
                            className={`w-4 h-4 text-slate-300 transition-transform ${
                              tocExpandedBySection[sec.id] ? 'rotate-90' : ''
                            }`}
                          />
                        </button>
                      ) : (
                        <span className="w-5 h-5" />
                      )}

                      <button
                        type="button"
                        onClick={() => scrollToSection(sec.id)}
                        className="group min-w-0 text-left px-3 py-2 rounded-2xl border border-transparent bg-transparent text-slate-200 hover:bg-white/5 hover:border-white/10 transition active:scale-[0.98]"
                        title={sec.label}
                      >
                        <span className="block truncate text-[15px] font-semibold leading-snug text-slate-100">{sec.label}</span>
                      </button>
                    </div>

                    {sec.groups.length > 0 && tocExpandedBySection[sec.id] && (
                      <div className="mt-1 space-y-0.5">
                        {sec.groups.map((g) => (
                          <div key={g.id} className="space-y-0.5">
                            <div className="grid grid-cols-[1.25rem,1fr] items-center gap-2 px-1" style={{ paddingLeft: 16 }}>
                              {g.children.length > 0 ? (
                                <button
                                  type="button"
                                  aria-label={tocExpandedByGroup[`${sec.id}::${g.id}`] ? 'Collapse group' : 'Expand group'}
                                  onClick={() =>
                                    setTocExpandedByGroup((cur) => ({
                                      ...cur,
                                      [`${sec.id}::${g.id}`]: !cur[`${sec.id}::${g.id}`],
                                    }))
                                  }
                                  className="inline-flex items-center justify-center w-5 h-5 rounded-md hover:bg-white/10 transition active:scale-[0.98]"
                                >
                                  <ChevronRight
                                    className={`w-4 h-4 text-slate-400 transition-transform ${
                                      tocExpandedByGroup[`${sec.id}::${g.id}`] ? 'rotate-90' : ''
                                    }`}
                                  />
                                </button>
                              ) : (
                                <span className="w-5 h-5" />
                              )}

                              <button
                                type="button"
                                onClick={() => scrollToSection(g.id)}
                                className="group min-w-0 text-left px-3 py-1.5 rounded-2xl border border-transparent bg-transparent hover:bg-white/5 hover:border-white/10 transition active:scale-[0.98]"
                                title={g.label}
                              >
                                <span className="block truncate text-sm font-medium text-slate-300">{g.label}</span>
                              </button>
                            </div>

                            {g.children.length > 0 && tocExpandedByGroup[`${sec.id}::${g.id}`] && (
                              <div className="space-y-0.5" style={{ paddingLeft: 32 }}>
                                {g.children.map((c) => (
                                  <div key={c.id} className="grid grid-cols-[1.25rem,1fr] items-center gap-2 px-1">
                                    <span className="w-5 h-5" />
                                    <button
                                      type="button"
                                      onClick={() => scrollToSection(c.id)}
                                      className="group min-w-0 text-left px-3 py-1.5 rounded-2xl border border-transparent bg-transparent hover:bg-white/5 hover:border-white/10 transition active:scale-[0.98]"
                                      title={c.label}
                                    >
                                      <span className="block truncate text-sm text-slate-400">{c.label}</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          )}
        </div>
      </aside>

      <div className="min-[1700px]:pl-80 min-[1700px]:pr-80">
        <div className="max-w-7xl mx-auto px-4 max-[390px]:px-3 sm:px-6 lg:px-8 py-10 relative">
          {!hasExtraContent && (
            <Link to="/projects" className="min-[1700px]:hidden inline-flex items-center gap-2 text-[#3be3ff] hover:text-[#f9b234] mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {t(uiBackProjects)}
            </Link>
          )}

          <article className="space-y-10">
          <header
            id="overview"
            className={`relative -mx-4 max-[390px]:-mx-3 sm:mx-0 rounded-3xl sm:rounded-[2.5rem] p-[1px] shadow-2xl shadow-black/35 bg-gradient-to-br from-[#3be3ff]/25 via-white/5 to-[#f9b234]/20 transition ${
              highlightSection === 'overview' ? 'ring-2 ring-[#3be3ff]/30' : ''
            }`}
          >
              <div className="relative rounded-3xl sm:rounded-[2.5rem] overflow-hidden bg-[#0b1221]/70">
              <div className="relative w-full pt-[56.25%] sm:pt-0 sm:h-[420px] md:h-[520px]">

                {!project.thumbnail_video_url && project.thumbnail_image_url && (
                  <img
                    src={withBaseUrl(project.thumbnail_image_url)}
                    alt={`${localizedTitle} cover`}
                    className="absolute inset-0 w-full h-full object-contain sm:object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = withBaseUrl('/assets/sample-arch.svg');
                    }}
                  />
                )}

                {project.thumbnail_video_url && (
                  <>
                    <img
                      src={withBaseUrl(project.thumbnail_image_url || '/assets/sample-arch.svg')}
                      alt={`${localizedTitle} poster`}
                      className="absolute inset-0 w-full h-full object-contain sm:object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = withBaseUrl('/assets/sample-arch.svg');
                      }}
                    />
                    <video
                      src={withBaseUrl(project.thumbnail_video_url)}
                      muted
                      playsInline
                      loop
                      autoPlay
                      preload="metadata"
                      className={`absolute inset-0 w-full h-full object-contain sm:object-cover transition-opacity duration-200 ${heroVideoReady ? 'opacity-100' : 'opacity-0'}`}
                      onLoadedData={() => {
                        setHeroVideoReady(true);
                        setHeroShowPlaceholder(false);
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLVideoElement).style.display = 'none';
                      }}
                    />
                  </>
                )}

                {project.thumbnail_video_url && !heroVideoReady && heroShowPlaceholder && (
                  <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(59,227,255,0.22),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(249,178,52,0.14),transparent_55%),linear-gradient(135deg,rgba(7,11,20,0.95),rgba(16,26,47,0.92))]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b1221]/80 via-[#0b1221]/35 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-[84%] max-w-[720px] rounded-3xl border border-white/10 bg-[#0b1221]/35 backdrop-blur-sm p-6 shadow-2xl shadow-black/40">
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

              </div>

              <div className="px-5 sm:px-8 pt-5 sm:pt-6 pb-4 sm:pb-6 bg-[#0b1221]/65 border-t border-white/5">
                {(projectLinks.length > 0 || periodLabel) && (
                  <div className="mt-3 mb-3 flex flex-wrap items-center gap-3">
                    {projectLinks.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {projectLinks.map((link, idx) => {
                          const href = resolveProjectUrl(link.url);
                          const favicon = getFaviconUrl(href);
                          return (
                            <a
                              key={`${link.url}-${idx}`}
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="group inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-[#3be3ff]/25 bg-[#0b1221]/70 text-[13px] font-semibold text-slate-100 hover:border-[#3be3ff]/60 hover:bg-[#0f1b33] shadow-[0_6px_18px_rgba(8,15,30,0.35)] transition"
                            >
                              <span className="w-7 h-7 rounded-lg bg-[#0f1b33] border border-white/10 flex items-center justify-center">
                                {favicon ? (
                                  <img
                                    src={favicon}
                                    alt=""
                                    className="w-4 h-4 rounded-sm"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <ArrowUpRight className="w-4 h-4 text-[#3be3ff]" />
                                )}
                              </span>
                              <span className="max-w-[220px] truncate">{t(link.label) || href}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {periodLabel && (
                      <div className="sm:ml-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-[#0b1221]/55 text-[12px] font-semibold text-slate-200 tracking-[0.08em] uppercase">
                        <Calendar className="w-4 h-4 text-[#f9b234]" />
                        <span>{periodLabel}</span>
                      </div>
                    )}
                  </div>
                )}

                {(project.tech_stack || []).length > 0 && (
                  <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible max-w-full pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {(project.tech_stack || []).slice(0, 6).map((tech, idx) => (
                      <span
                        key={`${tech}-${idx}`}
                        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-full border border-white/10 bg-white/5 text-slate-100"
                      >
                        <Tag className="w-3 h-3 text-[#3be3ff]" />
                        {tech}
                      </span>
                    ))}
                  </div>
                )}

                <h1 className="mt-4 text-[clamp(24px,8vw,44px)] sm:text-[clamp(34px,3.4vw,56px)] font-semibold text-white leading-[1.05] sm:leading-tight">
                  {localizedTitle}
                </h1>

                {(localizedSummary || '').trim() && (
                  <p className="mt-2 text-sm sm:text-lg text-slate-200/85 leading-relaxed line-clamp-2">
                    {localizedSummary}
                  </p>
                )}
              </div>

              <div className="px-6 sm:px-8 pb-7 pt-6 bg-[#101a2f]/55 border-t border-white/5">
                <RichText text={localizedDescription} className="text-lg" snippetRenderer={renderSnippet} headingIdPrefix="overview--" />
              </div>
            </div>
          </header>

          {hasExtraContent &&
            contentBlocks.map((blk, idx) => {
              const sectionId = `content-${blk.id || idx}`;
              const title = (t(blk.title) || '').trim() || `${t(uiSectionLabel)} ${idx + 1}`;
              return (
                <section
                  key={sectionId}
                  id={sectionId}
                  className={`bg-[#101a2f]/70 border border-white/5 -mx-4 max-[390px]:-mx-3 sm:mx-0 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-lg shadow-black/20 transition ${
                    highlightSection === sectionId ? 'ring-2 ring-[#3be3ff]/30' : ''
                  }`}
                >
                  <h2 className="text-2xl font-semibold text-white mb-4">{title}</h2>
                  <RichText text={t(blk.content) || ''} className="text-lg" snippetRenderer={renderSnippet} headingIdPrefix={`${sectionId}--`} />
                </section>
              );
            })}
          </article>
        </div>
      </div>

      {showFloatingNav && (
        <div className="fixed z-50 bottom-5 right-4 sm:right-6 flex flex-col gap-2 min-[1700px]:hidden">
          <button
            type="button"
            onClick={scrollToTop}
            className="inline-flex items-center justify-center w-11 h-11 rounded-2xl border border-white/10 bg-[#101a2f]/80 hover:bg-[#101a2f] transition shadow-lg shadow-black/30 backdrop-blur"
            title={t(uiScrollTop)}
            aria-label={t(uiScrollTop)}
          >
            <ArrowUp className="w-5 h-5 text-slate-100" />
          </button>
        </div>
      )}

      <div className="min-[1700px]:pl-80 min-[1700px]:pr-80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Footer />
        </div>
      </div>
    </div>
  );
}
