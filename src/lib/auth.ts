/**
 * Auth por senha HMAC-SHA256 sem deps externas.
 * Cookie: admin_session (httpOnly, Secure em prod, SameSite=Lax, 7 dias)
 * Cookie: login_attempts (brute force protection assinada, 15min)
 */

const COOKIE_NAME = 'admin_session';
const ATTEMPTS_COOKIE = 'login_attempts';
const EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const ATTEMPTS_EXPIRES_SEC = 15 * 60; // 15 min
export const MAX_LOGIN_ATTEMPTS = 5;

async function hmac(secret: string, data: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Comparação em tempo constante — não vaza, pelo tempo de resposta, quantos
 * caracteres bateram. Protege a verificação da senha e da assinatura HMAC
 * contra timing attacks. O tamanho ainda pode vazar (aceitável aqui).
 */
function timingSafeEqual(a: string, b: string): boolean {
    const ab = new TextEncoder().encode(a);
    const bb = new TextEncoder().encode(b);
    let diff = ab.length ^ bb.length;
    const len = Math.max(ab.length, bb.length);
    for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
    return diff === 0;
}

/** Cria a string de cookie assinada. Retorna null se ADMIN_SECRET não definido. */
export async function createSession(password: string): Promise<string | null> {
    const secret = import.meta.env.ADMIN_SECRET;
    if (!secret) return null;
    if (!timingSafeEqual(password, secret)) return null;

    const expires = Date.now() + EXPIRES_MS;
    const payload = `${expires}`;
    const sig = await hmac(secret, payload);
    return `${payload}.${sig}`;
}

/** Valida cookie. Retorna true se válido. */
export async function validateSession(cookieValue: string | undefined): Promise<boolean> {
    if (!cookieValue) return false;
    const secret = import.meta.env.ADMIN_SECRET;
    if (!secret) return false;

    const parts = cookieValue.split('.');
    if (parts.length !== 2) return false;

    const [expStr, sig] = parts;
    const expires = parseInt(expStr, 10);
    if (isNaN(expires) || Date.now() > expires) return false;

    const expected = await hmac(secret, expStr);
    return timingSafeEqual(expected, sig);
}

// ── Brute-force protection via cookie assinado ───────────────────────────
// Persiste entre cold starts do serverless (ao contrário de um Map in-memory),
// porque o estado viaja no próprio cookie, assinado com ADMIN_SECRET.
export interface AttemptsPayload { count: number; since: number }

/** Cria cookie de tentativas assinado. */
export async function signAttempts(count: number, since: number): Promise<string> {
    const secret = import.meta.env.ADMIN_SECRET || 'fallback';
    const payload = `${count}:${since}`;
    const sig = await hmac(secret, payload);
    return `${payload}.${sig}`;
}

/** Lê e valida cookie de tentativas. Retorna null se inválido ou expirado (15min). */
export async function readAttempts(cookieValue: string | undefined): Promise<AttemptsPayload | null> {
    if (!cookieValue) return null;
    const secret = import.meta.env.ADMIN_SECRET || 'fallback';
    const dotIdx = cookieValue.lastIndexOf('.');
    if (dotIdx === -1) return null;
    const payload = cookieValue.slice(0, dotIdx);
    const sig = cookieValue.slice(dotIdx + 1);
    const expected = await hmac(secret, payload);
    if (!timingSafeEqual(expected, sig)) return null;
    const parts = payload.split(':');
    if (parts.length !== 2) return null;
    const count = parseInt(parts[0], 10);
    const since = parseInt(parts[1], 10);
    if (isNaN(count) || isNaN(since)) return null;
    if (Date.now() - since > ATTEMPTS_EXPIRES_SEC * 1000) return null;
    return { count, since };
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME;
export const ATTEMPTS_COOKIE_EXPORT = ATTEMPTS_COOKIE;
export const ATTEMPTS_EXPIRES_SEC_EXPORT = ATTEMPTS_EXPIRES_SEC;
