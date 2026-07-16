# 🀄 麻将TD新玩法设计方案 v2.0

## 📋 核心机制概述

### 1. 牌山系统 (Mahjong Deck)

#### 1.1 牌山构成
```typescript
// 1套标准麻将数牌 = 108张
- 万子: [1-9] × 4张 = 36张
- 条子: [1-9] × 4张 = 36张  
- 筒子: [1-9] × 4张 = 36张
总计: 108张
```

#### 1.2 抽牌与还牌规则
- **抽牌**: 每波放置5个塔时,从牌山随机抽取5张牌
- **保留**: 玩家选择1个塔保留 → 对应牌从牌山**永久移除**(进入"已使用区")
- **变障碍**: 其余4个塔变成障碍物 → 对应牌**返回牌山**(可再次抽取)
- **合成**: 合成消耗的素材牌 → **全部返回牌山**

#### 1.3 牌山耗尽处理
```
IF 牌山剩余牌数 < 5 THEN
  提示: "敌人进化进入阶段二!"
  给予一副新的完整牌山(108张)
  敌人数值增强(血量×1.5, 速度×1.2)
END IF
```

**预计支持波数**: 
- 每波净消耗1张牌(放5选1)
- 108张 ÷ 1张/波 = 108波
- 但考虑合成返回,实际可支持**50+波**
- 50波后开启无尽模式

---

### 2. 基础牌属性设计

#### 2.1 花色定位(无特殊效果)
| 花色 | 攻击力 | 攻速 | 攻击目标 | 特殊效果 |
|------|--------|------|----------|----------|
| **万子** 🔴 | 高 (12) | 中 (1.0/s) | 单体 | 无 |
| **条子** 🟢 | 低 (6) | 快 (1.8/s) | 单体 | 无 |
| **筒子** 🔵 | 中 (8) | 中 (1.2/s) | 3目标 | 无 |

**注意**: 基础牌**没有任何特殊效果**,所有特效来自风牌/中发白/Buff系统

#### 2.2 点数无差异
- [1-9]点数**仅影响视觉**,不影响数值
- 所有万1~万9的属性完全相同
- 点数仅在合成时用于判断刻子/顺子

#### 2.3 ~~品质系统~~ ❌ 已移除
- **无品质系统**,所有塔属性固定
- 无生张/熟张/老张/绝张
- 无品质加成倍率

---

### 3. 合成系统详解

#### 3.1 刻子 → 风牌 (三才四风)

**合成规则**:
```typescript
// 刻子定义: 3张同花色同点数
万子刻子 (如 万5+万5+万5) → 西风
条子刻子 (如 条3+条3+条3) → 北风  
筒子刻子 (如 筒7+筒7+筒7) → 南风
幺九刻子 (万1/9,条1/9,筒1/9的刻子) → 东风
```

**五行属性计算**:
```typescript
// 公式: (数字之和) % 5 → [金木水火土]
示例:
- 万3刻子: (3+3+3) % 5 = 9 % 5 = 4 → 土属性
- 条7刻子: (7+7+7) % 5 = 21 % 5 = 1 → 木属性
- 筒9刻子: (9+9+9) % 5 = 27 % 5 = 2 → 水属性

映射表:
0 → 金 (Metal)
1 → 木 (Wood)
2 → 水 (Water)
3 → 火 (Fire)  
4 → 土 (Earth)
```

**风牌能力**:
- 独立的风牌塔,占据格子
- 基础属性继承原刻子的平均值×1.5
- **五行特性待补充实现**(预留接口):
  ```typescript
  // TODO: 后续实现具体效果
  const WIND_ABILITIES = {
    dong: { /* 东风特性 */ },
    nan: { /* 南风特性 */ },
    xi: { /* 西风特性 */ },
    bei: { /* 北风特性 */ }
  }
  
  const ELEMENT_BONUS = {
    jin: { /* 金属性 */ },
    mu: { /* 木属性 */ },
    shui: { /* 水属性 */ },
    huo: { /* 火属性 */ },
    tu: { /* 土属性 */ }
  }
  ```

