// 基础坐标
export interface Position {
  x: number
  y: number
}

// 宝石塔类型
export type GemType = 'amethyst' | 'diamond' | 'topaz' | 'opal'
export type GemLevel = 'chipped' | 'flawed' | 'normal' | 'flawless'

// 特殊塔类型
export type SpecialTowerType = 'silver' | 'malachite' | 'starRuby'

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
}

// 防御塔类
export interface Tower {
  id: string
  gemType?: GemType           // 基础宝石类型
  specialType?: SpecialTowerType  // 特殊塔类型
  level: GemLevel             // 等级
  gridPosition: { row: number; col: number }
  position: Position
  damage: number
  range: number
  attackSpeed: number         // 攻击间隔(ms)
  lastAttackTime: number
  damageType: 'physical' | 'magic' | 'pure'  // 伤害类型
  slowEffect?: number         // 减速效果(0-1)
  splashRadius?: number       // 溅射半径
  multiTarget?: number        // 多目标数量
  targetId?: string           // 当前锁定目标
}

// 子弹类
export interface Bullet {
  id: string
  position: Position
  targetId: string
  damage: number
  damageType: 'physical' | 'magic' | 'pure'
  speed: number
  splashRadius?: number
  slowEffect?: number
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
  selectedGem: GemType | null  // 当前选中的宝石类型
  currentPath: { row: number; col: number }[] | null  // 当前BFS路径
  availableGems: GemType[]  // 当前波可用的5个随机宝石
}
