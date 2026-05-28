/**
 * Helpers canônicos pra manipular `vercel.json` (redirects).
 *
 * Centraliza:
 *  - `toPath(input)` — normaliza URL/path absoluto pra path relativo
 *  - `sanitizeVercelSource(input)` — converte sintaxe regex/.htaccess pra path-to-regexp
 *  - `sanitizeRedirects(list)` — normaliza um array de redirects do CMS
 *  - `buildVercelRedirects(redirects)` — converte pro formato Vercel
 *
 * IMPORTANTE: o I/O do vercel.json em si (read/write via GitHub Contents API)
 * fica na função `syncVercelJson` definida em cada endpoint que precisa
 * (porque depende do contexto de plugins/_server). Este módulo só fornece
 * a lógica pura de transformação.
 *
 * Histórico: extraído de plugins/redirects/index.ts pra evitar duplicação em
 * categories/rename.ts (e qualquer feature futura que toque vercel.json).
 * Ver mass-fix #13 no log do Juvenal pra histórico do bug original.
 */

/** Extrai apenas o pathname caso o aluno cole URL completa (https://site.com/x → /x) */
export function toPath(input: string): string {
  if (!input) return input;
  const v = String(input).trim();
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      return (u.pathname + u.search + u.hash).replace(/\/+$/, '') || '/';
    } catch {
      return v;
    }
  }
  return v.startsWith('/') ? v : '/' + v;
}

/**
 * Sanitiza o `source` de um redirect pra sintaxe path-to-regexp que o Vercel aceita.
 * Patterns regex puros (`(.*)`, `(\d+)`) e metacaracteres soltos (`/?` no fim) fazem
 * o Vercel rejeitar o deploy silenciosamente (hook retorna 201 PENDING mas o job
 * nunca executa). Aqui convertemos os casos mais comuns que vêm de copy-paste de
 * .htaccess do WordPress.
 */
export function sanitizeVercelSource(input: string): string {
  let v = toPath(input);
  // /caminho/?  → /caminho   (`/?` é metacaracter inválido fora de grupo)
  v = v.replace(/\/\?+$/, '');
  // /author/(.*)  → /author/:rest*
  v = v.replace(/\(\.\*\)/g, ':rest*');
  v = v.replace(/\(\\d\+\)/g, ':num'); // (\d+)
  v = v.replace(/\(\[\^\/\]\+\)/g, ':segment'); // ([^/]+)
  // Remove âncoras regex
  v = v.replace(/^\^/, '').replace(/\$$/, '');
  return v;
}

export interface CmsRedirect {
  id?: string;
  from: string;
  to: string;
  type?: number;
  enabled?: boolean;
  [k: string]: any;
}

export interface VercelRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

/** Normaliza uma lista de redirects do CMS pra paths relativos (não muda enabled etc) */
export function sanitizeRedirects(list: CmsRedirect[]): CmsRedirect[] {
  return (list || []).map((r) => ({
    ...r,
    from: r?.from ? toPath(r.from) : r?.from,
    to: r?.to ? toPath(r.to) : r?.to,
  }));
}

/** Converte CmsRedirect[] (do redirects.json) pro formato consumido pelo Vercel */
export function buildVercelRedirects(redirects: CmsRedirect[]): VercelRedirect[] {
  return redirects
    .filter((r) => r.enabled !== false && r.from && r.to)
    .map((r) => ({
      source: sanitizeVercelSource(r.from),
      destination: toPath(r.to),
      permanent: r.type === 301,
    }));
}
