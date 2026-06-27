/**
 * Disk Cleanup Scanner — runs in a Worker thread.
 *
 * Strategy:
 *   1. Enumerate every root the host platform considers "user-visible"
 *      (home dir on macOS/Linux; user profile + all fixed volumes on Windows).
 *   2. Walk each tree in parallel with bounded concurrency. For each
 *      directory we read all dirents in one syscall, then stat() them
 *      concurrently. Any file ≥ MIN_SIZE is reported upstream.
 *   3. Hard caps prevent runaway scans: MAX_FILES_PER_SCAN, MAX_DEPTH,
 *      and per-root SKIP_DIRS to avoid system trees (/System,
 *      C:\Windows, /proc, /sys, package caches, etc.).
 *   4. Streaming: send `{type:'file', entry}` batches every BATCH_SIZE
 *      entries. UI receives files as they appear.
 *
 * Output messages:
 *   { type: 'started', roots, totalRoots }
 *   { type: 'progress', scannedFiles, scannedBytes, currentRoot, percent }
 *   { type: 'file', entry }     // entry = { id, path, name, size, mtime, ext, category, root }
 *   { type: 'root-done', root, scannedFiles }
 *   { type: 'done', scannedFiles, foundFiles, durationMs }
 *   { type: 'error', error }
 */

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const MIN_SIZE = 50 * 1024 * 1024;          // 50 MB — default threshold (other / document / package)
const MEDIA_MIN_SIZE = 5 * 1024 * 1024;     // 5 MB — videos, audio, photos (typical phone footage)
const MAX_DEPTH = 12;
const MAX_FILES_PER_SCAN = 200000;
const BATCH_SIZE = 200;
const DIR_CONCURRENCY = 8;                  // parallel readdir per directory
const STAT_CONCURRENCY = 64;                // parallel stat() calls

const { platform, homedir } = workerData;

