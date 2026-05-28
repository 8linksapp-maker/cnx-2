/**
 * Mapeamento categoria → cor OKLCH committed.
 * Cada categoria do scaffold tem uma cor de assinatura.
 * Ordem importa — define a sequência de cores na home.
 */
export type CategoryColor = 'terracota' | 'azul-tinta' | 'oliva' | 'ocre' | 'vinho';

export const CATEGORY_COLORS: Record<string, CategoryColor> = {
  'Comece aqui':  'terracota',
  'Configuração': 'azul-tinta',
  'Conteúdo':     'oliva',
  'Plugins':      'ocre',
  'Inspiração':   'vinho',
};

export const CATEGORY_ORDER = ['Comece aqui', 'Configuração', 'Conteúdo', 'Plugins', 'Inspiração'];

/** Pega a cor de uma categoria, fallback rotativo se desconhecida. */
export function colorForCategory(category: string | undefined, index = 0): CategoryColor {
  if (category && CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  const fallback: CategoryColor[] = ['terracota', 'azul-tinta', 'oliva', 'ocre', 'vinho'];
  return fallback[index % fallback.length];
}

/** Hex preview pra admin/preview. */
export const COLOR_HEX: Record<CategoryColor, string> = {
  'terracota':   '#c55c3e',
  'azul-tinta':  '#3458a2',
  'oliva':       '#5f7436',
  'ocre':        '#c49838',
  'vinho':       '#8c344c',
};
