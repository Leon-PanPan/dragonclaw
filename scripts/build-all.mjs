#!/usr/bin/env node
/**
 * scripts/build-all.mjs
 *
 * One-shot "ship every artifact we can build on this host" driver.
 *
 * Why this exists
 * ---------------
 * `electron-builder` cannot cross-compile: a Windows MSI must be made on
 * Windows, a macOS DMG must be made on macOS, and Linux targets (AppImage /
 * deb) are most reliably produced on Linux. So the practical workflow is:
 *
 *   1. On macOS, build mac-arm64 + mac-x64 + mac-universal DMGs.
 *   2. On Linux, build linux-x64 + linux-arm64 AppImages and a deb.
 *   3. On Windows, build win-x64 NSIS installer.
 *
 * Running `pnpm run build:all` does the wrong thing (asks electron-builder
 * to build every target on the current host, which silently produces a
 * `linux` build on macOS but refuses to build `mac` on Linux, and always
 * forgets about per-architecture splitting). This script fixes that.
 *
 * Usage
 * -----
 *   node scripts/build-all.mjs                    # auto-detect host, build all viable targets
 *   node scripts/build-all.mjs --only=mac,linux   # restrict to a subset
 *   node scripts/build-all.mjs --skip=mac-universal
 *   node scripts/build-all.mjs --no-clean         # keep previous dist/ contents
 *   node scripts/build-all.mjs --dry-run          # print plan, do not invoke electron-builder
 *   node scripts/build-all.mjs --no-vite          # skip `pnpm run build` (use existing renderer/dist)
 *
 * Exit codes
 * ----------
 *   0  every selected target built successfully
 *   1  at least one target failed (the script keeps going for the others)
 *   2  precondition failure (no Node, no pnpm, missing renderer/dist when --no-vite)
 *
 * Outputs
 * -------
 *   The standard electron-builder `dist/` directory. A summary table with
 *   per-artifact size and path is printed at the end.
 */

import { spawn, spawnSync as nodeSpawnSync } from 'child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import { applyBuilderMirror } from './_mirror.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = resolve(__filename, '..');
const ROOT       = resolve(__dirname, '..');
const DIST       = join(ROOT, 'dist');
const RENDERER_DIST = join(ROOT, 'renderer', 'dist');

const HOST_OS   = process.platform;   // 'darwin' | 'linux' | 'win32'
const HOST_ARCH = process.arch;       // 'arm64' | 'x64' | ...

// ---------------------------------------------------------------------------
// Pretty printing
// ---------------------------------------------------------------------------
const COL = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};
const TAG = `${COL.cyan}[build-all]${COL.reset}`;
const ok   = (m) => console.log(`${TAG} ${COL.green}✓${COL.reset} ${m}`);
const info = (m) => console.log(`${TAG} ${m}`);
const warn = (m) => console.warn(`${TAG} ${COL.yellow}!${COL.reset} ${m}`);
const err  = (m) => console.error(`${TAG} ${COL.red}✗${COL.reset} ${m}`);

