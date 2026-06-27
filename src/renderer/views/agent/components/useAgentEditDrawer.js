import { ref, reactive, computed, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { agentApi } from '@/api/agent';
import { agentFileAdminApi } from '@/api/admin-rpc';

export function useAgentEditDrawer(props, emit) {
  const AGENT_COLORS = ['#165DFF', '#00B42A', '#FF7D00', '#F53FAD', '#722ED1', '#0FC6C2', '#FADE0A', '#EB0E28'];

  const avatarInputRef = ref(null);
  const activeTab = ref('settings');
  const saving = ref(false);

  const formData = reactive({
    workspace: '',
    model: '',
    desc: '',
    avatarPreview: '',
    avatarBase64: '',
  });

  const editContent = ref('');
  const originalContent = ref('');
  const lastSaved = ref('');

  const currentGuideFile = computed(() => {
    return props.guideFiles?.find(f => f.key === activeTab.value && f.key !== 'settings') || null;
  });

  watch(() => props.agent, (agent) => {
    if (!agent) return;
    formData.workspace = agent.workspace || '';
    let modelId = agent.model || '';
    if (typeof modelId === 'object') {
      modelId = modelId.primary || modelId.id || '';
    }
    formData.model = modelId;
    formData.desc = agent.description || '';
    formData.avatarPreview = agent.avatar || '';
    formData.avatarBase64 = '';
    activeTab.value = 'settings';
  }, { immediate: true });

  watch(activeTab, async (tab) => {
    if (tab === 'settings') return;
    if (props.agent && props.guideFiles) {
      const file = props.guideFiles.find(f => f.key === tab);
      if (file) {
        try {
          const result = await agentFileAdminApi.get({
            agentId: props.agent.id,
            name: file.filename
          });
          editContent.value = result?.file?.content || '';
          originalContent.value = editContent.value;
        } catch (e) {
          editContent.value = '';
          originalContent.value = '';
        }
      }
    }
  });

  function getAgentColor(agentId) {
    if (!agentId) return AGENT_COLORS[0];
    let hash = 0;
    for (let i = 0; i < agentId.length; i++) {
      hash = ((hash << 5) - hash) + agentId.charCodeAt(i);
    }
    return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
  }

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

  async function selectWorkspaceFolder() {
    try {
      const result = await agentApi.openDirectoryDialog({ title: '选择智能体工作区目录' });
      if (result && !result.canceled && result.filePaths?.length > 0) {
        formData.workspace = result.filePaths[0];
      }
    } catch (e) {
      console.error('[AgentEditDrawer] 选择目录失败:', e);
      Message.error('选择目录失败: ' + (e.message || '未知错误'));
    }
  }

  function resetForm() {
    if (props.agent) {
      formData.workspace = props.agent.workspace || '';
      let modelId = props.agent.model || '';
      if (typeof modelId === 'object') {
        modelId = modelId.primary || modelId.id || '';
      }
      formData.model = modelId;
      formData.desc = props.agent.description || '';
      formData.avatarPreview = props.agent.avatar || '';
      formData.avatarBase64 = '';
    }
  }

  async function saveSettings() {
    saving.value = true;
    try {
      emit('save-settings', {
        agentId: props.agent?.id,
        workspace: formData.workspace,
        model: formData.model,
        desc: formData.desc,
        avatar: formData.avatarBase64 || formData.avatarPreview,
      });
    } finally {
      saving.value = false;
    }
  }

  function resetContent() {
    editContent.value = originalContent.value;
  }

  async function saveCurrentFile() {
    if (!currentGuideFile.value || saving.value) return;
    saving.value = true;
    try {
      await agentFileAdminApi.set({
        agentId: props.agent?.id,
        name: currentGuideFile.value.filename,
        content: editContent.value
      });
      originalContent.value = editContent.value;
      lastSaved.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      Message.success(`${currentGuideFile.value.label} 保存成功`);
    } catch (e) {
      Message.error('保存失败: ' + (e.message || '未知错误'));
    } finally {
      saving.value = false;
    }
  }

  function onContentChange() {}

  const tabs = computed(() => {
    const base = [
      { key: 'settings', label: '设置' },
      ...(props.guideFiles || []).map(f => ({ key: f.key, label: f.label }))
    ];
    return base;
  });

  function handleClose() {
    emit('update:visible', false);
  }

  return {
    avatarInputRef,
    activeTab,
    saving,
    formData,
    editContent,
    originalContent,
    lastSaved,
    currentGuideFile,
    getAgentColor,
    selectAvatar,
    onAvatarChange,
    selectWorkspaceFolder,
    resetForm,
    saveSettings,
    resetContent,
    saveCurrentFile,
    onContentChange,
    tabs,
    handleClose,
  };
}
