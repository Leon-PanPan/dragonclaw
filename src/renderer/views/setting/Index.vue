<template>
  <div class="setting-view">
    <div class="page-header">
      <div class="page-title">
        <icon-settings class="title-icon" />
        <span>设置</span>
      </div>
      <div class="page-actions">
        <a-button @click="loadConfig" :loading="loading">
          <template #icon><icon-refresh /></template>
          重新加载
        </a-button>
      </div>
    </div>

    <div class="setting-content">
      <!-- 左侧导航菜单 -->
      <div class="setting-nav">
        <div
          v-for="section in sections"
          :key="section.key"
          class="nav-item"
          :class="{ active: activeSection === section.key }"
          @click="scrollToSection(section.key)"
        >
          {{ section.title }}
        </div>
      </div>

      <!-- 右侧内容区域 -->
      <div class="setting-body-wrapper">
        <div class="setting-body" ref="scrollContainer" @scroll="onScroll">
          <div class="setting-body-inner" v-loading="saving">

            <!-- 骨架屏加载状态 -->
            <template v-if="loading">
              <div v-for="n in 3" :key="n" class="skeleton-section">
                <a-skeleton :animation="true">
                  <div class="skeleton-section-title">
                    <a-skeleton-line :width="'120px'" />
                  </div>
                  <div class="skeleton-group">
                    <div class="skeleton-group-title">
                      <a-skeleton-line :width="'80px'" />
                    </div>
                    <div v-for="i in 3" :key="i" class="skeleton-form-row">
                      <div class="skeleton-label">
                        <a-skeleton-line :width="'60px'" />
                      </div>
                      <div class="skeleton-control">
                        <a-skeleton-line :width="'200px'" />
                      </div>
                    </div>
                  </div>
                </a-skeleton>
              </div>
            </template>

            <!-- 实际内容 -->
            <template v-else>

              <!-- ===== 基础 ===== -->
              <div id="section-env" class="settings-section">
                <h2 class="section-title">基础</h2>

                <div class="settings-group">
                  <h3 class="group-title">时区</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="时区">
                      <a-select v-model="configForm.agents.defaults.userTimezone" :style="{ width: '220px' }">
                        <a-option value="Asia/Shanghai">Asia/Shanghai</a-option>
                        <a-option value="America/New_York">America/New_York</a-option>
                        <a-option value="Europe/London">Europe/London</a-option>
                        <a-option value="Asia/Tokyo">Asia/Tokyo</a-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="时间格式">
                      <a-radio-group v-model="configForm.agents.defaults.timeFormat">
                        <a-radio value="24">24小时制</a-radio>
                        <a-radio value="12">12小时制</a-radio>
                      </a-radio-group>
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">心跳任务</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="心跳间隔">
                      <a-input v-model="configForm.agents.defaults.heartbeat.every" placeholder="55m" :style="{ width: '120px' }" />
                      <template #extra><span class="form-tip">如 55m、1h</span></template>
                    </a-form-item>
                    <a-form-item label="独立会话">
                      <a-switch v-model="configForm.agents.defaults.heartbeat.isolatedSession" />
                      <template #extra><span class="form-tip">每次心跳使用独立会话</span></template>
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">设置修改</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="热加载">
                      <a-select v-model="configForm.gateway.reload.mode" :style="{ width: '150px' }">
                        <a-option value="hybrid">自动加载（推荐）</a-option>
                        <a-option value="hot">热点重启</a-option>
                        <a-option value="restart">自动重启</a-option>
                        <a-option value="off">手动重启</a-option>
                      </a-select>
                    </a-form-item>
                  </a-form>
                </div>
              </div>

              <!-- ===== 网关 ===== -->
              <div id="section-gateway" class="settings-section">
                <h2 class="section-title">网关</h2>

                <div class="settings-group">
                  <h3 class="group-title">基本设置</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="运行模式">
                      <a-select v-model="configForm.gateway.mode" :style="{ width: '120px' }">
                        <a-option value="local">本地</a-option>
                        <a-option value="remote">远程</a-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="端口">
                      <a-input-number v-model="configForm.gateway.port" :min="1024" :max="65535" :style="{ width: '110px' }" />
                    </a-form-item>
                    <a-form-item label="绑定地址">
                      <a-select v-model="configForm.gateway.bind" :style="{ width: '180px' }">
                        <a-option value="auto">自动</a-option>
                        <a-option value="loopback">回环地址（localhost）</a-option>
                        <a-option value="lan">局域网(0.0.0.0)</a-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="HTTP Chat API">
                      <a-switch v-model="configForm.gateway.http.endpoints.chatCompletions.enabled" />
                      <template #extra><span class="form-tip">启用 /v1/chat/completions API</span></template>
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">认证</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="认证模式">
                      <a-radio-group v-model="configForm.gateway.auth.mode">
                        <a-radio value="none">无</a-radio>
                        <a-radio value="password">密码</a-radio>
                        <a-radio value="token">令牌</a-radio>
                      </a-radio-group>
                    </a-form-item>
                    <a-form-item v-if="configForm.gateway.auth.mode === 'token'" label="令牌">
                      <a-input-password v-model="configForm.gateway.auth.token" placeholder="输入网关令牌" :style="{ width: '280px' }" />
                    </a-form-item>
                    <a-form-item v-if="configForm.gateway.auth.mode === 'password'" label="密码">
                      <a-input-password v-model="configForm.gateway.auth.password" placeholder="输入用户密码" :style="{ width: '280px' }" />
                    </a-form-item>
                    <a-form-item label="Tailscale">
                      <a-select v-model="configForm.gateway.tailscale.mode" :style="{ width: '120px' }">
                        <a-option value="off">关闭</a-option>
                        <a-option value="on">启用</a-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="浏览器控制">
                      <a-select v-model="configForm.gateway.controlUi.enable" :style="{ width: '120px' }">
                        <a-option value="true">开启</a-option>
                        <a-option value="false">关闭</a-option>
                      </a-select>
                    </a-form-item>
                  </a-form>
                </div>
              </div>

              <!-- ===== 智能体 ===== -->
              <div id="section-agent" class="settings-section">
                <h2 class="section-title">智能体</h2>

                <div class="settings-group">
                  <h3 class="group-title">模型设置</h3>
                  <a-form :model="configForm.agents.defaults" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="默认模型">
                      <a-cascader
                        :model-value="primaryModelCascaderValue"
                        :options="modelCascaderOptions"
                        :style="{ width: '280px' }"
                        placeholder="选择默认模型"
                        expand-trigger="hover"
                        @change="handlePrimaryModelChange"
                      />
                      <template #extra>
                        <span class="form-tip">对话使用的默认模型</span>
                        <span class="form-link" @click="navigateToModel">前往模型界面 →</span>
                      </template>
                    </a-form-item>
                    <a-form-item label="回退模型">
                      <a-cascader
                        :model-value="fallbackModelCascaderValue"
                        :options="modelCascaderOptions"
                        :style="{ width: '280px' }"
                        placeholder="选择回退模型（可多选）"
                        multiple
                        expand-trigger="hover"
                        @change="handleFallbackModelsChange"
                      />
                      <template #extra><span class="form-tip">当默认模型不可用时，按顺序尝试的回退模型列表</span></template>
                    </a-form-item>
                    <a-form-item label="默认思考级别">
                      <a-select v-model="configForm.agents.defaults.thinkingDefault" :style="{ width: '180px' }">
                        <a-option value="off">关闭</a-option>
                        <a-option value="low">低</a-option>
                        <a-option value="medium">中</a-option>
                        <a-option value="high">高</a-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="LLM超时">
                      <a-input-number v-model="configForm.agents.defaults.timeoutSeconds" :min="10000" :max="300000" :step="1000" :style="{ width: '160px' }" /> 秒
                      <template #extra><span class="form-tip">单次模型调用的最大等待时间</span></template>
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">子智能体</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="最大并发">
                      <a-input-number v-model="configForm.agents.defaults.subagents.maxConcurrent" :min="1" :max="32" :style="{ width: '100px' }" />
                    </a-form-item>
                    <a-form-item label="嵌套深度">
                      <a-input-number v-model="configForm.agents.defaults.subagents.maxSpawnDepth" :min="1" :max="10" :style="{ width: '100px' }" />
                    </a-form-item>
                    <a-form-item label="每父最大子数">
                      <a-input-number v-model="configForm.agents.defaults.subagents.maxChildrenPerAgent" :min="1" :max="50" :style="{ width: '100px' }" />
                    </a-form-item>
                    <a-form-item label="运行超时">
                      <a-input-number v-model="configForm.agents.defaults.subagents.runTimeoutSeconds" :min="60" :max="86400" :step="60" :style="{ width: '140px' }" /> 秒
                    </a-form-item>
                    <a-form-item label="归档保留">
                      <a-input-number v-model="configForm.agents.defaults.subagents.archiveAfterMinutes" :min="60" :max="14400" :step="60" :style="{ width: '140px' }" /> 分钟
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">沙箱</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="沙箱模式">
                      <a-select v-model="configForm.agents.defaults.sandbox.mode" :style="{ width: '150px' }">
                        <a-option value="off">关闭</a-option>
                        <a-option value="non-main">非主智能体</a-option>
                        <a-option value="all">全部</a-option>
                      </a-select>
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">工作区</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="工作区路径">
                      <a-input v-model="configForm.agents.defaults.workspace" placeholder="~/.openclaw/workspace" :style="{ width: '300px' }" />
                    </a-form-item>
                    <a-form-item label="引导最大字符">
                      <a-input-number v-model="configForm.agents.defaults.bootstrapMaxChars" :min="1000" :max="50000" :step="1000" :style="{ width: '120px' }" />
                    </a-form-item>
                    <a-form-item label="最大并发任务">
                      <a-input-number v-model="configForm.agents.defaults.maxConcurrent" :min="1" :max="16" :style="{ width: '80px' }" />
                    </a-form-item>
                  </a-form>
                </div>
              </div>

              <!-- ===== 会话 ===== -->
              <div id="section-session" class="settings-section">
                <h2 class="section-title">会话</h2>

                <div class="settings-group">
                  <h3 class="group-title">基本</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="私信共享范围">
                      <a-select v-model="configForm.session.dmScope" :style="{ width: '180px' }">
                        <a-option value="main">共享主会话</a-option>
                        <a-option value="per-peer">按发送者隔离（推荐）</a-option>
                        <a-option value="per-channel-peer">按渠道 + 发送者隔离</a-option>
                        <a-option value="per-account-channel-peer">按账号 + 渠道 + 发送者隔离</a-option>
                      </a-select>
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">上下文压缩</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="压缩模式">
                      <a-select v-model="configForm.agents.defaults.compaction.mode" :style="{ width: '180px' }">
                        <a-option value="default">默认模式</a-option>
                        <a-option value="safeguard">安全模式</a-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="压缩模型">
                      <ModelSelector v-model="configForm.agents.defaults.compaction.model" placeholder="与对话同模型" />
                    </a-form-item>
                    <a-form-item label="保留 tokens">
                      <a-input-number v-model="configForm.agents.defaults.compaction.reserveTokens" :min="1000" :max="200000" :step="1000" :style="{ width: '140px' }" />
                    </a-form-item>
                    <a-form-item label="保留下限">
                      <a-input-number v-model="configForm.agents.defaults.compaction.reserveTokensFloor" :min="1000" :max="100000" :step="1000" :style="{ width: '140px' }" />
                    </a-form-item>
                    <a-form-item label="超时时间">
                      <a-input-number v-model="configForm.agents.defaults.compaction.timeoutSeconds" :min="10" :max="100000" :step="1" :style="{ width: '140px' }" />
                      <template #extra><span class="form-tip">单次压缩操作允许的最长秒数，超过该时间则终止压缩</span></template>
                    </a-form-item>
                    <a-form-item label="通知用户">
                      <a-switch v-model="configForm.agents.defaults.compaction.notifyUser" />
                    </a-form-item>
                    <a-form-item label="内存刷新">
                      <a-switch v-model="configForm.agents.defaults.compaction.memoryFlush.enabled" />
                    </a-form-item>
                    <a-form-item label="刷新阈值" v-if="configForm.agents.defaults.compaction.memoryFlush.enabled">
                      <a-input-number v-model="configForm.agents.defaults.compaction.memoryFlush.softThresholdTokens" :min="500" :max="50000" :step="500" :style="{ width: '140px' }" />
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">上下文裁剪</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="裁剪模式">
                      <a-select v-model="configForm.agents.defaults.contextPruning.mode" :style="{ width: '180px' }">
                        <a-option value="cache-ttl">缓存 TTL</a-option>
                        <a-option value="off">关闭</a-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="缓存 TTL">
                      <a-input v-model="configForm.agents.defaults.contextPruning.ttl" placeholder="1h" :style="{ width: '120px' }" />
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">流式输出</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="启用">
                      <a-switch :model-value="configForm.agents.defaults.blockStreamingDefault === 'on'" @change="configForm.agents.defaults.blockStreamingDefault = $event ? 'on' : 'off'" />
                    </a-form-item>
                    <a-form-item label="最小分块">
                      <a-input-number v-model="configForm.agents.defaults.blockStreamingChunk.minChars" :min="1" :max="500" :style="{ width: '120px' }" /> 字符
                    </a-form-item>
                    <a-form-item label="最大分块">
                      <a-input-number v-model="configForm.agents.defaults.blockStreamingChunk.maxChars" :min="10" :max="1000" :style="{ width: '120px' }" /> 字符
                    </a-form-item>
                    <a-form-item label="合并阈值">
                      <a-input-number v-model="configForm.agents.defaults.blockStreamingCoalesce.minChars" :min="10" :max="500" :style="{ width: '120px' }" /> 字符
                    </a-form-item>
                    <a-form-item label="空闲间隔">
                      <a-input-number v-model="configForm.agents.defaults.blockStreamingCoalesce.idleMs" :min="10" :max="5000" :style="{ width: '120px' }" /> 毫秒
                    </a-form-item>
                    <a-form-item label="断点位置">
                      <a-select v-model="configForm.agents.defaults.blockStreamingBreak" :style="{ width: '150px' }">
                        <a-option value="text_end">文本结束</a-option>
                        <a-option value="sentence">句子结束</a-option>
                        <a-option value="paragraph">段落结束</a-option>
                      </a-select>
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">打字效果</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="打字间隔">
                      <a-input-number v-model="configForm.agents.defaults.typingIntervalSeconds" :min="0" :max="30" :style="{ width: '100px' }" /> 秒
                    </a-form-item>
                    <a-form-item label="打字模式">
                      <a-select v-model="configForm.agents.defaults.typingMode" :style="{ width: '150px' }">
                        <a-option value="thinking">思考模式</a-option>
                        <a-option value="stream">流式模式</a-option>
                        <a-option value="animation">动画模式</a-option>
                      </a-select>
                    </a-form-item>
                  </a-form>
                </div>
              </div>

              <!-- ===== 工具 ===== -->
              <div id="section-tools" class="settings-section">
                <h2 class="section-title">工具</h2>

                <div class="settings-group">
                  <h3 class="group-title">工具执行</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="工具配置集">
                      <a-select v-model="configForm.tools.profile" :style="{ width: '180px' }">
                        <a-option value="full">完全模式</a-option>
                        <a-option value="messaging">消息模式</a-option>
                        <a-option value="minimal">最小模式</a-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="会话可见性">
                      <a-select v-model="configForm.tools.sessions.visibility" :style="{ width: '150px' }">
                        <a-option value="all">全部可见</a-option>
                        <a-option value="owned">仅自己</a-option>
                        <a-option value="none">不可见</a-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="Agent间通信">
                      <a-switch v-model="configForm.tools.agentToAgent.enabled" />
                    </a-form-item>
                    <a-form-item label="执行安全">
                      <a-select v-model="configForm.tools.exec.security" :style="{ width: '150px' }">
                        <a-option value="full">完全信任</a-option>
                        <a-option value="sandbox">沙箱</a-option>
                        <a-option value="deny">拒绝</a-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="命令询问">
                      <a-select v-model="configForm.tools.exec.ask" :style="{ width: '180px' }">
                        <a-option value="off">关闭</a-option>
                        <a-option value="on-miss">未匹配时</a-option>
                        <a-option value="always">始终</a-option>
                      </a-select>
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">技能加载</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="额外目录">
                      <template v-for="(dir, idx) in (configForm.skills.load.extraDirs || [])" :key="idx">
                        <a-tag closable color="arcoblue" @close="configForm.skills.load.extraDirs.splice(idx,1)" style="margin:2px">{{ dir }}</a-tag>
                      </template>
                      <template #extra><span class="form-tip">额外技能目录，在技能管理页添加</span></template>
                    </a-form-item>
                    <a-form-item label="包管理器">
                      <a-select v-model="configForm.skills.install.nodeManager" :style="{ width: '120px' }">
                        <a-option value="npm">npm</a-option>
                        <a-option value="pnpm">pnpm</a-option>
                        <a-option value="yarn">yarn</a-option>
                      </a-select>
                    </a-form-item>
                  </a-form>
                </div>
              </div>

              <!-- ===== 安全 ===== -->
              <div id="section-security" class="settings-section">
                <h2 class="section-title">安全</h2>

                <div class="settings-group">
                  <h3 class="group-title">命令限制</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="原生命令">
                      <a-select v-model="configForm.commands.native" :style="{ width: '120px' }">
                        <a-option value="auto">自动</a-option>
                        <a-option value="on">开启</a-option>
                        <a-option value="off">关闭</a-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="重启命令">
                      <a-switch v-model="configForm.commands.restart" />
                      <template #extra><span class="form-tip">允许 /restart 重启 Gateway</span></template>
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">拒绝命令列表</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="已屏蔽的命令">
                      <span v-for="(cmd, idx) in (configForm.gateway.nodes.denyCommands || [])" :key="idx">
                        <a-tag closable color="red" @close="removeDenyCommand(cmd)" style="margin:2px">{{ cmd }}</a-tag>
                      </span>
                      <a-button size="small" type="outline" @click="openAddDenyCommandModal">+ 添加</a-button>
                    </a-form-item>
                  </a-form>
                </div>

                <div class="settings-group">
                  <h3 class="group-title">日志</h3>
                  <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                    <a-form-item label="日志级别">
                      <a-select v-model="configForm.logging.level" :style="{ width: '150px' }">
                        <a-option value="debug">调试</a-option>
                        <a-option value="info">信息</a-option>
                        <a-option value="warn">警告</a-option>
                        <a-option value="error">错误</a-option>
                      </a-select>
                    </a-form-item>
                  </a-form>
                </div>
              </div>

            </template>

          </div>
        </div>

        <!-- 底部保存按钮 -->
        <div class="setting-footer">
          <a-button type="primary" :loading="saving" @click="handleSave">
            <template #icon><icon-save /></template>
            保存设置
          </a-button>
        </div>
      </div>
    </div>

    <a-modal v-model:visible="addDenyCommandVisible" title="添加危险命令" @ok="addDenyCommand">
      <a-input v-model="newDenyCommand" placeholder="例如: camera.snap" />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSetting } from './useSetting.js'