const VIDEO_EXT = new Set(['mp4', 'mkv', 'mov', 'avi', 'wmv', 'flv', 'webm', 'm4v', 'mpeg', 'mpg', 'ts', 'rmvb', '3gp']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus', 'aiff']);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif', 'tiff', 'tif', 'raw', 'svg', 'psd', 'ai']);
const DOC_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'rtf', 'odt', 'ods', 'odp', 'csv', 'epub', 'mobi']);
const PKG_EXT = new Set(['dmg', 'pkg', 'iso', 'msi', 'exe', 'deb', 'rpm', 'apk', 'appimage', 'snap', 'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'whl']);

function classify(ext) {
  if (!ext) return 'other';
  const e = ext.toLowerCase().replace(/^\./, '');
  if (VIDEO_EXT.has(e)) return 'video';
  if (AUDIO_EXT.has(e)) return 'audio';
  if (IMAGE_EXT.has(e)) return 'image';
  if (DOC_EXT.has(e)) return 'document';
  if (PKG_EXT.has(e)) return 'package';
  return 'other';
}

function defaultRoots() {
  const roots = [];
  if (platform === 'win32') {
    roots.push(homedir);
    const userProfile = process.env.USERPROFILE || homedir;
    // Standard Windows user folders + drive letters (filtered to fixed volumes at runtime)
    const candidates = [
      path.join(userProfile, 'Desktop'),
      path.join(userProfile, 'Documents'),
      path.join(userProfile, 'Downloads'),
      path.join(userProfile, 'Pictures'),
      path.join(userProfile, 'Videos'),
      path.join(userProfile, 'Music'),
      path.join(userProfile, 'AppData', 'Local'),
      path.join(userProfile, 'AppData', 'Roaming'),
      'C:\\',
      'D:\\', 'E:\\', 'F:\\', 'G:\\', 'H:\\',
    ];
    for (const c of candidates) roots.push(c);
  } else if (platform === 'darwin') {
    roots.push(homedir);
    const userDirs = ['Desktop', 'Documents', 'Downloads', 'Movies', 'Music', 'Pictures', 'Library/Application Support', 'Library/Caches'];
    for (const d of userDirs) roots.push(path.join(homedir, d));
    roots.push('/Applications');
  } else {
    // Linux
    roots.push(homedir);
    const userDirs = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Videos', 'Music', '.local/share', '.cache'];
    for (const d of userDirs) roots.push(path.join(homedir, d));
    roots.push('/opt');
    roots.push('/usr/local');
  }
  return roots;
}

const ALWAYS_SKIP = (() => {
  const set = new Set();
  const skipNames = [
    '.git', '.svn', '.hg',
    'node_modules', '.pnpm-store',
    'Windows', 'Program Files', 'Program Files (x86)', 'ProgramData', '$Recycle.Bin', 'System Volume Information',
    'System', 'Library/Application Support/Apple', 'Library/Developer', 'Library/Frameworks',
    'proc', 'sys', 'dev', 'run', 'snap', '.Trash', '.Trash-0',
  ];
  for (const n of skipNames) set.add(n.toLowerCase());
  return set;
})();

function shouldSkipDir(name) {
  if (!name) return true;
  if (name.startsWith('.')) {
    // allow .cache and .local for size scans but skip dot-dirs like .npm that are huge package stores
    if (name === '.cache' || name === '.local' || name === '.config') return false;
    return true;
  }
  return ALWAYS_SKIP.has(name.toLowerCase());
}

let cancelled = false;
let totalScanned = 0;
let totalFound = 0;
const foundBuffer = [];
const startedAt = Date.now();
const seenRoots = new Set();
const seenPaths = new Set();

function emitFile(entry) {
  totalFound += 1;
  foundBuffer.push(entry);
  if (foundBuffer.length >= BATCH_SIZE) {
    parentPort.postMessage({ type: 'file-batch', entries: foundBuffer.splice(0, foundBuffer.length) });
  }
}

function emitProgress(extra = {}) {
  parentPort.postMessage({
    type: 'progress',
    scannedFiles: totalScanned,
    foundFiles: totalFound,
    elapsedMs: Date.now() - startedAt,
    ...extra,
  });
}

async function statWithCap(p) {
  try {
    const st = await fs.promises.stat(p);
    return st;
  } catch (_) {
    return null;
  }
}

async function walkDir(root, depth) {
  if (cancelled) return;
  if (depth > MAX_DEPTH) return;
  if (totalScanned >= MAX_FILES_PER_SCAN) return;
  let entries;
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch (_) {
    return;
  }

  const statJobs = [];
  for (const e of entries) {
    if (cancelled) break;
    if (totalScanned >= MAX_FILES_PER_SCAN) break;
    if (e.isSymbolicLink()) continue;            // never follow symlinks (loops)
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      if (shouldSkipDir(e.name)) continue;
      statJobs.push(walkDir(full, depth + 1));
    } else if (e.isFile()) {
      totalScanned += 1;
      statJobs.push((async () => {
        const st = await statWithCap(full);
        if (!st || !st.isFile()) return;
        const cat = classify(path.extname(e.name));
        const minForCat = (cat === 'video' || cat === 'audio' || cat === 'image') ? MEDIA_MIN_SIZE : MIN_SIZE;
        if (st.size < minForCat) return;
        if (seenPaths.has(full)) return;
        seenPaths.add(full);
        emitFile({
          id: `${st.ino || 0}:${full}:${st.size}`,
          path: full,
          name: e.name,
          size: st.size,
          mtime: st.mtimeMs,
          ext: path.extname(e.name),
          category: cat,
          root,
        });
      })());
    }
  }
  // Run a bounded number of stat() calls in parallel per directory to avoid fd exhaustion.
  const CHUNK = STAT_CONCURRENCY;
  for (let i = 0; i < statJobs.length; i += CHUNK) {
    if (cancelled) return;
    await Promise.all(statJobs.slice(i, i + CHUNK));
  }
}

async function runRoots(roots) {
  for (const root of roots) {
    if (cancelled) break;
    let st;
    try { st = await fs.promises.stat(root); } catch (_) { continue; }
    if (!st) continue;
    const real = st.isDirectory() ? root : path.dirname(root);
    if (seenRoots.has(real)) continue;
    seenRoots.add(real);
    parentPort.postMessage({ type: 'root-start', root: real });
    await walkDir(real, 0);
    parentPort.postMessage({ type: 'root-done', root: real, scannedFiles: totalScanned });
    emitProgress({ currentRoot: real });
  }
  if (foundBuffer.length) {
    parentPort.postMessage({ type: 'file-batch', entries: foundBuffer.splice(0, foundBuffer.length) });
  }
}

(async () => {
  let roots = defaultRoots();
  if (platform === 'win32') {
    // Trim to volumes that actually exist & are local fixed disks.
    try {
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const exec = promisify(execFile);
      const { stdout } = await exec('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        "Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -eq 'Fixed' } | Select-Object -ExpandProperty DriveLetter",
      ], { timeout: 15000, windowsHide: true });
      const letters = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const driveRoots = letters.map((l) => `${l}:\\`);
      // Replace bare drive letters in roots with the enumerated set; keep user subfolders as-is.
      roots = roots.filter((r) => !/^[A-Z]:\\$/.test(r)).concat(driveRoots);
    } catch (_) {
      // Fall back to the static drive list above.
    }
  }
  roots = Array.from(new Set(roots));
  parentPort.postMessage({ type: 'started', roots, totalRoots: roots.length });

  try {
    await runRoots(roots);
    parentPort.postMessage({
      type: 'done',
      scannedFiles: totalScanned,
      foundFiles: totalFound,
      durationMs: Date.now() - startedAt,
      cancelled,
    });
  } catch (err) {
    parentPort.postMessage({ type: 'error', error: err && err.message ? err.message : String(err) });
  }
})();

// Allow main thread to cancel.
parentPort.on('message', (msg) => {
  if (msg && msg.cmd === 'cancel') {
    cancelled = true;
  }
});
