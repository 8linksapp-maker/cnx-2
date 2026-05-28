/**
 * Helper canônico pra trabalhar com categorias.
 *
 * Schema atual de `categories.json`:
 *     [{name: string, slug: string, description?: string}]
 *
 * Schema legado (ainda suportado, migra silenciosamente no read):
 *     string[]  → cada string vira { name, slug: slugify(name) }
 *
 * Use SEMPRE estes helpers quando precisar gerar URL `/categoria/<slug>` ou
 * filtrar posts por categoria — NUNCA `name.toLowerCase().replace(...)` inline.
 */
import { slugify } from './slugify';

export interface CategoryEntry {
  name: string;
  slug: string;
  description?: string;
}

/**
 * Aceita o conteúdo cru do categories.json (objeto OU string[]) e devolve
 * sempre `CategoryEntry[]` normalizado. Idempotente.
 */
export function normalizeCategories(raw: unknown): CategoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CategoryEntry[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const name = item.trim();
      if (!name) continue;
      out.push({ name, slug: slugify(name) });
    } else if (item && typeof item === 'object' && 'name' in item) {
      const obj = item as any;
      const name = String(obj.name || '').trim();
      if (!name) continue;
      const slug = String(obj.slug || '').trim() || slugify(name);
      const description = obj.description ? String(obj.description) : undefined;
      out.push(description ? { name, slug, description } : { name, slug });
    }
  }
  return out;
}

export function slugifyCategory(s: string): string {
  return slugify(s);
}

/**
 * Resolve o slug canônico de uma categoria. Faz lookup primeiro pelo `name`,
 * depois pelo próprio `slug` (caso aluno tenha passado slug em vez de name).
 * Fallback: slugify(catName) — caso de categoria órfã.
 */
export function getCategorySlug(catName: string, all: CategoryEntry[]): string {
  if (!catName) return '';
  const entry = all.find((c) => c.name === catName || c.slug === catName);
  if (entry) return entry.slug;
  return slugify(catName);
}

/**
 * Inverso: dado slug ou name, devolve o nome legível. Fallback retorna o input.
 */
export function getCategoryName(slugOrName: string, all: CategoryEntry[]): string {
  if (!slugOrName) return '';
  const entry = all.find((c) => c.slug === slugOrName || c.name === slugOrName);
  return entry?.name || slugOrName;
}

/**
 * Verifica se um `post.data.category` (que pode estar como name OU slug OU
 * variante slugificada) bate com uma entry do categories.json.
 */
export function categoryMatches(postCategory: string, entry: CategoryEntry): boolean {
  if (!postCategory || !entry) return false;
  return (
    postCategory === entry.name ||
    postCategory === entry.slug ||
    slugify(postCategory) === entry.slug
  );
}

/**
 * Coleta slugs órfãos: categorias referenciadas em posts mas que não estão
 * no categories.json. Útil pra `getStaticPaths` gerar página mesmo quando
 * aluno esqueceu de registrar a categoria.
 */
export function collectOrphanCategories(
  postCategories: string[],
  registered: CategoryEntry[]
): CategoryEntry[] {
  const registeredKeys = new Set<string>();
  for (const c of registered) {
    registeredKeys.add(c.name);
    registeredKeys.add(c.slug);
  }
  const orphans: CategoryEntry[] = [];
  const seen = new Set<string>();
  for (const cat of postCategories) {
    if (!cat || registeredKeys.has(cat)) continue;
    const slug = slugify(cat);
    if (seen.has(slug)) continue;
    seen.add(slug);
    orphans.push({ name: cat, slug });
  }
  return orphans;
}
