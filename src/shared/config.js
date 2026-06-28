/**
 * clawc 后端服务配置（写死的常量）
 * 主进程（CJS）与渲染层（Vite ESM）共用。
 */
export const clawc = {
  domain: 'http://api.dragonclaw.cc',
  api: {
    versionCheck: 'base/api/addons/clawc/version/check',
    installInitScript: 'base/api/addons/clawc/install/initScript',
  },
};

export default { clawc };