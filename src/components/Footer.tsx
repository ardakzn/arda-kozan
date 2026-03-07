import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useSiteRuntime } from '../lib/siteRuntime';

function normalizeGoatcounterBase(rawInput: string): string {
  const raw = (rawInput || '').trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, '').replace(/\/count$/i, '');
  }

  if (raw.includes('goatcounter.com')) {
    return `https://${raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '').replace(/\/count$/i, '')}`;
  }

  return `https://${raw}.goatcounter.com`;
}

function counterPathForUrl(pathname: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `/counter/${path}.json`;
}

export default function Footer() {
  const { site, t } = useSiteRuntime();
  const location = useLocation();
  const [views, setViews] = useState<number | null>(null);
  const goatBase = useMemo(() => normalizeGoatcounterBase(site.links?.goatcounter_code || ''), [site.links?.goatcounter_code]);

  useEffect(() => {
    if (!goatBase) {
      setViews(null);
      return;
    }

    const endpoint = `${goatBase}${counterPathForUrl(location.pathname || '/')}`;
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`status ${res.status}`);

        const data: unknown = await res.json();
        const count = Number((data as { count?: number })?.count);
        if (Number.isFinite(count) && count >= 0) setViews(count);
        else setViews(null);
      } catch {
        setViews(null);
      }
    })();

    return () => controller.abort();
  }, [goatBase, location.pathname]);

  return (
    <footer className="relative pt-10 pb-10 border-t border-white/5 text-center text-slate-500">
      <p>{t(site.footer?.text) || '(c) 2026 - Minimal color, high readability.'}</p>
      {views !== null && (
        <div className="pointer-events-none absolute right-2 bottom-2 select-none opacity-35 transition-opacity hover:opacity-70 text-[10px] uppercase tracking-[0.16em] text-[#f9b234]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#f9b234]/25 bg-[#0b101d]/65 px-2 py-1">
            <Eye className="h-3 w-3" />
            {views}
          </span>
        </div>
      )}
    </footer>
  );
}
