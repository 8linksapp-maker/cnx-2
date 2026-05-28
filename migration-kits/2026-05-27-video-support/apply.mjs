#!/usr/bin/env node
/**
 * Migration: Suporte a vídeos em posts (Tier A — automático)
 *
 * O QUE FAZ (automático, idempotente):
 *  1. Verifica pré-reqs (package.json + src/content/config.ts + src/pages existem)
 *  2. Copia src/lib/videoEmbed.ts (parser YouTube/Vimeo/iframe/mp4)
 *  3. Copia src/components/ui/PostVideo.astro (component embed responsivo)
 *  4. Se src/lib/shortcodes.ts NÃO existir: cria versão minimal só com [[video:]]
 *     Se já existir: detecta se tem suporte a video — se não, registra como manual_step
 *  5. Patch src/content/config.ts (Zod schema): adiciona videoUrl + videoPosition
 *  6. Roda build
 *
 * O QUE NÃO FAZ (manual — ver README seção "Manual steps"):
 *  - PostEditor.tsx (UI do admin): layout varia por template, impossível patchar safely
 *  - pages/[slug].astro e pages/blog/[slug].astro (page renderers): idem
 *
 * Caminho mínimo viável SEM os manual steps: aluno digita [[video:URL]] no body
 * via Quill editor, e o shortcode renderiza o embed responsivo. Funciona em todos
 * os templates (walker, TM, AR, CB) desde que o shortcode.ts esteja presente e o
 * page renderer já chame renderShortcodes (ver detect_renderShortcodes_call no JSON).
 *
 * USO:
 *   node apply.mjs <repoPath>
 *
 * Exit codes:
 *   0 — sucesso (mudanças aplicadas ou já aplicadas)
 *   1 — falha esperada (path missing, build broken)
 *   2 — usage error
 */

