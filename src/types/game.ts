// 基础坐标
export interface Position {
  x: number
  y: number
}

// ===== 麻将牌类型定义 =====

/**
 * 数牌花色(万条筒)
 */
export type MahjongSuit = 'wan' | 'tiao' | 'tong'

/**
 * 点数1-9
 */
export type MahjongNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/**
 * 三元牌(中发白)
 */
export type DragonTile = 'zhong' | 'fa' | 'bai'

/**
 * 风牌(东南西北)
 */
export type WindTile = 'dong' | 'nan' | 'xi' | 'bei'

/**
 * 花牌(梅兰竹菊,预留)
 */
export type FlowerTile = 'mei' | 'lan' | 'zhu' | 'ju'

/**
 * 五行属性(金木水火土)
 */
export type FiveElements = 'jin' | 'mu' | 'shui' | 'huo' | 'tu'

/**
 * 麻将牌面
 */
export interface MahjongTile {
  suit?: MahjongSuit | 'kezi' | 'shunzi' | 'gang' | 'hongzhong' | 'facai' | 'baiban'      // 数牌花色(万条筒)或合成塔类型
  number?: MahjongNumber  // 点数1-9
  dragon?: DragonTile     // 三元牌(中发白)
  wind?: WindTile         // 风牌(东南西北)
  flower?: FlowerTile     // 花牌(梅兰竹菊,预留)
  element?: FiveElements  // 五行属性(金木水火土)
}


/**
 * 基础塔配置(使用麻将牌面)
 */
export interface BaseTowerConfig {
  tile: MahjongTile       // 牌面
  damage: number
  range: number
  attackSpeed: number
  damageType: 'physical' | 'magic' | 'pure'
  multiTarget?: number    // ✅ 同时攻击的目标数量
  splashRadius?: number
  slowEffect?: number
  critChance?: number
  critMultiplier?: number
  pierce?: number
  poisonDamage?: number
  poisonDuration?: number
  stunChance?: number
  stunDuration?: number
}

/**
 * 特殊塔(保留原有结构,改为麻将番型命名)
 */
export type SpecialFanType = 
  | 'pinghu'        // 平胡(原silver)
  | 'qingyise'      // 清一色(原malachite)
  | 'qidui'         // 七对(原starRuby)
  | 'hunquandaiyao' // 混全带幺(原moonstone)
  | 'sanyuan'       // 大三元(原jade)
  | 'sixi'          // 大四喜(原onyx)

/**
 * ✅ 新增: 胡牌番型类型
 */
export type HuFanType =
  | 'lizhi'         // 立直: 攻速+10%
  | 'duanyaojiu'    // 断幺九: 伤害+15%
  | 'duiduihu'      // 对对和: 暴击率+20%
  | 'qingyise_hu'   // 清一色: 伤害×2
  | 'hunyise'       // 混一色: 范围×1.5
  | 'xiaosanyuan'   // 小三元: 纯粹伤害
  | 'dasanyuan'     // 大三元: 伤害×3
  | 'xiaosixi'      // 小四喜: 攻速×1.5
  | 'dasixi'        // 大四喜: 伤害×4

// 敌人类
export interface Enemy {
  id: string
  type: 'basic' | 'fast' | 'tank'
  position: Position
  health: number
  maxHealth: number
  speed: number
  armor: number        // 护甲(减免物理伤害)
  magicResist: number  // 魔抗(减免魔法伤害,0-1)
  pathIndex: number    // 当前路径点索引
  progress: number     // 在两点间的进度(0-1)
  reward: number       // 击杀奖励金币
  reachedEnd?: boolean // 是否到达终点
  slowTimer?: number   // 减速剩余时间(ms)
  isDead?: boolean     // 是否已死亡
  
  // ✅ 新增: Debuff列表
  debuffs?: Array<{
    type: 'armor_reduction' | 'burn' | 'poison' | 'slow' | 'stun'
    value: number         // 效果值(如护甲降低百分比、伤害值等)
    duration: number      // 剩余持续时间(秒)
    stacks?: number       // 叠加层数(用于毒素)
    source?: string       // 来源塔ID(用于globalDebuff追踪)
  }>
  
  // 特效相关属性
  poisonEffects?: Array<{
    damage: number
    duration: number
    startTime: number
  }>
  isStunned?: boolean
  stunEndTime?: number
}

// 防御塔类
export interface Tower {
  id: string
  tile: MahjongTile           // ✅ 改为tile
  gridPosition: { row: number; col: number }
  position: Position
  damage: number
  range: number
  attackSpeed: number         // 攻击速度(每秒攻击次数),冷却时间=1000/attackSpeed(ms)
  lastAttackTime: number
  damageType: 'physical' | 'magic' | 'pure'  // 伤害类型
  
  // ✅ 新增: 灼烧效果(红中特性)
  burnEffect?: {
    damagePerSecond: number
    duration: number      // 秒
  }
  
