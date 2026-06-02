/**
 * localHomeData.ts — Camada de dados da home local (dona: Francis).
 *
 * Centraliza TODA a leitura + derivação que a LocalHome.astro precisa, pra que o
 * componente fique só com markup/visual (dono: Leonardo). Separa territórios:
 * lógica de dados aqui, aparência lá.
 *
 * Aceita `preview` (rascunho não-salvo) pra alimentar a prévia ao vivo do admin
 * sem publicar — a rota /admin/local/preview passa os dados do editor por aqui.
 */
import { readData } from './readData';
import { pickInk } from './contrastInk';
import { applyTemplateVars } from './localVars';
import type { Niche, Service, Location, LocalBusiness, LocalHome } from './localTypes';

export interface HomePreview {
  biz?: LocalBusiness;
  home?: LocalHome;
  services?: Service[];
  locations?: Location[];
  niches?: Niche[];
}

/** Extrai o src do embed do Google Maps (aceita URL pura ou o <iframe> colado). */
export function mapSrc(raw?: string): string {
  if (!raw) return '';
  const m = raw.match(/src="([^"]+)"/);
  const url = (m ? m[1] : raw).trim();
  return /^https:\/\/(www\.)?(google\.[^/]+\/maps\/embed|maps\.google\.)/.test(url) || /google\.[^/]+\/maps\?/.test(url)
    ? url
    : '';
}

export function loadHomeData(preview?: HomePreview) {
  const services = (preview?.services ?? readData<Service[]>('services.json', [])).filter((s) => s.active !== false);
  const locations = preview?.locations ?? readData<Location[]>('locations.json', []);
  const niches = preview?.niches ?? readData<Niche[]>('nichos.json', []);
  const biz = preview?.biz ?? readData<LocalBusiness>('localBusiness.json', {} as LocalBusiness);
  const home = preview?.home ?? readData<LocalHome>('localHome.json', {});
  const siteConfig = readData('siteConfig.json');

  const builtLocations = locations.filter((l) => l.active !== false || l.type === 'cidade');
  const principalLoc = builtLocations.find((l) => l.type === 'cidade') || builtLocations[0] || null;
  const cities = builtLocations.filter((l) => l.type === 'cidade');
  const region = principalLoc?.name || cities[0]?.name || '';

  const nicheOf = (slug?: string) => niches.find((n) => n.slug === slug);
  const company = biz.companyName || siteConfig.name || 'Minha Empresa';

  // Cor de marca do site. Prioridade: tema do admin (Destaque > Primária) → cor do
  // 1º serviço/nicho (legado) → fallback. Vira o accent de tudo (hero, CTAs, páginas).
  const themeBrand = siteConfig.theme?.accent || siteConfig.theme?.primary || '';
  const heroColor = themeBrand || services[0]?.color || nicheOf(services[0]?.niche)?.color || niches[0]?.color || '#8b4a36';
  const heroImg = biz.heroImage || '';
  const heroInk = heroImg ? 'rgb(248 248 246)' : pickInk(heroColor).color;
  const heroInitial = ((biz.companyName || siteConfig.name || 'A').trim()[0] || 'A').toUpperCase();
  const accent = heroColor;
  const accentInk = pickInk(accent).color;

  const waNumber = (biz.whatsapp || '').replace(/\D/g, '');
  const waUrl = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(biz.whatsappMessage || 'Olá! Vim pelo site e gostaria de um orçamento.')}`
    : '';
  const phoneHref = biz.phone ? `tel:${biz.phone.replace(/[^\d+]/g, '')}` : '';

  const heroTitle = biz.homeTitle || siteConfig.description || `${company}: atendimento profissional perto de você.`;
  const heroSubtitle = biz.homeSubtitle || '';
  const aboutParas = (biz.aboutText || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  // Variáveis resolvidas pra localidade principal (a home mostra UMA cidade de referência).
  const homeVars: Record<string, string> = {
    cidade: region || 'sua região',
    estado: principalLoc?.state || '',
    bairro: region,
    servico: services[0]?.title || 'nossos serviços',
    empresa: company,
    telefone: biz.phone || '',
  };
  const av = (s?: string) => applyTemplateVars(s || '', homeVars);

  const trust = (home.trust && home.trust.length ? home.trust : [
    'Orçamento sem compromisso',
    'Atendemos {cidade} e região',
    'Resposta rápida no WhatsApp',
  ]).map(av).filter(Boolean);

  // Fallback igual a trust/steps: evita a seção sumir quando o site é criado pelo
  // wizard (que não semeia localHome.json). Editável em Página inicial.
  const benefits = (home.benefits && home.benefits.length ? home.benefits : [
    'Profissionais qualificados',
    'Atendemos {cidade} e região',
    'Compromisso com prazo e qualidade',
  ]).map(av).filter(Boolean);

  const steps = (home.steps && home.steps.length ? home.steps : [
    { title: 'Você pede o orçamento', description: 'Fale com a gente pelo WhatsApp ou telefone e conte o que você precisa.' },
    { title: 'A gente combina tudo', description: 'Confirmamos prazo, valor e detalhes, sem compromisso nenhum.' },
    { title: 'Atendemos você', description: 'Atendimento em {cidade} e região, no horário combinado.' },
  ]).map((s, i) => ({ n: String(i + 1), t: av(s.title), d: av(s.description) }));

  const secOf = (k: keyof NonNullable<LocalHome['sections']>) => home.sections?.[k] || {};
  const labels = {
    servicos: { eyebrow: secOf('servicos').eyebrow || 'o que fazemos', title: secOf('servicos').title || 'Nossos serviços' },
    comoFunciona: { eyebrow: secOf('comoFunciona').eyebrow || 'simples assim', title: secOf('comoFunciona').title || 'Como funciona' },
    ondeAtendemos: { eyebrow: secOf('ondeAtendemos').eyebrow || 'onde atendemos', title: secOf('ondeAtendemos').title || 'Áreas de atendimento' },
    contato: { eyebrow: secOf('contato').eyebrow || 'fale com a gente', title: secOf('contato').title || 'Contato' },
  };
  const show = (k: keyof NonNullable<LocalHome['show']>) => home.show?.[k] !== false;

  const ctaTitle = av(home.ctaTitle || (services[0] ? `Precisa de ${services[0].title.toLowerCase()}?` : 'Precisa de um orçamento?'));
  const ctaSubtitle = av(home.ctaSubtitle || 'Fale agora e receba um orçamento sem compromisso.');

  const embedSrc = mapSrc(biz.mapEmbed);
  const serviceHref = (svc: Service) => (principalLoc ? `/${principalLoc.slug}/${svc.slug}` : '#');
  const empty = services.length === 0 || builtLocations.length === 0;

  // Serviços que aparecem na home: os em destaque (na ordem) ou os 9 primeiros.
  const featured = (home.featuredServices || [])
    .map((slug) => services.find((s) => s.slug === slug))
    .filter(Boolean) as Service[];
  const homeServices = (featured.length ? featured : services).slice(0, 9);

  return {
    services, homeServices, builtLocations, principalLoc, cities, region, niches, nicheOf, company,
    heroColor, heroImg, heroInk, heroInitial, accent, accentInk,
    waUrl, phoneHref, biz,
    heroTitle, heroSubtitle, aboutParas,
    trust, benefits, steps, labels, show, ctaTitle, ctaSubtitle,
    embedSrc, serviceHref, empty,
  };
}
