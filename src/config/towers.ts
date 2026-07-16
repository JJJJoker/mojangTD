import type { MahjongSuit, MahjongNumber, BaseTowerConfig, DragonTile, WindTile, MahjongTile, Tower, FiveElements } from '../types/game'

/**
 * 三花色门派定位
 * - 万子: 物理爆发·单体
 * - 条子: 连射·多目标  
 * - 筒子: 多目标(3个)
 */

/**
 * 基础塔数值表(3花色固定属性)
 * - 所有万子牌具有相同的属性
 * - 所有条子牌具有相同的属性
 * - 所有筒子牌具有相同的属性
 */
export const BASE_TOWER_STATS: Record<MahjongSuit, Partial<BaseTowerConfig>> = {
  // 万子门派: 物理爆发·单体
  wan: {
    damage: 12,
    range: 120,
    attackSpeed: 1.0,
    damageType: 'physical',
    multiTarget: 1
  },
  
  // 条子门派: 连射·多目标
  tiao: {
    damage: 7,
    range: 130,
    attackSpeed: 1.0,
    damageType: 'magic',
    multiTarget: 2
  },
  
  // 筒子门派: 多目标(3个)
  tong: {
    damage: 6,
    range: 110,
    attackSpeed: 1.0,
    damageType: 'magic',
    multiTarget: 3
  }
}

/**
 * 获取塔统计数据(不再使用品质系统)
 */
export function getTowerStats(tile: MahjongTile): Partial<BaseTowerConfig> {
  if (!tile.suit) {
    return {}
  }
  
  // ✅ 只处理基础数牌,合成塔返回空对象
  if (tile.suit !== 'wan' && tile.suit !== 'tiao' && tile.suit !== 'tong') {
    return {}
  }
  
  const base = BASE_TOWER_STATS[tile.suit]
  
  if (!base) {
    return {}
  }
  
  return {
    ...base
  }
}

/**
 * ✅ 新增: 顺子风牌基础配置(倍率略低于刻子)
 */
export const SHUNZI_WIND_BASE = {
  xi: { damageMult: 1.2, rangeMult: 1.2, attackSpeedMult: 1.1 },
  bei: { damageMult: 1.2, rangeMult: 1.2, attackSpeedMult: 1.1 },
  nan: { damageMult: 1.2, rangeMult: 1.2, attackSpeedMult: 1.1 }
}

/**
 * 五行属性映射表
 */
const FIVE_ELEMENTS_MAP = ['jin', 'mu', 'shui', 'huo', 'tu'] as const

/**
 * 获取风牌名称
 */
function getWindName(wind: WindTile): string {
  const names: Record<WindTile, string> = {
    dong: '东风',
    nan: '南风',
    xi: '西风',
    bei: '北风'
  }
  return names[wind]
}

/**
 * ✅ 新增: 应用五行特殊属性
 */
function applyFiveElementEffects(tower: Tower, element: FiveElements): void {
  switch (element) {
    case 'jin':  // 金: 攻击带减甲
      tower.armorReduction = { percent: 0.3, duration: 3 }
      console.log('  🌟 金属性: 减甲30%持续3秒')
      break
    case 'mu':   // 木: 攻击范围翻倍
      tower.range *= 2
      console.log('  🌟 木属性: 范围翻倍')
      break
    case 'shui': // 水: 增加范围减速
      tower.slowEffect = (tower.slowEffect || 0.2) * 2
      console.log('  🌟 水属性: 减速增强')
      break
    case 'huo':  // 火: 伤害再翻倍
      tower.damage *= 2
      console.log('  🌟 火属性: 伤害翻倍')
      break
    case 'tu':   // 土: 攻击概率眩晕
      tower.stunChance = (tower.stunChance || 0) + 0.2
      console.log('  🌟 土属性: 眩晕概率+20%')
      break
  }
}

/**
 * 面子合成配方(新设计)
 */