---

#### 3.2 杠 → 中发白 (三元牌)

**合成规则**:
```typescript
// 杠定义: 4张同花色同点数
万子杠 → 红中 (Red Dragon)
条子杠 → 发财 (Green Dragon)
筒子杠 → 白板 (White Dragon)
```

**中发白能力** (超级增强版):
```typescript
红中 (万子超级版):
  - 攻击力: 基础×3 (如万5基础12 → 36)
  - 攻速: 基础×2 (如1.0/s → 2.0/s)
  - 范围: 基础×2 (如120 → 240)
  - 特殊: 溅射半径50, 溅射伤害50%

发财 (条子超级版):
  - 攻击力: 基础×3 (如条5基础6 → 18)
  - 攻速: 基础×2 (如1.8/s → 3.6/s)
  - 范围: 基础×2 (如130 → 260)
  - 特殊: 毒素伤害5/秒, 持续5秒

白板 (筒子超级版):
  - 攻击力: 基础×3 (如筒5基础8 → 24)
  - 攻速: 基础×2 (如1.2/s → 2.4/s)
  - 范围: 基础×2 (如110 → 220)
  - 特殊: 减甲效果-5护甲, 持续3秒
```

---

#### 3.3 胡牌检测与增益

**检测时机**: 
- 每次放置5个塔后自动检测
- 基于场上**所有显示的塔**(包括之前保留的)

**胡牌条件** (基于雀魂规则):
```typescript
// 基本胡牌结构: 4面子 + 1雀头
interface HuPattern {
  type: string
  fan: number  // 番数
  buff: BuffEffect
}

// 常见番型列表 (简化版,适合TD场景)
const HU_PATTERNS = {
  // 一番 (1 Fan)
  '立直': { fan: 1, buff: { allAttackSpeed: 0.1 } },  // 全塔攻速+10%
  '断幺九': { fan: 1, buff: { allDamage: 0.15 } },  // 全塔伤害+15%
  '平和': { fan: 1, buff: { allRange: 0.1 } },  // 全塔范围+10%
  '一杯口': { fan: 1, buff: { critChance: 0.1 } },  // 暴击率+10%
  
  // 二番 (2 Fan)
  '对对和': { fan: 2, buff: { allDamage: 0.3 } },  // 全塔伤害+30%
  '三色同刻': { fan: 2, buff: { pierce: 2 } },  // 穿透+2
  '三暗刻': { fan: 2, buff: { critMultiplier: 0.5 } },  // 暴击伤害+50%
  
  // 三番 (3 Fan)
  '混一色': { fan: 3, buff: { sameSuitDamage: 0.5 } },  // 同花色伤害+50%
  '纯全带幺九': { fan: 3, buff: { edgeNumberBonus: 0.4 } },  // 1/9点数塔伤害+40%
  
  // 六番 (6 Fan)
  '清一色': { fan: 6, buff: { allDamage: 1.0, attackSpeed: 0.3 } },  // 全塔伤害×2,攻速+30%
  
  // 役满 (Yakuman)
  '国士无双': { fan: 13, buff: { allStats: 2.0 } },  // 全属性×3
  '大三元': { fan: 13, buff: { dragonTowerPower: 3.0 } },  // 中发白威力×4
  '四暗刻': { fan: 13, buff: { allCrit: 1.0 } },  // 100%暴击
}
```

**触发流程**:
```typescript
1. 放置5个塔后
2. 检测场上是否有胡牌组合
3. IF 有胡牌 THEN
     弹出特效: "🎉 胡了! [番型名称] ([番数]番)"
     应用对应Buff (永久生效,只要胡牌组合还在场上)
   END IF
```

**Buff持续时间**: 
- **无时间限制**,只要组成胡牌的塔还在场上就持续生效
- 如果胡牌组合中的某个塔被合成或移除,Buff消失

---

#### 3.4 微弱全场增益 (未合成时的被动)

