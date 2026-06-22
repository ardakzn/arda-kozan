import type { ProjectWithDetails } from '../types/portfolio';
import { isAdminEnabled } from './admin';
import { loadDraftProjects } from './projectsDraft';
import { withBaseUrl } from './paths';

function titleForSort(p: ProjectWithDetails): string {
  const raw = p.title as unknown;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const preferred = (obj.en || obj.tr) as unknown;
    if (typeof preferred === 'string' && preferred.trim()) return preferred;
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (typeof v === 'string' && v.trim()) return v;
    }
  }
  return '';
}

function sortProjects(list: ProjectWithDetails[]): ProjectWithDetails[] {
  return [...list].sort((a, b) => {
    const ao = Number.isFinite(a.order_index) ? a.order_index : 0;
    const bo = Number.isFinite(b.order_index) ? b.order_index : 0;
    if (ao !== bo) return ao - bo;
    return (a.created_at || '').localeCompare(b.created_at || '') || titleForSort(a).localeCompare(titleForSort(b));
  });
}

export function getProjectTags(project: Pick<ProjectWithDetails, 'tags' | 'tech_stack'>): string[] {
  const preferred = Array.isArray(project.tags) && project.tags.length > 0 ? project.tags : project.tech_stack;
  return (preferred || []).map((tag) => tag.trim()).filter(Boolean);
}

export async function loadProjectsFromFile(): Promise<ProjectWithDetails[]> {
  const res = await fetch(withBaseUrl('/data/projects.json'), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load projects.json');
  const data: unknown = await res.json();
  const list = Array.isArray(data) ? (data as ProjectWithDetails[]) : [];
  return sortProjects(list);
}

export function mergeProjects(fileList: ProjectWithDetails[], draftList: ProjectWithDetails[]): ProjectWithDetails[] {
  const byKey = (p: ProjectWithDetails) => (p.id && p.id.trim().length > 0 ? `id:${p.id}` : `slug:${p.slug}`);

  const fileMap = new Map<string, ProjectWithDetails>();
  for (const p of fileList) fileMap.set(byKey(p), p);

  const merged: ProjectWithDetails[] = [];
  const seen = new Set<string>();

  for (const p of draftList) {
    const key = byKey(p);
    merged.push(p);
    seen.add(key);
    fileMap.delete(key);
  }

  for (const [, p] of fileMap) {
    const key = byKey(p);
    if (seen.has(key)) continue;
    merged.push(p);
  }

  return sortProjects(merged);
}

export async function loadProjectsList(): Promise<ProjectWithDetails[]> {
  const fileList = await loadProjectsFromFile();

  if (isAdminEnabled()) {
    const draft = loadDraftProjects();
    if (draft && draft.length > 0) return mergeProjects(fileList, draft);
  }

  return fileList;
}
