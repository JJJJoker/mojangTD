import React, { useState, useCallback } from 'react'
import { useGameEngine } from '../hooks/useGameEngine'
import { GameCanvas } from './GameCanvas'
import { GameUI } from './GameUI'
import { BuildPanel } from './BuildPanel'
import { SynthesisDialog } from './SynthesisDialog'
import { usePathfinding } from '../hooks/usePathfinding'
import type { Tower, MahjongTile, MahjongNumber } from '../types/game'
import { formatTileName, SHUNZI_WIND_BASE, MAHJONG_SYNTHESIS, getTowerStats } from '../config/towers'

// ==================== 麻将Unicode字符映射表 ====================
const MAHJONG_UNICODE = {
  wan: ['\u{1F007}', '\u{1F008}', '\u{1F009}', '\u{1F00A}', '\u{1F00B}', '\u{1F00C}', '\u{1F00D}', '\u{1F00E}', '\u{1F00F}'],
  tiao: ['\u{1F010}', '\u{1F011}', '\u{1F012}', '\u{1F013}', '\u{1F014}', '\u{1F015}', '\u{1F016}', '\u{1F017}', '\u{1F018}'],
  tong: ['\u{1F019}', '\u{1F01A}', '\u{1F01B}', '\u{1F01C}', '\u{1F01D}', '\u{1F01E}', '\u{1F01F}', '\u{1F020}', '\u{1F021}']
}

/**
 * 获取麻将牌的Unicode字符
 */
function getTileUnicode(tile: MahjongTile): string {
  if (tile.suit && tile.number) {
    const index = tile.number - 1
    return MAHJONG_UNICODE[tile.suit as keyof typeof MAHJONG_UNICODE]?.[index] || '\u{1F004}'
  }
  if (tile.wind) {
    const windChars = { dong: '\u{1F000}', nan: '\u{1F001}', xi: '\u{1F002}', bei: '\u{1F003}' }
    return windChars[tile.wind] || '\u{1F004}'
  }
  if (tile.dragon) {
    const dragonChars = { zhong: '\u{1F004}', fa: '\u{1F005}', bai: '\u{1F006}' }
    return dragonChars[tile.dragon] || '\u{1F004}'
  }
  return '\u{1F004}'
}

/**
 * 获取风牌名称(用于刻子/顺子合成结果)
 */
function getWindTileName(tile: MahjongTile): string {
  if (!tile.suit) return '未知'
  
  // 万刻=西风,条刻=北风,筒刻=南风
  const windMap: Record<string, string> = {
    wan: '西风',
    tiao: '北风',
    tong: '南风'
  }
  
  // 幺九刻=东风
  if (tile.number === 1 || tile.number === 9) {
    return '东风'
  }
  
  return windMap[tile.suit] || '风牌'
}

/**
 * 获取风牌名称(用于显示风牌类型)
 */
function getWindName(wind: string): string {
  const names: Record<string, string> = {
    xi: '西风',
    bei: '北风',
    nan: '南风',
    dong: '东风'
  }
  return names[wind] || wind
}

/**
 * 获取中发白名称(用于杠合成结果)
 */
function getDragonTileName(tile: MahjongTile): string {
  if (!tile.suit) return '未知'
  
  // 万杠=红中,条杠=发财,筒杠=白板
  const dragonMap: Record<string, string> = {
    wan: '红中(溅射+灼烧)',
    tiao: '发财(毒素+扩散)',
    tong: '白板(减甲)'
  }
  
  return dragonMap[tile.suit] || '三元牌'
}

/**
 * 获取中发白名称(用于显示三元牌类型)
 */
function getDragonName(dragon: string): string {
  const names: Record<string, string> = {
    zhong: '红中',
    fa: '发财',
    bai: '白板'
  }
  return names[dragon] || dragon
}

/**
 * ✅ 新增: 获取杠的效果描述
 */
function getDragonEffectDescription(tile: MahjongTile): string {
  if (!tile.suit) return ''
  
  const descriptions: Record<string, string> = {
    wan: '溅射半径60,灼烧10/s持续3秒',
    tiao: '无限穿透,毒素30%/s持续5秒可叠加,死亡扩散',
    tong: '降低50%护甲持续4秒,全队共享'
  }
  
  return descriptions[tile.suit] || ''
}

/**
 * ✅ 新增: 获取五行属性名称
 */
function getElementName(element: string | undefined): string {
  if (!element) return '未知'
  const names: Record<string, string> = {
    jin: '金',
    mu: '木',
    shui: '水',
    huo: '火',
    tu: '土'
  }
  return names[element] || element
}

/**
 * ✅ 新增: 获取五行属性颜色
 */
function getElementColor(element: string | undefined): string {
  const colors: Record<string, string> = {
    jin: '#FFD700',   // 金: 黄色
    mu: '#8B4513',    // 木: 棕色
    shui: '#2196F3',  // 水: 蓝色
    huo: '#F44336',   // 火: 红色
    tu: '#C0C0C0'     // 土: 银色
  }
  return colors[element || ''] || '#fff'
}

/**
 * ✅ 新增: 格式化Buff描述
 */
function formatBuffDescription(buff: any): string {
  const parts = []
  if (buff.effect.damageMultiplier && buff.effect.damageMultiplier !== 1) {
    parts.push(`伤害×${buff.effect.damageMultiplier.toFixed(2)}`)
  }
  if (buff.effect.attackSpeedBonus) {
    parts.push(`攻速+${(buff.effect.attackSpeedBonus * 100).toFixed(0)}%`)
  }
  if (buff.effect.rangeMultiplier && buff.effect.rangeMultiplier !== 1) {
    parts.push(`范围×${buff.effect.rangeMultiplier.toFixed(2)}`)
  }
  if (buff.effect.critChanceBonus) {
    parts.push(`暴击+${(buff.effect.critChanceBonus * 100).toFixed(0)}%`)
  }
  if (buff.effect.damagePercentBonus) {
    parts.push(`伤害+${(buff.effect.damagePercentBonus * 100).toFixed(0)}%`)
  }
  return parts.join(', ')
}

// ==================== MahjongTileIcon 组件及辅助函数 ====================

/**
 * ✅ 新增: 获取五行属性对应的边框颜色
 */
function getElementBorderColor(element: string | undefined): string {
  if (!element) return '#333'  // 无五行属性: 黑色
  
  const colors: Record<string, string> = {
    jin: '#FFD700',   // 金: 金色
    mu: '#4CAF50',    // 木: 绿色
    shui: '#2196F3',  // 水: 蓝色
    huo: '#F44336',   // 火: 红色
    tu: '#FF9800'     // 土: 橙色
  }
  
  return colors[element] || '#333'  // 默认黑色
}

/**
 * ✅ MahjongTileIcon组件 - 麻将牌面图标
 * 直接使用formatTileName显示完整牌面文字
 */
interface MahjongTileIconProps {
  tile: MahjongTile
  size?: 'small' | 'medium' | 'large'
}

