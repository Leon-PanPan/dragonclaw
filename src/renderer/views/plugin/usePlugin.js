import { ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import {
  IconPrinter,
  IconCloud,
  IconBranch,
  IconUpload
} from '@arco-design/web-vue/es/icon';

const plugins = ref([
  { id: 'cloud-print', name: '云打印', description: '支持连接云打印机，实现远程打印功能', longDescription: '云打印插件支持连接多种云打印服务，包括易联云、365云打印等。可以实现远程提交打印任务，无需局域网连接打印机。', icon: IconPrinter, color: '#4CAF50' },
  { id: 'cloud-drive', name: '云盘', description: '集成云盘存储服务，方便文件管理', longDescription: '云盘插件集成多种云存储服务，支持文件上传、下载、同步和管理。支持本地路径映射到云端存储。', icon: IconCloud, color: '#2196F3' },
  { id: 'gitlab', name: 'GitLab', description: '集成 GitLab 代码仓库管理功能', longDescription: 'GitLab 插件提供代码仓库的集成管理，支持 MR 创建、CI/CD 状态查看、项目 Issues 管理等功能。', icon: IconBranch, color: '#E91E63' },
  { id: 'cloud-deploy', name: '一键上云', description: '快速部署应用到云端服务器', longDescription: '一键上云插件支持将本地构建的应用快速部署到云端服务器，支持多种云服务商和部署方式。', icon: IconUpload, color: '#FF9800' }
]);

const detailModal = ref({ visible: false, plugin: null });

const openPlugin = (plugin) => { detailModal.value = { visible: true, plugin }; };
const configurePlugin = (plugin) => { Message.info(`正在打开 ${plugin.name} 配置页面...`); };

export function usePlugin() {
  return { plugins, detailModal, openPlugin, configurePlugin };
}
