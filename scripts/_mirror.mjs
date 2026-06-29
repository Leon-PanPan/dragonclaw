#!/usr/bin/env node
/**
 * scripts/_mirror.mjs
 *
 * Shared mirror-detection logic for `electron-builder`'s binary downloads.
 *
 * Why this exists
 * ---------------
 * `electron-builder` packs the Electron runtime by downloading a fresh
 * Electron zip from `app-builder-bin` (its Go core). The URL defaults to
 * GitHub Releases:
 *
 *   https://github.com/electron/electron/releases/download/v<VER>/<FILE>
 *
 * On networks that can't reach GitHub (or are throttled by it) this hangs
 * for 5-10 minutes and ultimately fails. `app-builder-bin` honours two
 * environment variables (confirmed by `strings` on the binary):
 *
 *   * ELECTRON_BUILDER_BINARIES_MIRROR
 *   * NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR
 *
 * When set, the URL pattern switches to `<MIRROR>/v<VER>/<FILE>`. We pick
 * the fastest reachable mirror via a quick TCP-handshake probe and inject
 * the env var into the child process.
 *
 * Two usage modes
 * ---------------
 *
 * 1. As a CLI shim (used by `package.json` scripts like `build:win`):
 *
 *      node scripts/_mirror.mjs -- electron-builder --win
 *      node scripts/_mirror.mjs --github-only -- electron-builder --linux deb
 *
 *    The script resolves the mirror, prints a one-line log, then `spawn`s
 *    the rest of the argv (everything after `--`) with the env var set.
 *
 * 2. As a library (used by `scripts/build-all.mjs`):
 *
 *      import { applyBuilderMirror } from './_mirror.mjs';
 *      const m = await applyBuilderMirror({ noMirrorDetect: false });
 *      const extraEnv = m.url ? { ELECTRON_BUILDER_BINARIES_MIRROR: m.url } : null;
 *
 * Exit codes
 * ----------
 *   0  mirror resolved (or fallback to default); child exited 0
 *   1  child process failed (propagated)
 *   2  precondition failure (no command after `--`, spawn error)
 *
 * Environment
 * -----------
 *   ELECTRON_BUILDER_BINARIES_MIRROR
 *       Pin a specific mirror (skips the RTT probe).
 */

import net from 'net';
import { spawn } from 'child_process';
import process from 'process';

const COL = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};
const TAG = `${COL.cyan}[mirror]${COL.reset}`;
const ok   = (m) => console.log(`${TAG} ${COL.green}\u2713${COL.reset} ${m}`);
const info = (m) => console.log(`${TAG} ${m}`);
const warn = (m) => console.warn(`${TAG} ${COL.yellow}!${COL.reset} ${m}`);

// ---------------------------------------------------------------------------
// Mirror catalogue. We keep this deliberately small: only mirrors whose
// path layout matches the official `app-builder-bin` URL template
// `<MIRROR>/v<VER>/<FILE>`. Tested working with electron-builder 24+.
// ---------------------------------------------------------------------------
export const BUILDER_MIRRORS = [
  // npmmirror.com mirrors the full electron release set and is fast from
  // mainland China. Path layout matches the GitHub layout with a `v` prefix.
  { id: 'npmmirror', url: 'https://npmmirror.com/mirrors/electron',
    note: 'Mainland-China-friendly CDN, no rate limit.' },
  // Official GitHub Releases. Fast in most non-CN regions.
  { id: 'github',    url: 'https://github.com/electron/electron/releases/download',
    note: 'Official GitHub Releases. Fast in most non-CN regions.' },
];

// ---------------------------------------------------------------------------
// Probe a mirror by its TCP-handshake RTT.
// We deliberately do NOT do an HTTPS GET: from some networks (mainland
// China in particular) the TLS layer hangs indefinitely even when the
// host is reachable, and `app-builder-bin` itself will fail the same way.
// A successful TCP handshake is therefore a *necessary* condition for the
// mirror to be usable, even if not sufficient.
// ---------------------------------------------------------------------------
export async function probeMirrorRtt(mirror) {
  const u = new URL(mirror.url);
  return new Promise((resolve) => {
    const t0 = Date.now();
    const sock = net.connect({
      host: u.hostname,
      port: u.port || 443,
      family: 4, // force IPv4 — most predictable across dual-stack networks
    });
    const timer = setTimeout(() => { sock.destroy(); resolve(Infinity); }, 2500);
    sock.once('connect', () => { clearTimeout(timer); sock.destroy(); resolve(Date.now() - t0); });
    sock.once('error',   () => { clearTimeout(timer); sock.destroy(); resolve(Infinity); });
  });
}

