import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Loader2, ArrowLeft, Image as ImageIcon, Eye, Edit3, Video } from 'lucide-react';
import { parseVideoUrl } from '../../lib/videoEmbed';
import { normalizeCategories } from '../../lib/categorySlug';
import { marked } from 'marked';
import { triggerToast } from './CmsToaster';
import { githubApi, atomicCommitApi, type CommitFile } from '../../lib/adminApi';
import { yamlEscape } from '../../lib/yamlEscape';
import SEOScoreWidget from '../../plugins/seo/SEOScoreWidget';

interface PostEditorProps {
    filePath: string | null; // null = novo post
}

export default function PostEditor({ filePath }: PostEditorProps) {
    const isEditing = !!filePath;
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [authors, setAuthors] = useState<any[]>([]);
    const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
    const [isPreview, setIsPreview] = useState(false);
    const [pendingUploads, setPendingUploads] = useState<Record<string, File>>({});
    const [QuillEditor, setQuillEditor] = useState<any>(null);
    const [quillFailed, setQuillFailed] = useState(false);
    const quillRef = React.useRef<any>(null);
    const [showVideoBar, setShowVideoBar] = useState(false);
    const [videoShortcodeUrl, setVideoShortcodeUrl] = useState('');
    const [videoBarError, setVideoBarError] = useState('');
    const [editingSlug, setEditingSlug] = useState(false);

    const insertTextInEditor = (text: string) => {
        const editor = quillRef.current?.getEditor?.();
        if (!editor) return;
        const range = editor.getSelection(true);
        const idx = range?.index ?? editor.getLength();
        editor.insertText(idx, `\n${text}\n`, 'user');
        editor.setSelection(idx + text.length + 2, 0);
    };

    const insertVideoShortcode = () => {
        const url = videoShortcodeUrl.trim();
        if (!url) return;
        if (parseVideoUrl(url).provider === 'unknown') {
            setVideoBarError('URL não reconhecida. Use YouTube, Vimeo, Loom, Wistia ou mp4 direto.');
            return;
        }
        insertTextInEditor(`[[video:${url}]]`);
        setVideoShortcodeUrl('');
        setVideoBarError('');
        setShowVideoBar(false);
    };

    const insertImageInEditor = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const editor = quillRef.current?.getEditor?.();
            if (!editor) return;
            const range = editor.getSelection(true);
            editor.insertEmbed(range?.index ?? editor.getLength(), 'image', dataUrl, 'user');
            editor.setSelection((range?.index ?? 0) + 1, 0);
        };
        reader.readAsDataURL(file);
    };

    const handleImageButton = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const f = input.files?.[0];
            if (f) insertImageInEditor(f);
        };
        input.click();
    };

    // Botão de vídeo da própria toolbar do Quill (estilo WordPress): abre a barra de inserção.
    const handleVideoButton = () => {
        setShowVideoBar(true);
        setVideoShortcodeUrl('');
        setVideoBarError('');
    };

    const quillModules = React.useMemo(() => ({
        toolbar: {
            container: [
                [{ header: [1, 2, 3, 4, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ color: [] }, { background: [] }],
                [{ list: 'ordered' }, { list: 'bullet' }],
                [{ indent: '-1' }, { indent: '+1' }],
                ['blockquote', 'code-block'],
                ['link', 'image', 'video'],
                [{ align: [] }],
                ['clean'],
            ],
            handlers: {
                image: handleImageButton,
                video: handleVideoButton,
            },
        },
        clipboard: { matchVisual: false },
    }), []);

    const quillFormats = ['header', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'list', 'bullet', 'indent', 'blockquote', 'code-block', 'link', 'image', 'align'];

    const formatDateForInput = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
            return d.toISOString().split('T')[0];
        } catch { return new Date().toISOString().split('T')[0]; }
    };

    // Guardamos o ISO completo original para preservar horario quando aluno edita post sem mudar a data
    const [originalPubDateISO, setOriginalPubDateISO] = useState<string>('');

    const [post, setPost] = useState({
        title: '', slug: '', description: '', pubDate: new Date().toISOString().split('T')[0],
        heroImage: '', category: '', author: '', draft: false, content: ''
    });

    // Load Quill dynamically
    useEffect(() => {
        import('react-quill-new')
            .then(mod => setQuillEditor(() => mod.default))
            .catch(() => setQuillFailed(true));
        import('react-quill-new/dist/quill.snow.css' as any).catch(() => {});
    }, []);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [authRes, catRes] = await Promise.allSettled([
                    githubApi('read', 'src/data/authors.json'),
                    githubApi('read', 'src/data/categories.json'),
                ]);
                if (authRes.status === 'fulfilled') { const p = JSON.parse(authRes.value?.content || "{}"); if (Array.isArray(p)) setAuthors(p); }
                if (catRes.status === 'fulfilled') { const p = JSON.parse(catRes.value?.content || "[]"); setDynamicCategories(normalizeCategories(p).map((c) => c.name)); }

                if (isEditing && filePath) {
                    const fileData = await githubApi('read', filePath);
                    const text = fileData.content;
                    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
                    if (match) {
                        const fm = match[1];
                        const body = match[2].trim();
                        const extract = (key: string) => { const m = fm.match(new RegExp(`${key}:\\s*(?:"([^"]*)"|'([^']*)'|(.*))`)); return m ? (m[1] || m[2] || m[3] || '').trim() : ''; };
                        const parsedHtml = await marked.parse(body);
                        const rawPubDate = extract('pubDate');
                        if (rawPubDate) setOriginalPubDateISO(rawPubDate);
                        setPost({
                            title: extract('title'), slug: filePath.split('/').pop()?.replace('.md', '') || '',
                            description: extract('description'), pubDate: rawPubDate ? formatDateForInput(rawPubDate) : new Date().toISOString().split('T')[0],
                            heroImage: extract('heroImage'), category: extract('category') || 'Geral', author: extract('author'),
                            draft: extract('draft') === 'true', content: parsedHtml
                        });
                    } else {
                        setPost(p => ({ ...p, content: String(marked.parse(text)), slug: filePath.split('/').pop()?.replace('.md', '') || '' }));
                    }
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [filePath, isEditing]);

    const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

    const handleTitleChange = (val: string) => {
        setPost(p => ({ ...p, title: val, slug: isEditing ? p.slug : slugify(val) }));
    };

    const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, uiKey: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingUploads(prev => ({ ...prev, [uiKey]: file }));
        if (uiKey === 'heroImage') setPost(p => ({ ...p, heroImage: URL.createObjectURL(file) }));
        e.target.value = '';
    };

    // Extrai imagens inline (data URLs) sem subir: reescreve o HTML para os
    // caminhos finais e devolve os arquivos para irem no commit atômico junto do .md.
    const extractInlineImages = (html: string): { html: string; files: CommitFile[] } => {
        const imgRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"[^>]*>/g;
        let modifiedHtml = html;
        const files: CommitFile[] = [];
        for (const m of [...html.matchAll(imgRegex)]) {
            const ext = m[1]; const base64Content = m[2];
            const ghPath = `public/uploads/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
            files.push({ path: ghPath, content: base64Content, encoding: 'base64' });
            modifiedHtml = modifiedHtml.replace(`data:image/${ext};base64,${base64Content}`, ghPath.replace('public', ''));
        }
        return { html: modifiedHtml, files };
    };

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!post.title || !post.slug) { setError('Título e Slug (URL) são obrigatórios.'); return; }
        setSaving(true); setError('');
        triggerToast('Processando e salvando artigo...', 'progress', 20);
        try {
            // Coleta todos os arquivos (capa + imagens inline + .md) para um commit só.
            const commitFiles: CommitFile[] = [];

            let finalHeroImage = post.heroImage;
            if (pendingUploads['heroImage']) {
                const fileObj = pendingUploads['heroImage'];
                const base64Content = await fileToBase64(fileObj);
                const fileExt = fileObj.name.split('.').pop() || 'jpg';
                const ghPath = `public/uploads/${Date.now()}-blog-cover.${fileExt}`;
                commitFiles.push({ path: ghPath, content: base64Content, encoding: 'base64' });
                finalHeroImage = ghPath.replace('public', '');
            }
            const cleanedContent = post.content.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
            const { html: finalHtmlContent, files: inlineFiles } = extractInlineImages(cleanedContent);
            commitFiles.push(...inlineFiles);
            // Preserva ISO original se aluno nao mudou a data; caso contrario usa data + horario atual (garante ordenacao por minuto)
            let finalPubDate = post.pubDate;
            if (originalPubDateISO && originalPubDateISO.split('T')[0] === post.pubDate) {
                finalPubDate = originalPubDateISO;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(post.pubDate)) {
                finalPubDate = `${post.pubDate}T${new Date().toISOString().slice(11, 19)}.000Z`;
            }
            const markdown = `---\ntitle: "${yamlEscape(post.title)}"\ndescription: "${yamlEscape(post.description)}"\npubDate: "${finalPubDate}"\nheroImage: "${yamlEscape(finalHeroImage)}"\ncategory: "${yamlEscape(post.category)}"\nauthor: "${yamlEscape(post.author)}"\ndraft: ${post.draft}\n---\n${finalHtmlContent}`;
            const targetPath = `src/content/blog/${post.slug}.md`;
            commitFiles.push({ path: targetPath, content: markdown });

            // Um único commit atômico: capa + imagens inline + .md.
            // Falha tudo ou grava tudo — sem imagem órfã e sem rebuilds repetidos.
            await atomicCommitApi(
                commitFiles,
                `CMS: ${isEditing ? 'Edição' : 'Criação'} do artigo ${post.slug}`
            );
            setPendingUploads({});
            triggerToast('Artigo salvo com sucesso!', 'success', 100);
            if (!isEditing) setTimeout(() => { window.location.href = '/admin/posts'; }, 1500);
        } catch (err: any) {
            setError(err.message); triggerToast(`Erro: ${err.message}`, 'error');
        } finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-3xl border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Carregando editor...</p>
        </div>
    );

    const inputClass = "w-full bg-surface border border-border rounded-md px-4 py-3 text-sm font-medium text-ink focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20 transition-all shadow-sm";
    const labelClass = "block text-xs font-semibold text-ink-muted uppercase tracking-widest mb-2";

    return (
        <div className="max-w-5xl pb-32">
            {/* Fixed header bar */}
            <div className="flex items-center justify-between bg-surface p-4 px-6 rounded-lg border border-border shadow-sm mb-6">
                <div className="flex items-center gap-3">
                    <a href="/admin/posts" aria-label="Voltar para lista de artigos" className="text-ink-faint hover:text-primary transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-primary-soft"><ArrowLeft className="w-5 h-5" aria-hidden="true" /></a>
                    <div>
                        <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest">{isEditing ? 'Editar artigo' : 'Novo artigo'}</p>
                        <p className="text-sm font-semibold text-ink line-clamp-1 mt-0.5">
                            {post.title || (isEditing ? 'Sem título' : 'Comece escrevendo um título')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        aria-label={isPreview ? 'Voltar para editor' : 'Ver preview do artigo'}
                        onClick={() => setIsPreview(!isPreview)}
                        className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-surface border border-border hover:bg-elev text-ink-muted hover:text-ink rounded text-sm font-medium transition-colors"
                    >
                        {isPreview ? <Edit3 className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                        {isPreview ? 'Editar' : 'Preview'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-primary hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed text-surface px-5 py-2.5 min-h-[44px] rounded text-sm font-semibold flex items-center gap-2 transition-all"
                        style={{ boxShadow: '0 2px 8px rgba(80,40,20,0.14)' }}
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                        {saving ? 'Salvando...' : <><Save className="w-4 h-4" aria-hidden="true" /> {isEditing ? 'Salvar' : (post.draft ? 'Salvar rascunho' : 'Publicar')}</>}
                    </button>
                </div>
            </div>

            {error && <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 text-sm font-medium mb-6 rounded-lg flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />{error}</div>}

            <div className="flex gap-6 items-start">
                {/* Main Editor Area */}
                <div className="flex-1 min-w-0 space-y-6">
                    {/* Title + Permalink (estilo WordPress) */}
                    <div className="bg-surface p-6 rounded-lg border border-border shadow-sm">
                        {/* Título grande sem label */}
                        <input
                            type="text"
                            value={post.title}
                            onChange={e => handleTitleChange(e.target.value)}
                            placeholder="Adicione um título"
                            aria-label="Título do artigo"
                            className="w-full bg-transparent border-0 border-b border-transparent hover:border-border focus:border-primary/80 focus:outline-none font-display font-normal text-3xl md:text-4xl text-ink leading-tight tracking-tight pb-3 transition-colors"
                        />

                        {/* Permalink — estilo WordPress: "Endereço: /slug-do-post  Editar" */}
                        {post.title && (
                            <div className="mt-3 flex items-center flex-wrap gap-2 text-sm text-ink-muted">
                                <span className="font-semibold text-ink-faint uppercase tracking-widest text-xs">Endereço:</span>
                                {editingSlug ? (
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="font-mono text-ink-faint shrink-0">/</span>
                                        <input
                                            type="text"
                                            value={post.slug}
                                            onChange={e => setPost(p => ({ ...p, slug: slugify(e.target.value) }))}
                                            aria-label="URL do artigo"
                                            className="flex-1 bg-elev border border-border rounded px-2 py-1 text-sm font-mono text-ink focus:outline-none focus:border-primary/80 min-w-0"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setEditingSlug(false)}
                                            className="px-3 py-1 text-xs font-semibold text-primary hover:text-ink transition-colors"
                                        >
                                            OK
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="font-mono text-ink truncate">/{post.slug || 'sem-endereco'}</span>
                                        <button
                                            type="button"
                                            onClick={() => setEditingSlug(true)}
                                            className="px-2 py-1 text-xs font-semibold text-primary hover:text-ink transition-colors"
                                        >
                                            Editar
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Descrição / Resumo */}
                        <div className="mt-5 pt-5 border-t border-border">
                            <label htmlFor="post-description" className={labelClass}>Resumo do artigo</label>
                            <textarea
                                id="post-description"
                                rows={2}
                                value={post.description}
                                onChange={e => setPost(p => ({ ...p, description: e.target.value }))}
                                className={`${inputClass} resize-none`}
                                placeholder="Frase curta que aparece nas listas e no compartilhamento."
                            />
                            <p className="text-xs text-ink-faint mt-1.5">
                                Aparece nos resultados do Google e no compartilhamento social.
                            </p>
                        </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="bg-surface p-6 rounded-lg border border-border shadow-sm">
                        <div className="mb-2">
                            <label className={labelClass} style={{ marginBottom: 0 }}>Conteúdo do Artigo</label>
                        </div>

                        {/* Barra de inserção de vídeo — disparada pelo botão de vídeo da toolbar, aparece acima do editor */}
                        {showVideoBar && !isPreview && (
                            <div className="mb-3 flex items-center gap-2 p-3 bg-elev rounded-md border border-border">
                                <Video className="w-4 h-4 text-ink-faint shrink-0" aria-hidden="true" />
                                <div className="flex-1 min-w-0">
                                    <input
                                        type="text"
                                        value={videoShortcodeUrl}
                                        onChange={e => { setVideoShortcodeUrl(e.target.value); setVideoBarError(''); }}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') { e.preventDefault(); insertVideoShortcode(); }
                                            if (e.key === 'Escape') { setShowVideoBar(false); setVideoShortcodeUrl(''); setVideoBarError(''); }
                                        }}
                                        placeholder="Cole a URL do vídeo (YouTube, Vimeo, Loom…) e pressione Enter"
                                        className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary/80 transition-colors"
                                        autoFocus
                                        aria-label="URL do vídeo para inserir no artigo"
                                    />
                                    {videoBarError && (
                                        <p className="text-xs text-red-600 mt-1">{videoBarError}</p>
                                    )}
                                    {videoShortcodeUrl.trim() && !videoBarError && (() => {
                                        const info = parseVideoUrl(videoShortcodeUrl);
                                        if (info.provider === 'unknown') return null;
                                        return <p className="text-xs text-green-700 mt-1">✓ {info.provider}{info.id ? ` · ${info.id}` : ''}</p>;
                                    })()}
                                </div>
                                <button
                                    type="button"
                                    onClick={insertVideoShortcode}
                                    disabled={!videoShortcodeUrl.trim()}
                                    className="px-3 py-1.5 min-h-[36px] bg-primary text-surface text-xs font-semibold rounded hover:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                                >
                                    Inserir
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowVideoBar(false); setVideoShortcodeUrl(''); setVideoBarError(''); }}
                                    aria-label="Cancelar inserção de vídeo"
                                    className="text-ink-faint hover:text-ink transition-colors shrink-0 p-1"
                                >
                                    ×
                                </button>
                            </div>
                        )}
                        {isPreview ? (
                            <div className="ql-editor border border-border rounded-md" style={{ minHeight: '480px', background: 'rgb(255 254 251)' }} dangerouslySetInnerHTML={{ __html: post.content }} />
                        ) : QuillEditor ? (
                            <QuillEditor
                                ref={quillRef}
                                theme="snow"
                                value={post.content}
                                onChange={(val: string) => setPost(p => ({ ...p, content: val }))}
                                modules={quillModules}
                                formats={quillFormats}
                                placeholder="Comece a escrever seu artigo aqui..."
                            />
                        ) : quillFailed ? (
                            <div className="space-y-2">
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                                    O editor visual não carregou. Use o campo de texto abaixo (HTML ou Markdown são aceitos).
                                </p>
                                <textarea
                                    value={post.content}
                                    onChange={e => setPost(p => ({ ...p, content: e.target.value }))}
                                    className="w-full bg-surface border border-border rounded-md px-4 py-3 text-sm text-ink font-mono focus:outline-none focus:border-primary/80 resize-y"
                                    style={{ minHeight: '300px' }}
                                    aria-label="Conteúdo do artigo"
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center p-12 text-ink-faint">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" aria-hidden="true" />
                                Carregando editor...
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-72 shrink-0 space-y-4 sticky top-4">
                    {/* Publish Settings */}
                    <div className="bg-surface p-5 rounded-lg border border-border shadow-sm">
                        <h3 className="font-bold text-ink text-sm border-b border-border pb-3 mb-4">Publicação</h3>
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Status</label>
                                <label className="flex items-center gap-3 cursor-pointer p-3 bg-elev rounded-md hover:bg-primary-soft transition-colors">
                                    <input type="checkbox" checked={post.draft} onChange={e => setPost(p => ({ ...p, draft: e.target.checked }))} className="rounded border-border text-primary focus:ring-primary/20" />
                                    <span className="text-sm font-medium text-ink">Salvar como rascunho</span>
                                </label>
                            </div>
                            <div>
                                <label className={labelClass}>Data de Publicação</label>
                                <input type="date" value={post.pubDate} onChange={e => setPost(p => ({ ...p, pubDate: e.target.value }))} className={inputClass} />
                            </div>
                        </div>
                    </div>

                    {/* Category & Author */}
                    <div className="bg-surface p-5 rounded-lg border border-border shadow-sm">
                        <h3 className="font-bold text-ink text-sm border-b border-border pb-3 mb-4">Metadados</h3>
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Categoria</label>
                                {dynamicCategories.length > 0 ? (
                                    <select value={post.category} onChange={e => setPost(p => ({ ...p, category: e.target.value }))} className={inputClass}>
                                        <option value="">Selecionar categoria...</option>
                                        {dynamicCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                ) : (
                                    <input type="text" value={post.category} onChange={e => setPost(p => ({ ...p, category: e.target.value }))} className={inputClass} placeholder="Ex: Tecnologia" />
                                )}
                            </div>
                            <div>
                                <label className={labelClass}>Autor</label>
                                {authors.length > 0 ? (
                                    <select value={post.author} onChange={e => setPost(p => ({ ...p, author: e.target.value }))} className={inputClass}>
                                        <option value="">Selecionar autor...</option>
                                        {authors.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                                    </select>
                                ) : (
                                    <input type="text" value={post.author} onChange={e => setPost(p => ({ ...p, author: e.target.value }))} className={inputClass} placeholder="Nome do autor" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Hero Image */}
                    <div className="bg-surface p-5 rounded-lg border border-border shadow-sm">
                        <h3 className="font-bold text-ink text-sm border-b border-border pb-3 mb-4">Imagem de Capa</h3>
                        <label className="group relative border-2 border-dashed border-border hover:border-primary/60 bg-elev hover:bg-primary-soft rounded-md flex flex-col items-center justify-center cursor-pointer transition-all text-center overflow-hidden" style={{ minHeight: '120px' }}>
                            <input type="file" accept="image/*" className="hidden" onChange={e => handleFileSelect(e, 'heroImage')} />
                            {post.heroImage ? (
                                <>
                                    <img src={post.heroImage} alt="Capa" className="absolute inset-0 w-full h-full object-cover group-hover:opacity-60 transition-opacity" />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-surface/20">
                                        <ImageIcon className="w-8 h-8 text-ink" />
                                        <span className="text-xs font-bold text-ink mt-1">Trocar imagem</span>
                                    </div>
                                </>
                            ) : (
                                <div className="py-6 flex flex-col items-center text-ink-faint group-hover:text-primary transition-colors">
                                    <ImageIcon className="w-8 h-8 mb-2" />
                                    <span className="text-xs font-bold">Enviar imagem de capa</span>
                                </div>
                            )}
                        </label>
                        {pendingUploads['heroImage'] && <span className="text-[10px] text-amber-600 font-bold block mt-2">Upload pendente — será enviado ao salvar</span>}
                    </div>

                    {/* SEO Score Widget */}
                    <SEOScoreWidget
                        title={post.title}
                        description={post.description}
                        heroImage={post.heroImage}
                        content={post.content}
                    />
                </div>
            </div>
        </div>
    );
}
