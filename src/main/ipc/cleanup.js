/**
 * Disk Cleanup IPC — bridges renderer ↔ cleanupScanner service.
 *
 * Channels:
 *   cleanup:scan                 → start scan, returns { taskId }
 *   cleanup:stop-scan            → cancel running scan
 *   cleanup:delete               → move files to trash (multi)
 *   cleanup:move                 → move files to a target dir (multi)
 *   cleanup:pick-dir             → open native directory chooser
 *   cleanup:preview              → read a small slice of a file for in-app preview
 *
 * Pushed events:
 *   cleanup:started              → { taskId, roots, totalRoots }
 *   cleanup:root-start           → { taskId, root }
 *   cleanup:root-done            → { taskId, root, scannedFiles }
 *   cleanup:progress             → { taskId, scannedFiles, foundFiles, elapsedMs, currentRoot? }
 *   cleanup:files                → { taskId, entries[] }
 *   cleanup:done                 → { taskId, scannedFiles, foundFiles, durationMs, cancelled }
 *   cleanup:error                → { taskId, error }
 */

const { ipcMain, dialog, shell, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const CH = require('../../../shared/ipc-channels');
const { startScan, stopScan } = require('../services/cleanupScannerController');
const previewProtocol = require('../services/previewProtocol');

const PREVIEW_TEXT_MAX = 256 * 1024;       // 256 KB
const PREVIEW_MEDIA_MAX = 200 * 1024 * 1024; // 200 MB cap for streaming preview

const TEXT_EXT = new Set(['txt', 'md', 'markdown', 'log', 'json', 'xml', 'yaml', 'yml', 'csv', 'tsv', 'ini', 'conf', 'cfg', 'env', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'vue', 'svelte', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cc', 'cs', 'php', 'sh', 'bash', 'zsh', 'fish', 'sql', 'toml', 'gradle']);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']);
const VIDEO_EXT = new Set(['mp4', 'mkv', 'mov', 'webm', 'm4v']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus', 'aac']);

function extOf(p) {
  return path.extname(p).slice(1).toLowerCase();
}

ipcMain.handle(CH.CLEANUP_SCAN, (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return startScan(win ? win.webContents : event.sender);
});

ipcMain.handle(CH.CLEANUP_STOP_SCAN, () => {
  stopScan();
  return { success: true };
});

ipcMain.handle(CH.CLEANUP_PICK_DIR, async (event, { title } = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const ret = await dialog.showOpenDialog(win || undefined, {
    title: title || '选择目标文件夹',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (ret.canceled || !ret.filePaths.length) return { success: false, canceled: true };
  return { success: true, path: ret.filePaths[0] };
});

ipcMain.handle(CH.CLEANUP_REVEAL, async (event, { path: filePath }) => {
  if (!filePath) return { success: false, error: 'no path' };
  try {
    if (!fs.existsSync(filePath)) return { success: false, error: 'not found' };
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle(CH.CLEANUP_DELETE, async (event, { paths }) => {
  if (!Array.isArray(paths) || !paths.length) return { success: false, error: 'no paths' };
  const results = [];
  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) { results.push({ path: p, ok: false, error: 'not found' }); continue; }
      await shell.trashItem(p);
      results.push({ path: p, ok: true });
    } catch (err) {
      results.push({ path: p, ok: false, error: err.message });
    }
  }
  return { success: true, results };
});

ipcMain.handle(CH.CLEANUP_MOVE, async (event, { paths, targetDir }) => {
  if (!Array.isArray(paths) || !paths.length) return { success: false, error: 'no paths' };
  if (!targetDir) return { success: false, error: 'no target dir' };
  try {
    const st = await fs.promises.stat(targetDir);
    if (!st.isDirectory()) return { success: false, error: 'target not a directory' };
  } catch (err) {
    return { success: false, error: 'target inaccessible: ' + err.message };
  }
  const results = [];
  for (const p of paths) {
    try {
      const base = path.basename(p);
      let dest = path.join(targetDir, base);
      let n = 1;
      while (fs.existsSync(dest)) {
        const ext = path.extname(base);
        const stem = base.slice(0, base.length - ext.length);
        dest = path.join(targetDir, `${stem} (${n})${ext}`);
        n += 1;
      }
      await fs.promises.rename(p, dest);
      results.push({ path: p, ok: true, dest });
    } catch (err) {
      // Cross-volume rename fails on Linux/macOS — fall back to copy + trash.
      try {
        await fs.promises.copyFile(p, dest).catch(async () => {
          // copyFile won't copy dirs; for dirs we recursively walk.
          await copyRecursive(p, dest);
        });
        await shell.trashItem(p);
        results.push({ path: p, ok: true, dest });
      } catch (err2) {
        results.push({ path: p, ok: false, error: err2.message });
      }
    }
  }
  return { success: true, results };
});

async function copyRecursive(src, dst) {
  const st = await fs.promises.stat(src);
  if (st.isFile()) {
    await fs.promises.copyFile(src, dst);
    return;
  }
  if (!st.isDirectory()) return;
  await fs.promises.mkdir(dst, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    await copyRecursive(path.join(src, e.name), path.join(dst, e.name));
  }
}

ipcMain.handle(CH.CLEANUP_PREVIEW, async (event, { path: filePath }) => {
  if (!filePath) return { success: false, error: 'no path' };
  try {
    const st = await fs.promises.stat(filePath);
    if (!st.isFile()) return { success: false, error: 'not a file' };
    const ext = extOf(filePath);
    const kind =
      IMAGE_EXT.has(ext) ? 'image'
      : VIDEO_EXT.has(ext) ? 'video'
      : AUDIO_EXT.has(ext) ? 'audio'
      : TEXT_EXT.has(ext) ? 'text'
      : 'binary';

    if (kind === 'image') {
      // Read the file bytes in the main process and ship them to the renderer
      // as a base64 data URL. This works regardless of webSecurity because
      // data: URLs are exempt from the same-origin policy. We also authorise
      // the absolute path on the dragonclaw-preview:// scheme so we can fall
      // back to a streaming URL if the image is too large to inline.
      const mime = ext === 'svg' ? 'image/svg+xml' : (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext === 'png' ? 'png' : ext}`);
      previewProtocol.authorize(filePath);
      if (st.size <= 10 * 1024 * 1024) {
        const buf = await fs.promises.readFile(filePath);
        return { success: true, kind, mime, size: st.size, mtime: st.mtimeMs, dataUrl: `data:${mime};base64,${buf.toString('base64')}`, filePath };
      }
      // For larger images, fall back to the streaming protocol URL.
      return { success: true, kind, mime, size: st.size, mtime: st.mtimeMs, fileUrl: previewProtocol.authorize(filePath), filePath };
    }
    if (kind === 'video' || kind === 'audio') {
      if (st.size > PREVIEW_MEDIA_MAX) return { success: false, error: '文件过大，无法预览', size: st.size };
      // Chromium doesn't accept data: URLs for <video>/<audio>, and file:// is
      // blocked when webSecurity is on. So: read the bytes in main, send them
      // over IPC as a Buffer; the renderer wraps them in a Blob and creates a
      // blob:// URL that's same-origin and universally accepted.
      const buf = await fs.promises.readFile(filePath);
      previewProtocol.authorize(filePath);
      const mime = kind === 'video'
        ? `video/${ext === 'mov' ? 'quicktime' : ext}`
        : `audio/${ext === 'mp3' ? 'mpeg' : ext}`;
      return { success: true, kind, mime, size: st.size, mtime: st.mtimeMs, bytes: buf, filePath };
    }
    if (kind === 'text') {
      const limit = Math.min(st.size, PREVIEW_TEXT_MAX);
      const fd = await fs.promises.open(filePath, 'r');
      try {
        const buf = Buffer.alloc(limit);
        await fd.read(buf, 0, limit, 0);
        return {
          success: true,
          kind: 'text',
          size: st.size,
          mtime: st.mtimeMs,
          content: buf.toString('utf8'),
          truncated: st.size > PREVIEW_TEXT_MAX,
        };
      } finally {
        await fd.close();
      }
    }
    return {
      success: true,
      kind: 'binary',
      size: st.size,
      mtime: st.mtimeMs,
      mime: 'application/octet-stream',
      message: '该类型暂不支持预览，请使用删除或移动。',
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
