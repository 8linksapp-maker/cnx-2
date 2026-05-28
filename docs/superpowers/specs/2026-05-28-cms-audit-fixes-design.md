# CMS Audit Fixes — Design Spec
**Data:** 2026-05-28  
**Escopo:** msia-scaffold — correção de todos os gaps identificados na auditoria técnica  
**Estratégia:** 3 batches independentes em ordem de severidade (P0 → P1 → P2)

---

## Contexto

Auditoria técnica do scaffold identificou 21 issues:
- 2 P0 — bloqueadores de produção
- 7 P1 — bugs sérios / riscos reais em prod
- 12 P2 — melhorias importantes incluindo plugin slot aggregators

O projeto é um blog Astro 5.1 SSG com painel admin, persistência via GitHub Contents API (sem banco), e 13 plugins. Auth via HMAC-SHA256 cookie próprio.

---

## Batch 1 — P0: Race Conditions + emailsSent

### P0-1: Category rename não-atômico

**Problema:** `src/pages/api/admin/categories/rename.ts` faz N commits separados (1 por post + `categories.json` + redirects + `vercel.json`). Falha no meio deixa site com dados inconsistentes.

**Fix:** refatorar a persistência para usar GitHub Tree API:

1. Busca SHA do commit HEAD atual (1 request)
2. Monta array de todos os arquivos alterados em memória
3. Cria 1 tree com todas as mudanças (`POST /repos/{owner}/{repo}/git/trees`)
4. Cria 1 commit apontando para a tree (`POST /repos/{owner}/{repo}/git/commits`)
5. Atualiza ref `main` (`PATCH /repos/{owner}/{repo}/git/refs/heads/main`)

Resultado: operação atômica — ou tudo entra, ou nada entra.

**Arquivo afetado:** `src/pages/api/admin/categories/rename.ts`  
**Helper novo:** `src/lib/repoAtomicCommit.ts` — função `atomicCommit(files: {path, content}[], message: string)` reutilizável em outros endpoints futuramente.

---

### P0-2: emailsSent.json crescimento ilimitado

**Problema:** GitHub API rejeita arquivo >1MB via REST. Com ~500-1000 emails, `cron/process-sequences.ts` começa a falhar silenciosamente.

**Fix:** nova lib `src/lib/emailLog.ts` com rotação automática:

- **Append com rotação:** antes de escrever, verifica `Buffer.byteLength(content)`. Se >400KB, arquiva conteúdo atual em `emailsSent-YYYY-MM.json` e reinicia o arquivo principal vazio.
- **Leitura:** `getSentSet()` lê apenas o arquivo corrente (suficiente para idempotência do cron dentro do mês).

`process-sequences.ts` passa a usar `emailLog.ts` em vez de escrever diretamente no JSON.

**Arquivos afetados:**
- `src/lib/emailLog.ts` (novo)
- `src/pages/api/cron/process-sequences.ts` (usa a nova lib)

---

## Batch 2 — P1: Segurança + Auth + Operacional

### P1-1: Cookie sem flag `Secure`

**Fix:** `src/pages/api/admin/login.ts:21` — adicionar `; Secure` ao cookie string condicionalmente via `import.meta.env.PROD`.

```ts
const securFlag = import.meta.env.PROD ? '; Secure' : '';
const cookieValue = `${COOKIE_NAME}=...; HttpOnly; SameSite=Lax; Max-Age=${EXPIRES_SEC}${secureFlag}`;
```

---

### P1-2: Sem proteção contra brute force em login

**Solução sem dependências externas:** cookie assinado de tentativas.

- Login falho → server retorna cookie `login_attempts` com payload `{count, since}` assinado via HMAC (mesmo mecanismo de `auth.ts`)
- Próxima tentativa → server lê e valida o cookie; se `count >= 5` e `Date.now() - since < 15min` → retorna 429
- Após 15min → reseta (cookie expira naturalmente)

Sem estado server-side, sem dependência externa. Funciona com Vercel serverless stateless.

**Arquivo afetado:** `src/pages/api/admin/login.ts`  
**Helper:** `src/lib/auth.ts` — adicionar `signAttempts()` e `readAttempts()`.

---

### P1-3: Timing attack na validação HMAC

**Fix:** `src/lib/auth.ts:44` — substituir comparação `===` por `crypto.timingSafeEqual`.

```ts
// Antes
return expected === sig;

// Depois
return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
```

---

### P1-4: Rate limit em send-email

**Solução:** consulta `emailLog.ts` (criado no P0-2) contando envios na última hora. Se `count >= 500` (configurável via `siteConfig.json` campo `emailHourlyLimit`), retorna 429.

Zero dependência nova. Reutiliza a lib do P0-2.

**Arquivo afetado:** `src/pages/api/admin/plugins/email-list/send-email.ts`

---

### P1-5: Race condition em `repoWriteFile` (SHA mismatch)

**Fix:** retry com backoff exponencial em `src/lib/repoIo.ts`.

- Em caso de resposta 409 (SHA mismatch): re-busca o SHA e tenta novamente
- Até 3 tentativas: delays 500ms → 1000ms → 2000ms
- Após 3 falhas: propaga erro com mensagem clara ao chamador

**Arquivo afetado:** `src/lib/repoIo.ts`

---

### P1-6: Limite 4MB no import/export

**Fix em duas partes:**

