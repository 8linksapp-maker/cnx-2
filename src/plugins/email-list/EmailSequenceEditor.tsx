/**
 * EmailSequenceEditor.tsx — Editor de sequência de emails automáticos
 *
 * UI para criar/editar emails enviados via Brevo após inscrição.
 * v1: envio manual individual (sem cron). Salva em pluginsConfig.json.
 */

import { useState, useEffect, useRef } from 'react';
import {
    Plus, Trash2, Send, Loader2, CheckCircle, AlertCircle, Save,
    Mail, Calendar, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

interface EmailItem {
    id: string;
    subject: string;
    body: string;
    delayDays: number;
}

const VARIABLES = [
    { token: '{{nome}}', label: 'nome do inscrito' },
    { token: '{{email}}', label: 'email do inscrito' },
];

function VariablesPanel({ bodyRef, onInsert }: {
    bodyRef: React.RefObject<HTMLTextAreaElement | null>;
    onInsert: (token: string) => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-border rounded-md overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-elev text-xs font-semibold text-ink-muted hover:bg-primary-soft transition-colors"
            >
                Variáveis disponíveis
                {open ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
            {open && (
                <div className="p-3 space-y-2 bg-surface">
                    {VARIABLES.map(v => (
                        <div key={v.token} className="flex items-center justify-between gap-3">
                            <div>
                                <code className="text-xs font-mono bg-elev px-1.5 py-0.5 rounded text-primary">{v.token}</code>
                                <span className="text-xs text-ink-muted ml-2">{v.label}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => onInsert(v.token)}
                                className="text-xs font-medium text-primary hover:underline shrink-0"
                            >
                                Inserir
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function EmailSequenceEditor() {
    const [emails, setEmails] = useState<EmailItem[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [fullConfig, setFullConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [testEmail, setTestEmail] = useState('');
    const [sendResults, setSendResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
    const [sequenceStats, setSequenceStats] = useState<Array<{ sequenceIndex: number; sent: number; failed: number; lastSentAt: string }>>([]);
    const [lastRunAt, setLastRunAt] = useState<string | null>(null);

    // Refs for each email body textarea (keyed by email id)
    const bodyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

    useEffect(() => {
        Promise.all([
            githubApi('read', CONFIG_PATH),
            fetch('/api/admin/plugins/email-list/sequence-status').then(r => r.ok ? r.json() : null).catch(() => null),
        ])
            .then(([data, stats]) => {
                const config = JSON.parse(data.content);
                setFullConfig(config);
                setFileSha(data.sha);
                const sequences = config?.emailList?.sequences ?? [];
                setEmails(sequences.map((s: any, i: number) => ({
                    id: `seq_${i}_${Date.now()}`,
                    subject: s.subject ?? '',
                    body: s.body ?? '',
                    delayDays: s.delayDays ?? 1,
                })));
                if (stats) {
                    setSequenceStats(stats.stats ?? []);
                    setLastRunAt(stats.lastRunAt ?? null);
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    function addEmail() {
        setEmails(prev => [...prev, {
            id: `new_${Date.now()}`,
            subject: '',
            body: '',
            delayDays: prev.length === 0 ? 1 : prev[prev.length - 1].delayDays + 1,
        }]);
    }

    function removeEmail(id: string) {
        setEmails(prev => prev.filter(e => e.id !== id));
    }

    function updateEmail(id: string, field: keyof Omit<EmailItem, 'id'>, value: string | number) {
        setEmails(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    }

    function insertVariable(emailId: string, token: string) {
        const textarea = bodyRefs.current[emailId];
        if (textarea) {
            const start = textarea.selectionStart ?? textarea.value.length;
            const end = textarea.selectionEnd ?? textarea.value.length;
            const current = textarea.value;
            const next = current.slice(0, start) + token + current.slice(end);
            updateEmail(emailId, 'body', next);
            // Restore focus + cursor after update
            requestAnimationFrame(() => {
                textarea.focus();
                const pos = start + token.length;
                textarea.setSelectionRange(pos, pos);
            });
        } else {
            // Fallback: append at end
            setEmails(prev => prev.map(e =>
                e.id === emailId ? { ...e, body: e.body + token } : e
            ));
        }
    }

    // Warnings: emails with delay=0
    const immediateEmails = emails.map((e, i) => ({ ...e, idx: i + 1 })).filter(e => e.delayDays === 0);

    async function handleSave() {
        setSaving(true); setSaved(false); setError('');
        triggerToast('Salvando sequência...', 'progress', 30);
        try {
            const sequences = emails.map(e => ({
                subject: e.subject.trim(),
                body: e.body.trim(),
                delayDays: Number(e.delayDays),
            }));
            const updated = {
                ...fullConfig,
                emailList: {
                    ...fullConfig?.emailList,
                    sequences,
                },
            };
            const res = await githubApi('write', CONFIG_PATH, {
                content: JSON.stringify(updated, null, 4),
                sha: fileSha,
                message: 'CMS: Update email sequences',
            });
            setFileSha(res.sha ?? fileSha);
            setFullConfig(updated);
            setSaved(true);
            triggerToast('Sequência salva!', 'success', 100);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    }

    async function sendTest(emailItem: EmailItem) {
        if (!testEmail.trim()) {
            setSendResults(prev => ({
                ...prev,
                [emailItem.id]: { ok: false, msg: 'Informe um email de destino acima.' },
            }));
            return;
        }
        setSendingId(emailItem.id);
        setSendResults(prev => ({ ...prev, [emailItem.id]: undefined as any }));
        try {
            const htmlContent = emailItem.body
                .split('\n')
                .map(line => `<p>${line}</p>`)
                .join('');
            const res = await fetch('/api/admin/plugins/email-list/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: testEmail.trim(),
                    subject: emailItem.subject,
                    htmlContent,
                }),
            });
            const data = await res.json();
            setSendResults(prev => ({
                ...prev,
                [emailItem.id]: { ok: data.success, msg: data.message },
            }));
        } catch {
            setSendResults(prev => ({
                ...prev,
                [emailItem.id]: { ok: false, msg: 'Erro de rede.' },
            }));
        } finally {
            setSendingId(null);
        }
    }

    const inputClass = 'w-full bg-surface border border-border rounded-md px-4 py-3 text-sm font-medium text-ink focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20/20 transition-all';
    const labelClass = 'block text-xs font-bold text-ink-faint uppercase tracking-wider mb-1.5';

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-16 text-ink-faint">
            <Loader2 className="w-7 h-7 animate-spin mb-3 text-primary" />
            <p className="text-sm animate-pulse">Carregando sequências...</p>
        </div>
    );

    if (error && !fullConfig) return (
        <div className="bg-red-50 text-red-700 p-6 rounded-lg border border-red-200 flex gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Banner sequência automática */}
            <div className="bg-primary-soft border border-primary/30 rounded-lg p-4 flex gap-3">
                <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                    <p className="font-bold text-violet-800 text-sm">Sequência automática</p>
                    <p className="text-primary text-xs mt-0.5 leading-relaxed">
                        Emails processados diariamente às 08:00 UTC via Vercel Cron.
                        {lastRunAt && (
                            <> Última execução: <span className="font-semibold">{new Date(lastRunAt).toLocaleString('pt-BR')}</span>.</>
                        )}
                    </p>
                </div>
            </div>

            {/* Email de teste global */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-5">
                <label className="block text-sm font-bold text-ink mb-2">Email para testes</label>
                <input
                    type="email"
                    value={testEmail}
                    onChange={e => setTestEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className={inputClass}
                />
                <p className="text-xs text-ink-faint mt-1">Usado pelo botão "Enviar teste" em cada email.</p>
            </div>

            {/* Lista de emails */}
            {emails.length === 0 ? (
                <div className="text-center py-12 text-ink-faint bg-surface rounded-lg border border-dashed border-border">
                    <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium mb-1">Nenhum email na sequência</p>
                    <p className="text-xs">Adicione o primeiro email abaixo.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {emails.map((emailItem, idx) => {
                        const stat = sequenceStats.find(s => s.sequenceIndex === idx);
                        return (
                        <div key={emailItem.id} className="bg-surface rounded-lg border border-border shadow-sm p-5">
                            {/* Header do email */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="w-7 h-7 bg-primary-soft text-primary rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                                    <span className="text-sm font-bold text-ink">Email #{idx + 1}</span>
                                    {stat && (
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                            Enviado para {stat.sent} inscritos{stat.failed > 0 ? ` (${stat.failed} falha${stat.failed > 1 ? 's' : ''})` : ''}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeEmail(emailItem.id)}
                                    className="p-1.5 text-ink-faint hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {/* Delay + Assunto */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className={labelClass}>
                                            <Calendar className="w-3 h-3 inline mr-1" />
                                            Dias após inscrição
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={emailItem.delayDays}
                                            onChange={e => updateEmail(emailItem.id, 'delayDays', Number(e.target.value))}
                                            className={inputClass}
                                        />
                                        <p className="text-xs text-ink-faint mt-1">
                                            Digite 1 para enviar no dia seguinte à inscrição. Use 0 apenas para envio imediato.
                                        </p>
                                    </div>
                                    <div className="col-span-2">
                                        <label className={labelClass}>Assunto</label>
                                        <input
                                            type="text"
                                            value={emailItem.subject}
                                            onChange={e => updateEmail(emailItem.id, 'subject', e.target.value)}
                                            placeholder="Assunto do email"
                                            className={inputClass}
                                        />
                                    </div>
                                </div>

                                {/* Aviso delay=0 inline */}
                                {emailItem.delayDays === 0 && (
                                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                                        O email #{idx + 1} será enviado imediatamente após a inscrição.
                                    </div>
                                )}

                                {/* Corpo */}
                                <div>
                                    <label className={labelClass}>Conteúdo (texto simples / markdown)</label>
                                    <textarea
                                        ref={el => { bodyRefs.current[emailItem.id] = el; }}
                                        rows={5}
                                        value={emailItem.body}
                                        onChange={e => updateEmail(emailItem.id, 'body', e.target.value)}
                                        placeholder="Olá {{nome}},&#10;&#10;Escreva aqui o conteúdo do email..."
                                        className={`${inputClass} resize-none font-mono text-xs`}
                                    />
                                </div>

                                {/* Painel de variáveis */}
                                <VariablesPanel
                                    bodyRef={{ current: bodyRefs.current[emailItem.id] ?? null }}
                                    onInsert={token => insertVariable(emailItem.id, token)}
                                />

                                {/* Enviar teste */}
                                <div className="flex items-center gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => sendTest(emailItem)}
                                        disabled={sendingId === emailItem.id || !emailItem.subject || !emailItem.body}
                                        className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-xs font-semibold text-ink hover:bg-elev disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {sendingId === emailItem.id
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <Send className="w-3.5 h-3.5" />}
                                        {sendingId === emailItem.id ? 'Enviando...' : 'Enviar teste'}
                                    </button>

                                    {sendResults[emailItem.id] && (
                                        <div className={`flex items-center gap-1.5 text-xs font-semibold ${sendResults[emailItem.id].ok ? 'text-green-600' : 'text-red-600'}`}>
                                            {sendResults[emailItem.id].ok
                                                ? <CheckCircle className="w-3.5 h-3.5" />
                                                : <AlertCircle className="w-3.5 h-3.5" />}
                                            {sendResults[emailItem.id].msg}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}

            {/* Adicionar + Salvar */}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={addEmail}
                    className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-border rounded-md text-sm font-medium text-ink-muted hover:border-primary/60 hover:text-primary hover:bg-primary-soft transition-all"
                >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Adicionar Email
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-primary hover:bg-primary disabled:opacity-50 text-white px-6 py-2.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-none/20"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                    {saving ? 'Salvando...' : saved ? 'Salvo!' : emails.length === 0 ? 'Salvar (sequência vazia)' : 'Salvar Sequência'}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}
        </div>
    );
}
