/**
 * SEOScoreWidget.tsx — Plugin SEO Toolkit
 *
 * Checklist de SEO embutido no PostEditor.
 * Avalia título, descrição, imagem, conteúdo em tempo real.
 */

import React, { useMemo } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface SEOScoreWidgetProps {
  title: string;
  description: string;
  heroImage: string;
  content: string;
}

interface Check {
  label: string;
  pass: boolean;
  hint: string;
}

function countWords(html: string): number {
  if (!html) return 0;
  let text = html;
  // Remove blocos completos de script/style (conteúdo dentro não conta)
  text = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  // Remove comentários HTML
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  // Remove todas as tags restantes
  text = text.replace(/<[^>]+>/g, ' ');
  // Entidades de WHITESPACE viram espaço (separam palavras)
  text = text.replace(/&(?:nbsp|ensp|emsp|thinsp|zwj|zwnj|#160|#8194|#8195|#8201|#x[Aa]0|#x2002|#x2003);/gi, ' ');
  // Demais entidades (acentos, símbolos) viram '' — não devem quebrar palavras
  // (ex: caf&eacute; deve contar como 1 palavra, não 2)
  text = text.replace(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi, '');
  // Normaliza qualquer whitespace em espaço único
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export default function SEOScoreWidget({ title, description, heroImage, content }: SEOScoreWidgetProps) {
  const checks = useMemo<Check[]>(() => {
    const tLen = title.trim().length;
    const dLen = description.trim().length;
    const words = countWords(content);
    return [
      {
        label: 'Título: 30–60 caracteres',
        pass: tLen >= 30 && tLen <= 60,
        hint: tLen < 30
          ? `Muito curto — o Google pode não exibir seu post nos resultados de busca`
          : tLen > 60
          ? `Muito longo (${tLen}) — pode ser cortado nos resultados`
          : `${tLen} caracteres`,
      },
      {
        label: 'Descrição: 120–160 caracteres',
        pass: dLen >= 120 && dLen <= 160,
        hint: dLen === 0
          ? 'Sem descrição — o Google vai criar uma automaticamente, sem controle sobre o texto'
          : dLen < 120
          ? `Muito curta (${dLen}) — adicione mais detalhes sobre o artigo`
          : dLen > 160
          ? `Muito longa (${dLen}) — pode ser cortada nos resultados`
          : `${dLen} caracteres`,
      },
      {
        label: 'Imagem de capa definida',
        pass: !!heroImage.trim(),
        hint: heroImage.trim()
          ? 'Imagem configurada'
          : 'Sem imagem — posts com imagem têm mais cliques nos resultados',
      },
      {
        label: 'Conteúdo > 300 palavras',
        pass: words > 300,
        hint: `${words} palavra${words !== 1 ? 's' : ''}`,
      },
    ];
  }, [title, description, heroImage, content]);

  const passed = checks.filter(c => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);

  const scoreColor =
    score >= 75 ? 'bg-green-500' :
    score >= 50 ? 'bg-amber-500' :
    'bg-red-500';

  const scoreText =
    score >= 75 ? 'text-green-700' :
    score >= 50 ? 'text-amber-700' :
    'text-red-700';

  const hasTitle = title.trim().length > 0;

  return (
    <div className="bg-surface p-5 rounded-lg border border-border shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
        <h3 className="font-bold text-ink text-sm">Checklist básico de SEO</h3>
        {hasTitle && <span className={`text-lg font-black ${scoreText}`}>{score}%</span>}
      </div>

      {!hasTitle ? (
        <p className="text-xs text-ink-faint text-center py-3">
          Preencha o título e a descrição para ver sua pontuação.
        </p>
      ) : (
        <>
          {/* Progress bar */}
          <div className="h-2 bg-elev rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${scoreColor}`}
              style={{ width: `${score}%` }}
            />
          </div>

          <div className="space-y-2">
            {checks.map(check => (
              <div key={check.label} className="flex items-start gap-2">
                {check.pass ? (
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${check.pass ? 'text-ink' : 'text-ink-muted'}`}>
                    {check.label}
                  </p>
                  <p className={`text-xs ${check.pass ? 'text-green-600' : 'text-ink-faint'}`}>
                    {check.hint}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-ink-faint mt-4 pt-3 border-t border-border leading-relaxed">
            Esta é uma verificação inicial. SEO completo também depende de palavras-chave, links e qualidade do conteúdo.
          </p>
        </>
      )}
    </div>
  );
}
