/**
 * SettingsSocialShare.tsx — Plugin Social Share
 *
 * Configura plataformas de compartilhamento e estilo.
 * Salva em src/data/pluginsConfig.json via githubApi().
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle, Share2 } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

const PLATFORMS = [
  { id: 'facebook',  label: 'Facebook',  icon: '📘' },
  { id: 'twitter',   label: 'Twitter/X', icon: '🐦' },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: '💬' },
  { id: 'linkedin',  label: 'LinkedIn',  icon: '💼' },
  { id: 'telegram',  label: 'Telegram',  icon: '✈️' },
  { id: 'pinterest', label: 'Pinterest', icon: '📌' },
  { id: 'copy',      label: 'Copiar Link', icon: '🔗' },
];

const STYLES = [
  { id: 'icon',  label: 'Apenas ícones' },
  { id: 'label', label: 'Apenas texto' },
  { id: 'both',  label: 'Ícone + texto' },
];

export default function SettingsSocialShare() {
  const [enabled, setEnabled] = useState(true);
  const [sectionTitle, setSectionTitle] = useState('Compartilhe nas redes sociais');
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'twitter', 'whatsapp', 'linkedin', 'telegram', 'copy']);
  const [style, setStyle] = useState('icon');
  const [fileSha, setFileSha] = useState('');
  const [fullConfig, setFullConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    githubApi('read', CONFIG_PATH)
      .then(data => {
        const config = JSON.parse(data.content);
        setFullConfig(config);
        setFileSha(data.sha);
        const sc = config?.socialShare;
        if (sc) {
          setEnabled(sc.enabled !== false);
          setSectionTitle(sc.sectionTitle ?? 'Compartilhe nas redes sociais');
          setPlatforms(sc.platforms || ['facebook', 'twitter', 'whatsapp', 'linkedin', 'telegram', 'copy']);
          setStyle(sc.style || 'icon');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const togglePlatform = (id: string) => {
    setPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    triggerToast('Salvando configuração de compartilhamento...', 'progress', 30);
    try {
      const updated = {
        ...fullConfig,
        socialShare: { enabled, sectionTitle, platforms, style },
      };
      const res = await githubApi('write', CONFIG_PATH, {
        content: JSON.stringify(updated, null, 4),
        sha: fileSha,
        message: 'CMS: Update Social Share settings',
      });
      setFileSha(res.sha || fileSha);
      setFullConfig(updated);
      triggerToast('Compartilhamento configurado!', 'success', 100);
    } catch (err: any) {
      setError(err.message);
      triggerToast(`Erro: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-surface border border-border rounded-md px-4 py-3 text-sm font-medium text-ink focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20/20 transition-all shadow-sm';
  const labelClass = 'block text-sm font-bold text-ink-muted uppercase tracking-wider mb-2 ml-1';

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-3xl border border-border">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
      <p className="font-medium animate-pulse">Carregando configuração...</p>
    </div>
  );

  if (error && !fullConfig) return (
    <div className="bg-red-50 text-red-700 p-8 rounded-3xl border border-red-200 flex gap-4 items-start">
      <AlertCircle className="w-8 h-8 shrink-0" />
      <div><h3 className="text-xl font-bold mb-2">Erro de Leitura</h3><p>{error}</p></div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      {/* Enable toggle */}
      <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <h3 className="font-bold text-ink">Ativar Compartilhamento</h3>
            <p className="text-sm text-ink-muted mt-0.5">Os botões aparecem ao final de cada artigo do blog.</p>
          </div>
          <div
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-elev'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-surface rounded-full shadow transition-all ${enabled ? 'left-7' : 'left-1'}`} />
          </div>
        </label>
      </div>

      {/* Section title */}
      <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
        <h3 className="font-bold text-ink mb-1">Título da Seção</h3>
        <p className="text-sm text-ink-muted mb-4">Texto exibido acima dos botões de compartilhamento nos artigos</p>
        <input
          type="text"
          value={sectionTitle}
          onChange={e => setSectionTitle(e.target.value)}
          placeholder="Compartilhe nas redes sociais"
          className={inputClass}
        />
        {sectionTitle && (
          <p className="text-xs text-ink-faint mt-2 ml-1">
            Preview: <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{sectionTitle}</span>
          </p>
        )}
      </div>

      {/* Platforms */}
      <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
        <h3 className="font-bold text-ink mb-1">Plataformas</h3>
        <p className="text-sm text-ink-muted mb-4">Selecione quais redes exibir nos artigos</p>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map(p => (
            <label key={p.id} className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all ${platforms.includes(p.id) ? 'border-primary/40 bg-primary-soft' : 'border-border hover:bg-elev'}`}>
              <input
                type="checkbox"
                checked={platforms.includes(p.id)}
                onChange={() => togglePlatform(p.id)}
                className="rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="text-lg">{p.icon}</span>
              <span className="text-sm font-medium text-ink">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Style */}
      <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
        <h3 className="font-bold text-ink mb-1">Estilo dos Botões</h3>
        <p className="text-sm text-ink-muted mb-4">Como os botões aparecem nos artigos</p>
        <label className={labelClass}>Estilo</label>
        <select value={style} onChange={e => setStyle(e.target.value)} className={inputClass}>
          {STYLES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        {/* Style previews */}
        <div className="mt-5 space-y-3">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-wider">Exemplos de estilo</p>
          {/* Apenas ícones */}
          <div className={`p-3 rounded-md border transition-all ${style === 'icon' ? 'border-primary/40 bg-primary-soft' : 'border-border bg-elev'}`}>
            <p className="text-xs text-ink-faint mb-2">Apenas ícones</p>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.filter(p => platforms.includes(p.id)).slice(0, 5).map(p => (
                <span key={p.id} className="w-9 h-9 flex items-center justify-center rounded-md bg-surface border border-border text-base">{p.icon}</span>
              ))}
            </div>
          </div>
          {/* Apenas texto */}
          <div className={`p-3 rounded-md border transition-all ${style === 'label' ? 'border-primary/40 bg-primary-soft' : 'border-border bg-elev'}`}>
            <p className="text-xs text-ink-faint mb-2">Apenas texto</p>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.filter(p => platforms.includes(p.id)).slice(0, 5).map(p => (
                <span key={p.id} className="px-3 py-1.5 rounded-md bg-surface border border-border text-xs font-semibold text-ink">{p.label}</span>
              ))}
            </div>
          </div>
          {/* Ícone + texto */}
          <div className={`p-3 rounded-md border transition-all ${style === 'both' ? 'border-primary/40 bg-primary-soft' : 'border-border bg-elev'}`}>
            <p className="text-xs text-ink-faint mb-2">Ícone + texto</p>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.filter(p => platforms.includes(p.id)).slice(0, 4).map(p => (
                <span key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface border border-border text-xs font-semibold text-ink">
                  <span>{p.icon}</span>{p.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-primary hover:bg-primary disabled:opacity-50 text-white px-6 py-3 rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-none/20"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" aria-hidden="true" />}
        {saving ? 'Salvando...' : 'Salvar Configuração'}
      </button>
    </div>
  );
}
