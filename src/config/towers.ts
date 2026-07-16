import type { MahjongSuit, MahjongNumber, TowerQuality, BaseTowerConfig, DragonTile, WindTile, MahjongTile } from '../types/game'

/**
 * 三花色门派定位
 * - 万子: 物理爆发·单体·财运
 * - 条子: 连射·穿透·毒素·多目标  
 * - 筒子: 范围·减速·眩晕·控场
 */

/**
 * 基础塔数值表(3花色 × 9点数)
 */
export const BASE_TOWER_STATS: Record<MahjongSuit, Record<MahjongNumber, Partial<BaseTowerConfig>>> = {
  // 万子门派: 物理爆发·单体·财运
  wan: {
    1: { damage: 6, range: 100, attackSpeed: 0.7, damageType: 'physical', critChance: 0.1 },
    2: { damage: 7, range: 105, attackSpeed: 0.75, damageType: 'physical', critChance: 0.12 },
    3: { damage: 8, range: 110, attackSpeed: 0.8, damageType: 'physical', critChance: 0.14 },
    4: { damage: 9, range: 115, attackSpeed: 0.85, damageType: 'physical', critChance: 0.16 },
    5: { damage: 10, range: 120, attackSpeed: 0.9, damageType: 'physical', critChance: 0.18 },
    6: { damage: 11, range: 125, attackSpeed: 0.95, damageType: 'physical', critChance: 0.20 },
    7: { damage: 12, range: 130, attackSpeed: 1.0, damageType: 'physical', critChance: 0.22 },
    8: { damage: 14, range: 135, attackSpeed: 1.05, damageType: 'physical', critChance: 0.25 },
    9: { damage: 16, range: 140, attackSpeed: 1.1, damageType: 'physical', critChance: 0.28 }
  },
  
  // 条子门派: 连射·穿透·毒素·多目标
  tiao: {
    1: { damage: 5, range: 110, attackSpeed: 1.1, damageType: 'magic', pierce: 1, poisonDamage: 1 },
    2: { damage: 5, range: 115, attackSpeed: 1.15, damageType: 'magic', pierce: 1, poisonDamage: 2 },
    3: { damage: 6, range: 120, attackSpeed: 1.2, damageType: 'magic', pierce: 2, poisonDamage: 2 },
    4: { damage: 6, range: 125, attackSpeed: 1.25, damageType: 'magic', pierce: 2, poisonDamage: 3 },
    5: { damage: 7, range: 130, attackSpeed: 1.3, damageType: 'magic', pierce: 2, poisonDamage: 3 },
    6: { damage: 7, range: 135, attackSpeed: 1.35, damageType: 'magic', pierce: 3, poisonDamage: 4 },
    7: { damage: 8, range: 140, attackSpeed: 1.4, damageType: 'magic', pierce: 3, poisonDamage: 4 },
    8: { damage: 8, range: 145, attackSpeed: 1.45, damageType: 'magic', pierce: 3, poisonDamage: 5 },
    9: { damage: 9, range: 150, attackSpeed: 1.5, damageType: 'magic', pierce: 4, poisonDamage: 5 }
  },
  
  // 筒子门派: 范围·减速·眩晕·控场
  tong: {
    1: { damage: 4, range: 90, attackSpeed: 0.9, damageType: 'magic', splashRadius: 25, slowEffect: 0.2 },
    2: { damage: 4, range: 95, attackSpeed: 0.95, damageType: 'magic', splashRadius: 28, slowEffect: 0.25 },
    3: { damage: 5, range: 100, attackSpeed: 1.0, damageType: 'magic', splashRadius: 30, slowEffect: 0.3 },
    4: { damage: 5, range: 105, attackSpeed: 1.05, damageType: 'magic', splashRadius: 33, slowEffect: 0.35 },
    5: { damage: 6, range: 110, attackSpeed: 1.1, damageType: 'magic', splashRadius: 35, slowEffect: 0.4 },
    6: { damage: 6, range: 115, attackSpeed: 1.15, damageType: 'magic', splashRadius: 38, slowEffect: 0.45 },
    7: { damage: 7, range: 120, attackSpeed: 1.2, damageType: 'magic', splashRadius: 40, slowEffect: 0.5 },
    8: { damage: 7, range: 125, attackSpeed: 1.25, damageType: 'magic', splashRadius: 43, slowEffect: 0.55 },
    9: { damage: 8, range: 130, attackSpeed: 1.3, damageType: 'magic', splashRadius: 45, slowEffect: 0.6, stunChance: 0.1 }
  }
}

