import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Move } from 'lucide-react';
import type { CodeAnnotation, CodeSnippet, ProjectWithDetails } from '../types/portfolio';
import type { SiteData } from '../types/site';
import type { LocalizedText } from '../types/i18n';
import Navbar from '../components/Navbar';
import RichText from '../components/RichText';
import InteractiveCodeViewer from '../components/InteractiveCodeViewer';
import { clearDraftProjects, loadDraftProjects, saveDraftProjects } from '../lib/projectsDraft';
import { getProjectTags, loadProjectsFromFile, mergeProjects } from '../lib/projects';
import { loadSnippetsFromFile } from '../lib/snippets';
import { clearDraftSnippets, loadDraftSnippets, saveDraftSnippets } from '../lib/snippetsDraft';
import { clearDraftSite, loadDraftSite, saveDraftSite } from '../lib/siteDraft';
import { loadSiteFromFile } from '../lib/site';
import { withBaseUrl } from '../lib/paths';

type EditorProject = ProjectWithDetails;
type EditorSnippet = CodeSnippet & { annotations?: CodeAnnotation[] };
type EditorContentBlock = NonNullable<ProjectWithDetails['content_blocks']>[number];
type EditorProjectLink = NonNullable<ProjectWithDetails['links']>[number];
type EditorSite = SiteData;

type SelectionInfo = {
  startIndex: number;
  endIndex: number;
  line_number: number;
  start_col: number;
  end_col: number;
  selectedText: string;
  isMultiLine: boolean;
};

function normalizeLang(code: string): string {
  return (code || '').trim().toLowerCase();
}

function pickFirstNonEmpty(value: Record<string, string | undefined>): string {
  for (const key of Object.keys(value)) {
    const v = (value[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function resolveLocalizedText(value: LocalizedText | undefined, language: string, defaultLanguage: string): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const lang = normalizeLang(language);
  const def = normalizeLang(defaultLanguage);
  const direct = (value[lang] || '').trim();
  if (direct) return direct;
  const fallback = (value[def] || '').trim();
  if (fallback) return fallback;
  return pickFirstNonEmpty(value);
}

function getTextForLang(value: LocalizedText | undefined, language: string, defaultLanguage: string): string {
  if (!value) return '';
  const lang = normalizeLang(language);
  const def = normalizeLang(defaultLanguage);
  if (typeof value === 'string') return lang === def ? value : '';
  return value[lang] || '';
}

function setTextForLang(value: LocalizedText | undefined, language: string, defaultLanguage: string, next: string): LocalizedText {
  const lang = normalizeLang(language);
  const def = normalizeLang(defaultLanguage);
  const trimmed = next;

  if (!value) {
    if (lang === def) return trimmed;
    return { [lang]: trimmed };
  }

  if (typeof value === 'string') {
    if (lang === def) return trimmed;
    if (!trimmed.trim()) return value;
    return { [def]: value, [lang]: trimmed };
  }

  const merged: Record<string, string | undefined> = { ...value, [lang]: trimmed };
  if (!trimmed.trim()) delete merged[lang];
  return merged;
}

function cleanLocalizedText(value: LocalizedText): LocalizedText {
  if (typeof value === 'string') return value.trim();
  const next: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(value)) {
    const t = (v || '').trim();
    if (!t) continue;
    next[normalizeLang(k)] = t;
  }
  return next;
}

function concatAllLanguages(value: LocalizedText | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return Object.values(value)
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join('\n');
}

function replaceInLocalizedText(value: LocalizedText, re: RegExp, replacement: string): LocalizedText {
  if (typeof value === 'string') return value.replace(re, replacement);
  const next: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(value)) {
    if (!v) continue;
    next[k] = v.replace(re, replacement);
  }
  return next;
}

function slugify(input: string): string {
  const replaced = input
    .trim()
    .toLowerCase()
    .replace(/\u0131/g, 'i') // ı -> i
    .replace(/\u011f/g, 'g') // ğ -> g
    .replace(/\u00fc/g, 'u') // ü -> u
    .replace(/\u015f/g, 's') // ş -> s
    .replace(/\u00f6/g, 'o') // ö -> o
    .replace(/\u00e7/g, 'c') // ç -> c
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');

  return replaced
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function nowIso() {
  return new Date().toISOString();
}

function sortContentBlocks(blocks: EditorContentBlock[] | undefined): EditorContentBlock[] {
  const list = (blocks || []).slice();
  const withOrder = list.map((b, idx) => ({
    ...b,
    order_index: Number.isFinite(b.order_index) ? b.order_index : idx,
  }));
  withOrder.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  return withOrder;
}

function reindexContentBlocks(blocks: EditorContentBlock[] | undefined): EditorContentBlock[] {
  return (blocks || []).map((b, idx) => ({ ...b, order_index: idx }));
}

function normalizePublicPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z]+:\/\//.test(trimmed)) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function normalizeProjectLinks(links: EditorProjectLink[] | undefined): EditorProjectLink[] {
  return (links || [])
    .map((link) => {
      const url = (link?.url || '').trim();
      if (!url) return null;
      const label = cleanLocalizedText(link.label || '');
      const kind = (link.kind || '').trim();
      return { label, url, ...(kind ? { kind } : {}) };
    })
    .filter(Boolean) as EditorProjectLink[];
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSnippetIds(text: string): string[] {
  const ids: string[] = [];
  const re = /@snippet\(\s*([^)]+?)\s*\)/g;
  let match: RegExpExecArray | null = null;
  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(text))) {
    const inner = (match[1] || '').trim();
    if (!inner) continue;
    const id = inner.split(',')[0]?.trim();
    if (id) ids.push(id);
  }
  return Array.from(new Set(ids));
}

function getSelectionInfo(code: string, selectionStart: number, selectionEnd: number): SelectionInfo {
  const safeStart = Math.max(0, Math.min(selectionStart, code.length));
  const safeEnd = Math.max(0, Math.min(selectionEnd, code.length));
  const start = Math.min(safeStart, safeEnd);
  const end = Math.max(safeStart, safeEnd);

  const before = code.slice(0, start);
  const startLineNumber = before.split('\n').length; // 1-based
  const lineStartIndex = before.lastIndexOf('\n') + 1; // -1 => 0

  const between = code.slice(start, end);
  const isMultiLine = between.includes('\n');

  const start_col = start - lineStartIndex;

  let end_col = start_col;
  if (start === end) {
    end_col = start_col;
  } else if (isMultiLine) {
    const lineText = code.slice(lineStartIndex, code.indexOf('\n', lineStartIndex) === -1 ? code.length : code.indexOf('\n', lineStartIndex));
    end_col = lineText.length;
  } else {
    end_col = start_col + between.length;
  }

  return {
    startIndex: start,
    endIndex: end,
    line_number: startLineNumber,
    start_col,
    end_col,
    selectedText: between,
    isMultiLine,
  };
}

