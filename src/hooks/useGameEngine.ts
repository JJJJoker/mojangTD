import { useState, useRef, useCallback } from 'react'
import { useGameLoop } from './useGameLoop'
import { usePathfinding } from './usePathfinding'
import type { Enemy, Tower, Bullet, GridCell, MahjongTile, GlobalBuff, HuFanType, HuFanConfig, FloatingDamage } from '../types/game'
import { getTowerStats, formatTileName, MAHJONG_SYNTHESIS, HU_FAN_CONFIG } from '../config/towers'
import { ENEMY_TYPES, createEnemy } from '../config/enemies'
import { WAVES } from '../config/waves'
import { MAP_CONFIG, initializeGrid, gridToPixel, WAYPOINTS } from '../config/map'
import { soundManager } from '../utils/audio'
import { MahjongDeck } from '../utils/MahjongDeck'

const CELL_SIZE = 40  // 每个格子的像素大小

/**
 * ✅ 新增: 血量倍率计算函数(50波版本)
 * @param wave - 波次数(从1开始)
 * @returns 血量倍率
 */
export function getHealthMultiplier(wave: number): number {
  if (wave <= 5) {
    // 第1阶段: 1.0x → 2.0x (新手教学,更平缓)
    return 1.0 + (wave - 1) * 0.25
  } else if (wave <= 10) {
    // 第2阶段: 2.5x → 4.0x (逐渐加强)
    return 2.5 + (wave - 6) * 0.375
  } else if (wave <= 20) {
    // 第3阶段: 5.0x → 10.0x (中期挑战)
    return 5.0 + (wave - 11) * 0.556
  } else if (wave <= 30) {
    // 第4阶段: 12.0x → 20.0x (中后期困难)
    return 12.0 + (wave - 21) * 0.889
  } else if (wave <= 40) {
    // 第5阶段: 25.0x → 40.0x (后期极难)
    return 25.0 + (wave - 31) * 1.667
  } else {
    // 第6阶段: 50.0x → 100.0x (最终挑战)
    return 50.0 + (wave - 41) * 5.556
  }
}

// ==================== 麻将Unicode字符映射表 ====================
const MAHJONG_UNICODE = {
  // 万子: 🀇🀈🀉🀊🀋🀌🀍🀎🀏 (1-9万, Unicode: U+1F007 ~ U+1F00F)
  wan: ['\u{1F007}', '\u{1F008}', '\u{1F009}', '\u{1F00A}', '\u{1F00B}', '\u{1F00C}', '\u{1F00D}', '\u{1F00E}', '\u{1F00F}'],
  // 条子: 🀐🀑🀒🀓🀔🀕🀖🀗🀘 (1-9条, Unicode: U+1F010 ~ U+1F018)
  tiao: ['\u{1F010}', '\u{1F011}', '\u{1F012}', '\u{1F013}', '\u{1F014}', '\u{1F015}', '\u{1F016}', '\u{1F017}', '\u{1F018}'],
  // 筒子: 🀙🀚🀛🀜🀝🀞🀟🀠🀡 (1-9筒, Unicode: U+1F019 ~ U+1F021)
  tong: ['\u{1F019}', '\u{1F01A}', '\u{1F01B}', '\u{1F01C}', '\u{1F01D}', '\u{1F01E}', '\u{1F01F}', '\u{1F020}', '\u{1F021}']
}

/**
 * 获取麻将牌的Unicode字符
 * @param tile - 麻将牌面
 * @returns Unicode字符,如果无法识别则返回默认字符🀄
 */
function getTileUnicode(tile: MahjongTile): string {
  if (tile.suit && tile.number) {
    const index = tile.number - 1  // 点数1-9对应数组索引0-8
    return MAHJONG_UNICODE[tile.suit as keyof typeof MAHJONG_UNICODE]?.[index] || '\u{1F004}'
  }
  // 风牌、箭牌使用备用字符
  if (tile.wind) {
    const windChars = { dong: '\u{1F000}', nan: '\u{1F001}', xi: '\u{1F002}', bei: '\u{1F003}' }
    return windChars[tile.wind]
  }
  if (tile.dragon) {
    const dragonChars = { zhong: '\u{1F004}', fa: '\u{1F005}', bai: '\u{1F006}' }
    return dragonChars[tile.dragon]
  }
  return '\u{1F004}'  // 默认返回🀄
}

/**
 * 游戏引擎核心Hook
 * 
 * 整合所有游戏系统,包括:
 * - 资源管理(木材、金币、矿坑生命)
 * - 塔的放置、合成、升级
 * - 敌人生成和移动
 * - 战斗系统(攻击、伤害计算、子弹追踪)
 * - 波次管理
 * - Canvas渲染
 * 
 * 使用示例:
 * ```typescript
 * const {
 *   uiState,
 *   gameStateRef,
 *   selectGem,
 *   placeTower,
 *   decideKeepTower,
 *   decideBecomeObstacle,
 *   synthesizeTowers,
 *   startWave,
 *   start, stop, pause, resume
 * } = useGameEngine()
 * ```
 */
