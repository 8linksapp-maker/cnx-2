import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Info, ExternalLink, X } from 'lucide-react';

export interface ToastEvent {
    id?: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'progress';
    progress?: number;
    link?: string;
}

export const triggerToast = (message: string, type: 'success' | 'error' | 'info' | 'progress' = 'info', progress?: number, link?: string) => {
    window.dispatchEvent(new CustomEvent('cms-toast', { detail: { message, type, progress, link } }));
};

export default function CmsToaster() {
    const [toasts, setToasts] = useState<ToastEvent[]>([]);

    useEffect(() => {
        const handleToast = (e: any) => {
            const newToast = { id: Date.now().toString() + Math.random(), ...e.detail } as ToastEvent;

            if (newToast.type === 'progress') {
                setToasts(prev => {
                    const exists = prev.find(t => t.type === 'progress');
                    if (exists) return prev.map(t => t.type === 'progress' ? { ...t, ...newToast } : t);
                    return [...prev, newToast];
                });
            } else {
                setToasts(prev => [...prev.filter(t => t.type !== 'progress'), newToast]);
                setTimeout(() => {
                    setToasts(prev => prev.filter(t => t.id !== newToast.id));
                }, 6000);
            }
        };

        window.addEventListener('cms-toast', handleToast);
        return () => window.removeEventListener('cms-toast', handleToast);
    }, []);

    const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

    return (
        // Região persistente — leitores de tela anunciam novos toasts automaticamente
        <div
            aria-live="polite"
            aria-atomic="false"
            className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none"
        >
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    role={toast.type === 'error' ? 'alert' : 'status'}
                    className="pointer-events-auto bg-surface border border-border rounded-lg w-80 overflow-hidden"
                    style={{ boxShadow: '0 8px 24px rgba(80,40,20,0.12)' }}
                >
                    <div className="p-4 flex items-start gap-3">
                        <div className="shrink-0 mt-0.5" aria-hidden="true">
                            {toast.type === 'success'  && <CheckCircle2 className="w-5 h-5 text-primary" />}
                            {toast.type === 'error'    && <AlertCircle  className="w-5 h-5 text-red-600" />}
                            {toast.type === 'info'     && <Info         className="w-5 h-5 text-primary" />}
                            {toast.type === 'progress' && <Loader2      className="w-5 h-5 text-primary animate-spin" aria-label="Carregando" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-ink leading-snug">{toast.message}</p>
                            {toast.link && (
                                <a
                                    href={toast.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-soft text-primary hover:bg-primary hover:text-surface rounded text-xs font-semibold transition-colors"
                                >
                                    Ver alteração ao vivo
                                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                </a>
                            )}
                        </div>
                        {toast.type !== 'progress' && (
                            <button
                                onClick={() => removeToast(toast.id!)}
                                aria-label="Fechar notificação"
                                className="shrink-0 w-8 h-8 flex items-center justify-center text-ink-faint hover:text-ink hover:bg-elev rounded transition-colors"
                            >
                                <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                    {toast.type === 'progress' && toast.progress !== undefined && (
                        <div
                            role="progressbar"
                            aria-valuenow={toast.progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Progresso da operação"
                            className="w-full h-1.5 bg-elev"
                        >
                            <div
                                className="h-full bg-primary transition-all duration-700 ease-out"
                                style={{ width: `${toast.progress}%` }}
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