const {
  addDenyCommandVisible, newDenyCommand, loading, saving, configForm,
  modelList, modelCascaderOptions, primaryModelCascaderValue, fallbackModelCascaderValue,
  activeTab, handlePrimaryModelChange, handleFallbackModelsChange, loadConfig, handleSave,
  removeDenyCommand, openAddDenyCommandModal, addDenyCommand,
  navigateToModel
} = useSetting()

// 锚点导航相关
const sections = [
  { key: 'env', title: '基础', id: 'section-env' },
  { key: 'gateway', title: '网关', id: 'section-gateway' },
  { key: 'agent', title: '智能体', id: 'section-agent' },
  { key: 'session', title: '会话', id: 'section-session' },
  { key: 'tools', title: '工具', id: 'section-tools' },
  { key: 'security', title: '安全', id: 'section-security' },
]

const activeSection = ref('env')
const scrollContainer = ref(null)

// 滚动到指定区域
const scrollToSection = (key) => {
  const section = sections.find(s => s.key === key)
  if (section) {
    const el = document.getElementById(section.id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
}

// 监听滚动，实时更新activeSection
const onScroll = () => {
  if (!scrollContainer.value) return

  const container = scrollContainer.value
  const scrollTop = container.scrollTop
  const offset = 100

  for (let i = sections.length - 1; i >= 0; i--) {
    const el = document.getElementById(sections[i].id)
    if (el && el.offsetTop - offset <= scrollTop) {
      activeSection.value = sections[i].key
      break
    }
  }
}

onMounted(() => {
  activeSection.value = 'env'
})
</script>

<style scoped src="./style.scss"></style>
<style>
.arco-form-item-content-flex{
  flex-wrap: wrap;
}
</style>