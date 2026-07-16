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
 * 麻将牌面
 */
export interface MahjongTile {
  suit?: MahjongSuit      // 数牌花色(万条筒)
  number?: MahjongNumber  // 点数1-9
  dragon?: DragonTile     // 三元牌
  wind?: WindTile         // 风牌
}

/**
 * 塔品质(替代原GemLevel)
 * 生张→熟张→老张→绝张
 */
export type TowerQuality = 'sheng' | 'shu' | 'lao' | 'jue'

/**
 * 基础塔配置(使用麻将牌面)
 */
export interface BaseTowerConfig {
  tile: MahjongTile       // 牌面
  quality: TowerQuality   // 品质
  damage: number
  range: number
  attackSpeed: number
  damageType: 'physical' | 'magic' | 'pure'
  multiTarget?: boolean
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
  quality: TowerQuality       // ✅ 改为quality
  gridPosition: { row: number; col: number }
  position: Position
  damage: number
  range: number
  attackSpeed: number         // 攻击间隔(ms)
  lastAttackTime: number
  damageType: 'physical' | 'magic' | 'pure'  // 伤害类型
  
  // 特效属性
  multiTarget?: boolean          // 多目标数量
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
}

// 子弹类
export interface Bullet {
  id: string
  position: Position
  targetId: string
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
  wood: number           // 木材(每波固定5个)
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
}

// UI状态接口
export interface UIState {
  wood: number
  gold: number
  lives: number
  wave: number
  gameStatus: 'preparing' | 'playing' | 'completed'
  canPlaceTowers: boolean
  currentWave: number
  selectedTowerId: string | null
  storedTowerIds: string[]
  currentBatchTowerIds: string[]
  gameLevel: number  // 游戏等级,影响塔生成概率
}
