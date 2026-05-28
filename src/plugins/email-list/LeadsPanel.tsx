/**
 * LeadsPanel.tsx — Painel de subscribers da newsletter
 */

import { useState, useEffect } from 'react';
import { Loader2, Download, Search, Users, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface Subscriber {
    email: string;
    name: string;
    subscribedAt: string;
    source: string;
    tags: string[];
}

const PAGE_SIZE = 50;

const sourceLabel: Record<string, string> = {
    popup: 'Popup do site',
    widget: 'Sidebar do blog',
    api: 'Integração externa',
    inline: 'Formulário no artigo',
};

const sourceBadge: Record<string, string> = {
    popup: 'bg-primary-soft text-primary',
    widget: 'bg-blue-100 text-blue-700',
    api: 'bg-elev text-ink-muted',
    inline: 'bg-green-100 text-green-700',
};

export default function LeadsPanel() {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        fetch('/api/admin/plugins/email-list/leads')
            .then(r => r.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setSubscribers(data.subscribers || []);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const filtered = subscribers.filter(s =>
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.name?.toLowerCase().includes(search.toLowerCase())
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * PAGE_SIZE;
    const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
    const paginated = filtered.slice(pageStart, pageEnd);

    function exportCsv() {
        const header = 'Email,Nome,Data,Fonte,Tags';
        const rows = subscribers.map(s =>
            [
                `"${s.email}"`,
                `"${s.name || ''}"`,
                `"${new Date(s.subscribedAt).toLocaleString('pt-BR')}"`,
                `"${s.source}"`,
                `"${(s.tags || []).join(', ')}"`,
            ].join(',')
        );
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-16 text-ink-faint">
            <Loader2 className="w-7 h-7 animate-spin mb-3 text-primary" />
            <p className="text-sm font-medium animate-pulse">Carregando leads...</p>
        </div>
    );

    if (error) return (
        <div className="bg-red-50 text-red-700 p-6 rounded-lg border border-red-200 flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary-soft rounded-md flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-bold text-ink">{subscribers.length} inscritos</p>
                        <p className="text-xs text-ink-muted">total na lista</p>
                    </div>
                </div>
                <button
                    onClick={exportCsv}
                    disabled={subscribers.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-md text-sm font-medium text-ink hover:bg-elev disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Exportar CSV
                </button>
            </div>

            {/* Busca */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                <input
                    type="text"
                    placeholder="Buscar por email ou nome..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-md text-sm focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20/20 transition-all"
                />
            </div>

            {/* Tabela */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-ink-faint">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    {subscribers.length === 0 ? (
                        <>
                            <p className="text-sm font-medium mb-2">Você ainda não tem inscritos.</p>
                            <p className="text-xs mb-4">Ative o popup de captura para começar.</p>
                            <a
                                href="/admin/plugins/email-list/settings"
                                className="inline-block px-4 py-2 bg-primary text-white rounded-md text-xs font-semibold hover:opacity-90 transition-opacity"
                            >
                                Ir para configurações
                            </a>
                        </>
                    ) : (
                        <p className="text-sm font-medium">Nenhum resultado para sua busca.</p>
                    )}
                </div>
            ) : (
                <>
                    <div className="bg-surface rounded-lg border border-border overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-elev">
                                    <th className="text-left px-4 py-3 text-xs font-bold text-ink-muted uppercase tracking-wider">Email</th>
                                    <th className="text-left px-4 py-3 text-xs font-bold text-ink-muted uppercase tracking-wider">Nome</th>
                                    <th className="text-left px-4 py-3 text-xs font-bold text-ink-muted uppercase tracking-wider">Data</th>
                                    <th className="text-left px-4 py-3 text-xs font-bold text-ink-muted uppercase tracking-wider">Fonte</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map((sub, i) => (
                                    <tr key={sub.email} className={`border-b border-slate-50 hover:bg-elev/50 transition-colors ${i === paginated.length - 1 ? 'border-0' : ''}`}>
                                        <td className="px-4 py-3 font-medium text-ink">{sub.email}</td>
                                        <td className="px-4 py-3 text-ink-muted">{sub.name || <span className="text-ink-faint">—</span>}</td>
                                        <td className="px-4 py-3 text-ink-muted text-xs whitespace-nowrap">
                                            {new Date(sub.subscribedAt).toLocaleDateString('pt-BR', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${sourceBadge[sub.source] || 'bg-elev text-ink-muted'}`}>
                                                {sourceLabel[sub.source] || sub.source}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginação */}
                    {filtered.length > PAGE_SIZE && (
                        <div className="flex items-center justify-between text-sm">
                            <p className="text-xs text-ink-muted">
                                Mostrando {pageStart + 1}–{pageEnd} de {filtered.length} inscritos
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={safePage === 1}
                                    className="p-1.5 rounded-md border border-border text-ink-muted hover:bg-elev disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <span className="px-3 py-1 text-xs font-medium text-ink-muted">
                                    {safePage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={safePage === totalPages}
                                    className="p-1.5 rounded-md border border-border text-ink-muted hover:bg-elev disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
