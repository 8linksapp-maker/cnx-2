import type { APIRoute } from 'astro';
import {
    createSession,
    signAttempts,
    readAttempts,
    MAX_LOGIN_ATTEMPTS,
    COOKIE_NAME_EXPORT as COOKIE_NAME,
    ATTEMPTS_COOKIE_EXPORT as ATTEMPTS_COOKIE,
    ATTEMPTS_EXPIRES_SEC_EXPORT as ATTEMPTS_EXPIRES_SEC,
} from '../../../lib/auth';

export const prerender = false;

const SESSION_EXPIRES_SEC = 7 * 24 * 60 * 60; // 7 dias

export const POST: APIRoute = async ({ request }) => {
    try {
        const { password } = await request.json();
        if (!password) {
            return new Response(JSON.stringify({ error: 'Senha obrigatória.' }), { status: 400 });
        }

        // Lê cookie de tentativas (assinado — sobrevive cold start serverless)
        const cookieHeader = request.headers.get('cookie') || '';
        const cookieMap: Record<string, string> = {};
        for (const part of cookieHeader.split(';')) {
            const [k, ...v] = part.trim().split('=');
            if (k) cookieMap[k.trim()] = decodeURIComponent(v.join('='));
        }
        const attempts = await readAttempts(cookieMap[ATTEMPTS_COOKIE]);

        // Bloqueia se atingiu o limite
        if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS) {
            const remainingSec = Math.ceil((ATTEMPTS_EXPIRES_SEC * 1000 - (Date.now() - attempts.since)) / 1000);
            return new Response(
                JSON.stringify({ error: `Muitas tentativas. Aguarde ${remainingSec}s.` }),
                { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(remainingSec) } }
            );
        }

        const session = await createSession(password);
        const secureFlag = import.meta.env.PROD ? '; Secure' : '';

        if (!session) {
            // Login falhou — incrementa contador (preserva o início da janela)
            const newCount = (attempts?.count || 0) + 1;
            const since = attempts?.since || Date.now();
            const attemptsToken = await signAttempts(newCount, since);
            const attemptsCookie = `${ATTEMPTS_COOKIE}=${encodeURIComponent(attemptsToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ATTEMPTS_EXPIRES_SEC}${secureFlag}`;

            return new Response(JSON.stringify({ error: 'Senha incorreta.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', 'Set-Cookie': attemptsCookie },
            });
        }

        // Login OK — seta sessão + limpa cookie de tentativas
        const sessionCookie = `${COOKIE_NAME}=${encodeURIComponent(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_EXPIRES_SEC}${secureFlag}`;
        const clearAttempts = `${ATTEMPTS_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;

        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: [
                ['Content-Type', 'application/json'],
                ['Set-Cookie', sessionCookie],
                ['Set-Cookie', clearAttempts],
            ] as any,
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
