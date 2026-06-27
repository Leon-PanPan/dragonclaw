#!/usr/bin/env node
/**
 * DragonClaw postinstall script.
 *
 * Why this exists
 * ---------------
 * `electron` is shipped as an npm package whose `postinstall` script
 * downloads a prebuilt Electron binary from GitHub Releases and unzips it
 * into `node_modules/.../electron/dist/`. The official script is great on
 * a fast link to GitHub, but it (a) has no mirror fallback, (b) has a 6+
 * minute default timeout, and (c) leaves the entire `pnpm install` in a
 * broken state if it fails (no `path.txt` is written, so `require('electron')`
 * later throws "Electron failed to install correctly").
 *
 * This script takes over that responsibility so that:
 *   1. The download cannot block `pnpm install` for 6+ minutes.
 *   2. Users behind slow / blocked GitHub links (e.g. mainland China) can
 *      install successfully via a mirror.
 *   3. The Electron binary is always left in a consistent, runnable state
 *      (or a clear, actionable error is shown).
 *
 * What it does
 * ------------
 * For every `electron@<version>` package on disk under
 * `node_modules/.pnpm/electron@<version>/node_modules/electron/`, it:
 *   1. Detects the host platform/arch (darwin-arm64, win32-x64, linux-x64…).
 *   2. If the binary is already in place, it no-ops.
 *   3. Otherwise, it downloads the matching zip from one of the configured
 *      mirrors (with retries), verifies its SHA-256 against
 *      `checksums.json`, unzips it into `dist/`, and writes `path.txt`.
 *
 * Failure handling
 * ----------------
 * If every mirror fails the script prints a clear, actionable error and
 * exits 0. We do NOT want a transient network problem to make the
 * developer's `pnpm install` fail: the Electron binary is only needed at
 * runtime (to start the app), and the user can retry later. CI consumers
 * that need the binary should pre-populate the cache.
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, createWriteStream, createReadStream, writeFileSync, readFileSync, chmodSync, statSync, rmSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const PLATFORM = process.platform;          // 'darwin' | 'win32' | 'linux' | ...
const RAW_ARCH = process.arch;              // 'arm64' | 'x64' | 'ia32' | ...
// macOS under Rosetta 2 reports arch=x64 — detect & upgrade to arm64.
const ARCH = (PLATFORM === 'darwin' && RAW_ARCH === 'x64' && process.env.npm_config_arch === undefined)
  ? (await isRosetta() ? 'arm64' : 'x64')
  : RAW_ARCH;

const ELECTRON_PKG_NAME = 'electron';
// Skip-download env var: when set, even our own downloader is bypassed.
// This matches the official `electron` install.js contract.
const SKIP_DOWNLOAD = !!process.env.ELECTRON_SKIP_BINARY_DOWNLOAD;
// Hard opt-out for users who only want a fast `pnpm install` (e.g. CI
// matrix builds that don't need to run the desktop app at install time).
const HARD_SKIP = !!process.env.DRAGONCLAW_SKIP_ELECTRON;

const HEADERS = { 'User-Agent': 'dragonclaw-postinstall' };
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;        // hard cap per attempt
const MAX_RETRIES_PER_MIRROR = 3;

// ---------------------------------------------------------------------------
// Pretty printing
// ---------------------------------------------------------------------------
const TAG = '\x1b[36m[postinstall]\x1b[0m';
function info(msg)  { console.log(`${TAG} ${msg}`); }
function warn(msg)  { console.warn(`${TAG} \x1b[33m${msg}\x1b[0m`); }
function error(msg) { console.error(`${TAG} \x1b[31m${msg}\x1b[0m`); }

// ---------------------------------------------------------------------------
// Locate all installed `electron@<version>` directories on disk.
// ---------------------------------------------------------------------------
function findElectronDirs() {
  const pnpmDir = join(ROOT, 'node_modules', '.pnpm');
  if (!existsSync(pnpmDir)) return [];
  const dirs = [];
  for (const entry of readdirSync(pnpmDir)) {
    const m = entry.match(/^electron@([^_]+)(?:\(.+\))?$/);
    if (!m) continue;
    const electronDir = join(pnpmDir, entry, 'node_modules', ELECTRON_PKG_NAME);
    if (existsSync(join(electronDir, 'package.json'))) {
      dirs.push({ version: m[1], dir: electronDir });
    }
  }
  return dirs;
}

// ---------------------------------------------------------------------------
// Map (platform, arch) to the Electron release artifact name & executable.
// Mirrors `getPlatformPath()` in electron's own `install.js`.
// ---------------------------------------------------------------------------
function resolveArtifact(version) {
  const map = {
    'darwin-arm64': { zip: `electron-v${version}-darwin-arm64.zip`, exec: 'Electron.app/Contents/MacOS/Electron' },
    'darwin-x64':   { zip: `electron-v${version}-darwin-x64.zip`,   exec: 'Electron.app/Contents/MacOS/Electron' },
    'mas-arm64':    { zip: `electron-v${version}-mas-arm64.zip`,    exec: 'Electron.app/Contents/MacOS/Electron' },
    'mas-x64':      { zip: `electron-v${version}-mas-x64.zip`,      exec: 'Electron.app/Contents/MacOS/Electron' },
    'linux-x64':    { zip: `electron-v${version}-linux-x64.zip`,    exec: 'electron' },
    'linux-arm64':  { zip: `electron-v${version}-linux-arm64.zip`,  exec: 'electron' },
    'linux-armv7l': { zip: `electron-v${version}-linux-armv7l.zip`, exec: 'electron' },
    'win32-x64':    { zip: `electron-v${version}-win32-x64.zip`,    exec: 'electron.exe' },
    'win32-ia32':   { zip: `electron-v${version}-win32-ia32.zip`,   exec: 'electron.exe' },
    'win32-arm64':  { zip: `electron-v${version}-win32-arm64.zip`,  exec: 'electron.exe' },
  };
  const key = `${PLATFORM}-${ARCH}`;
  if (!map[key]) {
    throw new Error(
      `DragonClaw does not have a prebuilt Electron binary for ${key}. ` +
      `Supported platforms: ${Object.keys(map).join(', ')}.`
    );
  }
  return map[key];
}

// ---------------------------------------------------------------------------
// Mirror catalogue. `probe` is the URL we hit with a small HEAD/GET to
// measure RTT (and reachability) before committing to a 110 MiB download.
// ---------------------------------------------------------------------------
const MIRRORS = [
  {
    id: 'npmmirror',
    probe: 'https://npmmirror.com/',
    build: (v, z) => `https://npmmirror.com/mirrors/electron/${v}/${z}`,
    note: 'Mainland-China-friendly CDN, no rate limit.',
  },
  {
    id: 'github',
    probe: 'https://github.com/',
    build: (v, z) => `https://github.com/electron/electron/releases/download/v${v}/${z}`,
    note: 'Official GitHub Releases. Fast in most non-CN regions.',
  },
  {
    id: 'gh-proxy',
    probe: 'https://gh-proxy.com/',
    build: (v, z) => `https://gh-proxy.com/https://github.com/electron/electron/releases/download/v${v}/${z}`,
    note: 'Reverse proxy that fronts GitHub Releases. Free public mirror.',
  },
];

// ---------------------------------------------------------------------------
// Pick the fastest reachable mirror. We don't rely on GeoIP (privacy, extra
// network call, brittle) — instead we race a tiny GET against every mirror's
// landing page and rank by RTT. The whole probe costs ~2s in the worst case
// and 0s on a fast LAN.
// ---------------------------------------------------------------------------
async function rankMirrors() {
  const TIMEOUT_MS = 2500;
  const results = await Promise.all(MIRRORS.map(async (m) => {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      // We use GET against the probe URL and discard the body as soon as
      // headers arrive. The CDN landing page returns a small HTML payload.
      const res = await fetch(m.probe, { method: 'GET', headers: HEADERS, signal: ctrl.signal });
      // Drain just enough to release the socket; we don't care about the body.
      res.body?.destroy?.();
      clearTimeout(timer);
      if (!res.ok && res.status !== 304) throw new Error(`HTTP ${res.status}`);
      return { mirror: m, rtt: Date.now() - t0 };
    } catch {
      return { mirror: m, rtt: Infinity };
    }
  }));
  // Stable sort: lowest RTT first, unknowns last. Preserves the catalog
  // order among ties (npmmirror wins over github on equal RTT, which is the
  // right bias for the slow-link case).
  return results
    .sort((a, b) => a.rtt - b.rtt)
    .map((r) => r.mirror);
}

function mirrorUrls(version, zipName, ranking) {
  const override = process.env.DRAGONCLAW_ELECTRON_MIRROR;
  if (override) {
    const filtered = ranking.filter((m) => m.id === override);
    if (filtered.length) return filtered.map((m) => m.build(version, zipName));
  }
  return ranking.map((m) => m.build(version, zipName));
}

// ---------------------------------------------------------------------------
// Already installed? Mirrors the check in `install.js`.
// ---------------------------------------------------------------------------
function isAlreadyInstalled(electronDir, version, execRel) {
  const distDir = join(electronDir, 'dist');
  const versionFile = join(distDir, 'version');
  const pathFile = join(electronDir, 'path.txt');
  if (!existsSync(versionFile) || !existsSync(pathFile)) return false;
  const installedVersion = readFileSync(versionFile, 'utf-8').replace(/^v/, '').trim();
  if (installedVersion !== version) return false;
  if (readFileSync(pathFile, 'utf-8').trim() !== execRel) return false;
  return existsSync(join(distDir, execRel));
}

// ---------------------------------------------------------------------------
// Download with redirect-following, timeout, and progress.
// ---------------------------------------------------------------------------
async function downloadToFile(url, destPath, label) {
  await pipeline(
    (await fetchWithRedirects(url, label)),
    createWriteStream(destPath)
  );
}

async function fetchWithRedirects(url, label) {
  const { Readable } = await import('stream');
  let current = url;
  let hops = 0;
  while (true) {
    hops++;
    if (hops > 8) throw new Error(`too many redirects for ${label} (${url})`);
    const res = await fetchWithTimeout(current, label);
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      const next = new URL(res.headers.location, current).toString();
      res.body?.destroy?.();
      info(`  → redirect (${res.status}) to ${next}`);
      current = next;
      continue;
    }
    if (!res.ok) {
      res.body?.destroy?.();
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${label}`);
    }
    return Readable.fromWeb(res.body);
  }
}

function fetchWithTimeout(url, label) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS);
  return fetch(url, { headers: HEADERS, signal: ctrl.signal })
    .catch((err) => {
      if (err.name === 'AbortError') throw new Error(`timeout after ${DOWNLOAD_TIMEOUT_MS / 1000}s for ${label}`);
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// SHA-256 verification against `checksums.json` shipped with `electron`.
// ---------------------------------------------------------------------------
function loadExpectedChecksum(electronDir, zipName) {
  const checksumsPath = join(electronDir, 'checksums.json');
  if (!existsSync(checksumsPath)) return null;
  try {
    const data = JSON.parse(readFileSync(checksumsPath, 'utf-8'));
    return data[zipName] || null;
  } catch {
    return null;
  }
}

function sha256OfFile(path) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(path)
      .on('data', (chunk) => h.update(chunk))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Pure-Node ZIP extractor. Electron ships a `*.zip`; we cannot rely on
// `unzip` being installed (especially on Windows), and adding a runtime
// dep defeats the purpose of this script. We use the streaming
// End-of-central-directory record to find the central directory, then
// parse each entry header. Deflate is the only compression mode used by
// Electron's zips.
// ---------------------------------------------------------------------------
async function extractZip(zipPath, outDir) {
  const { symlinkSync, unlinkSync } = await import('fs');
  const buf = readFileSync(zipPath);
  // EOCD signature: 0x06054b50, located in the last 64KiB+22 bytes.
  let eocdOffset = -1;
  const scanStart = Math.max(0, buf.length - 0xFFFF - 22);
  for (let i = buf.length - 22; i >= scanStart; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) throw new Error('invalid zip: EOCD not found');
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdStart = buf.readUInt32LE(eocdOffset + 16);

  let p = cdStart;
  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('invalid zip: bad central dir entry');
    const cdEntry = p;
    const compMethod = buf.readUInt16LE(p + 10);
    const compSize   = buf.readUInt32LE(p + 20);
    const uncSize    = buf.readUInt32LE(p + 24);
    const nameLen    = buf.readUInt16LE(p + 28);
    const extraLen   = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff   = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf-8');
    p += 46 + nameLen + extraLen + commentLen;

    // Parse local file header for actual data offset.
    if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error('invalid zip: bad local header');
    const lNameLen  = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const data = buf.slice(dataStart, dataStart + compSize);

    if (name.endsWith('/')) {
      mkdirSync(join(outDir, name), { recursive: true });
      continue;
    }
    const outPath = join(outDir, name);
    mkdirSync(dirname(outPath), { recursive: true });

    // Resolve the entry's Unix mode. Prefer the local-header extra field
    // (header id 0x000d, "UNIX", 12 bytes starting with "tAtime" then UID
    // GID then mode). Fall back to the central directory's upper 16 bits
    // of the external attributes (which is the Unix mode for entries made
    // by Info-ZIP / `ditto` / macOS Archive Utility).
    const unixMode = readUnixMode(buf, localOff, lNameLen, lExtraLen, cdEntry, extraLen);

    // Symlinks in macOS frameworks are stored as zero-byte-or-tiny files
    // with mode 0o120000 — we must reconstruct the symlink, not write
    // the link target as a regular file (which is what bit us before).
    if ((unixMode & 0o170000) === 0o120000) {
      if (existsSync(outPath)) {
        try { unlinkSync(outPath); } catch {}
      }
      const target = data.toString('utf-8');
      try {
        symlinkSync(target, outPath);
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
      continue;
    }

    let payload;
    if (compMethod === 0) {
      payload = data;
    } else if (compMethod === 8) {
      payload = zlib.inflateRawSync(data, { maxOutputLength: uncSize });
    } else {
      throw new Error(`unsupported zip compression method: ${compMethod}`);
    }
    writeFileSync(outPath, payload);
    if (unixMode && (unixMode & 0o100) && (unixMode & 0o111)) {
      try { chmodSync(outPath, unixMode & 0o7777); } catch {}
    }
  }
}

// Read a zip entry's Unix mode. Returns 0 on failure (caller treats 0 as
// "not executable / not a symlink"). Tries local-header extra field first
// because the central directory only stores the upper 16 bits and loses
// the file-type bits on some producers.
function readUnixMode(buf, localOff, lNameLen, lExtraLen, cdP, cdExtraLen) {
  // Local extra: walk header-id 0x000d blocks.
  let q = localOff + 30 + lNameLen;
  const lEnd = q + lExtraLen;
  while (q + 4 <= lEnd) {
    const hid = buf.readUInt16LE(q);
    const hsz = buf.readUInt16LE(q + 2);
    if (hid === 0x000d && hsz >= 12) {
      return buf.readUInt16LE(q + 10); // mode at offset 10 within the UNIX block
    }
    q += 4 + hsz;
  }
  // Central directory fallback: upper 16 bits of external file attributes
  // are the Unix mode for entries with version-made-by's host = UNIX (3).
  return (buf.readUInt32LE(cdP + 38) >>> 16) & 0xffff;
}

// ---------------------------------------------------------------------------
// Detect macOS Rosetta 2 translation.
// ---------------------------------------------------------------------------
async function isRosetta() {
  if (PLATFORM !== 'darwin' || RAW_ARCH !== 'x64') return false;
  return new Promise((resolve) => {
    execFile('sysctl', ['-in', 'sysctl.proc_translated'], (err, stdout) => {
      resolve(!err && String(stdout).trim() === '1');
    });
  });
}

// ---------------------------------------------------------------------------
// Strip macOS quarantine / provenance xattrs. Both `xattr` and `xattr -dr`
// are built-in to macOS (no extra dependency). We swallow errors so the
// install still completes on locked-down CI runners where `xattr` is absent.
// ---------------------------------------------------------------------------
function stripQuarantine(distDir) {
  return new Promise((resolve) => {
    execFile('xattr', ['-dr', 'com.apple.quarantine', distDir], () => {
      execFile('xattr', ['-dr', 'com.apple.provenance', distDir], () => resolve());
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function installForOne({ version, dir }, ranking = MIRRORS) {
  const { exec } = resolveArtifact(version);
  if (isAlreadyInstalled(dir, version, exec)) {
    info(`electron@${version} (${PLATFORM}-${ARCH}) — already installed, skipping.`);
    return true;
  }
  if (SKIP_DOWNLOAD) {
    warn(`electron@${version} (${PLATFORM}-${ARCH}) — ELECTRON_SKIP_BINARY_DOWNLOAD is set, skipping.`);
    return false;
  }

  const { zip } = resolveArtifact(version);
  const expectedSha = loadExpectedChecksum(dir, zip);

  const cacheRoot = process.env.ELECTRON_CACHE_DIR
    || join(process.env.HOME || process.env.USERPROFILE || ROOT, '.cache', 'electron');
  const cacheDir = join(cacheRoot, version);
  mkdirSync(cacheDir, { recursive: true });
  const cachedZip = join(cacheDir, zip);

  let downloaded = false;
  if (existsSync(cachedZip)) {
    if (expectedSha) {
      const actual = await sha256OfFile(cachedZip);
      if (actual === expectedSha) {
        info(`electron@${version} — using cached ${zip}`);
        downloaded = true;
      } else {
        warn(`Cached ${zip} has mismatched SHA, re-downloading.`);
        rmSync(cachedZip);
      }
    } else {
      info(`electron@${version} — using cached ${zip} (no checksum to verify against)`);
      downloaded = true;
    }
  }

  if (!downloaded) {
    const urls = mirrorUrls(version, zip, ranking);
    let lastErr = null;
    for (const url of urls) {
      for (let attempt = 1; attempt <= MAX_RETRIES_PER_MIRROR; attempt++) {
        try {
          info(`electron@${version} — downloading (${attempt}/${MAX_RETRIES_PER_MIRROR}) ${url}`);
          const t0 = Date.now();
          await downloadToFile(url, cachedZip, zip);
          const dt = ((Date.now() - t0) / 1000).toFixed(1);
          const sz = (statSync(cachedZip).size / 1024 / 1024).toFixed(1);
          info(`  ↳ ${sz} MiB in ${dt}s`);
          downloaded = true;
          break;
        } catch (e) {
          lastErr = e;
          warn(`  ↳ attempt failed: ${e.message}`);
        }
      }
      if (downloaded) break;
    }
    if (!downloaded) {
      throw new Error(
        `failed to download electron@${version} from any mirror: ${lastErr?.message || 'unknown error'}`
      );
    }

    if (expectedSha) {
      const actual = await sha256OfFile(cachedZip);
      if (actual !== expectedSha) {
        rmSync(cachedZip);
        throw new Error(`SHA-256 mismatch for ${zip}: expected ${expectedSha}, got ${actual}`);
      }
      info(`  ↳ SHA-256 verified`);
    } else {
      warn(`  ↳ no checksum entry in checksums.json; skipping integrity check`);
    }
  }

  info(`electron@${version} — extracting…`);
  const distDir = join(dir, 'dist');
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  await extractZip(cachedZip, distDir);

  writeFileSync(join(distDir, 'version'), version);
  writeFileSync(join(dir, 'path.txt'), exec);
  // On Linux/macOS, the binary needs the executable bit. The zip preserves
  // external attrs on most platforms, but we set it explicitly to be safe.
  if (exec === 'electron') {
    const bin = join(distDir, exec);
    if (existsSync(bin)) chmodSync(bin, 0o755);
  }
  if (exec === 'Electron.app/Contents/MacOS/Electron') {
    const bin = join(distDir, 'Electron.app/Contents/MacOS/Electron');
    if (existsSync(bin)) chmodSync(bin, 0o755);
  }

  // macOS: strip the `com.apple.quarantine` and `com.apple.provenance`
  // extended attributes that browsers and macOS itself attach to anything
  // downloaded from the network. Without this, dyld refuses to load the
  // embedded `Electron Framework.framework` with "slice is not valid
  // mach-o file" and the app SIGABRTs on launch. Linux/Windows are no-ops.
  if (PLATFORM === 'darwin') {
    await stripQuarantine(distDir);
  }

  info(`electron@${version} (${PLATFORM}-${ARCH}) ✓`);
  return true;
}

async function main() {
  if (HARD_SKIP) {
    info('DRAGONCLAW_SKIP_ELECTRON is set, skipping electron binary installation.');
    return;
  }
  const dirs = findElectronDirs();
  if (dirs.length === 0) {
    info('no electron package found, nothing to do.');
    return;
  }
  info(`found ${dirs.length} electron installation(s); target platform = ${PLATFORM}-${ARCH}`);

  // Decide which mirror to prefer. We only do the latency probe when at
  // least one electron version actually needs a download — otherwise the
  // install is a no-op for us and the probe is wasted.
  const needsDownload = dirs.some((d) => !isAlreadyInstalled(
    d.dir, d.version, resolveArtifact(d.version).exec
  ));
  let ranking = MIRRORS;
  if (needsDownload) {
    if (process.env.DRAGONCLAW_ELECTRON_MIRROR) {
      info(`using pinned mirror: ${process.env.DRAGONCLAW_ELECTRON_MIRROR}`);
    } else {
      info('probing mirror reachability (skip with DRAGONCLAW_ELECTRON_MIRROR=…)…');
      ranking = await rankMirrors();
      const summary = ranking
        .map((m) => `${m.id}${m.note ? ` (${m.note})` : ''}`)
        .join(' → ');
      info(`  ↳ mirror order: ${summary}`);
    }
  }

  let hadError = false;
  for (const entry of dirs) {
    try {
      await installForOne(entry, ranking);
    } catch (e) {
      hadError = true;
      error(`electron@${entry.version} installation failed: ${e.message}`);
      error(`  • you can retry with: node scripts/postinstall.mjs`);
      error(`  • or set DRAGONCLAW_SKIP_ELECTRON=1 to install deps only`);
      error(`  • the app cannot start until electron is downloaded.`);
    }
  }
  if (hadError) {
    // Exit 0 so transient network failures don't break pnpm install.
    // The error is already on stderr for the developer / CI to see.
  }
}

main().catch((e) => {
  error(e.stack || e.message);
});
