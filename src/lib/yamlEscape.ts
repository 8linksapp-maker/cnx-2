/**
 * Escapa um valor de string para uso em frontmatter YAML com aspas duplas.
 * Trata barra invertida e aspa dupla — se nao escapar barra invertida, um
 * texto que termina com `\` gera YAML invalido (a aspa fechadora vira escape).
 *
 * Use sempre para valores que vao em "${value}" no frontmatter:
 *   `title: "${yamlEscape(post.title)}"`
 */
export function yamlEscape(value: string | undefined | null): string {
    if (value == null) return '';
    return String(value)
        .replace(/\\/g, '\\\\')   // barras invertidas primeiro
        .replace(/"/g, '\\"');    // depois as aspas duplas
}
