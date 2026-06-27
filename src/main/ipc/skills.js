const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const CH = require('../../../shared/ipc-channels');

// 获取已安装的技能列表
// ⚠️ 渲染层已切换为通过 WS Gateway `skills.status` 命令获取技能状态，
// 本 IPC handler 当前已无调用方，仅保留以备未来可能复用。
ipcMain.handle(CH.GET_INSTALLED_SKILLS, async () => {
  try {
    const openClawConfigPath = process.platform === 'win32'
      ? path.join(process.env.USERPROFILE, '.openclaw', 'openclaw.json')
      : path.join(process.env.HOME, '.openclaw', 'openclaw.json');

    let agents = [];

    try {
      const configContent = fs.readFileSync(openClawConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      agents = config.agents?.list || [];
    } catch (e) {
      console.warn('读取配置文件失败:', e.message);
    }

    const allSkills = [];
    const addedSkillIds = new Set();

    // 1. 扫描全局技能目录 ~/.openclaw/skills/
    const globalSkillsPath = path.join(process.env.HOME, '.openclaw', 'skills');
    if (fs.existsSync(globalSkillsPath)) {
      try {
        const skillDirs = fs.readdirSync(globalSkillsPath);
        for (const skillId of skillDirs) {
          const skillPath = path.join(globalSkillsPath, skillId);
          const stat = fs.statSync(skillPath);
          if (stat.isDirectory()) {
            const pkgPath = path.join(skillPath, 'package.json');
            let skillInfo = {
              id: skillId,
              name: skillId,
              version: 'unknown',
              description: '',
              author: '',
              scope: '全局',
              workspace: 'global'
            };

            if (fs.existsSync(pkgPath)) {
              try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                skillInfo.name = pkg.name || skillId;
                skillInfo.version = pkg.version || 'unknown';
                skillInfo.description = pkg.description || '';
                skillInfo.author = pkg.author || '';
              } catch (e) {
                // ignore
              }
            }

            if (!addedSkillIds.has(skillId)) {
              allSkills.push(skillInfo);
              addedSkillIds.add(skillId);
            }
          }
        }
      } catch (e) {
        console.warn('扫描全局技能目录失败:', e.message);
      }
    }

    // 2. 扫描 main workspace 的技能目录 ~/.openclaw/workspace/skills/
    const mainAgent = agents.find(a => a.id === 'main');
    const mainAgentName = mainAgent?.identity?.name || mainAgent?.id || 'main';

    const mainWorkspaceSkillsPath = path.join(process.env.HOME, '.openclaw', 'workspace', 'skills');
    if (fs.existsSync(mainWorkspaceSkillsPath)) {
      try {
        const skillDirs = fs.readdirSync(mainWorkspaceSkillsPath);
        for (const skillId of skillDirs) {
          const skillPath = path.join(mainWorkspaceSkillsPath, skillId);
          const stat = fs.statSync(skillPath);
          if (stat.isDirectory()) {
            const pkgPath = path.join(skillPath, 'package.json');
            let skillInfo = {
              id: skillId,
              name: skillId,
              version: 'unknown',
              description: '',
              author: '',
              scope: mainAgentName,
              workspace: 'main'
            };

            if (fs.existsSync(pkgPath)) {
              try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                skillInfo.name = pkg.name || skillId;
                skillInfo.version = pkg.version || 'unknown';
                skillInfo.description = pkg.description || '';
                skillInfo.author = pkg.author || '';
              } catch (e) {
                // ignore
              }
            }

            if (!addedSkillIds.has(skillId)) {
              allSkills.push(skillInfo);
              addedSkillIds.add(skillId);
            }
          }
        }
      } catch (e) {
        console.warn('扫描 main workspace 技能目录失败:', e.message);
      }
    }

    // 3. 扫描其他 agent 的技能目录 ~/.openclaw/workspace-{id}/skills/
    for (const agent of agents) {
      if (agent.id === 'main') continue;

      const agentWorkspaceSkillsPath = path.join(process.env.HOME, '.openclaw', `workspace-${agent.id}`, 'skills');
      if (fs.existsSync(agentWorkspaceSkillsPath)) {
        try {
          const skillDirs = fs.readdirSync(agentWorkspaceSkillsPath);
          for (const skillId of skillDirs) {
            const skillPath = path.join(agentWorkspaceSkillsPath, skillId);
            const stat = fs.statSync(skillPath);
            if (stat.isDirectory()) {
              const pkgPath = path.join(skillPath, 'package.json');
              const agentName = agent.identity?.name || agent.id;
              let skillInfo = {
                id: skillId,
                name: skillId,
                version: 'unknown',
                description: '',
                author: '',
                scope: agentName,
              workspace: agent.id
              };

              if (fs.existsSync(pkgPath)) {
                try {
                  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                  skillInfo.name = pkg.name || skillId;
                  skillInfo.version = pkg.version || 'unknown';
                  skillInfo.description = pkg.description || '';
                  skillInfo.author = pkg.author || '';
                } catch (e) {
                  // ignore
                }
              }

              const uniqueKey = `${agentName}:${skillId}`;
              if (!addedSkillIds.has(uniqueKey)) {
                allSkills.push(skillInfo);
                addedSkillIds.add(uniqueKey);
              }
            }
          }
        } catch (e) {
          console.warn(`扫描 agent ${agent.id} 技能目录失败:`, e.message);
        }
      }
    }

    console.log('已安装技能扫描完成:', allSkills.length, '个');
    return allSkills;
  } catch (error) {
    console.error('获取已安装技能失败:', error.message);
    return [];
  }
});

