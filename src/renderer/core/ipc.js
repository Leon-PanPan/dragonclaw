/**
 * IPC Bridge — the single entry point for all renderer→main communication.
 * All api/*.js modules import from here. Views should never call window.electronAPI directly.
 */

const invoke = (channel, ...args) => {
  if (!window.electronAPI?.invoke) {
    throw new Error(`IPC not available (channel: ${channel}). Is the app running in Electron?`);
  }
  return window.electronAPI.invoke(channel, ...args);
};

const on = (channel, callback) => {
  if (!window.electronAPI?.on) return () => {};
  return window.electronAPI.on(channel, callback);
};

const platform = window.electronAPI?.platform || 'darwin';

const openExternal = (url) => {
  window.electronAPI?.openExternal?.(url);
};

export { invoke, on, platform, openExternal };