1. `vercel.json` — adicionar config de função para o endpoint de import:
```json
{
  "functions": {
    "src/pages/api/admin/import.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

2. `src/pages/api/admin/import.ts` — aumentar `MAX_ZIP_SIZE` para 10MB e processar arquivos do ZIP em batches de 10 usando `atomicCommit()` (criado no P0-1) em vez de commits individuais.

---

### P1-7: Credenciais Google em texto plano no repo

**Fix em 3 partes:**

1. `src/pages/api/admin/plugins/search-console/data.ts` — ler `process.env.GOOGLE_SERVICE_ACCOUNT_JSON` em vez de `pluginsConfig.searchConsole.serviceAccountJson`
2. `src/data/pluginsConfig.json` — remover campo `serviceAccountJson` do objeto `searchConsole`
3. `src/components/admin/SearchConsolePanel.tsx` — substituir o campo editável da chave por label estático: `"Configurado via variável de ambiente GOOGLE_SERVICE_ACCOUNT_JSON no Vercel"`

---

## Batch 3 — P2: Melhorias + Plugin Slot Aggregators

### P2-1 a P2-12: Fixes menores

| Fix | Arquivo | O que muda |
|---|---|---|
| P2-1: Cookie parsing | `src/middleware.ts` | Substitui split manual por parse robusto inline (lib `cookie` não está instalada — evitar dep nova) |
| P2-2: Cache stale | `src/lib/repoIo.ts` | Invalida `readCache` após qualquer `repoWriteFile` |
| P2-3: Zod schemas | `src/lib/schemas.ts` (novo) | Schema Zod para os 18 JSONs de dados; todas leituras passam por `.parse()` |
| P2-4: Filename seguro | `src/pages/api/admin/import.ts:12` | Regex `/^[a-z0-9\-_.]+$/i` sem espaços ou unicode |
| P2-5: Unsubscribe | `src/data/subscribers.json` + leads route | Campo `unsubscribedAt`; cron filtra registros sem esse campo |
| P2-7: AI timeout + validação | `src/pages/api/admin/plugins/ai/generate.ts` | `AbortController` 60s + parse do frontmatter antes de salvar |
| P2-8: Deploy status | `src/pages/api/admin/deploy-status.ts` | Cache 30s em módulo + `AbortController` 5s por fetch |
| P2-9: HTML escape cron | `src/pages/api/cron/process-sequences.ts` | `escapeHtml()` antes de montar `<p>` tags |
| P2-11: Aviso >1MB | `src/lib/repoIo.ts` | Check `Buffer.byteLength > 900_000` antes do PUT; erro claro |
| P2-12: Auth dupla | `send-email.ts`, `leads.ts`, `generate.ts` | Remove `validateSession()` redundante |

*P2-6 (retry) coberto pelo P1-5. Não duplicar.*

---

### P2-10: Plugin Slot Aggregators

Implementação do sistema descrito em `PLUGIN_SYSTEM.md`.

**Arquitetura:** 4 arquivos slot que agregam os componentes dos plugins ativos, lendo `pluginsConfig.json` e renderizando condicionalmente.

**Slots criados:**

| Arquivo | Posição no HTML | Plugins que entram |
|---|---|---|
| `src/components/_slots/HeadPlugins.astro` | dentro de `<head>` | Analytics (GA4, GTM), pixels (Meta, TikTok), fonts custom |
| `src/components/_slots/BodyStartPlugins.astro` | logo após `<body>` | GTM noscript |
| `src/components/_slots/BodyEndPlugins.astro` | antes de `</body>` | Chat widgets, Hotjar, scripts lazy |
| `src/components/_slots/PostPlugins.astro` | após conteúdo do post | Related posts, CTA, comentários |

**Layouts refatorados:**
- `src/layouts/BaseLayout.astro` — remove imports diretos de plugins; importa `HeadPlugins`, `BodyStartPlugins`, `BodyEndPlugins`
- `src/pages/[slug].astro` — remove imports diretos de plugins; importa `PostPlugins`

**Adicionar plugin novo (pós-refactor):** criar componente + adicionar 1 linha no slot correto. Sem tocar nos layouts.

---

## Decisões de design

1. **`atomicCommit()` como helper compartilhado** — P0-1 cria a função, P1-6 (import) a reutiliza. Garante que toda operação multi-arquivo seja atômica.
2. **`emailLog.ts` como abstração** — P0-2 cria, P1-4 reutiliza. Centralizadecisão de rotação e leitura de log.
3. **Sem dependências externas novas** — todas as soluções usam o que já está instalado. P2-1 usa parse inline robusto (não requer a lib `cookie` que não está instalada).
4. **Batches são independentes** — cada batch pode ser mergeado sem o outro.

---

## Arquivos novos criados

- `src/lib/repoAtomicCommit.ts` — GitHub Tree API wrapper
- `src/lib/emailLog.ts` — log de emails com rotação
- `src/lib/schemas.ts` — Zod schemas para todos os data files
- `src/components/_slots/HeadPlugins.astro`
- `src/components/_slots/BodyStartPlugins.astro`
- `src/components/_slots/BodyEndPlugins.astro`
- `src/components/_slots/PostPlugins.astro`

---

## Fora de escopo

- Testes automatizados (não há test runner configurado no scaffold)
- Observabilidade / logging estruturado (Sentry, etc.)
- Migração de dados em repos já deployados (migration kits tratam isso separadamente)
