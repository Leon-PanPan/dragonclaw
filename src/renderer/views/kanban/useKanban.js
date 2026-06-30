import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { wsManager, ConnectionState } from '@/core/websocket/manager';
import { agentAdminApi } from '@/api/admin-rpc';
import { getToolIcon, getToolNameCN, getToolDescCN } from '@/utils/toolI18n';

export function useKanban() {

const pageLoading = ref(true)

const wsConnected = computed(() => wsManager.state?.value === ConnectionState.CONNECTED)

const AGENT_COLORS = [
  '#165DFF', '#00B42A', '#FF7D00', '#F53FAD',
  '#722ED1', '#0FC6C2', '#FADE0A', '#EB0E28'
];

const kanbanData = ref({});
const agentInfo = ref({});
const pollingAgents = ref(new Set());

const drawerVisible = ref(false);
const drawerTitle = ref('');
const currentInstruction = ref(null);

let _kanbanMsgSeq = 0;
const pendingHistoryRequests = new Set();
let unsubscribe = null;

const agentKanbans = computed(() => {
  return Object.entries(kanbanData.value).map(([agentId, data]) => {
    const info = agentInfo.value[agentId] || {};
    const color = info.color || AGENT_COLORS[Math.abs(hashCode(agentId)) % AGENT_COLORS.length];
    
    let sortedTaskSets = [...data.taskSets].sort((a, b) => {
      if (a.isExecuting && !b.isExecuting) return -1;
      if (!a.isExecuting && b.isExecuting) return 1;
      return b.startTime - a.startTime;
    });
    
    const isActive = sortedTaskSets.some(ts => ts.isExecuting);
    
    const summary = { thinkingCount: 0, toolCallCount: 0, tokenTotal: 0 };
    for (const ts of data.taskSets) {
      if (ts.stats) {
        summary.thinkingCount += ts.stats.thinkingCount || 0;
        summary.toolCallCount += ts.stats.toolCallCount || 0;
        summary.tokenTotal += ts.stats.tokenTotal || 0;
      }
    }
    
    return {
      id: agentId,
      name: info.name || agentId,
      color,
      isActive,
      taskSets: sortedTaskSets.slice(0, 2),
      summary
    };
  }).sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
});

const activeCount = computed(() => agentKanbans.value.filter(a => a.isActive).length);

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = ((hash << 5) - hash) + (str || '').charCodeAt(i);
  }
  return hash;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatArgsDisplay(toolName, args) {
  if (!args) return '';
  try {
    const argsObj = typeof args === 'string' ? JSON.parse(args) : args;
    return JSON.stringify(argsObj, null, 2);
  } catch (e) {
    return typeof args === 'string' ? args : JSON.stringify(args);
  }
}

function parseMessageContent(text) {
  if (!text) return { html: '', text: '' };
  return { html: text.replace(/</g, '&lt;').replace(/>/g, '&gt;'), text };
}

function getOrCreateAgent(agentId) {
  if (!kanbanData.value[agentId]) {
    kanbanData.value[agentId] = { taskSets: [] };
  }
  return kanbanData.value[agentId];
}

function assignAgentColor(agentId) {
  if (!agentInfo.value[agentId]) {
    const used = Object.values(agentInfo.value).map(a => a.color);
    const available = AGENT_COLORS.find(c => !used.includes(c)) || AGENT_COLORS[Object.keys(agentInfo.value).length % AGENT_COLORS.length];
    agentInfo.value[agentId] = { name: agentId, color: available };
  }
}

const pollingControllers = ref({});

async function startPollingAgent(agentId, senderId) {
  const key = `${agentId}_${senderId}`;
  
  if (pollingControllers.value[key]?.isRunning) {
    console.debug(`[Kanban] ${key} 正在轮询中，跳过`);
    return;
  }
  
  console.debug(`[Kanban] 开始轮询 ${key}`);
  
  pollingControllers.value[key] = {
    isRunning: true,
    timer: null
  };
  
  await pollOnce(agentId, senderId, key);
}