function MahjongTileIcon({ tile, size = 'small' }: MahjongTileIconProps) {
  const sizeMap = {
    small: { width: 30, height: 45, fontSize: 9 },
    medium: { width: 40, height: 60, fontSize: 12 },
    large: { width: 60, height: 90, fontSize: 18 }
  }
  
  const { width, height, fontSize } = sizeMap[size]
  
  // ✅ 直接使用formatTileName获取牌面名称
  const tileName = formatTileName(tile)
  
  // ✅ 获取五行属性对应的边框颜色
  const borderColor = getElementBorderColor(tile.element)
  
  return (
    <div style={{
      width,
      height,
      background: '#fff',
      borderRadius: '4px',
      border: `2px solid ${borderColor}`,  // ✅ 使用五行属性颜色
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: fontSize,
      fontWeight: 'bold',
      color: '#000',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      textAlign: 'center',
      lineHeight: 1.1,
      padding: '2px',
      wordBreak: 'break-all'
    }}>
      {/* ✅ 直接显示牌面名称 */}
      <span>{tileName}</span>
    </div>
  )
}

/**
 * ✅ 新增: 计算五行属性(使用中间数字×3)
 */
function calculateFiveElement(tile: MahjongTile): string | undefined {
  if (!tile.suit || !tile.number) return undefined
  
  // 顺子需要3个塔，这里只计算单个塔的五行
  // 实际使用时会传入中间的塔
  const elementIndex = (tile.number * 3) % 5
  const elements = ['jin', 'mu', 'shui', 'huo', 'tu'] as const
  return elements[elementIndex]
}

/**
 * 检测一回合合成条件(5张牌中有可立即合成的组合)
 */
function detectOneTurnSynthesis(batchTowers: Tower[]) {
  if (batchTowers.length < 3) return null
  
  // 优先级1: 检测杠(4个相同) - 最高优先级
  const suitCount = new Map<string, Map<number, Tower[]>>()
  
  batchTowers.forEach(tower => {
    if (!tower.tile.suit || !tower.tile.number) return
    
    if (!suitCount.has(tower.tile.suit)) {
      suitCount.set(tower.tile.suit, new Map())
    }
    
    const numberMap = suitCount.get(tower.tile.suit)!
    if (!numberMap.has(tower.tile.number)) {
      numberMap.set(tower.tile.number, [])
    }
    numberMap.get(tower.tile.number)!.push(tower)
  })
  
  // 检查是否有杠
  for (const [suit, numberMap] of suitCount.entries()) {
    for (const [number, towers] of numberMap.entries()) {
      if (towers.length === 4) {
        return {
          type: 'gang' as const,
          tiles: towers,
          result: getDragonTileName(towers[0].tile)
        }
      }
    }
  }
  
  // 优先级2: 检测刻子(3个相同)
  for (const [suit, numberMap] of suitCount.entries()) {
    for (const [number, towers] of numberMap.entries()) {
      if (towers.length === 3) {
        return {
          type: 'kezi' as const,
          tiles: towers,
          result: getWindTileName(towers[0].tile)
        }
      }
    }
  }
  
  // 优先级3: 检测顺子(连续3个) - 可选,暂时不提供Bingo
  // 因为顺子可能用于微弱增益,不一定非要合成
  
  return null
}

/**
 * 合成检测结果
 */
interface SynthesisOptions {
  canFormKezi: boolean
  canFormShunzi: boolean
  canFormGang: boolean
  keziCount: number
  gangCount: number
  shunziTowers: Tower[] | null  // ✅ 新增: 顺子候选塔
}