import { readFile, writeFile, copyFile, mkdir, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT_DIR = dirname(fileURLToPath(import.meta.url));
const FILES_DIR = join(KIT_DIR, 'files');

function log(level, msg, data) {
  const line = { ts: new Date().toISOString(), level, msg };
  if (data !== undefined) line.data = data;
  process.stderr.write(JSON.stringify(line) + '\n');
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

function runCmd(cmd, args, cwd) {
  return new Promise((resolveP) => {
    const proc = spawn(cmd, args, { cwd, shell: true, stdio: 'pipe' });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => resolveP({ code: -1, stdout, stderr: stderr + '\n' + err.message }));
    proc.on('close', (code) => resolveP({ code: code ?? 0, stdout, stderr }));
  });
}

async function detectPM(repo) {
  if (await exists(join(repo, 'bun.lockb')) || await exists(join(repo, 'bun.lock'))) return 'bun';
  if (await exists(join(repo, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await exists(join(repo, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

async function copyKitFile(repo, srcName, dstPath) {
  const src = join(FILES_DIR, srcName);
  const dst = join(repo, dstPath);
  const dstExists = await exists(dst);
  if (dstExists) {
    const a = await readFile(src, 'utf-8');
    const b = await readFile(dst, 'utf-8');
    if (a === b) return { status: 'identical' };
    // Sobrescreve só videoEmbed.ts e PostVideo.astro (criados/owned pela migration)
    // — shortcodes.ts NUNCA é sobrescrito automaticamente
    return { status: 'differs', skipped: true, note: 'arquivo existe com conteúdo diferente — NÃO sobrescrito' };
  }
  await mkdir(dirname(dst), { recursive: true });
  await copyFile(src, dst);
  return { status: 'created' };
}

async function ensureShortcodesLib(repo) {
  const path = join(repo, 'src/lib/shortcodes.ts');
  if (!(await exists(path))) {
    await mkdir(dirname(path), { recursive: true });
    await copyFile(join(FILES_DIR, 'shortcodes-minimal.ts'), path);
    return { status: 'created-minimal' };
  }
  const content = await readFile(path, 'utf-8');
  // Detecta suporte a [[video:]]
  const hasVideo = /\[\[\s*video\s*:|VIDEO_RE|renderVideoEmbed/.test(content);
  if (hasVideo) return { status: 'already-has-video-support' };
  return {
    status: 'manual-merge-required',
    note: 'src/lib/shortcodes.ts existe sem suporte a video. Patch manual: importar parseVideoUrl + adicionar VIDEO_RE + handler. Ver scaffold/src/lib/shortcodes.ts como referência.',
  };
}

async function patchContentConfig(repo) {
  const path = join(repo, 'src/content/config.ts');
  if (!(await exists(path))) {
    return { ok: false, error: 'src/content/config.ts não existe' };
  }
  const src = await readFile(path, 'utf-8');
  if (src.includes('videoUrl') && src.includes('videoPosition')) {
    return { ok: true, status: 'already-patched' };
  }

  // Procura o último campo do schema z.object({...}) — inserimos os 2 novos campos antes do fechamento `})`
  // Estratégia: achar o último `}),` que fecha o `z.object()` da `schema:` dentro do `defineCollection`
  const re = /(schema\s*:\s*z\.object\(\{[\s\S]*?)(\n\s*\}\),?\s*\n\s*\}\))/;
  const m = src.match(re);
  if (!m) {
    return { ok: false, error: 'getStaticPaths não bate com padrão esperado de defineCollection — patch manual necessário' };
  }
  const inject =
    "\n        /** URL de vídeo a embedar no post (YouTube, Vimeo, ou iframe genérico). */\n" +
    "        videoUrl: z.string().optional(),\n" +
    "        /** Posição do vídeo: 'hero' (substitui imagem) | 'after-hero' (default) | 'inline'. */\n" +
    "        videoPosition: z.enum(['hero', 'after-hero', 'inline']).optional(),";
  const patched = src.replace(re, (_match, p1, p2) => `${p1}${inject}${p2}`);
  if (patched === src) {
    return { ok: false, error: 'Patch não modificou o arquivo (regex não casou bem)' };
  }
  await writeFile(path, patched, 'utf-8');
  return { ok: true, status: 'patched' };
}

async function detectRenderShortcodesCall(repo) {
  // Detecta se os page renderers já chamam renderShortcodes (caminho pra shortcode funcionar)
  const candidates = [
    'src/pages/[slug].astro',
    'src/pages/blog/[slug].astro',
  ];
  const results = {};
  for (const c of candidates) {
    const p = join(repo, c);
    if (!(await exists(p))) { results[c] = 'not-found'; continue; }
    const content = await readFile(p, 'utf-8');
    if (/renderShortcodes\s*\(/.test(content)) results[c] = 'has-shortcodes';
    else if (/<Content\s*\/>/.test(content)) results[c] = 'plain-content';
    else results[c] = 'unknown';
  }
  return results;
}

async function buildRepo(repo, pm) {
  const cmd = pm === 'npm' ? ['npm', ['run', 'build']] :
              pm === 'yarn' ? ['yarn', ['build']] :
              pm === 'pnpm' ? ['pnpm', ['run', 'build']] :
              ['bun', ['run', 'build']];
  const res = await runCmd(cmd[0], cmd[1], repo);
  return { ok: res.code === 0, code: res.code, stderr: res.stderr.slice(-1500) };
}

async function main() {
  const repoArg = process.argv[2];
  if (!repoArg) {
    process.stderr.write('Usage: node apply.mjs <repoPath>\n');
    process.exit(2);
  }
  const repo = resolve(repoArg);
  const result = { repo, success: false, steps: {}, manual_steps: [] };

  log('info', 'checking repo', { repo });
  if (!(await exists(join(repo, 'package.json')))) {
    result.steps.prereqs = { ok: false, error: 'package.json não encontrado' };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }
  if (!(await exists(join(repo, 'src/content/config.ts')))) {
    result.steps.prereqs = { ok: false, error: 'src/content/config.ts não existe' };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }
  const pm = await detectPM(repo);
  result.steps.prereqs = { ok: true, pm };

  // 1. Copia videoEmbed.ts
  log('info', 'copying videoEmbed.ts');
  result.steps.videoEmbed = await copyKitFile(repo, 'videoEmbed.ts', 'src/lib/videoEmbed.ts');

  // 2. Copia PostVideo.astro
  log('info', 'copying PostVideo.astro');
  result.steps.postVideo = await copyKitFile(repo, 'PostVideo.astro', 'src/components/ui/PostVideo.astro');

  // 3. Garante shortcodes.ts
  log('info', 'ensuring shortcodes.ts');
  result.steps.shortcodes = await ensureShortcodesLib(repo);
  if (result.steps.shortcodes.status === 'manual-merge-required') {
    result.manual_steps.push('shortcodes-merge: integrar [[video:]] no src/lib/shortcodes.ts existente (ver msia-scaffold como referência)');
  }

  // 4. Patch content/config.ts
  log('info', 'patching content/config.ts');
  result.steps.contentConfig = await patchContentConfig(repo);
  if (!result.steps.contentConfig.ok) {
    log('error', 'content/config.ts patch failed', result.steps.contentConfig);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }

  // 5. Detecta state dos page renderers (informativo)
  log('info', 'inspecting page renderers');
  result.steps.pageRenderers = await detectRenderShortcodesCall(repo);
  for (const [path, state] of Object.entries(result.steps.pageRenderers)) {
    if (state === 'plain-content') {
      result.manual_steps.push(`page-renderer: ${path} renderiza <Content /> direto sem processar shortcodes. Adicionar import + chamada renderShortcodes (ver scaffold).`);
    }
  }
  result.manual_steps.push('post-editor-ui: PostEditor.tsx não foi tocado (layout varia por template). Aluno pode digitar [[video:URL]] direto no Quill — funciona sem patch.');

  // 6. Build
  log('info', 'running build');
  const build = await buildRepo(repo, pm);
  result.steps.build = { ok: build.ok, code: build.code };
  if (!build.ok) {
    result.steps.build.stderr_tail = build.stderr;
    log('error', 'build failed');
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }

  result.success = true;
  log('info', 'success');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

main().catch((err) => {
  log('error', 'unexpected error', { message: err?.message, stack: err?.stack });
  process.exit(1);
});
