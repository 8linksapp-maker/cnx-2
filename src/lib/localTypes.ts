/**
 * localTypes.ts — Tipos do Tema Local (gerador de páginas de SEO local).
 *
 * O coração do tema: SERVIÇO × LOCALIDADE = página /{cidade}/{servico}.
 * O conteúdo de IA é gerado UMA VEZ por serviço (parametrizado com {cidade},
 * {servico}, {estado}, {empresa}, {telefone}) e a página de cada cidade só faz
 * substituição de variável em build-time. Ver applyTemplateVars em localVars.ts.
 *
 * Persistido como JSON em src/data/ (lido via readData, salvo via commit.ts).
 */

export interface OutlineItem {
  level: 'h2' | 'h3' | 'h4';
  text: string;
}

/** Agrupador de serviços + cor da assinatura visual da página. */
export interface Niche {
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  /** Hex (#rrggbb). Injetado inline na página via --niche (não via classe Tailwind). */
  color: string;
  active: boolean;
}

/** Serviço = keyword + outline + 1 conteúdo de IA parametrizado, reusado em N cidades. */
export interface Service {
  title: string;
  slug: string;
  shortDescription?: string;
  icon?: string;
  /** slug do Niche dono deste serviço. */
  niche: string;
  outline?: OutlineItem[];
  /** Markdown com tokens {cidade}/{servico}/{estado}/{empresa}/{telefone}. Vazio → usa localTemplate. */
  generatedContent?: string;
  contentGeneratedAt?: string;
  active: boolean;
}

/** Cidade ou bairro. Regra de 404: !active && type !== 'cidade' → não buildada. */
export interface Location {
  name: string;
  slug: string;
  state: string;
  city?: string;
  citySlug?: string;
  type: 'cidade' | 'bairro' | 'regiao' | 'zona';
  active: boolean;
}

/** Fallback usado quando service.generatedContent está vazio. */
export interface LocalTemplate {
  heroTitle?: string;
  heroSubtitle?: string;
  pageContent?: string;
  benefits?: string[];
  metaTitle?: string;
  metaDescription?: string;
}

/** Dados da empresa que alimentam as variáveis {empresa}/{telefone} e os CTAs. */
export interface LocalBusiness {
  companyName: string;
  phone?: string;
  whatsapp?: string;
  whatsappMessage?: string;
}

/** Variáveis disponíveis para substituição no conteúdo/template. */
export interface TemplateVars {
  cidade: string;
  estado: string;
  bairro: string;
  servico: string;
  empresa: string;
  telefone: string;
}
