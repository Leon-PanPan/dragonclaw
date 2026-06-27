import { ref, reactive, computed, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { modelAdminApi } from '@/api/admin-rpc';
import { agentApi } from '@/api/agent';
import { soulApi } from '@/api/soul';

export function useAgentInstallDrawer(props, emit) {
  const avatarInputRef = ref(null);
  const activeTab = ref('settings');
  const saving = ref(false);

  // 安装表单
  const formData = reactive({
    id: '',
    name: '',
    workspace: '',
    description: '',
    model: '',
    avatarBase64: '',
    avatarPreview: '',
    avatarPath: '',
  });

  // 4 个提示词文件内容（独立存储，切换 tab 不丢失）
  const promptContents = reactive({
    tools: '',
    soul: '',
    agents: '',
    heartbeat: '',
  });

  const installModels = ref([]);

  const cascaderOptions = computed(() => {
    const groups = {};
    for (const m of installModels.value || []) {
      const provider = (m && ((m.provider || m.id?.split?.('/')?.[0]))) || 'default';
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(m);
    }
    return Object.entries(groups)
      .map(([provider, models]) => ({
        label: provider,
        value: provider,
        children: models.map(m => ({
          label: m.name || m.id,
          value: m.id,
        })),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  async function loadModels() {
    try {
      const r = await modelAdminApi.list();
      installModels.value = r?.models || [];
    } catch (e) {
      console.warn('[AgentInstallDrawer] 加载模型失败:', e.message);
    }
  }

  // 4 个提示词 Tab
  const promptTabs = [
    { key: 'tools', label: '擅长工具', filename: 'TOOLS.md', description: '配置智能体擅长的工具和技能' },
    { key: 'soul', label: '灵魂定义', filename: 'SOUL.md', description: '描述智能体的核心职责、工作准则和边界' },
    { key: 'agents', label: '智能代理', filename: 'AGENTS.md', description: '定义智能代理、任务派发规范和团队通信机制' },
    { key: 'heartbeat', label: '主动执行', filename: 'HEARTBEAT.md', description: '配置心跳任务，主动定期执行检查' },
  ];

  const currentPromptFile = computed(() => {
    return promptTabs.find(f => f.key === activeTab.value) || null;
  });

  const tabs = computed(() => [
    { key: 'settings', label: '设置' },
    ...promptTabs.map(f => ({ key: f.key, label: f.label })),
  ]);

  // watch agent prop → 预填表单
  watch(() => props.agent, (agent) => {
    if (!agent) return;
    const sign = String(agent.sign || agent.sid || agent.id || '').trim();
    const randomSuffix = Math.floor(Math.random() * 90) + 10;
    const agentId = sign ? `${sign}_${randomSuffix}` : `agent_${randomSuffix}`;
    formData.id = agentId;
    formData.name = String(agent.name || '').trim();
    formData.workspace = agent.workspace && agent.workspace.trim()
      ? agent.workspace.trim()
      : `~/.openclaw/workspace-${agentId}`;
    formData.description = agent.description || '';
    formData.model = agent.model || '';
    formData.avatarPreview = agent.avatar || '';
    formData.avatarPath = agent.avatar || '';
    formData.avatarBase64 = '';
    activeTab.value = 'settings';
  }, { immediate: true });

  // 抽屉打开时：加载模型 + 拉取智能体 prompt 文件
  watch(() => props.visible, (visible) => {
    console.log('[AgentInstallDrawer] visible changed:', visible, 'agent:', props.agent?.id, props.agent?.sid);
    if (!visible) return;
    loadModels();
    const agent = props.agent;
    if (!agent) {
      console.warn('[AgentInstallDrawer] visible=true but agent is null');
      return;
    }
    // 统一使用 id 作为 detail API 参数（列表返回的数字 id）
    const detailId = agent.id || agent.sid;
    console.log('[AgentInstallDrawer] 开始拉取 prompt, detailId:', detailId);
    if (detailId) loadPrompts(detailId);
  });

  async function loadPrompts(agentId) {
    if (!agentId) return;
    try {
      const detail = await soulApi.detail({ id: agentId });
      if (!detail || !detail.status) {
        console.warn('[AgentInstallDrawer] prompt 加载失败:', detail?.status, detail?.message);
        return;
      }
      // 头像：detail 版本优先（列表接口不含 avatar 或为默认值）
      if (detail.avatar) {
        formData.avatarPreview = detail.avatar;
        formData.avatarPath = detail.avatar;
      }
      // 描述：detail 版本优先
      if (detail.description) {
        formData.description = detail.description;
      }

      // 提示词：兼容多种格式 + JSON 字符串自动解析 + 宽泛扫描
      let prompts = detail.prompt || detail.soul?.prompt || detail.data?.prompt || null;
      // prompts 可能是 JSON 字符串
      if (typeof prompts === 'string' && prompts.trim()) {
        try { prompts = JSON.parse(prompts); } catch { prompts = null; }
      }
      // 宽泛扫描：遍历 detail 所有一级属性，找含 tools/soul/agents/heartbeat keys 的对象
      if (!prompts || !(prompts.tools || prompts.soul || prompts.agents || prompts.heartbeat)) {
        for (const val of Object.values(detail)) {
          if (val && typeof val === 'object' && !Array.isArray(val)
            && (val.tools || val.soul || val.agents || val.heartbeat)) {
            prompts = val;
            break;
          }
        }
      }
      console.log('[AgentInstallDrawer] detail keys:', Object.keys(detail), '| prompt src:', typeof detail.prompt, '| parsed keys:', prompts && typeof prompts === 'object' ? Object.keys(prompts) : 'N/A');

      if (prompts && typeof prompts === 'object') {
        promptContents.tools = prompts.tools || '';
        promptContents.soul = prompts.soul || '';
        promptContents.agents = prompts.agents || '';
        promptContents.heartbeat = prompts.heartbeat || '';
        console.log('[AgentInstallDrawer] prompt 加载完成:', { tools: !!prompts.tools, soul: !!prompts.soul, agents: !!prompts.agents, heartbeat: !!prompts.heartbeat });
      } else {
        console.warn('[AgentInstallDrawer] prompt 未找到, 尝试 raw prompt type:', typeof detail.prompt, detail.prompt?.[0]?.toString?.()?.substring?.(0, 100));
      }
    } catch (e) {
      console.warn('[AgentInstallDrawer] 加载 prompt 异常:', e.message);
    }
  }

  // 重置表单
  function resetForm() {
    if (!props.agent) return;
    const agent = props.agent;
    const sign = String(agent.sign || agent.sid || agent.id || '').trim();
    const randomSuffix = Math.floor(Math.random() * 90) + 10;
    const agentId = sign ? `${sign}_${randomSuffix}` : `agent_${randomSuffix}`;
    formData.id = agentId;
    formData.name = String(agent.name || '').trim();
    formData.workspace = agent.workspace && agent.workspace.trim()
      ? agent.workspace.trim()
      : `~/.openclaw/workspace-${agentId}`;
    formData.description = agent.description || '';
    formData.model = agent.model || '';
    formData.avatarPreview = agent.avatar || '';
    formData.avatarBase64 = '';
  }

  // 头像
  function selectAvatar() {
    avatarInputRef.value?.click();
  }

  function onAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      formData.avatarPreview = ev.target.result;
      formData.avatarBase64 = ev.target.result.split(',')[1];
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // 工作区浏览
  async function selectWorkspaceFolder() {
    try {
      const result = await agentApi.openDirectoryDialog({ title: '选择智能体工作区目录' });
      if (result && !result.canceled && result.filePaths?.length > 0) {
        formData.workspace = result.filePaths[0];
      }
    } catch (e) {
      console.error('[AgentInstallDrawer] 选择目录失败:', e);
      Message.error('选择目录失败: ' + (e.message || '未知错误'));
    }
  }

  // 提交
  async function handleInstall() {
    if (saving.value) return;
    if (!formData.name.trim()) {
      Message.warning('请输入智能体名称');
      return;
    }
    if (!formData.id.trim()) {
      Message.warning('请输入智能体 ID（仅英文/数字/-/_）');
      return;
    }
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(formData.id.trim())) {
      Message.warning('智能体 ID 必须以英文字母开头，仅含字母/数字/-/_，最多 64 字符');
      return;
    }
    if (!formData.workspace.trim()) {
      Message.warning('请输入工作区目录');
      return;
    }
    if (!formData.model) {
      Message.warning('请选择默认模型');
      return;
    }

    saving.value = true;
    try {
      emit('install', {
        form: { ...formData },
        prompts: { ...promptContents },
      });
    } finally {
      // 外部的 doInstall 完成后会通过 installDrawerRef.setSaving(false) 恢复
    }
  }

  return {
    avatarInputRef,
    activeTab,
    saving,
    formData,
    promptContents,
    promptTabs,
    currentPromptFile,
    tabs,
    cascaderOptions,
    loadModels,
    selectAvatar,
    onAvatarChange,
    selectWorkspaceFolder,
    resetForm,
    handleInstall,
    setSaving,
  };

  function setSaving(val) {
    saving.value = val;
  }
}