function newProjectTemplate(): EditorProject {
  const ts = Date.now();
  return {
    id: `proj_${ts}`,
    title: '',
    slug: '',
    summary: '',
    description: '',
    content_blocks: [],
    thumbnail_image_url: '',
    thumbnail_video_url: '',
    links: [],
    period_start: '',
    period_end: '',
    tags: [],
    featured: false,
    order_index: 0,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function ensureProjectLinks(project: EditorProject): EditorProject {
  return { ...project, links: Array.isArray(project.links) ? project.links : [] };
}

function normalizeProjects(projects: EditorProject[]): EditorProject[] {
  return [...projects]
    .map((p) => ({
      ...p,
      content_blocks: reindexContentBlocks(sortContentBlocks(p.content_blocks)),
    }))
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

function normalizeSnippets(list: EditorSnippet[]): EditorSnippet[] {
  return [...list]
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((s) => ({
      ...s,
      annotations: (s.annotations || []).slice().sort((aa, bb) => (aa.line_number ?? 0) - (bb.line_number ?? 0)),
    }));
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'projects' | 'snippets' | 'site'>('projects');
  const [projects, setProjects] = useState<EditorProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [usingDraft, setUsingDraft] = useState(false);
  const didHydrateRef = useRef(false);

  const [snippets, setSnippets] = useState<EditorSnippet[]>([]);
  const [snippetsLoading, setSnippetsLoading] = useState(true);
  const [snippetsError, setSnippetsError] = useState<string | null>(null);
  const [snippetsStatus, setSnippetsStatus] = useState<string | null>(null);
  const [snippetsReloading, setSnippetsReloading] = useState(false);
  const [usingSnippetsDraft, setUsingSnippetsDraft] = useState(false);
  const didHydrateSnippetsRef = useRef(false);

  const [siteData, setSiteData] = useState<EditorSite | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [siteStatus, setSiteStatus] = useState<string | null>(null);
  const [siteReloading, setSiteReloading] = useState(false);
  const [usingSiteDraft, setUsingSiteDraft] = useState(false);
  const didHydrateSiteRef = useRef(false);
  const [siteEditLang, setSiteEditLang] = useState<string>('en');
  const [siteAddLangCode, setSiteAddLangCode] = useState('');
  const [siteAddLangLabel, setSiteAddLangLabel] = useState('');
  const [siteSection, setSiteSection] = useState<'navbar' | 'home' | 'projects' | 'footer'>('navbar');

  const siteLanguages = useMemo(() => {
    const list = siteData?.languages || [];
    return list.length > 0 ? list : [{ code: 'en', label: 'EN' }];
  }, [siteData?.languages]);
  const siteDefaultLang = useMemo(() => normalizeLang(siteData?.default_language || 'en'), [siteData?.default_language]);

  const [projectsEditLang, setProjectsEditLang] = useState<string>('en');
  const [snippetsEditLang, setSnippetsEditLang] = useState<string>('en');

  useEffect(() => {
    const allowed = new Set(siteLanguages.map((l) => normalizeLang(l.code)));
    const def = allowed.has(siteDefaultLang) ? siteDefaultLang : normalizeLang(siteLanguages[0]?.code || 'en');

    setProjectsEditLang((prev) => (allowed.has(normalizeLang(prev)) ? normalizeLang(prev) : def));
    setSnippetsEditLang((prev) => (allowed.has(normalizeLang(prev)) ? normalizeLang(prev) : def));
    setSiteEditLang((prev) => (allowed.has(normalizeLang(prev)) ? normalizeLang(prev) : def));
  }, [siteDefaultLang, siteLanguages]);

  const setEditLanguageAll = (code: string) => {
    const next = normalizeLang(code);
    setSiteEditLang(next);
    setProjectsEditLang(next);
    setSnippetsEditLang(next);
  };

  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(null);
  const selectedSnippetIndex = useMemo(() => {
    if (!selectedSnippetId) return -1;
    return snippets.findIndex((s) => s.id === selectedSnippetId);
  }, [snippets, selectedSnippetId]);
  const selectedSnippet = useMemo(() => {
    if (selectedSnippetIndex < 0) return null;
    return snippets[selectedSnippetIndex] || null;
  }, [snippets, selectedSnippetIndex]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) || null,
    [projects, selectedId],
  );

  const [form, setForm] = useState<EditorProject>(() => newProjectTemplate());
  const [pendingBlockDeleteId, setPendingBlockDeleteId] = useState<string | null>(null);
  const [autoSlug, setAutoSlug] = useState(true);
  const [tagsInput, setTagsInput] = useState('');
  const [snippetSelection, setSnippetSelection] = useState<Record<number, SelectionInfo | null>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [reorderMode, setReorderMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<
    | {
        open: true;
        kind: 'project' | 'snippet' | 'site_language';
        title: string;
        message: string;
        confirmLabel: string;
        cancelLabel: string;
        projectId?: string;
        snippetId?: string;
        languageCode?: string;
      }
    | { open: false }
  >({ open: false });

  const snippetIdsUsedInForm = useMemo(() => {
    const extra = (form.content_blocks || []).map((b) => concatAllLanguages(b.content)).join('\n');
    return extractSnippetIds(`${concatAllLanguages(form.description)}\n${extra}`);
  }, [form.content_blocks, form.description]);
  const snippetIdSet = useMemo(() => new Set(snippets.map((s) => s.id)), [snippets]);
  const snippetIdCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of snippets) map.set(s.id, (map.get(s.id) ?? 0) + 1);
    return map;
  }, [snippets]);

  const projectsBySnippetId = useMemo(() => {
    const map = new Map<string, EditorProject[]>();
    for (const p of projects) {
      const extra = (p.content_blocks || []).map((b) => concatAllLanguages(b.content)).join('\n');
      const ids = extractSnippetIds(`${concatAllLanguages(p.description)}\n${extra}`);
      for (const id of ids) {
        const list = map.get(id) || [];
        list.push(p);
        map.set(id, list);
      }
    }
    return map;
  }, [projects]);

  const selectedSlugConflicts = useMemo(() => {
    const slug = form.slug.trim();
    if (!slug) return false;
    return projects.some((p) => p.slug === slug && p.id !== form.id);
  }, [form.id, form.slug, projects]);

  useEffect(() => {
    const draft = loadDraftProjects();
    const hasDraft = !!draft && draft.length > 0;
    setUsingDraft(hasDraft);

    const load = async () => {
      try {
        const fileList = (await loadProjectsFromFile()) as unknown as EditorProject[];
        const merged = hasDraft ? (mergeProjects(fileList, draft as unknown as EditorProject[]) as unknown as EditorProject[]) : fileList;
        const normalized = normalizeProjects(merged);
        setProjects(normalized);
        setSelectedId(normalized[0]?.id ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const draft = loadDraftSnippets();
    const hasDraft = !!draft && draft.length > 0;
    setUsingSnippetsDraft(hasDraft);

    const load = async () => {
      try {
        const fileList = (await loadSnippetsFromFile()) as unknown as EditorSnippet[];
        const list = hasDraft ? (draft as unknown as EditorSnippet[]) : fileList;
        const normalized = normalizeSnippets(list);
        setSnippets(normalized);
        setSelectedSnippetId((prevId) => {
          if (prevId && normalized.some((s) => s.id === prevId)) return prevId;
          return normalized[0]?.id ?? null;
        });
      } catch (e) {
        setSnippetsError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setSnippetsLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const draft = loadDraftSite();
    const hasDraft = !!draft;
    setUsingSiteDraft(hasDraft);

    const load = async () => {
      try {
        const file = (await loadSiteFromFile()) as unknown as EditorSite;
        const data = hasDraft ? (draft as unknown as EditorSite) : file;
        setSiteData(data);
        const defaultLang = (data.default_language || 'en').toString();
        setSiteEditLang(defaultLang);
      } catch (e) {
        setSiteError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setSiteLoading(false);
      }
    };

    load();
  }, []);

  const loadSiteFileAndReplaceState = async (opts?: { clearDraft?: boolean }) => {
    setSiteReloading(true);
    setSiteStatus(opts?.clearDraft ? 'Reloading site from file (draft cleared)...' : 'Reloading site from file...');
    if (opts?.clearDraft) clearDraftSite();
    setUsingSiteDraft(false);
    didHydrateSiteRef.current = false;
    setSiteError(null);

    try {
      const data = (await loadSiteFromFile()) as unknown as EditorSite;
      setSiteData(data);
      setSiteEditLang((data.default_language || 'en').toString());
      setSiteStatus('Loaded site settings from /data/site.json');
    } catch (e) {
      setSiteError(e instanceof Error ? e.message : 'Unknown error');
      setSiteStatus('Reload failed.');
    } finally {
      setSiteReloading(false);
    }
  };

  const addSiteLanguage = () => {
    if (!siteData) return;
    const rawCode = siteAddLangCode.trim().toLowerCase();
    const rawLabel = siteAddLangLabel.trim();
    if (!rawCode) {
      setSiteStatus('Language code is required.');
      return;
    }
    if (!/^[a-z]{2,5}(-[a-z0-9]{2,8})?$/.test(rawCode)) {
      setSiteStatus('Invalid language code. Example: en, tr, de, pt-br');
      return;
    }
    if (!rawLabel) {
      setSiteStatus('Language label is required.');
      return;
    }
    const exists = (siteData.languages || []).some((l) => (l.code || '').toLowerCase() === rawCode);
    if (exists) {
      setSiteStatus(`Language "${rawCode}" already exists.`);
      return;
    }

    const nextLanguages = [...(siteData.languages || []), { code: rawCode, label: rawLabel }];
    setSiteData({ ...siteData, languages: nextLanguages });
    setSiteEditLang(rawCode);
    setSiteAddLangCode('');
    setSiteAddLangLabel('');
    setSiteStatus(`Added language "${rawCode}". Now fill translations in this language.`);
  };

  const removeSiteLanguage = (code: string) => {
    if (!siteData) return;
    const list = siteData.languages || [];
    if (list.length <= 1) {
      setSiteStatus('At least one language is required.');
      return;
    }

    setConfirmDialog({
      open: true,
      kind: 'site_language',
      title: 'Remove language?',
      message: `“${code}” will be removed from the language list. Existing translations are not deleted; they will just be hidden.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      languageCode: code,
    });
  };

  const loadSnippetsFileAndReplaceState = async (opts?: { clearDraft?: boolean }) => {
    setSnippetsReloading(true);
    setSnippetsStatus(opts?.clearDraft ? 'Reloading snippets from file (draft cleared)...' : 'Reloading snippets from file...');
    if (opts?.clearDraft) clearDraftSnippets();
    setUsingSnippetsDraft(false);
    didHydrateSnippetsRef.current = false;
    setSnippetsError(null);

    try {
      const list = (await loadSnippetsFromFile()) as unknown as EditorSnippet[];
      const normalized = normalizeSnippets(list);
      setSnippets(normalized);
      setSelectedSnippetId(normalized[0]?.id ?? null);
      setSnippetsStatus(`Loaded ${normalized.length} snippets from /data/snippets.json`);
    } catch (e) {
      setSnippetsError(e instanceof Error ? e.message : 'Unknown error');
      setSnippetsStatus('Reload failed.');
    } finally {
      setSnippetsReloading(false);
    }
  };

  const loadFileAndReplaceState = async (opts?: { clearDraft?: boolean }) => {
    setReloading(true);
    setStatus(opts?.clearDraft ? 'Reloading from file (draft cleared)...' : 'Reloading from file...');
    if (opts?.clearDraft) clearDraftProjects();
    setUsingDraft(false);
    didHydrateRef.current = false;
    setError(null);

    try {
      const list = (await loadProjectsFromFile()) as unknown as EditorProject[];
      const normalized = normalizeProjects(list);
      setProjects(normalized);
      const firstId = normalized[0]?.id ?? null;
      setSelectedId(firstId);
      if (firstId) {
        const first = normalized.find((p) => p.id === firstId) || null;
        if (first) {
          setForm(ensureProjectLinks(first));
          setTagsInput(getProjectTags(first).join(', '));
        }
      }
      const rich = normalized.find((p) => p.id === 'proj_richtext_demo') || null;
      setStatus(
        `Loaded ${normalized.length} projects from /data/projects.json` + (rich ? ` · proj_richtext_demo order_index=${rich.order_index}` : ''),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStatus('Reload failed.');
    } finally {
      setReloading(false);
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    const p = projects.find((x) => x.id === selectedId) || null;
    if (!p) return;
    setForm(ensureProjectLinks(p));
    setPendingBlockDeleteId(null);
    setTagsInput(getProjectTags(p).join(', '));
    setAutoSlug(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (autoSlug) {
      setForm((prev) => ({ ...prev, slug: slugify(resolveLocalizedText(prev.title, siteDefaultLang, siteDefaultLang)) }));
    }
  }, [autoSlug, form.title, siteDefaultLang]);

  useEffect(() => {
    if (!confirmDialog.open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmDialog({ open: false });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog.open]);

  useEffect(() => {
    if (loading) return;
    if (!didHydrateRef.current) {
      didHydrateRef.current = true;
      return;
    }
    saveDraftProjects(projects);
    setUsingDraft(true);
  }, [loading, projects]);

  useEffect(() => {
    if (snippetsLoading) return;
    if (!didHydrateSnippetsRef.current) {
      didHydrateSnippetsRef.current = true;
      return;
    }
    saveDraftSnippets(snippets);
    setUsingSnippetsDraft(true);
  }, [snippetsLoading, snippets]);

  useEffect(() => {
    if (siteLoading) return;
    if (!siteData) return;
    if (!didHydrateSiteRef.current) {
      didHydrateSiteRef.current = true;
      return;
    }
    saveDraftSite(siteData);
    setUsingSiteDraft(true);
  }, [siteData, siteLoading]);

  const onNew = () => {
    setSelectedId(null);
    const fresh = newProjectTemplate();
    setForm(ensureProjectLinks(fresh));
    setTagsInput('');
    setAutoSlug(true);
  };

  const reindexProjects = (list: EditorProject[]): EditorProject[] => {
    return list.map((p, i) => ({
      ...p,
      order_index: i,
    }));
  };

  const moveProject = (fromIndex: number, toIndex: number) => {
    setProjects((prev) => {
      if (prev.length < 2) return prev;
      const safeFrom = Math.max(0, Math.min(fromIndex, prev.length - 1));
      const safeTo = Math.max(0, Math.min(toIndex, prev.length - 1));
      if (safeFrom === safeTo) return prev;
      const next = [...prev];
      const [moved] = next.splice(safeFrom, 1);
      next.splice(safeTo, 0, moved);
      return normalizeProjects(reindexProjects(next));
    });
  };

  const moveProjectById = (id: string, dir: -1 | 1) => {
    const fromIndex = projects.findIndex((p) => p.id === id);
    if (fromIndex === -1) return;
    moveProject(fromIndex, fromIndex + dir);
  };

  const addContentBlock = () => {
    const id = `blk_${Date.now()}`;
    const block: EditorContentBlock = {
      id,
      title: '',
      content: '',
      order_index: (form.content_blocks || []).length,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    setForm((prev) => ({ ...prev, content_blocks: reindexContentBlocks([...(prev.content_blocks || []), block]) }));
  };

  const updateContentBlock = (idx: number, patch: Partial<EditorContentBlock>) => {
    setForm((prev) => {
      const blocks = reindexContentBlocks(prev.content_blocks);
      const next = blocks.slice();
      const before = next[idx];
      if (!before) return prev;
      next[idx] = { ...before, ...patch, updated_at: nowIso() };
      return { ...prev, content_blocks: reindexContentBlocks(next) };
    });
  };

  const removeContentBlock = (idx: number) => {
    setForm((prev) => {
      const blocks = reindexContentBlocks(prev.content_blocks);
      const next = blocks.slice();
      next.splice(idx, 1);
      return { ...prev, content_blocks: reindexContentBlocks(next) };
    });
    setPendingBlockDeleteId(null);
  };

  const moveContentBlock = (fromIndex: number, toIndex: number) => {
    setForm((prev) => {
      const blocks = reindexContentBlocks(prev.content_blocks);
      if (blocks.length < 2) return prev;
      const safeFrom = Math.max(0, Math.min(fromIndex, blocks.length - 1));
      const safeTo = Math.max(0, Math.min(toIndex, blocks.length - 1));
      if (safeFrom === safeTo) return prev;
      const next = blocks.slice();
      const [moved] = next.splice(safeFrom, 1);
      next.splice(safeTo, 0, moved);
      return { ...prev, content_blocks: reindexContentBlocks(next) };
    });
  };

  const addProjectLink = () => {
    setForm((prev) => ({
      ...prev,
      links: [...(prev.links || []), { label: '', url: '' }],
    }));
  };

  const updateProjectLink = (idx: number, patch: Partial<EditorProjectLink>) => {
    setForm((prev) => {
      const links = [...(prev.links || [])];
      const current = links[idx] || { label: '', url: '' };
      links[idx] = { ...current, ...patch };
      return { ...prev, links };
    });
  };

  const removeProjectLink = (idx: number) => {
    setForm((prev) => {
      const links = [...(prev.links || [])];
      links.splice(idx, 1);
      return { ...prev, links };
    });
  };

  const upsert = () => {
    const titleForValidation = resolveLocalizedText(form.title, siteDefaultLang, siteDefaultLang).trim();
    const slug = form.slug.trim();
    if (!titleForValidation) {
      setError(`Title is required (${siteDefaultLang.toUpperCase()}).`);
      return;
    }
    if (!slug) {
      setError('Slug is required.');
      return;
    }
    if (selectedSlugConflicts) {
      setError('Slug must be unique.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const derivedOrderIndex = (() => {
      const idx = projects.findIndex((p) => p.id === form.id);
      if (idx >= 0) return Number.isFinite(projects[idx].order_index) ? projects[idx].order_index : idx;
      return projects.length;
    })();

    const nextBlocks = reindexContentBlocks(form.content_blocks).map((b) => ({
      ...b,
      title: cleanLocalizedText(b.title),
      content: cleanLocalizedText(b.content),
    }));

    const updated: EditorProject = {
      ...form,
      slug,
      title: cleanLocalizedText(form.title),
      summary: cleanLocalizedText(form.summary),
      description: cleanLocalizedText(form.description),
      content_blocks: nextBlocks,
      thumbnail_image_url: (form.thumbnail_image_url || '').trim() || undefined,
      thumbnail_video_url: (form.thumbnail_video_url || '').trim() || undefined,
      links: normalizeProjectLinks(form.links),
      period_start: cleanLocalizedText(form.period_start || ''),
      period_end: cleanLocalizedText(form.period_end || ''),
      tags,
      tech_stack: undefined,
      order_index: derivedOrderIndex,
      updated_at: nowIso(),
    };

    setError(null);
    setForm(updated);
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      const next = exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [...prev, updated];
      return normalizeProjects(next);
    });
    setSelectedId(updated.id);
    setAutoSlug(false);
  };

  const onDelete = () => {
    if (!selected) return;
    setConfirmDialog({
      open: true,
      kind: 'project',
      title: 'Delete project?',
      message: `"${resolveLocalizedText(selected.title, projectsEditLang, siteDefaultLang) || selected.id}" will be removed from your local draft. You can restore it via "Reload from file".`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      projectId: selected.id,
    });
  };

  const closeConfirmDialog = () => setConfirmDialog({ open: false });

  const confirmDialogAction = () => {
    if (!confirmDialog.open) return;

    if (confirmDialog.kind === 'project') {
      const projectId = confirmDialog.projectId;
      if (!projectId) return closeConfirmDialog();
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setSelectedId(null);
      setStatus('Project deleted.');
      closeConfirmDialog();
      onNew();
      return;
    }

    if (confirmDialog.kind === 'snippet') {
      const snippetId = confirmDialog.snippetId;
      if (!snippetId) return closeConfirmDialog();

      setSnippets((prev) => {
        const idx = prev.findIndex((s) => s.id === snippetId);
        if (idx < 0) return prev;
        const next = prev.slice();
        next.splice(idx, 1);
        const reindexed = next.map((s, i) => ({ ...s, order_index: i }));
        const nextSelectedId = reindexed[idx]?.id ?? reindexed[idx - 1]?.id ?? null;
        setSelectedSnippetId(nextSelectedId);
        return reindexed;
      });

      setSnippetsStatus('Snippet deleted.');
      closeConfirmDialog();
      return;
    }

    if (confirmDialog.kind === 'site_language') {
      const code = confirmDialog.languageCode;
      if (!code || !siteData) return closeConfirmDialog();
      const list = siteData.languages || [];
      const nextLanguages = list.filter((l) => (l.code || '').toLowerCase() !== code.toLowerCase());
      const nextDefault =
        (siteData.default_language || '').toLowerCase() === code.toLowerCase()
          ? (nextLanguages[0]?.code || 'en')
          : siteData.default_language;
      const nextEdit = siteEditLang.toLowerCase() === code.toLowerCase() ? (nextLanguages[0]?.code || 'en') : siteEditLang;

      setSiteData({ ...siteData, languages: nextLanguages, default_language: nextDefault });
      setSiteEditLang(nextEdit);
      setSiteStatus(`Removed language "${code}".`);
      closeConfirmDialog();
    }
  };

  const onDownload = () => {
    const normalized = normalizeProjects(projects);
    downloadJson('projects.json', normalized);
  };
  const onResetToFile = () => {
    void loadFileAndReplaceState({ clearDraft: true });
  };

  const onDownloadSnippets = () => {
    downloadJson('snippets.json', normalizeSnippets(snippets));
  };

  const onResetSnippetsToFile = () => {
    void loadSnippetsFileAndReplaceState({ clearDraft: true });
  };

  const updateSnippet = (idx: number, patch: Partial<EditorSnippet>) => {
    setSnippets((prev) => {
      const nextList = [...prev];
      const before = (nextList[idx] || {}) as EditorSnippet;
      const next = { ...before, ...patch } as EditorSnippet;

      const fromId = (before.id || '').trim();
      const toId = patch.id !== undefined ? String(patch.id).trim() : '';
      if (patch.id !== undefined && toId && toId !== fromId) {
        if (fromId) {
          const re = new RegExp(`@snippet\\(\\s*${escapeRegExp(fromId)}(\\s*(?:,|\\)))`, 'g');
          setProjects((prevProjects) =>
            prevProjects.map((p) => ({
              ...p,
              description: replaceInLocalizedText(p.description, re, `@snippet(${toId}$1`),
              content_blocks: (p.content_blocks || []).map((b) => ({
                ...b,
                content: replaceInLocalizedText(b.content, re, `@snippet(${toId}$1`),
              })),
            })),
          );
          setForm((prevForm) => ({
            ...prevForm,
            description: replaceInLocalizedText(prevForm.description, re, `@snippet(${toId}$1`),
            content_blocks: (prevForm.content_blocks || []).map((b) => ({
              ...b,
              content: replaceInLocalizedText(b.content, re, `@snippet(${toId}$1`),
            })),
          }));
        }
        next.id = toId;
        next.annotations = (next.annotations || []).map((a) => ({ ...a, code_snippet_id: toId }));
      } else if (patch.id !== undefined) {
        next.id = toId;
      }

      nextList[idx] = next;
      return nextList;
    });
  };

  const loadSnippetFromCodePath = async (snippetIdx: number) => {
    const snippet = snippets[snippetIdx] as EditorSnippet | undefined;
    if (!snippet) return;

    const normalized = normalizePublicPath(snippet.code_path || '');
    if (!normalized) {
      setSnippetsError('Invalid `code_path`. Example: `/code/FancyButton.tsx`');
      setError('Geçersiz `code_path`. Örn: `/code/FancyButton.tsx`');
      return;
    }

    if (snippet.code && snippet.code.trim().length > 0) {
      const ok = window.confirm('Mevcut code alanı dolu. Üzerine yazılsın mı?');
      if (!ok) return;
    }

    try {
      setSnippetsError(null);
      setError(null);
      const res = await fetch(withBaseUrl(normalized), { cache: 'no-store' });
      if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${normalized}`);
      const text = await res.text();
      updateSnippet(snippetIdx, { code: text, code_path: normalized });
      setSnippetSelection((prev) => ({ ...prev, [snippetIdx]: getSelectionInfo(text, 0, 0) }));
    } catch (e) {
      setSnippetsError(e instanceof Error ? e.message : 'Dosya yüklenemedi.');
      setError(e instanceof Error ? e.message : 'Dosya yüklenemedi.');
    }
  };

  const addSnippet = () => {
    const snippetId = `snip_${Date.now()}`;
    setSnippets((prev) =>
      normalizeSnippets([
        ...prev,
        {
          id: snippetId,
          project_id: 'global',
          title: '',
          description: '',
          code: '',
          language: 'typescript',
          order_index: prev.length,
          created_at: nowIso(),
          annotations: [],
        },
      ]),
    );
    setSelectedSnippetId(snippetId);
    setActiveTab('snippets');
  };

  const removeSnippet = (idx: number) => {
    const snip = snippets[idx];
    if (!snip) return;
    setConfirmDialog({
      open: true,
      kind: 'snippet',
      title: 'Delete snippet?',
      message: `"${resolveLocalizedText(snip.title, snippetsEditLang, siteDefaultLang) || snip.id}" will be removed from your local draft. You can restore it via "Reload from file".`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      snippetId: snip.id,
    });
  };

  const updateAnnotation = (snippetIdx: number, annoIdx: number, patch: Partial<CodeAnnotation>) => {
    setSnippets((prev) => {
      const next = [...prev];
      const snippet = next[snippetIdx];
      if (!snippet) return prev;
      const annotations = [...(snippet.annotations || [])];
      annotations[annoIdx] = { ...annotations[annoIdx], ...patch } as CodeAnnotation;
      next[snippetIdx] = { ...snippet, annotations };
      return next;
    });
  };

  const addAnnotation = (snippetIdx: number, defaults?: Partial<CodeAnnotation> & { selectedText?: string }) => {
    setSnippets((prev) => {
      const next = [...prev];
      const snippet = next[snippetIdx];
      if (!snippet) return prev;

      const selectionText = (defaults?.selectedText || '').trim();
      const tooltipTitle = defaults?.tooltip_title ?? (selectionText ? selectionText.slice(0, 48) : '');
      const annotations = [
        ...(snippet.annotations || []),
        {
          id: '',
          code_snippet_id: snippet.id || '',
          line_number: defaults?.line_number ?? 1,
          start_col: defaults?.start_col ?? 0,
          end_col: defaults?.end_col ?? 120,
          tooltip_title: tooltipTitle,
          tooltip_content: defaults?.tooltip_content ?? '',
          detail_type: defaults?.detail_type ?? 'note',
          detail_content: defaults?.detail_content ?? '',
          created_at: nowIso(),
        },
      ];
      next[snippetIdx] = { ...snippet, annotations };
      return next;
    });
  };

  const removeAnnotation = (snippetIdx: number, annoIdx: number) => {
    setSnippets((prev) => {
      const next = [...prev];
      const snippet = next[snippetIdx];
      if (!snippet) return prev;
      const annotations = [...(snippet.annotations || [])];
      annotations.splice(annoIdx, 1);
      next[snippetIdx] = { ...snippet, annotations };
      return next;
    });
  };

  const updateSnippetSelection = (snippetIdx: number, el: HTMLTextAreaElement) => {
    const selectionStart = el.selectionStart ?? 0;
    const selectionEnd = el.selectionEnd ?? 0;
    const info = getSelectionInfo(el.value, selectionStart, selectionEnd);
    setSnippetSelection((prev) => ({ ...prev, [snippetIdx]: info }));
  };

  const quickAddAnnotationFromSelection = (snippetIdx: number) => {
    const info = snippetSelection[snippetIdx];
    if (!info) return;
    if (info.isMultiLine) {
      setError('Çok satırlı seçim: hızlı ekleme için tek bir satır içinde seçim yapın.');
      return;
    }
    setError(null);
    if (!info.selectedText) {
      addAnnotation(snippetIdx, { line_number: info.line_number, start_col: 0, end_col: 120 });
      return;
    }
    addAnnotation(snippetIdx, { line_number: info.line_number, start_col: info.start_col, end_col: info.end_col, selectedText: info.selectedText });
  };

  const quickAddAnnotationAtCursorLine = (snippetIdx: number) => {
    const info = snippetSelection[snippetIdx];
    if (!info) return;
    setError(null);
    addAnnotation(snippetIdx, { line_number: info.line_number, start_col: 0, end_col: 120 });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-200 bg-[#060b16]">
        Loading…
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-slate-100 relative"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(59, 227, 255, 0.08), transparent 25%), radial-gradient(circle at 80% 10%, rgba(249, 178, 52, 0.08), transparent 25%), linear-gradient(135deg, #060b16 0%, #0e1526 100%)',
      }}
    >
      {confirmDialog.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeConfirmDialog}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1221]/95 shadow-2xl shadow-black/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">{confirmDialog.title}</h3>
              <p className="text-sm text-slate-300 mt-2">{confirmDialog.message}</p>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-2 bg-[#0b1221]/70">
              <button
                type="button"
                onClick={closeConfirmDialog}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-slate-200"
              >
                {confirmDialog.cancelLabel}
              </button>
              <button
                type="button"
                onClick={confirmDialogAction}
                className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-100 font-semibold transition"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#f9b234]">Hidden Admin</p>
            <h1 className="text-3xl font-semibold text-white mt-2">
              {activeTab === 'projects' ? 'Projects Editor' : activeTab === 'snippets' ? 'Snippets Editor' : 'Site Settings'}
            </h1>
            <p className="text-slate-300 mt-2">
              {activeTab === 'projects'
                ? 'This panel edits a local draft and can download an updated `projects.json`. To publish, replace `public/data/projects.json` and redeploy.'
                : activeTab === 'snippets'
                  ? 'This panel edits a local draft and can download an updated `snippets.json`. To publish, replace `public/data/snippets.json` and redeploy.'
                  : 'Edit global site text + links (navbar, home, projects page). To publish, replace `public/data/site.json` and redeploy.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setActiveTab('projects')}
                className={`px-4 py-2 text-sm transition ${
                  activeTab === 'projects' ? 'bg-[#3be3ff] text-slate-950 font-semibold' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                Projects
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('snippets')}
                className={`px-4 py-2 text-sm transition ${
                  activeTab === 'snippets' ? 'bg-[#3be3ff] text-slate-950 font-semibold' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                Snippets
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('site')}
                className={`px-4 py-2 text-sm transition ${
                  activeTab === 'site' ? 'bg-[#3be3ff] text-slate-950 font-semibold' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                Site
              </button>
            </div>

            {activeTab === 'projects' ? (
              <>
                <button
                  type="button"
                  onClick={onNew}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={upsert}
                  className="px-4 py-2 rounded-xl bg-[#3be3ff] text-slate-950 font-semibold hover:brightness-110 transition"
                >
                  Save draft
                </button>
                {selected && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-100 transition"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDownload}
                  className="px-4 py-2 rounded-xl bg-[#f9b234] text-slate-950 font-semibold hover:brightness-110 transition"
                >
                  Download `projects.json`
                </button>
              </>
            ) : activeTab === 'snippets' ? (
              <>
                <button
                  type="button"
                  onClick={addSnippet}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const normalized = normalizeSnippets(snippets);
                    setSnippets(normalized);
                    saveDraftSnippets(normalized);
                    setUsingSnippetsDraft(true);
                    setSnippetsStatus('Saved snippets draft.');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#3be3ff] text-slate-950 font-semibold hover:brightness-110 transition"
                >
                  Save draft
                </button>
                {selectedSnippetIndex >= 0 && (
                  <button
                    type="button"
                    onClick={() => removeSnippet(selectedSnippetIndex)}
                    className="px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-100 transition"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDownloadSnippets}
                  className="px-4 py-2 rounded-xl bg-[#f9b234] text-slate-950 font-semibold hover:brightness-110 transition"
                >
                  Download `snippets.json`
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!siteData) return;
                    saveDraftSite(siteData);
                    setUsingSiteDraft(true);
                    setSiteStatus('Saved site draft.');
                  }}
                  disabled={!siteData}
                  className="px-4 py-2 rounded-xl bg-[#3be3ff] text-slate-950 font-semibold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={() => siteData && downloadJson('site.json', siteData)}
                  disabled={!siteData}
                  className="px-4 py-2 rounded-xl bg-[#f9b234] text-slate-950 font-semibold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Download `site.json`
                </button>
              </>
            )}
            {activeTab !== 'site' && (
              <label className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-sm text-slate-200 flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPreview}
                  onChange={(e) => setShowPreview(e.target.checked)}
                  className="accent-[#3be3ff]"
                />
                Preview
              </label>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#101a2f]/55 overflow-hidden">
          <div className="px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-400 text-xs uppercase tracking-[0.2em] mr-1">Languages</span>
              {(siteData?.languages || []).length > 0 ? (
                siteData!.languages.map((l) => (
                  <span
                    key={l.code}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-200"
                    title={l.code}
                  >
                    <span className="font-mono text-xs text-slate-300">{normalizeLang(l.code)}</span>
                    <span className="text-xs">{l.label}</span>
                    <button
                      type="button"
                      onClick={() => removeSiteLanguage(l.code)}
                      className="ml-1 w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition text-slate-200"
                      aria-label={`Remove ${l.code}`}
                      title="Remove language"
                      disabled={!siteData}
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">Loading…</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200">
                <span className="text-slate-400">Edit language</span>
                <select
                  value={siteEditLang}
                  onChange={(e) => setEditLanguageAll(e.target.value)}
                  className="bg-[#0b1221] text-slate-100 border border-white/10 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                  disabled={!siteData}
                >
                  {(siteData?.languages || [{ code: 'en', label: 'EN' }]).map((l) => (
                    <option key={l.code} value={normalizeLang(l.code)} style={{ color: '#0b1221', backgroundColor: '#ffffff' }}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200">
                <span className="text-slate-400">Add language</span>
                <input
                  value={siteAddLangCode}
                  onChange={(e) => setSiteAddLangCode(e.target.value)}
                  placeholder="code (e.g. de)"
                  className="w-28 bg-transparent outline-none placeholder:text-slate-500"
                  disabled={!siteData}
                />
                <span className="text-white/10">|</span>
                <input
                  value={siteAddLangLabel}
                  onChange={(e) => setSiteAddLangLabel(e.target.value)}
                  placeholder="label (e.g. DE)"
                  className="w-28 bg-transparent outline-none placeholder:text-slate-500"
                  disabled={!siteData}
                />
                <button
                  type="button"
                  onClick={addSiteLanguage}
                  disabled={!siteData}
                  className="ml-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>

              <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200">
                <span className="text-slate-400">Default</span>
                <select
                  value={siteData?.default_language || 'en'}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSiteData((prev) => (prev ? { ...prev, default_language: value } : prev));
                  }}
                  className="bg-[#0b1221] text-slate-100 border border-white/10 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                  disabled={!siteData}
                >
                  {(siteData?.languages || [{ code: 'en', label: 'EN' }]).map((l) => (
                    <option key={l.code} value={normalizeLang(l.code)} style={{ color: '#0b1221', backgroundColor: '#ffffff' }}>
                      {normalizeLang(l.code)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        {activeTab === 'projects' && error && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {activeTab === 'snippets' && snippetsError && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {snippetsError}
          </div>
        )}

        {activeTab === 'site' && siteError && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {siteError}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-[#101a2f]/70 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
          {activeTab === 'projects' ? (
            <>
              <div className="text-slate-300">
                Draft: <span className={usingDraft ? 'text-[#3be3ff]' : 'text-slate-400'}>{usingDraft ? 'active' : 'none'}</span>{' '}
                <span className="text-slate-500">(saved in your browser)</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onResetToFile}
                  disabled={reloading}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reloading ? 'Reloading...' : 'Reload from file'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void loadFileAndReplaceState({ clearDraft: true });
                  }}
                  disabled={reloading}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear draft
                </button>
              </div>
            </>
          ) : activeTab === 'snippets' ? (
            <>
              <div className="text-slate-300">
                Draft:{' '}
                <span className={usingSnippetsDraft ? 'text-[#3be3ff]' : 'text-slate-400'}>{usingSnippetsDraft ? 'active' : 'none'}</span>{' '}
                <span className="text-slate-500">(saved in your browser)</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onResetSnippetsToFile}
                  disabled={snippetsReloading}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {snippetsReloading ? 'Reloading...' : 'Reload from file'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void loadSnippetsFileAndReplaceState({ clearDraft: true });
                  }}
                  disabled={snippetsReloading}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear draft
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-slate-300">
                Draft: <span className={usingSiteDraft ? 'text-[#3be3ff]' : 'text-slate-400'}>{usingSiteDraft ? 'active' : 'none'}</span>{' '}
                <span className="text-slate-500">(saved in your browser)</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void loadSiteFileAndReplaceState()}
                  disabled={siteReloading}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {siteReloading ? 'Reloading...' : 'Reload from file'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void loadSiteFileAndReplaceState({ clearDraft: true });
                  }}
                  disabled={siteReloading}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear draft
                </button>
              </div>
            </>
          )}
        </div>
        {activeTab === 'projects' && status && (
          <div className="rounded-2xl border border-white/10 bg-[#101a2f]/40 px-4 py-3 text-xs text-slate-300">
            {status}
          </div>
        )}
        {activeTab === 'snippets' && snippetsStatus && (
          <div className="rounded-2xl border border-white/10 bg-[#101a2f]/40 px-4 py-3 text-xs text-slate-300">
            {snippetsStatus}
          </div>
        )}
        {activeTab === 'site' && siteStatus && (
          <div className="rounded-2xl border border-white/10 bg-[#101a2f]/40 px-4 py-3 text-xs text-slate-300">
            {siteStatus}
          </div>
        )}

        {activeTab === 'site' ? (
          <div className="rounded-3xl border border-white/10 bg-[#101a2f]/70 overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Site Settings</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Controls navbar (all pages), Home (`/`), Projects (`/projects`) and the footer. Draft is stored in your browser.
                </p>
              </div>
            </div>

            {siteLoading ? (
              <div className="px-6 py-8 text-sm text-slate-400">Loading site…</div>
            ) : !siteData ? (
              <div className="px-6 py-8 text-sm text-slate-400">No site data loaded.</div>
            ) : (
              <div className="p-6 space-y-6">
                <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSiteSection('navbar')}
                    className={`px-4 py-2 text-sm transition ${
                      siteSection === 'navbar' ? 'bg-[#3be3ff] text-slate-950 font-semibold' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    Navbar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSiteSection('home')}
                    className={`px-4 py-2 text-sm transition ${
                      siteSection === 'home' ? 'bg-[#3be3ff] text-slate-950 font-semibold' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={() => setSiteSection('projects')}
                    className={`px-4 py-2 text-sm transition ${
                      siteSection === 'projects' ? 'bg-[#3be3ff] text-slate-950 font-semibold' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    Projects
                  </button>
                  <button
                    type="button"
                    onClick={() => setSiteSection('footer')}
                    className={`px-4 py-2 text-sm transition ${
                      siteSection === 'footer' ? 'bg-[#3be3ff] text-slate-950 font-semibold' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    Footer
                  </button>
                </div>

                {siteSection === 'navbar' && (
                <>
                <section className="space-y-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Navbar (all pages)</div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Brand</div>
                      <input
                        value={siteData.navbar.brand?.[siteEditLang] || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSiteData((prev) =>
                            prev
                              ? { ...prev, navbar: { ...prev.navbar, brand: { ...prev.navbar.brand, [siteEditLang]: v } } }
                              : prev,
                          );
                        }}
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Home label</div>
                      <input
                        value={siteData.navbar.nav_home?.[siteEditLang] || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSiteData((prev) =>
                            prev
                              ? { ...prev, navbar: { ...prev.navbar, nav_home: { ...prev.navbar.nav_home, [siteEditLang]: v } } }
                              : prev,
                          );
                        }}
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Projects label</div>
                      <input
                        value={siteData.navbar.nav_projects?.[siteEditLang] || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSiteData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  navbar: { ...prev.navbar, nav_projects: { ...prev.navbar.nav_projects, [siteEditLang]: v } },
                                }
                              : prev,
                          );
                        }}
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Links (language-independent)</div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Email</div>
                      <input
                        value={siteData.links.email || ''}
                        onChange={(e) => setSiteData((prev) => (prev ? { ...prev, links: { ...prev.links, email: e.target.value } } : prev))}
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                        placeholder="hello@yourdomain.com"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CV PDF URL</div>
                      <input
                        value={siteData.links.cv_pdf_url || ''}
                        onChange={(e) => setSiteData((prev) => (prev ? { ...prev, links: { ...prev.links, cv_pdf_url: e.target.value } } : prev))}
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                        placeholder="/assets/CV.pdf"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">GitHub URL</div>
                      <input
                        value={siteData.links.github_url || ''}
                        onChange={(e) => setSiteData((prev) => (prev ? { ...prev, links: { ...prev.links, github_url: e.target.value } } : prev))}
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">LinkedIn URL</div>
                      <input
                        value={siteData.links.linkedin_url || ''}
                        onChange={(e) => setSiteData((prev) => (prev ? { ...prev, links: { ...prev.links, linkedin_url: e.target.value } } : prev))}
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">GoatCounter site code</div>
                      <input
                        value={siteData.links.goatcounter_code || ''}
                        onChange={(e) => setSiteData((prev) => (prev ? { ...prev, links: { ...prev.links, goatcounter_code: e.target.value } } : prev))}
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                        placeholder="your-site-code (or full goatcounter URL)"
                      />
                      <p className="text-xs text-slate-500">
                        Empty = disabled. Example: <code>your-site-code</code> {'->'} tracks with GoatCounter.
                      </p>
                    </label>
                  </div>
                </section>

                </>
                )}

                {siteSection === 'home' && (
                <section className="space-y-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Home (/)</div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Badge</div>
                      <input
                        value={siteData.home.badge?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) => (prev ? { ...prev, home: { ...prev.home, badge: { ...prev.home.badge, [siteEditLang]: e.target.value } } } : prev))
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CTA: Email</div>
                      <input
                        value={siteData.home.cta_email?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev ? { ...prev, home: { ...prev.home, cta_email: { ...prev.home.cta_email, [siteEditLang]: e.target.value } } } : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Headline</div>
                      <input
                        value={siteData.home.headline?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev ? { ...prev, home: { ...prev.home, headline: { ...prev.home.headline, [siteEditLang]: e.target.value } } } : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                        placeholder="Developer-focused, minimal portfolio"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Lead</div>
                      <textarea
                        value={siteData.home.lead?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) => (prev ? { ...prev, home: { ...prev.home, lead: { ...prev.home.lead, [siteEditLang]: e.target.value } } } : prev))
                        }
                        className="w-full min-h-[90px] px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CTA: Projects</div>
                      <input
                        value={siteData.home.cta_projects?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev
                              ? { ...prev, home: { ...prev.home, cta_projects: { ...prev.home.cta_projects, [siteEditLang]: e.target.value } } }
                              : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CTA: CV</div>
                      <input
                        value={siteData.home.cta_cv?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) => (prev ? { ...prev, home: { ...prev.home, cta_cv: { ...prev.home.cta_cv, [siteEditLang]: e.target.value } } } : prev))
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Home summary title</div>
                      <input
                        value={siteData.home.about_card_title?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev
                              ? { ...prev, home: { ...prev.home, about_card_title: { ...prev.home.about_card_title, [siteEditLang]: e.target.value } } }
                              : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Home summary lines (1 per line)</div>
                      <textarea
                        value={siteData.home.about_card_lines?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  home: { ...prev.home, about_card_lines: { ...prev.home.about_card_lines, [siteEditLang]: e.target.value } },
                                }
                              : prev,
                          )
                        }
                        className="w-full min-h-[110px] px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50 font-mono text-sm"
                      />
                      <div className="text-xs text-slate-500">Shown as bullet points in the Home "Quick summary" card.</div>
                    </label>

                    <div className="md:col-span-2 pt-3 border-t border-white/5"></div>

                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CV modal kicker</div>
                      <input
                        value={siteData.home.cv_modal_kicker?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev ? { ...prev, home: { ...prev.home, cv_modal_kicker: { ...prev.home.cv_modal_kicker, [siteEditLang]: e.target.value } } } : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-1">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CV modal title</div>
                      <input
                        value={siteData.home.cv_modal_title?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev ? { ...prev, home: { ...prev.home, cv_modal_title: { ...prev.home.cv_modal_title, [siteEditLang]: e.target.value } } } : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CV modal download</div>
                      <input
                        value={siteData.home.cv_modal_download?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev
                              ? { ...prev, home: { ...prev.home, cv_modal_download: { ...prev.home.cv_modal_download, [siteEditLang]: e.target.value } } }
                              : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CV modal open new tab</div>
                      <input
                        value={siteData.home.cv_modal_open_new_tab?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  home: { ...prev.home, cv_modal_open_new_tab: { ...prev.home.cv_modal_open_new_tab, [siteEditLang]: e.target.value } },
                                }
                              : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CV modal loading</div>
                      <input
                        value={siteData.home.cv_modal_loading?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev ? { ...prev, home: { ...prev.home, cv_modal_loading: { ...prev.home.cv_modal_loading, [siteEditLang]: e.target.value } } } : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CV modal unavailable</div>
                      <input
                        value={siteData.home.cv_modal_unavailable?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev
                              ? { ...prev, home: { ...prev.home, cv_modal_unavailable: { ...prev.home.cv_modal_unavailable, [siteEditLang]: e.target.value } } }
                              : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                  </div>
                </section>

                )}

                {siteSection === 'projects' && (
                <section className="space-y-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Projects Page (/projects)</div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Kicker</div>
                      <input
                        value={siteData.projects_page.kicker?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  projects_page: { ...prev.projects_page, kicker: { ...prev.projects_page.kicker, [siteEditLang]: e.target.value } },
                                }
                              : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Title</div>
                      <input
                        value={siteData.projects_page.title?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  projects_page: { ...prev.projects_page, title: { ...prev.projects_page.title, [siteEditLang]: e.target.value } },
                                }
                              : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Lead</div>
                      <textarea
                        value={siteData.projects_page.lead?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev ? { ...prev, projects_page: { ...prev.projects_page, lead: { ...prev.projects_page.lead, [siteEditLang]: e.target.value } } } : prev,
                          )
                        }
                        className="w-full min-h-[90px] px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Empty title</div>
                      <input
                        value={siteData.projects_page.empty_title?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  projects_page: { ...prev.projects_page, empty_title: { ...prev.projects_page.empty_title, [siteEditLang]: e.target.value } },
                                }
                              : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">View details</div>
                      <input
                        value={siteData.projects_page.view_details?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  projects_page: { ...prev.projects_page, view_details: { ...prev.projects_page.view_details, [siteEditLang]: e.target.value } },
                                }
                              : prev,
                          )
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Empty lead</div>
                      <textarea
                        value={siteData.projects_page.empty_lead?.[siteEditLang] || ''}
                        onChange={(e) =>
                          setSiteData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  projects_page: { ...prev.projects_page, empty_lead: { ...prev.projects_page.empty_lead, [siteEditLang]: e.target.value } },
                                }
                              : prev,
                          )
                        }
                        className="w-full min-h-[90px] px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                      />
                    </label>
                  </div>
                </section>

                )}

                {siteSection === 'footer' && (
                <section className="space-y-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Footer (all pages)</div>
                  <label className="space-y-2 block">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Text</div>
                    <input
                      value={siteData.footer.text?.[siteEditLang] || ''}
                      onChange={(e) =>
                        setSiteData((prev) =>
                          prev ? { ...prev, footer: { ...prev.footer, text: { ...prev.footer.text, [siteEditLang]: e.target.value } } } : prev,
                        )
                      }
                      className="w-full px-4 py-3 rounded-2xl bg-[#0b1221]/60 border border-white/10 text-slate-100 outline-none focus:border-[#3be3ff]/50"
                    />
                  </label>
                </section>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'projects' ? (
        <div className="grid lg:grid-cols-5 gap-6">
          <aside className="lg:col-span-2 rounded-3xl border border-white/10 bg-[#101a2f]/70 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.2em] text-slate-300">Projects</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{projects.length}</span>
                <button
                  type="button"
                  onClick={() => {
                    setReorderMode((v) => !v);
                    setDraggingId(null);
                    setDropTargetId(null);
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition ${
                    reorderMode
                      ? 'bg-[#3be3ff] text-slate-950 border-[#3be3ff]/40'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                  }`}
                  title="Reorder projects"
                >
                  <Move className="w-4 h-4" />
                  {reorderMode ? 'Done' : 'Reorder'}
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {reorderMode && projects.length > 1 && (
  <div className="px-5 py-3 border-b border-white/5 text-xs text-slate-400 flex items-center gap-2">
    <GripVertical className="w-4 h-4 text-slate-500" />
    Drag to reorder (or use arrows)
  </div>
)}
{projects.map((p, idx) => {
  const isSelected = p.id === selectedId;
  const isDropTarget = reorderMode && dropTargetId === p.id && draggingId && draggingId !== p.id;
  const isDragging = reorderMode && draggingId === p.id;

  return (
    <div
      key={p.id}
      className={`border-b border-white/5 transition ${isSelected ? 'bg-white/5' : 'hover:bg-white/5'} ${isDropTarget ? 'ring-2 ring-[#3be3ff]/30' : ''} ${isDragging ? 'opacity-70' : ''}`}
      onDragOver={(e) => {
        if (!reorderMode) return;
        e.preventDefault();
      }}
      onDragEnter={() => {
        if (!reorderMode) return;
        setDropTargetId(p.id);
      }}
      onDrop={() => {
        if (!reorderMode) return;
        if (!draggingId) return;
        const from = projects.findIndex((x) => x.id === draggingId);
        const to = projects.findIndex((x) => x.id === p.id);
        setDraggingId(null);
        setDropTargetId(null);
        if (from === -1 || to === -1) return;
        moveProject(from, to);
      }}
    >
      <div className="px-5 py-4 flex items-center gap-3">
        {reorderMode && (
          <div className="flex items-center gap-1 shrink-0">
            <span
              className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={(e) => {
                setDraggingId(p.id);
                setDropTargetId(p.id);
                try {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', p.id);
                } catch {
                  // ignore
                }
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDropTargetId(null);
              }}
              title="Drag"
            >
              <GripVertical className="w-4 h-4" />
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                moveProjectById(p.id, -1);
              }}
              disabled={idx === 0}
              className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition disabled:opacity-40"
              title="Move up"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                moveProjectById(p.id, 1);
              }}
              disabled={idx === projects.length - 1}
              className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition disabled:opacity-40"
              title="Move down"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
        )}

        <button type="button" onClick={() => setSelectedId(p.id)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-white font-semibold truncate">{resolveLocalizedText(p.title, projectsEditLang, siteDefaultLang) || '(untitled)'}</div>
              <div className="text-xs text-slate-500 truncate">/{p.slug || '(no-slug)'} · order {p.order_index}</div>
            </div>
            {p.featured && (
              <span className="shrink-0 text-[11px] px-2 py-1 rounded-full bg-[#f9b234]/20 text-[#f9b234] border border-[#f9b234]/30">
                featured
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
})}
              {projects.length === 0 && <div className="px-5 py-8 text-slate-400 text-sm">No projects loaded.</div>}
            </div>
          </aside>

          <section className="lg:col-span-3 rounded-3xl border border-white/10 bg-[#101a2f]/70 p-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">{selected ? 'Edit project' : 'New project'}</h2>
              <div className="text-xs text-slate-500">id: {form.id}</div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="space-y-1">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Title *</div>
                <input
                  value={getTextForLang(form.title, projectsEditLang, siteDefaultLang)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((p) => ({ ...p, title: setTextForLang(p.title, projectsEditLang, siteDefaultLang, v) }));
                    if (autoSlug && normalizeLang(projectsEditLang) === siteDefaultLang) setForm((p) => ({ ...p, slug: slugify(v) }));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#0e1526] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                  placeholder="Project title"
                />
              </label>

              <label className="space-y-1">
                <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Slug *</div>
                  <label className="text-xs text-slate-400 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoSlug}
                      onChange={(e) => setAutoSlug(e.target.checked)}
                      className="accent-[#3be3ff]"
                    />
                    auto
                  </label>
                </div>
                <input
                  value={form.slug}
                  onChange={(e) => {
                    setAutoSlug(false);
                    setForm((p) => ({ ...p, slug: slugify(e.target.value) }));
                  }}
                  className={`w-full px-3 py-2 rounded-xl bg-[#0e1526] border focus:outline-none focus:ring-2 ${
                    selectedSlugConflicts
                      ? 'border-red-500/40 focus:ring-red-500/30'
                      : 'border-white/10 focus:ring-[#3be3ff]/40'
                  }`}
                  placeholder="my-project-slug"
                />
                {selectedSlugConflicts && <div className="text-xs text-red-200">Slug already exists.</div>}
              </label>

              <label className="space-y-1 md:col-span-2">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Summary *</div>
                <input
                  value={getTextForLang(form.summary, projectsEditLang, siteDefaultLang)}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, summary: setTextForLang(p.summary, projectsEditLang, siteDefaultLang, e.target.value) }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#0e1526] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                  placeholder="One-liner summary"
                />
              </label>

              <div className="grid md:grid-cols-2 gap-4 md:col-span-2">
                <label className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Period start (manual)</div>
                  <input
                    value={getTextForLang(form.period_start, projectsEditLang, siteDefaultLang)}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, period_start: setTextForLang(p.period_start, projectsEditLang, siteDefaultLang, e.target.value) }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0e1526] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                    placeholder="2022 or Jan 2022"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Period end (manual)</div>
                  <input
                    value={getTextForLang(form.period_end, projectsEditLang, siteDefaultLang)}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, period_end: setTextForLang(p.period_end, projectsEditLang, siteDefaultLang, e.target.value) }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0e1526] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                    placeholder="2024 or Present"
                  />
                </label>
              </div>

              <label className="space-y-1 md:col-span-2">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Description *</div>
                <textarea
                  value={getTextForLang(form.description, projectsEditLang, siteDefaultLang)}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: setTextForLang(p.description, projectsEditLang, siteDefaultLang, e.target.value) }))
                  }
                  rows={6}
                  className="w-full px-3 py-2 rounded-xl bg-[#0e1526] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                  placeholder="Longer description (supports line breaks)"
                />
                {showPreview && resolveLocalizedText(form.description, projectsEditLang, siteDefaultLang).trim().length > 0 && (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-[#0b1221]/60 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Preview</div>
                      <RichText
                        text={resolveLocalizedText(form.description, projectsEditLang, siteDefaultLang)}
                        snippetRenderer={(id, caption) => {
                          const snip = snippets.find((s) => s.id === id) || null;
                          if (!snip) return null;
                          const summaryText = (caption || '').trim() || resolveLocalizedText(snip.description, projectsEditLang, siteDefaultLang);
                          return (
                            <details className="group my-4 rounded-3xl border border-white/5 bg-[#101a2f]/70 overflow-hidden shadow-lg shadow-black/20">
                            <summary className="cursor-pointer select-none px-5 py-4 flex items-start justify-between gap-4 hover:bg-white/5 transition [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                              <div className="min-w-0">
                                <div className="text-base font-semibold text-white truncate">{resolveLocalizedText(snip.title, projectsEditLang, siteDefaultLang) || snip.id}</div>
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
                      }}
                    />
                  </div>
                )}
              </label>

              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Project links (hero)</div>
                    <div className="text-xs text-slate-500 mt-1">Optional external links shown in the project hero.</div>
                  </div>
                  <button
                    type="button"
                    onClick={addProjectLink}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-sm"
                  >
                    Add link
                  </button>
                </div>

                {(form.links || []).length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-[#0b1221]/40 p-4 text-sm text-slate-400">
                    No project links yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(form.links || []).map((link, idx) => (
                      <div key={`link-${idx}`} className="rounded-2xl border border-white/10 bg-[#0e1526]/70 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-400">Link #{idx + 1}</div>
                          <button
                            type="button"
                            onClick={() => removeProjectLink(idx)}
                            className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-3">
                          <label className="space-y-1">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Label</div>
                            <input
                              value={getTextForLang(link.label, projectsEditLang, siteDefaultLang)}
                              onChange={(e) =>
                                updateProjectLink(idx, {
                                  label: setTextForLang(link.label, projectsEditLang, siteDefaultLang, e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                              placeholder="Steam page"
                            />
                          </label>
                          <label className="space-y-1">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">URL</div>
                            <input
                              value={link.url || ''}
                              onChange={(e) => updateProjectLink(idx, { url: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                              placeholder="https://store.steampowered.com/..."
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Content blocks (extra)</div>
                    <div className="text-xs text-slate-500 mt-1">
                      These appear below the hero section. Contents nav shows up on Project Detail when at least 1 block exists.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addContentBlock}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-sm"
                  >
                    Add content
                  </button>
                </div>

                {(form.content_blocks || []).length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-[#0b1221]/40 p-4 text-sm text-slate-400">
                    No extra content blocks yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(form.content_blocks || []).map((blk, idx) => (
                      <div key={blk.id || idx} className="rounded-2xl border border-white/10 bg-[#0e1526]/70 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-400">
                            Block #{idx + 1}{' '}
                            <span className="text-slate-500 font-mono">{blk.id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => moveContentBlock(idx, idx - 1)}
                              disabled={idx === 0}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-40"
                              title="Move up"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveContentBlock(idx, idx + 1)}
                              disabled={idx === (form.content_blocks || []).length - 1}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-40"
                              title="Move down"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            {pendingBlockDeleteId === (blk.id || '') ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => removeContentBlock(idx)}
                                  className="text-xs px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-100 transition"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingBlockDeleteId(null)}
                                  className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPendingBlockDeleteId(blk.id || '')}
                                className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-3">
                          <label className="space-y-1 md:col-span-2">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Title</div>
                            <input
                              value={getTextForLang(blk.title, projectsEditLang, siteDefaultLang)}
                              onChange={(e) =>
                                updateContentBlock(idx, { title: setTextForLang(blk.title, projectsEditLang, siteDefaultLang, e.target.value) })
                              }
                              className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                              placeholder="Section title (shown in Contents)"
                            />
                          </label>
                          <label className="space-y-1 md:col-span-2">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Content (markdown)</div>
                            <textarea
                              value={getTextForLang(blk.content, projectsEditLang, siteDefaultLang)}
                              onChange={(e) =>
                                updateContentBlock(idx, { content: setTextForLang(blk.content, projectsEditLang, siteDefaultLang, e.target.value) })
                              }
                              rows={6}
                              className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40 text-sm"
                              placeholder="Supports the same RichText markdown (images, carousel, @youtube, @snippet, links...)"
                            />
                            {showPreview && resolveLocalizedText(blk.content, projectsEditLang, siteDefaultLang).trim().length > 0 && (
                              <div className="mt-3 rounded-2xl border border-white/10 bg-[#0b1221]/60 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Preview</div>
                                <RichText
                                  text={resolveLocalizedText(blk.content, projectsEditLang, siteDefaultLang)}
                                  snippetRenderer={(id, caption) => {
                                    const snip = snippets.find((s) => s.id === id) || null;
                                    if (!snip) return null;
                                    const summaryText = (caption || '').trim() || resolveLocalizedText(snip.description, projectsEditLang, siteDefaultLang);
                                    return (
                                      <details className="group my-4 rounded-3xl border border-white/5 bg-[#101a2f]/70 overflow-hidden shadow-lg shadow-black/20">
                                        <summary className="cursor-pointer select-none px-5 py-4 flex items-start justify-between gap-4 hover:bg-white/5 transition [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                                          <div className="min-w-0">
                                            <div className="text-base font-semibold text-white truncate">
                                              {resolveLocalizedText(snip.title, projectsEditLang, siteDefaultLang) || snip.id}
                                            </div>
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
                                  }}
                                />
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="space-y-1 md:col-span-2">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Projects card thumbnail (image)</div>
                <input
                  value={form.thumbnail_image_url || ''}
                  onChange={(e) => setForm((p) => ({ ...p, thumbnail_image_url: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#0e1526] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40 font-mono text-xs"
                  placeholder="Optional: shown in Projects card"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Projects card thumbnail (video)</div>
                <input
                  value={form.thumbnail_video_url || ''}
                  onChange={(e) => setForm((p) => ({ ...p, thumbnail_video_url: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#0e1526] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40 font-mono text-xs"
                  placeholder="mp4/webm URL (muted autoplay loop)"
                />
                <div className="text-xs text-slate-500">
                  If set, video overrides image; use a direct mp4/webm URL (not a YouTube page).
                </div>
              </label>

              <label className="space-y-1 md:col-span-2">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Tags (comma separated)</div>
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0e1526] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                  placeholder="React, TypeScript, Self Study"
                />
                <div className="text-xs text-slate-500">
                  Used as project card labels and filters. Existing tech_stack data is still read as legacy tags.
                </div>
              </label>

              <label className="space-y-1">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Order</div>
                <input
                  type="number"
                  value={form.order_index}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 rounded-xl bg-[#0e1526] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                />
                <div className="text-xs text-slate-500">Use “Reorder” in the left list.</div>
              </label>

              <label className="space-y-1">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Featured</div>
                <div className="h-[42px] flex items-center px-3 rounded-xl bg-[#0e1526] border border-white/10">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))}
                    className="accent-[#f9b234]"
                  />
                </div>
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Code snippets</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('snippets')}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-sm"
                >
                  Open Snippets tab
                </button>
              </div>
              <div className="space-y-4">
                {([] as EditorSnippet[]).map((snip, idx) => (
                  <div key={idx} className="rounded-2xl border border-white/10 bg-[#0e1526]/70 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-400">#{idx + 1}</div>
                      <button
                        type="button"
                        onClick={() => removeSnippet(idx)}
                        className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <label className="space-y-1 md:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Snippet ID</div>
                          <button
                            type="button"
                            onClick={() => {
                              const id = (snip.id || '').trim();
                              if (!id) return;
                              try {
                                void navigator.clipboard.writeText(`@snippet(${id})`);
                              } catch {
                                // ignore
                              }
                            }}
                            disabled={!snip.id || snip.id.trim().length === 0}
                            className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-40"
                            title="Copy embed tag"
                          >
                            Copy @snippet
                          </button>
                        </div>
                        <input
                          value={snip.id || ''}
                          onChange={(e) => updateSnippet(idx, { id: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40 font-mono text-xs"
                          placeholder="snip_my_feature_1"
                        />
                        <div className="text-xs text-slate-500">
                          Use in markdown:{' '}
                          <span className="font-mono">
                            @snippet({(snip.id || '').trim() || '...'}, Your caption)
                          </span>
                        </div>
                      </label>
                      <label className="space-y-1">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Title</div>
                        <input
                          value={getTextForLang(snip.title, snippetsEditLang, siteDefaultLang)}
                          onChange={(e) =>
                            updateSnippet(idx, { title: setTextForLang(snip.title, snippetsEditLang, siteDefaultLang, e.target.value) })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                          placeholder="FancyButton.tsx"
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Language</div>
                        <input
                          value={snip.language}
                          onChange={(e) => updateSnippet(idx, { language: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                          placeholder="typescript / tsx / cpp"
                        />
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Code path (optional)</div>
                        <div className="flex flex-col md:flex-row gap-2">
                          <input
                            value={snip.code_path || ''}
                            onChange={(e) => updateSnippet(idx, { code_path: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40 font-mono text-xs"
                            placeholder="/code/FancyButton.tsx"
                          />
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => loadSnippetFromCodePath(idx)}
                              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-sm"
                              title="Fetch code_path and paste into Code editor for selection-based annotations"
                            >
                              Load
                            </button>
                            {normalizePublicPath(snip.code_path || '') ? (
                              <a
                                href={normalizePublicPath(snip.code_path || '')}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-sm inline-flex items-center"
                                title="Open in new tab"
                              >
                                Open
                              </a>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          `code_path` varsa viewer önce onu yükler; buradaki Load butonu annotation eklemen için dosyayı editöre getirir.
                        </div>
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Description</div>
                        <input
                          value={getTextForLang(snip.description, snippetsEditLang, siteDefaultLang)}
                          onChange={(e) =>
                            updateSnippet(idx, { description: setTextForLang(snip.description, snippetsEditLang, siteDefaultLang, e.target.value) })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                          placeholder="What this snippet demonstrates"
                        />
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Code</div>
                        <textarea
                          value={snip.code}
                          onChange={(e) => {
                            updateSnippet(idx, { code: e.target.value });
                            updateSnippetSelection(idx, e.currentTarget);
                          }}
                          onSelect={(e) => updateSnippetSelection(idx, e.currentTarget)}
                          onKeyUp={(e) => updateSnippetSelection(idx, e.currentTarget)}
                          onMouseUp={(e) => updateSnippetSelection(idx, e.currentTarget)}
                          rows={6}
                          className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40 font-mono text-xs"
                          placeholder="Paste code here (or use code_path in projects.json manually if you prefer)"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <button
                            type="button"
                            onClick={() => quickAddAnnotationFromSelection(idx)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
                            title="Uses the current selection (line + cols)"
                          >
                            Quick add from selection
                          </button>
                          <button
                            type="button"
                            onClick={() => quickAddAnnotationAtCursorLine(idx)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
                            title="Adds an annotation for the cursor line (cols default)"
                          >
                            Quick add (cursor line)
                          </button>
                          {snippetSelection[idx] ? (
                            <span className="text-slate-500">
                              line {snippetSelection[idx]!.line_number} · cols {snippetSelection[idx]!.start_col}-{snippetSelection[idx]!.end_col}
                              {snippetSelection[idx]!.isMultiLine ? ' · multi-line' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-500">select text to auto-fill line/cols</span>
                          )}
                        </div>
                      </label>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Annotations <span className="text-slate-500">({(snip.annotations || []).length})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addAnnotation(idx)}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-sm"
                        >
                          Add annotation
                        </button>
                      </div>

                      {(snip.annotations || []).length === 0 ? (
                        <div className="text-sm text-slate-400">No annotations.</div>
                      ) : (
                        <div className="space-y-3">
                          {(snip.annotations || []).map((anno, annoIdx) => (
                            <div key={annoIdx} className="rounded-2xl border border-white/10 bg-[#0b1221]/60 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-400">#{annoIdx + 1}</div>
                                <button
                                  type="button"
                                  onClick={() => removeAnnotation(idx, annoIdx)}
                                  className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="grid md:grid-cols-3 gap-3">
                                <label className="space-y-1">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Line</div>
                                  <input
                                    type="number"
                                    min={1}
                                    value={anno.line_number}
                                    onChange={(e) => updateAnnotation(idx, annoIdx, { line_number: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                                  />
                                </label>
                                <label className="space-y-1">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Start col</div>
                                  <input
                                    type="number"
                                    min={0}
                                    value={anno.start_col}
                                    onChange={(e) => updateAnnotation(idx, annoIdx, { start_col: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                                  />
                                </label>
                                <label className="space-y-1">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">End col</div>
                                  <input
                                    type="number"
                                    min={0}
                                    value={anno.end_col}
                                    onChange={(e) => updateAnnotation(idx, annoIdx, { end_col: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                                  />
                                </label>

                                <label className="space-y-1 md:col-span-3">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tooltip title</div>
                                  <input
                                    value={getTextForLang(anno.tooltip_title, snippetsEditLang, siteDefaultLang)}
                                    onChange={(e) =>
                                      updateAnnotation(idx, annoIdx, {
                                        tooltip_title: setTextForLang(anno.tooltip_title, snippetsEditLang, siteDefaultLang, e.target.value),
                                      })
                                    }
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                                    placeholder="Short title"
                                  />
                                </label>
                                <label className="space-y-1 md:col-span-3">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tooltip content</div>
                                  <input
                                    value={getTextForLang(anno.tooltip_content, snippetsEditLang, siteDefaultLang)}
                                    onChange={(e) =>
                                      updateAnnotation(idx, annoIdx, {
                                        tooltip_content: setTextForLang(anno.tooltip_content, snippetsEditLang, siteDefaultLang, e.target.value),
                                      })
                                    }
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                                    placeholder="Shown on hover"
                                  />
                                  {showPreview && resolveLocalizedText(anno.tooltip_content, snippetsEditLang, siteDefaultLang).trim().length > 0 && (
                                    <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3">
                                      <RichText text={resolveLocalizedText(anno.tooltip_content, snippetsEditLang, siteDefaultLang)} size="small" />
                                    </div>
                                  )}
                                </label>
                                <label className="space-y-1 md:col-span-3">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Detail type</div>
                                  <input
                                    value={anno.detail_type}
                                    onChange={(e) => updateAnnotation(idx, annoIdx, { detail_type: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                                    placeholder="interface / api / note / style / network ..."
                                  />
                                </label>
                                <label className="space-y-1 md:col-span-3">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Detail content</div>
                                  <textarea
                                    value={getTextForLang(anno.detail_content, snippetsEditLang, siteDefaultLang)}
                                    onChange={(e) =>
                                      updateAnnotation(idx, annoIdx, {
                                        detail_content: setTextForLang(anno.detail_content, snippetsEditLang, siteDefaultLang, e.target.value),
                                      })
                                    }
                                    rows={4}
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40 text-sm"
                                    placeholder="Shown on click in the modal"
                                  />
                                  {showPreview && resolveLocalizedText(anno.detail_content, snippetsEditLang, siteDefaultLang).trim().length > 0 && (
                                    <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3">
                                      <RichText text={resolveLocalizedText(anno.detail_content, snippetsEditLang, siteDefaultLang)} />
                                    </div>
                                  )}
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Used in this description</div>
                  {snippetIdsUsedInForm.length === 0 ? (
                    <div className="text-sm text-slate-400">No @snippet(...) embeds found.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {snippetIdsUsedInForm.map((id) => {
                        const exists = snippetIdSet.has(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setActiveTab('snippets');
                              setSelectedSnippetId(id);
                            }}
                            className={`px-3 py-1 rounded-full border text-xs transition active:scale-[0.98] ${
                              exists
                                ? 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-200'
                                : 'border-red-500/30 bg-red-500/10 hover:bg-red-500/15 text-red-100'
                            }`}
                            title={exists ? 'Open snippet' : 'Snippet not found in snippets.json'}
                          >
                            {id}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
        ) : (
        <div className="grid lg:grid-cols-5 gap-6">
          <aside className="lg:col-span-2 rounded-3xl border border-white/10 bg-[#101a2f]/70 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.2em] text-slate-300">Snippets</h2>
              <span className="text-xs text-slate-500">{snippets.length}</span>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {snippetsLoading ? (
                <div className="px-5 py-6 text-sm text-slate-400">Loading snippets…</div>
              ) : snippets.length === 0 ? (
                <div className="px-5 py-6 text-sm text-slate-400">No snippets.</div>
              ) : (
                snippets.map((s) => {
                  const isSelected = s.id === selectedSnippetId;
                  const usedCount = projectsBySnippetId.get(s.id)?.length ?? 0;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSnippetId(s.id)}
                      className={`w-full text-left px-5 py-4 border-b border-white/5 transition ${
                        isSelected ? 'bg-white/5' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{resolveLocalizedText(s.title, snippetsEditLang, siteDefaultLang) || s.id}</div>
                          <div className="text-xs text-slate-400 font-mono truncate">{s.id}</div>
                        </div>
                        <div className="shrink-0 text-xs text-slate-400">{usedCount} proj</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="lg:col-span-3 rounded-3xl border border-white/10 bg-[#101a2f]/70 overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Snippet Editor</h2>
                <div className="text-xs text-slate-400 mt-1">
                  Embed via <span className="font-mono">@snippet(id, caption)</span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {!selectedSnippet ? (
                <div className="text-sm text-slate-400">Select a snippet on the left.</div>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/10 bg-[#0e1526]/70 p-4 space-y-4">
                    <div className="grid md:grid-cols-2 gap-3">
                      <label className="space-y-1 md:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Snippet ID</div>
                          <button
                            type="button"
                            onClick={() => {
                              const id = (selectedSnippet.id || '').trim();
                              if (!id) return;
                              try {
                                void navigator.clipboard.writeText(`@snippet(${id})`);
                              } catch {
                                // ignore
                              }
                            }}
                            disabled={!selectedSnippet.id || selectedSnippet.id.trim().length === 0}
                            className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-40"
                            title="Copy embed tag"
                          >
                            Copy @snippet
                          </button>
                        </div>
                        <input
                          value={selectedSnippet.id || ''}
                          onChange={(e) => updateSnippet(selectedSnippetIndex, { id: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40 font-mono text-xs"
                          placeholder="snip_my_feature_1"
                        />
                        {(snippetIdCounts.get((selectedSnippet.id || '').trim()) || 0) > 1 && (
                          <div className="text-xs text-red-200 mt-1">
                            Duplicate ID detected: the site will use the last snippet with this ID. Keep snippet IDs unique.
                          </div>
                        )}
                      </label>
                      <label className="space-y-1">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Title</div>
                        <input
                          value={getTextForLang(selectedSnippet.title, snippetsEditLang, siteDefaultLang)}
                          onChange={(e) =>
                            updateSnippet(selectedSnippetIndex, {
                              title: setTextForLang(selectedSnippet.title, snippetsEditLang, siteDefaultLang, e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                          placeholder="FancyButton.tsx"
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Language</div>
                        <input
                          value={selectedSnippet.language}
                          onChange={(e) => updateSnippet(selectedSnippetIndex, { language: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                          placeholder="typescript / tsx / cpp"
                        />
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Code path (optional)</div>
                        <div className="flex flex-col md:flex-row gap-2">
                          <input
                            value={selectedSnippet.code_path || ''}
                            onChange={(e) => updateSnippet(selectedSnippetIndex, { code_path: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40 font-mono text-xs"
                            placeholder="/code/FancyButton.tsx"
                          />
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => loadSnippetFromCodePath(selectedSnippetIndex)}
                              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-sm"
                            >
                              Load
                            </button>
                            {normalizePublicPath(selectedSnippet.code_path || '') ? (
                              <a
                                href={normalizePublicPath(selectedSnippet.code_path || '')}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-sm inline-flex items-center"
                              >
                                Open
                              </a>
                            ) : (
                              <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm opacity-50 inline-flex items-center">
                                Open
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Description (fallback)</div>
                        <input
                          value={getTextForLang(selectedSnippet.description, snippetsEditLang, siteDefaultLang)}
                          onChange={(e) =>
                            updateSnippet(selectedSnippetIndex, {
                              description: setTextForLang(selectedSnippet.description, snippetsEditLang, siteDefaultLang, e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                          placeholder="Used when caption is omitted"
                        />
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Code</div>
                        <textarea
                          value={selectedSnippet.code}
                          onChange={(e) => updateSnippet(selectedSnippetIndex, { code: e.target.value })}
                          onSelect={(e) => updateSnippetSelection(selectedSnippetIndex, e.currentTarget)}
                          onMouseUp={(e) => updateSnippetSelection(selectedSnippetIndex, e.currentTarget)}
                          onKeyUp={(e) => updateSnippetSelection(selectedSnippetIndex, e.currentTarget)}
                          rows={10}
                          className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40 font-mono text-xs whitespace-pre"
                          placeholder="Paste code here"
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => quickAddAnnotationFromSelection(selectedSnippetIndex)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-xs"
                        title="Select text to auto-fill line/cols"
                      >
                        Quick add from selection
                      </button>
                      <button
                        type="button"
                        onClick={() => quickAddAnnotationAtCursorLine(selectedSnippetIndex)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-xs"
                        title="Use current cursor line"
                      >
                        Quick add (cursor line)
                      </button>
                      {snippetSelection[selectedSnippetIndex] ? (
                        <div className="text-xs text-slate-500">
                          line {snippetSelection[selectedSnippetIndex]?.line_number} col {snippetSelection[selectedSnippetIndex]?.start_col}-
                          {snippetSelection[selectedSnippetIndex]?.end_col}{' '}
                          {snippetSelection[selectedSnippetIndex]?.selectedText?.trim()
                            ? `• “${snippetSelection[selectedSnippetIndex]?.selectedText?.trim().slice(0, 28)}${snippetSelection[selectedSnippetIndex]?.selectedText?.trim().length > 28 ? '…' : ''}”`
                            : '• no selection'}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">select text to auto-fill line/cols</div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Annotations ({(selectedSnippet.annotations || []).length})
                        </div>
                        <button
                          type="button"
                          onClick={() => addAnnotation(selectedSnippetIndex)}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-xs"
                        >
                          Add annotation
                        </button>
                      </div>
                      {(selectedSnippet.annotations || []).length === 0 ? (
                        <div className="text-sm text-slate-400">No annotations.</div>
                      ) : (
                        <div className="space-y-3">
                          {(selectedSnippet.annotations || []).map((anno, annoIdx) => (
                            <div key={annoIdx} className="rounded-2xl border border-white/10 bg-[#0b1221]/60 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-400">#{annoIdx + 1}</div>
                                <button
                                  type="button"
                                  onClick={() => removeAnnotation(selectedSnippetIndex, annoIdx)}
                                  className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="grid md:grid-cols-3 gap-3">
                                <label className="space-y-1">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Line</div>
                                  <input
                                    type="number"
                                    min={1}
                                    value={anno.line_number}
                                    onChange={(e) => updateAnnotation(selectedSnippetIndex, annoIdx, { line_number: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                                  />
                                </label>
                                <label className="space-y-1">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Start col</div>
                                  <input
                                    type="number"
                                    min={0}
                                    value={anno.start_col}
                                    onChange={(e) => updateAnnotation(selectedSnippetIndex, annoIdx, { start_col: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                                  />
                                </label>
                                <label className="space-y-1">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">End col</div>
                                  <input
                                    type="number"
                                    min={0}
                                    value={anno.end_col}
                                    onChange={(e) => updateAnnotation(selectedSnippetIndex, annoIdx, { end_col: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                                  />
                                </label>

                                <label className="space-y-1 md:col-span-3">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tooltip title</div>
                                  <input
                                    value={getTextForLang(anno.tooltip_title, snippetsEditLang, siteDefaultLang)}
                                    onChange={(e) =>
                                      updateAnnotation(selectedSnippetIndex, annoIdx, {
                                        tooltip_title: setTextForLang(anno.tooltip_title, snippetsEditLang, siteDefaultLang, e.target.value),
                                      })
                                    }
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                                    placeholder="Short title"
                                  />
                                </label>
                                <label className="space-y-1 md:col-span-3">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tooltip content</div>
                                  <input
                                    value={getTextForLang(anno.tooltip_content, snippetsEditLang, siteDefaultLang)}
                                    onChange={(e) =>
                                      updateAnnotation(selectedSnippetIndex, annoIdx, {
                                        tooltip_content: setTextForLang(anno.tooltip_content, snippetsEditLang, siteDefaultLang, e.target.value),
                                      })
                                    }
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                                    placeholder="Shown on hover"
                                  />
                                  {showPreview && resolveLocalizedText(anno.tooltip_content, snippetsEditLang, siteDefaultLang).trim().length > 0 && (
                                    <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3">
                                      <RichText text={resolveLocalizedText(anno.tooltip_content, snippetsEditLang, siteDefaultLang)} size="small" />
                                    </div>
                                  )}
                                </label>
                                <label className="space-y-1 md:col-span-3">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Detail type</div>
                                  <input
                                    value={anno.detail_type}
                                    onChange={(e) => updateAnnotation(selectedSnippetIndex, annoIdx, { detail_type: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40"
                                    placeholder="interface / api / note / style / network ..."
                                  />
                                </label>
                                <label className="space-y-1 md:col-span-3">
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Detail content</div>
                                  <textarea
                                    value={getTextForLang(anno.detail_content, snippetsEditLang, siteDefaultLang)}
                                    onChange={(e) =>
                                      updateAnnotation(selectedSnippetIndex, annoIdx, {
                                        detail_content: setTextForLang(anno.detail_content, snippetsEditLang, siteDefaultLang, e.target.value),
                                      })
                                    }
                                    rows={4}
                                    className="w-full px-3 py-2 rounded-xl bg-[#0b1221] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#3be3ff]/40 text-sm"
                                    placeholder="Shown on click in the modal"
                                  />
                                  {showPreview && resolveLocalizedText(anno.detail_content, snippetsEditLang, siteDefaultLang).trim().length > 0 && (
                                    <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3">
                                      <RichText text={resolveLocalizedText(anno.detail_content, snippetsEditLang, siteDefaultLang)} />
                                    </div>
                                  )}
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Used in projects</div>
                    {(projectsBySnippetId.get(selectedSnippet.id)?.length ?? 0) === 0 ? (
                      <div className="text-sm text-slate-400">Not referenced by any project description yet.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(projectsBySnippetId.get(selectedSnippet.id) || []).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setActiveTab('projects');
                              setSelectedId(p.id);
                            }}
                            className="px-3 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-200 transition active:scale-[0.98]"
                            title="Open project"
                          >
                            {resolveLocalizedText(p.title, projectsEditLang, siteDefaultLang) || p.id}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
        )}
      </div>
    </div>
  );
}






