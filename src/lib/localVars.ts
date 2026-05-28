/**
 * localVars.ts — Substituição de variáveis do Tema Local.
 *
 * Portado de cnx (src/utils/location-utils.ts → applyTemplateVars).
 * O conteúdo do serviço é parametrizado uma vez; cada página de cidade só troca
 * os tokens {cidade}/{servico}/... em build-time. Custo de IA é por serviço,
 * não por página.
 */

import type { Location, Service, LocalBusiness, TemplateVars } from './localTypes';

/**
 * Substitui tokens {variavel} num texto. Token desconhecido fica literal.
 * Ex: applyTemplateVars("{servico} em {cidade}", { servico: "Andaime", cidade: "Moema" })
 *     → "Andaime em Moema"
 */
export function applyTemplateVars(text: string, vars: Record<string, string>): string {
  if (!text) return '';
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

/** Monta o dicionário de variáveis a partir de uma localidade + serviço + empresa. */
export function buildTemplateVars(
  loc: Location,
  svc: Service,
  biz: LocalBusiness,
): TemplateVars {
  return {
    cidade: loc.name,
    estado: loc.state,
    bairro: loc.name,
    servico: svc.title,
    empresa: biz.companyName || '',
    telefone: biz.phone || '',
  };
}