export function useGameEngine() {
  // 寻路相关功能
  const { calculatePath, validatePlacement } = usePathfinding()
  
  // ==================== UI状态(触发重渲染) ====================
  const [uiState, setUiState] = useState({
    gold: 50,             // 金币
    mineHealth: 15,       // 矿坑生命
    maxMineHealth: 15,    // 最大矿坑生命
    wave: 0,              // 当前波次
    gameStatus: 'preparing' as 'preparing' | 'playing' | 'paused' | 'game_over' | 'victory',
    selectedGem: null as MahjongTile | null,  // ✅ 当前选中的麻将牌面
    availableGems: [] as MahjongTile[],  // ✅ 当前波可用的随机麻将牌
    canPlaceTowers: true as boolean,  // 是否可以放置塔
    deckRemaining: 108,  // ✅ 新增: 牌山剩余数量
    currentPhase: 1,     // ✅ 新增: 当前阶段
    needsDecision: false, // ✅ 新增: 是否需要显示决策对话框
    placedCount: 0,       // ✅ 新增: 当前批次已放置数量
    selectedTowerId: null as string | null  // ✅ 新增: 当前选中的塔ID
  })
  
  // ==================== 游戏对象状态(不触发重渲染,高频更新) ====================
  const gameStateRef = useRef({
    enemies: [] as Enemy[],
    towers: [] as Tower[],
    bullets: [] as Bullet[],
    grid: initializeGrid(),
    currentPath: null as { row: number; col: number }[] | null,
    waveInProgress: false,
    waveCompleted: false,  // 当前波次是否完成
    spawnQueue: [] as Array<{ type: 'basic' | 'fast' | 'tank'; delay: number }>,
    waveStartTime: 0 as number,  // 波次开始时间
    currentBatchTowerIds: [] as string[],  // 当前批次放置的塔ID列表
    currentHealthMultiplier: 1.0 as number,  // 当前波次的血量倍率
    mahjongDeck: new MahjongDeck(),  // ✅ 新增: 麻将牌山实例
    placedCount: 0,  // ✅ 新增: 当前批次已放置数量
    globalBuffs: [] as Array<{ active: boolean; [key: string]: any }>,  // ✅ 新增: 全局Buff列表
    floatingDamages: [] as FloatingDamage[]  // ✅ 新增: 伤害飘字
  })
  
  // 计算初始路径
  const initialPath = calculatePath(gameStateRef.current.grid)
  gameStateRef.current.currentPath = initialPath
  console.log('✅ 初始路径已计算:', initialPath ? `长度${initialPath.length}` : '无路径')
  
  // ==================== 核心方法 ====================
  
  /**
   * 选择麻将牌面
   * @param tile - 要选择的麻将牌面
   */
  const selectGem = useCallback((tile: MahjongTile) => {
    setUiState(prev => ({ ...prev, selectedGem: tile }))
  }, [])
  
  /**
   * 放置塔到指定位置(从牌山逐一抽取)
   * 
   * 新版宝石TD玩法:
   * 1. 点击地图格子,从牌山抽取1张麻将牌面塔
   * 2. 每次消耗1木材
   * 3. 连续放置5次后必须选择保留哪一个
   * 4. 牌山不足时自动进入下一阶段并重置
   * 
   * @param gridPos - 格子坐标 {row, col}
   * @returns 新创建的塔数组,如果放置失败则返回null
   */
  const placeTower = useCallback((gridPos: { row: number; col: number }) => {
    // ✅ 添加调试日志
    console.log('🔍 placeTower检查:', {
      gameStatus: uiState.gameStatus,
      waveInProgress: gameStateRef.current.waveInProgress,
      canPlaceTowers: uiState.canPlaceTowers,
      placedCount: gameStateRef.current.placedCount,
      currentBatchTowerIds: gameStateRef.current.currentBatchTowerIds.length
    })
    
    // ✅ 只在波次进行中禁止放置
    if (uiState.gameStatus === 'playing' && gameStateRef.current.waveInProgress) {
      console.warn('⏳ 当前波次尚未结束,请等待敌人全部消灭后再放置!')
      return null
    }
    
    if (!uiState.canPlaceTowers) {
      console.warn('❌ 当前不能放置塔! gameStatus:', uiState.gameStatus, 'waveInProgress:', gameStateRef.current.waveInProgress)
      return null
    }
    
    // ✅ 检查是否已达到5个
    if (gameStateRef.current.placedCount >= 5) {
      alert('请先选择保留哪一个塔!')
      return null
    }
    
    const { grid, mahjongDeck } = gameStateRef.current
    
    // ✅ 修改: 允许在empty或obstacle上放置塔
    if (grid[gridPos.row][gridPos.col].type !== 'empty' && grid[gridPos.row][gridPos.col].type !== 'obstacle') {
      console.warn('该位置已有建筑,无法放置')
      return null
    }
    
    // 验证是否会堵死路径
    if (!validatePlacement(grid, gridPos)) {
      alert('不能堵死路径!')
      return null
    }
    
    // ✅ 检查牌山是否需要补充
    if (mahjongDeck.needsRefill()) {
      console.log('⚠️ 牌山不足,即将进入下一阶段')
      alert('敌人进化进入阶段二!\n获得新牌山,敌人数值增强!')
      mahjongDeck.refill()
      // TODO: 增强敌人数值(后续实现)
    }
    
    // ✅ 从牌山抽取1张牌(而非5张)
    const drawnTiles = mahjongDeck.draw(1)
    const tile = drawnTiles[0]
    
    console.log(`🀄 抽取第${gameStateRef.current.placedCount + 1}张牌: ${formatTileName(tile)}`)
    console.log(`   牌山剩余: ${mahjongDeck.remaining()}张, 当前阶段: ${mahjongDeck.getPhase()}`)
    
    // ✅ 创建单个塔
    const stats = getTowerStats(tile)
    
    const newTower: Tower = {
      id: `tower_${Date.now()}`,
      tile: tile,
      position: gridToPixel(gridPos.row, gridPos.col),
      gridPosition: gridPos,
      damage: stats.damage || 10,
      range: stats.range || 100,
      attackSpeed: stats.attackSpeed || 1.0,
      damageType: stats.damageType || 'physical',
      multiTarget: stats.multiTarget,  // ✅ 直接使用配置值(万=1,条=2,筒=3)
      lastAttackTime: 0,
      damageDealtThisWave: 0  // ✅ 初始化本波累计伤害为0
    }
    
    // ✅ 添加到地图
    gameStateRef.current.towers.push(newTower)
    
    // ✅ 更新格子类型
    grid[gridPos.row][gridPos.col] = {
      ...grid[gridPos.row][gridPos.col],
      type: 'tower',
      towerId: newTower.id
    }
    
    // ✅ 添加到当前批次列表
    gameStateRef.current.currentBatchTowerIds.push(newTower.id)
    
    // ✅ 计数器+1
    gameStateRef.current.placedCount++
    
    // ✅ 更新UI状态
    setUiState(prev => ({
      ...prev,
      deckRemaining: mahjongDeck.remaining(),
      currentPhase: mahjongDeck.getPhase(),
      placedCount: gameStateRef.current.placedCount  // ✅ UI显示已放置数量
    }))
    
    // ✅ 如果达到5个,提示玩家点击塔查看详情
    if (gameStateRef.current.placedCount === 5) {
      console.log(`✅ 已放置5座塔,点击任意塔查看详情并决定是否保留`)
      
      // 不设置needsDecision,只是提示
      setUiState(prev => ({
        ...prev,
        placedCount: gameStateRef.current.placedCount
      }))
    } else {
      console.log(`已放置 ${gameStateRef.current.placedCount}/5 座塔`)
    }
    
    return [newTower]  // 返回单个塔的数组
  }, [validatePlacement, calculatePath])
  

  
  /**
   * 检查牌山状态
   * 
   * @returns 是否需要补充牌山
   */
  const checkDeckStatus = useCallback(() => {
    const { mahjongDeck } = gameStateRef.current
    
    if (mahjongDeck.needsRefill()) {
      console.log('⚠️ 牌山不足,即将进入下一阶段')
      return true
    }
    return false
  }, [])
  
  /**
   * 处理塔点击事件
   * 
   * 任何时候都可以点击任意塔查看其属性和攻击范围
   * - placedCount < 5: 只显示属性,不显示合成选项
   * - placedCount === 5: 显示完整决策对话框(属性+合成选项)
   */
  const handleTowerClick = useCallback((towerId: string) => {
    const { towers } = gameStateRef.current
    
    const tower = towers.find(t => t.id === towerId)
    if (!tower) {
      console.warn('找不到塔:', towerId)
      return
    }
    
    console.log(`👆 点击了塔: ${formatTileName(tower.tile)}`)
    
    // 设置选中的塔并触发决策对话框
    setUiState(prev => ({
      ...prev,
      selectedTowerId: towerId,
      needsDecision: true  // 触发决策对话框
    }))
  }, [])
  
  /**
   * 批量决定5个塔的处理方式
   * 
   * 新规则:
   * - 选择1个塔留在场上(继续攻击敌人)
   * - 其余4个塔变成障碍物(牌返回牌山)
   * 
   * @param keepTowerId - 要保留的塔ID
   */
  const finalizeTowers = useCallback((keepTowerId: string) => {
    const { towers, grid, currentBatchTowerIds, mahjongDeck } = gameStateRef.current
    
    console.log('开始处理塔的决策,保留:', keepTowerId)
    console.log('当前批次塔IDs:', currentBatchTowerIds)
    
    // ✅ 只处理当前批次的塔
    currentBatchTowerIds.forEach(towerId => {
      const tower = towers.find(t => t.id === towerId)
      if (!tower) {
        console.warn('找不到塔:', towerId)
        return
      }
      
      if (towerId === keepTowerId) {
        // ✅ 保留的塔: 留在场上,不做任何操作
        console.log(`✅ 保留: ${formatTileName(tower.tile)} (留在场上继续攻击)`)
        console.log(`   位置: (${tower.gridPosition.row}, ${tower.gridPosition.col})`)
      } else {
        // ✅ 变障碍: 牌返回牌山
        mahjongDeck.returnToDeck([tower.tile])
        
        // 将塔所在位置变为障碍物
        const { row, col } = tower.gridPosition
        grid[row][col].type = 'obstacle'
        
        // 从场上移除该塔
        const index = towers.findIndex(t => t.id === towerId)
        if (index !== -1) {
          towers.splice(index, 1)
        }
        
        console.log(`🔄 变障碍: ${formatTileName(tower.tile)} (牌已返回牌山)`)
      }
    })
    
    // 清空当前批次
    gameStateRef.current.currentBatchTowerIds = []
    
    // ✅ 重置计数器
    gameStateRef.current.placedCount = 0
    gameStateRef.current.currentBatchTowerIds = []
    
    // ✅ 根据游戏状态和波次状态决定是否允许放置
    const isWaveActive = 
      uiState.gameStatus === 'playing' && 
      gameStateRef.current.waveInProgress
    
    // 更新UI
    setUiState(prev => ({
      ...prev,
      deckRemaining: mahjongDeck.remaining(),
      currentPhase: mahjongDeck.getPhase(),
      placedCount: 0,
      canPlaceTowers: !isWaveActive,  // 只有波次进行中才禁止
      needsDecision: false,
      selectedTowerId: null
    }))
    
    console.log(`finalizeTowers完成! isWaveActive=${isWaveActive}, canPlaceTowers=${!isWaveActive}`)
  }, [uiState.gameStatus])
  
  /**
   * 处理障碍物点击事件
   * 
   * 功能:
   * - 弹出确认对话框
   * - 确认后消除障碍物变为空地
   * - 重新计算敌人路径
   * - 更新所有敌人的路径
   * 
   * @param gridPos - 格子坐标 {row, col}
   */
  const handleObstacleClick = useCallback((gridPos: { row: number; col: number }) => {
    const confirmed = window.confirm('确定要消除这个障碍物吗?\n消除后将重新计算敌人路径。')
    
    if (confirmed) {
      const { grid } = gameStateRef.current
      
      // 将障碍物变为空地
      grid[gridPos.row][gridPos.col].type = 'empty'
      
      // 重新计算路径
      const newPath = calculatePath(grid)
      gameStateRef.current.currentPath = newPath
      
      console.log(`✅ 障碍物已消除: (${gridPos.row}, ${gridPos.col})`)
      console.log(`   新路径长度: ${newPath ? newPath.length : '无路径'}`)
    }
  }, [calculatePath])
  
  /**
   * 合成麻将牌面子(刻子/顺子/杠)
   * 
   * ✅ 新设计:
   * - 刻子: 3张同花色同点数 → 风牌(伤害×1.5,范围×1.3,攻速×1.2,纯粹伤害)
   * - 杠: 4张同花色同点数 → 中发白(伤害×3,范围×2,攻速×2,特殊效果)
   * - 顺子: 不再合成塔,只提供被动增益
   * - ✅ 删除了链式攻击和复合合成
   * 
   * @param selectedIds - 选中的塔ID列表
   */
  const synthesizeTowers = useCallback((selectedIds: string[]) => {
    const { towers, grid } = gameStateRef.current
    
    if (selectedIds.length < 3) {
      alert('至少需要选择3座塔才能合成!')
      return
    }
    
    // 获取选中的塔
    const selectedTowers = selectedIds.map(id => 
      towers.find(t => t.id === id)
    ).filter(Boolean) as Tower[]
    
    if (selectedTowers.length < 3) {
      alert('找不到选中的塔!')
      return
    }
    
    console.log(`🎯 开始合成 ${selectedTowers.length} 个塔`)
    
    let resultTower: Tower | null = null
    
    // 检测是否为杠(4个相同)
    if (selectedTowers.length === 4) {
      const firstTile = selectedTowers[0].tile
      const allSame = selectedTowers.every(t => 
        t.tile.suit === firstTile.suit && 
        t.tile.number === firstTile.number
      )
      
      if (allSame && firstTile.suit && firstTile.number) {
        resultTower = performGangSynthesis(selectedTowers, firstTile.suit, firstTile.number)
      }
    }
    
    // 检测是否为刻子(3个相同)
    if (!resultTower && selectedTowers.length === 3) {
      const firstTile = selectedTowers[0].tile
      const allSame = selectedTowers.every(t => 
        t.tile.suit === firstTile.suit && 
        t.tile.number === firstTile.number
      )
      
      if (allSame && firstTile.suit && firstTile.number) {
        resultTower = performKeziSynthesis(selectedTowers, firstTile.suit, firstTile.number)
      }
    }
    
    // ✅ 新增: 检测是否为顺子(同花色连续3点)
    if (!resultTower && selectedTowers.length === 3) {
      if (isValidShunzi(selectedTowers)) {
        resultTower = performShunziSynthesis(selectedTowers)
      }
    }
    
    if (!resultTower) {
      alert('无法识别的合成类型!需要3个相同或连续3点的数牌。')
      return
    }
    
    // 替换第一个塔为合成结果
    const firstTower = selectedTowers[0]
    const index = towers.findIndex(t => t.id === firstTower.id)
    if (index !== -1) {
      towers[index] = resultTower
    }
    
    // 移除其他塔并返回牌山
    selectedTowers.slice(1).forEach(tower => {
      gameStateRef.current.mahjongDeck.returnToDeck([tower.tile])
      
      const idx = towers.findIndex(t => t.id === tower.id)
      if (idx !== -1) {
        towers.splice(idx, 1)
      }
    })
    
    console.log(`✅ 合成完成: ${formatTileName(resultTower.tile)}`)
    
    // ✅ 检查是否需要胡牌检测(每放置5个塔后)
    checkHuPai()
    
    return resultTower
  }, [])
  
  /**
   * ✅ 新增: 胡牌检测系统
   * 
   * 检测时机: 每次合成后自动检查
   * 胡牌条件: 4面子+1雀头(简化版:只要有刻子/杠即可)
   */
  const checkHuPai = useCallback(() => {
    const { towers } = gameStateRef.current
    
    // 收集场上所有塔的面子信息
    const tiles: MahjongTile[] = towers.map(t => t.tile)
    
    console.log(`🀄 开始胡牌检测,场上共有${tiles.length}个面子`)
    
    // 统计各类面子数量
    const keziCount = tiles.filter(t => t.wind).length  // 风牌=刻子转化
    const gangCount = tiles.filter(t => t.dragon).length  // 中发白=杠转化
    const shunziCount = 0  // 顺子不再作为独立塔存在
    
    console.log(`   刻子(风牌): ${keziCount}, 杠(中发白): ${gangCount}`)
    
    // 检测常见番型
    const detectedFans: HuFanType[] = []
    
    // 1. 立直: 只要有刻子或杠就触发
    if (keziCount > 0 || gangCount > 0) {
      detectedFans.push('lizhi')
      console.log('✅ 检测到: 立直')
    }
    
    // 2. 断幺九: 没有幺九牌(1和9)
    const hasYaojiu = tiles.some(t => t.number === 1 || t.number === 9)
    if (!hasYaojiu && tiles.length > 0) {
      detectedFans.push('duanyaojiu')
      console.log('✅ 检测到: 断幺九')
    }
    
    // 3. 对对和: 全是刻子/杠
    if (keziCount + gangCount >= 4 && tiles.every(t => t.wind || t.dragon)) {
      detectedFans.push('duiduihu')
      console.log('✅ 检测到: 对对和')
    }
    
    // 4. 清一色: 只有一种花色的刻子
    const windSuits = new Set<string>()
    tiles.filter(t => t.wind).forEach(t => {
      // 根据风牌反推原花色(简化处理)
      if (t.element) windSuits.add(t.element)
    })
    if (windSuits.size === 1 && keziCount >= 4) {
      detectedFans.push('qingyise_hu')
      console.log('✅ 检测到: 清一色')
    }
    
    // 5. 混一色: 一种花色+字牌
    if (windSuits.size === 1 && (keziCount + gangCount) >= 4) {
      detectedFans.push('hunyise')
      console.log('✅ 检测到: 混一色')
    }
    
    // 6-7. 小三元/大三元
    const zhongCount = tiles.filter(t => t.dragon === 'zhong').length
    const faCount = tiles.filter(t => t.dragon === 'fa').length
    const baiCount = tiles.filter(t => t.dragon === 'bai').length
    
    if (zhongCount >= 1 && faCount >= 1 && baiCount >= 1) {
      if (zhongCount + faCount + baiCount >= 3) {
        detectedFans.push('dasanyuan')
        console.log('✅ 检测到: 大三元')
      } else {
        detectedFans.push('xiaosanyuan')
        console.log('✅ 检测到: 小三元')
      }
    }
    
    // 8-9. 小四喜/大四喜
    const dongCount = tiles.filter(t => t.wind === 'dong').length
    const nanCount = tiles.filter(t => t.wind === 'nan').length
    const xiCount = tiles.filter(t => t.wind === 'xi').length
    const beiCount = tiles.filter(t => t.wind === 'bei').length
    
    if (dongCount >= 1 && nanCount >= 1 && xiCount >= 1 && beiCount >= 1) {
      if (dongCount + nanCount + xiCount + beiCount >= 4) {
        detectedFans.push('dasixi')
        console.log('✅ 检测到: 大四喜')
      } else {
        detectedFans.push('xiaosixi')
        console.log('✅ 检测到: 小四喜')
      }
    }
    
    // 应用全局Buff
    if (detectedFans.length > 0) {
      applyGlobalBuffs(detectedFans)
    } else {
      console.log('❌ 未检测到胡牌番型')
    }
  }, [])
  
  /**
   * ✅ 新增: 应用全局增益效果
   */
  const applyGlobalBuffs = useCallback((fans: HuFanType[]) => {
    const { towers } = gameStateRef.current
    
    console.log(`✨ 应用${fans.length}个全局增益效果`)
    
    // 计算总增益
    let totalDamageMultiplier = 1.0
    let totalAttackSpeedBonus = 0
    let totalRangeMultiplier = 1.0
    let totalCritChanceBonus = 0
    let totalDamagePercentBonus = 0
    
    fans.forEach(fan => {
      const config = HU_FAN_CONFIG[fan] as HuFanConfig | undefined
      if (config) {
        console.log(`   - ${config.name}: ${config.description}`)
        
        if (config.effect.damageMultiplier) {
          totalDamageMultiplier *= config.effect.damageMultiplier
        }
        if (config.effect.attackSpeedBonus) {
          totalAttackSpeedBonus += config.effect.attackSpeedBonus
        }
        if (config.effect.rangeMultiplier) {
          totalRangeMultiplier *= config.effect.rangeMultiplier
        }
        if (config.effect.critChanceBonus) {
          totalCritChanceBonus += config.effect.critChanceBonus
        }
        if (config.effect.damagePercentBonus) {
          totalDamagePercentBonus += config.effect.damagePercentBonus
        }
      }
    })
    
    // 应用到所有塔
    towers.forEach(tower => {
      tower.damage = Math.floor(tower.damage * totalDamageMultiplier * (1 + totalDamagePercentBonus))
      tower.attackSpeed = tower.attackSpeed * (1 + totalAttackSpeedBonus)
      tower.range = Math.floor(tower.range * totalRangeMultiplier)
      if (tower.critChance) {
        tower.critChance += totalCritChanceBonus
      }
    })
    
    console.log(`✅ 全局增益已应用: 伤害×${totalDamageMultiplier.toFixed(2)}, 攻速+${(totalAttackSpeedBonus*100).toFixed(0)}%, 范围×${totalRangeMultiplier.toFixed(2)}, 暴击+${(totalCritChanceBonus*100).toFixed(0)}%`)
  }, [])
  
  /**
   * ✅ 新增: 执行刻子合成 → 风牌
   */
  const performKeziSynthesis = useCallback(
    (towers: Tower[], suit: string, number: number): Tower => {
      const config = MAHJONG_SYNTHESIS.kezi(suit as any, number as any)
      
      console.log(`🀄 合成刻子: ${formatTileName(towers[0].tile)} x3 → ${formatTileName(config.tile)}`)
      console.log(`   五行属性: ${config.tile.element}`)
      
      // ✅ 新规则: 属性为3张牌之和的2倍
      const totalDamage = towers.reduce((sum, t) => sum + t.damage, 0)
      const totalAttackSpeed = towers.reduce((sum, t) => sum + t.attackSpeed, 0)
      const maxRange = Math.max(...towers.map(t => t.range))
      const totalMultiTarget = towers.reduce((sum, t) => sum + (t.multiTarget || 1), 0)
      
      // 创建风牌塔
      const windTower: Tower = {
        ...towers[0],
        tile: config.tile,
        damage: totalDamage * config.bonus.damageMultiplier,
        attackSpeed: totalAttackSpeed * config.bonus.attackSpeedMultiplier,
        range: maxRange * config.bonus.rangeMultiplier,
        multiTarget: totalMultiTarget * config.bonus.multiTargetMultiplier,
        damageType: config.bonus.damageType
      }
      
      completeSynthesis(towers, windTower, gameStateRef.current.grid, gameStateRef.current.towers)
      return windTower
    },
    []
  )
  
  /**
   * ✅ 新增: 执行杠合成 → 中发白
   */
  const performGangSynthesis = useCallback(
    (towers: Tower[], suit: string, number: number): Tower => {
      const config = MAHJONG_SYNTHESIS.gang(suit as any, number as any)
      
      // ✅ 新规则: 属性为所有参与塔的总和×倍率
      const totalDamage = towers.reduce((sum, t) => sum + t.damage, 0)
      const totalAttackSpeed = towers.reduce((sum, t) => sum + t.attackSpeed, 0)
      const maxRange = Math.max(...towers.map(t => t.range))
      const totalMultiTarget = towers.reduce((sum, t) => sum + (t.multiTarget || 1), 0)
      
      console.log(`💥 合成杠: ${formatTileName(towers[0].tile)} x4 → ${formatTileName(config.tile)}, multiTarget=${totalMultiTarget * config.bonus.multiTargetMultiplier}`)
      
      // 创建中发白塔
      const dragonTower: Tower = {
        ...towers[0],
        tile: config.tile,
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
      
      completeSynthesis(towers, dragonTower, gameStateRef.current.grid, gameStateRef.current.towers)
      return dragonTower
    },
    []
  )
  
  /**
   * ✅ 新增: 检测3个塔是否能组成顺子
   */
  function isValidShunzi(towers: Tower[]): boolean {
    if (towers.length !== 3) return false
    
    const suit = towers[0].tile.suit
    const numbers = towers.map(t => t.tile.number)
    
    // 必须同花色且都有数字
    if (!suit || numbers.some(n => n === undefined)) return false
    
    const sortedNumbers = [...numbers].sort((a, b) => a! - b!)
    
    // 检查是否连续
    return (
      sortedNumbers[1] === sortedNumbers[0]! + 1 &&
      sortedNumbers[2] === sortedNumbers[1]! + 1
    )
  }
  
  /**
   * ✅ 新增: 执行顺子合成 → 风牌
   */
  const performShunziSynthesis = useCallback(
    (towers: Tower[]): Tower => {
      console.log(`🀄 合成顺子:`, towers.map(t => formatTileName(t.tile)))
      
      const result = MAHJONG_SYNTHESIS.shunzi(towers)
      
      console.log(`✅ 顺子合成完成: ${result.tile.wind} (${result.tile.element})`)
      
      completeSynthesis(towers, result, gameStateRef.current.grid, gameStateRef.current.towers)
      return result
    },
    []
  )
  

  // 完成合成的通用逻辑
  function completeSynthesis(materials: Tower[], result: Tower, grid: GridCell[][], towers: Tower[]) {
    // 第一个材料塔的位置作为新塔位置
    const firstTower = materials[0]
    
    // 更新地图上的塔
    const mapTowerIndex = towers.findIndex(t => t.id === firstTower.id)
    if (mapTowerIndex !== -1) {
      towers[mapTowerIndex] = result
    }
    
    // 其他材料塔变成障碍物
    for (let i = 1; i < materials.length; i++) {
      const materialTower = materials[i]
      const materialGridPos = materialTower.gridPosition
      
      // 从towers数组移除
      const index = towers.findIndex(t => t.id === materialTower.id)
      if (index !== -1) {
        towers.splice(index, 1)
      }
      
      // 将该位置变为障碍物
      grid[materialGridPos.row][materialGridPos.col] = {
        type: 'obstacle',
        row: materialGridPos.row,
        col: materialGridPos.col
      }
      
      console.log(`✅ 合成材料变为障碍物: (${materialGridPos.row},${materialGridPos.col})`)
    }
    
    // 将新塔添加到场上(替换原位置)
    console.log(`✅ 合成成功! 结果: ${formatTileName(result.tile)}`)
    
    // 重新计算路径
    const newPath = calculatePath(grid)
    gameStateRef.current.currentPath = newPath
  }
  

  

  
  /**
   * 开始下一波敌人
   * 
   * 流程:
   * 1. 检查是否还有剩余波次
   * 2. 根据波次配置生成敌人生成队列(应用血量倍率)
   * 3. 锁定放置阶段(波次中不能放置塔)
   * 4. 清空可用宝石
   * 
   * 注意:此函数会自动递增波次数
   */
  const startWave = useCallback(() => {
    const { wave } = uiState
    
    if (wave >= WAVES.length) {
      setUiState(prev => ({ ...prev, gameStatus: 'victory' }))
      return
    }
    
    const waveConfig = WAVES[wave]
    // ✅ 使用动态计算的血量倍率(更陡峭的曲线)
    const healthMultiplier = getHealthMultiplier(wave + 1)  // wave从0开始,所以需要+1
    
    console.log(`🌊 开始第${wave + 1}波`)
    console.log(`  血量倍率: ${healthMultiplier}x (动态计算)`)
    
    // ✅ 保存当前波次的血量倍率
    gameStateRef.current.currentHealthMultiplier = healthMultiplier
    
    // 生成敌人生成队列
    const spawnQueue: Array<{ type: 'basic' | 'fast' | 'tank'; delay: number }> = []
    let currentTime = 0
    
    waveConfig.enemies.forEach(enemyConfig => {
      for (let i = 0; i < enemyConfig.count; i++) {
        spawnQueue.push({
          type: enemyConfig.type,
          delay: currentTime
        })
        currentTime += enemyConfig.interval
      }
    })
    
    spawnQueue.sort((a, b) => a.delay - b.delay)
    
    console.log('生成队列:', spawnQueue) // 调试日志
    
    gameStateRef.current.spawnQueue = spawnQueue
    gameStateRef.current.waveStartTime = Date.now()  // 初始化波次开始时间
    gameStateRef.current.waveInProgress = true
    gameStateRef.current.waveCompleted = false
    
    // ✅ 重置放置计数器和当前批次列表
    gameStateRef.current.placedCount = 0
    gameStateRef.current.currentBatchTowerIds = []
    console.log('波次开始,重置当前批次塔列表和放置计数器')
    
    // ✅ 重置所有塔的本波累计伤害
    gameStateRef.current.towers.forEach(tower => {
      tower.damageDealtThisWave = 0
    })
    console.log('已重置所有塔的累计伤害统计')
    
    // 锁定放置阶段,波次中不能放置塔
    setUiState(prev => ({
      ...prev,
      wave: prev.wave + 1,
      gameStatus: 'playing',
      canPlaceTowers: false,
      availableGems: [],
      selectedGem: null,
      needsDecision: false,  // ✅ 重置决策标志
      placedCount: 0         // ✅ 重置放置计数器
    }))
  }, [uiState.wave])
  
  // ==================== Update函数 ====================
  
  /**
   * 更新敌人位置和状态
   * 
   * 处理:
   * - 沿路径移动
   * - 减速效果计时
   * - 毒素持续伤害
   * - 眩晕状态更新
   * - 到达终点扣除矿坑生命
   * - 清理已到达终点的敌人
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const updateEnemies = useCallback((deltaTime: number) => {
    const { enemies, currentPath } = gameStateRef.current
    
    if (!currentPath || currentPath.length === 0) return
    
    enemies.forEach(enemy => {
      if (enemy.reachedEnd || enemy.isDead) return
      
      // ✅ 处理Debuff
      if (enemy.debuffs && enemy.debuffs.length > 0) {
        // 遍历所有debuff
        for (let i = enemy.debuffs.length - 1; i >= 0; i--) {
          const debuff = enemy.debuffs[i]
          
          // 减少持续时间
          debuff.duration -= deltaTime / 1000  // 转换为秒
          
          // 应用效果
          if (debuff.type === 'burn') {
            // 灼烧: 每秒造成伤害
            const burnDamage = debuff.value * (deltaTime / 1000)
            enemy.health -= burnDamage
            
            if (enemy.health <= 0 && !enemy.isDead) {
              enemy.isDead = true
              setUiState(prev => ({ ...prev, gold: prev.gold + enemy.reward }))
            }
          } else if (debuff.type === 'poison') {
            // 毒素: 按百分比造成伤害
            const poisonDamage = enemy.maxHealth * debuff.value * (deltaTime / 1000)
            enemy.health -= poisonDamage
            
            if (enemy.health <= 0 && !enemy.isDead) {
              enemy.isDead = true
              setUiState(prev => ({ ...prev, gold: prev.gold + enemy.reward }))
            }
          } else if (debuff.type === 'armor_reduction') {
            // 减甲: 在dealDamage时处理,这里只管理持续时间
          } else if (debuff.type === 'slow') {
            // 减速: 通过slowTimer处理,这里只管理持续时间
          } else if (debuff.type === 'stun') {
            // 眩晕: 通过isStunned处理,这里只管理持续时间
            enemy.isStunned = true
          }
          
          // 移除过期的debuff
          if (debuff.duration <= 0) {
            // 如果是眩晕,需要清除状态
            if (debuff.type === 'stun') {
              enemy.isStunned = false
            }
            enemy.debuffs.splice(i, 1)
          }
        }
      }
      
      // ========== 更新毒素效果 ==========
      if (enemy.poisonEffects && enemy.poisonEffects.length > 0) {
        const currentTime = Date.now()
        
        enemy.poisonEffects = enemy.poisonEffects.filter(effect => {
          const elapsed = currentTime - effect.startTime
          
          if (elapsed >= effect.duration) {
            return false  // 毒素效果结束
          }
          
          // 每1秒造成一次伤害
          if (elapsed % 1000 < deltaTime) {
            enemy.health -= effect.damage
            console.log(`☠️ 毒素伤害: ${effect.damage}`)
            
            if (enemy.health <= 0 && !enemy.isDead) {
              enemy.isDead = true
              setUiState(prev => ({ ...prev, gold: prev.gold + enemy.reward }))
            }
          }
          
          return true
        })
      }
      
      // ========== 更新眩晕状态 ==========
      if (enemy.isStunned && enemy.stunEndTime) {
        if (Date.now() >= enemy.stunEndTime) {
          enemy.isStunned = false
          enemy.stunEndTime = undefined
          console.log('眩晕结束')
        }
      }
      
      // 减速效果处理
      let currentSpeed = enemy.speed
      if (enemy.slowTimer && enemy.slowTimer > 0) {
        enemy.slowTimer -= deltaTime
        currentSpeed *= 0.5 // 减速50%
      } else if (enemy.slowTimer && enemy.slowTimer <= 0) {
        enemy.slowTimer = undefined
      }
      
      // 如果被眩晕则不移动
      if (enemy.isStunned) {
        return
      }
      
      if (enemy.pathIndex >= currentPath.length - 1) {
        // 到达终点
        enemy.reachedEnd = true
        
        // 扣除矿坑生命
        setUiState(prev => {
          const newHealth = prev.mineHealth - 1
          if (newHealth <= 0) {
            return { ...prev, mineHealth: 0, gameStatus: 'game_over' }
          }
          return { ...prev, mineHealth: newHealth }
        })
        
        return
      }
      
      const currentPoint = currentPath[enemy.pathIndex]
      const nextPoint = currentPath[enemy.pathIndex + 1]
      
      const currentPixel = gridToPixel(currentPoint.row, currentPoint.col)
      const nextPixel = gridToPixel(nextPoint.row, nextPoint.col)
      
      const dx = nextPixel.x - currentPixel.x
      const dy = nextPixel.y - currentPixel.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      const moveDistance = currentSpeed * (deltaTime / 1000)
      enemy.progress += moveDistance / distance
      
      if (enemy.progress >= 1) {
        enemy.pathIndex++
        enemy.progress = 0
        enemy.position = { ...nextPixel }
      } else {
        enemy.position = {
          x: currentPixel.x + dx * enemy.progress,
          y: currentPixel.y + dy * enemy.progress
        }
      }
    })
    
    // 清理到达终点或死亡的敌人
    gameStateRef.current.enemies = enemies.filter(e => !e.reachedEnd && !e.isDead)
  }, [])
  
  /**
   * 根据生成队列生成敌人
   * 
   * 处理:
   * - 减少队列中敌人的delay
   * - 当delay<=0时生成敌人(应用血量倍率)
   * - 从队列中移除已生成的敌人
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const spawnEnemies = useCallback(() => {
    const { spawnQueue, waveStartTime, currentHealthMultiplier } = gameStateRef.current
    
    if (!gameStateRef.current.waveInProgress) return
    if (spawnQueue.length === 0) return
    
    const elapsedTime = Date.now() - waveStartTime!
    
    // 生成敌人
    while (spawnQueue.length > 0 && spawnQueue[0].delay <= elapsedTime) {
      const spawnData = spawnQueue.shift()!
      
      const path = gameStateRef.current.currentPath
      
      if (!path || path.length === 0) {
        console.warn('没有路径可以生成敌人!')
        continue
      }
      
      const startPos = path[0]
      const pixelPos = gridToPixel(startPos.row, startPos.col)
      
      // ✅ 应用血量倍率创建敌人
      const newEnemy = createEnemy(spawnData.type, pixelPos, currentHealthMultiplier)
      
      gameStateRef.current.enemies.push(newEnemy)
      console.log(`生成敌人: ${spawnData.type}, 血量=${newEnemy.health} (${currentHealthMultiplier}x)`) // 调试日志
    }
  }, [])
  
  /**
   * 处理塔的攻击逻辑
   * 
   * 处理:
   * - 查找范围内的敌人
   * - 选择最近的敌人作为目标
   * - 检查冷却时间
   * - 创建子弹
   * - ✅ 处理链式攻击(顺子特性)
   * - 🎵 播放攻击音效
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const processTowerAttacks = useCallback(() => {
    const { towers, enemies } = gameStateRef.current
    const now = Date.now()
    
    towers.forEach(tower => {
      // 查找范围内的所有敌人
      const enemiesInRange = enemies.filter(enemy => {
        if (enemy.isDead) return false
        const dx = enemy.position.x - tower.position.x
        const dy = enemy.position.y - tower.position.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        return distance <= tower.range
      })
      
      if (enemiesInRange.length === 0) return
      
      // ✅ 根据multiTarget选择攻击目标(默认1个)
      const targetCount = tower.multiTarget || 1
      
      // 按距离排序,选择最近的N个敌人
      const sortedEnemies = enemiesInRange.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.position.x - tower.position.x, 2) +
          Math.pow(a.position.y - tower.position.y, 2)
        )
        const distB = Math.sqrt(
          Math.pow(b.position.x - tower.position.x, 2) +
          Math.pow(b.position.y - tower.position.y, 2)
        )
        return distA - distB
      })
      
      const targets = sortedEnemies.slice(0, targetCount)
      
      // ✅ 新增: 调试日志
      if (tower.tile.wind || tower.tile.dragon) {
        console.log(`🔍 塔攻击: ${formatTileName(tower.tile)}, multiTarget=${tower.multiTarget}, 范围内敌人=${enemiesInRange.length}, 实际目标数=${targets.length}`)
      }
      
      // 检查冷却时间
      const cooldown = 1000 / tower.attackSpeed  // ✅ attackSpeed是每秒攻击次数,需要转换为ms
      
      if (now - tower.lastAttackTime >= cooldown) {
        // ✅ 计算实际伤害(应用五行效果)
        let finalDamage = tower.damage
        
        // ✅ 火属性: 伤害再翻倍
        if (tower.tile.element === 'huo') {
          finalDamage *= 2
          console.log('🌟 火属性: 伤害翻倍!')
        }
        
        // ✅ 对所有目标造成伤害
        targets.forEach(target => {
          // 创建子弹(包含所有特效属性)
          const bullet: Bullet = {
            id: `bullet_${Date.now()}_${Math.random()}`,
            position: { ...tower.position },
            targetId: target.id,
            towerId: tower.id,  // ✅ 记录来源塔ID
            damage: finalDamage,  // ✅ 使用计算后的伤害
            damageType: tower.damageType,
            speed: 300,
            splashRadius: tower.splashRadius,
            slowEffect: tower.slowEffect,
            critChance: tower.critChance,
            critMultiplier: tower.critMultiplier,
            poisonDamage: tower.poisonDamage,
            poisonDuration: tower.poisonDuration,
            stunChance: tower.stunChance,
            stunDuration: tower.stunDuration,
            pierce: tower.pierce
          }
          
          gameStateRef.current.bullets.push(bullet)
          
          console.log(`塔攻击: ${formatTileName(tower.tile)}, 目标: ${target.type}, 伤害: ${finalDamage}`)
          
          // ✅ 只有风牌/中发白才可能应用特殊debuff
          if (tower.tile.element || tower.tile.dragon) {
            if (!target.debuffs) target.debuffs = []
            
            // ✅ 金属性: 减甲debuff
            if (tower.tile.element === 'jin' && tower.armorReduction) {
              const existingArmor = target.debuffs.find(d => d.type === 'armor_reduction')
              if (existingArmor) {
                existingArmor.duration = tower.armorReduction.duration
              } else {
                target.debuffs.push({
                  type: 'armor_reduction',
                  value: tower.armorReduction.percent,
                  duration: tower.armorReduction.duration
                })
              }
              console.log('🌟 金属性: 施加30%减甲,持续3秒')
            }
            
            // ✅ 水属性: 减速debuff
            if (tower.tile.element === 'shui' && tower.slowEffect) {
              target.slowTimer = 3000 // 减速3秒
              console.log('🌟 水属性: 施加减速效果')
            }
            
            // ✅ 土属性: 概率眩晕
            if (tower.tile.element === 'tu' && tower.stunChance) {
              if (Math.random() < tower.stunChance) {
                target.isStunned = true
                target.stunEndTime = Date.now() + 1500 // 眩晕1.5秒
                console.log('🌟 土属性: 敌人被眩晕!')
              }
            }
          }
          
          // ✅ 应用特殊效果的debuff(仅风牌/中发白)
          if ((tower.tile.element || tower.tile.dragon) && tower.burnEffect && target) {
            // 添加灼烧debuff
            if (!target.debuffs) target.debuffs = []
            
            const existingBurn = target.debuffs.find(d => d.type === 'burn')
            if (existingBurn) {
              // 刷新持续时间
              existingBurn.duration = tower.burnEffect.duration
            } else {
              // 添加新debuff
              target.debuffs.push({
                type: 'burn',
                value: tower.burnEffect.damagePerSecond,
                duration: tower.burnEffect.duration
              })
            }
          }
          
          if ((tower.tile.element || tower.tile.dragon) && tower.poisonEffect && target) {
            // 添加毒素debuff
            if (!target.debuffs) target.debuffs = []
            
            const existingPoison = target.debuffs.find(d => d.type === 'poison')
            if (existingPoison && existingPoison.stacks! < tower.poisonEffect!.maxStacks) {
              // 叠加层数
              existingPoison.stacks! += 1
              existingPoison.duration = tower.poisonEffect!.duration
            } else if (!existingPoison) {
              // 添加新debuff
              target.debuffs.push({
                type: 'poison',
                value: tower.poisonEffect!.damagePercent,
                duration: tower.poisonEffect!.duration,
                stacks: 1
              })
            }
          }
          
          if ((tower.tile.element || tower.tile.dragon) && tower.armorReduction && target) {
            // 添加减甲debuff
            if (!target.debuffs) target.debuffs = []
            
            const existingArmor = target.debuffs.find(d => d.type === 'armor_reduction')
            if (existingArmor) {
              // 刷新持续时间
              existingArmor.duration = tower.armorReduction.duration
            } else {
              // 添加新debuff
              target.debuffs.push({
                type: 'armor_reduction',
                value: tower.armorReduction.percent,
                duration: tower.armorReduction.duration,
                source: tower.id  // 记录来源,用于globalDebuff
              })
            }
            
            // ✅ 如果是globalDebuff,应用到所有敌人
            if (tower.armorReduction?.globalDebuff) {
              gameStateRef.current.enemies.forEach(otherEnemy => {
                if (otherEnemy.id === target.id) return  // 已经处理过了
                
                if (!otherEnemy.debuffs) otherEnemy.debuffs = []
                
                const existing = otherEnemy.debuffs?.find(d => 
                  d.type === 'armor_reduction' && d.source === tower.id
                )
                
                if (existing) {
                  existing.duration = tower.armorReduction!.duration
                } else {
                  otherEnemy.debuffs!.push({
                    type: 'armor_reduction',
                    value: tower.armorReduction!.percent,
                    duration: tower.armorReduction!.duration,
                    source: tower.id
                  })
                }
              })
            }
          }
        })
        
        tower.lastAttackTime = now
        
        // 🎵 播放攻击音效(暂时使用默认音效)
        soundManager.play('amethyst' as any)
      }
    })
  }, [])
  
  /**
   * 应用伤害到敌人
   * 
   * 伤害计算公式:
   * - 纯粹伤害: 无视护甲
   * - 普通伤害: Math.max(0, damage - enemy.armor)
   * - ✅ 火属性: 伤害再翻倍
   * 
   * 额外效果:
   * - ✅ 金属性: 攻击带减甲30%,持续3秒
   * - ✅ 木属性: 攻击范围翻倍(已在合成时处理)
   * - ✅ 水属性: 增加范围减速效果
   * - ✅ 土属性: 攻击概率眩晕
   * - 溅射:对范围内其他敌人造成50%伤害
   * - 暴击:根据概率造成倍率伤害
   * 
   * @param enemy - 目标敌人
   * @param bullet - 子弹
   */
  const applyDamage = useCallback((enemy: Enemy, bullet: Bullet) => {
    let actualDamage = bullet.damage
    let isCrit = false
    
    // ========== 暴击判定 ==========
    if (bullet.critChance && Math.random() < bullet.critChance) {
      actualDamage *= bullet.critMultiplier || 2.0
      isCrit = true
      console.log('💥 暴击!', actualDamage.toFixed(1))
    }
    
    // ========== 伤害类型计算 ==========
    // ✅ 纯粹伤害无视护甲
    if (bullet.damageType !== 'pure') {
      actualDamage = Math.max(0, bullet.damage - enemy.armor)
    }
    
    // ✅ 火属性: 伤害再翻倍(需要在Tower层面处理,这里暂时跳过)
    
    enemy.health -= actualDamage
    
    // ✅ 累加塔的本波累计伤害
    if (bullet.towerId) {
      const { towers } = gameStateRef.current
      const tower = towers.find(t => t.id === bullet.towerId)
      if (tower) {
        if (tower.damageDealtThisWave === undefined) {
          tower.damageDealtThisWave = 0
        }
        tower.damageDealtThisWave += actualDamage
      }
    }
    
    console.log(`造成伤害: ${actualDamage.toFixed(1)}, 剩余生命: ${enemy.health.toFixed(1)}`)
    
    // ✅ 新增: 创建伤害飘字
    const floatingDamage: FloatingDamage = {
      id: `fd_${Date.now()}_${Math.random()}`,
      x: enemy.position.x,
      y: enemy.position.y - 20,
      startY: enemy.position.y - 20,
      damage: Math.floor(actualDamage),
      isCrit,
      isPure: bullet.damageType === 'pure',
      startTime: Date.now(),
      duration: 500
    }
    gameStateRef.current.floatingDamages.push(floatingDamage)
    
    // ========== 溅射效果 ==========
    if (bullet.splashRadius !== undefined) {
      // ✅ 只有风牌/中发白才有溅射效果
      const sourceTower = bullet.towerId ? gameStateRef.current.towers.find(t => t.id === bullet.towerId) : null
      if (!sourceTower || !(sourceTower.tile.element || sourceTower.tile.dragon)) {
        // 基础牌没有溅射效果，跳过
      } else {
        const splashRadius = bullet.splashRadius
        const { enemies } = gameStateRef.current
        enemies.forEach(otherEnemy => {
          if (otherEnemy.id === enemy.id || otherEnemy.isDead) return
          
          const dx = otherEnemy.position.x - enemy.position.x
          const dy = otherEnemy.position.y - enemy.position.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          if (distance <= splashRadius) {
            const splashDamage = actualDamage * 0.5
            otherEnemy.health -= splashDamage
            
            if (otherEnemy.health <= 0 && !otherEnemy.isDead) {
              otherEnemy.isDead = true
              setUiState(prev => ({ ...prev, gold: prev.gold + otherEnemy.reward }))
            }
          }
        })
      }
    }
    
    // ========== 减速效果 ==========
    if (bullet.slowEffect) {
      // ✅ 只有风牌/中发白才有减速效果
      const sourceTower = bullet.towerId ? gameStateRef.current.towers.find(t => t.id === bullet.towerId) : null
      if (sourceTower && (sourceTower.tile.element || sourceTower.tile.dragon)) {
        enemy.slowTimer = 3000 // 减速3秒
        console.log(`敌人被减速${bullet.slowEffect * 100}%`)
      }
    }
    
    // ========== 毒素效果 ==========
    if (bullet.poisonDamage && bullet.poisonDuration) {
      // ✅ 只有风牌/中发白才有毒索效果
      const sourceTower = bullet.towerId ? gameStateRef.current.towers.find(t => t.id === bullet.towerId) : null
      if (sourceTower && (sourceTower.tile.element || sourceTower.tile.dragon)) {
        if (!enemy.poisonEffects) {
          enemy.poisonEffects = []
        }
        
        enemy.poisonEffects.push({
          damage: bullet.poisonDamage,
          duration: bullet.poisonDuration,
          startTime: Date.now()
        })
        
        console.log(`☠️ 敌人中毒,每秒${bullet.poisonDamage}点伤害`)
      }
    }
    
    // ========== 眩晕效果 ==========
    if (bullet.stunChance && Math.random() < bullet.stunChance) {
      // ✅ 只有风牌/中发白才有眩晕效果
      const sourceTower = bullet.towerId ? gameStateRef.current.towers.find(t => t.id === bullet.towerId) : null
      if (sourceTower && (sourceTower.tile.element || sourceTower.tile.dragon)) {
        enemy.isStunned = true
        enemy.stunEndTime = Date.now() + (bullet.stunDuration || 1000)
        console.log(`💫 敌人被眩晕${bullet.stunDuration || 1000}ms`)
      }
    }
    
    // ========== 检查死亡 ==========
    if (enemy.health <= 0 && !enemy.isDead) {
      enemy.isDead = true
      setUiState(prev => ({ ...prev, gold: prev.gold + enemy.reward }))
      gameStateRef.current.enemies = gameStateRef.current.enemies.filter(
        e => e.id !== enemy.id
      )
      console.log(`敌人死亡,获得金币: ${enemy.reward}`)
    }
  }, [])
  
  /**
   * 更新子弹位置和碰撞检测
   * 
   * 处理:
   * - 子弹向目标移动
   * - 检测是否命中目标
   * - 命中后应用伤害
   * - 清理无效子弹(目标已死亡)
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const updateBullets = useCallback((deltaTime: number) => {
    const { bullets, enemies } = gameStateRef.current
    
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i]
      const target = enemies.find(e => e.id === bullet.targetId)
      
      if (!target) {
        // 目标已死亡,移除子弹
        bullets.splice(i, 1)
        continue
      }
      
      const dx = target.position.x - bullet.position.x
      const dy = target.position.y - bullet.position.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance < 10) {
        // 命中目标
        applyDamage(target, bullet)
        bullets.splice(i, 1)
      } else {
        // 继续移动
        const speed = bullet.speed * (deltaTime / 1000)
        bullet.position.x += (dx / distance) * speed
        bullet.position.y += (dy / distance) * speed
      }
    }
  }, [applyDamage])
  
  /**
   * 主更新函数
   * 
   * 按顺序执行:
   * 1. 生成敌人
   * 2. 更新敌人位置
   * 3. 处理塔攻击
   * 4. 更新子弹
   * 5. 检查波次是否完成
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const update = useCallback((deltaTime: number) => {
    // 在游戏进行中或准备阶段都执行更新(允许在准备阶段看到敌人移动和塔攻击)
    if (uiState.gameStatus !== 'playing' && uiState.gameStatus !== 'preparing') return
    
    spawnEnemies()
    updateEnemies(deltaTime)
    processTowerAttacks()
    updateBullets(deltaTime)
    
    // ✅ 新增: 更新所有飘字的位置和透明度
    const elapsed = Date.now()
    gameStateRef.current.floatingDamages = 
      gameStateRef.current.floatingDamages.filter(fd => {
        const timeElapsed = elapsed - fd.startTime
        if (timeElapsed >= fd.duration) return false
        
        // 向上移动
        fd.y = fd.startY - (timeElapsed / fd.duration) * 60
        
        return true
      })
    
    // 检查波次是否完成
    if (gameStateRef.current.waveInProgress) {
      const allEnemiesDead = gameStateRef.current.enemies.every(e => e.isDead)
      const noMoreSpawns = gameStateRef.current.spawnQueue.length === 0
      
      if (allEnemiesDead && noMoreSpawns) {
        // 波次完成
        gameStateRef.current.waveInProgress = false
        gameStateRef.current.waveCompleted = true
        
        // 解锁放置阶段
        setUiState(prev => ({
          ...prev,
          gameStatus: 'preparing',
          canPlaceTowers: true,
          needsDecision: false,  // ✅ 重置决策标志
          placedCount: 0         // ✅ 重置放置计数器
        }))
        
        console.log(`✅ 第${uiState.wave}波完成! canPlaceTowers=true, gameStatus=preparing`)
      }
    }
  }, [uiState.gameStatus, uiState.wave, spawnEnemies, updateEnemies, processTowerAttacks, updateBullets])
  
  // ==================== Render函数 ====================
  
  /**
   * 渲染函数 - 绘制整个游戏画面
   * 
   * 绘制顺序:
   * 1. 清空画布
   * 2. 绘制网格(地形)
   * 3. 绘制敌人
   * 4. 绘制塔
   * 5. 绘制子弹
   * 6. ✅ 绘制选中塔的攻击范围
   */
  const render = useCallback(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const { grid, enemies, towers, bullets, floatingDamages } = gameStateRef.current
    
    console.log('渲染帧 - 敌人数量:', enemies.length, '塔数量:', towers.length, '子弹数量:', bullets.length) // 调试
    
    // 清空画布(考虑设备像素比)
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    
    // 绘制网格
    drawGrid(ctx, grid)
    
    // 绘制必经点(在所有元素之前)
    drawWaypoints(ctx)
    
    // 绘制敌人 - 确保这里被调用
    enemies.forEach(enemy => {
      if (!enemy.reachedEnd) {
        drawEnemy(ctx, enemy)
      }
    })
    
    // 绘制塔 - 确保这里绘制了所有塔
    towers.forEach(tower => drawTower(ctx, tower))
    
    // 绘制子弹
    bullets.forEach(bullet => drawBullet(ctx, bullet))
    
    // ✅ 新增: 绘制伤害飘字
    floatingDamages.forEach(fd => {
      const elapsed = Date.now() - fd.startTime
      const alpha = Math.max(0, 1 - elapsed / fd.duration)
      
      ctx.save()
      ctx.globalAlpha = alpha
      
      // 设置颜色
      if (fd.isPure) {
        ctx.fillStyle = '#9C27B0' // 紫色
      } else if (fd.isCrit) {
        ctx.fillStyle = '#FFD700' // 金色
      } else {
        ctx.fillStyle = '#FFFFFF' // 白色
      }
      
      // 绘制文字(先描边再填充)
      ctx.font = 'bold 16px Arial'
      ctx.textAlign = 'center'
      ctx.strokeStyle = '#000000'  // 黑色描边
      ctx.lineWidth = 3             // 描边宽度3px
      ctx.strokeText(`-${fd.damage}`, fd.x, fd.y)  // 先绘制描边
      ctx.fillText(`-${fd.damage}`, fd.x, fd.y)    // 再绘制填充
      
      ctx.restore()
    })
    
    // ✅ 如果选中了塔,绘制攻击范围
    if (uiState.selectedTowerId) {
      const selectedTower = towers.find(t => t.id === uiState.selectedTowerId)
      if (selectedTower) {
        ctx.beginPath()
        ctx.arc(
          selectedTower.position.x,
          selectedTower.position.y,
          selectedTower.range,
          0,
          Math.PI * 2
        )
        ctx.fillStyle = 'rgba(255, 215, 0, 0.2)'  // 金色半透明填充
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)'  // 金色边框
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
  }, [uiState.selectedTowerId])
  
  /**
   * 绘制网格(地形)
   * @param ctx - Canvas上下文
   * @param grid - 地图网格
   */
  const drawGrid = (ctx: CanvasRenderingContext2D, grid: GridCell[][]) => {
    const { cellSize } = MAP_CONFIG
    
    grid.forEach(row => {
      row.forEach(cell => {
        const x = cell.col * cellSize
        const y = cell.row * cellSize
        
        // ✅ 特殊处理障碍物:绘制为麻将牌背面
        if (cell.type === 'obstacle') {
          const centerX = x + cellSize / 2
          const centerY = y + cellSize / 2
          
          // 绘制麻将牌背面(棕色/深色矩形)
          ctx.fillStyle = '#8B4513'  // 棕色
          ctx.fillRect(centerX - 18, centerY - 22, 36, 44)
          
          // 绘制边框
          ctx.strokeStyle = '#5D2906'
          ctx.lineWidth = 2
          ctx.strokeRect(centerX - 18, centerY - 22, 36, 44)
          
          // 添加纹理符号表示背面
          ctx.fillStyle = '#A0522D'
          ctx.font = '20px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('🂠', centerX, centerY)  // 扑克牌背面对应符号
          
          return  // 跳过后续的普通填充逻辑
        }
        
        // 根据类型绘制不同颜色
        switch (cell.type) {
          case 'empty':
            ctx.fillStyle = '#F0F0F0'
            break
          case 'start':
            ctx.fillStyle = '#90EE90'
            break
          case 'end':
            ctx.fillStyle = '#FF6B6B'
            break
          case 'mine':
            ctx.fillStyle = '#FFD700'
            break
          default:
            ctx.fillStyle = '#FFFFFF'
        }
        
        ctx.fillRect(x, y, cellSize, cellSize)
        ctx.strokeStyle = '#CCCCCC'
        ctx.strokeRect(x, y, cellSize, cellSize)
      })
    })
  }
  
  /**
   * 绘制必经点标记
   * @param ctx - Canvas上下文
   */
  const drawWaypoints = (ctx: CanvasRenderingContext2D) => {
    const { cellSize } = MAP_CONFIG
    
    console.log(`📍 开始绘制${WAYPOINTS.length}个必经点`)
    
    // 为每个必经点绘制不同颜色的标记
    WAYPOINTS.forEach((waypoint, index) => {
      const x = waypoint.col * cellSize + cellSize / 2
      const y = waypoint.row * cellSize + cellSize / 2
      
      console.log(`  第${index}个: ${waypoint.label} at (${waypoint.row}, ${waypoint.col}) → canvas(${x}, ${y})`)
      
      // 根据类型选择颜色
      let color: string
      let radius: number
      
      if (index === 0) {
        // 起点 - 绿色大圆
        color = '#90EE90'
        radius = 12
      } else if (index === WAYPOINTS.length - 1) {
        // 终点 - 红色大圆
        color = '#FF6B6B'
        radius = 12
      } else if (waypoint.label === '矿坑') {
        // 矿坑 - 黄色中圆
        color = '#FFD700'
        radius = 10
      } else {
        // 转折点 - 蓝色小圆
        color = '#4169E1'
        radius = 8
      }
      
      // 绘制圆形标记
      ctx.fillStyle = color
      ctx.globalAlpha = 0.7  // 半透明
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
      
      // 绘制边框
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 2
      ctx.globalAlpha = 1.0
      ctx.stroke()
      
      // 绘制标签文字(索引数字)
      ctx.fillStyle = '#000000'
      ctx.font = 'bold 10px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${index}`, x, y)
      
      // 如果有label,在下方显示
      if (waypoint.label) {
        ctx.fillStyle = '#333333'
        ctx.font = '9px Arial'
        ctx.fillText(waypoint.label, x, y + radius + 10)
      }
    })
    
    console.log(`✅ 必经点已绘制,共${WAYPOINTS.length}个`)
  }
  
  /**
   * 绘制敌人
   * @param ctx - Canvas上下文
   * @param enemy - 敌人对象
   */
  const drawEnemy = (ctx: CanvasRenderingContext2D, enemy: Enemy) => {
    const config = ENEMY_TYPES[enemy.type]
    
    console.log('绘制敌人:', enemy.type, '位置:', enemy.position.x.toFixed(0), enemy.position.y.toFixed(0))
    
    // 绘制敌人身体
    ctx.fillStyle = config.color
    ctx.beginPath()
    ctx.arc(enemy.position.x, enemy.position.y, config.radius, 0, Math.PI * 2)
    ctx.fill()
    
    // ✅ 新增: 根据debuffs绘制边框
    if (enemy.debuffs && enemy.debuffs.length > 0) {
      let borderColor = ''
      
      // 优先级: 灼烧 > 毒素 > 减速
      if (enemy.debuffs.some(d => d.type === 'burn')) {
        borderColor = '#FF0000' // 红色
      } else if (enemy.debuffs.some(d => d.type === 'poison')) {
        borderColor = '#00FF00' // 绿色
      } else if (enemy.debuffs.some(d => d.type === 'slow')) {
        borderColor = '#2196F3' // 蓝色
      }
      
      if (borderColor) {
        ctx.strokeStyle = borderColor
        ctx.lineWidth = 3
        ctx.stroke()
      }
    } else {
      // 默认边框
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    
    // 绘制血条背景
    const barWidth = 24
    const barHeight = 4
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(
      enemy.position.x - barWidth / 2,
      enemy.position.y - config.radius - 8,
      barWidth,
      barHeight
    )
    
    // 绘制血条前景
    const healthPercent = enemy.health / enemy.maxHealth
    ctx.fillStyle = '#00FF00'
    ctx.fillRect(
      enemy.position.x - barWidth / 2,
      enemy.position.y - config.radius - 8,
      barWidth * healthPercent,
      barHeight
    )
    
    // 绘制中毒效果
    if (enemy.poisonEffects && enemy.poisonEffects.length > 0) {
      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(enemy.position.x, enemy.position.y, config.radius + 3, 0, Math.PI * 2)
      ctx.stroke()
    }
    
    // 绘制眩晕效果
    if (enemy.isStunned) {
      ctx.fillStyle = '#FFFF00'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('💫', enemy.position.x, enemy.position.y - config.radius - 15)
    }
  }
  
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
   * 绘制塔
   * @param ctx - Canvas上下文
   * @param tower - 塔对象
   */
  const drawTower = (ctx: CanvasRenderingContext2D, tower: Tower) => {
    // ✅ 调整为适应CELL_SIZE=40的格子
    const TOWER_WIDTH = 36   // 略小于格子
    const TOWER_HEIGHT = 40  // 等于格子高度
    
    // ✅ 绘制麻将牌底座(白色背景)
    ctx.fillStyle = '#FAFAFA'
    ctx.fillRect(
      tower.position.x - TOWER_WIDTH / 2,
      tower.position.y - TOWER_HEIGHT / 2,
      TOWER_WIDTH,
      TOWER_HEIGHT
    )
    
    // ✅ 边框 - 根据五行属性设置颜色
    ctx.strokeStyle = getElementBorderColor(tower.tile.element)
    ctx.lineWidth = 2
    ctx.strokeRect(
      tower.position.x - TOWER_WIDTH / 2,
      tower.position.y - TOWER_HEIGHT / 2,
      TOWER_WIDTH,
      TOWER_HEIGHT
    )
    
    // ✅ 根据花色设置颜色
    let color: string
    if (tower.tile.suit) {
      const suitColors: Record<string, string> = { 
        wan: '#E53935',   // 万子红色
        tiao: '#43A047',  // 条子绿色
        tong: '#1E88E5'   // 筒子蓝色
      }
      color = suitColors[tower.tile.suit] || '#333'
    } else if (tower.tile.dragon) {
      const dragonColors = { 
        zhong: '#D32F2F',  // 红中
        fa: '#388E3C',     // 发财
        bai: '#FFFFFF'     // 白板
      }
      color = dragonColors[tower.tile.dragon]
    } else if (tower.tile.wind) {
      color = '#7B1FA2'  // 风牌紫色
    } else {
      color = '#333'
    }
    
    // ✅ 缩小Unicode字符以适应格子
    const unicodeChar = getTileUnicode(tower.tile)
    ctx.font = '28px "Segoe UI Emoji", "Apple Color Emoji", Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.fillText(unicodeChar, tower.position.x, tower.position.y)
    
    // ✅ 缩小属性文字
    ctx.font = 'bold 9px Arial'
    ctx.fillStyle = '#666'
    ctx.fillText(`${tower.damage}`, tower.position.x, tower.position.y + 16)
  }
  
  /**
   * 绘制子弹
   * @param ctx - Canvas上下文
   * @param bullet - 子弹对象
   */
  const drawBullet = (ctx: CanvasRenderingContext2D, bullet: Bullet) => {
    // 绘制子弹主体
    ctx.fillStyle = '#FF4500'
    ctx.beginPath()
    ctx.arc(bullet.position.x, bullet.position.y, 4, 0, Math.PI * 2)
    ctx.fill()
    
    // 添加拖尾效果
    ctx.strokeStyle = 'rgba(255, 69, 0, 0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(bullet.position.x, bullet.position.y)
    ctx.lineTo(bullet.position.x - 8, bullet.position.y)
    ctx.stroke()
  }
  
  /**
   * ✅ 新增: 统计场上未合成的刻子数量
   */
  const countUnsynthesizedKezi = useCallback((): number => {
    const towers = gameStateRef.current.towers
    const tileCount = new Map<string, number>()
    
    towers.forEach(tower => {
      if (tower.tile.suit && tower.tile.number) {
        const key = `${tower.tile.suit}-${tower.tile.number}`
        tileCount.set(key, (tileCount.get(key) || 0) + 1)
      }
    })
    
    let keziCount = 0
    tileCount.forEach(count => {
      if (count >= 3) {
        keziCount += Math.floor(count / 3)
      }
    })
    
    return keziCount
  }, [])

  /**
   * ✅ 新增: 统计场上未合成的顺子数量
   */
  const countUnsynthesizedShunzi = useCallback((): number => {
    const towers = gameStateRef.current.towers
    // 实现顺子检测逻辑:同花色连续3个点数
    const suitGroups = new Map<string, Set<number>>()
    
    towers.forEach(tower => {
      if (tower.tile.suit && tower.tile.number) {
        const suit = tower.tile.suit
        if (!suitGroups.has(suit)) {
          suitGroups.set(suit, new Set())
        }
        suitGroups.get(suit)!.add(tower.tile.number)
      }
    })
    
    let shunziCount = 0
    suitGroups.forEach((numbers, suit) => {
      const sortedNumbers = Array.from(numbers).sort((a, b) => a - b)
      
      for (let i = 0; i < sortedNumbers.length - 2; i++) {
        if (
          sortedNumbers[i + 1] === sortedNumbers[i] + 1 &&
          sortedNumbers[i + 2] === sortedNumbers[i] + 2
        ) {
          shunziCount++
          i += 2 // 跳过已使用的数字
        }
      }
    })
    
    return shunziCount
  }, [])

  /**
   * ✅ 新增: 辅助函数 - 从指定的塔列表中查找能组成顺子的塔
   */
  function findShunziTowersFromAll(selectedTower: Tower, allTowers: Tower[]): Tower[] | null {
    const suit = selectedTower.tile.suit
    const number = selectedTower.tile.number
    
    if (!suit || !number) return null
    
    // ✅ 从传入的塔列表中过滤(调用者决定范围)
    const otherTowers = allTowers.filter(t => 
      t.tile.suit === suit && 
      t.tile.number !== undefined &&
      t.id !== selectedTower.id
    )
    
    // 尝试找 number-2, number-1 或 number-1, number+1 或 number+1, number+2
    const possibilities = [
      [number - 2, number - 1],
      [number - 1, number + 1],
      [number + 1, number + 2]
    ]
    
    for (const [n1, n2] of possibilities) {
      if (n1 >= 1 && n1 <= 9 && n2 >= 1 && n2 <= 9) {
        const found1 = otherTowers.find(t => t.tile.number === n1)
        const found2 = otherTowers.find(t => t.tile.number === n2)
        
        if (found1 && found2) {
          return [found1, found2]
        }
      }
    }
    
    return null
  }

  /**
   * ✅ 新增: 获取顺子合成后的风牌配置
   */
  function getWindFromShunzi(clickedTower: Tower, shunziTowers: Tower[]): { tile: MahjongTile; stats: any } {
    const allTowers = [clickedTower, ...shunziTowers]
    const result = MAHJONG_SYNTHESIS.shunzi(allTowers)
    
    return {
      tile: result.tile,
      stats: {
        damage: result.damage,
        attackSpeed: result.attackSpeed,
        range: result.range,
        multiTarget: result.multiTarget,
        damageType: result.damageType,
        armorReduction: result.armorReduction,
        slowEffect: result.slowEffect,
        stunChance: result.stunChance
      }
    }
  }

  /**
   * ✅ 新增: 辅助函数 - 获取牌的中文名称
   */
  function getTileName(tile: MahjongTile): string {
    return formatTileName(tile)
  }

  /**
   * ✅ 新增: 检测指定塔的所有可合成选项
   * 
   * @param selectedTower - 被选中的塔
   * @returns 包含刻子/顺子/杠的检测结果的對象
   */
  const detectSynthesisOptions = useCallback((selectedTower: Tower) => {
    // ✅ 关键修改: 只检测当前批次的塔,不是场上所有塔
    const currentBatchIds = gameStateRef.current.currentBatchTowerIds
    const allTowers = gameStateRef.current.towers.filter(t => 
      currentBatchIds.includes(t.id)  // ✅ 只包含当前批次的塔
    )
    
    console.log(`🔍 检测合成选项: ${getTileName(selectedTower.tile)}, 当前批次共有${allTowers.length}张塔`)
    console.log(`   当前批次IDs:`, currentBatchIds)
    
    // 检测刻子(同花色同点数≥3张,包括被点击的塔)
    const sameTowers = allTowers.filter(t => 
      t.tile.suit === selectedTower.tile.suit &&
      t.tile.number === selectedTower.tile.number
    )
    const canFormKezi = sameTowers.length >= 3
    
    // 检测杠(同花色同点数≥4张,包括被点击的塔)
    const canFormGang = sameTowers.length >= 4
    
    // 检测顺子(同花色连续3点,包括被点击的塔)
    const shunziTowers = findShunziTowersFromAll(selectedTower, allTowers)  // ✅ 传入过滤后的allTowers
    const canFormShunzi = shunziTowers !== null && shunziTowers.length >= 2
    
    console.log(`检测结果: 刻子=${canFormKezi}, 顺子=${canFormShunzi}, 杠=${canFormGang}`)
    
    return {
      canFormKezi,
      canFormShunzi,
      canFormGang,
      shunziTowers: shunziTowers || [],
      sameTowers: sameTowers.filter(t => t.id !== selectedTower.id) // 不包括自己
    }
  }, [])

  /**
   * ✅ 新增: Bingo操作 - 保留被点击的牌,其他变障碍
   * 
   * 核心逻辑:
   * 1. 检测最高优先级合成(杠>刻子>顺子)
   * 2. 将被点击的塔升级为合成后的风牌/中发白
   * 3. 其他参与合成的塔变成障碍物
   * 4. 同批次未参与合成的塔也变成障碍物
   */
  const handleBingoClick = useCallback((clickedTowerId: string) => {
    // 找到被点击的塔
    const clickedTower = gameStateRef.current.towers.find(t => t.id === clickedTowerId)
    if (!clickedTower) {
      console.warn('找不到被点击的塔')
      return
    }
    
    // 检测所有可合成的选项
    const options = detectSynthesisOptions(clickedTower)
    
    // ✅ 优先级: 杠 > 刻子 > 顺子
    let synthesisType: 'gang' | 'kezi' | 'shunzi' | null = null
    let towersToSynthesize: Tower[] = []
    
    if (options.canFormGang) {
      synthesisType = 'gang'
      // 找到3个相同的塔(不包括被点击的那个) - 只从当前批次中找
      const currentBatchIds = gameStateRef.current.currentBatchTowerIds
      const sameTowers = gameStateRef.current.towers.filter(t => 
        currentBatchIds.includes(t.id) &&  // ✅ 只从当前批次中找
        t.tile.suit === clickedTower.tile.suit &&
        t.tile.number === clickedTower.tile.number &&
        t.id !== clickedTowerId
      )
      towersToSynthesize = sameTowers.slice(0, 3)
      
    } else if (options.canFormKezi) {
      synthesisType = 'kezi'
      // 找到2个相同的塔(不包括被点击的那个) - 只从当前批次中找
      const currentBatchIds = gameStateRef.current.currentBatchTowerIds
      const sameTowers = gameStateRef.current.towers.filter(t => 
        currentBatchIds.includes(t.id) &&  // ✅ 只从当前批次中找
        t.tile.suit === clickedTower.tile.suit &&
        t.tile.number === clickedTower.tile.number &&
        t.id !== clickedTowerId
      )
      towersToSynthesize = sameTowers.slice(0, 2)
      
    } else if (options.canFormShunzi && options.shunziTowers) {
      synthesisType = 'shunzi'
      // 使用检测到的顺子塔
      towersToSynthesize = options.shunziTowers.slice(0, 2)
    }
    
    if (!synthesisType) {
      console.log('没有可合成的面子')
      alert('没有可合成的牌!')
      return
    }
    
    console.log(`🎯 Bingo执行${synthesisType}合成`)
    
    // ✅ 执行合成,但保留被点击的塔
    
    // 1. 收集需要删除的塔ID
    const towersToRemove = towersToSynthesize.map(t => t.id)
    
    // 2. 将被点击的塔升级为合成后的风牌/中发白
    let newTile: MahjongTile = clickedTower.tile  // 默认保持原样
    let newStats: any = {}
    
    if (synthesisType === 'kezi') {
      // 刻子 → 风牌
      const config = MAHJONG_SYNTHESIS.kezi(clickedTower.tile.suit as any, clickedTower.tile.number as any)
      newTile = config.tile
      
      // ✅ 新规则: 属性为所有参与塔的总和×倍率
      const allTowers = [clickedTower, ...towersToSynthesize]
      const totalDamage = allTowers.reduce((sum, t) => sum + t.damage, 0)
      const totalAttackSpeed = allTowers.reduce((sum, t) => sum + t.attackSpeed, 0)
      const maxRange = Math.max(...allTowers.map(t => t.range))
      const totalMultiTarget = allTowers.reduce((sum, t) => sum + (t.multiTarget || 1), 0)
      
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
      const allTowers = [clickedTower, ...towersToSynthesize]
      const totalDamage = allTowers.reduce((sum, t) => sum + t.damage, 0)
      const totalAttackSpeed = allTowers.reduce((sum, t) => sum + t.attackSpeed, 0)
      const maxRange = Math.max(...allTowers.map(t => t.range))
      const totalMultiTarget = allTowers.reduce((sum, t) => sum + (t.multiTarget || 1), 0)
      
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
    
    // ✅ 更新clickedTower的属性为新牌面和新属性
    clickedTower.tile = newTile
    Object.assign(clickedTower, newStats)
    
    console.log(`✨ 保留位置上的塔已升级为: ${formatTileName(clickedTower.tile)}`)
    
    // 3. 将同批次其他未参与合成的塔变成障碍物
    const currentBatchIds = gameStateRef.current.currentBatchTowerIds
    const otherTowers = currentBatchIds.filter(id => 
      id !== clickedTowerId && !towersToRemove.includes(id)
    )
    
    // 将这些塔变成障碍物
    otherTowers.forEach(towerId => {
      const tower = gameStateRef.current.towers.find(t => t.id === towerId)
      if (tower) {
        gameStateRef.current.grid[tower.gridPosition.row][tower.gridPosition.col].type = 'obstacle'
        console.log(`🔄 同批次未参与合成的塔变障碍: ${formatTileName(tower.tile)}`)
      }
    })
    
    // 4. 将参与合成但不是被点击的塔变成障碍物并返回牌山
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
    
    // 5. 重置状态
    gameStateRef.current.placedCount = 0
    gameStateRef.current.currentBatchTowerIds = []
    
    const isWaveActive = 
      uiState.gameStatus === 'playing' && 
      gameStateRef.current.waveInProgress
    
    setUiState(prev => ({
      ...prev,
      canPlaceTowers: !isWaveActive,
      placedCount: 0,
      needsDecision: false,
      selectedTowerId: null,
      deckRemaining: gameStateRef.current.mahjongDeck.remaining(),
      currentPhase: gameStateRef.current.mahjongDeck.getPhase()
    }))
    
    console.log(`Bingo完成! gameStatus=${uiState.gameStatus}, waveInProgress=${gameStateRef.current.waveInProgress}, canPlaceTowers=${!isWaveActive}`)
    
    // ✅ 检查胡牌
    checkHuPai()
    
    console.log(`✅ Bingo完成! 保留${formatTileName(clickedTower.tile)},其他牌变障碍`)
  }, [detectSynthesisOptions, uiState.gameStatus, checkHuPai])

  /**
   * ✅ 新增: 获取激活的胡牌组合列表
   */
  const getActiveHuPatterns = useCallback(() => {
    return gameStateRef.current.globalBuffs?.filter(buff => buff.active) || []
  }, [])

  // ==================== 整合游戏循环 ====================
  
  const { start, stop, pause, resume } = useGameLoop(
    update,
    render,
    uiState.gameStatus === 'preparing' || uiState.gameStatus === 'playing'
  )
  
  return {
    uiState,
    setUiState,  // ✅ 新增: 导出setUiState供组件使用
    gameStateRef,
    selectGem,
    placeTower,
    handleTowerClick,  // ✅ 新增: 处理塔点击事件
    handleObstacleClick,  // ✅ 新增: 处理障碍物点击事件
    handleBingoClick,  // ✅ 新增: Bingo操作 - 保留被点击的牌
    finalizeTowers,
    synthesizeTowers,
    performKeziSynthesis,  // ✅ 导出刻子合成函数
    performShunziSynthesis,  // ✅ 导出顺子合成函数
    performGangSynthesis,  // ✅ 导出杠合成函数
    checkDeckStatus,   // ✅ 新增: 检查牌山状态
    detectSynthesisOptions,  // ✅ 新增: 检测合成选项
    checkHuPai,  // ✅ 新增: 导出胡牌检测函数
    getWindFromShunzi,  // ✅ 新增: 导出顺子风牌获取函数
    startWave,
    start,
    stop,
    pause,
    resume,
    // ✅ 新增: 导出统计数据
    keziCount: countUnsynthesizedKezi(),
    shunziCount: countUnsynthesizedShunzi(),
    activeHuPatterns: getActiveHuPatterns(),
    findShunziTowersFromAll,  // ✅ 导出辅助函数
    floatingDamages: gameStateRef.current.floatingDamages  // ✅ 新增: 导出伤害飘字
  }
}
