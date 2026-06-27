import { createApp } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import ArcoVueIcon from '@arco-design/web-vue/es/icon';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';

import App from './App.vue';
import '@arco-design/web-vue/dist/arco.css';
import './style.scss';
import './views/computer/sub-views/css/common.scss';

// 导入视图组件
import SessionView from './views/session/Index.vue';
import KanbanView from './views/kanban/Index.vue';
import ModelView from './views/model/Index.vue';
import AgentView from './views/agent/Index.vue';
import SkillView from './views/skill/Index.vue';
import PluginView from './views/plugin/Index.vue';
import LogView from './views/log/Index.vue';
import SettingView from './views/setting/Index.vue';
import ComputerView from './views/computer/Index.vue';

// 创建路由
const routes = [
  { path: '/', redirect: '/session' },
  { path: '/session', component: SessionView, name: 'session' },
  { path: '/kanban', component: KanbanView, name: 'kanban' },
  { path: '/model', component: ModelView, name: 'model' },
  { path: '/agent', component: AgentView, name: 'agent' },
  { path: '/skill', component: SkillView, name: 'skill' },
  { path: '/plugin', component: PluginView, name: 'plugin' },
  { path: '/log', component: LogView, name: 'log' },
  { path: '/setting', component: SettingView, name: 'setting' },
  {
    path: '/computer',
    component: ComputerView,
    name: 'computer',
    redirect: '/computer/cleanup',
    children: [
      { path: 'lobster', component: () => import('./views/computer/sub-views/Lobster.vue'), name: 'computer-lobster' },
      { path: 'organize', component: () => import('./views/computer/sub-views/Organize.vue'), name: 'computer-organize' },
      { path: 'cleanup', component: () => import('./views/computer/sub-views/Cleanup.vue'), name: 'computer-cleanup' },
      { path: 'manage', component: () => import('./views/computer/sub-views/Manage.vue'), name: 'computer-manage' },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 创建Pinia状态管理
const pinia = createPinia();

// 创建Vue应用
const app = createApp(App);

// 使用插件
app.use(ArcoVue);
app.use(ArcoVueIcon);
app.use(router);
app.use(pinia);

// 监听主进程的 set-mode 事件（来自顶部菜单）
window.electronAPI?.onSetMode((mode) => {
  window.dispatchEvent(new CustomEvent('menu-mode-change', { detail: mode }));
});

// 挂载应用
app.mount('#app');
