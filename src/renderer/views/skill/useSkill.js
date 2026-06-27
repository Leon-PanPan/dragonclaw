import { ref, computed, onMounted, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { fileApi, skillApi, systemApi } from '@/api/gateway';
import { agentAdminApi, skillsAdminApi } from '@/api/admin-rpc';

const SKILLS_API_BASE = 'http://api.dragonclaw.cc/cloud/api/skills';

const parseStats = (stats) => {
  if (!stats) return {};
  if (typeof stats === 'object') return stats;
  try {
    return JSON.parse(stats);
  } catch (e) {
    return {};
  }
};

const parseTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags !== 'string') return [];
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  return tags
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((t) => t.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
};

const mapSkill = (item) => {
  if (!item) return null;
  const stats = parseStats(item.stats);
  const categoryIds = Array.isArray(item.categoryIds) ? item.categoryIds : [];
  const description = item.descriptionZh || item.descriptionEn || '';
  const name = item.nameZh || item.nameEn || item.slug || '';
  const homepage = item.homepage || item.icon || '';
  return {
    id: item.id,
    slug: item.slug || item.nameEn || String(item.id),
    name,
    description,
    version: item.version || '',
    author: item.author || '',
    install_count: stats.downloads || 0,
    installs_all_time: stats.installsAllTime || 0,
    stars: stats.stars || 0,
    comments: stats.comments || 0,
    updated_at: item.updatedAt || item.createdAt || '',
    created_at: item.createdAt || '',
    tags: parseTags(item.tags),
    categoryIds,
    official: item.isTranslated || false,
    recommended: item.isTranslated || false,
    icon: item.icon || '',
    homepage,
  };
};

