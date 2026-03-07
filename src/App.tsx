import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import ProjectDetail from './pages/ProjectDetail';
import Projects from './pages/Projects';
import { isAdminEnabled } from './lib/admin';
import { SiteRuntimeProvider, useSiteRuntime } from './lib/siteRuntime';
import { routerBasename } from './lib/paths';

declare global {
  interface Window {
    goatcounter?: {
      count: (params?: { path?: string; title?: string; event?: boolean }) => void;
    };
    __codefolio_last_goat_path?: string;
  }
}

function normalizeGoatcounterEndpoint(rawInput: string): string {
  const raw = (rawInput || '').trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, '').replace(/\/count$/i, '') + '/count';
  }

  if (raw.includes('goatcounter.com')) {
    return `https://${raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '').replace(/\/count$/i, '')}/count`;
  }

  return `https://${raw}.goatcounter.com/count`;
}

function GoatCounterTracker() {
  const { site } = useSiteRuntime();
  const location = useLocation();
  const [scriptReady, setScriptReady] = useState(false);

  const endpoint = useMemo(() => normalizeGoatcounterEndpoint(site.links?.goatcounter_code || ''), [site.links?.goatcounter_code]);

  useEffect(() => {
    const scriptId = 'codefolio-goatcounter-script';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!endpoint) {
      if (existing) existing.remove();
      setScriptReady(false);
      return;
    }

    if (existing) {
      const current = (existing.getAttribute('data-goatcounter') || '').trim();
      if (current === endpoint) {
        setScriptReady(true);
        return;
      }
      existing.remove();
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = 'https://gc.zgo.at/count.js';
    script.setAttribute('data-goatcounter', endpoint);
    script.setAttribute('data-no-onload', 'true');
    script.onload = () => setScriptReady(true);
    script.onerror = () => setScriptReady(false);
    document.head.appendChild(script);
  }, [endpoint]);

  useEffect(() => {
    if (!endpoint || !scriptReady) return;
    if (!window.goatcounter || typeof window.goatcounter.count !== 'function') return;

    const path = `${location.pathname}${location.search || ''}`;
    if (window.__codefolio_last_goat_path === path) return;

    window.goatcounter.count({ path });
    window.__codefolio_last_goat_path = path;
  }, [endpoint, location.pathname, location.search, scriptReady]);

  return null;
}

function App() {
  const AdminPage = isAdminEnabled() ? lazy(() => import('./pages/Admin')) : null;

  return (
    <SiteRuntimeProvider>
      <BrowserRouter basename={routerBasename}>
        <GoatCounterTracker />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/project/:slug" element={<ProjectDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          {AdminPage && (
            <Route
              path="/__admin"
              element={
                <Suspense
                  fallback={<div className="min-h-screen flex items-center justify-center text-slate-200 bg-[#060b16]">Loading admin…</div>}
                >
                  <AdminPage />
                </Suspense>
              }
            />
          )}
        </Routes>
      </BrowserRouter>
    </SiteRuntimeProvider>
  );
}

export default App;

