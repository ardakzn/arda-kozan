import type { SiteData } from '../types/site';
import { isAdminEnabled } from './admin';
import { loadDraftSite } from './siteDraft';
import { withBaseUrl } from './paths';

export function getDefaultSite(): SiteData {
  return {
    languages: [
      { code: 'en', label: 'EN' },
      { code: 'tr', label: 'TR' },
    ],
    default_language: 'en',
    navbar: {
      brand: { en: 'Codefolio', tr: 'Codefolio' },
      nav_home: { en: 'Home', tr: 'Ana Sayfa' },
      nav_projects: { en: 'Projects', tr: 'Projeler' },
    },
    links: {
      email: 'hello@yourdomain.com',
      github_url: 'https://github.com',
      linkedin_url: 'https://linkedin.com',
      cv_pdf_url: '/assets/CV.pdf',
      goatcounter_code: '',
    },
    home: {
      badge: { en: 'Case Studies', tr: 'Öne Çıkan Çalışmalar' },
      headline: { en: 'Developer-focused, minimal portfolio', tr: 'Geliştirici odaklı minimal portfolyo' },
      lead: {
        en: 'A portfolio focused on system design and interactive code walkthroughs. Clean visuals, high readability, and strong DX.',
        tr: 'Sistem tasarımı ve interaktif kod anlatımları odaklı bir portfolyo. Temiz görsel dil, yüksek okunabilirlik ve iyi DX.',
      },
      cta_projects: { en: 'Browse projects', tr: 'Projeleri incele' },
      cta_cv: { en: 'View CV', tr: "CV'yi incele" },
      cta_email: { en: 'Email', tr: 'E-posta' },
      about_card_title: { en: 'Quick summary', tr: 'Kısa özet' },
      about_card_lines: {
        en: [
          'Backend + frontend bridge: API design, data modeling, interactive UI.',
          'Documentation-minded and observability-driven workflow.',
          'Focus: TypeScript/React, Node.js, system design, performance, DX.',
        ].join('\n'),
        tr: [
          'Backend + frontend köprüsü: API tasarımı, veri modelleme, etkileşimli UI.',
          'Dokümantasyon ve gözlemlenebilirlik odaklı çalışma.',
          'Odak: TypeScript/React, Node.js, sistem tasarımı, performans, DX.',
        ].join('\n'),
      },
      cv_modal_kicker: { en: 'CV Preview', tr: 'CV Önizleme' },
      cv_modal_title: { en: 'View and download the PDF', tr: "PDF'i buradan inceleyebilir ve indirebilirsin" },
      cv_modal_download: { en: 'Download PDF', tr: "PDF'i indir" },
      cv_modal_or: { en: 'or', tr: 'veya' },
      cv_modal_open_new_tab: { en: 'Open in new tab', tr: 'Yeni sekmede aç' },
      cv_modal_loading: { en: 'Loading PDF…', tr: 'PDF yükleniyor…' },
      cv_modal_pdf_fallback: { en: 'Your browser cannot preview PDFs.', tr: 'Tarayıcın PDF önizlemeyi desteklemiyor.' },
      cv_modal_unavailable: {
        en: 'Preview is unavailable right now, but you can download the PDF above.',
        tr: 'PDF şu anda önizlenemiyor, ancak yukarıdan indirebilirsin.',
      },
    },
    projects_page: {
      kicker: { en: 'Case Studies', tr: 'Case Studies' },
      title: { en: 'Projects & Technical Notes', tr: 'Projeler ve Teknik Yazılar' },
      lead: {
        en: 'Selected work with code snippets, annotations and architecture notes. Each project has a docs-style detail page.',
        tr: 'Kod parçacıkları, anotasyonlar ve mimari notlarla zenginleştirilmiş seçili çalışmalar. Her projenin docs-style detay sayfası var.',
      },
      empty_title: { en: 'No projects yet', tr: 'Henüz proje eklenmemiş' },
      empty_lead: {
        en: 'Data lives under `public/data`. Update `projects.json` or use the admin panel to generate a new file.',
        tr: 'Veriler `public/data` altında. `projects.json` dosyasını güncelle veya admin panelden yeni dosya üret.',
      },
      view_details: { en: 'View details', tr: 'Detayları gör' },
    },
    footer: {
      text: { en: '© 2026 — Minimal color, high readability.', tr: '© 2026 — Az renk, yüksek okunabilirlik.' },
    },
  };
}

export async function loadSiteFromFile(): Promise<SiteData> {
  const res = await fetch(withBaseUrl('/data/site.json'), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load site.json');
  const data: unknown = await res.json();
  if (!data || typeof data !== 'object') throw new Error('Invalid site.json');
  return data as SiteData;
}

export async function loadSite(): Promise<SiteData> {
  let file: SiteData;
  try {
    file = await loadSiteFromFile();
  } catch {
    file = getDefaultSite();
  }

  if (isAdminEnabled()) {
    const draft = loadDraftSite();
    if (draft) return draft;
  }

  return file;
}

