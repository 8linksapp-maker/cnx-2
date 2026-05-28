# Migration Kit — Backup Feature (Import/Export de Posts)

**Data:** 2026-05-26
**Origem:** msia-scaffold @ branch backup-feature
**Aplicável a:** todos os sites Astro MSIA (atelierh2o, fashion4fun, lpfa, e demais alunos)
**Risco:** baixo (apenas adiciona arquivos novos + 1 patch de 2 linhas no AdminNav)
**Validação automatizável:** sim (`bun run build` deve passar)

---

## O que essa migração entrega

Adiciona ao site uma rota `/admin/backup` que permite:
- **Exportar** todos os posts (markdown) + imagens referenciadas neles, num único `.zip`
- **Importar** um `.zip` de outro site MSIA (com preview de conflitos antes de aplicar)

Não toca em produtos, landings, configurações, plugins — só conteúdo editorial (posts + uploads).

---

## Pré-requisitos do repo de destino

- Astro 5.x com adapter Vercel ou Node
- TypeScript
- Tailwind CSS (BackupManager usa classes Tailwind)
- React 18 (BackupManager é island React)
- `lucide-react` instalado
- Estrutura padrão MSIA:
  - `src/lib/`
  - `src/pages/api/admin/`
  - `src/components/admin/`
  - `src/pages/admin/`
  - `src/components/admin/CmsToaster.tsx` (a feature usa `triggerToast`)
  - `src/lib/readData.ts` (a página backup.astro lê o `siteConfig.json`)
- Middleware admin protegendo `/api/admin/*` (padrão MSIA)
- `package.json` com bun ou npm

Se algum item acima faltar, **pular o repo** e logar pra revisão manual.

---

## Passos sequenciais

### 1. Instalar dependência

```bash
cd <repo>
bun add jszip
# fallback: npm install jszip
```

Versão esperada: `^3.10.1`.

### 2. Criar os 5 arquivos novos

Copiar exatamente como estão em `files/`:

| Arquivo no kit | Destino no repo |
|---|---|
| `files/repoIo.ts` | `src/lib/repoIo.ts` |
| `files/export.ts` | `src/pages/api/admin/export.ts` |
| `files/import.ts` | `src/pages/api/admin/import.ts` |
| `files/BackupManager.tsx` | `src/components/admin/BackupManager.tsx` |
| `files/backup.astro` | `src/pages/admin/backup.astro` |

**Se algum desses paths já existir no destino:** abortar a migração desse repo e logar pra revisão (alguém pode ter criado feature concorrente com o mesmo nome).

### 3. Patch no AdminNav

Arquivo: `src/components/admin/AdminNav.tsx`

**Patch A — adicionar `FileArchive` no import do `lucide-react`:**

Procurar a linha (qualquer formato) que importa de `lucide-react`. Adicionar `FileArchive` na lista. Exemplo de antes/depois:

```diff
 import {
     LayoutDashboard, FileText, Tag, Users, Info, Phone,
     Shield, Settings, LogOut, ChevronRight, ExternalLink, Navigation,
-    Sparkles, Package,
+    Sparkles, Package, FileArchive,
 } from 'lucide-react';
```

Se já tem `FileArchive` no import: pular esse patch (já aplicado).

**Patch B — adicionar `NavLink` de Backup logo após o link "Configurações":**

Procurar pela linha que contém `Configurações` ou `'/admin/config'`. Inserir o novo `NavLink` IMEDIATAMENTE APÓS, dentro do mesmo bloco `<div>` da seção Sistema:

```diff
 <NavLink item={{ label: 'Configurações', href: '/admin/config', icon: Settings, section: 'config' }} active={activeSection === 'config'} />
+<NavLink item={{ label: 'Backup', href: '/admin/backup', icon: FileArchive, section: 'backup' }} active={activeSection === 'backup'} />
```

Se já tem `href: '/admin/backup'` em qualquer lugar do arquivo: pular esse patch.

### 4. Build de validação

```bash
bun run build
# fallback: npm run build
```

Esperado: exit 0, sem erros de TypeScript.

Se falhar:
- Reverter as 5 cópias e os 2 patches
- Logar o erro pra revisão manual
- **Não commitar**

### 5. Commit + push

Se build passou, commit com mensagem padronizada:

```
feat: add backup feature (import/export de posts)

- /admin/backup: nova rota com upload/download de zip
- Posts (markdown) + imagens referenciadas
- Preview de conflitos antes de aplicar import
- repoIo.ts: helper dev fs vs prod GitHub

via migration-kit/2026-05-26-backup-feature
```

Branch: aplicar em `main` direto (mudança aditiva, sem risco) **OU** branch `feat/backup-feature` + PR auto-merge se houver branch protection.

---

## Validação pós-deploy

Após o push, esperar Vercel deployar e validar:

1. `GET https://<site>/admin/backup` → retorna HTML (não 404, não 500)
2. Login funciona normalmente
3. Nav sidebar mostra "Backup" abaixo de "Configurações"

Não validar export/import na produção (envolve commits no GitHub do aluno).

---

## Rollback

Se algum problema for reportado pelo aluno:

```bash
git revert <hash-do-commit>
git push
```

Não há schema migration nem mudança de dados — rollback é limpo.

---

## Checklist por repo

- [ ] Pré-requisitos verificados
- [ ] `bun add jszip` rodou
- [ ] 5 arquivos copiados
- [ ] AdminNav patch A aplicado (FileArchive import)
- [ ] AdminNav patch B aplicado (NavLink Backup)
- [ ] `bun run build` passou
- [ ] Commit criado
- [ ] Push feito
- [ ] `/admin/backup` retorna HTML válido em produção

---

## Lista de repos a aplicar

(Preencher pelo Juvenal a partir do GitHub listing dos alunos)

| Repo | Aluno | Status | Erro (se houver) |
|---|---|---|---|
| atelierh2o | ... | pending | |
| fashion4fun | ... | pending | |
| lpfa | ... | pending | |
| ... | ... | pending | |

---

## Notas técnicas

- `repoIo.ts` detecta automaticamente se está em dev (sem env vars GitHub) ou prod (com GITHUB_TOKEN/OWNER/REPO setados). Não precisa configurar nada novo no Vercel.
- `export.ts` lê `src/content/blog/*.md` do repo (via GitHub Contents API em prod). Pode demorar alguns segundos pra sites com 50+ posts.
- `import.ts` recebe FormData via POST. Limite do Vercel API gateway é ~4.5MB por request — zips maiores podem precisar de ajuste (não esperado pra sites de alunos).
- Imagens referenciadas em URLs externas (http/https) são deixadas como estão — só `/uploads/*` locais são empacotadas.
