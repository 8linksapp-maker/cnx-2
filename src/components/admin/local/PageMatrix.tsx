import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Loader2, Check, Layers, LayoutGrid, ExternalLink, Search } from 'lucide-react';
import { triggerToast } from '../CmsToaster';
import { githubApi } from '../../../lib/adminApi';
import type { Service, Location, Niche } from '../../../lib/localTypes';

/** Uma localidade é "buildada" se ativa OU se for cidade (regra de 404 do tema). */
const isBuilt = (l: Location) => l.active !== false || l.type === 'cidade';

export default function PageMatrix() {
    const [services, setServices] = useState<Service[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [niches, setNiches] = useState<Niche[]>([]);
    const [svcSha, setSvcSha] = useState('');
    const [locSha, setLocSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingAxis, setSavingAxis] = useState<'svc' | 'loc' | null>(null);
    const [error, setError] = useState('');
    const [locQuery, setLocQuery] = useState('');
    const [nicheFilter, setNicheFilter] = useState('');
    const [urlQuery, setUrlQuery] = useState('');

    useEffect(() => {
        Promise.all([
            githubApi('read', 'src/data/services.json').catch(e => { if (e.message.includes('404')) return { content: '[]', sha: '' }; throw e; }),
            githubApi('read', 'src/data/locations.json').catch(e => { if (e.message.includes('404')) return { content: '[]', sha: '' }; throw e; }),
            githubApi('read', 'src/data/nichos.json').catch(() => ({ content: '[]' })),
        ])
            .then(([svc, loc, nic]) => {
                setServices(JSON.parse(svc?.content || '[]')); setSvcSha(svc.sha || '');
                setLocations(JSON.parse(loc?.content || '[]')); setLocSha(loc.sha || '');
                setNiches(JSON.parse(nic?.content || '[]'));
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const activeServices = services.filter(s => s.active !== false);
    const builtLocations = locations.filter(isBuilt);
    const pageCount = activeServices.length * builtLocations.length;

    const visibleServices = useMemo(
        () => services.map((s, i) => ({ s, i })).filter(({ s }) => !nicheFilter || s.niche === nicheFilter),
        [services, nicheFilter],
    );
    const visibleLocations = useMemo(() => {
        const q = locQuery.trim().toLowerCase();
        return locations.map((l, i) => ({ l, i })).filter(({ l }) =>
            !q || l.name.toLowerCase().includes(q) || (l.city || '').toLowerCase().includes(q) || l.state.toLowerCase().includes(q));
    }, [locations, locQuery]);

    // Todas as URLs que vão pro ar (serviço ativo × lugar publicável).
    const allUrls = useMemo(() => {
        const out: { path: string; svc: string; loc: string; state: string }[] = [];
        for (const l of locations.filter(isBuilt)) {
            for (const s of services.filter(x => x.active !== false)) {
                out.push({ path: `/${l.slug}/${s.slug}`, svc: s.title, loc: l.name, state: l.state });
            }
        }
        return out;
    }, [services, locations]);
    const filteredUrls = useMemo(() => {
        const q = urlQuery.trim().toLowerCase();
        if (!q) return allUrls;
        return allUrls.filter(u => u.svc.toLowerCase().includes(q) || u.loc.toLowerCase().includes(q) || u.path.toLowerCase().includes(q));
    }, [allUrls, urlQuery]);
    const URL_CAP = 300;

    const saveServices = async (arr: Service[]) => {
        setSavingAxis('svc'); setError('');
        try {
            const data = await githubApi('write', 'src/data/services.json', { content: JSON.stringify(arr, null, 2), sha: svcSha || undefined, message: 'CMS: ativa/desativa serviços' });
            setSvcSha(data.sha); triggerToast('Serviços atualizados!', 'success', 100);
        } catch { setError('Não foi possível salvar os serviços.'); triggerToast('Falha ao salvar serviços.', 'error'); }
        finally { setSavingAxis(null); }
    };
    const saveLocations = async (arr: Location[]) => {
        setSavingAxis('loc'); setError('');
        try {
            const data = await githubApi('write', 'src/data/locations.json', { content: JSON.stringify(arr, null, 2), sha: locSha || undefined, message: 'CMS: ativa/desativa localidades' });
            setLocSha(data.sha); triggerToast('Localidades atualizadas!', 'success', 100);
        } catch { setError('Não foi possível salvar as localidades.'); triggerToast('Falha ao salvar localidades.', 'error'); }
        finally { setSavingAxis(null); }
    };

    const toggleService = (idx: number) => {
        const arr = services.map((s, i) => i === idx ? { ...s, active: s.active === false } : s);
        setServices(arr); saveServices(arr);
    };
    const toggleLocation = (idx: number) => {
        const arr = locations.map((l, i) => i === idx ? { ...l, active: l.active === false } : l);
        setLocations(arr); saveLocations(arr);
    };
    const bulkServices = (active: boolean) => {
        const ids = new Set(visibleServices.map(v => v.i));
        const arr = services.map((s, i) => ids.has(i) ? { ...s, active } : s);
        setServices(arr); saveServices(arr);
    };
    const bulkLocations = (active: boolean) => {
        const ids = new Set(visibleLocations.map(v => v.i));
        const arr = locations.map((l, i) => ids.has(i) ? { ...l, active } : l);
        setLocations(arr); saveLocations(arr);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-lg border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Montando a matriz...</p>
        </div>
    );

    const empty = services.length === 0 || locations.length === 0;

    return (
        <div className="space-y-6">
            {error && <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm"><AlertCircle className="w-4 h-4 inline mr-2 -mt-0.5" />{error}</div>}

            {/* Contador */}
            <div className="bg-surface border border-border rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <p className="text-[10px] font-bold text-ink-faint uppercase tracking-widest mb-1">Páginas que serão geradas</p>
                    <p className="font-display text-4xl text-ink leading-none">{pageCount.toLocaleString('pt-BR')}</p>
                    <p className="text-sm text-ink-muted mt-2">{activeServices.length} serviço(s) ativo(s) × {builtLocations.length} localidade(s) publicável(is)</p>
                </div>
                {pageCount > 1500 && (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 max-w-xs">
                        Acima de ~1.500 páginas o build fica pesado. Considere publicar por nicho.
                    </div>
                )}
            </div>

            {empty ? (
                <div className="bg-elev border-2 border-dashed border-border rounded-lg p-16 flex flex-col items-center justify-center text-center">
                    <LayoutGrid className="w-12 h-12 text-ink-faint mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-bold text-ink mb-1">Matriz vazia</h3>
                    <p className="text-ink-muted">
                        Você precisa de pelo menos um <a href="/admin/local/services" className="font-semibold underline">serviço</a> e uma <a href="/admin/local/locations" className="font-semibold underline">localidade</a> para gerar páginas.
                    </p>
                </div>
            ) : (
                <>
                    {/* Suas páginas — lista clicável de todas as URLs geradas */}
                    <div className="bg-surface border border-border rounded-lg p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div>
                                <h3 className="font-bold text-ink">Suas páginas</h3>
                                <p className="text-xs text-ink-muted mt-0.5">{allUrls.length.toLocaleString('pt-BR')} página(s) no ar. Clique pra abrir.</p>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                                <input type="search" value={urlQuery} onChange={e => setUrlQuery(e.target.value)} placeholder="Buscar página…" className="w-full bg-elev border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none" aria-label="Buscar página" />
                            </div>
                        </div>
                        {filteredUrls.length === 0 ? (
                            <p className="text-sm text-ink-faint py-4 text-center">
                                {allUrls.length === 0 ? 'Nenhuma página ativa. Ative serviços e lugares abaixo.' : `Nenhuma página encontrada para "${urlQuery}".`}
                            </p>
                        ) : (
                            <ul className="divide-y divide-border max-h-80 overflow-y-auto border border-border rounded-md">
                                {filteredUrls.slice(0, URL_CAP).map((u) => (
                                    <li key={u.path}>
                                        <a href={u.path} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-elev no-underline group">
                                            <span className="min-w-0">
                                                <span className="text-sm text-ink truncate block">{u.svc} <span className="text-ink-faint">em</span> {u.loc} <span className="text-ink-faint">· {u.state}</span></span>
                                                <span className="font-mono text-[11px] text-ink-faint truncate block">{u.path}</span>
                                            </span>
                                            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-60 group-hover:opacity-100 transition-opacity">abrir <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /></span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {filteredUrls.length > URL_CAP && <p className="text-[11px] text-ink-faint mt-2">Mostrando {URL_CAP} de {filteredUrls.length.toLocaleString('pt-BR')}. Use a busca pra achar uma específica.</p>}
                        <p className="text-[11px] text-ink-faint mt-2">As páginas abrem no seu site. O que você acabou de mudar aparece depois de publicar.</p>
                    </div>

                    {/* Controles por eixo */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Serviços */}
                        <div className="bg-surface border border-border rounded-lg p-5">
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <h3 className="font-bold text-ink flex items-center gap-2"><Layers className="w-4 h-4 text-ink-faint" aria-hidden="true" /> Serviços</h3>
                                <div className="flex items-center gap-2">
                                    {savingAxis === 'svc' && <Loader2 className="w-4 h-4 animate-spin text-ink-faint" aria-hidden="true" />}
                                    <button onClick={() => bulkServices(true)} className="text-xs font-semibold text-primary hover:underline">Ativar todos</button>
                                    <span className="text-ink-faint">·</span>
                                    <button onClick={() => bulkServices(false)} className="text-xs font-semibold text-ink-muted hover:underline">Desativar</button>
                                </div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="mtx-niche" className="sr-only">Filtrar serviços por nicho</label>
                                <select id="mtx-niche" value={nicheFilter} onChange={e => setNicheFilter(e.target.value)} className="w-full bg-elev border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none">
                                    <option value="">Todos os nichos</option>
                                    {niches.map(n => <option key={n.slug} value={n.slug}>{n.name}</option>)}
                                </select>
                            </div>
                            <ul className="space-y-1 max-h-64 overflow-y-auto">
                                {visibleServices.map(({ s, i }) => (
                                    <li key={i}>
                                        <label className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-elev cursor-pointer">
                                            <input type="checkbox" checked={s.active !== false} onChange={() => toggleService(i)} className="w-4 h-4 accent-primary" />
                                            <span className="text-sm text-ink truncate">{s.icon || '🔧'} {s.title}</span>
                                            {!s.generatedContent && <span className="ml-auto text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">sem conteúdo</span>}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Localidades */}
                        <div className="bg-surface border border-border rounded-lg p-5">
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <h3 className="font-bold text-ink flex items-center gap-2">📍 Localidades</h3>
                                <div className="flex items-center gap-2">
                                    {savingAxis === 'loc' && <Loader2 className="w-4 h-4 animate-spin text-ink-faint" aria-hidden="true" />}
                                    <button onClick={() => bulkLocations(true)} className="text-xs font-semibold text-primary hover:underline">Ativar todos</button>
                                    <span className="text-ink-faint">·</span>
                                    <button onClick={() => bulkLocations(false)} className="text-xs font-semibold text-ink-muted hover:underline">Desativar</button>
                                </div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="mtx-loc-q" className="sr-only">Buscar localidade</label>
                                <input id="mtx-loc-q" type="search" value={locQuery} onChange={e => setLocQuery(e.target.value)} placeholder="Buscar localidade…" className="w-full bg-elev border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                            </div>
                            <ul className="space-y-1 max-h-64 overflow-y-auto">
                                {visibleLocations.map(({ l, i }) => (
                                    <li key={i}>
                                        <label className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-elev cursor-pointer">
                                            <input type="checkbox" checked={l.active !== false} onChange={() => toggleLocation(i)} className="w-4 h-4 accent-primary" disabled={l.type === 'cidade'} />
                                            <span className="text-sm text-ink truncate">{l.name} <span className="text-ink-faint font-mono text-xs">· {l.state}</span></span>
                                            {l.type === 'cidade' && <span className="ml-auto text-[10px] font-bold uppercase text-ink-faint shrink-0" title="Cidades sempre geram página">sempre</span>}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Matriz visual */}
                    <div className="bg-surface border border-border rounded-lg p-5">
                        <h3 className="font-bold text-ink mb-1">Matriz</h3>
                        <p className="text-xs text-ink-muted mb-4">Cada célula marcada vira uma página. Linhas = serviços, colunas = localidades.</p>
                        <div className="overflow-auto max-h-[28rem] border border-border rounded">
                            <table className="border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th className="sticky left-0 top-0 z-20 bg-elev border-b border-r border-border px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-ink-faint min-w-[12rem]">Serviço \ Local</th>
                                        {visibleLocations.map(({ l, i }) => (
                                            <th key={i} className="sticky top-0 z-10 bg-elev border-b border-border px-2 py-2 text-[11px] font-medium text-ink-muted whitespace-nowrap" title={`${l.name} · ${l.state}`}>
                                                {l.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleServices.map(({ s, i }) => (
                                        <tr key={i}>
                                            <th className="sticky left-0 z-10 bg-surface border-r border-b border-border px-3 py-2 text-left font-medium text-ink whitespace-nowrap">{s.icon || '🔧'} {s.title}</th>
                                            {visibleLocations.map(({ l }, k) => {
                                                const willGen = s.active !== false && isBuilt(l);
                                                const niche = niches.find(n => n.slug === s.niche);
                                                return (
                                                    <td key={k} className="border-b border-border text-center px-2 py-2">
                                                        {willGen
                                                            ? <Check className="w-4 h-4 inline" style={{ color: niche?.color || 'rgb(var(--c-primary))' }} aria-label="Gera página" />
                                                            : <span className="text-border" aria-label="Não gera">·</span>}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