// ---------------------------------------------------------------------------
// Argument parsing (tiny, dependency-free)
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { only: null, skip: null, clean: true, dryRun: false, noVite: false, noMirrorDetect: false };
  for (const a of argv.slice(2)) {
    if (a === '--no-clean')   out.clean = false;
    else if (a === '--clean') out.clean = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--no-vite') out.noVite = true;
    else if (a === '--no-mirror-detect') out.noMirrorDetect = true;
    else if (a.startsWith('--only='))  out.only  = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--skip='))  out.skip  = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/build-all.mjs [options]

Options:
  --only=<id1,id2,...>   Only build the listed targets
  --skip=<id1,id2,...>   Skip the listed targets
  --no-clean             Keep existing dist/ contents before building
  --no-vite              Skip 'pnpm run build' (use existing renderer/dist)
  --no-mirror-detect     Skip mirror RTT probe (use GitHub unless ELECTRON_BUILDER_BINARIES_MIRROR is set)
  --dry-run              Print the plan, do not invoke electron-builder
  -h, --help             Show this help

Available target ids:
  mac-arm64, mac-x64, mac-universal
  linux-x64, linux-arm64, linux-x64-deb
  win-x64

Environment:
  ELECTRON_BUILDER_BINARIES_MIRROR
      Pin a specific mirror (skips the RTT probe). electron-builder will
      download electron binaries from <MIRROR>/v<VERSION>/<FILE>.
`);
      process.exit(0);
    } else {
      err(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Target catalogue. Each entry knows:
//   - id             used by --only / --skip
//   - os             the host OS required to build it
//   - label          human-friendly name shown in logs
//   - buildArgs      electron-builder CLI flags (everything after the
//                    `electron-builder` token, NOT including the project root)
//   - match          regex matched against the final filename in dist/ so we
//                    can report the produced artifact's size
// ---------------------------------------------------------------------------
const TARGETS = [
  {
    id: 'mac-arm64',
    os: 'darwin',
    label: 'macOS · Apple Silicon (M-series) DMG',
    buildArgs: ['--mac', 'dmg', '--arm64'],
    match: /^DragonClaw-.*-arm64\.dmg$/,
  },
  {
    id: 'mac-x64',
    os: 'darwin',
    label: 'macOS · Intel DMG',
    buildArgs: ['--mac', 'dmg', '--x64'],
    match: /^DragonClaw-.*-x64\.dmg$/,
  },
  {
    id: 'mac-universal',
    os: 'darwin',
    label: 'macOS · Universal (arm64 + x64) DMG',
    buildArgs: ['--mac', 'dmg', '--universal'],
    match: /^DragonClaw-.*-universal\.dmg$/,
  },
  {
    id: 'linux-x64',
    os: 'linux',
    label: 'Linux · x64 AppImage',
    buildArgs: ['--linux', 'AppImage', '--x64'],
    match: /^DragonClaw-.*-x64\.AppImage$/,
  },
  {
    id: 'linux-arm64',
    os: 'linux',
    label: 'Linux · arm64 AppImage',
    buildArgs: ['--linux', 'AppImage', '--arm64'],
    match: /^DragonClaw-.*-arm64\.AppImage$/,
  },
  {
    id: 'linux-x64-deb',
    os: 'linux',
    label: 'Linux · x64 .deb (Debian / Ubuntu)',
    buildArgs: ['--linux', 'deb', '--x64'],
    match: /^DragonClaw-.*-x64\.deb$/,
  },
  {
    id: 'win-x64',
    os: 'win32',
    label: 'Windows · x64 NSIS installer',
    buildArgs: ['--win', 'nsis', '--x64'],
    match: /^DragonClaw-.*-x64\.exe$/,
  },
];

// ---------------------------------------------------------------------------
// Sanity checks
// ---------------------------------------------------------------------------
function checkPreconditions({ noVite }) {
  // 1. Node (we are running, so it's there)
  // 2. pnpm on PATH
  if (!hasCommand('pnpm')) {
    err('pnpm is not on PATH. Install it: https://pnpm.io/installation');
    process.exit(2);
  }
  // 3. renderer/dist must exist unless we are about to rebuild it
  if (noVite && !existsSync(RENDERER_DIST)) {
    err(`renderer/dist is missing and --no-vite was set.\n` +
        `  Run \`pnpm run build\` once first, or drop --no-vite.`);
    process.exit(2);
  }
  // 4. package.json present
  if (!existsSync(join(ROOT, 'package.json'))) {
    err('package.json not found — script must be run from the project root.');
    process.exit(2);
  }
}

function hasCommand(cmd) {
  const isWin = HOST_OS === 'win32';
  const lookup = isWin ? 'where' : 'which';
  try {
    const r = nodeSpawnSync(lookup, [cmd], { stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Run a single command, streaming output if we're in a TTY-friendly mode.
// Returns the exit code (we never throw on non-zero — the caller decides).
// ---------------------------------------------------------------------------
function run(cmd, args, { cwd, extraEnv } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: cwd || ROOT,
      env: { ...process.env, ...(extraEnv || {}) },
      stdio: 'inherit',
    });
    child.on('error', (e) => {
      err(`failed to spawn ${cmd}: ${e.message}`);
      resolve(1);
    });
    child.on('exit', (code) => resolve(code === null ? 1 : code));
  });
}

