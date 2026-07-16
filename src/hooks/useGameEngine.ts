import { useState, useRef, useCallback } from 'react'
import { useGameLoop } from './useGameLoop'
import { usePathfinding } from './usePathfinding'
import type { Enemy, Tower, Bullet, GridCell, MahjongTile, TowerQuality } from '../types/game'
import { getTowerStats, randomizeMahjongTile, calculateUpgradeCost, formatTileName, formatQualityName } from '../config/towers'
import { ENEMY_TYPES, createEnemy } from '../config/enemies'
import { WAVES } from '../config/waves'
import { MAP_CONFIG, initializeGrid, gridToPixel, WAYPOINTS } from '../config/map'
import { soundManager } from '../utils/audio'

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
    wood: 5,              // 木材(每波固定5个)
    gold: 50,             // 金币
    mineHealth: 15,       // 矿坑生命
    maxMineHealth: 15,    // 最大矿坑生命
    wave: 0,              // 当前波次
    gameStatus: 'preparing' as 'preparing' | 'playing' | 'paused' | 'game_over' | 'victory',
    selectedGem: null as MahjongTile | null,  // ✅ 当前选中的麻将牌面
    availableGems: [] as MahjongTile[],  // ✅ 当前波可用的随机麻将牌
    canPlaceTowers: true as boolean,  // 是否可以放置塔
    gameLevel: 1  // ✅ 新增: 初始游戏等级为1
  })
  
  // ==================== 游戏对象状态(不触发重渲染,高频更新) ====================
  const gameStateRef = useRef({
    enemies: [] as Enemy[],
    towers: [] as Tower[],
    bullets: [] as Bullet[],
    grid: initializeGrid(),
    storedTowers: [] as Tower[],  // 存储的塔(跨波次保留)
    currentPath: null as { row: number; col: number }[] | null,
    waveInProgress: false,
    waveCompleted: false,  // 当前波次是否完成
    spawnQueue: [] as Array<{ type: 'basic' | 'fast' | 'tank'; delay: number }>,
    waveStartTime: 0 as number,  // 波次开始时间
    currentBatchTowerIds: [] as string[],  // 当前批次放置的塔ID列表
    currentHealthMultiplier: 1.0 as number  // 当前波次的血量倍率
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
   * 放置塔到指定位置(随机生成麻将牌面)
   * 
   * 原版宝石TD玩法:
   * 1. 点击地图格子,随机生成1个麻将牌面塔
   * 2. 每次消耗1木材
   * 3. 共放置5次后进入决策阶段
   * 
   * @param gridPos - 格子坐标 {row, col}
   * @returns 新创建的塔,如果放置失败则返回undefined
   */
  const placeTower = useCallback((gridPos: { row: number; col: number }) => {
    if (!uiState.canPlaceTowers) {
      console.warn('当前不能放置塔')
      return null
    }
    
    if (uiState.wood <= 0) {
      alert('木材已用完!')
      return null
    }
    
    const { grid } = gameStateRef.current
    
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
    
    // ✅ 新增: 随机生成麻将牌面
    const randomTile = randomizeMahjongTile(uiState.gameLevel)
    
    // ✅ 新增: 随机生成品质(根据gameLevel)
    const qualityProbs = getTowerQualityProbabilities(uiState.gameLevel)
    const randomQuality = randomizeTowerQuality(qualityProbs)
    
    // 获取塔的统计数据
    const stats = getTowerStats(randomTile, randomQuality)
    
    // 创建新塔
    const newTower: Tower = {
      id: `tower_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tile: randomTile,              // ✅ 改为tile
      quality: randomQuality,        // ✅ 改为quality
      position: gridToPixel(gridPos.row, gridPos.col),
      gridPosition: gridPos,
      damage: stats.damage || 10,
      range: stats.range || 100,
      attackSpeed: stats.attackSpeed || 1.0,
      damageType: stats.damageType || 'physical',
      multiTarget: stats.multiTarget,
      splashRadius: stats.splashRadius,
      slowEffect: stats.slowEffect,
      critChance: stats.critChance,
      critMultiplier: stats.critMultiplier,
      pierce: stats.pierce,
      poisonDamage: stats.poisonDamage,
      poisonDuration: stats.poisonDuration,
      stunChance: stats.stunChance,
      stunDuration: stats.stunDuration,
      lastAttackTime: 0
    }
    
    // 扣除木材
    setUiState(prev => ({ ...prev, wood: prev.wood - 1 }))
    
    // 添加到地图(标记为临时塔)
    gameStateRef.current.towers.push(newTower)
    
    // ✅ 添加到当前批次列表
    gameStateRef.current.currentBatchTowerIds.push(newTower.id)
    console.log(`✅ 放置${formatTileName(randomTile)}(${formatQualityName(randomQuality)})在(${gridPos.row},${gridPos.col}),剩余木材:${uiState.wood - 1}`)
    
    // ✅ 修改: 更新格子类型为tower(无论是从empty还是obstacle)
    grid[gridPos.row][gridPos.col] = {
      ...grid[gridPos.row][gridPos.col],
      type: 'tower',
      towerId: newTower.id
    }
    
    // 重新计算路径
    const newPath = calculatePath(grid)
    gameStateRef.current.currentPath = newPath
    
    return newTower
  }, [uiState.wood, validatePlacement, calculatePath, uiState.gameLevel])
  
  // 辅助函数: 获取品质概率
  function getTowerQualityProbabilities(gameLevel: number) {
    // Level 1-5: 生张70%, 熟张25%, 老张5%, 绝张0%
    // Level 6-10: 生张60%, 熟张30%, 老张10%, 绝张0%
    // Level 11-15: 生张50%, 熟张35%, 老张15%, 绝张0%
    // Level 16-20: 生张40%, 熟张40%, 老张20%, 绝张0%
    // Level 21+: 生张30%, 熟张45%, 老张25%, 绝张0%
    
    if (gameLevel <= 5) {
      return { sheng: 0.70, shu: 0.25, lao: 0.05, jue: 0.00 }
    } else if (gameLevel <= 10) {
      return { sheng: 0.60, shu: 0.30, lao: 0.10, jue: 0.00 }
    } else if (gameLevel <= 15) {
      return { sheng: 0.50, shu: 0.35, lao: 0.15, jue: 0.00 }
    } else if (gameLevel <= 20) {
      return { sheng: 0.40, shu: 0.40, lao: 0.20, jue: 0.00 }
    } else {
      return { sheng: 0.30, shu: 0.45, lao: 0.25, jue: 0.00 }
    }
  }
  
  // 辅助函数: 随机选择品质
  function randomizeTowerQuality(probs: { sheng: number; shu: number; lao: number; jue: number }): TowerQuality {
    const rand = Math.random()
    if (rand < probs.sheng) return 'sheng'
    if (rand < probs.sheng + probs.shu) return 'shu'
    if (rand < probs.sheng + probs.shu + probs.lao) return 'lao'
    return 'jue'
  }
  
  /**
   * 批量决定5个塔的处理方式
   * 
   * 原版宝石TD核心玩法:
   * - 选择1个塔保留到存储区
   * - 其余4个塔变成障碍物(永久阻挡路径)
   * 
   * @param keepTowerId - 要保留的塔ID
   */
  const finalizeTowers = useCallback((keepTowerId: string) => {
    const { towers, storedTowers, grid, currentBatchTowerIds } = gameStateRef.current
    
    console.log('开始处理塔的决策,保留:', keepTowerId)
    console.log('当前批次塔IDs:', currentBatchTowerIds)
    
    // ✅ 只处理当前批次的塔
    currentBatchTowerIds.forEach(towerId => {
      const tower = towers.find(t => t.id === towerId)
      if (!tower) {
        console.warn('找不到塔:', towerId)
        return
      }
      
      if (tower.id === keepTowerId) {
        // ✅ 保留这个塔: 留在地图上,同时添加到存储区
        console.log(`保留塔: ${formatTileName(tower.tile)}(${formatQualityName(tower.quality)}) 在位置 (${tower.gridPosition.row}, ${tower.gridPosition.col})`)
        
        // 创建副本添加到存储区(用于合成)
        const towerCopy = { ...tower }
        storedTowers.push(towerCopy)
        
        // ⚠️ 关键: 不从towers数组移除,格子保持tower类型
        // 这样塔会继续显示在地图上并攻击敌人
        
      } else {
        // 其他塔变成障碍物
        console.log(`塔变为障碍: ${formatTileName(tower.tile)}(${formatQualityName(tower.quality)}) 在位置 (${tower.gridPosition.row}, ${tower.gridPosition.col})`)
        
        const index = towers.findIndex(t => t.id === tower.id)
        if (index !== -1) {
          towers.splice(index, 1)
        }
        
        const { gridPosition } = tower
        grid[gridPosition.row][gridPosition.col] = {
          ...grid[gridPosition.row][gridPosition.col],
          type: 'obstacle'  // 变成永久障碍物
        }
      }
    })
    
    // 清空当前批次列表
    gameStateRef.current.currentBatchTowerIds = []
    
    // 重新计算路径(因为障碍物变化了)
    const newPath = calculatePath(grid)
    gameStateRef.current.currentPath = newPath
    
    console.log('最终塔数量:', towers.length, '存储区数量:', storedTowers.length)
  }, [calculatePath])
  
  /**
   * 合成麻将牌面子(刻子/顺子/杠)
   * 
   * 合成规则:
   * - 刻子: 3张同花色同点数 → 单点爆发强化
   * - 顺子: 同花色连续3点 → 链式/多目标
   * - 杠: 4张同花色同点数 → 最强基础形态
   * - 龙牌催化: 三元牌作为催化剂增强其他牌
   * - 风牌终极: 四张风牌组合成终极塔
   * 
   * @param selectedIds - 选中的塔ID列表
   */
  const synthesizeTowers = useCallback((selectedIds: string[]) => {
    const { towers, storedTowers, grid } = gameStateRef.current
    
    if (selectedIds.length < 2) {
      alert('至少需要选择2座塔才能合成!')
      return
    }
    
    // 获取选中的塔
    const selectedTowers = selectedIds.map(id => 
      towers.find(t => t.id === id) || storedTowers.find(t => t.id === id)
    ).filter(Boolean) as Tower[]
    
    if (selectedTowers.length < 2) {
      alert('找不到选中的塔!')
      return
    }
    
    // 检测是否构成面子
    const tiles = selectedTowers.map(t => t.tile)
    
    // 检测刻子(3张同花色同点数)
    if (selectedTowers.length === 3 && isKezi(tiles)) {
      return synthesizeKezi(selectedTowers, grid, towers, storedTowers)
    }
    
    // 检测顺子(同花色连续3点)
    if (selectedTowers.length === 3 && isShunzi(tiles)) {
      return synthesizeShunzi(selectedTowers, grid, towers, storedTowers)
    }
    
    // 检测杠(4张同花色同点数)
    if (selectedTowers.length === 4 && isGang(tiles)) {
      return synthesizeGang(selectedTowers, grid, towers, storedTowers)
    }
    
    // 检测龙牌催化
    if (hasDragonCatalyst(tiles)) {
      return catalyzeWithDragon(selectedTowers, grid, towers, storedTowers)
    }
    
    // 默认: 两座相同牌面升级品质
    if (selectedTowers.length === 2 && canUpgradeQuality(selectedTowers)) {
      return upgradeTowerQuality(selectedTowers, grid, towers, storedTowers)
    }
    
    alert('无法合成!请检查选择的塔是否符合合成规则。')
  }, [])
  
  // 辅助函数: 检测刻子
  function isKezi(tiles: MahjongTile[]): boolean {
    if (tiles.length !== 3) return false
    const first = tiles[0]
    if (!first.suit || !first.number) return false
    return tiles.every(t => t.suit === first.suit && t.number === first.number)
  }
  
  // 辅助函数: 检测顺子
  function isShunzi(tiles: MahjongTile[]): boolean {
    if (tiles.length !== 3) return false
    const numbers = tiles.map(t => t.number).filter(Boolean).sort((a, b) => a! - b!)
    if (numbers.length !== 3) return false
    const suit = tiles[0].suit
    if (!suit) return false
    return tiles.every(t => t.suit === suit) && 
           numbers[1] === numbers[0]! + 1 && 
           numbers[2] === numbers[1]! + 1
  }
  
  // 辅助函数: 检测杠
  function isGang(tiles: MahjongTile[]): boolean {
    if (tiles.length !== 4) return false
    const first = tiles[0]
    if (!first.suit || !first.number) return false
    return tiles.every(t => t.suit === first.suit && t.number === first.number)
  }
  
  // 辅助函数: 检测龙牌催化
  function hasDragonCatalyst(tiles: MahjongTile[]): boolean {
    return tiles.some(t => t.dragon)
  }
  
  // 辅助函数: 检测能否升级品质
  function canUpgradeQuality(towers: Tower[]): boolean {
    if (towers.length !== 2) return false
    const [t1, t2] = towers
    return t1.tile.suit === t2.tile.suit && 
           t1.tile.number === t2.tile.number &&
           t1.quality === t2.quality &&
           t1.quality !== 'jue'  // 绝张不可再升
  }
  
  // 合成刻子
  function synthesizeKezi(selectedTowers: Tower[], grid: GridCell[][], towers: Tower[], storedTowers: Tower[]) {
    const tile = selectedTowers[0].tile
    const quality = selectedTowers[0].quality
    
    console.log(`🀄 合成刻子: ${formatTileName(tile)} x3`)
    
    // 创建强化塔(伤害x2.5, 暴击+20%, 暴击倍率+0.5)
    const baseStats = getTowerStats(tile, quality)
    const upgradedTower: Tower = {
      ...selectedTowers[0],
      damage: Math.floor(baseStats.damage! * 2.5),
      critChance: (baseStats.critChance || 0) + 0.2,
      critMultiplier: (baseStats.critMultiplier || 2.0) + 0.5
    }
    
    completeSynthesis(selectedTowers, upgradedTower, grid, towers, storedTowers)
  }
  
  // 合成顺子
  function synthesizeShunzi(selectedTowers: Tower[], grid: GridCell[][], towers: Tower[], storedTowers: Tower[]) {
    const tile = selectedTowers[0].tile
    const quality = selectedTowers[0].quality
    
    console.log(`🀄 合成顺子: ${formatTileName(tile)}-${tile.number! + 1}-${tile.number! + 2}`)
    
    // 创建多目标塔(攻击速度+30%, 穿透+2)
    const baseStats = getTowerStats(tile, quality)
    const upgradedTower: Tower = {
      ...selectedTowers[0],
      attackSpeed: baseStats.attackSpeed! * 1.3,
      pierce: (baseStats.pierce || 0) + 2,
      multiTarget: true
    }
    
    completeSynthesis(selectedTowers, upgradedTower, grid, towers, storedTowers)
  }
  
  // 合成杠
  function synthesizeGang(selectedTowers: Tower[], grid: GridCell[][], towers: Tower[], storedTowers: Tower[]) {
    const tile = selectedTowers[0].tile
    const quality = selectedTowers[0].quality
    
    console.log(`🀄 合成杠: ${formatTileName(tile)} x4 (最强形态)`)
    
    // 创建最强塔(伤害x4, 范围x1.5, 暴击+30%, 穿透+3)
    const baseStats = getTowerStats(tile, quality)
    const upgradedTower: Tower = {
      ...selectedTowers[0],
      damage: Math.floor(baseStats.damage! * 4.0),
      range: Math.floor(baseStats.range! * 1.5),
      critChance: (baseStats.critChance || 0) + 0.3,
      pierce: (baseStats.pierce || 0) + 3
    }
    
    completeSynthesis(selectedTowers, upgradedTower, grid, towers, storedTowers)
  }
  
  // 龙牌催化
  function catalyzeWithDragon(selectedTowers: Tower[], grid: GridCell[][], towers: Tower[], storedTowers: Tower[]) {
    // 找到龙牌和其他牌
    const dragonTower = selectedTowers.find(t => t.tile.dragon)
    const otherTowers = selectedTowers.filter(t => !t.tile.dragon)
    
    if (!dragonTower || otherTowers.length === 0) {
      alert('龙牌催化需要至少一张数牌!')
      return
    }
    
    const dragon = dragonTower.tile.dragon!
    console.log(`🐉 龙牌催化: ${formatTileName(dragonTower.tile)} 催化 ${otherTowers.length} 张牌`)
    
    // 根据龙牌类型应用不同效果
    let enhancedTower: Tower
    
    if (dragon === 'zhong') {
      // 红中: 进攻催化(伤害x1.5, 暴击+15%, 毒素)
      const base = otherTowers[0]
      const stats = getTowerStats(base.tile, base.quality)
      enhancedTower = {
        ...base,
        damage: Math.floor(stats.damage! * 1.5),
        critChance: (stats.critChance || 0) + 0.15,
        poisonDamage: 5,
        poisonDuration: 3000
      }
    } else if (dragon === 'fa') {
      // 发财: 经济催化(只保留一个塔,其他变障碍,获得金币)
      setUiState(prev => ({ ...prev, gold: prev.gold + 50 }))
      console.log('💰 发财催化: 获得50金币')
      completeSynthesis(otherTowers.slice(0, 1), otherTowers[0], grid, towers, storedTowers)
      return
    } else {
      // 白板: 辅助催化(范围x1.3, 减速+20%, 眩晕+10%)
      const base = otherTowers[0]
      const stats = getTowerStats(base.tile, base.quality)
      enhancedTower = {
        ...base,
        range: Math.floor(stats.range! * 1.3),
        slowEffect: (stats.slowEffect || 0) + 0.2,
        stunChance: (stats.stunChance || 0) + 0.1
      }
    }
    
    completeSynthesis([dragonTower, ...otherTowers], enhancedTower, grid, towers, storedTowers)
  }
  
  // 升级品质
  function upgradeTowerQuality(selectedTowers: Tower[], grid: GridCell[][], towers: Tower[], storedTowers: Tower[]) {
    const [t1] = selectedTowers
    const qualities: TowerQuality[] = ['sheng', 'shu', 'lao', 'jue']
    const currentIndex = qualities.indexOf(t1.quality)
    
    if (currentIndex >= qualities.length - 1) {
      alert('已经是最高品质了!')
      return
    }
    
    const newQuality = qualities[currentIndex + 1]
    console.log(`⬆️ 品质升级: ${formatQualityName(t1.quality)} → ${formatQualityName(newQuality)}`)
    
    const stats = getTowerStats(t1.tile, newQuality)
    const upgradedTower: Tower = {
      ...t1,
      quality: newQuality,
      damage: stats.damage || t1.damage,
      range: stats.range || t1.range,
      attackSpeed: stats.attackSpeed || t1.attackSpeed
    }
    
    completeSynthesis(selectedTowers, upgradedTower, grid, towers, storedTowers)
  }
  
  // 完成合成的通用逻辑
  function completeSynthesis(materials: Tower[], result: Tower, grid: GridCell[][], towers: Tower[], storedTowers: Tower[]) {
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
    
    // 从存储区移除所有材料塔
    for (const tower of materials) {
      const index = storedTowers.findIndex(t => t.id === tower.id)
      if (index !== -1) {
        storedTowers.splice(index, 1)
      }
    }
    
    // 将新塔添加到存储区
    storedTowers.push(result)
    console.log(`✅ 合成成功! 结果: ${formatTileName(result.tile)}(${formatQualityName(result.quality)})`)
    
    // 重新计算路径
    const newPath = calculatePath(grid)
    gameStateRef.current.currentPath = newPath
  }
  

  
  /**
   * ✅ 新增: 升级游戏等级
   * 
   * 游戏等级影响塔生成概率:
   * - 等级越高,高等级塔出现概率越大
   * - 升级需要消耗金币,费用指数增长
   */
  const upgradeGameLevel = useCallback(() => {
    const upgradeCost = calculateUpgradeCost(uiState.gameLevel)
    
    if (uiState.gold < upgradeCost) {
      alert(`金币不足!需要${upgradeCost}金币才能升级到Lv.${uiState.gameLevel + 1}`)
      return
    }
    
    const oldLevel = uiState.gameLevel
    const newLevel = oldLevel + 1
    
    setUiState(prev => ({
      ...prev,
      gold: prev.gold - upgradeCost,
      gameLevel: newLevel
    }))
    
    console.log(`🎉 游戏等级提升: Lv.${oldLevel} → Lv.${newLevel}`)
    console.log(`  消耗金币: ${upgradeCost}`)
    console.log(`  新的塔品质概率:`)
    const probs = getTowerQualityProbabilities(newLevel)
    console.log(`    生张(sheng): ${(probs.sheng * 100).toFixed(0)}%`)
    console.log(`    熟张(shu): ${(probs.shu * 100).toFixed(0)}%`)
    console.log(`    老张(lao): ${(probs.lao * 100).toFixed(0)}%`)
    console.log(`    绝张(jue): ${(probs.jue * 100).toFixed(0)}%`)
    
    alert(`成功升级到Lv.${newLevel}!\n高等级塔的出现概率提升了!`)
  }, [uiState.gold, uiState.gameLevel])
  
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
    const healthMultiplier = waveConfig.healthMultiplier || 1.0
    
    console.log(`🌊 开始第${wave + 1}波`)
    console.log(`  血量倍率: ${healthMultiplier}x`)
    
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
    
    // ✅ 重置当前批次列表
    gameStateRef.current.currentBatchTowerIds = []
    console.log('波次开始,重置当前批次塔列表')
    
    // 锁定放置阶段,波次中不能放置塔
    setUiState(prev => ({
      ...prev,
      wood: 0,  // 波次中木材为0
      wave: prev.wave + 1,
      gameStatus: 'playing',
      canPlaceTowers: false,
      availableGems: [],
      selectedGem: null
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
   * - 🎵 播放攻击音效
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const processTowerAttacks = useCallback(() => {
    const { towers, enemies } = gameStateRef.current
    const now = Date.now()
    
    towers.forEach(tower => {
      // 查找范围内的敌人
      const enemiesInRange = enemies.filter(enemy => {
        const dx = enemy.position.x - tower.position.x
        const dy = enemy.position.y - tower.position.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        return distance <= tower.range
      })
      
      if (enemiesInRange.length === 0) return
      
      // 选择最近的敌人
      const target = enemiesInRange.reduce((closest, enemy) => {
        const distToTower = Math.sqrt(
          Math.pow(enemy.position.x - tower.position.x, 2) +
          Math.pow(enemy.position.y - tower.position.y, 2)
        )
        const distToClosest = Math.sqrt(
          Math.pow(closest.position.x - tower.position.x, 2) +
          Math.pow(closest.position.y - tower.position.y, 2)
        )
        return distToTower < distToClosest ? enemy : closest
      })
      
      // 检查冷却时间
      if (now - tower.lastAttackTime >= tower.attackSpeed) {
        // 创建子弹(包含所有特效属性)
        const bullet: Bullet = {
          id: `bullet_${Date.now()}_${Math.random()}`,
          position: { ...tower.position },
          targetId: target.id,
          damage: tower.damage,
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
        tower.lastAttackTime = now
        
        console.log(`塔攻击: ${formatTileName(tower.tile)}(${formatQualityName(tower.quality)}), 目标: ${target.type}, 伤害: ${tower.damage}`)
        
        // 🎵 播放攻击音效(暂时使用默认音效)
        soundManager.play('amethyst' as any)
      }
    })
  }, [])
  
  /**
   * 应用伤害到敌人
   * 
   * 伤害计算公式:
   * - 物理伤害: damage * (1 - armor / (armor + 10))
   * - 魔法伤害: damage * (1 - magicResist)
   * - 纯粹伤害: 无视减免
   * 
   * 额外效果:
   * - 溅射:对范围内其他敌人造成50%伤害
   * - 减速:施加3秒减速效果
   * - 暴击:根据概率造成倍率伤害
   * - 毒素:持续造成伤害
   * - 眩晕:随机概率使敌人停止移动
   * 
   * @param enemy - 目标敌人
   * @param bullet - 子弹
   */
  const applyDamage = useCallback((enemy: Enemy, bullet: Bullet) => {
    let actualDamage = bullet.damage
    
    // ========== 暴击判定 ==========
    if (bullet.critChance && Math.random() < bullet.critChance) {
      actualDamage *= bullet.critMultiplier || 2.0
      console.log('💥 暴击!', actualDamage.toFixed(1))
    }
    
    // ========== 伤害类型计算 ==========
    if (bullet.damageType === 'physical') {
      actualDamage = bullet.damage * (1 - enemy.armor / (enemy.armor + 10))
    } else if (bullet.damageType === 'magic') {
      actualDamage = bullet.damage * (1 - enemy.magicResist)
    }
    // 纯粹伤害无视减免
    
    enemy.health -= actualDamage
    
    console.log(`造成伤害: ${actualDamage.toFixed(1)}, 剩余生命: ${enemy.health.toFixed(1)}`)
    
    // ========== 溅射效果 ==========
    if (bullet.splashRadius !== undefined) {
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
    
    // ========== 减速效果 ==========
    if (bullet.slowEffect) {
      enemy.slowTimer = 3000 // 减速3秒
      console.log(`敌人被减速${bullet.slowEffect * 100}%`)
    }
    
    // ========== 毒素效果 ==========
    if (bullet.poisonDamage && bullet.poisonDuration) {
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
    
    // ========== 眩晕效果 ==========
    if (bullet.stunChance && Math.random() < bullet.stunChance) {
      enemy.isStunned = true
      enemy.stunEndTime = Date.now() + (bullet.stunDuration || 1000)
      console.log(`💫 敌人被眩晕${bullet.stunDuration || 1000}ms`)
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
          wood: 5,  // 重置木材
          gameStatus: 'preparing',
          canPlaceTowers: true
        }))
        
        console.log(`第${uiState.wave}波完成!`)
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
   */
  const render = useCallback(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const { grid, enemies, towers, bullets } = gameStateRef.current
    
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
  }, [])
  
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
        
        // 根据类型绘制不同颜色
        switch (cell.type) {
          case 'empty':
            ctx.fillStyle = '#F0F0F0'
            break
          case 'obstacle':
            ctx.fillStyle = '#8B4513'
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
    
    // 绘制边框
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.stroke()
    
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
   * 绘制塔
   * @param ctx - Canvas上下文
   * @param tower - 塔对象
   */
  const drawTower = (ctx: CanvasRenderingContext2D, tower: Tower) => {
    // 确定颜色(根据花色)
    let color: string
    if (tower.tile.suit) {
      const suitColors = { wan: '#E53935', tiao: '#43A047', tong: '#1E88E5' }
      color = suitColors[tower.tile.suit]
    } else if (tower.tile.dragon) {
      const dragonColors = { zhong: '#D32F2F', fa: '#388E3C', bai: '#FFFFFF' }
      color = dragonColors[tower.tile.dragon]
    } else if (tower.tile.wind) {
      color = '#7B1FA2'
    } else {
      color = '#CCCCCC'
    }
    
    // 绘制塔底座
    ctx.fillStyle = color
    ctx.fillRect(
      tower.position.x - 18,
      tower.position.y - 18,
      36,
      36
    )
    
    // 绘制边框
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.strokeRect(
      tower.position.x - 18,
      tower.position.y - 18,
      36,
      36
    )
    
    // 绘制麻将牌面标识
    ctx.fillStyle = 'white'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    let label = ''
    if (tower.tile.suit && tower.tile.number) {
      const suitNames = { wan: '万', tiao: '条', tong: '筒' }
      label = `${tower.tile.number}${suitNames[tower.tile.suit]}`
    } else if (tower.tile.dragon) {
      const dragonNames = { zhong: '中', fa: '发', bai: '白' }
      label = dragonNames[tower.tile.dragon]
    } else if (tower.tile.wind) {
      const windNames = { dong: '东', nan: '南', xi: '西', bei: '北' }
      label = windNames[tower.tile.wind]
    }
    
    ctx.fillText(label, tower.position.x, tower.position.y)
    
    // 绘制品质标识(小字在下方)
    const qualityLabels = { sheng: '生', shu: '熟', lao: '老', jue: '绝' }
    ctx.font = '8px Arial'
    ctx.fillText(qualityLabels[tower.quality], tower.position.x, tower.position.y + 10)
    
    // 绘制溅射范围(仅当选中时)
    // 这里可以后续添加交互逻辑
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
  
  // ==================== 整合游戏循环 ====================
  
  const { start, stop, pause, resume } = useGameLoop(
    update,
    render,
    uiState.gameStatus === 'preparing' || uiState.gameStatus === 'playing'
  )
  
  return {
    uiState,
    gameStateRef,
    selectGem,
    placeTower,
    finalizeTowers,
    synthesizeTowers,
    upgradeGameLevel,  // ✅ 新增: 升级游戏等级
    startWave,
    start,
    stop,
    pause,
    resume
  }
}
