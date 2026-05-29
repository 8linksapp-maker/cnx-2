import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Loader2, Check, ArrowRight, ArrowLeft, Wand2, Sparkles, ExternalLink, PartyPopper, Rocket, Image as ImageIcon } from 'lucide-react';
import { triggerToast } from '../CmsToaster';
import { githubApi, atomicCommitApi } from '../../../lib/adminApi';
import { slugify } from '../../../lib/slugify';
import type { Service, Location, OutlineItem } from '../../../lib/localTypes';

interface TemplateService { title: string; icon?: string; shortDescription?: string; outline?: OutlineItem[]; pexelsQuery?: string; }
interface NicheTemplate { slug: string; name: string; icon?: string; color: string; description?: string; services: TemplateService[]; }

const STEPS = ['Nicho', 'Onde atende', 'Criar'];

export default function SiteWizard() {
    const [templates, setTemplates] = useState<NicheTemplate[]>([]);
    const [svcSha, setSvcSha] = useState('');
    const [locSha, setLocSha] = useState('');
    const [existingSvc, setExistingSvc] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [step, setStep] = useState(1);
    const [chosen, setChosen] = useState<NicheTemplate | null>(null);
    const [locText, setLocText] = useState('');
    const [genAI, setGenAI] = useState(true);
    const [withImages, setWithImages] = useState(true);

    const [creating, setCreating] = useState(false);
    const [progress, setProgress] = useState('');
    const [result, setResult] = useState<{ count: number; urls: { path: string; label: string }[] } | null>(null);

    useEffect(() => {
        Promise.all([
            githubApi('read', 'src/data/templates.json').catch(() => ({ content: '[]' })),
            githubApi('read', 'src/data/services.json').catch(e => { if (e.message.includes('404')) return { content: '[]', sha: '' }; throw e; }),
            githubApi('read', 'src/data/locations.json').catch(e => { if (e.message.includes('404')) return { content: '[]', sha: '' }; throw e; }),
        ])
            .then(([tpl, svc, loc]) => {
                setTemplates(JSON.parse(tpl?.content || '[]'));
                setExistingSvc((JSON.parse(svc?.content || '[]') || []).length);
                setSvcSha(svc.sha || ''); setLocSha(loc.sha || '');
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    // Lugares válidos a partir do texto "Nome, UF" por linha.
    const parsedLocs = useMemo<Location[]>(() => {
        const seen = new Set<string>();
        const out: Location[] = [];
        for (const line of locText.split('\n')) {
            const [rawName, rawUf] = line.split(',').map(p => p.trim());
            const uf = (rawUf || '').toUpperCase();
            const slug = slugify(rawName || '');
            if (!rawName || !slug || !/^[A-Za-z]{2}$/.test(uf) || seen.has(slug)) continue;
            seen.add(slug);
            out.push({ name: rawName, slug, state: uf, type: 'bairro', active: true });
        }
        return out;
    }, [locText]);

    const pageCount = chosen ? chosen.services.length * parsedLocs.length : 0;

    const create = async () => {
        if (!chosen || parsedLocs.length === 0) return;
        setCreating(true); setError(''); setProgress('Preparando os serviços...');
        try {
            const services: Service[] = chosen.services.map((s) => ({
                title: s.title, slug: slugify(s.title), color: chosen.color, niche: chosen.slug, active: true,
                ...(s.icon ? { icon: s.icon } : {}),
                ...(s.shortDescription ? { shortDescription: s.shortDescription } : {}),
                ...(s.outline?.length ? { outline: s.outline } : {}),
            }));

            // Opcional: imagens automáticas do Pexels (1 chamada em lote).
            if (withImages) {
                setProgress('Buscando imagens…');
                try {
                    const queries = chosen.services.map(s => s.pexelsQuery || s.title);
                    const res = await fetch('/api/admin/local/pexels-image', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queries }),
                    });
                    const data = await res.json();
                    if (Array.isArray(data.urls)) data.urls.forEach((u: string, i: number) => { if (u && services[i]) services[i].image = u; });
                } catch { /* segue sem imagens */ }
            }

            // Opcional: a IA escreve o texto de cada serviço.
            if (genAI) {
                for (let i = 0; i < services.length; i++) {
                    const s = services[i];
                    setProgress(`Escrevendo o texto de "${s.title}"… (${i + 1}/${services.length})`);
                    try {
                        const res = await fetch('/api/admin/local/generate-content', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ servico: s.title, outline: s.outline || [], includeFaq: true }),
                        });
                        const data = await res.json();
                        if (res.ok && data.content) {
                            s.generatedContent = data.content;
                            s.contentGeneratedAt = new Date().toISOString().split('T')[0];
                        }
                    } catch { /* segue sem o texto desse serviço */ }
                }
            }

            setProgress('Publicando os dados...');
            await atomicCommitApi([
                { path: 'src/data/services.json', content: JSON.stringify(services, null, 2) },
                { path: 'src/data/locations.json', content: JSON.stringify(parsedLocs, null, 2) },
            ], `CMS: cria site (${chosen.slug}, ${services.length}×${parsedLocs.length})`);

            const urls = parsedLocs.flatMap(l => services.map(s => ({
                path: `/${l.slug}/${s.slug}`, label: `${s.title} em ${l.name} · ${l.state}`,
            })));
            setResult({ count: urls.length, urls });
            setStep(4);
            triggerToast(`Site criado! ${urls.length} páginas.`, 'success', 100);
        } catch {
            setError('Não foi possível criar o site. Verifique sua conexão e tente de novo.');
            triggerToast('Não foi possível criar o site.', 'error');
        } finally { setCreating(false); setProgress(''); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-lg border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Carregando o assistente...</p>
        </div>
    );

    // ── Sucesso (wow) ──
    if (step === 4 && result) return (
        <div className="max-w-2xl mx-auto bg-surface border border-border rounded-lg p-8 text-center">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ backgroundColor: chosen!.color, color: '#f8f8f6' }}>
                <PartyPopper className="w-8 h-8" aria-hidden="true" />
            </div>
            <p className="mono uppercase text-ink-faint text-sm mb-1">seu site está pronto</p>
            <h2 className="font-display text-4xl text-ink leading-none mb-2">{result.count.toLocaleString('pt-BR')} páginas criadas</h2>
            <p className="text-ink-muted mb-6">{chosen!.services.length} serviços × {parsedLocs.length} lugares. Falta só publicar pra ir pro ar.</p>

            <div className="flex flex-wrap gap-3 justify-center mb-6">
                <a href="/admin/local/pages" className="inline-flex items-center gap-2 bg-primary text-surface px-6 py-3 min-h-[44px] rounded font-semibold no-underline hover:brightness-90 transition-all">
                    <Rocket className="w-4 h-4" aria-hidden="true" /> Publicar agora
                </a>
                <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-border text-ink px-6 py-3 min-h-[44px] rounded font-semibold no-underline hover:border-ink transition-colors">
                    Ver meu site <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
            </div>

            <details className="text-left">
                <summary className="text-sm font-semibold text-primary cursor-pointer">Ver as {result.count} páginas</summary>
                <ul className="mt-3 divide-y divide-border max-h-72 overflow-y-auto border border-border rounded-md">
                    {result.urls.slice(0, 300).map(u => (
                        <li key={u.path}>
                            <a href={u.path} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-elev no-underline group">
                                <span className="min-w-0"><span className="text-sm text-ink truncate block">{u.label}</span><span className="font-mono text-[11px] text-ink-faint truncate block">{u.path}</span></span>
                                <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                            </a>
                        </li>
                    ))}
                </ul>
                {result.urls.length > 300 && <p className="text-[11px] text-ink-faint mt-2">Mostrando 300 de {result.count}.</p>}
            </details>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto">
            {error && <div role="alert" className="p-4 mb-4 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm"><AlertCircle className="w-4 h-4 inline mr-2 -mt-0.5" />{error}</div>}

            {/* Stepper */}
            <ol className="flex items-center gap-2 mb-8">
                {STEPS.map((label, i) => {
                    const n = i + 1;
                    const active = step === n, done = step > n;
                    return (
                        <li key={label} className="flex items-center gap-2 flex-1">
                            <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-primary text-surface' : active ? 'bg-primary-soft text-primary ring-2 ring-primary/30' : 'bg-elev text-ink-faint'}`}>
                                {done ? <Check className="w-4 h-4" aria-hidden="true" /> : n}
                            </span>
                            <span className={`text-sm font-semibold ${active || done ? 'text-ink' : 'text-ink-faint'}`}>{label}</span>
                            {n < STEPS.length && <span className="flex-1 h-px bg-border" aria-hidden="true" />}
                        </li>
                    );
                })}
            </ol>

            {/* Passo 1 — Nicho */}
            {step === 1 && (
                <div>
                    <h2 className="font-display text-2xl text-ink mb-1">Qual é o ramo do seu negócio?</h2>
                    <p className="text-ink-muted mb-6">Escolha um modelo — os serviços já entram prontos.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {templates.map((tpl) => (
                            <button key={tpl.slug} type="button" onClick={() => setChosen(tpl)}
                                className={`text-left rounded-lg border-2 p-5 transition-all ${chosen?.slug === tpl.slug ? 'border-primary bg-primary-soft/40' : 'border-border bg-surface hover:border-ink/30'}`}>
                                <div className="flex items-center gap-3">
                                    <span className="w-11 h-11 rounded-md flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: tpl.color, color: '#f8f8f6' }} aria-hidden="true">{tpl.icon || '📦'}</span>
                                    <div className="min-w-0">
                                        <h3 className="font-display text-lg text-ink leading-tight">{tpl.name}</h3>
                                        <p className="text-xs text-ink-faint">{tpl.services.length} serviços</p>
                                    </div>
                                    {chosen?.slug === tpl.slug && <Check className="w-5 h-5 text-primary ml-auto shrink-0" aria-hidden="true" />}
                                </div>
                                {tpl.description && <p className="text-sm text-ink-muted mt-3 leading-relaxed">{tpl.description}</p>}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-end mt-8">
                        <button onClick={() => setStep(2)} disabled={!chosen} className="inline-flex items-center gap-2 bg-primary disabled:opacity-50 text-surface px-6 py-3 min-h-[44px] rounded font-semibold hover:brightness-90 transition-all">Próximo <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
                    </div>
                </div>
            )}

            {/* Passo 2 — Lugares */}
            {step === 2 && (
                <div>
                    <h2 className="font-display text-2xl text-ink mb-1">Onde você atende?</h2>
                    <p className="text-ink-muted mb-6">Liste as cidades e bairros — um por linha, no formato <code className="bg-elev px-1 rounded font-mono text-sm">Nome, UF</code>.</p>
                    <pre className="text-xs font-mono bg-elev rounded-md p-3 text-ink-muted leading-relaxed mb-3">Moema, SP{'\n'}Pinheiros, SP{'\n'}Santo André, SP</pre>
                    <textarea rows={8} value={locText} onChange={e => setLocText(e.target.value)} autoFocus
                        className="w-full bg-elev border border-border rounded-md px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-primary/30 outline-none resize-y" placeholder="Moema, SP" aria-label="Lugares atendidos" />
                    <p className="text-sm text-ink-muted mt-2">{parsedLocs.length} lugar(es) válido(s).</p>
                    <div className="flex justify-between mt-8">
                        <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] font-semibold text-ink-muted hover:bg-elev rounded transition-colors"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Voltar</button>
                        <button onClick={() => setStep(3)} disabled={parsedLocs.length === 0} className="inline-flex items-center gap-2 bg-primary disabled:opacity-50 text-surface px-6 py-3 min-h-[44px] rounded font-semibold hover:brightness-90 transition-all">Próximo <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
                    </div>
                </div>
            )}

            {/* Passo 3 — Criar */}
            {step === 3 && chosen && (
                <div>
                    <h2 className="font-display text-2xl text-ink mb-1">Tudo pronto pra criar</h2>
                    <p className="text-ink-muted mb-6">Confira e crie seu site.</p>
                    <div className="bg-surface border border-border rounded-lg p-6 mb-5">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-10 h-10 rounded-md flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: chosen.color, color: '#f8f8f6' }} aria-hidden="true">{chosen.icon}</span>
                            <div><p className="font-bold text-ink">{chosen.name}</p><p className="text-sm text-ink-muted">{chosen.services.length} serviços × {parsedLocs.length} lugares</p></div>
                        </div>
                        <p className="font-display text-3xl text-ink leading-none"><span style={{ color: chosen.color }}>{pageCount.toLocaleString('pt-BR')}</span> páginas</p>
                        {existingSvc > 0 && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-4">Isso substitui os {existingSvc} serviço(s) e os lugares atuais.</p>}
                        {pageCount > 1500 && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3">Acima de ~1.500 páginas o build fica pesado. Considere começar com menos lugares.</p>}
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer bg-surface border border-border rounded-lg p-4 mb-3">
                        <input type="checkbox" checked={withImages} onChange={e => setWithImages(e.target.checked)} className="w-4 h-4 accent-primary mt-0.5" />
                        <span>
                            <span className="font-semibold text-ink flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-primary" aria-hidden="true" /> Buscar imagens automáticas</span>
                            <span className="block text-sm text-ink-muted mt-0.5">Pega uma foto do banco de imagens (Pexels) pra cada serviço. Precisa da chave do Pexels configurada em Plugins → IA; sem ela, o serviço usa cor + ícone.</span>
                        </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer bg-surface border border-border rounded-lg p-4 mb-6">
                        <input type="checkbox" checked={genAI} onChange={e => setGenAI(e.target.checked)} className="w-4 h-4 accent-primary mt-0.5" />
                        <span>
                            <span className="font-semibold text-ink flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" aria-hidden="true" /> Já escrever os textos com a IA</span>
                            <span className="block text-sm text-ink-muted mt-0.5">A IA escreve o texto de cada serviço agora (leva ~1 min). Sem isso, você gera depois — as páginas já funcionam com um texto padrão.</span>
                        </span>
                    </label>
                    {creating ? (
                        <div className="flex items-center gap-3 justify-center bg-primary-soft/40 border border-primary/30 rounded-lg p-5 text-primary font-semibold">
                            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> {progress || 'Criando…'}
                        </div>
                    ) : (
                        <div className="flex justify-between">
                            <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] font-semibold text-ink-muted hover:bg-elev rounded transition-colors"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Voltar</button>
                            <button onClick={create} className="inline-flex items-center gap-2 bg-primary text-surface px-7 py-3 min-h-[44px] rounded font-bold hover:brightness-90 transition-all"><Wand2 className="w-4 h-4" aria-hidden="true" /> Criar meu site</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
