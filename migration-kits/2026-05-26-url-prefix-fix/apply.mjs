#!/usr/bin/env node
/**
 * Migration: URL prefix fix
 *
 * Bug: src/pages/[slug].astro sempre gerava posts, enquanto src/pages/blog/[slug].astro
 * era condicional. Resultado: quando aluno escolhia postUrlPrefix='blog', mesmo post ficava
 * acessível em /post E /blog/post → duplicação SEO.
 *
 * Fix: condicionar [slug].astro raiz a postUrlPrefix !== 'blog'.
 * Patch B: também moderniza UI no ConfigEditor (opcional, só se padrão antigo for detectado).
 *
 * USO:
 *   node apply.mjs <repoPath>
 *
 * Exit codes:
 *   0 — success (mudanças aplicadas e build verde, ou já estava correto)
 *   1 — falha esperada (path não encontrado, patch não casou, build quebrado)
 *   2 — usage error
 */

import { readFile, writeFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT_DIR = dirname(fileURLToPath(import.meta.url));

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

async function patchSlugRoute(repo) {
  const path = join(repo, 'src/pages/[slug].astro');
  if (!(await exists(path))) {
    return { ok: false, error: 'src/pages/[slug].astro não existe' };
  }
  const src = await readFile(path, 'utf-8');

  // Já aplicado?
  if (src.includes("postUrlPrefix === 'blog'") && src.includes('return []')) {
    return { ok: true, status: 'already-applied' };
  }

  // Procura getStaticPaths que inicia com `const posts = await getCollection('blog')` direto
  const reA = /(export\s+async\s+function\s+getStaticPaths\s*\(\)\s*\{)(\s*)const\s+posts\s*=\s*await\s+getCollection\(['"]blog['"]\)/;
  if (!reA.test(src)) {
    return { ok: false, error: 'getStaticPaths não casou com padrão esperado — patch manual necessário' };
  }

  // Garante import de readData se faltar
  let patched = src;
  if (!/import\s*\{[^}]*\breadData\b[^}]*\}\s*from/s.test(patched)) {
    // Adiciona import logo após o último import existente
    const lastImportMatch = patched.match(/(^[\s\S]*?)(import[\s\S]*?from\s*['"][^'"]+['"];?\s*\n)(?![\s\S]*?import)/m);
    if (lastImportMatch) {
      const insertAt = lastImportMatch[0].length;
      patched = patched.slice(0, insertAt) + "import { readData } from '../lib/readData';\n" + patched.slice(insertAt);
    }
  }

  // Aplica patch no getStaticPaths
  patched = patched.replace(reA, (_match, p1, p2) =>
    `${p1}${p2}const siteConfig = readData('siteConfig.json', {}) as any;\n  // Quando aluno escolheu prefixo /blog, esta rota nao gera (evita duplicacao com /blog/[slug]).\n  if (siteConfig?.postUrlPrefix === 'blog') return [];\n  const posts = await getCollection('blog')`
  );

  if (patched === src) {
    return { ok: false, error: 'Patch não modificou o arquivo (regex não casou bem)' };
  }

  await writeFile(path, patched, 'utf-8');
  return { ok: true, status: 'patched' };
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
  const result = { repo, success: false, steps: {} };

  log('info', 'checking repo', { repo });
  if (!(await exists(join(repo, 'package.json')))) {
    result.steps.prereqs = { ok: false, error: 'package.json não encontrado' };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }
  const pm = await detectPM(repo);
  log('info', `package manager: ${pm}`);
  result.steps.prereqs = { ok: true, pm };

  log('info', 'patching [slug].astro');
  const patch = await patchSlugRoute(repo);
  result.steps.patchSlugRoute = patch;
  if (!patch.ok) {
    log('error', 'patch failed', patch);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }

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
  log('error', 'unexpected error', { message: err?.message });
  process.exit(1);
});
