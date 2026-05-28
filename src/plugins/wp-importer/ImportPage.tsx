/**
 * ImportPage.tsx — Plugin WP Importer
 *
 * Parseia XML do WordPress NO BROWSER (sem limite de upload do Vercel 4.5MB)
 * e envia os dados processados como JSON ao servidor.
 */

import { useState, useRef } from 'react';
import { Upload, Loader2, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { triggerToast } from '../../components/admin/CmsToaster';

interface ImportResult {
    success: boolean;
    posts: { imported: number; skipped: number; errors: string[]; imagesImported: number };
    authors: { imported: number; skipped: number };
    categories: { imported: number; skipped: number };
    errors: string[];
}

interface ParsedPost {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    status: string;
    creator: string;
    postDate: string;
    category: string;
    thumbnailUrl: string;
    imageUrls: string[];
}

interface ParsedData {
    posts: ParsedPost[];
    authors: { login: string; displayName: string; firstName: string; lastName: string }[];
    categories: string[];
}

// ── XML parsing helpers (browser-side) ──────────────────────────────────────

function getWpText(item: Element, tag: string): string {
    // Try namespaced tags (wp:post_type, dc:creator, content:encoded, etc.)
    const nsMap: Record<string, string> = {
        'wp:': 'http://wordpress.org/export/',
        'dc:': 'http://purl.org/dc/elements/1.1/',
        'content:': 'http://purl.org/rss/1.0/modules/content/',
        'excerpt:': 'http://wordpress.org/export/',
    };

    // Try direct tag name first
    let el = item.getElementsByTagName(tag)[0];
    if (el) return el.textContent?.trim() || '';

    // Try with namespace
    for (const [prefix, ns] of Object.entries(nsMap)) {
        if (tag.startsWith(prefix)) {
            el = item.getElementsByTagNameNS(ns, tag.replace(prefix, ''))[0];
            if (el) return el.textContent?.trim() || '';
        }
    }
    return '';
}

function extractImageUrls(html: string): string[] {
    const urls: string[] = [];
    const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
        if (m[1] && !m[1].startsWith('data:')) urls.push(m[1]);
    }
    return [...new Set(urls)];
}

function generateSlug(str: string): string {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseWordPressXML(xmlText: string): ParsedData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const errors = doc.getElementsByTagName('parsererror');
    if (errors.length > 0) throw new Error('XML inválido. Verifique se o arquivo foi exportado corretamente do WordPress.');

    const channel = doc.getElementsByTagName('channel')[0];
    if (!channel) throw new Error('Formato XML inválido: elemento channel não encontrado');

    // Categories
    const categories: string[] = [];
    const wpCats = channel.getElementsByTagName('wp:category');
    for (let i = 0; i < wpCats.length; i++) {
        const name = getWpText(wpCats[i], 'wp:cat_name');
        if (name) categories.push(name);
    }

    // Authors
    const authors: ParsedData['authors'] = [];
    const wpAuthors = channel.getElementsByTagName('wp:author');
    for (let i = 0; i < wpAuthors.length; i++) {
        const login = getWpText(wpAuthors[i], 'wp:author_login');
        const displayName = getWpText(wpAuthors[i], 'wp:author_display_name') || login;
        const firstName = getWpText(wpAuthors[i], 'wp:author_first_name');
        const lastName = getWpText(wpAuthors[i], 'wp:author_last_name');
        if (login) authors.push({ login, displayName, firstName, lastName });
    }

    // Posts
    const posts: ParsedPost[] = [];
    const items = channel.getElementsByTagName('item');
    const allItems = Array.from(items); // keep for thumbnail lookup

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const postType = getWpText(item, 'wp:post_type');
        if (postType !== 'post') continue;

        const status = getWpText(item, 'wp:status');
        if (status !== 'publish' && status !== 'draft') continue;

        const title = getWpText(item, 'title') || 'Sem título';
        const slug = getWpText(item, 'wp:post_name') || generateSlug(title);
        const content = getWpText(item, 'content:encoded');
        const excerpt = getWpText(item, 'excerpt:encoded');
        const creator = getWpText(item, 'dc:creator');
        const postDate = getWpText(item, 'wp:post_date');

        // Category (first one)
        let category = '';
        const catEls = item.getElementsByTagName('category');
        for (let c = 0; c < catEls.length; c++) {
            if (catEls[c].getAttribute('domain') === 'category') {
                category = catEls[c].textContent?.trim() || '';
                if (category) break;
            }
        }

        // Thumbnail URL via postmeta
        let thumbnailUrl = '';
        const postmetas = item.getElementsByTagName('wp:postmeta');
        for (let m = 0; m < postmetas.length; m++) {
            if (getWpText(postmetas[m], 'wp:meta_key') === '_thumbnail_id') {
                const thumbId = getWpText(postmetas[m], 'wp:meta_value');
                if (thumbId) {
                    for (const att of allItems) {
                        if (getWpText(att, 'wp:post_id') === thumbId && getWpText(att, 'wp:post_type') === 'attachment') {
                            thumbnailUrl = getWpText(att, 'wp:attachment_url') ||
                                att.getElementsByTagName('guid')[0]?.textContent?.trim() || '';
                            break;
                        }
                    }
                }
                break;
            }
        }

        posts.push({
            title, slug, content, excerpt, status, creator, postDate,
            category, thumbnailUrl, imageUrls: extractImageUrls(content),
        });
    }

    return { posts, authors, categories };
}