export const MAHJONG_SYNTHESIS = {
  // 刻子: 3张同花色同点数 → 风牌
  kezi: (suit: MahjongSuit, number: MahjongNumber) => {
    // 确定风牌类型
    let wind: WindTile
    if (number === 1 || number === 9) {
      wind = 'dong'  // 幺九刻 → 东风
    } else {
      const windMap: Record<MahjongSuit, WindTile> = {
        wan: 'xi',   // 万刻 → 西风
        tiao: 'bei', // 条刻 → 北风
        tong: 'nan'  // 筒刻 → 南风
      }
      wind = windMap[suit]
    }
    
    return {
      tile: { wind, element: undefined },  // ❌ 刻子无五行属性
      bonus: {
        damageMultiplier: 2.0,
        rangeMultiplier: 2.0,
        attackSpeedMultiplier: 2.0,
        multiTargetMultiplier: 2.0,
        damageType: 'pure' as const
      }
    }
  },
  
  // 杠: 4张同花色同点数 → 中发白
  gang: (suit: MahjongSuit, number: MahjongNumber) => {
    let dragon: DragonTile
    let specialEffect: any
    
    if (suit === 'wan') {
      // 万杠 → 红中(溅射+灼烧)
      dragon = 'zhong'
      specialEffect = {
        splashRadius: 60,
        burnEffect: {
          damagePerSecond: 10,
          duration: 3
        }
      }
    } else if (suit === 'tiao') {
      // 条杠 → 发财(穿透+毒素)
      dragon = 'fa'
      specialEffect = {
        pierce: 999,
        poisonEffect: {
          damagePercent: 0.3,
          duration: 5,
          maxStacks: 3,
          spreadOnDeath: {
            enabled: true,
            range: 40
          }
        }
      }
    } else {
      // 筒杠 → 白板(减甲)
      dragon = 'bai'
      specialEffect = {
        armorReduction: {
          percent: 0.5,
          duration: 4,
          globalDebuff: true
        }
      }
    }
    
    return {
      tile: { dragon },
      bonus: {
        damageMultiplier: 3.0,
        rangeMultiplier: 2.0,
        attackSpeedMultiplier: 2.0,
        multiTargetMultiplier: 3.0,  // ✅ 新增: 杠合成的multiTarget倍率
        ...specialEffect
      }
    }
  },
  
  // ✅ 新增: 顺子合成 - 同花色连续3点 → 风牌
  shunzi: (towers: Tower[]): Tower => {
    if (towers.length !== 3) throw new Error('顺子需要恰好3个塔')
    
    const baseTower = towers[0]
    const suit = baseTower.tile.suit
    
    if (!suit) throw new Error('无效的牌')
    
    // 确定风牌类型(与刻子相同映射)
    let windType: WindTile
    if (suit === 'wan') {
      windType = 'xi'    // 万子顺子 → 西风
    } else if (suit === 'tiao') {
      windType = 'bei'   // 条子顺子 → 北风
    } else if (suit === 'tong') {
      windType = 'nan'   // 筒子顺子 → 南风
    } else {
      throw new Error('未知的花色')
    }
    
    // 计算五行属性(使用中间数字×3)
    const numbers = towers.map(t => t.tile.number!).sort((a, b) => a - b)
    const middleNumber = numbers[1] // 中间的数字
    const elementIndex = (middleNumber * 3) % 5
    const element = FIVE_ELEMENTS_MAP[elementIndex]
    
    // ✅ 新规则: 属性计算
    const totalDamage = towers.reduce((sum, t) => sum + t.damage, 0)
    const totalAttackSpeed = towers.reduce((sum, t) => sum + t.attackSpeed, 0)
    const maxRange = Math.max(...towers.map(t => t.range))
    const totalMultiTarget = towers.reduce((sum, t) => sum + (t.multiTarget || 1), 0)
    
    // 创建风牌塔
    const windTower: Tower = {
      ...baseTower,
      tile: { wind: windType, element: element },
      damage: totalDamage,
      attackSpeed: totalAttackSpeed,
      range: maxRange,  // ✅ 取最大值
      multiTarget: totalMultiTarget,
      damageType: 'pure'
    }
    
    // ✅ 应用五行特殊属性
    applyFiveElementEffects(windTower, element)
    
    console.log(`✅ 顺子合成: ${getWindName(windType)} (${element}), 伤害=${windTower.damage}, 攻速=${windTower.attackSpeed}, 范围=${windTower.range}`)
    return windTower
  }
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
 * ✅ 新增: 胡牌番型配置
 */
export const HU_FAN_CONFIG = {
  lizhi: {
    name: '立直',
    description: '攻速+10%',
    effect: { attackSpeedBonus: 0.1 }
  },
  duanyaojiu: {
    name: '断幺九',
    description: '伤害+15%',
    effect: { damagePercentBonus: 0.15 }
  },
  duiduihu: {
    name: '对对和',
    description: '暴击率+20%',
    effect: { critChanceBonus: 0.2 }
  },
  qingyise_hu: {
    name: '清一色',
    description: '伤害×2',
    effect: { damageMultiplier: 2.0 }
  },
  hunyise: {
    name: '混一色',
    description: '范围×1.5',
    effect: { rangeMultiplier: 1.5 }
  },
  xiaosanyuan: {
    name: '小三元',
    description: '纯粹伤害',
    effect: { damageMultiplier: 1.5 }
  },
  dasanyuan: {
    name: '大三元',
    description: '伤害×3',
    effect: { damageMultiplier: 3.0 }
  },
  xiaosixi: {
    name: '小四喜',
    description: '攻速×1.5',
    effect: { attackSpeedBonus: 0.5 }
  },
  dasixi: {
    name: '大四喜',
    description: '伤害×4',
    effect: { damageMultiplier: 4.0 }
  }
}



/**
 * 格式化牌面名称
 */
export function formatTileName(tile: MahjongTile): string {
  if (tile.suit && tile.number) {
    const suitNames: Record<string, string> = { wan: '万', tiao: '条', tong: '筒' }
    return `${tile.number}${suitNames[tile.suit] || ''}`
  }
  if (tile.dragon) {
    const dragonNames = { zhong: '红中', fa: '发财', bai: '白板' }
    return dragonNames[tile.dragon]
  }
  if (tile.wind) {
    const windNames = { dong: '东风', nan: '南风', xi: '西风', bei: '北风' }
    return windNames[tile.wind]
  }
  // ✅ 新增: 处理合成塔类型
  if (tile.suit === 'kezi') return '刻子'
  if (tile.suit === 'shunzi') return '顺子'
  if (tile.suit === 'gang') return '杠'
  if (tile.suit === 'hongzhong') return '红中'
  if (tile.suit === 'facai') return '发财'
  if (tile.suit === 'baiban') return '白板'
  
  return '未知牌'
}


// 输出攻速配置以便验证
console.log('\n⚡ 麻将塔攻速配置:')
Object.entries(BASE_TOWER_STATS).forEach(([suit, config]) => {
  console.log(`  ${suit === 'wan' ? '万子(物理爆发)' : suit === 'tiao' ? '条子(连射多目标)' : '筒子(多目标)'}:`)
  console.log(`    伤害=${config.damage}, 范围=${config.range}, 攻速=${config.attackSpeed}`)
  if (config.multiTarget) console.log(`    攻击目标数=${config.multiTarget}`)
})

console.log('\n🃏 合成倍率:')
console.log(`  刻子: 伤害×${MAHJONG_SYNTHESIS.kezi('wan', 1).bonus.damageMultiplier}`)
console.log(`  杠:   伤害×${MAHJONG_SYNTHESIS.gang('wan', 1).bonus.damageMultiplier}`)
