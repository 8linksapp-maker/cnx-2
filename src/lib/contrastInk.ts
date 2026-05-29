/**
 * contrastInk — escolhe ink escuro ou off-white sobre uma cor de fundo,
 * maximizando o contraste WCAG real (razão de contraste, não threshold de luminância).
 *
 * Helper PRESENTACIONAL de a11y. Usado no tema local, onde a cor do nicho é um
 * hex livre escolhido pelo usuário no admin. O ponto de virada real entre texto
 * claro e escuro fica em L≈0.18 (não 0.4) — por isso comparamos as duas razões
 * de contraste e devolvemos a vencedora, em vez de um corte fixo.
 *
 * Tokens (nunca #fff/#000 puros — ver DESIGN.md "Sem-Branco-Sem-Preto Rule"):
 *   ink      = rgb(20 20 24)   → --c-ink   (off-black warm)
 *   offwhite = rgb(248 248 246) → mesmo off-white do .color-block
 */

const INK = 'rgb(20 20 24)';
const OFFWHITE = 'rgb(248 248 246)';
const L_INK = 0.0062;
const L_OFFWHITE = 0.93;

function luminance(hex: string): number | null {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return null;
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  if (ch.some((c) => Number.isNaN(c))) return null;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = ch.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

export type Ink = {
  /** 'dark' usa ink escuro; 'light' usa off-white. */
  mode: 'dark' | 'light';
  /** Cor CSS pronta pra aplicar no texto. */
  color: string;
  /** Razão de contraste atingida (>= 4.5 passa WCAG AA pra texto normal). */
  ratio: number;
};

/**
 * Texto (off-white vs ink escuro) sobre `bg` (hex), fiel à assinatura do scaffold.
 *
 * A "porta colorida" do DESIGN usa texto off-white sobre cor saturada. Por isso o
 * default é off-white; só inverte pra ink escuro quando off-white falha o contraste
 * de texto grande (< 3:1), i.e. quando a cor é clara de verdade — a regra
 * "Ocre-Exige-Ink-Escuro" (L > ~60%). Não é maximizador cego: preserva o visual.
 *
 * Residual conhecido: cores de nicho de luminância média (ex. terracota ~4.1:1) não
 * batem 4.5:1 pra texto PEQUENO. Texto grande (hero/título) passa em 3:1. O guardrail
 * pra texto pequeno é no admin (avisar/escurecer cor que não suporta) — fica pro Francis.
 */
export function pickInk(bg: string): Ink {
  const L = luminance(bg);
  if (L === null) return { mode: 'light', color: OFFWHITE, ratio: 0 };
  const cLight = ratio(L, L_OFFWHITE);
  if (cLight >= 3) return { mode: 'light', color: OFFWHITE, ratio: cLight };
  return { mode: 'dark', color: INK, ratio: ratio(L, L_INK) };
}