// ---------------------------------------------------------------------------
// Plan: filter targets by host OS, --only, --skip.
// ---------------------------------------------------------------------------
function selectTargets({ only, skip }) {
  let pool = TARGETS.filter((t) => t.os === HOST_OS);
  if (only) {
    const set = new Set(only);
    pool = pool.filter((t) => set.has(t.id));
  }
  if (skip) {
    const set = new Set(skip);
    pool = pool.filter((t) => !set.has(t.id));
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Snapshot dist/ contents *before* a target build, so we can diff afterwards
// and report the artifact that this specific target produced.
// ---------------------------------------------------------------------------
function snapshotDist() {
  if (!existsSync(DIST)) return new Set();
  return new Set(readdirSync(DIST));
}

function newArtifactsSince(before) {
  if (!existsSync(DIST)) return [];
  const now = new Set(readdirSync(DIST));
  const out = [];
  for (const f of now) {
    if (before.has(f)) continue;
    out.push(join(DIST, f));
  }
  return out;
}

function findMatchingArtifact(after, match) {
  // `after` is a list of absolute paths; the matcher regex is written
  // against the basename, so compare against the filename only.
  for (const p of after) {
    const base = p.split(/[\\/]/).pop();
    if (match.test(base)) return p;
  }
  return null;
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB'];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// Mirror auto-detection lives in `scripts/_mirror.mjs` (shared with the
// `build:win` / `build:mac` / `build:linux` shim scripts in package.json).
// We just call it here and propagate the env var into every electron-builder
// invocation. The shim uses the same probe catalogue, so behaviour stays
// in sync whether the user invokes `pnpm run build:all` or one of the
// single-platform scripts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);

  // Dry-run: print the plan and exit. Skips ALL preconditions so the user
  // can run it on a clean checkout before installing deps.
  const targets = selectTargets(args);
  if (targets.length === 0) {
    warn('no targets to build on this host. Use --only=... to override.');
    process.exit(0);
  }

  info(`${COL.bold}host${COL.reset}=${HOST_OS}/${HOST_ARCH}  ${COL.bold}targets${COL.reset}=${targets.length}`);
  for (const t of targets) info(`  • ${t.id}  ${COL.dim}(${t.label})${COL.reset}`);

  if (args.dryRun) {
    info('dry-run requested, exiting before any build.');
    process.exit(0);
  }

  checkPreconditions({ noVite: args.noVite });

  // Optional: vite build once at the start (much faster than re-running it
  // per target — electron-builder also re-reads renderer/dist every time).
  if (!args.noVite) {
    info('rendering Vue app → renderer/dist  (pnpm run build)');
    const code = await run('pnpm', ['run', 'build']);
    if (code !== 0) {
      err(`vite build failed with exit code ${code}`);
      process.exit(code || 1);
    }
  } else {
    info('skipping vite build (--no-vite) — using existing renderer/dist');
  }

  // Optional: wipe dist/ before we begin.
  if (args.clean) {
    if (existsSync(DIST)) {
      info(`cleaning ${DIST}`);
      rmSync(DIST, { recursive: true, force: true });
    }
  }

  // Decide which electron-builder binary mirror to use. The probe lives in
  // `scripts/_mirror.mjs` (shared with build:win / build:mac / build:linux).
  const mirror = await applyBuilderMirror({ noMirrorDetect: args.noMirrorDetect });
  const extraEnv = mirror.url
    ? { ELECTRON_BUILDER_BINARIES_MIRROR: mirror.url }
    : null;

  // Build each target. Failures are non-fatal; we collect them.
  const results = [];
  for (const t of targets) {
    const before = snapshotDist();
    info(`${COL.bold}==> building ${t.id}${COL.reset}  ${COL.dim}(${t.label})${COL.reset}`);
    const code = await run(
      'npx',
      ['--no-install', 'electron-builder', ...t.buildArgs],
      { extraEnv }
    );
    const after = newArtifactsSince(before);
    const artifact = findMatchingArtifact(after, t.match);
    if (code === 0 && artifact) {
      const size = statSync(artifact).size;
      ok(`${t.id.padEnd(15)} → ${COL.dim}${artifact.replace(ROOT + '/', '')}${COL.reset}  (${fmtSize(size)})`);
      results.push({ id: t.id, status: 'ok', artifact, size });
    } else if (code === 0) {
      warn(`${t.id} exited 0 but no matching artifact was found in dist/`);
      results.push({ id: t.id, status: 'unknown', artifact: null, size: 0 });
    } else {
      err(`${t.id} failed (exit ${code})`);
      results.push({ id: t.id, status: 'failed', artifact: null, size: 0 });
    }
  }

  // Summary
  const okCount = results.filter((r) => r.status === 'ok').length;
  const failCount = results.filter((r) => r.status === 'failed').length;
  console.log('');
  info(`${COL.bold}summary${COL.reset}  ${COL.green}${okCount} ok${COL.reset}  ${failCount ? COL.red : COL.dim}${failCount} failed${COL.reset}`);
  if (okCount > 0) {
    console.log('');
    console.log(`  ${COL.bold}artifacts${COL.reset}`);
    for (const r of results.filter((r) => r.status === 'ok')) {
      const rel = r.artifact.replace(ROOT + '/', '');
      console.log(`    ${COL.green}•${COL.reset} ${rel.padEnd(48)} ${COL.dim}${fmtSize(r.size)}${COL.reset}`);
    }
  }

  if (failCount > 0) process.exit(1);
}

main().catch((e) => {
  err(e.stack || e.message);
  process.exit(2);
});