**触发条件**: 
- 场上存在刻子/顺子组合,但玩家**未选择合成**
- 每有一组刻子/顺子,提供一层Buff

**Buff效果**:
```typescript
// 刻子在场被动
KeziPassive (per group):
  - allDamage: +5%
  - critChance: +2%

// 顺子在场被动  
ShunziPassive (per group):
  - allAttackSpeed: +3%
  - allRange: +2%

// 叠加规则: 线性叠加,最多5层
示例: 场上有2个刻子+1个顺子
  → allDamage: +10%, critChance: +4%, attackSpeed: +3%, range: +2%
```

---

### 4. 决策流程更新

#### 4.1 当前回合流程
```typescript
1. 从牌山抽取5张牌 → 放置5个基础塔
2. 自动检测:
   - 是否有刻子/顺子/杠组合?
   - 是否有胡牌组合?
3. 如果有可合成组合:
   - 显示"直接合成"按钮 (可选)
   - 显示"保留并继续"按钮
4. 如果选择"保留并继续":
   - 弹出决策对话框: 选择1个塔保留
   - 保留的塔 → 从牌山移除
   - 其余4个塔 → 变成障碍,牌返回牌山
5. 如果选择"直接合成":
   - 执行合成逻辑
   - 合成素材返回牌山
   - 跳过保留阶段
6. 开始波次
```

#### 4.2 合成优先级
```
最高优先级: 胡牌检测 (如果达成,强烈建议不合成,保留Buff)
次高优先级: 杠 → 中发白 (强力单塔)
中等优先级: 刻子 → 风牌 (中等强度)
最低优先级: 顺子 (较弱,通常不建议合成)
```

---

### 5. 梅兰竹菊拓展 (预留接口)

#### 5.1 合成条件 (待定)
```typescript
// 方案A: 四风合成梅花
东风 + 南风 + 西风 + 北风 → 梅花 (Plum Blossom)

// 方案B: 三中发白合成兰花  
红中 + 发财 + 白板 → 兰花 (Orchid)

// 方案C: 特定组合
需要进一步设计...
```

#### 5.2 梅兰竹菊定位
- **终极塔**: 占据1个格子
- **超强属性**: 基础属性×5, 范围×3
- **特殊能力**: 
  - 梅花: 全屏攻击
  - 兰花: 经济增益(金币×2)
  - 竹子: 防御增益(矿坑生命+5)
  - 菊花: 控制增益(眩晕概率+50%)

---

### 6. 技术实现要点

#### 6.1 类型定义更新
```typescript
// src/types/game.ts

export type MahjongSuit = 'wan' | 'tiao' | 'tong'
export type MahjongNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type DragonTile = 'zhong' | 'fa' | 'bai'  // 中发白
export type WindTile = 'dong' | 'nan' | 'xi' | 'bei'  // 东南西北
export type FlowerTile = 'mei' | 'lan' | 'zhu' | 'ju'  // 梅兰竹菊
export type FiveElements = 'jin' | 'mu' | 'shui' | 'huo' | 'tu'  // 金木水火土

export interface MahjongTile {
  suit?: MahjongSuit
  number?: MahjongNumber
  dragon?: DragonTile
  wind?: WindTile
  flower?: FlowerTile
  element?: FiveElements  // 五行属性
}

export interface Tower {
  id: string
  tile: MahjongTile
  // ❌ 无 quality 字段
  position: { x: number; y: number }
  gridPosition: { row: number; col: number }
  damage: number
  range: number
  attackSpeed: number
  damageType: 'physical' | 'magic' | 'pure'
  // ... 其他属性
}

export interface BuffEffect {
  allDamage?: number
  allAttackSpeed?: number
  allRange?: number
  critChance?: number
  critMultiplier?: number
  pierce?: number
  splashRadius?: number
  poisonDamage?: number
  armorReduction?: number
  stunChance?: number
  // ... 其他效果
}
```

