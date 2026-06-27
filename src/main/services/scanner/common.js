/**
 * Common helpers for the platform scanners.
 *
 * All scanners yield normalized "app" objects:
 *   {
 *     id:           string   // platform-unique identifier
 *     name:         string
 *     publisher:    string
 *     version:      string
 *     icon:         string   // file:// URL the renderer <img> can load
 *     installPath:  string
 *     installDate:  number   // epoch ms (or null if unknown)
 *     lastUsed:     number   // epoch ms (or null)
 *     sizeBytes:    number   // best-effort disk usage
 *     autostart:    boolean
 *     autostartKey: string?  // the platform-specific entry that controls autostart
 *     uninstall:    { kind, payload }  // platform-native uninstall command
 *     source:       string   // "registry" | "infoPlist" | "desktop" | …
 *   }
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const pExecFile = promisify(execFile);

const toFileUrl = (p) => {
  if (!p) return '';
  return 'file://' + p.replace(/\\/g, '/').replace(/ /g, '%20');
};

const formatBytes = (n) => {
  if (!n || n < 0) return 0;
  return n;
};

const dirSize = async (dir) => {
  // Best-effort, capped so we don't scan huge trees forever.
  const MAX_FILES = 5000;
  const MAX_DEPTH = 6;
  let total = 0;
  let files = 0;
  const stack = [{ p: dir, depth: 0 }];
  while (stack.length && files < MAX_FILES) {
    const { p, depth } = stack.pop();
    let entries;
    try {
      entries = await fs.promises.readdir(p, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const e of entries) {
      if (files >= MAX_FILES) break;
      const full = path.join(p, e.name);
      if (e.isDirectory()) {
        if (depth < MAX_DEPTH) stack.push({ p: full, depth: depth + 1 });
      } else if (e.isFile()) {
        try {
          const s = await fs.promises.stat(full);
          total += s.size;
          files += 1;
        } catch (_) {}
      }
    }
  }
  return total;
};

const safeStat = async (p) => {
  try {
    return await fs.promises.stat(p);
  } catch (_) {
    return null;
  }
};

const readFileUtf8 = async (p) => {
  try {
    return await fs.promises.readFile(p, 'utf8');
  } catch (_) {
    return null;
  }
};

/**
 * Read a .plist file in any format (XML or binary) and return a parsed object.
 * On macOS we delegate to `plutil` because Info.plist files in the wild are
 * frequently binary, which our regex-based XML parser cannot read.
 */
const readPlist = async (filePath) => {
  if (process.platform !== 'darwin') {
    const xml = await readFileUtf8(filePath);
    if (!xml) return null;
    try { return parsePlistXml(xml); } catch (_) { return null; }
  }
  // Try XML first (cheap), otherwise shell out to plutil.
  const xml = await readFileUtf8(filePath);
  if (xml && xml.includes('<plist')) {
    try { return parsePlistXml(xml); } catch (_) { /* fall through to plutil */ }
  }
  const out = await runCmd('plutil', ['-convert', 'xml1', '-o', '-', filePath]);
  if (!out || !out.includes('<plist')) return null;
  try { return parsePlistXml(out); } catch (_) { return null; }
};

/**
 * Parse a macOS .plist (XML) without external deps.
 * Only the small subset we need: string, dict[string]=string|number|bool|array-of-string.
 */
const parsePlistXml = (xml) => {
  const stripNs = (s) => s.replace(/<[\/?][a-zA-Z0-9]+:/g, (m) => m[1] === '/' ? '</' : '<');

  const getTagText = (s, tag) => {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
    const m = s.match(re);
    return m ? m[1].trim() : '';
  };

  const dictBlocks = [];
  const dictRe = /<dict>([\s\S]*?)<\/dict>/g;
  let dm;
  while ((dm = dictRe.exec(xml))) dictBlocks.push(dm[1]);

  const result = {};
  for (const block of dictBlocks) {
    const kvRe = /<key>([^<]+)<\/key>([\s\S]*?)(?=<key>|<\/dict>)/g;
    let m;
    while ((m = kvRe.exec(block))) {
      const key = m[1];
      const val = m[2].trim();
      if (val.startsWith('<string>')) result[key] = getTagText(val, 'string');
      else if (val.startsWith('<integer>')) result[key] = parseInt(getTagText(val, 'integer'), 10);
      else if (val.startsWith('<real>')) result[key] = parseFloat(getTagText(val, 'real'));
      else if (val.startsWith('<true/>')) result[key] = true;
      else if (val.startsWith('<false/>')) result[key] = false;
      else if (val.startsWith('<array>')) {
        const arr = [];
        const itemRe = /<string>([^<]*)<\/string>/g;
        let im;
        while ((im = itemRe.exec(val))) arr.push(im[1]);
        result[key] = arr;
      }
    }
  }
  return result;
};

/**
 * Run a command and capture stdout (truncated to 1 MB). Never throws.
 */
const runCmd = async (cmd, args, opts = {}) => {
  try {
    const { stdout } = await pExecFile(cmd, args, { maxBuffer: 1024 * 1024, timeout: 10000, ...opts });
    return stdout || '';
  } catch (_) {
    return '';
  }
};

module.exports = {
  toFileUrl,
  formatBytes,
  dirSize,
  safeStat,
  readFileUtf8,
  readPlist,
  parsePlistXml,
  runCmd,
};
