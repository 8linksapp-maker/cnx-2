import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

/**
 * Aviso de segurança: detecta se o repositório do blog está PÚBLICO.
 * Em repo público, as chaves de API salvas no painel (que vão pro
 * pluginsConfig.json commitado) ficam expostas no GitHub. O aluno leigo
 * não percebe isso sozinho — então o admin avisa.
 *
 * Não renderiza nada se: dev/sem credenciais, repo privado, ou erro de check.
 */
export default function RepoVisibilityBanner() {
    const [isPublic, setIsPublic] = useState(false);

    useEffect(() => {
        let alive = true;
        fetch('/api/admin/repo-visibility')
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (alive && d?.configured && d.private === false) setIsPublic(true); })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    if (!isPublic) return null;

    return (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div className="text-red-800">
                <p className="font-semibold">Seu repositório está público — suas chaves de API estão expostas.</p>
                <p className="mt-1 text-red-700">
                    Chaves que você salva aqui (OpenAI, Brevo, Google) ficam visíveis pra qualquer pessoa no GitHub.
                    Abra as <strong>configurações do repositório no GitHub</strong> e mude a visibilidade para{' '}
                    <strong>Private</strong>. Depois disso, troque as chaves que já tinha salvo.
                </p>
            </div>
        </div>
    );
}
