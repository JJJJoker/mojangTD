---
name: grill-me
description: Deeply analyze and critique a game project's gameplay mechanics, balance, user experience, and design decisions. Use when the user wants a thorough review of their game's design, asks for gameplay feedback, or mentions "grill" to get critical analysis.
---

# Grill Me - 游戏深度分析工具

## 使用说明

当用户要求"grill"项目时,执行以下深度分析流程:

### 第1步: 读取核心文档

1. 读取 `GAMEPLAY.md` - 了解游戏玩法设计
2. 读取 `CONFIG.md` - 了解数值配置
3. 读取 `README.md` - 了解项目概述

### 第2步: 分析代码结构

检查关键文件:
- `src/types/game.ts` - 类型定义
- `src/config/towers.ts` - 塔配置
- `src/config/enemies.ts` - 敌人配置
- `src/config/waves.ts` - 波次配置
- `src/hooks/useGameEngine.ts` - 核心逻辑

### 第3步: 执行Grill分析

从以下维度进行批判性分析:

#### 🎯 核心玩法循环
- 放置→合成→战斗→升级的闭环是否完整?
- 玩家决策点是否足够丰富?
- 是否存在明显的最优策略导致其他选择无意义?

#### ⚖️ 数值平衡
- 伤害/血量比例是否合理?(前期需要几秒击杀?)
- 经济系统(木材/金币)是否卡手?
- 成长曲线是否平滑?有没有突然的难度跳跃?

#### 🎮 用户体验
- 新手引导是否清晰?
- UI反馈是否及时且明确?
- 操作是否符合直觉?有无多余点击?

#### 🔧 系统设计
- 麻将系统(三花色/四品质/面子合成)是否有深度?
- 各花色特色是否明显?有无同质化?
- 合成奖励是否足够吸引人?

#### 🐛 潜在问题
- 边界情况处理(如格子满了怎么办?)
- 性能隐患(大量敌人/子弹时的表现)
- 状态管理漏洞(React hooks依赖是否正确?)

### 第4步: 输出Grill报告

按照以下格式输出:

```markdown
# 🔥 Grill Report - [项目名称]

## 💀 致命问题 (Critical Issues)
列出严重影响游戏体验的问题,按优先级排序

## ⚠️ 需要改进 (Needs Improvement)
影响体验但可接受的问题

## ✅ 做得好的地方 (Good Points)
值得肯定的设计决策

## 💡 建议优化 (Suggestions)
具体的改进方案,包含伪代码或数值调整建议

## 📊 综合评分 (Overall Rating)
- 核心玩法: X/10
- 数值平衡: X/10  
- 用户体验: X/10
- 系统设计: X/10
- **总评: X/10**
```

## 分析原则

1. **诚实直接**: 不回避尖锐批评,但要建设性
2. **数据驱动**: 基于实际代码和数值,不是主观臆断
3. **玩家视角**: 从新手/老玩家双重视角审视
4. **可行性优先**: 建议必须是可实现的,考虑开发成本

## 特殊关注点

对于麻将TD项目,重点检查:
- 三花色差异化是否足够?(万=爆发,条=穿透,筒=控制)
- 面子合成(刻子/顺子/杠)的奖励强度是否合理?
- 品质系统(生张→绝张)的成长感是否明显?
- 24障碍不变量是否真正保护了游戏节奏?
