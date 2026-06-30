import { ref, reactive, computed, onMounted, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { systemApi } from '@/api/gateway';
import { soulApi } from '@/api/soul';
import { agentApi } from '@/api/agent';
import { agentAdminApi, configAdminApi, configFromSnapshot, modelAdminApi } from '@/api/admin-rpc';
import { agentFileAdminApi } from '@/api/admin-rpc';
import { wsManager, ConnectionState } from '@/core/websocket/manager';

const wsConnected = computed(() => wsManager.state?.value === ConnectionState.CONNECTED);

export function useAgent() {
  const AGENT_COLORS = ['#165DFF', '#00B42A', '#FF7D00', '#F53FAD', '#722ED1', '#0FC6C2', '#FADE0A', '#EB0E28'];

  const guideFiles = [
    { key: 'bootstrap', label: '出生证明', filename: 'BOOTSTRAP.md', description: '智能体初始化引导文件，首次运行时读取' },
    { key: 'identity', label: '身份信息', filename: 'IDENTITY.md', description: '定义智能体的身份、气质和表情' },
    { key: 'user', label: '主人信息', filename: 'USER.md', description: '记录主人的背景、偏好和沟通风格' },
    { key: 'tools', label: '擅长工具', filename: 'TOOLS.md', description: '配置智能体擅长的工具和技能' },
    { key: 'soul', label: '灵魂定义', filename: 'SOUL.md', description: '描述智能体的核心职责、工作准则和边界' },
    { key: 'agents', label: '智能代理', filename: 'AGENTS.md', description: '定义智能代理、任务派发规范和团队通信机制' },
    { key: 'heartbeat', label: '主动执行', filename: 'HEARTBEAT.md', description: '配置心跳任务，主动定期执行检查' }
  ];

  const viewMode = ref('discover');

  const agents = ref([]);
  const selectedAgentId = ref('main');
  const showAddModal = ref(false);
  const showCloudModal = ref(false);
  const showInstallDrawer = ref(false);
  const installTargetAgent = ref(null);

  const showEditDrawer = ref(false);
  const editingAgent = ref(null);
  const multiAgentMode = ref(false);
  const showSettingsModal = ref(false);
  const showAgentDetailModal = ref(false);
  const detailAgent = ref(null);
  const detailInstalling = ref(false);
  const showInstallProgress = ref(false);
  const installSteps = reactive([
    { key: 'create', label: '创建智能体', status: 'pending' },
    { key: 'config', label: '更新 openclaw.json', status: 'pending' },
    { key: 'prompts', label: '更新智能体提示词', status: 'pending' },
    { key: 'db', label: '进行数据优化', status: 'pending' },
  ]);
  const installProgressDone = ref(false);
  const pageLoading = ref(true);
  const loading = ref(false);
  const fileNotFound = ref(false);

  const activeTab = ref('identity');
  const editContent = ref('');
  const originalContent = ref('');
  const saving = ref(false);
  const lastSaved = ref('');

  function openEditDrawer(agent) {
    editingAgent.value = agent;
    showEditDrawer.value = true;
  }

  async function onDrawerSaveSettings(payload) {
    if (!payload || !payload.agentId) {
      Message.error('保存失败：缺少智能体 ID');
      return;
    }
    const agentId = payload.agentId;
    try {
      let avatarPath = '';
      if (payload.avatarBase64) {
        const safeId = String(agentId).replace(/[^a-zA-Z0-9_-]/g, '');
        const filename = `agent-${safeId}-${Date.now()}.png`;
        const result = await agentApi.saveAvatar({ base64: payload.avatarBase64, filename });
        if (result?.success && result.path) {
          avatarPath = result.path;
        } else {
          throw new Error(result?.error || '头像保存失败');
        }
      } else if (payload.avatarPreview) {
        avatarPath = payload.avatarPreview;
      }

      const dbUpdates = { description: payload.desc || '' };
      if (avatarPath) dbUpdates.avatar = avatarPath;
      const dbResult = await agentApi.update(agentId, dbUpdates);
      if (dbResult && dbResult.success === false) {
        throw new Error(dbResult.error || '数据库更新失败');
      }

      const configPatch = {
        workspace: payload.workspace,
        model: payload.model,
        identity: { avatar: avatarPath },
      };
      await syncAgentToOpenClawConfig(agentId, configPatch);

      const idx = agents.value.findIndex(a => a.id === agentId);
      if (idx !== -1) {
        agents.value[idx] = {
          ...agents.value[idx],
          workspace: payload.workspace,
          model: payload.model,
          description: payload.desc,
          avatar: avatarPath || agents.value[idx].avatar,
        };
      }
      Message.success('设置已保存');
    } catch (e) {
      console.error('[AgentView] 保存设置失败:', e);
      Message.error('保存失败: ' + (e.message || '未知错误'));
    }
  }

  async function syncAgentToOpenClawConfig(agentId, patch = {}) {
    // 通过 Gateway WebSocket RPC config.patch 修改配置
    // Gateway 对 agents.list 数组按 id 合并，新条目追加、已有条目更新
    // 绕过直接写文件的竞态问题
    // patch 支持任意嵌套结构（sandbox/tools/identity/runtime/subagents 等），
    // Gateway 在服务端做深合并；调用方负责传入最终期望的字段
    const entry = { id: agentId, ...patch };

    const snap = await configAdminApi.get()
    await configAdminApi.patch({ partial: { agents: { list: [entry] } }, hash: snap?.hash || '' });

    return entry;
  }

  const activeCategory = ref('all');

  const categories = ref([
    { name: '全部', slug: 'all' },
  ]);

  const discoverAgents = ref([]);

  const newAgentForm = reactive({
    name: '',
    workspace: '',
    description: '',
    avatarBase64: '',
    avatarPreview: '',
    avatarPath: '',
    model: '',
    prompt: '',
    type: 'local',
  });

  const cloudAgents = ref([]);

  const currentGuideFile = computed(() => {
    return guideFiles.find(f => f.key === activeTab.value);
  });

  const hasChanges = computed(() => {
    return editContent.value !== originalContent.value;
  });

  const filteredDiscoverAgents = computed(() => {
    if (activeCategory.value === 'all') return discoverAgents.value;
    return discoverAgents.value.filter(a => a.category === activeCategory.value);
  });

  const detailLoading = ref(false);

  const detailAgentFiles = computed(() => {
    if (!detailAgent.value) return [];
    const prompt = detailAgent.value.prompt || {};
    const map = [
      { key: 'tools',     label: '擅长工具', filename: 'TOOLS.md' },
      { key: 'soul',      label: '灵魂定义', filename: 'SOUL.md' },
      { key: 'agents',    label: '智能代理', filename: 'AGENTS.md' },
      { key: 'heartbeat', label: '主动执行', filename: 'HEARTBEAT.md' },
    ];
    return map
      .filter(m => prompt[m.key])
      .map(m => ({
        key: m.key,
        label: m.label,
        filename: m.filename,
        content: formatFileContent(prompt[m.key]),
      }));
  });

  function getAgentColor(agentId) {
    const index = Math.abs(hashCode(agentId)) % AGENT_COLORS.length;
    return AGENT_COLORS[index];
  }

  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = ((hash << 5) - hash) + (str || '').charCodeAt(i);
    }
    return hash;
  }

  function isAgentAdded(id) {
    return agents.value.some(a => a.id === id);
  }

  function isAgentInstalled(agentId) {
    if (!agentId) return false;
    return agents.value.some(a => a.id === agentId);
  }

  function getSelectedAgentName() {
    const agent = agents.value.find(a => a.id === selectedAgentId.value);
    return agent?.name || selectedAgentId.value;
  }

  function formatFileContent(content) {
    if (!content) return '<p style="color:#86909C;">暂无内容</p>';
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function getModelName(modelId) {
    if (!modelId) return '';
    return modelId;
  }

  function getModelDisplayName(model) {
    if (!model) return '';
    if (typeof model === 'object') {
      model = model.primary || model.id || '';
    }
    return getModelName(model);
  }

  async function loadAgents() {
    try {
      const result = await agentAdminApi.list();
      if (result?.agents && result.agents.length > 0) {
        agents.value = result.agents.map(a => ({
          id: a.id || a.agentId,
          name: a.identity?.name || a.id,
          workspace: a.workspace || '',
          model: a.model || '',
          description: a.description || '',
          avatar: a.avatar || ''
        }));

        if (agents.value.length > 0 && !agents.value.find(a => a.id === selectedAgentId.value)) {
          selectedAgentId.value = agents.value[0].id;
        }

        multiAgentMode.value = agents.value.length > 1;
        console.log('[AgentView] 通过 HTTP 加载智能体:', agents.value);
        return;
      }
    } catch (e) {
      console.error('[AgentView] HTTP 加载智能体失败:', e);
      Message.error('加载智能体列表失败: ' + (e.message || '未知错误'));
    }

    // API 返回空或失败时，保持默认 main
    if (agents.value.length === 0) {
      agents.value = [{
        id: 'main',
        name: '默认智能体',
        workspace: 'main'
      }];
      selectedAgentId.value = 'main';
    }
  }

  async function selectAgent(agentId) {
    if (selectedAgentId.value === agentId) return;

    if (hasChanges.value) {
      Message.warning({ content: '当前有未保存的更改，切换智能体将丢失', duration: 3000 });
    }

    selectedAgentId.value = agentId;
    loading.value = true;
    try {
      await loadCurrentFile();
    } finally {
      loading.value = false;
    }
  }

  async function loadCurrentFile() {
    if (!selectedAgentId.value || !currentGuideFile.value) return;

    fileNotFound.value = false;
    loading.value = true;
    try {
      const filename = currentGuideFile.value.filename;

      const result = await agentFileAdminApi.get({
        agentId: selectedAgentId.value,
        name: filename
      });

        if (result?.file?.content !== undefined) {
          editContent.value = result.file.content;
          originalContent.value = result.file.content;
          fileNotFound.value = false;
        } else {
          editContent.value = '';
          originalContent.value = '';
          fileNotFound.value = true;
        }
    } catch (e) {
      console.error(`加载 ${currentGuideFile.value.filename} 失败:`, e);
      editContent.value = '';
      originalContent.value = '';
      fileNotFound.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function saveCurrentFile() {
    if (!currentGuideFile.value || saving.value) return;

    saving.value = true;
    try {
      const filename = currentGuideFile.value.filename;

      await agentFileAdminApi.set({
        agentId: selectedAgentId.value,
        name: filename,
        content: editContent.value
      });

      originalContent.value = editContent.value;
      lastSaved.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      Message.success(`${currentGuideFile.value.label} 保存成功`);
    } catch (e) {
      console.error('保存失败:', e);
      Message.error('保存失败: ' + (e.message || '未知错误'));
    } finally {
      saving.value = false;
    }
  }

  function resetContent() {
    editContent.value = originalContent.value;
    Message.info('已重置为上次保存的内容');
  }

  function onContentChange() {}

  function onMultiAgentModeChange(checked) {
    if (!checked && agents.value.length > 1) {
      selectedAgentId.value = agents.value[0].id;
    }
    Message.info(checked ? '已开启多智能体模式' : '已切换为单智能体模式');
  }

  function closeAddModal() {
    showAddModal.value = false;
    newAgentForm.name = '';
    newAgentForm.workspace = '';
    newAgentForm.description = '';
    newAgentForm.avatarBase64 = '';
    newAgentForm.avatarPreview = '';
    newAgentForm.avatarPath = '';
    newAgentForm.model = '';
    newAgentForm.prompt = '';
  }

  async function createAgent() {
    if (!newAgentForm.name.trim()) {
      Message.warning('请输入智能体名称');
      return;
    }
    if (!newAgentForm.workspace.trim()) {
      Message.warning('请输入工作区目录');
      return;
    }

    try {
      let avatarPath = '';
      if (newAgentForm.avatarBase64) {
        try {
          const safeWs = String(newAgentForm.workspace).split(/[/\\]/).pop().replace(/[^a-zA-Z0-9_-]/g, '_') || 'agent';
          const filename = `agent-${safeWs}-${Date.now()}.png`;
          const result = await agentApi.saveAvatar({ base64: newAgentForm.avatarBase64, filename });
          if (result?.success && result.path) {
            avatarPath = result.path;
          } else if (result?.error) {
            console.warn('[AgentView] 头像保存失败:', result.error);
          }
        } catch (e) {
          console.warn('[AgentView] 头像保存失败:', e);
        }
      }

      const workspace = newAgentForm.workspace;
      const basename = workspace.split(/[/\\]/).pop() || 'agent';
      const newAgentId = basename.replace(/^workspace-/, '').replace(/[^a-zA-Z0-9_-]/g, '') || 'agent';

      try {
        await agentApi.create({
          id: newAgentId,
          name: newAgentForm.name,
          workspace: workspace,
          description: newAgentForm.description,
          avatar: avatarPath,
          model: newAgentForm.model,
          prompt: newAgentForm.prompt,
          type: newAgentForm.type,
        });
      } catch (e) {
        console.warn('[AgentView] agentApi.create 失败:', e);
      }

      try {
        await syncAgentToOpenClawConfig(newAgentId, {
          name: newAgentForm.name,
          workspace: workspace,
          model: newAgentForm.model,
          identity: { avatar: avatarPath },
        });
      } catch (e) {
        console.warn('[AgentView] openclaw.json 同步失败:', e);
        Message.warning('已写入数据库，但 openclaw.json 同步失败：' + (e.message || '未知错误'));
      }

      Message.success(`智能体 "${newAgentForm.name}" 创建成功，工作区: ${workspace}`);
      closeAddModal();
      await loadAgents();
    } catch (e) {
      console.error('创建失败:', e);
      Message.error('创建失败: ' + (e.message || '未知错误'));
    }
  }

  const avatarInputRef = ref(null);

  const selectAvatar = () => {
    avatarInputRef.value?.click();
  };

  const onAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      newAgentForm.avatarPreview = ev.target.result;
      newAgentForm.avatarBase64 = ev.target.result.split(',')[1];
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const selectWorkspaceFolder = async () => {
    try {
      const result = await agentApi.openDirectoryDialog({ title: '选择智能体工作区目录' });
      if (result && !result.canceled && result.filePaths?.length > 0) {
        newAgentForm.workspace = result.filePaths[0];
      }
    } catch (e) {
      console.error('[AgentView] 选择工作区失败:', e);
      Message.error('选择工作区失败: ' + (e.message || '未知错误'));
    }
  };

  function syncFromCloud() {
    showCloudModal.value = true;
  }

  function addFromCloud(cloud) {
    Message.success(`已添加智能体 "${cloud.name}"`);
    loadAgents();
    loadDiscoverSouls();
  }

  async function showAgentDetail(agent) {
    detailAgent.value = { ...agent };
    showAgentDetailModal.value = true;
    detailLoading.value = true;
    try {
      const detail = await soulApi.detail({ id: agent.id });
      if (detail && !detail.status) {
        detailAgent.value = { ...agent, ...detail };
      }
    } catch (e) {
      Message.error('加载智能体详情失败: ' + (e.message || '未知错误'));
    } finally {
      detailLoading.value = false;
    }
  }

  function openInstallModal(agent) {
    installTargetAgent.value = agent;
    showInstallDrawer.value = true;
  }

  function closeInstallDrawer() {
    showInstallDrawer.value = false;
    installTargetAgent.value = null;
  }

  function updateInstallStep(key, status) {
    const step = installSteps.find(s => s.key === key);
    if (step) step.status = status;
  }

  function resetInstallSteps() {
    installSteps.forEach(s => s.status = 'pending');
    installProgressDone.value = false;
  }

  async function doInstall(payload) {
    const { form, prompts } = payload || {};
    if (!form) return;

    // 校验
    if (!form.name.trim()) {
      Message.warning('请输入智能体名称');
      return;
    }
    if (!form.id.trim()) {
      Message.warning('请输入智能体 ID（仅英文/数字/-/_）');
      return;
    }
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(form.id.trim())) {
      Message.warning('智能体 ID 必须以英文字母开头，仅含字母/数字/-/_，最多 64 字符');
      return;
    }
    if (!form.workspace.trim()) {
      Message.warning('请输入工作区目录');
      return;
    }
    if (!form.model) {
      Message.warning('请选择默认模型');
      return;
    }

    const agentId = form.id.trim();
    const agentName = form.name.trim();
    const workspacePath = form.workspace.trim();
    const model = form.model;
    const agent = installTargetAgent.value;

    showInstallDrawer.value = false;
    resetInstallSteps();
    showInstallProgress.value = true;

    let failed = false;

    try {
      // === Step 1: 创建智能体 ===
      updateInstallStep('create', 'active');
      let avatarPath = form.avatarPath || '';
      const nameForGateway = /^[A-Za-z0-9 _.\-]+$/.test(agentName) ? agentName : agentId;
      try {
        await agentAdminApi.create({
          name: nameForGateway,
          workspace: workspacePath,
          ...(avatarPath ? { avatar: avatarPath } : {}),
        });
        updateInstallStep('create', 'done');
      } catch (e) {
        updateInstallStep('create', 'error');
        failed = true;
        throw e;
      }

      // === Step 2: 更新 openclaw.json ===
      updateInstallStep('config', 'active');
      try {
        const fullEntry = {
          id: agentId,
          name: agentName,
          workspace: workspacePath,
          model: model,
          ...(avatarPath ? { identity: { name: agentName, avatar: avatarPath } } : { identity: { name: agentName } }),
          memorySearch: {enabled : true},
          sandbox: { mode: 'off' },
          subagents: { allowAgents: ['*'] },
          tools: { profile: 'full' },
          groupChat: {},
        };
        await configAdminApi.patch({
          partial: { agents: { list: [fullEntry] } },
          hash: (await configAdminApi.get())?.hash || '',
        });
        updateInstallStep('config', 'done');
      } catch (e) {
        updateInstallStep('config', 'error');
        failed = true;
        throw e;
      }

      // === Step 3: 更新智能体提示词 ===
      updateInstallStep('prompts', 'active');
      const fileMap = {
        tools: 'TOOLS.md', soul: 'SOUL.md',
        agents: 'AGENTS.md', heartbeat: 'HEARTBEAT.md',
      };
      let promptFailed = false;
      if (prompts) {
        for (const [key, filename] of Object.entries(fileMap)) {
          const content = prompts[key];
          if (content && content.trim()) {
            try {
              await agentFileAdminApi.set({ agentId, name: filename, content });
            } catch (e) {
              console.warn(`[AgentView] 写入 ${filename} 失败:`, e.message);
              promptFailed = true;
            }
          }
        }
      }
      updateInstallStep('prompts', promptFailed ? 'error' : 'done');
      if (promptFailed) {
        failed = true;
        throw new Error('部分提示词写入失败');
      }

      // === Step 4: 进行数据优化（写本地 SQLite）===
      updateInstallStep('db', 'active');
      try {
        const dbResult = await agentApi.create({
          id: agentId, uuid: '',
          avatar: avatarPath, name: agentName,
          workspace: workspacePath,
          description: form.description || '',
          prompt: JSON.stringify(agent?.prompt || {}),
          type: agent?.type || 'openclaw', model: model,
          author: agent?.author || '', install_count: 0,
          category: agent?.category || '', color: agent?.color || '#165DFF',
          files: '[]',
        });
        if (!dbResult || !dbResult.success) {
          throw new Error((dbResult && dbResult.error) || '本地 db 写入失败');
        }
        updateInstallStep('db', 'done');
      } catch (e) {
        updateInstallStep('db', 'error');
        failed = true;
        throw e;
      }

      installProgressDone.value = true;
      await loadAgents();
    } catch (e) {
      console.error('[安装] 失败:', e);
      if (!failed) {
        // 校验阶段的错误，不显示进度弹窗
        showInstallProgress.value = false;
        Message.error('安装失败: ' + (e.message || '未知错误'));
      }
    }
  }



  async function uninstallAgent(agent) {
    if (!agent) return;
    try {
      agents.value = agents.value.filter(a => a.id !== agent.id);
      if (selectedAgentId.value === agent.id) {
        selectedAgentId.value = agents.value[0]?.id || 'main';
      }
      Message.success(`已卸载 "${agent.name}"`);
      loadAgents();
    } catch (e) {
      console.error('[AgentView] uninstallAgent 失败:', e);
      Message.error('卸载失败');
    }
  }

  async function deleteMyAgent(agentId) {
    const target = agents.value.find(a => a.id === agentId);
    if (!target) return;

    try {
      // 1. Gateway 删除（agents.list[] 条目 + workspace 引导文件）
      await agentAdminApi.delete({ agentId });
    } catch (e) {
      console.warn('[AgentView] Gateway 删除失败:', e.message);
    }

    // 2. 本地 SQLite 删除
    agentApi.delete(agentId).catch(e => {
      console.warn('[AgentView] SQLite 删除失败:', e);
    });

    // 3. 从 Gateway 重新拉取最新列表（保证前后端一致）
    Message.success(`"${target.name || agentId}" 已删除`);
    await loadAgents();
  }

  watch(activeTab, async () => {
    if (viewMode.value === 'edit') {
      await loadCurrentFile();
    }
  });

  watch(selectedAgentId, async () => {
    if (viewMode.value === 'edit') {
      await loadCurrentFile();
    }
  });

  watch(viewMode, async (newMode) => {
    if (newMode === 'edit') {
      await loadCurrentFile();
    }
  });

  async function loadDiscoverSouls() {
    try {
      const result = await soulApi.list();
      if (result && result.souls && !result.status) {
        discoverAgents.value = result.souls;
        cloudAgents.value = result.souls;
        categories.value = [{ name: '全部', slug: 'all' }];
        (result.categories || []).forEach(c => {
          categories.value.push({ name: c, slug: c });
        });
      } else if (result && result.status >= 400) {
        console.warn('[AgentView] soul 列表加载失败:', result.message);
      }
    } catch (e) {
      console.warn('[AgentView] soul 列表加载异常（后端未就绪）:', e.message);
    }
  }

  onMounted(() => {
    // 🔧 修复: 一次性触发 + watch 立即 stop。
    //    原来: watch(wsConnected, ...) 没有 stop,后续 WS 重连会重复加载
    //    现在: 触发一次后 stop,避免抖动
    let triggered = false
    const fire = () => {
      if (triggered) return
      triggered = true
      Promise.all([loadAgents(), loadDiscoverSouls()]).finally(() => {
        pageLoading.value = false;
      });
    }
    if (wsConnected.value) {
      fire()
    } else {
      const stop = watch(wsConnected, (connected) => {
        if (!connected) return
        stop()
        fire()
      });
    }
  });

  return {
    viewMode,
    agents,
    categories,
    discoverAgents,
    filteredDiscoverAgents,
    multiAgentMode,
    selectedAgentId,
    currentGuideFile,
    editContent,
    originalContent,
    saving,
    activeTab,
    activeCategory,
    showAddModal,
    showSettingsModal,
    showAgentDetailModal,
    showInstallDrawer,
    showEditDrawer,
    showCloudModal,
    detailAgent,
    detailAgentFiles,
    newAgentForm,
    installTargetAgent,
    cloudAgents,
    fileNotFound,
    hasChanges,
    guideFiles,
    editingAgent,
    pageLoading,
    loading,
    detailLoading,
    lastSaved,
    detailInstalling,
    showInstallProgress,
    installSteps,
    installProgressDone,
    avatarInputRef,
    getAgentColor,
    getSelectedAgentName,
    getModelName,
    getModelDisplayName,
    selectAgent,
    openEditDrawer,
    showAgentDetail,
    isAgentAdded,
    isAgentInstalled,
    loadAgents,
    loadCurrentFile,
    saveCurrentFile,
    resetContent,
    onContentChange,
    onMultiAgentModeChange,
    closeAddModal,
    createAgent,
    selectAvatar,
    onAvatarChange,
    selectWorkspaceFolder,
    syncFromCloud,
    addFromCloud,
    openInstallModal,
    closeInstallDrawer,
    doInstall,
    uninstallAgent,
    deleteMyAgent,
    onDrawerSaveSettings,
  };
}
