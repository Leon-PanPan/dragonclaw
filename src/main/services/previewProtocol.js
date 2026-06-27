/**
 * Custom protocol for in-app file previews.
 *
 * Why we need this: Electron's webSecurity blocks the renderer from loading
 * `file://` URLs in production builds, so a `<video src="file:///…">` or
 * `<img src="file:///…">` silently fails. We register `dragonclaw-preview://`
 * as a privileged scheme that streams the bytes of an absolute filesystem
 * path, restricted to paths the renderer has explicitly whitelisted via IPC.
 *
 * Two pieces:
 *   1. main: register the protocol scheme + handler that resolves the path
 *      (only if the path is currently whitelisted).
 *   2. ipc: ipcMain.handle('cleanup:preview:authorize', { path }) → adds the
 *      path to the whitelist, then returns the `dragonclaw-preview://` URL.
 *
 * Streaming: the protocol handler reads the file with createReadStream and
 * pipes the response back with the right Content-Type so <img>/<video>/<audio>
 * can decode it.
 */

const { protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const SCHEME = 'dragonclaw-preview';
const allowed = new Set();

function registerSchemePrivileges() {
  // Must run BEFORE app.whenReady() resolves.
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ]);
}

function registerHandler() {
  protocol.handle(SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      // host is "local", pathname is the absolute disk path
      const filePath = decodeURIComponent(url.pathname);
      // On Windows URL parses pathname as /C:/...; strip leading slash.
      const normalized = process.platform === 'win32' && /^\/[A-Za-z]:/.test(filePath) ? filePath.slice(1) : filePath;
      if (!allowed.has(normalized)) {
        return new Response('forbidden', { status: 403 });
      }
      const st = await fs.promises.stat(normalized).catch(() => null);
      if (!st || !st.isFile()) {
        return new Response('not found', { status: 404 });
      }
      const ext = path.extname(normalized).slice(1).toLowerCase();
      const mime = mimeFor(ext, normalized);
      // Stream the file via net.fetch so that <video>/<audio> can use
      // byte-range requests and the response body streams incrementally.
      const fileUrl = pathToFileURL(normalized).toString();
      const headers = { 'Content-Type': mime, 'Accept-Ranges': 'bytes' };
      const range = request.headers.get('range');
      if (range) headers.Range = range;
      return net.fetch(fileUrl, { headers });
    } catch (err) {
      return new Response('error: ' + err.message, { status: 500 });
    }
  });
}

function mimeFor(ext, filePath) {
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml',
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/ogg', aac: 'audio/aac',
  };
  return map[ext] || 'application/octet-stream';
}

function authorize(filePath) {
  if (!filePath) return null;
  allowed.add(filePath);
  // Expire whitelisted paths after 30 minutes to avoid unbounded growth.
  setTimeout(() => allowed.delete(filePath), 30 * 60 * 1000).unref?.();
  // Encode the path so non-ASCII / spaces survive URL parsing.
  return `${SCHEME}://local/${encodeURIComponent(filePath)}`;
}

function revoke(filePath) {
  if (filePath) allowed.delete(filePath);
}

module.exports = {
  SCHEME,
  registerSchemePrivileges,
  registerHandler,
  authorize,
  revoke,
};
