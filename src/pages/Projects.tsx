import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Code2, Star } from 'lucide-react';
import type { ProjectWithDetails } from '../types/portfolio';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { loadProjectsList } from '../lib/projects';
import { useSiteRuntime } from '../lib/siteRuntime';
import { withBaseUrl } from '../lib/paths';

const mediaFallbackGradient =
  'radial-gradient(circle at 20% 25%, rgba(59, 227, 255, 0.22), transparent 55%), radial-gradient(circle at 80% 10%, rgba(249, 178, 52, 0.14), transparent 55%), linear-gradient(135deg, rgba(7, 11, 20, 0.95), rgba(16, 26, 47, 0.92))';

export default function Projects() {
  const { site, t } = useSiteRuntime();
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const [videoReadyBySlug, setVideoReadyBySlug] = useState<Record<string, boolean>>({});
  const [showVideoPlaceholderBySlug, setShowVideoPlaceholderBySlug] = useState<Record<string, boolean>>({});
  const placeholderTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    void (async () => {
      try {
        const list = await loadProjectsList();
        setProjects(list);
      } catch (error) {
        console.error('Error loading projects:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    for (const key of Object.keys(placeholderTimersRef.current)) {
      window.clearTimeout(placeholderTimersRef.current[key]);
    }
    placeholderTimersRef.current = {};

    const next: Record<string, boolean> = {};
    for (const project of projects) {
      const video = (project.thumbnail_video_url || '').trim();
      if (!video) continue;
      next[project.slug] = false;
      placeholderTimersRef.current[project.slug] = window.setTimeout(() => {
        setShowVideoPlaceholderBySlug((cur) => {
          if (videoReadyBySlug[project.slug]) return cur;
          return { ...cur, [project.slug]: true };
        });
      }, 150);
    }
    setShowVideoPlaceholderBySlug(next);

    return () => {
      for (const key of Object.keys(placeholderTimersRef.current)) {
        window.clearTimeout(placeholderTimersRef.current[key]);
      }
      placeholderTimersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.map((p) => p.slug).join('|')]);

  const markVideoReady = (slug: string) => {
    setVideoReadyBySlug((cur) => ({ ...cur, [slug]: true }));
    const timer = placeholderTimersRef.current[slug];
    if (timer) window.clearTimeout(timer);
    setShowVideoPlaceholderBySlug((cur) => ({ ...cur, [slug]: false }));
  };

  return (
    <div
      className="min-h-screen text-slate-100 relative overflow-x-hidden"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(59, 227, 255, 0.08), transparent 25%), radial-gradient(circle at 80% 10%, rgba(249, 178, 52, 0.08), transparent 25%), linear-gradient(135deg, #060b16 0%, #0e1526 100%)',
      }}
    >
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[#f9b234]">{t(site.projects_page?.kicker) || 'Case Studies'}</p>
          <h1 className="text-4xl font-semibold text-white mt-2">{t(site.projects_page?.title) || 'Projects'}</h1>
          <p className="text-slate-300 mt-3 max-w-2xl">{t(site.projects_page?.lead)}</p>
        </header>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white/10 border-t-[#3be3ff]"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <Code2 className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-slate-300 text-lg mb-2">{t(site.projects_page?.empty_title) || 'No projects yet'}</p>
            <p className="text-slate-500 text-sm max-w-xl mx-auto">{t(site.projects_page?.empty_lead)}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 items-start">
            {projects.map((project) => {
              const video = (project.thumbnail_video_url || '').trim();
              const image = (project.thumbnail_image_url || '').trim();
              const videoSrc = video ? withBaseUrl(video) : '';
              const imageSrc = image ? withBaseUrl(image) : '';
              const hasMedia = !!videoSrc || !!imageSrc;
              const summary = (t(project.summary) || '').trim();
              const tech = project.tech_stack || [];
              const title = t(project.title) || '';
              const isFeatured = !!project.featured;

              return (
                <Link
                  key={project.id}
                  to={`/project/${project.slug}`}
                  className={[
                    'group relative rounded-3xl overflow-hidden border bg-[#101a2f]/80 shadow-lg shadow-black/30',
                    'hover:-translate-y-1 hover:-rotate-[0.25deg] transition-all flex flex-col',
                    isFeatured
                      ? 'border-[#f9b234]/55 shadow-[0_18px_42px_rgba(0,0,0,0.45),0_0_0_1px_rgba(249,178,52,0.24)]'
                      : 'border-white/5',
                    hasMedia ? 'md:h-[360px]' : '',
                  ].join(' ')}
                  style={{ backgroundImage: 'linear-gradient(135deg, rgba(59, 227, 255, 0.05), rgba(249, 178, 52, 0.05))' }}
                >
                  {isFeatured && (
                    <div className="absolute left-3 top-3 z-30">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f9b234]/45 bg-[#1b1607]/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f9b234] shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                        <Star className="h-3.5 w-3.5 fill-[#f9b234] text-[#f9b234]" />
                        Featured
                      </span>
                    </div>
                  )}

                  {isFeatured && (
                    <div className="pointer-events-none absolute inset-0 z-[1] rounded-3xl ring-1 ring-inset ring-[#f9b234]/25" />
                  )}

                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-[#3be3ff]/10 to-[#f9b234]/10"></div>

                    <div className="relative z-10 flex flex-col flex-1 transition duration-200 group-hover:blur-[1px] group-hover:brightness-90">
                      {hasMedia && (
                      <div className="relative w-full pt-[56.25%] md:pt-0 md:h-[58%] overflow-hidden">
                        <div className="absolute inset-0" style={{ backgroundImage: mediaFallbackGradient }} />

                        {!videoSrc && imageSrc && (
                          <img
                            src={imageSrc}
                            alt={title}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}

                        {videoSrc && (
                          <video
                            src={videoSrc}
                            muted
                            playsInline
                            loop
                            autoPlay
                            preload="metadata"
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                              videoReadyBySlug[project.slug] ? 'opacity-100' : 'opacity-0'
                            }`}
                            onLoadedData={() => markVideoReady(project.slug)}
                            onError={(e) => {
                              (e.currentTarget as HTMLVideoElement).style.display = 'none';
                            }}
                          />
                        )}

                        {videoSrc && !videoReadyBySlug[project.slug] && showVideoPlaceholderBySlug[project.slug] && (
                          <div className="absolute inset-0">
                            <div className="absolute inset-0 bg-gradient-to-t from-[#060b16]/75 via-[#060b16]/45 to-transparent" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="relative w-[84%] max-w-[520px] rounded-3xl border border-white/10 bg-[#0b1221]/40 backdrop-blur-sm p-5 shadow-2xl shadow-black/40">
                                <div className="flex items-center gap-4">
                                  <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 grid place-items-center">
                                    <div className="w-0 h-0 border-y-[8px] border-y-transparent border-l-[13px] border-l-white/70 translate-x-[1px]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="h-3 w-40 rounded-full bg-white/10 motion-reduce:animate-none animate-pulse" />
                                    <div className="mt-3 h-3 w-56 max-w-full rounded-full bg-white/10 motion-reduce:animate-none animate-pulse" />
                                  </div>
                                </div>
                                <div className="mt-5 h-2 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full w-1/3 bg-white/15 motion-reduce:animate-none animate-pulse" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-[#101a2f]/90 via-transparent to-transparent"></div>
                      </div>
                    )}

                    <div
                      className={`relative ${hasMedia ? 'p-2.5 sm:p-4 md:flex-[1]' : 'p-5 sm:p-6'} ${
                        summary || tech.length > 0 ? 'space-y-2 sm:space-y-2.5' : 'space-y-2'
                      }`}
                    >
                      <h3
                        className={`font-semibold text-white group-hover:text-[#3be3ff] transition-colors ${
                          hasMedia ? 'text-[17px] leading-tight sm:text-xl' : 'text-xl sm:text-2xl'
                        }`}
                      >
                        {title}
                      </h3>
                      {summary && (
                        <p
                          className={`text-slate-300 leading-relaxed ${
                            hasMedia ? 'text-[12px] sm:text-sm line-clamp-1 sm:line-clamp-2' : 'text-sm line-clamp-3'
                          }`}
                        >
                          {summary}
                        </p>
                      )}
                      {tech.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {tech.map((techItem, techIdx) => (
                            <span
                              key={`${techItem}-${techIdx}`}
                              className="px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full border border-white/10"
                              style={{
                                color: techIdx % 2 === 0 ? '#3be3ff' : '#f9b234',
                                borderColor: techIdx % 2 === 0 ? '#3be3ff33' : '#f9b23433',
                                backgroundColor: techIdx % 2 === 0 ? '#3be3ff0d' : '#f9b2340d',
                              }}
                            >
                              {techItem}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pointer-events-none absolute inset-0 z-20 rounded-3xl overflow-hidden opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition duration-200 bg-[#060b16]/45">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#3be3ff] text-slate-950 font-semibold shadow-lg shadow-cyan-500/25">
                        {t(site.projects_page?.view_details) || 'View details'} <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Footer />
      </div>
    </div>
  );
}