export function useSkill() {

const recommendedSkills = ref([]);

const skillsPage = ref({
  dataList: [],
  page: 1,
  size: 20,
  total: 0,
  totalPage: 0,
});

const skills = ref([]);

const openClawHome = ref('');
const viewMode = ref('grid');
const refreshing = ref(false);
const pageLoading = ref(true);

const activeTab = ref('recommended');

const recommendedKeyword = ref('');

const categories = ref([]);

const allKeyword = ref('');
const allCategory = ref('');
const allSortBy = ref('downloads');
const allPage = ref(1);
const allPageSize = ref(20);
const allTotal = ref(0);

const clawhubLoggedIn = ref(false);
const clawhubLogging = ref(false);

const selectedAgent = ref('all');
const agentList = ref([]);

const filteredAgentList = computed(() => {
  return agentList.value.filter(agent => agent.id !== 'main');
});

watch([allCategory, allSortBy, allPageSize], () => {
  allPage.value = 1;
  loadAllSkillsFromApi();
});

const filteredRecommendedSkillsAll = computed(() => {
  let list = recommendedSkills.value || [];
  if (recommendedKeyword.value) {
    const kw = recommendedKeyword.value.toLowerCase();
    list = list.filter(s =>
      (s.name && s.name.toLowerCase().includes(kw)) ||
      (s.description && s.description.toLowerCase().includes(kw))
    );
  }
  return list;
});

const detailModal = ref({
  visible: false,
  skill: null,
});

const availableWorkspaces = computed(() => {
  const workspaces = [{ id: 'global', name: '全局(默认智能体)' }];
  agentList.value.forEach(agent => {
    if (agent.id !== 'main' && agent.id !== 'global') {
      workspaces.push({ id: agent.id, name: agent.identity?.name || agent.id });
    }
  });
  return workspaces;
});

const getScopeDisplay = (skill) => {
  if (skill.workspace === 'global') return '全局';
  const agent = agentList.value.find(a => a.id === skill.workspace);
  return agent?.identity?.name || skill.workspace || skill.scope;
};

const getUninstallCommand = (skill) => {
  const workspace = skill.workspace;
  const home = openClawHome.value || '~/.openclaw';
  let workdir = '';
  if (workspace === 'global') {
    workdir = home;
  } else if (workspace === 'main') {
    workdir = home + '/workspace';
  } else if (workspace) {
    workdir = home + '/workspace-' + workspace;
  }

  const skillSlug = skill.slug || skill.id;
  return `clawhub uninstall ${skillSlug} --workdir=${workdir}`;
};

const copyUninstallCommand = async (skill) => {
  const command = getUninstallCommand(skill);
  try {
    await navigator.clipboard.writeText(command);
    Message.success('卸载命令已复制到剪贴板');
  } catch (e) {
    Message.error('复制失败');
  }
};

const getSkillColor = (category) => {
  const colors = {
    '工具类': '#2A5CAA',
    '自动化': '#00B4F0',
    '数据处理': '#4CD964',
    '网络服务': '#FF6B35',
    '硬件控制': '#8E44AD',
    '社交': '#3498DB',
    '教育': '#E74C3C',
    '娱乐': '#F39C12',
    '智能开发': '#165DFF',
  };
  return colors[category] || '#86909C';
};

const getSkillIcon = (skill) => {
  if (!skill || !skill.name) return '?';
  const firstChar = skill.name.charAt(0);
  if (/[a-zA-Z]/.test(firstChar)) {
    return firstChar.toUpperCase();
  }
  return firstChar;
};

const getTagColor = (tag) => {
  const colors = [
    'blue', 'green', 'orange', 'red', 'purple', 'cyan', 'pink', 'arcoblue',
  ];
  const index = tag.charCodeAt(0) % colors.length;
  return colors[index];
};

const formatDate = (dateString) => {
  if (!dateString) return '未知';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

const truncateName = (name, max = 20) => {
  if (!name) return '';
  const str = String(name);
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
};

const loadRecommendedSkills = async () => {
  try {
    const result = await fileApi.fetch({ url: `${SKILLS_API_BASE}/recommend`, method: 'GET' });
    if (!result.success) {
      throw new Error(result.error || '请求推荐技能失败');
    }
    const resp = JSON.parse(result.data);
    if (resp.code !== 200) {
      throw new Error(resp.message || '推荐接口返回错误');
    }
    const list = Array.isArray(resp.data)
      ? resp.data.map(mapSkill).filter(Boolean).map((s) => ({ ...s, installed: isInstalledBySlug(s) }))
      : [];
    recommendedSkills.value = list;
    console.log('推荐技能加载完成：', list.length, '个');
  } catch (error) {
    console.error('加载推荐技能失败:', error);
    Message.error(`加载推荐技能失败: ${error.message}`);
  }
};

const loadCategories = async () => {
  try {
    const result = await fileApi.fetch({ url: `${SKILLS_API_BASE}/categories`, method: 'GET' });
    if (!result.success) {
      throw new Error(result.error || '请求分类失败');
    }
    const resp = JSON.parse(result.data);
    if (resp.code !== 200) {
      throw new Error(resp.message || '分类接口返回错误');
    }
    const list = Array.isArray(resp.data) ? resp.data : [];
    categories.value = [
      { id: '', name: '全部' },
      ...list
        .filter((c) => c && c.id !== 0 && c.id !== '0')
        .map((c) => ({ id: String(c.id), name: c.name || String(c.id) })),
    ];
    console.log('分类加载完成：', categories.value.length, '个');
  } catch (error) {
    console.error('加载分类失败:', error);
    categories.value = [{ id: '', name: '全部' }];
  }
};

const loadSkills = async () => {
  refreshing.value = true;
  try {
    try {
      const wsResult = await agentAdminApi.list();
      const wsAgents = wsResult?.agents?.length > 0
        ? wsResult.agents.map(a => ({
            id: a.id || a.agentId,
            identity: a.identity || { name: a.id },
            workspace: a.workspace || ''
          }))
        : [];
      agentList.value = wsAgents;
    } catch (error) {
      console.warn('获取代理列表失败:', error);
    }

    await loadRecommendedSkills();

    recommendedSkills.value = (recommendedSkills.value || []).map(skill => ({
      ...skill,
      installing: false,
    }));

    skills.value = [...recommendedSkills.value];

    Message.success(`技能数据加载成功，已加载 ${skills.value.length} 个技能（${installedSlugSet.value.size} 个已安装）`);
  } catch (error) {
    console.error('同步技能数据失败:', error);
    Message.error(`同步技能数据失败: ${error.message}`);
  } finally {
    refreshing.value = false;
  }
};

const handleAllPageChange = (page) => {
  allPage.value = page;
  loadAllSkillsFromApi();
};

const handleAllPageSizeChange = (size) => {
  allPageSize.value = size;
  allPage.value = 1;
  loadAllSkillsFromApi();
};

const loadAllSkillsFromApi = async () => {
  try {
    const params = new URLSearchParams();
    params.set('page', String(allPage.value));
    params.set('size', String(allPageSize.value));
    params.set('sort', allSortBy.value);
    if (allKeyword.value && allKeyword.value.trim()) {
      params.set('keyword', allKeyword.value.trim());
    }
    if (allCategory.value) {
      params.set('categoryId', String(allCategory.value));
    }
    const apiUrl = `${SKILLS_API_BASE}?${params.toString()}`;
    console.log('加载全部技能 API:', apiUrl);

    const result = await fileApi.fetch({ url: apiUrl, method: 'GET' });
    if (!result.success) {
      throw new Error(result.error || '请求全部技能失败');
    }
    const resp = JSON.parse(result.data);
    if (resp.code !== 200) {
      throw new Error(resp.message || '全部技能接口返回错误');
    }
    const pageData = resp.data || {};
    const records = Array.isArray(pageData.records) ? pageData.records : [];

    const newSkills = records.map((raw) => {
      const skill = mapSkill(raw);
      return {
        ...skill,
        installing: false,
        installed: isInstalledBySlug(skill),
      };
    });

    skillsPage.value.dataList = newSkills;
    skillsPage.value.page = pageData.page || allPage.value;
    skillsPage.value.size = pageData.size || allPageSize.value;
    skillsPage.value.total = pageData.total || 0;
    skillsPage.value.totalPage = pageData.pages || 0;
    allTotal.value = pageData.total || 0;

    console.log('从API加载了', newSkills.length, '个技能，总计', allTotal.value);
  } catch (error) {
    console.error('从API加载技能失败:', error);
    Message.error(`加载技能失败: ${error.message}`);
  }
};

const refreshSkills = async () => {
  refreshing.value = true;
  try {
    await loadSkills();
    await loadAllSkillsFromApi();
    Message.success('技能数据同步完成');
  } catch (error) {
    console.error('刷新技能失败:', error);
    Message.error(`刷新技能失败: ${error.message}`);
  } finally {
    refreshing.value = false;
  }
};

const showSkillDetail = (skill) => {
  detailModal.value = {
    visible: true,
    skill: { ...skill },
  };
};

const findSkillIndices = (skill) => {
  const matches = [];
  const ids = new Set([skill.id, skill.slug].filter((v) => v !== undefined && v !== null));

  const check = (list, bucket) => {
    if (!Array.isArray(list)) return;
    list.forEach((item, idx) => {
      if (ids.has(item.id) || ids.has(item.slug)) {
        matches.push({ bucket, index: idx });
      }
    });
  };

  check(skills.value, 'skills');
  check(recommendedSkills.value, 'recommended');
  check(skillsPage.value.dataList, 'page');

  return matches;
};

const setInstalling = (matches, value) => {
  const targets = [
    { list: skills.value },
    { list: recommendedSkills.value },
    { list: skillsPage.value.dataList },
  ];
  matches.forEach(({ bucket, index }) => {
    const target = targets[bucket];
    if (target?.list && target.list[index]) {
      target.list[index].installing = value;
    }
  });
};

const setInstalled = (matches, value) => {
  const targets = [
    { list: skills.value },
    { list: recommendedSkills.value },
    { list: skillsPage.value.dataList },
  ];
  matches.forEach(({ bucket, index }) => {
    const target = targets[bucket];
    if (target?.list && target.list[index]) {
      target.list[index].installed = value;
    }
  });
};

const installingGlobal = ref(false);

const confirmInstall = async (skill) => {
  if (!skill?.slug) {
    Message.error('该技能缺少 slug 字段，无法安装');
    return;
  }
  if (isInstalledBySlug(skill)) {
    Message.warning(`技能 "${skill.name}" 已安装`);
    return;
  }

  installingGlobal.value = true;

  const matches = findSkillIndices(skill);
  setInstalling(matches, true);

  try {
    const result = await skillsAdminApi.install({
      source: 'clawhub',
      slug: skill.slug,
    });

    if (result?.ok) {
      Message.success(`技能 "${skill.name}" 安装成功！`);
      try {
        await loadSkillsStatus();
      } catch (e) {
        console.warn('刷新已安装列表失败:', e);
      }
      setInstalled(matches, true);
      markInstalledForLists();
    } else {
      Message.error(`安装失败: ${result?.error || result?.message || '未知错误'}`);
    }
  } catch (error) {
    console.error('[SkillInstall] 安装失败:', error);
    Message.error(`安装失败: ${error.message}`);
  } finally {
    installingGlobal.value = false;
    setInstalling(matches, false);
  }
};

const uninstallConfirmModal = ref({
  visible: false,
  skill: null,
  loading: false,
});

const openUninstallConfirm = (skill) => {
  uninstallConfirmModal.value = {
    visible: true,
    skill,
    loading: false,
  };
};

const cancelUninstallConfirm = () => {
  if (uninstallConfirmModal.value.loading) return;
  uninstallConfirmModal.value = { visible: false, skill: null, loading: false };
};

const confirmUninstall = async () => {
  const skill = uninstallConfirmModal.value.skill;
  if (!skill) return;
  uninstallConfirmModal.value.loading = true;

  const matches = findSkillIndices(skill);
  setInstalling(matches, true);

  const home = openClawHome.value || '/home/leon/.openclaw';
  let workdir = null;
  if (skill.workspace === 'global') {
    workdir = home;
  } else if (skill.workspace === 'main') {
    workdir = home + '/workspace';
  } else if (skill.workspace) {
    workdir = home + '/workspace-' + skill.workspace;
  }

  try {
    const skillSlug = skill.slug || (typeof skill.id === 'string' ? skill.id : String(skill.id));
    const result = await skillApi.uninstall({ skillSlug, workdir });

    if (result.success) {
      uninstallConfirmModal.value = { visible: false, skill: null, loading: false };
      Message.success(`技能 "${skill.name}" 卸载成功！`);
      try {
        await loadSkillsStatus();
      } catch (e) {
        console.warn('刷新已安装列表失败:', e);
      }
      setInstalled(matches, false);
      markInstalledForLists();
    } else {
      Message.error(`卸载失败: ${result.error || result.message}`);
    }
  } catch (error) {
    Message.error(`卸载失败: ${error.message}`);
  } finally {
    uninstallConfirmModal.value.loading = false;
    setInstalling(matches, false);
  }
};

const handleClawhubLogin = async () => {
  try {
    if (!window.electronAPI) {
      Message.error('clawhub登录功能不可用');
      return;
    }

    const result = await skillApi.clawhubLogin();

    if (result.success) {
      Message.success('clawhub登录成功！');
    } else {
      Message.error(`clawhub登录失败: ${result.message || '未知错误'}`);
    }
  } catch (error) {
    console.error('clawhub登录失败:', error);
    Message.error(`clawhub登录失败: ${error.message}`);
  }
};

const handleAllKeywordSearch = () => {
  allPage.value = 1;
  loadAllSkillsFromApi();
};

// ===== 管理 Tab 相关状态 =====
const manageKeyword = ref('');
const manageLoading = ref(false);
const skillsReport = ref(null);
const groupCollapseState = ref({});
const installedSlugSet = ref(new Set());

const extractSlugFromSkillKey = (skillKey) => {
  if (!skillKey) return '';
  const str = String(skillKey);
  if (str.includes(':')) {
    return str.split(':').pop().trim();
  }
  if (str.includes('/')) {
    return str.split('/').pop().trim();
  }
  return str.trim();
};

const rebuildInstalledSlugSet = () => {
  const list = Array.isArray(skillsReport.value?.skills) ? skillsReport.value.skills : [];
  const set = new Set();
  for (const skill of list) {
    const slug = extractSlugFromSkillKey(skill.skillKey);
    if (slug) set.add(slug);
    if (skill.name) set.add(String(skill.name));
  }
  installedSlugSet.value = set;
};

const isInstalledBySlug = (skill) => {
  if (!skill) return false;
  const set = installedSlugSet.value;
  if (!set || set.size === 0) return false;
  if (skill.slug && set.has(skill.slug)) return true;
  if (skill.name && set.has(String(skill.name))) return true;
  return false;
};

const loadSkillsStatus = async () => {
  manageLoading.value = true;
  try {
    const result = await skillsAdminApi.status();
    skillsReport.value = result;
    rebuildInstalledSlugSet();
    markInstalledForLists();
    console.log('[SkillManage] 技能状态加载成功:', result);
  } catch (error) {
    console.error('[SkillManage] 加载技能状态失败:', error);
    Message.error('加载技能列表失败: ' + error.message);
  } finally {
    manageLoading.value = false;
  }
};

const markInstalledForLists = () => {
  const apply = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach((item, idx) => {
      list[idx] = { ...item, installed: isInstalledBySlug(item) };
    });
  };
  apply(recommendedSkills.value);
  apply(skillsPage.value.dataList);
  apply(skills.value);
};

const groupedSkills = computed(() => {
  if (!skillsReport.value?.skills) return [];

  const groups = {};
  const groupOrder = ['openclaw-workspace', 'openclaw-managed', 'openclaw-extra', 'openclaw-bundled'];
  const groupLabels = {
    'openclaw-workspace': '工作区技能',
    'openclaw-bundled': '内置技能',
    'openclaw-managed': '已安装技能',
    'openclaw-extra': '额外技能'
  };

  let filtered = skillsReport.value.skills;
  if (manageKeyword.value) {
    const kw = manageKeyword.value.toLowerCase();
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(kw) ||
      s.description?.toLowerCase().includes(kw)
    );
  }

  filtered.forEach(skill => {
    const source = skill.source || 'other';
    if (!groups[source]) {
      groups[source] = {
        source,
        label: groupLabels[source] || '其他技能',
        skills: []
      };
    }
    groups[source].skills.push(skill);
  });

  return groupOrder
    .filter(source => groups[source])
    .map(source => groups[source]);
});

