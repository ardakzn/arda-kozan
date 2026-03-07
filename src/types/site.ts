import type { LocalizedString } from './i18n';

export type SiteLanguage = {
  code: string;
  label: string;
};

export type SiteData = {
  languages: SiteLanguage[];
  default_language: string;
  navbar: {
    brand: LocalizedString;
    nav_home: LocalizedString;
    nav_projects: LocalizedString;
  };
  links: {
    email: string;
    github_url: string;
    linkedin_url: string;
    cv_pdf_url: string;
    goatcounter_code?: string;
  };
  home: {
    badge: LocalizedString;
    headline: LocalizedString;
    lead: LocalizedString;
    cta_projects: LocalizedString;
    cta_cv: LocalizedString;
    cta_email: LocalizedString;
    about_card_title: LocalizedString;
    about_card_lines: LocalizedString;
    cv_modal_kicker: LocalizedString;
    cv_modal_title: LocalizedString;
    cv_modal_download: LocalizedString;
    cv_modal_or: LocalizedString;
    cv_modal_open_new_tab: LocalizedString;
    cv_modal_loading: LocalizedString;
    cv_modal_pdf_fallback: LocalizedString;
    cv_modal_unavailable: LocalizedString;
  };
  projects_page: {
    kicker: LocalizedString;
    title: LocalizedString;
    lead: LocalizedString;
    empty_title: LocalizedString;
    empty_lead: LocalizedString;
    view_details: LocalizedString;
  };
  footer: {
    text: LocalizedString;
  };
};