/**
 * 品质加成系数
 */
export const QUALITY_MULTIPLIERS: Record<TowerQuality, number> = {
  sheng: 1.0,   // 生张: 基础
  shu: 1.3,     // 熟张: +30%
  lao: 1.6,     // 老张: +60%
  jue: 2.0      // 绝张: +100%
}

/**
 * 获取塔统计数据
 */
export function getTowerStats(tile: MahjongTile, quality: TowerQuality): Partial<BaseTowerConfig> {
  if (!tile.suit || !tile.number) {
    // 字牌返回空配置
    return {}
  }
  
  const base = BASE_TOWER_STATS[tile.suit][tile.number]
  const multiplier = QUALITY_MULTIPLIERS[quality]
  
  return {
    ...base,
    damage: Math.floor(base.damage! * multiplier),
    range: Math.floor(base.range! * multiplier),
    attackSpeed: base.attackSpeed! * multiplier
  }
}

/**
 * 面子合成配方
 */
export const MAHJONG_SYNTHESIS = {
  // 刻子: 3张同花色同点数 → 明刻塔(单点爆发强化)
  kezi: (suit: MahjongSuit, number: MahjongNumber) => ({
    tile: { suit, number },
    bonus: {
      damageMultiplier: 2.0,
      critChanceBonus: 0.2,
      critMultiplierBonus: 0.5
    }
  }),
  
  // 顺子: 同花色连续3点 → 顺子塔(链式/多目标)
  shunzi: (suit: MahjongSuit, startNumber: MahjongNumber) => ({
    tile: { suit, number: startNumber as MahjongNumber },
    bonus: {
      multiTarget: true,
      pierce: 2,
      attackSpeedBonus: 0.3
    }
  }),
  
  // 杠: 4张同花色同点数 → 杠塔(最强基础形态)
  gang: (suit: MahjongSuit, number: MahjongNumber) => ({
    tile: { suit, number },
    bonus: {
      damageMultiplier: 3.0,
      rangeMultiplier: 1.5,
      critChanceBonus: 0.3,
      pierce: 3
    }
  })
}

/**
 * 三元牌催化配方
 */
export const DRAGON_CATALYST = {
  zhong: {
    name: '红中',
    effect: '进攻催化',
    bonuses: {
      damageMultiplier: 1.5,
      critChanceBonus: 0.15,
      poisonDamage: 5,
      poisonDuration: 3
    }
  },
  fa: {
    name: '发财',
    effect: '经济催化',
    bonuses: {
      goldBonusPerKill: 2,
      upgradeCostReduction: 0.2
    }
  },
  bai: {
    name: '白板',
    effect: '辅助催化',
    bonuses: {
      rangeMultiplier: 1.3,
      slowEffectBonus: 0.2,
      stunChanceBonus: 0.1
    }
  }
}

/**
 * 风牌终极配方
 */
export const WIND_ULTIMATE = {
  dong: {
    name: '东风',
    archetype: '王牌单体',
    stats: {
      damage: 100,
      range: 200,
      attackSpeed: 2.0,
      damageType: 'pure' as const,
      critChance: 0.5,
      critMultiplier: 3.0
    }
  },
  nan: {
    name: '南风',
    archetype: '烈焰范围',
    stats: {
      damage: 60,
      range: 150,
      attackSpeed: 1.5,
      damageType: 'magic' as const,
      splashRadius: 100,
      poisonDamage: 20,
      poisonDuration: 5
    }
  },
  xi: {
    name: '西风',
    archetype: '锐金破甲',
    stats: {
      damage: 80,
      range: 180,
      attackSpeed: 1.8,
      damageType: 'pure' as const,
      pierce: 5,
      multiTarget: true
    }
  },
  bei: {
    name: '北风',
    archetype: '寒水封锁',
    stats: {
      damage: 50,
      range: 160,
      attackSpeed: 1.2,
      damageType: 'magic' as const,
      splashRadius: 80,
      slowEffect: 0.8,
      stunChance: 0.3,
      stunDuration: 2
    }
  }
}

/**
 * 随机生成麻将牌面(根据游戏等级调整概率)
 */