const toggleManageGroup = (source) => {
  groupCollapseState.value[source] = !groupCollapseState.value[source];
};

const isManageGroupCollapsed = (source) => {
  return groupCollapseState.value[source] === true;
};

const toggleSkillEnabled = async (skill) => {
  skill._toggling = true;
  try {
    await skillsAdminApi.update({
      skillKey: skill.skillKey,
      enabled: skill.disabled
    });
    await loadSkillsStatus();
    Message.success(skill.disabled ? '已启用' : '已禁用');
  } catch (error) {
    console.error('[SkillManage] 切换技能状态失败:', error);
    Message.error('操作失败: ' + error.message);
  } finally {
    skill._toggling = false;
  }
};

const saveSkillApiKey = async (skill) => {
  try {
    await skillsAdminApi.update({
      skillKey: skill.skillKey,
      apiKey: skill._apiKey || ''
    });
    Message.success('API Key 已保存');
  } catch (error) {
    console.error('[SkillManage] 保存 API Key 失败:', error);
    Message.error('保存失败: ' + error.message);
  }
};

const installSkillDependency = async (skill) => {
  if (!skill.install || !skill.install.length) return;

  const installOption = skill.install[0];
  skill._installing = true;
  try {
    const result = await skillsAdminApi.install({
      name: skill.name,
      installId: installOption.id,
      timeoutMs: 120000
    });
    if (result.ok) {
      Message.success('安装成功');
      await loadSkillsStatus();
    } else {
      Message.error('安装失败: ' + result.message);
    }
  } catch (error) {
    console.error('[SkillManage] 安装依赖失败:', error);
    Message.error('安装失败: ' + error.message);
  } finally {
    skill._installing = false;
  }
};