async function rankBuilderMirrors() {
  const ranked = await Promise.all(
    BUILDER_MIRRORS.map(async (m) => ({ mirror: m, rtt: await probeMirrorRtt(m) }))
  );
  return ranked.sort((a, b) => a.rtt - b.rtt).map((r) => r.mirror);
}

// ---------------------------------------------------------------------------
// Main resolver. Returns { url, source } where:
//   - url    : the chosen mirror URL, or null if user wants the default (GitHub)
//   - source : 'env' | 'github' | 'npmmirror' | 'default'
// ---------------------------------------------------------------------------
export async function resolveBuilderMirror({ noMirrorDetect = false, githubOnly = false } = {}) {
  // 1. Honour explicit user override (env var or command line).
  const explicit = process.env.ELECTRON_BUILDER_BINARIES_MIRROR;
  if (explicit && explicit.trim() !== '') {
    ok(`using pinned electron-builder mirror: ${explicit}`);
    return { url: explicit.trim(), source: 'env' };
  }
  // 2. --github-only: force the upstream GitHub Releases path. Useful when
  //    building targets that need auxiliary tools (e.g. fpm for .deb/.rpm)
  //    that the third-party mirror does not host.
  if (githubOnly) {
    ok(`forcing GitHub Releases (--github-only): ${COL.dim}https://github.com/electron/electron/releases/download${COL.reset}`);
    return {
      url: 'https://github.com/electron/electron/releases/download',
      source: 'github',
    };
  }
  if (noMirrorDetect) {
    info(`${COL.dim}--no-mirror-detect: skipping probe, electron-builder will use the default (GitHub)${COL.reset}`);
    return { url: null, source: 'default' };
  }
  // 3. Probe and pick.
  info('probing electron-builder mirror reachability\u2026');
  const ranked = await rankBuilderMirrors();
  const summary = ranked
    .map((m) => `${m.id}${m.rtt === Infinity ? ' (timeout)' : ` (${m.rtt}ms)`}`)
    .join(' \u2192 ');
  info(`  \u21b3 mirror order: ${summary}`);
  const winner = ranked[0];
  if (!winner || winner.rtt === Infinity) {
    warn('all mirrors timed out \u2014 falling back to the default (GitHub). If you are behind a firewall, set ELECTRON_BUILDER_BINARIES_MIRROR=\u2026 manually.');
    return { url: null, source: 'default' };
  }
  return { url: winner.url, source: winner.id };
}

// ---------------------------------------------------------------------------
// Resolve + mutate process.env so the next child process inherits it.
// Library-style entry point for build-all.mjs.
// ---------------------------------------------------------------------------
export async function applyBuilderMirror({ noMirrorDetect = false, githubOnly = false } = {}) {
  const mirror = await resolveBuilderMirror({ noMirrorDetect, githubOnly });
  if (mirror.url) {
    process.env.ELECTRON_BUILDER_BINARIES_MIRROR = mirror.url;
    // Also set the NPM_CONFIG_ variant — app-builder-bin accepts both,
    // and on some setups one or the other is picked up depending on how
    // the binary is launched.
    process.env.NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR = mirror.url;
  }
  return mirror;
}

// ---------------------------------------------------------------------------
// CLI entry: `node scripts/_mirror.mjs -- <cmd> [args...]`
// ---------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const sepIdx = argv.indexOf('--');
  const cliArgs = sepIdx >= 0 ? argv.slice(sepIdx + 1) : [];
  const noMirrorDetect = argv.includes('--no-mirror-detect');
  const githubOnly = argv.includes('--github-only');

  if (cliArgs.length === 0) {
    warn('usage: node scripts/_mirror.mjs [--no-mirror-detect | --github-only] -- <cmd> [args...]');
    process.exit(2);
  }

  await applyBuilderMirror({ noMirrorDetect, githubOnly });

  const child = spawn(cliArgs[0], cliArgs.slice(1), {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('error', (e) => {
    warn(`failed to spawn ${cliArgs[0]}: ${e.message}`);
    process.exit(2);
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code === null ? 1 : code);
    }
  });
}

// Only run main() when this file is the program entry, not when imported.
const isEntry = import.meta.url === `file://${process.argv[1]}`;
if (isEntry) {
  main().catch((e) => {
    warn(e.stack || e.message);
    process.exit(2);
  });
}
