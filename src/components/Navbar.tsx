import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { ChevronDown, Github, Linkedin, Menu, X } from 'lucide-react';
import { useSiteRuntime } from '../lib/siteRuntime';

const navLinkBase =
  'px-2.5 py-1.5 sm:px-3 sm:py-2 max-[360px]:px-2 max-[360px]:py-1 rounded-full text-sm sm:text-base max-[360px]:text-xs transition-all duration-300 border border-transparent';

const navLinkActive =
  'text-white border-white/10 bg-white/5 shadow-sm shadow-cyan-500/10';

const navLinkInactive =
  'text-slate-300 hover:text-white hover:border-white/10 hover:-translate-y-0.5';

export default function Navbar() {
  const { site, languages, language, setLanguage, t } = useSiteRuntime();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  const brand = t(site.navbar?.brand);
  const navHome = t(site.navbar?.nav_home);
  const navProjects = t(site.navbar?.nav_projects);
  const githubUrl = site.links?.github_url || 'https://github.com';
  const linkedinUrl = site.links?.linkedin_url || 'https://linkedin.com';

  const currentLangLabel = useMemo(() => {
    const found = languages.find((l) => l.code === language);
    return found?.label || language.toUpperCase();
  }, [language, languages]);

  useEffect(() => {
    if (!langMenuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLangMenuOpen(false);
    };

    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const el = langMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setLangMenuOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [langMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };

    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const el = mobileMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setMobileMenuOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onOverlay = (e: Event) => {
      const detail = (e as CustomEvent).detail as { source?: string; open?: boolean } | undefined;
      if (!detail) return;
      if (detail.source === 'toc' && detail.open) setMobileMenuOpen(false);
    };

    window.addEventListener('codefolio:overlay', onOverlay as EventListener);
    return () => window.removeEventListener('codefolio:overlay', onOverlay as EventListener);
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen((v) => {
      const next = !v;
      window.dispatchEvent(new CustomEvent('codefolio:overlay', { detail: { source: 'nav', open: next } }));
      return next;
    });
    setLangMenuOpen(false);
  };

  const languageSelector =
    languages.length === 2 ? (
      <div className="inline-flex rounded-full border border-white/10 bg-white/5 overflow-hidden">
        {languages.map((l) => {
          const active = l.code === language;
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code)}
              className={`px-3 py-1.5 text-sm sm:text-base transition ${
                active ? 'bg-[#3be3ff] text-slate-950 font-semibold' : 'text-slate-200 hover:bg-white/10'
              } max-[360px]:px-2 max-[360px]:py-1 max-[360px]:text-xs`}
              aria-pressed={active}
              title={l.label}
            >
              {l.label}
            </button>
          );
        })}
      </div>
    ) : languages.length > 2 ? (
      <div ref={langMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setLangMenuOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-3 sm:py-2 max-[360px]:px-2 max-[360px]:py-1 rounded-full text-sm sm:text-base max-[360px]:text-xs border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 transition"
          aria-label="Language"
          aria-haspopup="menu"
          aria-expanded={langMenuOpen}
        >
          <span className="font-semibold">{currentLangLabel}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {langMenuOpen && (
          <div className="absolute right-0 mt-2 w-28 sm:w-32 rounded-2xl border border-white/10 bg-[#0b1221]/95 backdrop-blur shadow-2xl shadow-black/40 overflow-hidden">
            <div className="py-2" role="menu" aria-label="Language options">
              {languages.map((l) => {
                const active = l.code === language;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      setLanguage(l.code);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm max-[360px]:text-xs transition ${
                      active ? 'bg-white/10 text-white font-semibold' : 'text-slate-200 hover:bg-white/5'
                    }`}
                    role="menuitem"
                  >
                    <span className="truncate">{l.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    ) : null;

  const mobileLanguageSelector =
    languages.length > 0 ? (
      <div className="px-2 pb-2">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400 px-2 pt-2 pb-1">Language</div>
        <div className="flex flex-wrap gap-2 px-2 pb-2">
          {languages.map((l) => {
            const active = l.code === language;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  active ? 'bg-[#3be3ff] text-slate-950 border-transparent font-semibold' : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
                }`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <>
      <header id="site-header" className="fixed top-0 left-0 right-0 z-50 w-full border-b border-white/5 bg-[#0c1324]/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="min-w-0 text-white font-semibold tracking-tight text-base sm:text-lg md:text-xl relative truncate"
          >
            {brand || 'Codefolio'}
            <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-[#3be3ff] opacity-70"></span>
          </Link>

          <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 sm:gap-3">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `${navLinkBase} ${isActive ? navLinkActive : navLinkInactive}`
                }
              >
                {navHome || 'Home'}
              </NavLink>
              <NavLink
                to="/projects"
                className={({ isActive }) =>
                  `${navLinkBase} ${isActive ? navLinkActive : navLinkInactive}`
                }
              >
                {navProjects || 'Projects'}
              </NavLink>
              <span className="text-white/15">|</span>
            </div>

            <div className="flex items-center">
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition active:scale-[0.98]"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition active:scale-[0.98]"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>

            <div className="hidden sm:block">{languageSelector}</div>

            <div ref={mobileMenuRef} className="relative sm:hidden">
              <button
                type="button"
                onClick={toggleMobileMenu}
                className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 transition active:scale-[0.98]"
                aria-label="Menu"
                aria-haspopup="dialog"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 sm:hidden">
                  <div
                    className="absolute inset-0 bg-black/30"
                    role="button"
                    tabIndex={-1}
                    aria-label="Close menu"
                    onClick={() => toggleMobileMenu()}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') toggleMobileMenu();
                    }}
                  />

                  <div className="absolute right-4 top-16 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-white/10 bg-[#0b1221]/95 backdrop-blur shadow-2xl shadow-black/40 overflow-hidden">
                    <div className="py-2" role="menu" aria-label="Navigation">
                      <NavLink
                        to="/"
                        end
                        onClick={() => toggleMobileMenu()}
                        className={({ isActive }) =>
                          `block px-4 py-2.5 text-sm transition ${isActive ? 'bg-white/10 text-white font-semibold' : 'text-slate-200 hover:bg-white/5'}`
                        }
                      >
                        {navHome || 'Home'}
                      </NavLink>
                      <NavLink
                        to="/projects"
                        onClick={() => toggleMobileMenu()}
                        className={({ isActive }) =>
                          `block px-4 py-2.5 text-sm transition ${isActive ? 'bg-white/10 text-white font-semibold' : 'text-slate-200 hover:bg-white/5'}`
                        }
                      >
                        {navProjects || 'Projects'}
                      </NavLink>
                    </div>

                    <div className="border-t border-white/10" />
                    {mobileLanguageSelector}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="h-[57px] sm:h-[65px]" aria-hidden="true" />
    </>
  );
}