export function randomizeMahjongTile(gameLevel: number): MahjongTile {
  // 决定是数牌还是字牌
  const isNumberTile = Math.random() < 0.85  // 85%概率数牌,15%字牌
  
  if (isNumberTile) {
    // 随机花色
    const suits: MahjongSuit[] = ['wan', 'tiao', 'tong']
    const suit = suits[Math.floor(Math.random() * suits.length)]
    
    // 根据等级roll点数(高等级更容易出高点数)
    const number = randomizeMahjongNumber(gameLevel)
    
    return { suit, number }
  } else {
    // 随机字牌
    const isDragon = Math.random() < 0.6  // 60%三元牌,40%风牌
    
    if (isDragon) {
      const dragons: DragonTile[] = ['zhong', 'fa', 'bai']
      return { dragon: dragons[Math.floor(Math.random() * dragons.length)] }
    } else {
      const winds: WindTile[] = ['dong', 'nan', 'xi', 'bei']
      return { wind: winds[Math.floor(Math.random() * winds.length)] }
    }
  }
}

/**
 * 根据游戏等级随机点数(高等级更容易出高点数)
 */
export function randomizeMahjongNumber(gameLevel: number): MahjongNumber {
  // 基础概率: 均匀分布
  let probs = [1/9, 1/9, 1/9, 1/9, 1/9, 1/9, 1/9, 1/9, 1/9]
  
  // 根据等级调整: 每升1级,高点数概率+2%,低点数概率-2%
  const adjustment = Math.min((gameLevel - 1) * 0.02, 0.16)  // 封顶16%
  
  for (let i = 0; i < 9; i++) {
    const point = i + 1
    if (point <= 4) {
      probs[i] = Math.max(0.02, probs[i] - adjustment * (5 - point) / 4)
    } else if (point >= 6) {
      probs[i] = Math.min(0.18, probs[i] + adjustment * (point - 5) / 4)
    }
  }
  
  // 归一化
  const sum = probs.reduce((a, b) => a + b, 0)
  probs = probs.map(p => p / sum)
  
  // 随机选择
  const rand = Math.random()
  let cumulative = 0
  for (let i = 0; i < 9; i++) {
    cumulative += probs[i]
    if (rand < cumulative) {
      return (i + 1) as MahjongNumber
    }
  }
  
  return 5 as MahjongNumber  // fallback
}

/**
 * 计算升级到下一品质需要的金币(保持原有公式)
 */
export function calculateUpgradeCost(currentLevel: number): number {
  return 100 * Math.pow(2, currentLevel - 1)
}

/**
 * 格式化牌面名称
 */
export function formatTileName(tile: MahjongTile): string {
  if (tile.suit && tile.number) {
    const suitNames = { wan: '万', tiao: '条', tong: '筒' }
    return `${tile.number}${suitNames[tile.suit]}`
  }
  if (tile.dragon) {
    const dragonNames = { zhong: '红中', fa: '发财', bai: '白板' }
    return dragonNames[tile.dragon]
  }
  if (tile.wind) {
    const windNames = { dong: '东风', nan: '南风', xi: '西风', bei: '北风' }
    return windNames[tile.wind]
  }
  return '未知牌'
}

/**
 * 格式化品质名称
 */
export function formatQualityName(quality: TowerQuality): string {
  const names = {
    sheng: '生张',
    shu: '熟张',
    lao: '老张',
    jue: '绝张'
  }
  return names[quality]
}

// 输出攻速配置以便验证
console.log('\n⚡ 麻将塔攻速配置:')
Object.entries(BASE_TOWER_STATS).forEach(([suit, numbers]) => {
  console.log(`  ${suit === 'wan' ? '万子(慢)' : suit === 'tiao' ? '条子(快)' : '筒子(中)'}:`)
  Object.entries(numbers).forEach(([num, config]) => {
    const interval = (1000 / config.attackSpeed!).toFixed(0)
    console.log(`    ${num}点: 攻速=${config.attackSpeed} (间隔${interval}ms)`)
  })
})

console.log('\n🃏 合成倍率:')
console.log(`  刻子: 伤害×${MAHJONG_SYNTHESIS.kezi('wan', 1).bonus.damageMultiplier}`)
console.log(`  杠:   伤害×${MAHJONG_SYNTHESIS.gang('wan', 1).bonus.damageMultiplier}`)
