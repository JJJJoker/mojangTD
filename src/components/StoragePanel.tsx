import React from 'react'
import type { Tower } from '../types/game'
import { formatTileName } from '../config/towers'

interface StoragePanelProps {
  storedTowers: Tower[]
}

/**
 * 存储区面板 - 显示已保留的塔
 * 注意: 合成操作现在通过SynthesisDialog进行
 */
export const StoragePanel: React.FC<StoragePanelProps> = ({
  storedTowers
}) => {
  // 获取麻将牌面颜色
  const getTileColor = (tower: Tower): string => {
    if (tower.tile.suit) {
      const suitColors: Record<string, string> = {
        wan: '#E53935',  // 万子 - 红色
        tiao: '#43A047', // 条子 - 绿色
        tong: '#1E88E5'  // 筒子 - 蓝色
      }
      return suitColors[tower.tile.suit] || '#333'
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

  // ❌ 删除品质边框颜色函数(已移除品质系统)

  return (
    <div style={{
      width: '250px',
      padding: '15px',
      background: '#F5F5F5',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      maxHeight: '400px',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 15px 0', textAlign: 'center', color: '#333' }}>
        🎴 存储区 ({storedTowers.length})
      </h3>
      
      {storedTowers.length === 0 ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#999',
          fontSize: '12px'
        }}>
          暂无存储的塔<br/>
          放置5个塔后选择保留
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {storedTowers.map(tower => (
            <div
              key={tower.id}
              style={{
                padding: '10px',
                background: 'white',
                border: `2px solid ${getTileColor(tower)}`,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              {/* 麻将牌面图标 */}
              <div style={{
                width: '40px',
                height: '50px',
                background: getTileColor(tower),
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold',
                color: tower.tile.dragon === 'bai' ? '#333' : 'white',
                border: '1px solid #333',
                flexShrink: 0
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
              
              {/* 信息 */}
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '13px', 
                  fontWeight: 'bold',
                  color: '#333',
                  marginBottom: '4px'
                }}>
                  {formatTileName(tower.tile)}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: '#666'
                }}>
                  伤害: {tower.damage} | 范围: {tower.range}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div style={{
        marginTop: '15px',
        padding: '10px',
        background: '#FFF9C4',
        borderRadius: '4px',
        fontSize: '11px',
        color: '#666',
        lineHeight: '1.4'
      }}>
        💡 点击"合成"按钮打开高级合成界面
      </div>
    </div>
  )
}
