import React, { useState } from 'react'
import type { Tower } from '../types/game'
import { formatTileName, formatQualityName } from '../config/towers'

interface SynthesisDialogProps {
  storedTowers: Tower[]
  onSynthesize: (selectedIds: string[]) => void
  onClose: () => void
}

export const SynthesisDialog: React.FC<SynthesisDialogProps> = ({
  storedTowers,
  onSynthesize,
  onClose
}) => {
  const [selectedTowerIds, setSelectedTowerIds] = useState<string[]>([])

  // 切换塔的选中状态
  const toggleTowerSelection = (towerId: string) => {
    setSelectedTowerIds(prev => {
      if (prev.includes(towerId)) {
        return prev.filter(id => id !== towerId)
      } else {
        if (prev.length >= 4) {
          alert('最多选择4个塔进行合成!')
          return prev
        }
        return [...prev, towerId]
      }
    })
  }

  // 执行合成
  const handleSynthesize = () => {
    if (selectedTowerIds.length < 2) {
      alert('至少需要选择2个塔才能合成!')
      return
    }
    
    onSynthesize(selectedTowerIds)
    setSelectedTowerIds([])
  }

  // 获取麻将牌面颜色
  const getTileColor = (tower: Tower): string => {
    if (tower.tile.suit) {
      const suitColors = {
        wan: '#E53935',  // 万子 - 红色
        tiao: '#43A047', // 条子 - 绿色
        tong: '#1E88E5'  // 筒子 - 蓝色
      }
      return suitColors[tower.tile.suit]
    }
    if (tower.tile.dragon) {
      const dragonColors = {
        zhong: '#D32F2F', // 红中 - 深红
        fa: '#388E3C',    // 发财 - 深绿
        bai: '#FFFFFF'    // 白板 - 白色
      }
      return dragonColors[tower.tile.dragon]
    }
    if (tower.tile.wind) {
      return '#7B1FA2'  // 风牌 - 紫色
    }
    return '#9E9E9E'
  }

  // 获取品质边框颜色
  const getQualityBorderColor = (quality: string): string => {
    const colors = {
      sheng: '#8BC34A', // 生张 - 浅绿
      shu: '#FF9800',   // 熟张 - 橙色
      lao: '#F44336',   // 老张 - 红色
      jue: '#9C27B0'    // 绝张 - 紫色
    }
    return colors[quality as keyof typeof colors] || '#9E9E9E'
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '700px',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
      }}>
        {/* 标题栏 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '10px',
          borderBottom: '2px solid #EEE'
        }}>
          <h2 style={{ margin: 0, color: '#333' }}>🀄 麻将合成</h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: '#FF5722',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ✕ 关闭
          </button>
        </div>

        {/* 合成规则说明 */}
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          background: '#FFF9C4',
          borderRadius: '4px',
          fontSize: '13px',
          lineHeight: '1.6'
        }}>
          <strong>📖 合成规则:</strong>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li><strong>刻子:</strong> 3张同花色同点数 → 伤害x2.5, 暴击+20%</li>
            <li><strong>顺子:</strong> 同花色连续3点 → 攻速+30%, 穿透+2</li>
            <li><strong>杠:</strong> 4张同花色同点数 → 伤害x4, 范围x1.5</li>
            <li><strong>龙牌催化:</strong> 三元牌增强其他牌效果</li>
            <li><strong>品质升级:</strong> 2张相同牌面 → 提升品质等级</li>
          </ul>
        </div>

        {/* 存储区塔列表 */}
        <div>
          <h3 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '16px' }}>
            🎴 存储区 ({storedTowers.length}个)
          </h3>
          
          {storedTowers.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#999',
              background: '#F5F5F5',
              borderRadius: '4px'
            }}>
              存储区为空,请先保留一些塔
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
              gap: '10px',
              marginBottom: '20px'
            }}>
              {storedTowers.map(tower => {
                const isSelected = selectedTowerIds.includes(tower.id)
                const borderColor = getQualityBorderColor(tower.quality)
                
                return (
                  <div
                    key={tower.id}
                    onClick={() => toggleTowerSelection(tower.id)}
                    style={{
                      padding: '10px',
                      background: isSelected ? '#E3F2FD' : 'white',
                      border: `3px solid ${isSelected ? '#2196F3' : borderColor}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'center'
                    }}
                  >
                    {/* 麻将牌面图标 */}
                    <div style={{
                      width: '50px',
                      height: '60px',
                      margin: '0 auto 8px',
                      background: getTileColor(tower),
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: tower.tile.dragon === 'bai' ? '#333' : 'white',
                      border: '2px solid #333',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                      {tower.tile.suit && tower.tile.number && (
                        <span>{tower.tile.number}</span>
                      )}
                      {tower.tile.dragon === 'zhong' && <span>中</span>}
                      {tower.tile.dragon === 'fa' && <span>发</span>}
                      {tower.tile.dragon === 'bai' && <span>白</span>}
                      {tower.tile.wind === 'dong' && <span>东</span>}
                      {tower.tile.wind === 'nan' && <span>南</span>}
                      {tower.tile.wind === 'xi' && <span>西</span>}
                      {tower.tile.wind === 'bei' && <span>北</span>}
                    </div>
                    
                    {/* 牌面名称 */}
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 'bold',
                      color: '#333',
                      marginBottom: '4px'
                    }}>
                      {formatTileName(tower.tile)}
                    </div>
                    
                    {/* 品质标识 */}
                    <div style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      background: borderColor,
                      color: 'white',
                      borderRadius: '3px',
                      display: 'inline-block'
                    }}>
                      {formatQualityName(tower.quality)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 已选中的塔 */}
        {selectedTowerIds.length > 0 && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            background: '#E8F5E9',
            borderRadius: '4px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2E7D32' }}>
              ✅ 已选择 {selectedTowerIds.length} 个塔
            </h4>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {selectedTowerIds.map(id => {
                const tower = storedTowers.find(t => t.id === id)
                if (!tower) return null
                
                return (
                  <div key={id} style={{
                    padding: '5px 10px',
                    background: 'white',
                    borderRadius: '4px',
                    fontSize: '12px',
                    border: '1px solid #4CAF50'
                  }}>
                    {formatTileName(tower.tile)} ({formatQualityName(tower.quality)})
                  </div>
                )
              })}
            </div>
            
            <button
              onClick={handleSynthesize}
              style={{
                marginTop: '15px',
                padding: '12px 30px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              🀄 确认合成
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
