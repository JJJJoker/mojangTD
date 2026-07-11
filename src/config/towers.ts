import type { GemType, GemLevel, SpecialTowerType } from '../types/game'

// 基础塔属性配置
export const BASE_TOWER_STATS: Record<GemType, Record<GemLevel, {
  damage: number
  range: number
  attackSpeed: number
  damageType: 'physical' | 'magic' | 'pure'
  multiTarget?: number      // 多目标数量(钻石特有)
  splashRadius?: number     // 溅射半径(黄玉特有)
  slowEffect?: number       // 减速效果(蛋白石特有)
}>> = {
  amethyst: {  // 紫水晶 - 高伤害物理攻击
    chipped: { damage: 25, range: 200, attackSpeed: 1200, damageType: 'physical' },
    flawed: { damage: 30, range: 210, attackSpeed: 1200, damageType: 'physical' },
    normal: { damage: 40, range: 220, attackSpeed: 1200, damageType: 'physical' },
    flawless: { damage: 55, range: 230, attackSpeed: 1200, damageType: 'physical' }
  },
  
  diamond: {  // 钻石 - 高攻速+多目标
    chipped: { damage: 8, range: 180, attackSpeed: 400, damageType: 'physical', multiTarget: 3 },
    flawed: { damage: 10, range: 190, attackSpeed: 400, damageType: 'physical', multiTarget: 3 },
    normal: { damage: 13, range: 200, attackSpeed: 400, damageType: 'physical', multiTarget: 4 },
    flawless: { damage: 17, range: 210, attackSpeed: 350, damageType: 'physical', multiTarget: 5 }
  },
  
  topaz: {  // 黄玉 - 溅射范围伤害
    chipped: { damage: 15, range: 160, attackSpeed: 1000, damageType: 'physical', splashRadius: 60 },
    flawed: { damage: 18, range: 170, attackSpeed: 1000, damageType: 'physical', splashRadius: 70 },
    normal: { damage: 24, range: 180, attackSpeed: 1000, damageType: 'physical', splashRadius: 80 },
    flawless: { damage: 32, range: 190, attackSpeed: 900, damageType: 'physical', splashRadius: 100 }
  },
  
  opal: {  // 蛋白石 - 减速效果
    chipped: { damage: 10, range: 200, attackSpeed: 800, damageType: 'magic', slowEffect: 0.3 },
    flawed: { damage: 12, range: 210, attackSpeed: 800, damageType: 'magic', slowEffect: 0.4 },
    normal: { damage: 16, range: 220, attackSpeed: 750, damageType: 'magic', slowEffect: 0.5 },
    flawless: { damage: 22, range: 230, attackSpeed: 700, damageType: 'magic', slowEffect: 0.6 }
  }
}

// 特殊塔配方和特性
export const SPECIAL_TOWER_RECIPES: Record<SpecialTowerType, {
  requiredGems: GemType[]
  level: GemLevel
  stats: {
    damage: number
    range: number
    attackSpeed: number
    damageType: 'physical' | 'magic' | 'pure'
    multiTarget?: number
    splashRadius?: number
    slowEffect?: number
  }
}> = {
  silver: {  // 银塔 - 钻石+黄玉 = 多目标+溅射
    requiredGems: ['diamond', 'topaz'],
    level: 'normal',
    stats: {
      damage: 20,
      range: 200,
      attackSpeed: 600,
      damageType: 'physical',
      multiTarget: 3,
      splashRadius: 80
    }
  },
  
  malachite: {  // 孔雀石 - 黄玉+蛋白石 = 溅射+减速
    requiredGems: ['topaz', 'opal'],
    level: 'normal',
    stats: {
      damage: 18,
      range: 190,
      attackSpeed: 900,
      damageType: 'magic',
      splashRadius: 90,
      slowEffect: 0.5
    }
  },
  
  starRuby: {  // 星红宝石 - 紫水晶+钻石 = 超高伤害+多目标
    requiredGems: ['amethyst', 'diamond'],
    level: 'normal',
    stats: {
      damage: 45,
      range: 220,
      attackSpeed: 800,
      damageType: 'pure',  // 纯粹伤害无视减免
      multiTarget: 4
    }
  }
}

// 获取塔属性的辅助函数
export function getTowerStats(gemType: GemType, level: GemLevel) {
  return BASE_TOWER_STATS[gemType][level]
}

export function getSpecialTowerStats(type: SpecialTowerType) {
  return SPECIAL_TOWER_RECIPES[type].stats
}