async function pollOnce(agentId, senderId, key) {
  if (!pollingControllers.value[key]?.isRunning) {
    return;
  }
  
  const agentData = kanbanData.value[agentId];
  
  const hasExecutingTask = agentData?.taskSets.some(ts => ts.isExecuting);
  
  if (!hasExecutingTask) {
    console.debug(`[Kanban] ${key} 任务执行结束，停止轮询`);
    stopPollingAgent(key);
    return;
  }
  
  try {
    const sessionKey = `agent:${agentId}:direct:${senderId}`;
    const history = await wsManager.getChatHistory(sessionKey, 100);
    if (history?.messages) {
      updateKanbanFromMessages(agentId, history.messages);
    }
  } catch (e) {
    console.debug(`[Kanban] ${key} 轮询失败: ${e.message}`);
  }
  
  if (pollingControllers.value[key]?.isRunning) {
    pollingControllers.value[key].timer = setTimeout(() => {
      pollOnce(agentId, senderId, key);
    }, 2000);
  }
}

function stopPollingAgent(key) {
  if (pollingControllers.value[key]) {
    pollingControllers.value[key].isRunning = false;
    if (pollingControllers.value[key].timer) {
      clearTimeout(pollingControllers.value[key].timer);
    }
    delete pollingControllers.value[key];
  }
}

