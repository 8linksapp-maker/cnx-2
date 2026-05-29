/**
 * api/admin/local/generate-content.ts — Tema Local
 *
 * Gera o conteúdo de UM serviço, PARAMETRIZADO. O texto usa os tokens literais
 * {cidade}/{servico}/{estado}/{empresa}/{telefone} — nunca uma cidade específica.
 * Assim 1 geração serve N páginas de cidade (substituição em build-time).
 *
 * Reusa o provider do plugin ai-generator (callAI). NÃO grava em services.json:
 * retorna o markdown e o ServicesManager salva (escritor único do arquivo).
 * Sem API key → placeholder estruturado parametrizado.
 */
import type { APIRoute } from 'astro';
import { validateSession } from '../../../../lib/auth';
import { loadAISettings, resolveApiKey, callAI } from '../../../../plugins/ai-generator/ai-provider';
import type { OutlineItem } from '../../../../lib/localTypes';

export const prerender = false;

const SYSTEM_PROMPT =
  'Você é um redator brasileiro especializado em SEO local para pequenas e médias empresas. ' +
  'Escreve em português do Brasil, com tom claro, confiável e profissional, sem jargão e sem exageros de marketing.';

function buildPrompt(servico: string, outline: OutlineItem[], includeFaq: boolean, tone?: string): string {
  const outlineText = outline.length
    ? outline.map((o) => `${o.level.toUpperCase()}: ${o.text}`).join('\n')
    : 'H2: Sobre o serviço\nH2: Por que escolher a gente\nH2: Como funciona';

  return [
    `Escreva o conteúdo de uma página de serviço local sobre "${servico}".`,
    '',
    'REGRA CRÍTICA — variáveis de template:',
    'O texto será reaproveitado em várias cidades. Use SEMPRE os tokens literais abaixo no lugar de valores concretos:',
    '- {cidade} (a cidade/bairro atendido) — NUNCA escreva o nome de uma cidade real',
    '- {servico} (o nome do serviço)',
    '- {estado} (a sigla do estado, ex: SP)',
    '- {empresa} (o nome da empresa)',
    '- {telefone} (o telefone de contato)',
    '',
    'Exemplo correto: "A {empresa} oferece {servico} em {cidade}, {estado}."',
    'Exemplo ERRADO: "A Andaimes SP oferece serviços em São Paulo."',
    '',
    'Estrutura (use estes títulos como seções H2 em markdown):',
    outlineText,
    '',
    tone ? `Tom desejado: ${tone}.` : '',
    includeFaq
      ? 'Ao final, inclua uma seção "## Perguntas frequentes" com 3 a 4 perguntas (cada uma como H3) e respostas curtas, também usando os tokens.'
      : '',
    '',
    'Formato de saída: APENAS markdown, começando direto pelo conteúdo. Não use blocos de código (```), não escreva título H1, não comente sobre a tarefa.',
  ].filter(Boolean).join('\n');
}

/** Placeholder parametrizado quando não há API key — estrutura útil pro usuário editar. */
function placeholderContent(servico: string, outline: OutlineItem[], includeFaq: boolean): string {
  const sections = (outline.length ? outline : [
    { level: 'h2', text: 'Sobre o serviço' },
    { level: 'h2', text: 'Por que escolher a {empresa}' },
    { level: 'h2', text: 'Como funciona' },
  ] as OutlineItem[])
    .map((o) => `## ${o.text}\n\nProcurando ${servico} em {cidade}, {estado}? A {empresa} atende toda a região de {cidade}. Fale com a gente pelo telefone {telefone}.`)
    .join('\n\n');

  const faq = includeFaq
    ? '\n\n## Perguntas frequentes\n\n### Vocês atendem {cidade}?\n\nSim, a {empresa} atende {cidade} e região.\n\n### Como peço um orçamento?\n\nÉ só ligar para {telefone} ou chamar no WhatsApp.'
    : '';

  return sections + faq;
}

function parseCookies(header: string): Record<string, string> {
  return Object.fromEntries(
    header.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    }),
  );
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const cookies = parseCookies(request.headers.get('cookie') || '');
    if (!(await validateSession(cookies['admin_session']))) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const servico = (body?.servico || '').toString().trim();
    const outline: OutlineItem[] = Array.isArray(body?.outline) ? body.outline : [];
    const includeFaq = body?.includeFaq !== false;
    const tone = body?.tone ? String(body.tone) : undefined;

    if (!servico) {
      return new Response(JSON.stringify({ error: 'Informe o nome do serviço.' }), { status: 400 });
    }

    const settings = loadAISettings();
    const apiKey = resolveApiKey(settings);

    let content: string;
    let usedAI = false;

    if (apiKey) {
      const prompt = buildPrompt(servico, outline, includeFaq, tone);
      let raw = await callAI(prompt, settings, apiKey, { systemPrompt: SYSTEM_PROMPT, maxTokens: 2048 });
      // Remove cerca de código que a IA às vezes adiciona.
      raw = raw.trim().replace(/^```(?:markdown|md)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
      content = raw || placeholderContent(servico, outline, includeFaq);
      usedAI = !!raw;
    } else {
      content = placeholderContent(servico, outline, includeFaq);
    }

    return new Response(JSON.stringify({ success: true, content, usedAI }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Erro ao gerar conteúdo.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
