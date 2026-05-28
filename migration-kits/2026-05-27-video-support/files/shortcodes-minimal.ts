/**
 * Sistema mínimo de shortcodes pra posts.
 *
 * Suportado:
 *   [[video:URL]]  → embed responsivo 16:9 (YouTube/Vimeo/mp4/iframe genérico)
 *
 * O scaffold inclui só o shortcode de vídeo. Templates filhos (ClickBanker etc)
 * estendem esta lib pra adicionar shortcodes específicos (produto, comparador,
 * etc) — ver `afiliado-clickbank/src/lib/shortcodes.ts`.
 */
import { parseVideoUrl } from './videoEmbed';

// Match shortcode possivelmente envolvido por <p>...</p> ou <p>...<br></p>
// Capturamos a tag p wrapper pra remover (não pode ter iframe block dentro de <p>)
const VIDEO_RE = /(?:<p[^>]*>\s*(?:<br\s*\/?>)?)?\s*\[\[\s*video\s*:\s*([^\]]+?)\s*\]\]\s*(?:(?:<br\s*\/?>)?<\/p>)?/gi;
const VIDEO_DETECT = /\[\[\s*video\s*:\s*([^\]]+?)\s*\]\]/gi;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Embed responsivo de vídeo (16:9, lazy-load iframe) */
function renderVideoEmbed(url: string): string {
  const info = parseVideoUrl(url);
  if (info.provider === 'unknown') {
    return `<div class="not-prose" style="padding:.5rem 1rem;background:#fef3c7;border:1px dashed #d97706;border-radius:4px;color:#92400e;font-family:ui-monospace,monospace;font-size:.8rem;margin:1rem 0;">[[video:${escapeHtml(url)}]] — URL não reconhecida</div>`;
  }
  const wrapStyle = `position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;margin:1.75rem 0;`;
  if (info.provider === 'mp4') {
    return `<div class="not-prose" style="${wrapStyle}"><video controls preload="metadata" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;"><source src="${escapeHtml(info.embedUrl)}" />Seu navegador não suporta vídeo HTML5.</video></div>`;
  }
  return `<div class="not-prose" style="${wrapStyle}"><iframe src="${escapeHtml(info.embedUrl)}" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0;"></iframe></div>`;
}

/** Processa HTML do post, substituindo shortcodes pelo HTML renderizado. */
export function renderShortcodes(html: string): string {
  if (!html) return '';
  let out = html.replace(VIDEO_RE, (_m, rawUrl) => renderVideoEmbed(String(rawUrl).trim()));
  // Limpa <p></p> vazios consecutivos (do Quill quando aluno aperta Enter várias vezes)
  out = out.replace(/<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '');
  return out;
}

/** Detecta shortcodes inseridos no HTML. */
export function detectShortcodes(html: string): { video: string[] } {
  const video: string[] = [];
  for (const m of html.matchAll(VIDEO_DETECT)) video.push(m[1].trim());
  return { video };
}

/** Heurística rápida pra detectar se o body tem algum shortcode. */
export function hasShortcodes(html: string): boolean {
  return /\[\[\s*\w+\s*:/i.test(html);
}