async function loadAllData() {
  if (wsManager.state?.value !== ConnectionState.CONNECTED) return;
  
  try {
    const result = await agentAdminApi.list();
    const agents = result?.agents || [];
    
    const hasMain = agents.some(a => (a.id || a.agentId) === 'main');
    if (!hasMain) {
      agents.push({ id: 'main' });
    }
    
    for (const agent of agents) {
      const agentId = agent.id || agent.agentId || 'main';
      assignAgentColor(agentId);
      if (agent.identity?.name) {
        agentInfo.value[agentId].name = agent.identity.name;
      }
      
      const sessionKey = `agent:${agentId}:direct:ou_97c3e966d4cca186a20cecad73c4a263`;
      try {
        const history = await wsManager.getChatHistory(sessionKey, 100);
        if (history?.messages) {
          updateKanbanFromMessages(agentId, history.messages);
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
}

function updateKanbanFromMessages(agentId, messages) {
  const agentData = getOrCreateAgent(agentId);
  
  let currentTaskSet = null;
  let currentThinkingText = '';
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    if (msg.role === 'user') {
      const text = extractTextFromContent(msg.content);
      const taskId = `hist_${msg.timestamp || Date.now()}`;
      
      if (agentData.taskSets.some(ts => ts.id === taskId)) {
        continue;
      }
      
      const existingTask = agentData.taskSets.find(ts => ts.isExecuting);
      if (existingTask) {
        existingTask.userMessage = text.substring(0, 100);
        existingTask.time = formatTime(msg.timestamp);
        currentTaskSet = existingTask;
        currentThinkingText = '';
        continue;
      } else {
        currentTaskSet = {
          id: taskId,
          userMessage: text.substring(0, 100),
          time: formatTime(msg.timestamp),
          startTime: msg.timestamp || Date.now(),
          isExecuting: false,
          thinkingText: '',
          instructions: [],
          stats: { thinkingCount: 0, toolCallCount: 0, tokenTotal: 0 }
        };
        agentData.taskSets.unshift(currentTaskSet);
      }
      
      currentThinkingText = '';
      
      if (agentData.taskSets.length > 5) {
        agentData.taskSets = agentData.taskSets.slice(0, 5);
      }
    } else if (msg.role === 'assistant' && msg.stopReason === 'toolUse') {
      const contentItems = Array.isArray(msg.content) ? msg.content : [msg.content];
      let hasThinkingText = false;
      
      if (msg.usage?.totalTokens) {
        if (currentTaskSet) currentTaskSet.stats.tokenTotal = Math.max(currentTaskSet.stats.tokenTotal || 0, msg.usage.totalTokens);
      } else if (msg.usage?.inputTokens && msg.usage?.outputTokens) {
        if (currentTaskSet) currentTaskSet.stats.tokenTotal = Math.max(currentTaskSet.stats.tokenTotal || 0, msg.usage.inputTokens + msg.usage.outputTokens);
      }
      
      for (const item of contentItems) {
        if (item.type === 'text' && item.text) {
          currentThinkingText = item.text;
          if (!hasThinkingText) {
            if (currentTaskSet) currentTaskSet.stats.thinkingCount = (currentTaskSet.stats.thinkingCount || 0) + 1;
            hasThinkingText = true;
          }
        } else if (item.type === 'toolCall') {
          const instruction = createInstruction(item, msg.timestamp, currentThinkingText, currentTaskSet?.isExecuting);
          if (currentTaskSet) {
            const exists = currentTaskSet.instructions.some(inst => inst.id === instruction.id);
            if (!exists) {
              currentTaskSet.instructions.unshift(instruction);
            }
          }
        }
      }
      
      if (currentTaskSet && currentThinkingText) {
        currentTaskSet.thinkingText = currentThinkingText.substring(0, 200);
      }
      
      if (currentTaskSet) {
        currentTaskSet.stats.toolCallCount = currentTaskSet.instructions.length;
      }
    } else if (msg.role === 'toolResult') {
      if (currentTaskSet) {
        const toolCallId = msg.toolCallId;
        const instruction = currentTaskSet.instructions.find(inst => inst.id.includes(toolCallId) || toolCallId.includes(inst.id.replace('inst_', '')));
        if (instruction) {
          instruction.status = msg.isError ? 'error' : 'success';
          const resultText = extractTextFromContent(msg.content);
          instruction.result = resultText;
          instruction.resultHtml = parseMessageContent(resultText).html;
        }
      }
    }
  }
}

function createInstruction(item, timestamp, thinkingText, isTaskExecuting = false) {
  const toolName = item.name || 'unknown';
  const args = item.arguments;
  return {
    id: `inst_${item.id}`,
    toolName,
    icon: getToolIcon(toolName),
    toolNameCN: getToolNameCN(toolName),
    commandDesc: getToolDescCN(toolName, args),
    argsDisplay: formatArgsDisplay(toolName, args),
    status: isTaskExecuting ? 'running' : 'success',
    time: formatTime(timestamp),
    elapsed: null,
    thinkingText: thinkingText || '',
    args,
    result: '',
    resultHtml: ''
  };
}

function extractTextFromContent(content) {
  if (!content) return '';
  if (typeof content === 'string') {
    const match = content.match(/^ou_[a-z0-9]+:\s*(.+)$/i);
    if (match) {
      return match[1];
    }
    if (content.startsWith('ou_') && content.length > 30 && !content.includes(' ')) {
      return '';
    }
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(item => {
      if (item.type === 'text') return item.text || '';
      if (item.type === 'toolCall') return `[${item.name}]`;
      return '';
    }).join('');
  }
  return String(content);
}

function handleWsMessage(data) {
  _kanbanMsgSeq++;
  const stream = data.payload?.stream || '-';
  console.debug(`[Kanban] #${_kanbanMsgSeq} id=${data.id || data.seq || '-'} type=${data.type} event=${data.event || '-'} stream=${stream}`);
  
  if (data.type === 'event' && data.event === 'health') {
    handleHealthEvent(data);
    return;
  }
  
  if (data.type === 'event' && data.event === 'agent') {
    handleAgentEvent(data);
    
    const sessionKey = data.payload?.sessionKey || '';
    
    const parts = sessionKey.split(':');
    const agentId = parts[1] || 'main';
    
    let senderId = '';
    for (const part of parts) {
      if (part.startsWith('ou_')) {
        senderId = part;
        break;
      }
    }
    
    const isValidSender = senderId.startsWith('ou_') && senderId.length > 20;
    if (!isValidSender) {
      return;
    }
    
    const agentData = kanbanData.value[agentId];
    
    const hasNoTask = !agentData || agentData.taskSets.length === 0;
    const taskNeedsData = agentData?.taskSets.some(ts => ts.isExecuting && ts.instructions.length === 0);
    
    if ((stream === 'lifecycle' || stream === 'assistant') && (hasNoTask || taskNeedsData)) {
      startPollingAgent(agentId, senderId);
    }
  }
}

function handleHealthEvent(data) {
  const payload = data.payload || {};
  const agents = payload.agents || [];
  
  console.debug(`[Kanban] handleHealthEvent: ${agents.length} agents`);
  
  for (const agent of agents) {
    const agentId = agent.agentId;
    if (!agentId) continue;
    
    const sessions = agent.sessions?.recent || [];
    if (sessions.length === 0) continue;
    
    for (const session of sessions) {
      const sessionKey = session.key;
      if (!sessionKey) continue;
      
      const parts = sessionKey.split(':');
      let senderId = '';
      for (const part of parts) {
        if (part.startsWith('ou_')) {
          senderId = part;
          break;
        }
      }
      if (!senderId) continue;
      
      console.debug(`[Kanban] health 发现 agent=${agentId} sender=${senderId} sessionKey=${sessionKey}`);
      
      const agentData = kanbanData.value[agentId];
      const hasNoTask = !agentData || agentData.taskSets.length === 0;
      const taskNeedsData = agentData?.taskSets.some(ts => ts.isExecuting && ts.instructions.length === 0);
      
      if (hasNoTask || taskNeedsData) {
        console.debug(`[Kanban] 启动轮询 agent=${agentId} sender=${senderId}`);
        startPollingAgent(agentId, senderId);
      }
    }
  }
}

function handleAgentEvent(data) {
  const payload = data.payload || {};
  const sessionKey = payload.sessionKey || '';
  const agentId = sessionKey.split(':')[1] || payload.agentId || data.agentId || 'main';
  const runId = payload.runId;
  
  console.debug(`[Kanban] handleAgentEvent: sessionKey="${sessionKey}" agentId="${agentId}" runId="${runId}" stream="${payload.stream}"`);
  
  assignAgentColor(agentId);
  const agentData = getOrCreateAgent(agentId);
  
  const stream = payload.stream;
  
  if (stream === 'lifecycle') {
    const phase = payload.data?.phase;
    
    if (phase === 'start') {
      const taskSet = {
        id: `live_${runId}_${Date.now()}`,
        runId,
        userMessage: '处理中...',
        time: formatTime(Date.now()),
        startTime: Date.now(),
        isExecuting: true,
        thinkingText: '',
        instructions: [],
        stats: { thinkingCount: 0, toolCallCount: 0, tokenTotal: 0 }
      };
      agentData.taskSets.unshift(taskSet);
    } else if (phase === 'end') {
      const taskSet = agentData.taskSets.find(ts => ts.isExecuting);
      if (taskSet) {
        taskSet.isExecuting = false;
        taskSet._justCompleted = true;
        setTimeout(() => { taskSet._justCompleted = false; }, 600);
      }
    }
  } else if (stream === 'assistant') {
    const delta = payload.data?.delta || payload.data?.text || '';
    const taskSet = agentData.taskSets.find(ts => ts.isExecuting);
    if (taskSet && delta) {
      taskSet.thinkingText = (taskSet.thinkingText || '') + delta;
      if (taskSet.thinkingText.length > 200) {
        taskSet.thinkingText = taskSet.thinkingText.substring(0, 200);
      }
      if (!taskSet._thinkingCounted) {
        taskSet._thinkingCounted = true;
        if (taskSet.stats) taskSet.stats.thinkingCount = (taskSet.stats.thinkingCount || 0) + 1;
      }
    }
  } else if (stream === 'tool') {
    const phase = payload.data?.phase;
    const toolName = payload.data?.name || 'unknown';
    const toolCallId = payload.data?.toolCallId;
    const args = payload.data?.args;
    const result = data.result;
    
    const taskSet = agentData.taskSets.find(ts => ts.isExecuting);
    
    if (phase === 'start' && taskSet) {
      const instruction = {
        id: `inst_${toolCallId}`,
        toolName,
        icon: getToolIcon(toolName),
        toolNameCN: getToolNameCN(toolName),
        commandDesc: getToolDescCN(toolName, args),
        argsDisplay: formatArgsDisplay(toolName, args),
        status: 'running',
        time: formatTime(Date.now()),
        elapsed: null,
        thinkingText: taskSet.thinkingText || '',
        args,
        result: '',
        resultHtml: '',
        _isNew: true
      };
      const exists = taskSet.instructions.some(inst => inst.id === instruction.id);
      if (!exists) {
        taskSet.instructions.unshift(instruction);
        if (taskSet.stats) taskSet.stats.toolCallCount = (taskSet.stats.toolCallCount || 0) + 1;
        setTimeout(() => { instruction._isNew = false; }, 350);
      }
    } else if (phase === 'result' && taskSet) {
      const instruction = taskSet.instructions.find(inst =>
        inst.id.includes(toolCallId) || toolCallId.includes(inst.id.replace('inst_', ''))
      );
      if (instruction) {
        instruction.status = data.isError ? 'error' : 'success';
        const resultText = typeof result === 'string' ? result : JSON.stringify(result);
        instruction.result = resultText;
        instruction.resultHtml = parseMessageContent(resultText).html;
      }
    }
  }
}

function showInstructionDetail(agentId, taskSet, instruction) {
  currentInstruction.value = instruction;
  drawerTitle.value = `${instruction.icon} ${instruction.toolNameCN}`;
  drawerVisible.value = true;
}

let elapsedTimer = null;

function updateElapsedTimes() {
  const now = Date.now();
  for (const agentData of Object.values(kanbanData.value)) {
    for (const taskSet of agentData.taskSets) {
      if (taskSet.isExecuting) {
        for (const instruction of taskSet.instructions) {
          if (instruction.status === 'running') {
            const startMs = new Date(instruction.time).getTime();
            const elapsed = Math.floor((now - startMs) / 1000);
            instruction.elapsed = formatElapsed(elapsed);
          }
        }
      }
    }
  }
}

function formatElapsed(seconds) {
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTokenCount(n) {
  if (!n || n === 0) return '—';
  if (n < 1000) return String(n);
  if (n < 1000000) return (n / 1000).toFixed(1) + 'K';
  return (n / 1000000).toFixed(1) + 'M';
}

onMounted(() => {
  unsubscribe = wsManager.subscribe(handleWsMessage);
  elapsedTimer = setInterval(updateElapsedTimes, 1000);

  // 🔧 修复: 一次性触发 + watch 立即 stop。
  //    原来: 顶层 watch(wsConnected) 在每次连接成功时都 loadAllData 一次,
  //         WS 一抖动就重复拉,既浪费也容易引入竞态。
  //    现在: 已连接就直接拉;否则挂一个一次性 watch,触发后立即 stop。
  let triggered = false
  const fire = () => {
    if (triggered) return
    triggered = true
    loadAllData().finally(() => { pageLoading.value = false });
  }
  if (wsConnected.value) {
    fire()
  } else {
    const stop = watch(wsConnected, (connected) => {
      if (!connected) return
      stop()
      fire()
    })
  }
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
  if (elapsedTimer) clearInterval(elapsedTimer);
});

return {
  pageLoading,
  agentKanbans,
  activeCount,
  drawerVisible,
  drawerTitle,
  currentInstruction,
  handleWsMessage,
  showInstructionDetail,
  updateElapsedTimes,
  formatTime,
  formatTokenCount,
  loadAllData,
};
}
