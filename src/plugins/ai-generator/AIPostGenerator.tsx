import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Settings, CheckCircle2 } from 'lucide-react';
import { triggerToast } from '../../components/admin/CmsToaster';

interface Author   { slug: string; name: string; }
interface Category { slug: string; name: string; }

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4';

interface Section {
    text:  string;
    size:  'short' | 'medium' | 'long';
    level: HeadingLevel;
}

interface CommercialOutline { type: 'outline'; text: string; }
interface CommercialProduct { type: 'product'; name: string; imageUrl: string; }
type CommercialItem = CommercialOutline | CommercialProduct;

type PostType        = 'informational' | 'commercial';
type CommercialSub   = 'guia-melhores' | 'review';

// Mapeamento de tamanho → minWords para o back-end
const SIZE_WORDS: Record<Section['size'], number> = { short: 150, medium: 350, long: 650 };

const HEADING_LEVELS: { id: HeadingLevel; label: string; hint: string }[] = [
    { id: 'h1', label: 'H1', hint: 'Título principal' },
    { id: 'h2', label: 'H2', hint: 'Seção principal' },
    { id: 'h3', label: 'H3', hint: 'Subseção' },
    { id: 'h4', label: 'H4', hint: 'Sub-subseção' },
];

const LEVEL_STYLE: Record<HeadingLevel, string> = {
    h1: 'bg-primary text-surface',
    h2: 'bg-blue-100 text-blue-800',
    h3: 'bg-green-100 text-green-800',
    h4: 'bg-amber-100 text-amber-800',
};

const SIZE_OPTIONS: { id: Section['size']; label: string; hint: string }[] = [
    { id: 'short',  label: 'Curto',  hint: '~150 palavras' },
    { id: 'medium', label: 'Médio',  hint: '~350 palavras' },
    { id: 'long',   label: 'Longo',  hint: '~650 palavras' },
];

// Templates de estrutura para post informacional
const STRUCTURE_TEMPLATES = [
    {
        label: 'Tutorial',
        sections: ['O que é e para que serve', 'O que você precisa antes de começar', 'Passo a passo', 'Erros comuns e como evitar', 'Próximos passos'],
    },
    {
        label: 'Guia completo',
        sections: ['O que é', 'Por que isso importa', 'Como fazer na prática', 'Exemplos reais', 'Dúvidas frequentes'],
    },
    {
        label: 'Artigo de opinião',
        sections: ['Contexto e situação atual', 'Por que discordo / concordo', 'Os principais argumentos', 'O que os especialistas dizem', 'Minha conclusão'],
    },
];

interface Props {
    authors: Author[];
    categories: Category[];
    hasApiKey?: boolean;
}

