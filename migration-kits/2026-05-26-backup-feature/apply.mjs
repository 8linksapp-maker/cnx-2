#!/usr/bin/env node
/**
 * Aplica a migration "backup-feature" num repo MSIA local.
 *
 * USO (do diretório do kit ou com path absoluto):
 *   node apply.mjs <repoPath>
 *
 * Comportamento:
 *   1. Verifica pré-requisitos (Astro, lucide-react, etc)
 *   2. Roda `bun add jszip` (fallback `npm install jszip`)
 *   3. Copia os 5 arquivos novos pra dentro de src/
 *   4. Aplica os 2 patches no AdminNav.tsx
 *   5. Roda `bun run build` (fallback `npm run build`)
 *   6. Imprime resumo JSON em stdout
 *
 * Retorna exit code 0 em sucesso, 1 em erro com falha esperada (pré-req faltando, build quebrado).
 *
 * NÃO faz commit nem push. Quem chama (Juvenal) decide o que fazer com o working tree.
 */

import { readFile, writeFile, copyFile, mkdir, access, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT_DIR = dirname(fileURLToPath(import.meta.url));
const FILES_DIR = join(KIT_DIR, 'files');

const FILE_MAP = [
  { src: 'repoIo.ts',          dst: 'src/lib/repoIo.ts' },
  { src: 'export.ts',          dst: 'src/pages/api/admin/export.ts' },
  { src: 'import.ts',          dst: 'src/pages/api/admin/import.ts' },
  { src: 'BackupManager.tsx',  dst: 'src/components/admin/BackupManager.tsx' },
  { src: 'backup.astro',       dst: 'src/pages/admin/backup.astro' },
];

const PRE_REQ_FILES = [
  'package.json',
  'src/components/admin/AdminNav.tsx',
  'src/components/admin/CmsToaster.tsx',
  'src/lib/readData.ts',
  'src/pages/api/admin/github.ts',
];

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
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => resolveP({ code: -1, stdout, stderr: stderr + '\n' + err.message }));
    proc.on('close', (code) => resolveP({ code: code ?? 0, stdout, stderr }));
  });
}

