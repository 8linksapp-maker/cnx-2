import React, { useRef, useState } from 'react';
import { Loader2, Upload, X, Image as ImageIcon, Search } from 'lucide-react';
import { triggerToast } from '../CmsToaster';
import { atomicCommitApi } from '../../../lib/adminApi';
import { slugify } from '../../../lib/slugify';

const EXT: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif',
};
const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
    value: string;
    onChange: (path: string) => void;
    /** Base do nome do arquivo gerado (ex: slug do serviço, 'hero'). */
    namePrefix: string;
    label?: string;
    hint?: string;
    /** Se presente, mostra o botão "Buscar no Pexels" usando este termo. */
    searchQuery?: string;
}

/**
 * Upload de imagem do tema local. Commita o arquivo de verdade em
 * public/images/local/ via atomicCommit (encoding base64) e guarda o caminho —
 * imagem real cacheável, sem inflar o HTML (importa pra performance/SEO).
 * Mantém também um campo de URL como alternativa (colar endereço).
 */
export default function ImageUploadField({ value, onChange, namePrefix, label, hint, searchQuery }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [localPreview, setLocalPreview] = useState('');

    const pick = () => inputRef.current?.click();

    const searchPexels = async () => {
        const q = (searchQuery || '').trim();
        if (!q) return;
        setSearching(true);
        triggerToast('Buscando uma imagem...', 'progress', 30);
        try {
            const res = await fetch('/api/admin/local/pexels-image', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }),
            });
            const data = await res.json();
            if (data.url) { onChange(data.url); triggerToast('Imagem encontrada!', 'success', 100); }
            else triggerToast('Nenhuma imagem encontrada (confira a chave do Pexels em Plugins → IA).', 'error');
        } catch {
            triggerToast('Não foi possível buscar a imagem.', 'error');
        } finally { setSearching(false); }
    };

    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) { triggerToast('Selecione um arquivo de imagem.', 'error'); return; }
        if (file.size > MAX_BYTES) { triggerToast('Imagem muito grande (máximo 5 MB).', 'error'); return; }

        const ext = EXT[file.type] || (file.name.split('.').pop() || 'jpg').toLowerCase();
        const reader = new FileReader();
        reader.onloadend = async () => {
            const dataUrl = String(reader.result || '');
            setLocalPreview(dataUrl);
            const base64 = dataUrl.split(',')[1] || '';
            if (!base64) { triggerToast('Não foi possível ler a imagem.', 'error'); setLocalPreview(''); return; }

            const filename = `${slugify(namePrefix) || 'imagem'}-${Date.now().toString(36)}.${ext}`;
            const path = `public/images/local/${filename}`;
            setUploading(true);
            triggerToast('Enviando imagem...', 'progress', 30);
            try {
                await atomicCommitApi([{ path, content: base64, encoding: 'base64' }], `CMS: upload de imagem ${filename}`);
                onChange(`/images/local/${filename}`);
                triggerToast('Imagem enviada!', 'success', 100);
            } catch {
                triggerToast('Não foi possível enviar a imagem. Tente novamente.', 'error');
            } finally {
                setUploading(false);
                setLocalPreview('');
            }
        };
        reader.readAsDataURL(file);
    };

    const shown = localPreview || value;

    return (
        <div>
            {label && <span className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">{label}</span>}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} aria-label={label || 'Enviar imagem'} />
            <div className="flex items-start gap-3">
                <button type="button" onClick={pick} disabled={uploading}
                    className="relative w-32 h-24 rounded-md border border-border bg-elev overflow-hidden flex items-center justify-center shrink-0 hover:border-ink transition-colors group"
                    aria-label={value ? 'Trocar imagem' : 'Enviar imagem'}>
                    {shown ? (
                        <img src={shown} alt="" className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" />
                    ) : (
                        <span className="flex flex-col items-center gap-1 text-ink-faint"><ImageIcon className="w-5 h-5" aria-hidden="true" /><span className="text-[10px] font-semibold">Enviar</span></span>
                    )}
                    {uploading && <span className="absolute inset-0 bg-ink/40 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-surface" aria-hidden="true" /></span>}
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={pick} disabled={uploading || searching}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary-soft text-primary px-3 py-2 min-h-[36px] rounded hover:brightness-95 disabled:opacity-50 transition-all">
                            <Upload className="w-3.5 h-3.5" aria-hidden="true" /> {value ? 'Trocar imagem' : 'Enviar imagem'}
                        </button>
                        {searchQuery && (
                            <button type="button" onClick={searchPexels} disabled={uploading || searching}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-elev text-ink px-3 py-2 min-h-[36px] rounded hover:bg-border/40 disabled:opacity-50 transition-all">
                                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Search className="w-3.5 h-3.5" aria-hidden="true" />} Buscar no Pexels
                            </button>
                        )}
                        {value && (
                            <button type="button" onClick={() => onChange('')} disabled={uploading}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-faint hover:text-red-600 px-2 py-2 min-h-[36px] rounded transition-colors">
                                <X className="w-3.5 h-3.5" aria-hidden="true" /> Remover
                            </button>
                        )}
                    </div>
                    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="ou cole o endereço de uma imagem"
                        className="mt-2 w-full bg-elev border border-border rounded-md px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary/30 outline-none" aria-label="Endereço da imagem" />
                    {hint && <p className="text-[10px] text-ink-faint mt-1.5">{hint}</p>}
                </div>
            </div>
        </div>
    );
}
