/**
 * RedirectsManager.tsx — Plugin Redirects Manager
 *
 * CRUD de redirects 301/302.
 * Salva em src/data/redirects.json via githubApi().
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, ArrowRight, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { triggerToast } from '../../components/admin/CmsToaster';

interface Redirect {
  id: string;
  from: string;
  to: string;
  type: 301 | 302;
  enabled: boolean;
  note: string;
}

const emptyRedirect = (): Omit<Redirect, 'id'> => ({
  from: '',
  to: '',
  type: 301,
  enabled: true,
  note: '',
});

export default function RedirectsManager() {
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [fileSha, setFileSha] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyRedirect());
  const [showForm, setShowForm] = useState(false);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; status: number; location?: string }>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleTest = async (r: Redirect) => {
    setTestingId(r.id);
    setTestResult(prev => ({ ...prev, [r.id]: undefined as any }));
    try {
      const siteUrl = window.location.origin;
      const testUrl = r.from.startsWith('http') ? r.from : `${siteUrl}${r.from.startsWith('/') ? '' : '/'}${r.from}`;
      const res = await fetch(testUrl, { method: 'HEAD', redirect: 'manual' });
      const location = res.headers.get('location') || '';
      const isRedirect = res.status >= 300 && res.status < 400;
      setTestResult(prev => ({ ...prev, [r.id]: { ok: isRedirect, status: res.status, location } }));
    } catch {
      // fetch with redirect:'manual' may fail due to CORS, try alternative
      try {
        const res = await fetch(`/api/admin/plugins/redirects/test?path=${encodeURIComponent(r.from)}`);
        if (res.ok) {
          const data = await res.json();
          setTestResult(prev => ({ ...prev, [r.id]: data }));
        } else {
          setTestResult(prev => ({ ...prev, [r.id]: { ok: false, status: 0 } }));
        }
      } catch {
        setTestResult(prev => ({ ...prev, [r.id]: { ok: false, status: 0 } }));
      }
    } finally {
      setTestingId(null);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/plugins/redirects');
        if (res.ok) {
          const arr = await res.json();
          setRedirects(Array.isArray(arr) ? arr : []);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const saveRedirects = async (newList: Redirect[]) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/plugins/redirects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newList),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao salvar');
      }
      setRedirects(newList);
      const ativos = newList.filter(r => r.enabled).length;
      triggerToast(`${ativos} redirect${ativos !== 1 ? 's' : ''} ativo${ativos !== 1 ? 's' : ''} — sincronizado com Vercel!`, 'success', 100);
    } catch (err: any) {
      setError(err.message);
      triggerToast(`Erro: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm(emptyRedirect());
    setShowForm(true);
  };

  const handleEdit = (r: Redirect) => {
    setEditingId(r.id);
    setForm({ from: r.from, to: r.to, type: r.type, enabled: r.enabled, note: r.note });
    setShowForm(true);
  };

  const handleFormSave = () => {
    if (!form.from.trim() || !form.to.trim()) {
      triggerToast('Preencha os campos "De" e "Para"', 'error');
      return;
    }
    let newList: Redirect[];
    if (editingId) {
      newList = redirects.map(r => r.id === editingId ? { ...form, id: editingId } : r);
    } else {
      newList = [...redirects, { ...form, id: `r_${Date.now()}` }];
    }
    setShowForm(false);
    setEditingId(null);
    saveRedirects(newList);
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    saveRedirects(redirects.filter(r => r.id !== pendingDeleteId));
    setPendingDeleteId(null);
  };

  const handleToggle = (id: string) => {
    saveRedirects(redirects.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const inputClass = 'w-full bg-surface border border-border rounded-md px-4 py-3 text-sm font-medium text-ink focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20/20 transition-all shadow-sm font-mono';
  const labelClass = 'block text-sm font-bold text-ink-muted uppercase tracking-wider mb-2 ml-1';

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-3xl border border-border">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
      <p className="font-medium animate-pulse">Carregando redirects...</p>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-muted">{redirects.length} redirect{redirects.length !== 1 ? 's' : ''} configurado{redirects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-primary hover:bg-primary text-white px-4 py-2.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Novo Redirect
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-surface rounded-lg border border-primary/30 shadow-sm p-6">
          <h3 className="font-bold text-ink mb-4">{editingId ? 'Editar Redirect' : 'Novo Redirect'}</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>De (origem)</label>
                <input
                  type="text"
                  value={form.from}
                  onChange={e => setForm(f => ({ ...f, from: e.target.value }))}
                  className={inputClass}
                  placeholder="/artigo-antigo"
                />
              </div>
              <div>
                <label className={labelClass}>Para (destino)</label>
                <input
                  type="text"
                  value={form.to}
                  onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                  className={inputClass}
                  placeholder="/blog/artigo-novo ou https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Tipo</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: Number(e.target.value) as 301 | 302 }))}
                  className={inputClass.replace('font-mono', '')}
                >
                  <option value={301}>Permanente (301)</option>
                  <option value={302}>Temporário (302)</option>
                </select>
                <p className="text-xs text-ink-faint mt-1 ml-1">
                  {form.type === 301
                    ? 'Permanente — o endereço mudou para sempre.'
                    : 'Temporário — mudança provisória (promoção, manutenção).'}
                </p>
              </div>
              <div>
                <label className={labelClass}>Nota (opcional)</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className={inputClass.replace('font-mono', '')}
                  placeholder="Ex: migração do WordPress"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer p-3 bg-elev rounded-md hover:bg-primary-soft transition-colors w-fit">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                className="rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="text-sm font-medium text-ink">Ativo</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleFormSave}
                disabled={saving}
                className="bg-primary hover:bg-primary disabled:opacity-50 text-white px-5 py-2.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-5 py-2.5 rounded-md text-sm font-bold text-ink-muted bg-elev hover:bg-elev transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* Como funciona */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-5">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Como funciona</p>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Use quando renomear ou mover uma página — quem acessar o endereço antigo chega ao novo automaticamente</li>
          <li>• Escolha <strong>Permanente (301)</strong> quando a mudança for definitiva (ex: renomeou um artigo)</li>
          <li>• Escolha <strong>Temporário (302)</strong> quando for provisório (ex: página em manutenção ou promoção por tempo limitado)</li>
          <li>• No campo <strong>De</strong>, coloque o caminho antigo (ex: <code>/artigo-antigo</code>). No campo <strong>Para</strong>, o novo</li>
          <li>• Os redirects são aplicados automaticamente na Vercel após o deploy</li>
        </ul>
      </div>

      {/* Delete confirmation banner */}
      {pendingDeleteId && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-red-700">Remover este redirect? Esta ação não pode ser desfeita.</p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={confirmDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition-colors"
            >
              Remover
            </button>
            <button
              onClick={() => setPendingDeleteId(null)}
              className="px-4 py-2 bg-elev hover:bg-border text-ink-muted text-sm font-bold rounded-md transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Redirects list */}
      {redirects.length === 0 ? (
        <div className="bg-surface rounded-lg border border-border p-12 text-center">
          <ArrowRight className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-ink-muted font-medium">Nenhum redirect configurado</p>
          <p className="text-ink-faint text-sm mt-1">Clique em "Novo Redirect" para começar</p>
        </div>
      ) : (
        <div className="bg-surface rounded-lg border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-elev border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-muted uppercase tracking-wider">De → Para</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-muted uppercase tracking-wider w-20">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-muted uppercase tracking-wider">Nota</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-ink-muted uppercase tracking-wider w-24">Ativo</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {redirects.map(r => (
                <tr key={r.id} className={`${!r.enabled ? 'opacity-40' : ''} hover:bg-elev transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-elev px-2 py-0.5 rounded text-ink">{r.from}</code>
                      <ArrowRight className="w-3 h-3 text-ink-faint shrink-0" />
                      <code className="text-xs bg-primary-soft px-2 py-0.5 rounded text-primary truncate max-w-48">{r.to}</code>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${r.type === 301 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.type === 301 ? 'Permanente (301)' : 'Temporário (302)'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted text-xs truncate max-w-40">{r.note || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggle(r.id)} className="text-ink-faint hover:text-primary transition-colors">
                      {r.enabled
                        ? <ToggleRight className="w-5 h-5 text-primary" />
                        : <ToggleLeft className="w-5 h-5" aria-hidden="true" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => handleTest(r)}
                        disabled={testingId === r.id || !r.enabled}
                        className="p-1.5 text-ink-faint hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30"
                        title="Testar redirect"
                      >
                        {testingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => handleEdit(r)} className="p-1.5 text-ink-faint hover:text-primary hover:bg-primary-soft rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-ink-faint hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {testResult[r.id] && (
                      <div className={`mt-2 flex items-start gap-1.5 text-xs font-medium ${testResult[r.id].ok ? 'text-emerald-700' : 'text-red-600'}`}>
                        {testResult[r.id].ok
                          ? <><CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" /><span>Redirect funcionando: {r.from} → {testResult[r.id].location || r.to}</span></>
                          : <><XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" /><span>{testResult[r.id].status ? `Não encontrado: o servidor retornou erro ${testResult[r.id].status}` : 'Erro de rede ao testar'}</span></>
                        }
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Status */}
      {redirects.length > 0 && (
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-200 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800">{redirects.filter(r => r.enabled).length} redirect{redirects.filter(r => r.enabled).length !== 1 ? 's' : ''} ativo{redirects.filter(r => r.enabled).length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-emerald-600">Sincronizado automaticamente com a Vercel. Funciona assim que o deploy terminar (~2 min).</p>
          </div>
        </div>
      )}

    </div>
  );
}