export const TowerDefenseGame: React.FC = () => {
  const {
    uiState,
    setUiState,  // ✅ 新增: 用于更新UI状态
    gameStateRef,
    placeTower,
    handleTowerClick,  // ✅ 新增: 处理塔点击事件
    handleObstacleClick,  // ✅ 新增: 处理障碍物点击事件
    handleBingoClick,  // ✅ 新增: Bingo操作 - 保留被点击的牌
    finalizeTowers,
    synthesizeTowers,
    startWave,
    start,
    pause,
    resume,
    keziCount,      // ✅ 新增: 刻子数量
    shunziCount,    // ✅ 新增: 顺子数量
    activeHuPatterns, // ✅ 新增: 激活的胡牌组合
    findShunziTowersFromAll,  // ✅ 新增: 从所有塔中查找顺子
    floatingDamages,  // ✅ 新增: 伤害飘字
    checkHuPai,  // ✅ 新增: 胡牌检测函数
    getWindFromShunzi  // ✅ 新增: 顺子风牌获取函数
  } = useGameEngine()
  
  // ✅ 使用寻路Hook来计算路径
  const { calculatePath } = usePathfinding()

  // ✅ 移除旧的决策状态,改用uiState中的needsDecision和selectedTowerId
  const [showSynthesisDialog, setShowSynthesisDialog] = useState(false)
  const [showGuide, setShowGuide] = useState(false)  // ✅ 新增: 图鉴面板显示状态
  const [showWaveHint, setShowWaveHint] = useState(false)  // ✅ 新增: 波次进行中禁止放置提示
  
  // 辅助函数
  function getSynthesisName(type: string): string {
    const names: Record<string, string> = {
      gang: '合成杠',
      kezi: '合成刻子',
      shunzi: '合成顺子'
    }
    return names[type] || '合成'
  }
  
  // 辅助函数
  function getBingoDescription(): string {
    if (!uiState.selectedTowerId) return ''
    
    const selectedTower = gameStateRef.current.towers.find(
      t => t.id === uiState.selectedTowerId
    )
    if (!selectedTower) return ''
    
    const options = detectSynthesisOptions(selectedTower)
    
    if (options.canFormGang) return '合成杠!'
    if (options.canFormKezi) return '合成刻子!'
    if (options.canFormShunzi) return '合成顺子!'
    return ''
  }

  /**
   * 检测当前批次塔的可合成选项
   * ✅ 修改: 检测场上所有塔,不限于当前批次
   */
  function detectSynthesisOptions(
    selectedTower: Tower
  ): SynthesisOptions {
    // ✅ 获取场上所有塔(包括之前回合保留的)
    const allFieldTowers = gameStateRef.current.towers
    
    // 排除选中的塔本身
    const otherTowers = allFieldTowers.filter(t => t.id !== selectedTower.id)
    
    // 检测刻子(需要3个相同)
    const keziCandidates = otherTowers.filter(t =>
      t.tile.suit === selectedTower.tile.suit &&
      t.tile.number === selectedTower.tile.number
    )
    
    const canFormKezi = keziCandidates.length >= 2  // 还需要2个
    
    // ✅ 检测顺子(同花色连续3点) - 使用新函数从所有塔中查找
    const shunziTowers = findShunziTowersFromAll(selectedTower, allFieldTowers)
    const canFormShunzi = !!shunziTowers
    
    // 检测杠(需要4个相同)
    const gangCandidates = otherTowers.filter(t =>
      t.tile.suit === selectedTower.tile.suit &&
      t.tile.number === selectedTower.tile.number
    )
    
    const canFormGang = gangCandidates.length >= 3  // 还需要3个
    
    return {
      canFormKezi,
      canFormShunzi,
      canFormGang,
      keziCount: keziCandidates.length,
      gangCount: gangCandidates.length,
      shunziTowers  // ✅ 返回顺子候选塔
    }
  }

  /**
   * ✅ 处理刻子合成
   */
  const handleKeziSynthesis = useCallback(() => {
    if (!uiState.selectedTowerId) return
    
    const selectedTower = gameStateRef.current.towers.find(
      t => t.id === uiState.selectedTowerId
    )
    if (!selectedTower) return
    
    // ✅ 从场上所有塔中查找,不限于当前批次
    const sameTowers = gameStateRef.current.towers
      .filter(t => t.id !== uiState.selectedTowerId)  // 排除选中的塔
      .filter(t => 
        t.tile.suit === selectedTower.tile.suit &&
        t.tile.number === selectedTower.tile.number
      )
    
    // 需要再选择2个
    if (sameTowers.length < 2) {
      alert('还需要选择2个相同牌才能合成刻子!')
      return
    }
    
    // 取前2个进行合成
    const selectedIds = [
      selectedTower.id,
      sameTowers[0].id,
      sameTowers[1].id
    ]
    
    console.log('🀄 执行刻子合成:', selectedIds)
    
    // 调用现有的synthesizeTowers函数
    synthesizeTowers(selectedIds)
    
    // ✅ 不再调用finalizeRemainingAsObstacles
    // 直接关闭对话框
    setUiState(prev => ({ ...prev, selectedTowerId: null }))
  }, [uiState.selectedTowerId, synthesizeTowers])

  /**
   * ✅ 处理杠合成
   */
  const handleGangSynthesis = useCallback(() => {
    if (!uiState.selectedTowerId) return
    
    const selectedTower = gameStateRef.current.towers.find(
      t => t.id === uiState.selectedTowerId
    )
    if (!selectedTower) return
    
    // ✅ 从场上所有塔中查找,不限于当前批次
    const sameTowers = gameStateRef.current.towers
      .filter(t => t.id !== uiState.selectedTowerId)  // 排除选中的塔
      .filter(t => 
        t.tile.suit === selectedTower.tile.suit &&
        t.tile.number === selectedTower.tile.number
      )
    
    // 需要再选择3个
    if (sameTowers.length < 3) {
      alert('还需要选择3个相同牌才能合成杠!')
      return
    }
    
    // 取前3个进行合成
    const selectedIds = [
      selectedTower.id,
      sameTowers[0].id,
      sameTowers[1].id,
      sameTowers[2].id
    ]
    
    console.log('💥 执行杠合成:', selectedIds)
    synthesizeTowers(selectedIds)
    
    // ✅ 不再调用finalizeRemainingAsObstacles
    // 直接关闭对话框
    setUiState(prev => ({ ...prev, selectedTowerId: null }))
  }, [uiState.selectedTowerId, synthesizeTowers])

  /**
   * ✅ 新增: 处理顺子合成
   */
  const handleShunziSynthesis = useCallback(() => {
    if (!uiState.selectedTowerId) return
    
    const selectedTower = gameStateRef.current.towers.find(
      t => t.id === uiState.selectedTowerId
    )
    if (!selectedTower) return
    
    // 找到能组成顺子的其他塔 - 使用新函数从所有塔中查找
    const shunziTowers = findShunziTowersFromAll(selectedTower, gameStateRef.current.towers)
    
    if (!shunziTowers || shunziTowers.length < 2) {
      alert('无法组成顺子!')
      return
    }
    
    const selectedIds = [selectedTower.id, ...shunziTowers.map(t => t.id)]
    
    console.log('🀄 执行顺子合成:', selectedIds)
    synthesizeTowers(selectedIds)
    
    // ✅ 不再调用finalizeRemainingAsObstacles
    // 直接关闭对话框
    setUiState(prev => ({ ...prev, selectedTowerId: null }))
  }, [uiState.selectedTowerId, synthesizeTowers])

  /**
   * ✅ 新增: 处理普通合成按钮点击
   * 
   * 功能:
   * - 检测场上所有塔(包括保留的牌和当前批次的牌)
   * - 执行合成操作(类似Bingo,但不限制在当前批次)
   * - 让用户选择保留哪张牌(不像Bingo那样自动保留被点击的牌)
   */
  const handleRegularSynthClick = useCallback((towerId: string) => {
    console.log('🔧 普通合成按钮被点击:', towerId)
    
    // 找到被点击的塔
    const clickedTower = gameStateRef.current.towers.find(t => t.id === towerId)
    if (!clickedTower) {
      console.warn('找不到被点击的塔')
      return
    }
    
    // 使用场上所有塔进行检测
    const allTowers = gameStateRef.current.towers
    
    // 检测刻子
    const sameTowers = allTowers.filter(t => 
      t.tile.suit === clickedTower.tile.suit &&
      t.tile.number === clickedTower.tile.number
    )
    
    // 检测杠
    const canFormGang = sameTowers.length >= 4
    
    // 检测顺子
    const shunziTowers = findShunziTowersFromAll(clickedTower, allTowers)
    const canFormShunzi = shunziTowers !== null && shunziTowers.length >= 2
    
    const canFormKezi = sameTowers.length >= 3
    
    console.log('🔍 普通合成检测:', {
      canFormKezi,
      canFormShunzi,
      canFormGang,
      sameTowersCount: sameTowers.length
    })
    
    // 优先级: 杠 > 刻子 > 顺子
    let synthesisType: 'gang' | 'kezi' | 'shunzi' | null = null
    let towersToSynthesize: Tower[] = []
    
    if (canFormGang) {
      synthesisType = 'gang'
      // 找到3个相同的塔(不包括被点击的那个)
      towersToSynthesize = sameTowers.filter(t => t.id !== towerId).slice(0, 3)
      
    } else if (canFormKezi) {
      synthesisType = 'kezi'
      // 找到2个相同的塔(不包括被点击的那个)
      towersToSynthesize = sameTowers.filter(t => t.id !== towerId).slice(0, 2)
      
    } else if (canFormShunzi && shunziTowers) {
      synthesisType = 'shunzi'
      // 使用检测到的顺子塔
      towersToSynthesize = shunziTowers.slice(0, 2)
    }
    
    if (!synthesisType) {
      alert('没有可合成的牌!')
      return
    }
    
    console.log(`🎯 执行${synthesisType}合成`)
    
    // 收集需要删除的塔ID
    const towersToRemove = towersToSynthesize.map(t => t.id)
    
    // 将被点击的塔升级为合成后的风牌/中发白
    let newTile: MahjongTile = clickedTower.tile
    let newStats: any = {}
    
    if (synthesisType === 'kezi') {
      // 刻子 → 风牌
      const config = MAHJONG_SYNTHESIS.kezi(clickedTower.tile.suit as any, clickedTower.tile.number as any)
      newTile = config.tile
      
      // 属性为所有参与塔的总和×倍率
      const allParticipatingTowers = [clickedTower, ...towersToSynthesize]
      const totalDamage = allParticipatingTowers.reduce((sum, t) => sum + t.damage, 0)
      const totalAttackSpeed = allParticipatingTowers.reduce((sum, t) => sum + t.attackSpeed, 0)
      const maxRange = Math.max(...allParticipatingTowers.map(t => t.range))
      const totalMultiTarget = allParticipatingTowers.reduce((sum, t) => sum + (t.multiTarget || 1), 0)
      
      newStats = {
        damage: totalDamage * config.bonus.damageMultiplier,
        attackSpeed: totalAttackSpeed * config.bonus.attackSpeedMultiplier,
        range: maxRange * config.bonus.rangeMultiplier,
        multiTarget: totalMultiTarget * config.bonus.multiTargetMultiplier,
        damageType: config.bonus.damageType
      }
      
      console.log(`✅ 刻子合成: ${formatTileName(clickedTower.tile)} x3 → ${formatTileName(newTile)}`)
      
    } else if (synthesisType === 'shunzi') {
      // 顺子 → 风牌(带五行)
      const result = getWindFromShunzi(clickedTower, towersToSynthesize)
      newTile = result.tile
      newStats = result.stats
      
      console.log(`✅ 顺子合成: ${formatTileName(clickedTower.tile)} → ${formatTileName(newTile)}`)
      
    } else if (synthesisType === 'gang') {
      // 杠 → 中发白
      const config = MAHJONG_SYNTHESIS.gang(clickedTower.tile.suit as any, clickedTower.tile.number as any)
      newTile = config.tile
      
      // ✅ 新规则: 属性为所有参与塔的总和×倍率
      const allParticipatingTowers = [clickedTower, ...towersToSynthesize]
      const totalDamage = allParticipatingTowers.reduce((sum, t) => sum + t.damage, 0)
      const totalAttackSpeed = allParticipatingTowers.reduce((sum, t) => sum + t.attackSpeed, 0)
      const maxRange = Math.max(...allParticipatingTowers.map(t => t.range))
      const totalMultiTarget = allParticipatingTowers.reduce((sum, t) => sum + (t.multiTarget || 1), 0)
      
      newStats = {
        damage: totalDamage * config.bonus.damageMultiplier,
        range: maxRange * config.bonus.rangeMultiplier,
        attackSpeed: totalAttackSpeed * config.bonus.attackSpeedMultiplier,
        multiTarget: totalMultiTarget * config.bonus.multiTargetMultiplier,  // ✅ 新增: 正确设置multiTarget
        splashRadius: config.bonus.splashRadius,
        burnEffect: config.bonus.burnEffect,
        pierce: config.bonus.pierce,
        poisonEffect: config.bonus.poisonEffect,
        armorReduction: config.bonus.armorReduction
      }
      
      console.log(`✅ 杠合成: ${formatTileName(clickedTower.tile)} x4 → ${formatTileName(newTile)}, multiTarget=${newStats.multiTarget}`)
    }
    
    // 更新clickedTower的属性为新牌面和新属性
    clickedTower.tile = newTile
    Object.assign(clickedTower, newStats)
    
    console.log(`✨ 保留位置上的塔已升级为: ${formatTileName(clickedTower.tile)}`)
    
    // 将参与合成但不是被点击的塔变成障碍物并返回牌山
    towersToSynthesize.forEach(tower => {
      // 返回牌山
      gameStateRef.current.mahjongDeck.returnToDeck([tower.tile])
      
      // 从towers数组移除
      const index = gameStateRef.current.towers.findIndex(t => t.id === tower.id)
      if (index !== -1) {
        gameStateRef.current.towers.splice(index, 1)
      }
      
      // 将该位置变为障碍物
      gameStateRef.current.grid[tower.gridPosition.row][tower.gridPosition.col].type = 'obstacle'
      console.log(`🔄 参与合成的塔变障碍: ${formatTileName(tower.tile)}`)
    })
    
    // 重置状态
    setUiState(prev => ({
      ...prev,
      selectedTowerId: null,
      needsDecision: false
    }))
    
    console.log(`✅ 普通合成完成! 保留${formatTileName(clickedTower.tile)},其他牌变障碍`)
    
    // 检查胡牌
    checkHuPai()
  }, [findShunziTowersFromAll, checkHuPai])

  /**
   * ✅ 辅助函数: 将剩余塔变为障碍
   */
  const finalizeRemainingAsObstacles = useCallback((synthesizedIds: string[]) => {
    const remainingTowerIds = gameStateRef.current.currentBatchTowerIds.filter(
      id => !synthesizedIds.includes(id)
    )
    
    remainingTowerIds.forEach(towerId => {
      const tower = gameStateRef.current.towers.find(t => t.id === towerId)
      if (tower) {
        // 牌返回牌山
        gameStateRef.current.mahjongDeck.returnToDeck([tower.tile])
        
        // 格子变障碍
        const { row, col } = tower.gridPosition
        gameStateRef.current.grid[row][col].type = 'obstacle'
        
        // 从场上移除
        const index = gameStateRef.current.towers.findIndex(t => t.id === towerId)
        if (index !== -1) {
          gameStateRef.current.towers.splice(index, 1)
        }
      }
    })
    
    // 重置状态
    gameStateRef.current.placedCount = 0
    gameStateRef.current.currentBatchTowerIds = []
    
    setUiState(prev => ({
      ...prev,
      needsDecision: false,
      selectedTowerId: null,
      placedCount: 0,
      canPlaceTowers: true,
      deckRemaining: gameStateRef.current.mahjongDeck.remaining(),
      currentPhase: gameStateRef.current.mahjongDeck.getPhase()
    }))
  }, [])

  /**
   * ✅ 检查是否应该显示Bingo按钮
   */
  const shouldShowBingoButton = useCallback(() => {
    const selectedTowerId = uiState.selectedTowerId
    if (!selectedTowerId) return false
    
    // ✅ 检查0: 必须是准备阶段
    if (gameStateRef.current.waveInProgress) {
      console.log('🔍 Bingo按钮隐藏: 波次进行中')
      return false
    }
    
    // ✅ 检查0.5: 如果保留对话框已打开,隐藏Bingo按钮
    if (uiState.needsDecision) {
      console.log('🔍 Bingo按钮隐藏: needsDecision=true (保留对话框已打开)')
      return false
    }
    
    // ✅ 检查1: 选中的塔必须是当前批次的
    const currentBatchIds = gameStateRef.current.currentBatchTowerIds
    if (!currentBatchIds.includes(selectedTowerId)) {
      console.log('🔍 Bingo按钮隐藏: 选中的塔不是当前批次的')
      return false
    }
    
    // ✅ 检查2: 检测该塔是否可以参与合成
    const selectedTower = gameStateRef.current.towers.find(t => t.id === selectedTowerId)
    if (!selectedTower) return false
    
    // 调用detectSynthesisOptions检测合成选项(只检测当前批次)
    const options = detectSynthesisOptions(selectedTower)
    const canSynthesize = options.canFormKezi || options.canFormShunzi || options.canFormGang
    
    console.log('🔍 shouldShowBingoButton检查:', {
      selectedTowerId,
      inCurrentBatch: currentBatchIds.includes(selectedTowerId),
      currentBatchSize: currentBatchIds.length,
      canSynthesize,
      canFormKezi: options.canFormKezi,
      canFormShunzi: options.canFormShunzi,
      canFormGang: options.canFormGang
    })
    
    if (!canSynthesize) {
      console.log('🔍 Bingo按钮隐藏: 当前批次中无可合成的牌')
      return false
    }
    
    console.log('✅ Bingo按钮显示: 当前批次中有可合成的牌')
    return true
  }, [uiState.selectedTowerId, uiState.needsDecision, detectSynthesisOptions])

  /**
   * ✅ 新增: 检查是否应该显示普通合成按钮
   */
  const shouldShowRegularSynthButton = useCallback(() => {
    const selectedTowerId = uiState.selectedTowerId
    if (!selectedTowerId) return false
    
    // ✅ 检查0: 必须是准备阶段
    if (gameStateRef.current.waveInProgress) {
      console.log('🔍 普通合成按钮隐藏: 波次进行中')
      return false
    }
    
    // ✅ 检查0.5: 如果保留对话框已打开,隐藏普通合成按钮
    if (uiState.needsDecision) {
      console.log('🔍 普通合成按钮隐藏: needsDecision=true (保留对话框已打开)')
      return false
    }
    
    // ✅ 检查1: 选中的塔必须是之前回合保留的(不在当前批次中)
    const currentBatchIds = gameStateRef.current.currentBatchTowerIds
    if (currentBatchIds.includes(selectedTowerId)) {
      console.log('🔍 普通合成按钮隐藏: 选中的塔是当前批次的,应该用Bingo按钮')
      return false
    }
    
    // ✅ 检查2: 检测该塔是否可以参与合成(检测场上所有塔)
    const selectedTower = gameStateRef.current.towers.find(t => t.id === selectedTowerId)
    if (!selectedTower) return false
    
    // 使用场上所有塔进行检测
    const allTowers = gameStateRef.current.towers
    
    // 检测刻子(需要3个相同)
    const sameTowers = allTowers.filter(t => 
      t.tile.suit === selectedTower.tile.suit &&
      t.tile.number === selectedTower.tile.number
    )
    const canFormKezi = sameTowers.length >= 3
    
    // 检测杠(需要4个相同)
    const canFormGang = sameTowers.length >= 4
    
    // 检测顺子 - 使用findShunziTowersFromAll从所有塔中查找
    const shunziTowers = findShunziTowersFromAll(selectedTower, allTowers)
    const canFormShunzi = shunziTowers !== null && shunziTowers.length >= 2
    
    const canSynthesize = canFormKezi || canFormShunzi || canFormGang
    
    console.log('🔍 shouldShowRegularSynthButton检查:', {
      selectedTowerId,
      inCurrentBatch: currentBatchIds.includes(selectedTowerId),
      canSynthesize,
      canFormKezi,
      canFormShunzi,
      canFormGang
    })
    
    if (!canSynthesize) {
      console.log('🔍 普通合成按钮隐藏: 场上无可合成的牌')
      return false
    }
    
    console.log('✅ 普通合成按钮显示: 场上有可合成的牌', {
      canFormKezi,
      canFormShunzi,
      canFormGang
    })
    return true
  }, [uiState.selectedTowerId, uiState.needsDecision, findShunziTowersFromAll])

  /**
   * ✅ 新增: 辅助函数 - 查找能组成顺子的塔
   */
  function findShunziTowers(selectedTower: Tower): Tower[] | null {
    const suit = selectedTower.tile.suit
    const number = selectedTower.tile.number
    
    if (!suit || !number) return null
    
    // ✅ 获取场上所有塔(不限于当前批次)
    const batchTowers = gameStateRef.current.towers
      .filter(t => t.tile.suit === suit && t.id !== selectedTower.id)
    
    // 尝试找 number-2, number-1, number 或 number-1, number, number+1 或 number, number+1, number+2
    const possibilities = [
      [number - 2, number - 1],
      [number - 1, number + 1],
      [number + 1, number + 2]
    ]
    
    for (const [n1, n2] of possibilities) {
      if (n1 >= 1 && n1 <= 9 && n2 >= 1 && n2 <= 9) {
        const found1 = batchTowers.find(t => t.tile.number === n1)
        const found2 = batchTowers.find(t => t.tile.number === n2)
        
        if (found1 && found2) {
          return [found1, found2]
        }
      }
    }
    
    return null
  }



  const handleCanvasClick = useCallback((gridPos: { row: number; col: number }) => {
    const { grid } = gameStateRef.current
    
    // 检查点击的位置是否有塔或障碍物
    const cell = grid[gridPos.row][gridPos.col]
    
    if (cell.type === 'tower' && cell.towerId) {
      // ✅ 任何时候都可以点击塔查看属性和攻击范围
      handleTowerClick(cell.towerId)
      return
    }
    
    // ✅ 新增: 点击障碍物,弹出确认对话框后删除
    if (cell.type === 'obstacle') {
      handleObstacleClick(gridPos)
      return
    }
    
    // 点击空地,执行放置逻辑 - 现有逻辑保持不变
    if (uiState.gameStatus !== 'preparing') return
    if (!uiState.canPlaceTowers) {
      console.warn('⏳ 当前波次尚未结束,请等待敌人全部消灭后再放置!')
      setShowWaveHint(true)
      setTimeout(() => setShowWaveHint(false), 3000) // 3秒后自动隐藏
      return
    }
    
    const towers = placeTower(gridPos)
    if (towers && towers.length > 0) {
      // ✅ placeTower不再自动设置needsDecision,等待玩家点击塔
      console.log(`已放置第${uiState.placedCount}座塔`)
    }
  }, [
    uiState.gameStatus, 
    uiState.canPlaceTowers,
    uiState.placedCount,
    placeTower,
    handleTowerClick,
    handleObstacleClick,
    gameStateRef
  ])

  const handleFinalizeTowers = (keepTowerId: string) => {
    finalizeTowers(keepTowerId)
    // ✅ 重置决策状态
    setUiState(prev => ({
      ...prev,
      needsDecision: false,
      selectedTowerId: null
    }))
  }

  const handleStartWave = () => {
    startWave()
    start()
  }

  const handlePause = () => {
    pause()
  }

  const handleResume = () => {
    resume()
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      position: 'relative'  // ✅ 新增: 为绝对定位的图鉴按钮提供定位上下文
    }}>
      <h1 style={{ margin: '0 0 20px 0' }}>宝石TD</h1>
      
      {/* ✅ 新增: 右上角图鉴按钮 */}
      <button
        onClick={() => setShowGuide(!showGuide)}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          padding: '10px 20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          transition: 'all 0.2s',
          zIndex: 1000
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
        }}
      >
        📖 {showGuide ? '关闭图鉴' : '查看图鉴'}
      </button>
      
      {/* 顶部UI */}
      <GameUI
        uiState={uiState}
        onStartWave={handleStartWave}
        onPause={handlePause}
        onResume={handleResume}
      />
      
      {/* 游戏主体区域 */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        {/* 左侧建造面板 */}
        <BuildPanel
          placedCount={uiState.needsDecision ? 5 : 0}  // ✅ 根据决策状态显示
          canPlaceTowers={uiState.canPlaceTowers}
        />
        
        {/* 中间Canvas */}
        <div style={{ position: 'relative' }}>
          <GameCanvas 
            onClick={handleCanvasClick} 
            currentPath={gameStateRef.current.currentPath}
          />
          
          {/* ✅ 新增: 波次进行中禁止放置的提示 */}
          {showWaveHint && (
            <div style={{
              position: 'absolute',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255, 165, 0, 0.9)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              animation: 'fadeOut 0.5s ease-in-out 2.5s forwards' // 2.5秒后开始淡出,持续0.5秒
            }}>
              ⏳ 请等待当前波次结束后再放置
            </div>
          )}
          
          {/* 决策对话框 */}
          {uiState.needsDecision && uiState.selectedTowerId && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              zIndex: 100,
              minWidth: '300px'
            }}>
              <h3 style={{ margin: '0 0 15px 0', textAlign: 'center', color: '#333' }}>
                选择要留在场上的塔
              </h3>
              
              {/* 显示选中的塔信息 */}
              {(() => {
                const selectedTower = gameStateRef.current.towers.find(t => t.id === uiState.selectedTowerId)
                if (!selectedTower) return null
                
                // ✅ 修改: 任何时候都检测合成选项,不再受placedCount限制
                const synthesisOptions = detectSynthesisOptions(selectedTower)
                
                return (
                  <div>
                    {/* 塔的基本信息面板 */}
                    <div style={{
                      padding: '15px',
                      background: '#F5F5F5',
                      borderRadius: '6px',
                      marginBottom: '15px'
                    }}>
                      <h3 style={{ 
                        fontSize: '24px', 
                        marginBottom: '16px',
                        textAlign: 'center',
                        color: '#333'
                      }}>
                        {formatTileName(selectedTower.tile)}
                      </h3>
                      
                      {/* 麻将牌面预览 */}
                      <div style={{ 
                        fontSize: '48px', 
                        textAlign: 'center',
                        margin: '16px 0'
                      }}>
                        {getTileUnicode(selectedTower.tile)}
                      </div>
                      
                      {/* 属性列表 */}
                      <div className="stats-grid" style={{ 
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '16px'
                      }}>
                        <div className="stat-item">
                          <span className="label">攻击力:</span>
                          <span className="value">{selectedTower.damage}</span>
                        </div>
                        <div className="stat-item">
                          <span className="label">攻速:</span>
                          <span className="value">{(1000 / selectedTower.attackSpeed).toFixed(1)}/s</span>
                        </div>
                        <div className="stat-item">
                          <span className="label">范围:</span>
                          <span className="value">{selectedTower.range}</span>
                        </div>
                        <div className="stat-item">
                          <span className="label">伤害类型:</span>
                          <span className="value">{selectedTower.damageType === 'physical' ? '物理' : selectedTower.damageType === 'magic' ? '魔法' : '纯粹'}</span>
                        </div>
                        {selectedTower.critChance && (
                          <div className="stat-item">
                            <span className="label">暴击率:</span>
                            <span className="value">{(selectedTower.critChance * 100).toFixed(0)}%</span>
                          </div>
                        )}
                        {selectedTower.pierce && (
                          <div className="stat-item">
                            <span className="label">穿透:</span>
                            <span className="value">{selectedTower.pierce}</span>
                          </div>
                        )}
                        {selectedTower.splashRadius && (
                          <div className="stat-item">
                            <span className="label">溅射半径:</span>
                            <span className="value">{selectedTower.splashRadius}</span>
                          </div>
                        )}
                        {selectedTower.poisonDamage && (
                          <div className="stat-item">
                            <span className="label">毒素伤害:</span>
                            <span className="value">{selectedTower.poisonDamage}/s</span>
                          </div>
                        )}
                        {/* ✅ 新增: multiTarget显示 */}
                        {selectedTower.multiTarget !== undefined && selectedTower.multiTarget > 1 && (
                          <div className="stat-item">
                            <span className="label">攻击目标数:</span>
                            <span className="value">{selectedTower.multiTarget}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* ✅ 新增: 五行特殊效果显示 */}
                      {selectedTower.tile.element && (
                        <div style={{
                          padding: '12px',
                          background: '#E8F5E9',
                          borderRadius: '6px',
                          marginBottom: '16px'
                        }}>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#2E7D32' }}>
                            🌟 五行属性: {getElementName(selectedTower.tile.element)}
                          </h4>
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#555' }}>
                            {selectedTower.tile.element === 'jin' && <li>金属性: 攻击带减甲30%,持续3秒</li>}
                            {selectedTower.tile.element === 'mu' && <li>木属性: 攻击范围翻倍</li>}
                            {selectedTower.tile.element === 'shui' && <li>水属性: 减速效果增强</li>}
                            {selectedTower.tile.element === 'huo' && <li>火属性: 伤害再翻倍</li>}
                            {selectedTower.tile.element === 'tu' && <li>土属性: +20%眩晕概率</li>}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    {/* ✅ 修改: 任何时候都显示合成选项,只要存在可合成的牌 */}
                    {(synthesisOptions.canFormKezi || synthesisOptions.canFormShunzi || synthesisOptions.canFormGang) && (
                      <div className="synthesis-options" style={{ marginBottom: '16px' }}>
                        <h4 style={{ marginBottom: '8px', textAlign: 'center' }}>🀄 可合成选项</h4>
                        
                        {/* 刻子选项 */}
                        {synthesisOptions.canFormKezi && (
                          <button 
                            className="synthesis-btn highlight"
                            onClick={handleKeziSynthesis}
                            style={{
                              width: '100%',
                              padding: '12px',
                              marginBottom: '8px',
                              backgroundColor: '#FF9800',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '16px',
                              fontWeight: 'bold',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F57C00'
                              e.currentTarget.style.transform = 'scale(1.02)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#FF9800'
                              e.currentTarget.style.transform = 'scale(1)'
                            }}
                          >
                            ✨ 合成刻子 → {getWindTileName(selectedTower.tile)}
                            <br />
                            <small style={{ fontSize: '12px' }}>
                              效果: 所有属性×2, 纯粹伤害, ❌无五行属性
                              <br />
                              (需要再选择{synthesisOptions.keziCount}个相同牌)
                            </small>
                          </button>
                        )}
                        
                        {/* ✅ 新增: 顺子选项 */}
                        {synthesisOptions.canFormShunzi && synthesisOptions.shunziTowers && (
                          <button 
                            className="synthesis-btn highlight"
                            onClick={handleShunziSynthesis}
                            style={{
                              width: '100%',
                              padding: '12px',
                              marginBottom: '8px',
                              background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '16px',
                              fontWeight: 'bold',
                              boxShadow: '0 4px 6px rgba(76, 175, 80, 0.3)',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #45a049 0%, #3d8b40 100%)'
                              e.currentTarget.style.transform = 'scale(1.02)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)'
                              e.currentTarget.style.transform = 'scale(1)'
                            }}
                          >
                            🀄 合成顺子 → {getWindTileName(selectedTower.tile)}
                            <br />
                            <small style={{ fontSize: '12px', opacity: 0.9 }}>
                              效果: 伤害/攻速求和, 范围取最大, 保留五行
                            </small>
                            {/* ✅ 新增: 五行颜色标识框 */}
                            {selectedTower.tile.wind && selectedTower.tile.element && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginTop: '8px',
                                padding: '6px',
                                background: 'rgba(255,255,255,0.2)',
                                borderRadius: '4px',
                                justifyContent: 'center'
                              }}>
                                <span style={{ fontSize: '12px' }}>五行:</span>
                                <div style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '4px',
                                  border: '2px solid #fff',
                                  backgroundColor: getElementColor(selectedTower.tile.element),
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                }} />
                                <span style={{ 
                                  fontWeight: 'bold', 
                                  color: getElementColor(selectedTower.tile.element),
                                  fontSize: '12px',
                                  textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                                }}>
                                  {getElementName(selectedTower.tile.element)}
                                </span>
                              </div>
                            )}
                          </button>
                        )}
                        
                        {/* 杠选项 */}
                        {synthesisOptions.canFormGang && (
                          <button 
                            className="synthesis-btn highlight"
                            onClick={handleGangSynthesis}
                            style={{
                              width: '100%',
                              padding: '12px',
                              marginBottom: '8px',
                              backgroundColor: '#F44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '16px',
                              fontWeight: 'bold',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#D32F2F'
                              e.currentTarget.style.transform = 'scale(1.02)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#F44336'
                              e.currentTarget.style.transform = 'scale(1)'
                            }}
                          >
                            💥 合成杠 → {getDragonTileName(selectedTower.tile)}
                            <br />
                            <small style={{ fontSize: '12px' }}>
                              效果: 伤害×3, 范围×2, 攻速×2, {getDragonEffectDescription(selectedTower.tile)}
                              <br />
                              (需要再选择{synthesisOptions.gangCount}个相同牌)
                            </small>
                          </button>
                        )}
                      </div>
                    )}
                    
                    {/* ✅ 删除: placedCount < 5时的提示 - 不再需要 */}
                    
                    {/* 无合成选项的提示 - 始终显示 */}
                    {!synthesisOptions.canFormKezi && 
                     !synthesisOptions.canFormShunzi && 
                     !synthesisOptions.canFormGang && (
                      <p style={{ 
                        color: '#999', 
                        fontSize: '14px', 
                        textAlign: 'center',
                        marginBottom: '16px'
                      }}>
                        当前无可合成选项
                      </p>
                    )}
                  </div>
                )
              })()}
              
              {/* ✅ Bingo按钮 - 只有当前批次且有可合成的牌时才显示 */}
              {shouldShowBingoButton() && (
                <button
                  className="bingo-btn"
                  onClick={() => handleBingoClick(uiState.selectedTowerId!)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    marginBottom: '16px',
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    boxShadow: '0 6px 12px rgba(255, 215, 0, 0.4)',
                    animation: 'pulse 1.5s infinite'
                  }}
                >
                  🎯 Bingo! {getBingoDescription()}
                </button>
              )}
              
              {/* ✅ 新增: 普通合成按钮 - 只有保留的牌且场上有可合成的牌时才显示 */}
              {shouldShowRegularSynthButton() && (
                <button
                  className="synth-btn"
                  onClick={() => handleRegularSynthClick(uiState.selectedTowerId!)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    marginBottom: '16px',
                    background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    boxShadow: '0 6px 12px rgba(76, 175, 80, 0.4)'
                  }}
                >
                  🔧 普通合成
                </button>
              )}
              
              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleFinalizeTowers(uiState.selectedTowerId!)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  ✓ 留在场上
                </button>
                
                <button
                  onClick={() => {
                    // 关闭决策对话框但不执行任何操作
                    setUiState(prev => ({
                      ...prev,
                      needsDecision: false,
                      selectedTowerId: null
                    }))
                  }}
                  style={{
                    padding: '12px 20px',
                    background: '#FF5722',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  取消
                </button>
              </div>
              
              <p style={{ 
                fontSize: '12px', 
                color: '#999', 
                marginTop: '10px',
                textAlign: 'center'
              }}>
                提示: 选择保留后,其余4个塔将变成障碍物
              </p>
            </div>
          )}
        </div>
        
        {/* ✅ 新增: 右侧Buff展示面板 */}
        <div style={{
          width: '280px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
          color: 'white'
        }}>
          <h3 style={{ 
            margin: '0 0 16px 0', 
            fontSize: '18px',
            textAlign: 'center',
            borderBottom: '2px solid rgba(255,255,255,0.3)',
            paddingBottom: '10px'
          }}>
            ✨ Buff状态
          </h3>
          
          {/* 刻子统计 */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 'bold',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>🀄</span>
              <span>刻子数量: {keziCount}</span>
            </div>
            {keziCount > 0 && (
              <div style={{ 
                fontSize: '12px',
                background: 'rgba(255,255,255,0.2)',
                padding: '8px',
                borderRadius: '6px',
                lineHeight: '1.6'
              }}>
                <div>✅ 伤害 +{(keziCount * 5).toFixed(0)}%</div>
                <div>✅ 暴击 +{(keziCount * 2).toFixed(0)}%</div>
              </div>
            )}
          </div>
          
          {/* 顺子统计 */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 'bold',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>🀅</span>
              <span>顺子数量: {shunziCount}</span>
            </div>
            {shunziCount > 0 && (
              <div style={{ 
                fontSize: '12px',
                background: 'rgba(255,255,255,0.2)',
                padding: '8px',
                borderRadius: '6px',
                lineHeight: '1.6'
              }}>
                <div>✅ 攻速 +{(shunziCount * 3).toFixed(0)}%</div>
                <div>✅ 范围 +{(shunziCount * 2).toFixed(0)}%</div>
                {/* ✅ 新增: 五行属性统计 */}
                {(() => {
                  // 收集场上所有风牌塔的五行属性
                  const windTowers = gameStateRef.current.towers.filter(t => t.tile.wind && t.tile.element)
                  if (windTowers.length === 0) return null
                  
                  // 统计各五行数量
                  const elementCount: Record<string, number> = {}
                  windTowers.forEach(t => {
                    const elem = t.tile.element!
                    elementCount[elem] = (elementCount[elem] || 0) + 1
                  })
                  
                  return (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🌟 五行分布:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {Object.entries(elementCount).map(([element, count]) => (
                          <div key={element} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}>
                            <div style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '3px',
                              border: '1px solid #fff',
                              backgroundColor: getElementColor(element),
                              boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                            }} />
                            <span style={{ color: getElementColor(element), fontWeight: 'bold' }}>
                              {getElementName(element)}×{count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
          
          {/* 激活的胡牌组合 */}
          {activeHuPatterns.length > 0 && (
            <div>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: 'bold',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '20px' }}>🏆</span>
                <span>胡牌组合 ({activeHuPatterns.length})</span>
              </div>
              <div style={{ 
                maxHeight: '200px',
                overflowY: 'auto',
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '8px'
              }}>
                {activeHuPatterns.map((buff: any, index: number) => (
                  <div 
                    key={index}
                    style={{ 
                      marginBottom: '8px',
                      padding: '8px',
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      lineHeight: '1.5'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {buff.type === 'lizhi' && '立直'}
                      {buff.type === 'duanyaojiu' && '断幺九'}
                      {buff.type === 'duiduihu' && '对对和'}
                      {buff.type === 'qingyise_hu' && '清一色'}
                      {buff.type === 'hunyise' && '混一色'}
                      {buff.type === 'xiaosanyuan' && '小三元'}
                      {buff.type === 'dasanyuan' && '大三元'}
                      {buff.type === 'xiaosixi' && '小四喜'}
                      {buff.type === 'dasixi' && '大四喜'}
                    </div>
                    <div style={{ opacity: 0.9 }}>
                      {formatBuffDescription(buff)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 无Buff时的提示 */}
          {keziCount === 0 && shunziCount === 0 && activeHuPatterns.length === 0 && (
            <div style={{ 
              textAlign: 'center',
              fontSize: '12px',
              opacity: 0.7,
              padding: '20px 0'
            }}>
              暂无激活的Buff
              <br />
              <small>合成刻子/顺子或达成胡牌组合可获得增益</small>
            </div>
          )}
        </div>
        
        {/* ✅ 新增: 场上牌列表面板 - 简化版 */}
        <div style={{
          width: '280px',
          maxHeight: '500px',
          overflowY: 'auto',
          background: 'rgba(0, 0, 0, 0.85)',
          borderRadius: '12px',
          padding: '16px',
          color: '#fff',
          fontSize: '14px'
        }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            color: '#FFD700',
            borderBottom: '1px solid rgba(255,215,0,0.3)',
            paddingBottom: '8px'
          }}>
            📋 场上牌列表 ({gameStateRef.current.towers.length}张)
          </h3>
          
          {gameStateRef.current.towers.map((tower, index) => (
            <div 
              key={tower.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                padding: '6px',
                background: tower.id === uiState.selectedTowerId ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                border: tower.id === uiState.selectedTowerId ? '2px solid #FFD700' : 'none'
              }}
            >
              {/* 左侧: 牌面图标 */}
              <MahjongTileIcon tile={tower.tile} size="small" />
              
              {/* 右侧: 累计伤害 */}
              <div style={{ 
                flex: 1,
                textAlign: 'right',
                color: tower.damageDealtThisWave && tower.damageDealtThisWave > 0 ? '#00FF00' : '#888',
                fontWeight: 'bold',
                fontSize: '13px'
              }}>
                💥 {(tower.damageDealtThisWave || 0).toFixed(0)}
              </div>
            </div>
          ))}
          
          {gameStateRef.current.towers.length === 0 && (
            <div style={{ 
              color: '#888', 
              textAlign: 'center',
              padding: '20px'
            }}>
              当前场上无牌
            </div>
          )}
        </div>
      </div>
      
      {/* 合成对话框 */}
      {showSynthesisDialog && (
        <SynthesisDialog
          storedTowers={[]}  // ✅ 已删除存储区概念,传空数组
          onSynthesize={(selectedIds) => {
            console.log('尝试合成:', selectedIds)
            synthesizeTowers(selectedIds)
            setShowSynthesisDialog(false)
          }}
          onClose={() => setShowSynthesisDialog(false)}
        />
      )}
      
      {/* ✅ 新增: 图鉴面板 - 侧边滑出 */}
      {showGuide && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '500px',
          height: '100vh',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
          zIndex: 2000,
          overflowY: 'auto',
          padding: '30px',
          color: 'white',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          {/* 关闭按钮 */}
          <button
            onClick={() => setShowGuide(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              width: '40px',
              height: '40px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
              e.currentTarget.style.transform = 'rotate(90deg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.transform = 'rotate(0deg)'
            }}
          >
            ×
          </button>
          
          <h2 style={{ 
            margin: '0 0 30px 0',
            fontSize: '28px',
            textAlign: 'center',
            borderBottom: '2px solid rgba(255,255,255,0.2)',
            paddingBottom: '15px'
          }}>
            🀄 麻将TD图鉴
          </h2>
          
          {/* 刻子图鉴 */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ 
              fontSize: '22px',
              marginBottom: '15px',
              color: '#FFD700',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '32px' }}>🀀</span>
              刻子 (3个相同)
            </h3>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>万刻 → 西风</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 所有属性×2, 纯粹伤害, ❌无五行属性</p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#2196F3' }}>条刻 → 北风</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 所有属性×2, 纯粹伤害, ❌无五行属性</p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#FF9800' }}>筒刻 → 南风</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 所有属性×2, 纯粹伤害, ❌无五行属性</p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#F44336' }}>幺九刻 → 东风</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 所有属性×2, 纯粹伤害, ❌无五行属性</p>
              <p style={{ margin: '5px 0', fontSize: '12px', opacity: 0.7 }}>特殊: 数字为1或9的牌</p>
            </div>
          </div>
          
          {/* 杠图鉴 */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ 
              fontSize: '22px',
              marginBottom: '15px',
              color: '#FF6B6B',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '32px' }}>💥</span>
              杠 (4个相同)
            </h3>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#F44336' }}>万杠 → 红中</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 伤害×3, 范围×2, 攻速×2</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>特殊: 溅射半径60, 灼烧10/s持续3秒</p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>条杠 → 发财</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 伤害×3, 范围×2, 攻速×2</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>特殊: 无限穿透, 毒素30%/s持续5秒可叠加, 死亡扩散</p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#9E9E9E' }}>筒杠 → 白板</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 伤害×3, 范围×2, 攻速×2</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>特殊: 降低50%护甲持续4秒, 全队共享</p>
            </div>
          </div>
          
          {/* 顺子图鉴 */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ 
              fontSize: '22px',
              marginBottom: '15px',
              color: '#4CAF50',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '32px' }}>🀅</span>
              顺子 (连续3点)
            </h3>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>同花色连续3点 → 风牌</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 伤害求和, 攻速求和, 范围取最大</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>特殊: 保留五行属性, 获得微弱增益</p>
            </div>
            <div style={{
              background: 'rgba(76, 175, 80, 0.2)',
              borderRadius: '12px',
              padding: '20px',
              border: '2px solid #4CAF50'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#FFD700' }}>⭐ 五行属性系统</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>计算公式: (中间数字×3) % 5</p>
              <div style={{ marginTop: '10px', fontSize: '13px', lineHeight: '1.8' }}>
                <div><span style={{ color: '#FFD700', fontWeight: 'bold' }}>金:</span> 攻击带减甲30%, 持续3秒</div>
                <div><span style={{ color: '#8B4513', fontWeight: 'bold' }}>木:</span> 攻击范围翻倍</div>
                <div><span style={{ color: '#2196F3', fontWeight: 'bold' }}>水:</span> 减速效果增强</div>
                <div><span style={{ color: '#F44336', fontWeight: 'bold' }}>火:</span> 伤害再翻倍</div>
                <div><span style={{ color: '#C0C0C0', fontWeight: 'bold' }}>土:</span> +20%眩晕概率</div>
              </div>
            </div>
          </div>
          
          {/* 胡牌番型图鉴 */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ 
              fontSize: '22px',
              marginBottom: '15px',
              color: '#FFD700',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '32px' }}>🏆</span>
              胡牌番型
            </h3>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#2196F3' }}>立直</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>条件: 场上有≥3座塔未参与任何组合</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 伤害+10%, 暴击+5%</p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>断幺九</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>条件: 场上无数字1和9的牌</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 攻速+15%, 范围+10%</p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#FF9800' }}>对对和</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>条件: 场上≥3个刻子</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 伤害+20%, 暴击+10%</p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#F44336' }}>清一色</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>条件: 场上所有牌都是同一花色</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 伤害+30%, 攻速+20%</p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#9C27B0' }}>混一色</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>条件: 场上只有一种数牌+字牌</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 伤害+20%, 攻速+15%</p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#FF5722' }}>小三元</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>条件: 场上有2个三元牌刻子+1个三元牌对子</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 伤害+40%, 暴击+20%</p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#FFD700' }}>大三元</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>条件: 场上有3个三元牌刻子</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 伤害+60%, 攻速+30%, 暴击+25%</p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00BCD4' }}>小四喜</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>条件: 场上有3个风牌刻子+1个风牌对子</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 伤害+50%, 范围+30%</p>
            </div>
            <div style={{
              background: 'rgba(255,215,0,0.2)',
              borderRadius: '12px',
              padding: '20px',
              border: '2px solid #FFD700'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#FFD700' }}>大四喜</h4>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>条件: 场上有4个风牌刻子</p>
              <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>效果: 伤害+80%, 攻速+40%, 范围+40%, 暴击+30%</p>
            </div>
          </div>
          
          {/* 提示 */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '20px',
            marginTop: '20px',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0', fontSize: '14px', opacity: 0.8 }}>
              💡 提示: 合理搭配不同类型的合成和胡牌组合,可以获得强大的增益效果!
            </p>
          </div>
        </div>
      )}
      
      {/* 游戏状态提示 */}
      {uiState.gameStatus === 'game_over' && (
        <div style={{
          marginTop: '20px',
          padding: '20px',
          background: '#FFEBEE',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#F44336', margin: '0 0 10px 0' }}>游戏结束!</h2>
          <p>矿坑生命归零,你坚持了 {uiState.wave} 波</p>
        </div>
      )}
      
      {uiState.gameStatus === 'victory' && (
        <div style={{
          marginTop: '20px',
          padding: '20px',
          background: '#E8F5E9',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#4CAF50', margin: '0 0 10px 0' }}>胜利!</h2>
          <p>恭喜你完成了所有12波!</p>
        </div>
      )}
      
      {/* CSS动画定义 */}
      <style>{`
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; visibility: hidden; }
        }
      `}</style>
    </div>
  )
}