  // ✅ 新增: 毒素增强(发财特性)
  poisonEffect?: {
    damagePercent: number // 主目标伤害的百分比
    duration: number      // 秒
    maxStacks: number     // 最大叠加层数
    spreadOnDeath?: {
      enabled: boolean
      range: number       // 扩散范围
    }
  }
  
  // ✅ 新增: 减甲效果(白板特性)
  armorReduction?: {
    percent: number       // 护甲降低百分比
    duration: number      // 秒
    globalDebuff?: boolean // 是否全队共享debuff(仅白板杠有此属性)
  }
  
  // 特效属性
  multiTarget?: number           // ✅ 同时攻击的目标数量
  splashRadius?: number         // 溅射半径
  slowEffect?: number           // 减速效果
  critChance?: number           // 暴击率
  critMultiplier?: number       // 暴击倍率
  poisonDamage?: number         // 毒素伤害
  poisonDuration?: number       // 毒素持续时间(ms)
  stunChance?: number           // 眩晕概率
  stunDuration?: number         // 眩晕持续时间(ms)
  pierce?: number              // 穿透数量
  targetId?: string             // 当前锁定目标
  damageDealtThisWave?: number  // ✅ 本波造成的累计伤害
}

// 子弹类
export interface Bullet {
  id: string
  position: Position
  targetId: string
  towerId?: string  // ✅ 来源塔ID(用于伤害统计)
  damage: number
  damageType: 'physical' | 'magic' | 'pure'
  speed: number
  
  // 特效属性
  splashRadius?: number
  slowEffect?: number
  critChance?: number
  critMultiplier?: number
  poisonDamage?: number
  poisonDuration?: number
  stunChance?: number
  stunDuration?: number
  pierce?: number
}

// ✅ 新增: 伤害飘字类型
export interface FloatingDamage {
  id: string
  x: number          // 当前位置X
  y: number          // 当前位置Y
  startY: number     // 起始Y坐标
  damage: number     // 伤害值
  isCrit: boolean    // 是否暴击
  isPure: boolean    // 是否纯粹伤害
  startTime: number  // 开始时间
  duration: number   // 持续时间(ms)
}

// 地图格子
export interface GridCell {
  row: number
  col: number
  type: 'empty' | 'tower' | 'obstacle' | 'mine' | 'start' | 'end'
  towerId?: string  // 如果有塔,记录塔的ID
}

// 波次敌人配置
export interface WaveEnemyConfig {
  type: 'basic' | 'fast' | 'tank'
  count: number
  interval: number  // 生成间隔(ms)
}

// 波次配置
export interface WaveConfig {
  waveNumber: number
  enemies: WaveEnemyConfig[]
  isBossWave?: boolean
  healthMultiplier?: number  // 血量倍率(默认1.0)
}

// 游戏状态
export interface GameState {
  gold: number           // 金币
  mineHealth: number     // 矿坑生命
  maxMineHealth: number  // 最大矿坑生命
  wave: number
  enemies: Enemy[]
  towers: Tower[]
  bullets: Bullet[]
  grid: GridCell[][]     // 地图网格
  storedTowers: Tower[]  // 存储的塔(跨波次保留)
  gameStatus: 'preparing' | 'playing' | 'paused' | 'game_over' | 'victory'
  selectedGem: MahjongTile | null  // ✅ 当前选中的麻将牌面
  currentPath: { row: number; col: number }[] | null  // 当前BFS路径
  availableGems: MahjongTile[]  // ✅ 当前波可用的随机麻将牌
  
  // ✅ 新增: 胡牌检测相关
  huTiles?: MahjongTile[]  // 场上所有用于胡牌检测的塔
  globalBuffs?: GlobalBuff[]  // 全局增益效果
  
  // ✅ 新增: 伤害飘字
  floatingDamages?: FloatingDamage[]
}

/**
 * 全局增益效果
 */
export interface GlobalBuff {
  type: HuFanType        // 番型名称
  description: string    // 描述
  active: boolean        // 是否激活
  effect: {
    damageMultiplier?: number   // 伤害倍率
    attackSpeedBonus?: number   // 攻速加成
    rangeMultiplier?: number    // 范围倍率
    critChanceBonus?: number    // 暴击率加成
    damagePercentBonus?: number // 伤害百分比加成
  }
}

/**
 * ✅ 新增: 胡牌番型配置类型
 */
export interface HuFanConfig {
  name: string
  description: string
  effect: {
    damageMultiplier?: number
    attackSpeedBonus?: number
    rangeMultiplier?: number
    critChanceBonus?: number
    damagePercentBonus?: number
  }
}

// UI状态接口
export interface UIState {
  gold: number
  lives: number
  wave: number
  gameStatus: 'preparing' | 'playing' | 'completed'
  canPlaceTowers: boolean
  currentWave: number
  selectedTowerId: string | null
  storedTowerIds: string[]
  currentBatchTowerIds: string[]

}