export default function AIPostGenerator({ authors, categories, hasApiKey = true }: Props) {
    const [isMounted,       setIsMounted]       = useState(false);
    const [postType,        setPostType]        = useState<PostType>('informational');
    const [commercialSub,   setCommercialSub]   = useState<CommercialSub>('guia-melhores');
    const [title,           setTitle]           = useState('');
    const [slug,            setSlug]            = useState('');
    const [author,          setAuthor]          = useState('');
    const [category,        setCategory]        = useState('');
    const [sections,        setSections]        = useState<Section[]>([]);
    const [commercialItems, setCommercialItems] = useState<CommercialItem[]>([]);
    const [isGenerating,    setIsGenerating]    = useState(false);
    const [progressMsg,     setProgressMsg]     = useState('');
    const [progressSec,     setProgressSec]     = useState<{ current: number; total: number; name: string } | null>(null);
    const [fieldErrors,     setFieldErrors]     = useState<Record<string, string>>({});
    const [publishMode,     setPublishMode]     = useState<'publish' | 'draft'>('draft');
    const [showTemplates,   setShowTemplates]   = useState(false);
    const [showAdvanced,    setShowAdvanced]    = useState(false);

    useEffect(() => { setIsMounted(true); }, []);

    // Auto-slug a partir do título (só enquanto o usuário não editou o slug manualmente)
    const [slugEdited, setSlugEdited] = useState(false);
    useEffect(() => {
        if (!slugEdited && title) {
            setSlug(
                title.toLowerCase()
                    .normalize('NFD').replace(/[̀-ͯ]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '')
            );
        }
    }, [title, slugEdited]);

    if (!isMounted) return (
        <div className="flex items-center justify-center p-20 text-ink-faint">
            <Loader2 className="w-6 h-6 animate-spin mr-3" aria-hidden="true" />
            Carregando...
        </div>
    );

    const inputClass = 'w-full bg-surface border border-border rounded-md px-4 py-3 text-sm text-ink focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20 transition-all';
    const labelClass = 'block text-xs font-semibold text-ink-faint uppercase tracking-widest mb-2';

    // ── Seções ─────────────────────────────────────────────────────────────────
    const addSection = (text = '', level: HeadingLevel = 'h2') =>
        setSections(s => [...s, { text, size: 'medium', level }]);

    const applyTemplate = (tmpl: typeof STRUCTURE_TEMPLATES[number]) => {
        setSections(tmpl.sections.map(t => ({ text: t, size: 'medium' as const, level: 'h2' as HeadingLevel })));
        setShowTemplates(false);
    };

    const updateSection = (i: number, patch: Partial<Section>) =>
        setSections(s => s.map((x, idx) => idx === i ? { ...x, ...patch } : x));

    const removeSection = (i: number) =>
        setSections(s => s.filter((_, idx) => idx !== i));

    const moveSection = (i: number, dir: 'up' | 'down') => {
        const next = [...sections];
        const t = dir === 'up' ? i - 1 : i + 1;
        if (t < 0 || t >= next.length) return;
        [next[i], next[t]] = [next[t], next[i]];
        setSections(next);
    };

    // ── Items comerciais ───────────────────────────────────────────────────────
    const addCommercialSection = () =>
        setCommercialItems(c => [...c, { type: 'outline', text: '' }]);

    const addCommercialProduct = () =>
        setCommercialItems(c => [...c, { type: 'product', name: '', imageUrl: '' }]);

    const updateCommercialItem = (i: number, patch: Partial<CommercialItem>) =>
        setCommercialItems(c => c.map((x, idx) => idx === i ? { ...x, ...patch } as CommercialItem : x));

    const removeCommercialItem = (i: number) =>
        setCommercialItems(c => c.filter((_, idx) => idx !== i));

    const moveCommercialItem = (i: number, dir: 'up' | 'down') => {
        const next = [...commercialItems];
        const t = dir === 'up' ? i - 1 : i + 1;
        if (t < 0 || t >= next.length) return;
        [next[i], next[t]] = [next[t], next[i]];
        setCommercialItems(next);
    };

    // ── Validação ──────────────────────────────────────────────────────────────
    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!title.trim())    errs.title    = 'Digite o título do artigo.';
        if (!slug.trim())     errs.slug     = 'A URL é obrigatória.';
        if (!author)          errs.author   = 'Selecione um autor.';
        if (!category)        errs.category = 'Selecione uma categoria.';
        if (postType === 'informational') {
            if (sections.length === 0)
                errs.sections = 'Adicione pelo menos uma seção antes de gerar.';
            else if (sections.some(s => !s.text.trim()))
                errs.sections = 'Preencha o título de todas as seções.';
        } else {
            const hasItem = commercialItems.some(i =>
                i.type === 'outline' ? (i as CommercialOutline).text?.trim() : (i as CommercialProduct).name?.trim()
            );
            if (!hasItem) errs.structure = 'Adicione pelo menos uma seção ou produto.';
        }
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Geração ────────────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!validate()) return;

        setIsGenerating(true);
        setProgressMsg('Iniciando geração...');
        setProgressSec(null);

        const outlines = sections.map(s => ({
            level: s.level,
            text:  s.text,
            minWords: SIZE_WORDS[s.size],
        }));

        try {
            const res = await fetch('/api/admin/plugins/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postType,
                    commercialSubType: postType === 'commercial' ? commercialSub : undefined,
                    title:  title.trim(),
                    slug:   slug.trim(),
                    author,
                    category,
                    draft: publishMode === 'draft',
                    outlines:        postType === 'informational' ? outlines : undefined,
                    commercialItems: postType === 'commercial' ? commercialItems : undefined,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Erro ${res.status}`);
            }

            const reader  = res.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.step === 'progress') {
                                setProgressMsg(data.message || '');
                                if (data.sectionCurrent && data.sectionTotal && data.sectionName) {
                                    setProgressSec({ current: data.sectionCurrent, total: data.sectionTotal, name: data.sectionName });
                                }
                            }
                            if (data.step === 'done') {
                                const doneMsg  = publishMode === 'draft' ? 'Rascunho salvo!' : 'Artigo publicado!';
                                const toastMsg = publishMode === 'draft'
                                    ? `Rascunho "${data.title}" salvo. Revise e publique quando quiser.`
                                    : `"${data.title}" publicado com sucesso.`;
                                setProgressMsg(doneMsg);
                                triggerToast(toastMsg, 'success');
                                setTimeout(() => { window.location.href = '/admin/posts'; }, 2500);
                                return;
                            }
                            if (data.step === 'error') throw new Error(data.error);
                        } catch (e) {
                            if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
                        }
                    }
                }
            }
        } catch (err: any) {
            setFieldErrors({ _global: err.message || 'Erro ao gerar artigo. Tente novamente.' });
            setProgressMsg('');
            setProgressSec(null);
        } finally {
            setIsGenerating(false);
        }
    };

    const canGenerate = !isGenerating;

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-3xl pb-16 space-y-6">

            {/* Banner: API key não configurada */}
            {!hasApiKey && (
                <div role="alert" className="flex items-start gap-3 p-5 bg-amber-50 border border-amber-200 rounded-md">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                        <p className="font-semibold text-amber-800 text-sm">Configuração necessária</p>
                        <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                            Configure a chave da IA antes de gerar artigos.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                // Ativa a aba de configurações
                                const tab = document.getElementById('tab-settings');
                                if (tab) (tab as HTMLButtonElement).click();
                            }}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:underline"
                        >
                            <Settings className="w-3.5 h-3.5" aria-hidden="true" />
                            Configurar agora
                        </button>
                    </div>
                </div>
            )}

            {/* 1 ─ Tipo de artigo */}
            <section aria-labelledby="section-type">
                <div className="bg-surface rounded-lg border border-border p-6" style={{ boxShadow: '0 1px 2px rgba(80,40,20,0.04)' }}>
                    <p id="section-type" className={labelClass}>1. Tipo de artigo</p>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        {[
                            {
                                id: 'informational' as PostType,
                                label: 'Artigo informativo',
                                desc: 'Tutorial, guia, explicação, opinião. Foco em educar e informar.',
                            },
                            {
                                id: 'commercial' as PostType,
                                label: 'Artigo comercial',
                                desc: 'Review, comparativo, guia de compra. Foco em recomendar produtos.',
                            },
                        ].map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setPostType(t.id)}
                                className={`p-4 rounded-md border-2 text-left transition-all ${postType === t.id ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/40'}`}
                                aria-pressed={postType === t.id}
                            >
                                <p className="font-semibold text-ink text-sm">{t.label}</p>
                                <p className="text-xs text-ink-muted mt-1 leading-relaxed">{t.desc}</p>
                            </button>
                        ))}
                    </div>

                    {postType === 'commercial' && (
                        <div className="mt-4 pt-4 border-t border-border">
                            <p className={labelClass}>Formato</p>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                {[
                                    { id: 'guia-melhores' as CommercialSub, label: 'Guia dos melhores', desc: 'Lista ranqueada — ex: "Os 7 melhores notebooks de 2025"' },
                                    { id: 'review' as CommercialSub, label: 'Review de produto', desc: 'Análise completa de um único produto ou serviço' },
                                ].map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setCommercialSub(s.id)}
                                        className={`p-3 rounded-md border-2 text-left transition-all ${commercialSub === s.id ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/40'}`}
                                        aria-pressed={commercialSub === s.id}
                                    >
                                        <p className="font-semibold text-ink text-xs">{s.label}</p>
                                        <p className="text-xs text-ink-faint mt-0.5 leading-relaxed">{s.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* 2 ─ Informações básicas */}
            <section aria-labelledby="section-info">
                <div className="bg-surface rounded-lg border border-border p-6 space-y-4" style={{ boxShadow: '0 1px 2px rgba(80,40,20,0.04)' }}>
                    <p id="section-info" className={labelClass}>2. Informações do artigo</p>

                    {/* Título */}
                    <div>
                        <label htmlFor="ai-title" className="block text-sm font-medium text-ink mb-1.5">
                            Título <span className="text-red-500" aria-hidden="true">*</span>
                        </label>
                        <input
                            id="ai-title"
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className={`${inputClass} ${fieldErrors.title ? 'border-red-400' : ''}`}
                            placeholder="Ex: Como criar um blog do zero em 2025"
                            aria-describedby={fieldErrors.title ? 'err-title' : undefined}
                            aria-invalid={!!fieldErrors.title}
                        />
                        {fieldErrors.title && <p id="err-title" role="alert" className="text-xs text-red-600 mt-1.5">{fieldErrors.title}</p>}
                    </div>

                    {/* URL */}
                    <div>
                        <label htmlFor="ai-slug" className="block text-sm font-medium text-ink mb-1.5">
                            URL do artigo <span className="text-red-500" aria-hidden="true">*</span>
                        </label>
                        <div className="flex items-stretch gap-0 border border-border rounded-md overflow-hidden focus-within:border-primary/80 transition-colors" style={{ borderColor: fieldErrors.slug ? '#f87171' : undefined }}>
                            <span className="px-3 flex items-center text-xs text-ink-faint bg-elev border-r border-border font-mono shrink-0">
                                /
                            </span>
                            <input
                                id="ai-slug"
                                type="text"
                                value={slug}
                                onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')); setSlugEdited(true); }}
                                className="flex-1 bg-transparent px-3 py-3 text-sm text-ink font-mono focus:outline-none"
                                placeholder="como-criar-um-blog"
                                aria-describedby="slug-hint"
                                aria-invalid={!!fieldErrors.slug}
                            />
                        </div>
                        <p id="slug-hint" className="text-xs text-ink-faint mt-1">
                            Gerado automaticamente — pode editar.
                        </p>
                        {fieldErrors.slug && <p role="alert" className="text-xs text-red-600 mt-1">{fieldErrors.slug}</p>}
                    </div>

                    {/* Autor + Categoria */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="ai-author" className="block text-sm font-medium text-ink mb-1.5">
                                Autor <span className="text-red-500" aria-hidden="true">*</span>
                            </label>
                            <select
                                id="ai-author"
                                value={author}
                                onChange={e => setAuthor(e.target.value)}
                                className={`${inputClass} ${fieldErrors.author ? 'border-red-400' : ''}`}
                                aria-invalid={!!fieldErrors.author}
                            >
                                <option value="">Selecione</option>
                                {authors.length === 0 && <option disabled>Nenhum autor cadastrado</option>}
                                {authors.map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
                            </select>
                            {fieldErrors.author && <p role="alert" className="text-xs text-red-600 mt-1">{fieldErrors.author}</p>}
                        </div>
                        <div>
                            <label htmlFor="ai-category" className="block text-sm font-medium text-ink mb-1.5">
                                Categoria <span className="text-red-500" aria-hidden="true">*</span>
                            </label>
                            <select
                                id="ai-category"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className={`${inputClass} ${fieldErrors.category ? 'border-red-400' : ''}`}
                                aria-invalid={!!fieldErrors.category}
                            >
                                <option value="">Selecione</option>
                                {categories.length === 0 && <option disabled>Nenhuma categoria cadastrada</option>}
                                {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                            </select>
                            {fieldErrors.category && <p role="alert" className="text-xs text-red-600 mt-1">{fieldErrors.category}</p>}
                        </div>
                    </div>
                </div>
            </section>

            {/* 3 ─ Estrutura — informacional */}
            {postType === 'informational' && (
                <section aria-labelledby="section-structure">
                    <div className="bg-surface rounded-lg border border-border p-6" style={{ boxShadow: '0 1px 2px rgba(80,40,20,0.04)' }}>
                        <div className="flex items-start justify-between mb-4 gap-3">
                            <div>
                                <p id="section-structure" className={labelClass}>3. Seções do artigo</p>
                                <p className="text-xs text-ink-faint">Introdução e conclusão são geradas automaticamente — não precisa adicionar.</p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => addSection()}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] bg-primary text-surface text-xs font-semibold rounded hover:brightness-90 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                    Adicionar seção
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowTemplates(v => !v)}
                                    className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-primary transition-colors"
                                    aria-expanded={showTemplates}
                                >
                                    <ChevronRight className={`w-3 h-3 transition-transform ${showTemplates ? 'rotate-90' : ''}`} aria-hidden="true" />
                                    Usar estrutura pronta
                                </button>
                            </div>
                        </div>

                        {/* Templates de estrutura */}
                        {showTemplates && (
                            <div className="mb-4 p-4 bg-elev rounded-md border border-border space-y-2">
                                <p className="text-xs font-semibold text-ink-muted mb-2">Escolha uma estrutura como ponto de partida:</p>
                                {STRUCTURE_TEMPLATES.map(tmpl => (
                                    <button
                                        key={tmpl.label}
                                        type="button"
                                        onClick={() => applyTemplate(tmpl)}
                                        className="w-full text-left p-3 bg-surface border border-border rounded hover:border-primary/50 hover:bg-primary-soft/50 transition-colors"
                                    >
                                        <p className="text-sm font-semibold text-ink">{tmpl.label}</p>
                                        <p className="text-xs text-ink-faint mt-0.5">
                                            {tmpl.sections.slice(0, 3).join(' · ')}{tmpl.sections.length > 3 ? ` · +${tmpl.sections.length - 3}` : ''}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Lista de seções */}
                        {sections.length === 0 ? (
                            <div className="text-center py-10 border-2 border-dashed border-border rounded-md">
                                <p className="text-sm text-ink-muted">Nenhuma seção ainda</p>
                                <p className="text-xs text-ink-faint mt-1">
                                    Clique em "Adicionar seção" ou escolha uma estrutura pronta.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2" role="list" aria-label="Seções do artigo">
                                {sections.map((sec, i) => (
                                    <div
                                        key={i}
                                        role="listitem"
                                        className="flex items-center gap-2 p-3 bg-elev rounded-md border border-border"
                                    >
                                        {/* Reorder */}
                                        <div className="flex flex-col gap-0.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => moveSection(i, 'up')}
                                                disabled={i === 0}
                                                aria-label={`Mover seção "${sec.text || i + 1}" para cima`}
                                                className="text-ink-faint hover:text-ink disabled:opacity-20 p-0.5"
                                            >
                                                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveSection(i, 'down')}
                                                disabled={i === sections.length - 1}
                                                aria-label={`Mover seção "${sec.text || i + 1}" para baixo`}
                                                className="text-ink-faint hover:text-ink disabled:opacity-20 p-0.5"
                                            >
                                                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                                            </button>
                                        </div>

                                        {/* Nível H1–H4 */}
                                        <div className="flex gap-0.5 shrink-0" role="group" aria-label={`Nível de título da seção ${i + 1}`}>
                                            {HEADING_LEVELS.map(h => (
                                                <button
                                                    key={h.id}
                                                    type="button"
                                                    onClick={() => updateSection(i, { level: h.id })}
                                                    title={h.hint}
                                                    aria-pressed={sec.level === h.id}
                                                    className={`w-8 h-8 rounded text-xs font-bold transition-colors ${
                                                        sec.level === h.id
                                                            ? LEVEL_STYLE[h.id]
                                                            : 'bg-surface border border-border text-ink-faint hover:border-primary/40'
                                                    }`}
                                                >
                                                    {h.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Título da seção */}
                                        <input
                                            type="text"
                                            value={sec.text}
                                            onChange={e => updateSection(i, { text: e.target.value })}
                                            aria-label={`Título da seção ${i + 1}`}
                                            className="flex-1 bg-surface border border-border rounded px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-primary/80 min-w-0"
                                            placeholder={`Título da seção ${i + 1}...`}
                                        />

                                        {/* Tamanho */}
                                        <div className="flex gap-1 shrink-0" role="group" aria-label={`Tamanho da seção ${i + 1}`}>
                                            {SIZE_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => updateSection(i, { size: opt.id })}
                                                    title={opt.hint}
                                                    aria-pressed={sec.size === opt.id}
                                                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                                                        sec.size === opt.id
                                                            ? 'bg-ink text-surface'
                                                            : 'bg-surface border border-border text-ink-muted hover:border-primary/40'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Remover */}
                                        <button
                                            type="button"
                                            onClick={() => removeSection(i)}
                                            aria-label={`Remover seção ${i + 1}`}
                                            className="text-ink-faint hover:text-red-600 transition-colors shrink-0 p-1"
                                        >
                                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {fieldErrors.sections && (
                            <p role="alert" className="text-xs text-red-600 mt-3">{fieldErrors.sections}</p>
                        )}
                    </div>
                </section>
            )}

            {/* 3 ─ Estrutura — comercial */}
            {postType === 'commercial' && (
                <section aria-labelledby="section-commercial">
                    <div className="bg-surface rounded-lg border border-border p-6" style={{ boxShadow: '0 1px 2px rgba(80,40,20,0.04)' }}>
                        <div className="flex items-start justify-between mb-4 gap-3">
                            <div>
                                <p id="section-commercial" className={labelClass}>3. Estrutura do artigo</p>
                                <p className="text-xs text-ink-faint">
                                    {commercialSub === 'guia-melhores'
                                        ? 'Adicione os produtos que serão avaliados e as seções de texto da lista.'
                                        : 'Adicione as seções do review e os detalhes do produto.'}
                                </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={addCommercialSection}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] bg-elev border border-border text-ink-muted text-xs font-semibold rounded hover:border-primary/40 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                    Seção
                                </button>
                                <button
                                    type="button"
                                    onClick={addCommercialProduct}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] bg-primary text-surface text-xs font-semibold rounded hover:brightness-90 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                    Produto
                                </button>
                            </div>
                        </div>

                        {commercialItems.length === 0 ? (
                            <div className="text-center py-10 border-2 border-dashed border-border rounded-md">
                                <p className="text-sm text-ink-muted">Nenhum item adicionado</p>
                                <p className="text-xs text-ink-faint mt-1">Adicione os produtos e seções do artigo.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {commercialItems.map((item, i) => (
                                    <div key={i} className="p-3 bg-elev rounded-md border border-border">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded text-xs font-bold shrink-0 ${item.type === 'product' ? 'bg-amber-100 text-amber-800' : 'bg-primary-soft text-primary'}`}>
                                                {item.type === 'product' ? 'Produto' : 'Seção'}
                                            </span>
                                            {item.type === 'outline' && (
                                                <input
                                                    type="text"
                                                    value={(item as CommercialOutline).text}
                                                    onChange={e => updateCommercialItem(i, { text: e.target.value })}
                                                    aria-label={`Título da seção ${i + 1}`}
                                                    className="flex-1 bg-surface border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary/80 min-w-0"
                                                    placeholder="Título da seção..."
                                                />
                                            )}
                                            <div className="flex flex-col gap-0.5 shrink-0">
                                                <button type="button" onClick={() => moveCommercialItem(i, 'up')} disabled={i === 0} aria-label="Mover para cima" className="text-ink-faint hover:text-ink disabled:opacity-20 p-0.5"><ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /></button>
                                                <button type="button" onClick={() => moveCommercialItem(i, 'down')} disabled={i === commercialItems.length - 1} aria-label="Mover para baixo" className="text-ink-faint hover:text-ink disabled:opacity-20 p-0.5"><ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /></button>
                                            </div>
                                            <button type="button" onClick={() => removeCommercialItem(i)} aria-label={`Remover item ${i + 1}`} className="text-ink-faint hover:text-red-600 transition-colors shrink-0 p-1"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                                        </div>
                                        {item.type === 'product' && (
                                            <div className="grid grid-cols-2 gap-3 mt-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-ink-muted mb-1">Nome do produto *</label>
                                                    <input
                                                        type="text"
                                                        value={(item as CommercialProduct).name}
                                                        onChange={e => updateCommercialItem(i, { name: e.target.value })}
                                                        className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary/80"
                                                        placeholder="Ex: Notebook Dell Inspiron 15"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-ink-muted mb-1">URL da imagem <span className="font-normal text-ink-faint">(opcional)</span></label>
                                                    <input
                                                        type="url"
                                                        value={(item as CommercialProduct).imageUrl}
                                                        onChange={e => updateCommercialItem(i, { imageUrl: e.target.value })}
                                                        className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary/80"
                                                        placeholder="https://..."
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {fieldErrors.structure && (
                            <p role="alert" className="text-xs text-red-600 mt-3">{fieldErrors.structure}</p>
                        )}
                    </div>
                </section>
            )}

            {/* Erro global */}
            {fieldErrors._global && (
                <div role="alert" className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    {fieldErrors._global}
                </div>
            )}

            {/* Progresso */}
            {isGenerating && (
                <div className="bg-surface rounded-lg border-2 border-primary/30 p-6" style={{ boxShadow: '0 1px 2px rgba(80,40,20,0.04)' }}>
                    <div className="flex items-center gap-3 mb-3">
                        <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" aria-hidden="true" />
                        <p className="font-semibold text-ink text-sm">Gerando seu artigo...</p>
                    </div>
                    {progressSec ? (
                        <>
                            <div className="w-full bg-elev rounded-full h-1.5 mb-2" role="progressbar" aria-valuenow={progressSec.current} aria-valuemin={1} aria-valuemax={progressSec.total}>
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-500"
                                    style={{ width: `${(progressSec.current / progressSec.total) * 100}%` }}
                                />
                            </div>
                            <p className="text-xs text-ink-muted">
                                Seção {progressSec.current} de {progressSec.total}: <span className="font-medium text-ink">{progressSec.name}</span>
                            </p>
                        </>
                    ) : (
                        <p className="text-xs text-ink-muted">{progressMsg || 'Isso pode levar 1–2 minutos.'}</p>
                    )}
                </div>
            )}

            {/* Sucesso */}
            {progressMsg === 'Artigo publicado!' && !isGenerating && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                    <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                    Artigo publicado. Redirecionando para Artigos...
                </div>
            )}

            {/* Modo de publicação */}
            <div className="bg-surface rounded-lg border border-border p-5" style={{ boxShadow: '0 1px 2px rgba(80,40,20,0.04)' }}>
                <p className={labelClass}>4. O que fazer após gerar?</p>
                <div className="grid grid-cols-2 gap-3 mt-3">
                    {[
                        {
                            id: 'draft' as const,
                            label: 'Salvar como rascunho',
                            desc: 'Você revisa o conteúdo antes de publicar. Recomendado.',
                        },
                        {
                            id: 'publish' as const,
                            label: 'Publicar diretamente',
                            desc: 'O artigo vai ao ar imediatamente, sem revisão.',
                        },
                    ].map(opt => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPublishMode(opt.id)}
                            aria-pressed={publishMode === opt.id}
                            className={`p-4 rounded-md border-2 text-left transition-all ${publishMode === opt.id ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/40'}`}
                        >
                            <p className="font-semibold text-ink text-sm">{opt.label}</p>
                            <p className="text-xs text-ink-muted mt-1 leading-relaxed">{opt.desc}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between pt-2">
                <a
                    href="/admin/posts"
                    className="text-sm text-ink-muted hover:text-ink transition-colors"
                >
                    Cancelar
                </a>
                <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating || !canGenerate}
                    className="bg-primary hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed text-surface px-7 py-3 min-h-[48px] rounded-md text-sm font-semibold flex items-center gap-2 transition-all"
                    style={{ boxShadow: '0 2px 8px rgba(80,40,20,0.14)' }}
                >
                    {isGenerating ? (
                        <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Gerando...</>
                    ) : publishMode === 'draft' ? (
                        'Gerar e salvar rascunho'
                    ) : (
                        'Gerar e publicar artigo'
                    )}
                </button>
            </div>
        </div>
    );
}