// ── Component ───────────────────────────────────────────────────────────────

interface PreviewData {
    totalPosts: number;
    totalAuthors: number;
    totalCategories: number;
    existingPostsEstimate: number;
}

export default function ImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState('');
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.name.endsWith('.xml') && f.type !== 'text/xml' && f.type !== 'application/xml') {
            setError('Por favor, selecione um arquivo XML exportado do WordPress.');
            return;
        }
        setFile(f);
        setError('');
        setResult(null);
        setPreview(null);
        setPreviewLoading(true);
        try {
            const xmlText = await f.text();
            const parsed = parseWordPressXML(xmlText);
            setPreview({
                totalPosts: parsed.posts.length,
                totalAuthors: parsed.authors.length,
                totalCategories: parsed.categories.length,
                existingPostsEstimate: 0,
            });
        } catch (err: any) {
            setError(err.message || 'Erro ao ler o arquivo XML.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const BATCH_SIZE = 10;

    const sendBatch = async (data: ParsedData): Promise<ImportResult> => {
        const res = await fetch('/api/admin/plugins/import/wordpress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data),
        });
        const text = await res.text();
        try {
            const parsed = JSON.parse(text);
            if (!res.ok) throw new Error(parsed.error || `Erro ${res.status}`);
            return parsed;
        } catch {
            throw new Error(
                res.status === 401
                    ? 'Sessão expirada. Faça login novamente.'
                    : `Resposta inesperada do servidor (${res.status}). Tente recarregar a página.`
            );
        }
    };

    const handleImport = async () => {
        if (!file) { setError('Selecione um arquivo XML.'); return; }
        setImporting(true);
        setError('');
        setResult(null);

        try {
            // Step 1: Read & parse XML in browser
            setProgress('Lendo arquivo XML...');
            triggerToast('Lendo arquivo XML...', 'progress', 10);
            const xmlText = await file.text();

            setProgress('Processando posts, categorias e autores...');
            triggerToast('Processando XML...', 'progress', 30);
            const parsed = parseWordPressXML(xmlText);

            const totalPosts = parsed.posts.length;
            setProgress(`Encontrados ${totalPosts} posts, ${parsed.categories.length} categorias, ${parsed.authors.length} autores.`);

            // Step 2: Send in batches (categories + authors in first batch, posts split in chunks)
            const totalResult: ImportResult = {
                success: true,
                posts: { imported: 0, skipped: 0, errors: [], imagesImported: 0 },
                authors: { imported: 0, skipped: 0 },
                categories: { imported: 0, skipped: 0 },
                errors: [],
            };

            const batches: ParsedData[] = [];
            for (let i = 0; i < totalPosts; i += BATCH_SIZE) {
                batches.push({
                    posts: parsed.posts.slice(i, i + BATCH_SIZE),
                    // Only send authors + categories in the first batch
                    authors: i === 0 ? parsed.authors : [],
                    categories: i === 0 ? parsed.categories : [],
                });
            }
            // Edge case: no posts but has categories/authors
            if (batches.length === 0) {
                batches.push({ posts: [], authors: parsed.authors, categories: parsed.categories });
            }

            for (let b = 0; b < batches.length; b++) {
                const pct = Math.round(40 + (b / batches.length) * 55);
                const from = b * BATCH_SIZE + 1;
                const to = Math.min((b + 1) * BATCH_SIZE, totalPosts);
                setProgress(`Importando posts ${from}-${to} de ${totalPosts}...`);
                triggerToast(`Lote ${b + 1}/${batches.length} (posts ${from}-${to})`, 'progress', pct);

                const batchResult = await sendBatch(batches[b]);

                totalResult.posts.imported += batchResult.posts.imported;
                totalResult.posts.skipped += batchResult.posts.skipped;
                totalResult.posts.imagesImported += batchResult.posts.imagesImported;
                totalResult.posts.errors.push(...batchResult.posts.errors);
                totalResult.authors.imported += batchResult.authors.imported;
                totalResult.authors.skipped += batchResult.authors.skipped;
                totalResult.categories.imported += batchResult.categories.imported;
                totalResult.categories.skipped += batchResult.categories.skipped;
                totalResult.errors.push(...batchResult.errors);
                if (!batchResult.success) totalResult.success = false;
            }

            setResult(totalResult);
            if (totalResult.success) {
                triggerToast(`Importação concluída! ${totalResult.posts.imported} posts importados.`, 'success');
            } else {
                triggerToast('Importação concluída com erros. Verifique os detalhes.', 'info');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao importar');
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setImporting(false);
            setProgress('');
        }
    };

    return (
        <div className="max-w-2xl space-y-6">
            {/* Instruções */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-5">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3">Como exportar do WordPress</p>
                <ol className="space-y-1.5">
                    {[
                        'No painel WordPress, vá em Ferramentas → Exportar',
                        'Selecione "Todos os posts" ou "Todo o conteúdo"',
                        'Clique em "Baixar arquivo de exportação"',
                        'Faça upload do arquivo .xml aqui',
                    ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-blue-800">
                            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>

            {/* O que será importado */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-5">
                <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-3">O que será importado</p>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { icon: '📝', label: 'Posts publicados e rascunhos' },
                        { icon: '👥', label: 'Autores' },
                        { icon: '🏷️', label: 'Categorias' },
                        { icon: '🖼️', label: 'Imagens (quando disponíveis)' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-2 text-sm text-ink-muted">
                            <span>{item.icon}</span>
                            {item.label}
                        </div>
                    ))}
                </div>
                <p className="text-xs text-ink-faint mt-3">
                    Posts com o mesmo slug já existentes serão ignorados. Autores e categorias duplicados também.
                </p>
            </div>

            {/* Upload */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
                <p className="text-sm font-bold text-ink-muted uppercase tracking-wider mb-4">Arquivo de Exportação (.xml)</p>

                <div
                    className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors ${file ? 'border-primary/40 bg-primary-soft' : 'border-border hover:border-primary/40 hover:bg-primary-soft/50'}`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {file ? (
                        <>
                            <FileText className="w-8 h-8 text-primary mx-auto mb-2" />
                            <p className="font-medium text-ink text-sm">{file.name}</p>
                            <p className="text-xs text-ink-faint mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · Clique para trocar</p>
                        </>
                    ) : (
                        <>
                            <Upload className="w-8 h-8 text-ink-faint mx-auto mb-2" />
                            <p className="font-medium text-ink-muted text-sm">Clique para selecionar o arquivo XML</p>
                            <p className="text-xs text-ink-faint mt-1">Arquivo exportado do WordPress (.xml) — sem limite de tamanho</p>
                        </>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,text/xml,application/xml"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>

            {/* Preview após seleção do arquivo */}
            {previewLoading && (
                <div className="bg-primary-soft border border-primary/30 rounded-md p-4 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    <p className="text-sm text-primary font-medium">Lendo arquivo...</p>
                </div>
            )}
            {preview && !previewLoading && !result && (
                <div className="bg-surface rounded-lg border border-primary/30 shadow-sm p-5">
                    <p className="text-sm font-bold text-ink mb-3">Encontrado no arquivo</p>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                            { label: 'Posts', value: preview.totalPosts },
                            { label: 'Autores', value: preview.totalAuthors },
                            { label: 'Categorias', value: preview.totalCategories },
                        ].map(s => (
                            <div key={s.label} className="bg-elev rounded-md p-3 text-center">
                                <p className="text-2xl font-bold text-primary">{s.value}</p>
                                <p className="text-xs text-ink-muted">{s.label}</p>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-ink-faint">Posts com o mesmo slug já existentes serão ignorados. Pronto para importar.</p>
                </div>
            )}

            {/* Erro */}
            {error && (
                <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}

            {/* Botão importar */}
            <button
                type="button"
                onClick={handleImport}
                disabled={importing || !file}
                className="bg-primary hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-none/20"
            >
                {importing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                ) : (
                    <><Upload className="w-4 h-4" aria-hidden="true" /> Importar do WordPress</>
                )}
            </button>

            {importing && (
                <div className="bg-primary-soft border border-primary/30 rounded-md p-4">
                    <p className="text-sm text-primary font-medium">
                        {progress || 'Importando posts e baixando imagens... Isso pode levar alguns minutos.'}
                    </p>
                </div>
            )}

            {/* Resultado */}
            {result && (
                <div className={`bg-surface rounded-lg border shadow-sm p-6 ${result.success ? 'border-green-200' : 'border-amber-200'}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className={`w-5 h-5 ${result.success ? 'text-green-500' : 'text-amber-500'}`} />
                        <p className="font-bold text-ink">
                            {result.success ? 'Importação concluída!' : 'Importação concluída com erros'}
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                            { label: 'Posts', imported: result.posts.imported, skipped: result.posts.skipped },
                            { label: 'Autores', imported: result.authors.imported, skipped: result.authors.skipped },
                            { label: 'Categorias', imported: result.categories.imported, skipped: result.categories.skipped },
                        ].map(s => (
                            <div key={s.label} className="bg-elev rounded-md p-3 text-center">
                                <p className="text-2xl font-bold text-primary">{s.imported}</p>
                                <p className="text-xs text-ink-muted">{s.label} importados</p>
                                {s.skipped > 0 && <p className="text-xs text-ink-faint">{s.skipped} ignorados</p>}
                            </div>
                        ))}
                    </div>

                    {result.posts.imagesImported > 0 && (
                        <p className="text-sm text-ink-muted mb-3">
                            {result.posts.imagesImported} imagem(ns) importada(s) com sucesso.
                        </p>
                    )}

                    {/* Próximos passos */}
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Próximos passos</p>
                        <ul className="space-y-1.5">
                            {[
                                'Revise as imagens dos posts importados (podem estar apontando para o WordPress antigo)',
                                'Ajuste as categorias se necessário',
                                'Revise o conteúdo que estava em HTML no WordPress',
                            ].map((step, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                                    <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-700 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">{i + 1}</span>
                                    {step}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {result.posts.errors.length > 0 && (
                        <div className="mt-4">
                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Erros nos posts</p>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {result.posts.errors.map((e, i) => (
                                    <p key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{e}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    {result.errors.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Erros gerais</p>
                            {result.errors.map((e, i) => (
                                <p key={i} className="text-xs text-red-600">{e}</p>
                            ))}
                        </div>
                    )}

                    <a href="/admin/posts" className="mt-4 inline-block text-sm text-primary hover:underline font-medium">
                        Ver posts importados
                    </a>
                </div>
            )}
        </div>
    );
}