#### 6.2 牌山类实现
```typescript
// src/utils/MahjongDeck.ts

export class MahjongDeck {
  private deck: MahjongTile[]
  private usedTiles: MahjongTile[]  // 已使用区(保留的牌)
  
  constructor() {
    this.initializeDeck()
  }
  
  private initializeDeck() {
    // 创建108张牌
    const suits: MahjongSuit[] = ['wan', 'tiao', 'tong']
    for (const suit of suits) {
      for (let num = 1; num <= 9; num++) {
        for (let i = 0; i < 4; i++) {
          this.deck.push({ suit, number: num as MahjongNumber })
        }
      }
    }
    this.shuffle()
  }
  
  private shuffle() {
    // Fisher-Yates洗牌算法
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]
    }
  }
  
  draw(count: number): MahjongTile[] {
    if (this.deck.length < count) {
      throw new Error('牌山不足')
    }
    return this.deck.splice(0, count)
  }
  
  returnToDeck(tiles: MahjongTile[]) {
    this.deck.push(...tiles)
    this.shuffle()
  }
  
  removeFromDeck(tile: MahjongTile) {
    // 从牌山移除(保留时使用)
    const index = this.deck.findIndex(t => 
      t.suit === tile.suit && t.number === tile.number
    )
    if (index !== -1) {
      this.deck.splice(index, 1)
      this.usedTiles.push(tile)
    }
  }
  
  remaining(): number {
    return this.deck.length
  }
  
  needsRefill(): boolean {
    return this.deck.length < 5
  }
  
  refill() {
    // 给予新牌山
    this.initializeDeck()
  }
}
```

#### 6.3 胡牌检测算法
```typescript
// src/utils/huDetector.ts

export function detectHuPattern(towers: Tower[]): HuPattern | null {
  // 提取所有塔的牌面
  const tiles = towers.map(t => t.tile)
  
  // 统计每种牌的数量
  const tileCount = countTiles(tiles)
  
  // 尝试匹配各种胡牌番型
  const patterns = [
    checkQingYiSe(tileCount),  // 清一色
    checkDuanYaoJiu(tileCount),  // 断幺九
    checkDuiDuiHu(tileCount),  // 对对和
    checkSanSeTongKe(tileCount),  // 三色同刻
    // ... 其他番型
  ]
  
  // 返回番数最高的番型
  return patterns.find(p => p !== null) || null
}

function countTiles(tiles: MahjongTile[]): Record<string, number> {
  const count: Record<string, number> = {}
  for (const tile of tiles) {
    const key = `${tile.suit}-${tile.number}`
    count[key] = (count[key] || 0) + 1
  }
  return count
}
```

---

### 7. UI更新需求

#### 7.1 牌山显示
```typescript
// 在顶部UI添加牌山信息
<div className="deck-info">
  <span>🀄 牌山剩余: {deck.remaining()}张</span>
  {deck.needsRefill() && <span className="warning">⚠️ 即将进入阶段二!</span>}
</div>
```

#### 7.2 可合成提示
```typescript
// 在放置5个塔后,如果有可合成组合,高亮显示
if (detectKezi(currentBatch)) {
  showHint('✨ 检测到刻子! 可直接合成风牌')
}

if (detectHuPattern(allTowers)) {
  showSpecialEffect('🎉 胡了! [番型名称]')
}
```

#### 7.3 Buff状态显示
```typescript
// 显示当前生效的Buff
<div className="active-buffs">
  {activeBuffs.map(buff => (
    <div key={buff.id} className="buff-icon">
      {buff.icon} {buff.name} (+{buff.value}%)
    </div>
  ))}
</div>
```

---

### 8. 数值平衡建议

#### 8.1 基础塔数值
```typescript
BASE_TOWER_STATS = {
  wan: { damage: 12, attackSpeed: 1.0, range: 120, critChance: 0.1 },
  tiao: { damage: 6, attackSpeed: 1.8, range: 130, pierce: 1 },
  tong: { damage: 8, attackSpeed: 1.2, range: 110, splashRadius: 30, multiTarget: 3 }
}
```

