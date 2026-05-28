#!/usr/bin/env node
/**
 * Migration: Categories schema { name, slug } + helpers canônicos
 *
 * O que faz:
 *  1. Migra src/data/categories.json de string[] para [{name, slug, description?}]
 *  2. Cria src/lib/categorySlug.ts (helper canônico)
 *  3. Cria src/lib/vercelJson.ts (helpers de sanitização)
 *  4. Substitui src/components/admin/CategoriesEditor.tsx (UI com 2 campos)
 *  5. Substitui src/pages/api/admin/categories/rename.ts (suporta novo schema)
 *  6. Cria src/pages/categoria/[slug].astro com matching flexível + órfãos
 *  7. Remove src/pages/categoria/[categoria].astro (legado) — se existir
 *  8. Roda build pra validar
 *
 * O que NÃO faz (intencional):
 *  - NÃO refatora os inline `cat.toLowerCase().replace(/[^a-z0-9]/g, '-')` espalhados
 *    em Header/Footer/Sidebar/SchemaMarkup/RelatedPosts/Section4Categories — esses
 *    são template-specific e divergem entre walker/TM/CB. Slugs auto-derivados
 *    continuam funcionando como fallback enquanto não tiverem slug customizado.
 *    Refator manual recomendado por template quando entrarem em mass-fix.
 *
 * USO:
 *   node apply.mjs <repoPath>
 *
 * Exit codes:
 *   0 — sucesso (mudanças aplicadas e build verde, ou já estava aplicado)
 *   1 — falha esperada (path não existe, schema incompatível, build quebrado)
 *   2 — usage error
 *
 * Idempotente: rodar 2x = mesmo resultado. NÃO commita.
 */

import { readFile, writeFile, copyFile, mkdir, access, unlink, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT_DIR = dirname(fileURLToPath(import.meta.url));
const FILES_DIR = join(KIT_DIR, 'files');

const FILE_MAP = [
  { src: 'categorySlug.ts',    dst: 'src/lib/categorySlug.ts',                              overwrite: false },
  { src: 'vercelJson.ts',      dst: 'src/lib/vercelJson.ts',                                overwrite: false },
  { src: 'CategoriesEditor.tsx', dst: 'src/components/admin/CategoriesEditor.tsx',          overwrite: true },
  { src: 'rename.ts',          dst: 'src/pages/api/admin/categories/rename.ts',             overwrite: true },
  { src: 'categoria-slug.astro', dst: 'src/pages/categoria/[slug].astro',                   overwrite: true },
];

const LEGACY_DELETE = ['src/pages/categoria/[categoria].astro'];

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

// Slugify igual ao do scaffold (NFD + replace acentos + kebab)
const ACCENT_MAP = {
  'á':'a','à':'a','ã':'a','â':'a','ä':'a',
  'é':'e','è':'e','ê':'e','ë':'e',
  'í':'i','ì':'i','î':'i','ï':'i',
  'ó':'o','ò':'o','õ':'o','ô':'o','ö':'o',
  'ú':'u','ù':'u','û':'u','ü':'u',
  'ç':'c','ñ':'n',
  'Á':'a','À':'a','Ã':'a','Â':'a','Ä':'a',
  'É':'e','È':'e','Ê':'e','Ë':'e',
  'Í':'i','Ì':'i','Î':'i','Ï':'i',
  'Ó':'o','Ò':'o','Õ':'o','Ô':'o','Ö':'o',
  'Ú':'u','Ù':'u','Û':'u','Ü':'u',
  'Ç':'c','Ñ':'n',
};
function slugify(s) {
  if (!s) return '';
  let out = '';
  for (const ch of String(s)) out += ACCENT_MAP[ch] || ch;
  return out.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function migrateCategoriesJson(repo) {
  const path = join(repo, 'src/data/categories.json');
  if (!(await exists(path))) {
    return { ok: true, status: 'no-file', note: 'categories.json não existe — pular' };
  }
  const raw = await readFile(path, 'utf-8');
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return { ok: false, error: 'categories.json inválido' }; }

  if (!Array.isArray(parsed)) return { ok: false, error: 'categories.json não é um array' };

  // Detecta schema
  const isNew = parsed.length === 0 || (typeof parsed[0] === 'object' && parsed[0] !== null && 'slug' in parsed[0]);
  if (isNew) {
    return { ok: true, status: 'already-migrated', count: parsed.length };
  }

  // Migra string[] → [{name, slug}]
  const migrated = [];
  const seen = new Set();
  for (const item of parsed) {
    if (typeof item !== 'string') continue;
    const name = item.trim();
    if (!name) continue;
    const slug = slugify(name);
    if (seen.has(slug)) continue;
    seen.add(slug);
    migrated.push({ name, slug });
  }
  await writeFile(path, JSON.stringify(migrated, null, 2), 'utf-8');
  return { ok: true, status: 'migrated', count: migrated.length };
}

async function copyKitFiles(repo) {
  const result = { created: [], overwritten: [], skipped: [] };
  for (const { src, dst, overwrite } of FILE_MAP) {
    const dstAbs = join(repo, dst);
    const alreadyExists = await exists(dstAbs);
    if (alreadyExists && !overwrite) {
      // Helper file que já existe: só sobrescreve se diferente (idempotência)
      const srcContent = await readFile(join(FILES_DIR, src), 'utf-8');
      const dstContent = await readFile(dstAbs, 'utf-8');
      if (srcContent === dstContent) {
        result.skipped.push(dst);
        continue;
      }
    }
    await mkdir(dirname(dstAbs), { recursive: true });
    await copyFile(join(FILES_DIR, src), dstAbs);
    if (alreadyExists) result.overwritten.push(dst);
    else result.created.push(dst);
  }
  return result;
}

async function removeLegacyFiles(repo) {
  const removed = [];
  for (const p of LEGACY_DELETE) {
    const full = join(repo, p);
    if (await exists(full)) {
      await unlink(full);
      removed.push(p);
    }
  }
  return { removed };
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
  // Pré-req: precisa ter o endpoint /api/admin/github (todos os MSIA têm)
  if (!(await exists(join(repo, 'src/pages/api/admin/github.ts')))) {
    result.steps.prereqs = { ok: false, error: 'src/pages/api/admin/github.ts não encontrado — não é MSIA' };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }
  const pm = await detectPM(repo);
  log('info', `package manager: ${pm}`);
  result.steps.prereqs = { ok: true, pm };

  log('info', 'migrating categories.json');
  const migration = await migrateCategoriesJson(repo);
  result.steps.migrateJson = migration;
  if (!migration.ok) {
    log('error', 'migration failed', migration);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }

  log('info', 'copying kit files');
  const copy = await copyKitFiles(repo);
  result.steps.copyFiles = { ok: true, ...copy };

  log('info', 'removing legacy files');
  const cleanup = await removeLegacyFiles(repo);
  result.steps.removeLegacy = cleanup;

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