async function detectPackageManager(repo) {
  if (await exists(join(repo, 'bun.lockb'))) return 'bun';
  if (await exists(join(repo, 'bun.lock'))) return 'bun';
  if (await exists(join(repo, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await exists(join(repo, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

async function checkPrereqs(repo) {
  const missing = [];
  for (const f of PRE_REQ_FILES) {
    if (!(await exists(join(repo, f)))) missing.push(f);
  }
  if (missing.length > 0) return { ok: false, missing };

  // Checagens leves no package.json
  const pkg = JSON.parse(await readFile(join(repo, 'package.json'), 'utf-8'));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const needed = ['astro', 'react', 'lucide-react', 'tailwindcss'];
  const missingDeps = needed.filter(d => !deps[d]);
  if (missingDeps.length > 0) return { ok: false, missing_deps: missingDeps };

  return { ok: true, pm: await detectPackageManager(repo) };
}

async function patchAdminNav(repo) {
  const path = join(repo, 'src/components/admin/AdminNav.tsx');
  const src = await readFile(path, 'utf-8');

  // Já aplicado?
  const hasBackupRoute = src.includes("href: '/admin/backup'");
  const hasFileArchiveImport = /import\s*\{[^}]*\bFileArchive\b[^}]*\}\s*from\s*['"]lucide-react['"]/s.test(src);

  let patched = src;
  let appliedA = false;
  let appliedB = false;

  // Patch A — adicionar FileArchive no import
  if (!hasFileArchiveImport) {
    const importBlockRe = /(import\s*\{)([^}]*)(\}\s*from\s*['"]lucide-react['"])/s;
    const m = patched.match(importBlockRe);
    if (!m) {
      return { ok: false, error: 'Patch A falhou: não achei import de lucide-react' };
    }
    const inner = m[2];
    // Adiciona ", FileArchive" antes do fechamento (preserva indentação)
    const trimmed = inner.replace(/,\s*$/, '');
    const newInner = trimmed + (trimmed.trim().endsWith(',') ? ' FileArchive,' : ', FileArchive,');
    patched = patched.replace(importBlockRe, `$1${newInner}$3`);
    appliedA = true;
  }

  // Patch B — adicionar NavLink Backup após Configurações
  if (!hasBackupRoute) {
    const configLineRe = /(<NavLink\s+item=\{\{\s*label:\s*'Configurações'[^}]+\}\}\s+active=\{activeSection\s*===\s*'config'\}\s*\/>)/;
    const m = patched.match(configLineRe);
    if (!m) {
      return { ok: false, error: 'Patch B falhou: não achei NavLink de Configurações' };
    }
    const insertion = "\n                    <NavLink item={{ label: 'Backup', href: '/admin/backup', icon: FileArchive, section: 'backup' }} active={activeSection === 'backup'} />";
    patched = patched.replace(configLineRe, `$1${insertion}`);
    appliedB = true;
  }

  if (appliedA || appliedB) {
    await writeFile(path, patched, 'utf-8');
  }

  return { ok: true, patches: { A: appliedA ? 'applied' : 'already-present', B: appliedB ? 'applied' : 'already-present' } };
}

async function copyFiles(repo) {
  const conflicts = [];
  for (const { src, dst } of FILE_MAP) {
    if (await exists(join(repo, dst))) {
      // Já existe — só sobrescreve se for byte-idêntico (idempotência)
      const srcContent = await readFile(join(FILES_DIR, src), 'utf-8');
      const dstContent = await readFile(join(repo, dst), 'utf-8');
      if (srcContent !== dstContent) {
        conflicts.push(dst);
      }
    }
  }
  if (conflicts.length > 0) {
    return { ok: false, conflicts };
  }
  for (const { src, dst } of FILE_MAP) {
    const dstAbs = join(repo, dst);
    await mkdir(dirname(dstAbs), { recursive: true });
    await copyFile(join(FILES_DIR, src), dstAbs);
  }
  return { ok: true, count: FILE_MAP.length };
}

async function installDep(repo, pm) {
  const cmd = pm === 'npm' ? ['npm', ['install', 'jszip']] :
              pm === 'yarn' ? ['yarn', ['add', 'jszip']] :
              pm === 'pnpm' ? ['pnpm', ['add', 'jszip']] :
              ['bun', ['add', 'jszip']];
  const res = await runCmd(cmd[0], cmd[1], repo);
  return { ok: res.code === 0, code: res.code, stderr: res.stderr.slice(-500) };
}

async function buildRepo(repo, pm) {
  const cmd = pm === 'npm' ? ['npm', ['run', 'build']] :
              pm === 'yarn' ? ['yarn', ['build']] :
              pm === 'pnpm' ? ['pnpm', ['run', 'build']] :
              ['bun', ['run', 'build']];
  const res = await runCmd(cmd[0], cmd[1], repo);
  return { ok: res.code === 0, code: res.code, stderr: res.stderr.slice(-1000) };
}

async function main() {
  const repoArg = process.argv[2];
  if (!repoArg) {
    process.stderr.write('Usage: node apply.mjs <repoPath>\n');
    process.exit(2);
  }
  const repo = resolve(repoArg);
  const result = { repo, success: false, steps: {} };

  // 1. Pré-reqs
  log('info', 'checking prereqs', { repo });
  const pre = await checkPrereqs(repo);
  result.steps.prereqs = pre;
  if (!pre.ok) {
    log('error', 'prereqs failed', pre);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }

  const pm = pre.pm;
  log('info', `package manager: ${pm}`);

  // 2. Install jszip
  log('info', 'installing jszip');
  const dep = await installDep(repo, pm);
  result.steps.installDep = dep;
  if (!dep.ok) {
    log('error', 'install failed', dep);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }

  // 3. Copy files
  log('info', 'copying files');
  const copy = await copyFiles(repo);
  result.steps.copyFiles = copy;
  if (!copy.ok) {
    log('error', 'file conflicts detected', copy);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }

  // 4. Patch AdminNav
  log('info', 'patching AdminNav');
  const patch = await patchAdminNav(repo);
  result.steps.patchAdminNav = patch;
  if (!patch.ok) {
    log('error', 'patch failed', patch);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }

  // 5. Build
  log('info', 'running build');
  const build = await buildRepo(repo, pm);
  result.steps.build = { ok: build.ok, code: build.code };
  if (!build.ok) {
    log('error', 'build failed', build);
    result.steps.build.stderr_tail = build.stderr;
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