#### 8.2 风牌数值
```typescript
WIND_TOWER_MULTIPLIER = 1.5  // 基础属性×1.5
ELEMENT_BONUS = {
  jin: { armorPierce: 0.5 },
  mu: { poisonDamage: 3 },
  shui: { slowEffect: 0.3 },
  huo: { splashDamage: 0.5 },
  tu: { stunChance: 0.15 }
}
```

#### 8.3 中发白数值
```typescript
DRAGON_MULTIPLIER = {
  damage: 3.0,
  attackSpeed: 2.0,
  range: 2.0
}
```

#### 8.4 被动增益数值
```typescript
KEZI_PASSIVE_PER_GROUP = {
  allDamage: 0.05,
  critChance: 0.02
}

SHUNZI_PASSIVE_PER_GROUP = {
  allAttackSpeed: 0.03,
  allRange: 0.02
}
```

---

### 9. 实施步骤

#### Phase 1: 核心系统 (P0)
1. ✅ 创建MahjongDeck类
2. ✅ 更新类型定义(MahjongTile添加dragon/wind/flower/element)
3. ✅ 重构placeTower使用牌山抽牌
4. ✅ 实现保留/变障碍逻辑(牌山移除/返回)

#### Phase 2: 合成系统 (P0)
1. ✅ 实现刻子→风牌合成
2. ✅ 实现杠→中发白合成
3. ✅ 实现五行属性计算
4. ✅ 更新synthesizeTowers函数

#### Phase 3: 胡牌系统 (P1)
1. ✅ 实现胡牌检测算法
2. ✅ 创建Buff系统
3. ✅ 添加胡牌特效
4. ✅ 实现被动增益(刻子/顺子在场)

#### Phase 4: UI更新 (P1)
1. ✅ 添加牌山显示
2. ✅ 添加可合成提示
3. ✅ 添加Buff状态显示
4. ✅ 更新合成对话框

#### Phase 5: 平衡调优 (P2)
1. ⏳ 测试基础塔强度
2. ⏳ 调整风牌/中发白数值
3. ⏳ 平衡胡牌Buff强度
4. ⏳ 优化被动增益数值

---

### 10. 风险与挑战

#### 🔴 高风险
1. **胡牌检测复杂度**: 需要识别多种番型,算法复杂度高
   - 缓解: 先实现基础番型(清一色/断幺九/对对和),后续扩展

2. **牌山管理**: 需要精确跟踪每张牌的状态(在牌山/已使用/在场上)
   - 缓解: 使用Map数据结构,严格管理状态转换

#### 🟡 中风险
3. **性能问题**: 每波检测胡牌可能耗时
   - 缓解: 使用缓存,只在塔的集合变化时重新检测

4. **数值平衡**: 中发白×3属性可能过强
   - 缓解: 通过测试调整倍率,可能需要降低到×2.5

#### 🟢 低风险
5. **UI复杂度**: 显示牌山/Buff/可合成提示增加UI负担
   - 缓解: 使用简洁的图标和tooltip

---

## 🎯 总结

这个新玩法将麻将的**牌山抽卡**、**胡牌爆发**、**面子组合**深度融入TD游戏,创造了独特的策略层次:

**核心创新点**:
1. ✅ 牌山系统让每次随机都有"抽卡"期待感
2. ✅ 胡牌Buff提供战术抉择(合成强化单塔 vs 保留组合获取全局增益)
3. ✅ 中发白作为"超级塔"提供后期爆发
4. ✅ 被动增益鼓励保留面子组合,增加策略深度

**预期体验**:
- 前期: 谨慎选择保留哪张牌,规划牌山消耗
- 中期: 寻找胡牌机会,决定是否合成
- 后期: 凑齐中发白/风牌,释放强大战力
- 终局: 挑战梅兰竹菊终极塔

**下一步**: 等待你确认方案细节,然后开始Phase 1实施! 🚀
