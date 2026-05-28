import React, { useState, useEffect } from 'react';
import { Navigation, Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, AlertCircle, LayoutList, ExternalLink, MousePointerClick } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

type MenuItem = {
    label: string;
    href: string;
    showCategories?: boolean;
};

export default function MenuEditor() {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [siteConfig, setSiteConfig] = useState<any>(null);
    const [siteConfigSha, setSiteConfigSha] = useState('');
    const [menuHoverEnabled, setMenuHoverEnabled] = useState(true);

    useEffect(() => {
        Promise.all([
            githubApi('read', 'src/data/menu.json').catch(err => err.message.includes('404') ? null : Promise.reject(err)),
            githubApi('read', 'src/data/siteConfig.json').catch(() => null),
        ]).then(([menuData, cfgData]) => {
            if (menuData) {
                const parsed = JSON.parse(menuData.content || "{}");
                setItems(Array.isArray(parsed.items) ? parsed.items : []);
                setFileSha(menuData.sha);
            }
            if (cfgData) {
                const cfg = JSON.parse(cfgData.content);
                setSiteConfig(cfg);
                setSiteConfigSha(cfgData.sha);
                setMenuHoverEnabled(cfg.menuHoverEnabled !== false);
            }
        }).catch(err => setError(err.message))
          .finally(() => setLoading(false));
    }, []);

    async function save() {
        setSaving(true);
        try {
            await githubApi('write', 'src/data/menu.json', {
                content: JSON.stringify({ items }, null, 4),
                sha: fileSha,
            });
            const fresh = await githubApi('read', 'src/data/menu.json');
            setFileSha(fresh.sha);

            // Salva menuHoverEnabled em siteConfig.json se mudou
            if (siteConfig && siteConfig.menuHoverEnabled !== menuHoverEnabled) {
                const newCfg = { ...siteConfig, menuHoverEnabled };
                await githubApi('write', 'src/data/siteConfig.json', {
                    content: JSON.stringify(newCfg, null, 4),
                    sha: siteConfigSha,
                });
                const freshCfg = await githubApi('read', 'src/data/siteConfig.json');
                setSiteConfig(JSON.parse(freshCfg.content));
                setSiteConfigSha(freshCfg.sha);
            }

            triggerToast('success', 'Menu atualizado!');
        } catch (err: any) {
            triggerToast('error', err.message);
        } finally {
            setSaving(false);
        }
    }

    function addItem() {
        setItems(prev => [...prev, { label: 'Novo Link', href: '/' }]);
    }

    function removeItem(i: number) {
        setItems(prev => prev.filter((_, idx) => idx !== i));
    }

    function moveUp(i: number) {
        if (i === 0) return;
        setItems(prev => {
            const next = [...prev];
            [next[i - 1], next[i]] = [next[i], next[i - 1]];
            return next;
        });
    }

    function moveDown(i: number) {
        setItems(prev => {
            if (i === prev.length - 1) return prev;
            const next = [...prev];
            [next[i], next[i + 1]] = [next[i + 1], next[i]];
            return next;
        });
    }

    function updateItem(i: number, field: keyof MenuItem, value: any) {
        setItems(prev => {
            const next = [...prev];
            next[i] = { ...next[i], [field]: value };
            return next;
        });
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64 gap-3 text-ink-muted">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm">Carregando menu...</span>
        </div>
    );

    if (error) return (
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-md border border-red-200 max-w-lg">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-red-700 text-sm">{error}</span>
        </div>
    );

    return (
        <div className="max-w-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-primary-soft flex items-center justify-center">
                        <Navigation className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-bold text-ink text-lg">Menu de Navegação</h2>
                        <p className="text-sm text-ink-muted">Itens do cabeçalho do site</p>
                    </div>
                </div>
                <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-md hover:bg-primary disabled:opacity-60 transition-all shadow-sm"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>

            {/* Comportamento do submenu */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-primary-soft flex items-center justify-center shrink-0">
                    <MousePointerClick className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="font-semibold text-ink text-sm">Abrir submenu ao passar o mouse</p>
                            <p className="text-xs text-ink-muted mt-0.5">
                                {menuHoverEnabled
                                    ? 'O dropdown de categorias abre automaticamente quando o visitante passa o mouse.'
                                    : 'O dropdown só abre quando o visitante clica no item do menu.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={menuHoverEnabled}
                            aria-label="Abrir submenu ao passar o mouse"
                            onClick={() => setMenuHoverEnabled(v => !v)}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 shrink-0 ${
                                menuHoverEnabled ? 'bg-primary' : 'bg-elev border border-border'
                            }`}
                        >
                            <span aria-hidden="true" className={`absolute top-0.5 left-0.5 w-5 h-5 bg-surface rounded-full shadow transition-transform duration-200 ${
                                menuHoverEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="bg-primary-soft border border-border rounded-md p-4 text-sm text-primary">
                <p className="font-semibold mb-1">Dicas</p>
                <ul className="space-y-0.5 text-primary text-xs">
                    <li>• Itens com <strong>Mostrar categorias</strong> exibem uma lista suspensa com todas as categorias do blog</li>
                    <li>• Para páginas do seu próprio site, escreva só o caminho (ex: <strong>/sobre</strong>). Para sites externos, cole o link completo</li>
                    <li>• A ordem que aparece aqui é a ordem exibida no menu do site</li>
                </ul>
            </div>

            {/* Lista de itens */}
            <div className="space-y-3">
                {items.length === 0 && (
                    <div className="text-center py-12 bg-surface rounded-lg border border-dashed border-border">
                        <LayoutList className="w-8 h-8 text-ink-faint mx-auto mb-2" />
                        <p className="text-ink-muted text-sm">Nenhum item no menu</p>
                        <p className="text-ink-faint text-xs mt-1">Clique em "Adicionar item" para começar</p>
                    </div>
                )}

                {items.map((item, i) => (
                    <div key={i} className="bg-surface rounded-lg border border-border shadow-sm p-4">
                        <div className="flex items-start gap-3">
                            {/* Reorder buttons */}
                            <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                                <button
                                    onClick={() => moveUp(i)}
                                    aria-label={`Mover item "${item.label}" para cima`}
                                    disabled={i === 0}
                                    className="w-10 h-10 min-h-[44px] min-w-[44px] rounded flex items-center justify-center text-ink-faint hover:text-ink hover:bg-elev disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <button
                                    onClick={() => moveDown(i)}
                                    aria-label={`Mover item "${item.label}" para baixo`}
                                    disabled={i === items.length - 1}
                                    className="w-10 h-10 min-h-[44px] min-w-[44px] rounded flex items-center justify-center text-ink-faint hover:text-ink hover:bg-elev disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                                </button>
                            </div>

                            {/* Fields */}
                            <div className="flex-1 grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-ink-muted uppercase tracking-widest mb-1">
                                        Texto do link
                                    </label>
                                    <input
                                        type="text"
                                        value={item.label}
                                        onChange={e => updateItem(i, 'label', e.target.value)}
                                        placeholder="Ex: Blog"
                                        className="w-full px-3 py-2 border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20/20 focus:border-primary/60 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-ink-muted uppercase tracking-widest mb-1">
                                        URL / caminho
                                    </label>
                                    <input
                                        type="text"
                                        value={item.href}
                                        onChange={e => updateItem(i, 'href', e.target.value)}
                                        placeholder="Ex: /blog"
                                        className="w-full px-3 py-2 border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20/20 focus:border-primary/60 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Delete */}
                            <button
                                onClick={() => removeItem(i)}
                                aria-label={`Remover item de menu: ${item.label}`}
                                className="mt-1 w-10 h-10 min-h-[44px] min-w-[44px] rounded flex items-center justify-center text-ink-faint hover:text-red-600 hover:bg-red-50 transition-all shrink-0"
                            >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>

                        {/* Toggle showCategories */}
                        <div className="mt-3 ml-10 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => updateItem(i, 'showCategories', !item.showCategories)}
                                className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                                    item.showCategories ? 'bg-primary' : 'bg-elev'
                                }`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-surface rounded-full shadow transition-transform duration-200 ${
                                    item.showCategories ? 'translate-x-4' : 'translate-x-0'
                                }`} />
                            </button>
                            <span className="text-xs text-ink-muted">
                                Mostrar dropdown de categorias
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add button */}
            <button
                onClick={addItem}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg text-sm font-medium text-ink-muted hover:text-primary hover:border-primary/40 hover:bg-primary-soft transition-all"
            >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Adicionar item
            </button>

            {/* Preview link */}
            <div className="flex items-center gap-2 text-xs text-ink-faint">
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                <span>As mudanças aparecem no site após salvar e recarregar a página.</span>
            </div>
        </div>
    );
}