// 获取所有智能体及其已安装的技能
// ⚠️ 渲染层已切换为通过 WS Gateway `skills.status` 命令获取技能状态，
// 本 IPC handler 当前已无调用方，仅保留以备未来可能复用。
ipcMain.handle(CH.GET_AGENT_SKILLS, async () => {
  try {
    const openClawConfigPath = process.platform === 'win32'
      ? path.join(process.env.USERPROFILE, '.openclaw', 'openclaw.json')
      : path.join(process.env.HOME, '.openclaw', 'openclaw.json');

    let agents = [];

    try {
      const configContent = fs.readFileSync(openClawConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      agents = config.agents?.list || [];
    } catch (e) {
      console.warn('读取配置文件失败:', e.message);
    }

    const result = [];
    const homeDir = process.env.HOME || process.env.USERPROFILE;

    // 1. 全局技能目录
    const globalSkillsPath = path.join(homeDir, '.openclaw', 'skills');
    const globalSkills = [];
    if (fs.existsSync(globalSkillsPath)) {
      try {
        const skillDirs = fs.readdirSync(globalSkillsPath);
        for (const skillId of skillDirs) {
          const skillPath = path.join(globalSkillsPath, skillId);
          const stat = fs.statSync(skillPath);
          if (stat.isDirectory()) {
            globalSkills.push(skillId);
          }
        }
      } catch (e) {}
    }
    result.push({
      id: 'global',
      name: '全局',
      workspace: null,
      skills: globalSkills
    });

    // 2. main workspace
    const mainWorkspacePath = path.join(homeDir, '.openclaw', 'workspace');
    const mainSkills = [];
    const mainSkillsPath = path.join(mainWorkspacePath, 'skills');
    if (fs.existsSync(mainSkillsPath)) {
      try {
        const skillDirs = fs.readdirSync(mainSkillsPath);
        for (const skillId of skillDirs) {
          const skillPath = path.join(mainSkillsPath, skillId);
          const stat = fs.statSync(skillPath);
          if (stat.isDirectory()) {
            mainSkills.push(skillId);
          }
        }
      } catch (e) {}
    }
    result.push({
      id: 'main',
      name: 'Main',
      workspace: mainWorkspacePath,
      skills: mainSkills
    });

    // 3. 其他 agent workspace
    for (const agent of agents) {
      if (agent.id === 'main') continue;

      const agentWorkspacePath = path.join(homeDir, '.openclaw', `workspace-${agent.id}`);
      const agentSkills = [];
      const agentSkillsPath = path.join(agentWorkspacePath, 'skills');

      if (fs.existsSync(agentSkillsPath)) {
        try {
          const skillDirs = fs.readdirSync(agentSkillsPath);
          for (const skillId of skillDirs) {
            const skillPath = path.join(agentSkillsPath, skillId);
            const stat = fs.statSync(skillPath);
            if (stat.isDirectory()) {
              agentSkills.push(skillId);
            }
          }
        } catch (e) {}
      }

      result.push({
        id: agent.id,
        name: agent.identity?.name || agent.id,
        workspace: agentWorkspacePath,
        skills: agentSkills
      });
    }

    console.log('智能体技能扫描完成:', result.length, '个智能体');
    return result;
  } catch (error) {
    console.error('获取智能体技能失败:', error.message);
    return [];
  }
});

// 安装技能
ipcMain.handle(CH.INSTALL_SKILL, async (event, { skillSlug, workdir }) => {
  return new Promise((resolve) => {
    try {
      console.log(`安装技能: ${skillSlug}, workdir: ${workdir}`);

      let command = `clawhub install ${skillSlug} --force`;
      if (workdir) {
        command += ` --workdir=${workdir}`;
      }

      const child = spawn(command, {
        shell: true,
        timeout: 120000
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        event.sender.send('skill-install-output', { type: 'stdout', text });
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        event.sender.send('skill-install-output', { type: 'stderr', text });
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`技能 ${skillSlug} 安装成功`);
          resolve({ success: true, output: stdout || '安装完成' });
        } else {
          console.error(`技能 ${skillSlug} 安装失败:`, stderr);
          resolve({
            success: false,
            error: stderr || `安装失败,退出码: ${code}`,
            stdout,
            stderr
          });
        }
      });

      child.on('error', (err) => {
        console.error(`技能 ${skillSlug} 安装进程错误:`, err.message);
        resolve({ success: false, error: err.message });
      });

    } catch (error) {
      console.error(`技能 ${skillSlug} 安装失败:`, error.message);
      resolve({ success: false, error: error.message });
    }
  });
});