onMounted(async () => {
  try {
    openClawHome.value = await systemApi.openclawHome();
    console.log('OpenClaw home:', openClawHome.value);
  } catch (e) {
    console.warn('获取 OpenClaw home 失败:', e);
  }

  await loadSkillsStatus();

  await Promise.all([loadSkills(), loadCategories(), loadAllSkillsFromApi()]);
  pageLoading.value = false;
});

return {
  pageLoading,
  activeTab,
  clawhubLoggedIn,
  clawhubLogging,
  handleClawhubLogin,
  recommendedKeyword,
  filteredRecommendedSkills: filteredRecommendedSkillsAll,
  refreshing,
  getSkillColor,
  getSkillIcon,
  getTagColor,
  truncateName,
  showSkillDetail,
  refreshSkills,
  filteredRecommendedSkillsAll,
  allKeyword,
  allCategory,
  allSortBy,
  categories,
  paginatedSkills: computed(() => skillsPage.value.dataList),
  allPage,
  allPageSize,
  allTotal,
  handleAllPageChange,
  handleAllPageSizeChange,
  handleAllKeywordSearch,
  isInstalledBySlug,
  openClawHome,
  detailModal,
  confirmInstall,
  installingGlobal,
  uninstallSkill: openUninstallConfirm,
  uninstallConfirmModal,
  confirmUninstall,
  cancelUninstallConfirm,
  manageKeyword,
  manageLoading,
  skillsReport,
  groupedSkills,
  loadSkillsStatus,
  toggleManageGroup,
  isManageGroupCollapsed,
  toggleSkillEnabled,
  saveSkillApiKey,
  installSkillDependency,
};
}