// 卸载技能
ipcMain.handle(CH.UNINSTALL_SKILL, async (event, { skillSlug, workdir }) => {
  return new Promise((resolve) => {
    try {
      console.log(`卸载技能: ${skillSlug}, workdir: ${workdir}`);

      const args = ['uninstall', skillSlug, '--force'];
      if (workdir) {
        args.push(`--workdir=${workdir}`);
      }

      const child = spawn('clawhub', args, {
        shell: true,
        timeout: 60000
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        event.sender.send('skill-uninstall-output', { type: 'stdout', text });
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        event.sender.send('skill-uninstall-output', { type: 'stderr', text });
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`技能 ${skillSlug} 卸载成功`);
          resolve({ success: true, output: stdout || '卸载完成' });
        } else {
          console.error(`技能 ${skillSlug} 卸载失败:`, stderr);
          resolve({
            success: false,
            error: stderr || `卸载失败,退出码: ${code}`,
            stdout,
            stderr
          });
        }
      });

      child.on('error', (err) => {
        console.error(`技能 ${skillSlug} 卸载进程错误:`, err.message);
        resolve({ success: false, error: err.message });
      });

    } catch (error) {
      console.error(`技能 ${skillSlug} 卸载失败:`, error.message);
      resolve({ success: false, error: error.message });
    }
  });
});

// 执行clawhub登录
ipcMain.handle(CH.CLAWHUB_LOGIN, async () => {
  try {
    console.log('执行clawhub登录...');
    const childProcess = spawn('clawhub', ['login'], {
      stdio: 'inherit',
      shell: true,
    });

    return new Promise((resolve, reject) => {
      childProcess.on('close', (code) => {
        if (code === 0) {
          console.log('clawhub登录成功');
          resolve({ success: true, message: 'clawhub登录成功' });
        } else {
          console.error('clawhub登录失败,退出码:', code);
          reject({ success: false, message: `clawhub登录失败,退出码: ${code}` });
        }
      });

      childProcess.on('error', (error) => {
        console.error('clawhub登录进程错误:', error);
        reject({ success: false, message: `clawhub登录进程错误: ${error.message}` });
      });

      setTimeout(() => {
        childProcess.kill();
        reject({ success: false, message: 'clawhub登录超时' });
      }, 300000);
    });
  } catch (error) {
    console.error('clawhub登录执行失败:', error);
    return { success: false, message: `clawhub登录执行失败: ${error.message}` };
  }
});
