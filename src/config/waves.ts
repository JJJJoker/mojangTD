import type { WaveConfig } from '../types/game'

export const WAVES: WaveConfig[] = [
  // 第1波: 教学波,5个基础敌人,1个碎裂紫水晶塔(伤害25)能轻松清掉
  {
    waveNumber: 1,
    enemies: [
      { type: 'basic', count: 5, interval: 2000 }
    ]
  },
  // 第2波: 稍微增加数量
  {
    waveNumber: 2,
    enemies: [
      { type: 'basic', count: 8, interval: 1800 }
    ]
  },
  // 第3波: 引入快速敌人
  {
    waveNumber: 3,
    enemies: [
      { type: 'basic', count: 6, interval: 1500 },
      { type: 'fast', count: 3, interval: 1200 }
    ]
  },
  // 第4波: 数量继续增加
  {
    waveNumber: 4,
    enemies: [
      { type: 'basic', count: 10, interval: 1500 },
      { type: 'fast', count: 5, interval: 1000 }
    ]
  },
  // 第5波: 引入坦克敌人
  {
    waveNumber: 5,
    enemies: [
      { type: 'basic', count: 8, interval: 1200 },
      { type: 'fast', count: 6, interval: 800 },
      { type: 'tank', count: 2, interval: 3000 }
    ]
  },
  // 第6波: 逐渐增强
  {
    waveNumber: 6,
    enemies: [
      { type: 'basic', count: 12, interval: 1000 },
      { type: 'fast', count: 8, interval: 700 },
      { type: 'tank', count: 3, interval: 2500 }
    ]
  },
  // 第7波: 更多混合敌人
  {
    waveNumber: 7,
    enemies: [
      { type: 'basic', count: 12, interval: 1000 },
      { type: 'fast', count: 10, interval: 700 },
      { type: 'tank', count: 4, interval: 2200 }
    ]
  },
  // 第8波: 难度提升
  {
    waveNumber: 8,
    enemies: [
      { type: 'basic', count: 15, interval: 900 },
      { type: 'fast', count: 12, interval: 600 },
      { type: 'tank', count: 5, interval: 2000 }
    ]
  },
  // 第9波: 高难度
  {
    waveNumber: 9,
    enemies: [
      { type: 'basic', count: 15, interval: 800 },
      { type: 'fast', count: 15, interval: 600 },
      { type: 'tank', count: 6, interval: 1800 }
    ]
  },
  // 第10波: 接近最终挑战
  {
    waveNumber: 10,
    enemies: [
      { type: 'basic', count: 20, interval: 800 },
      { type: 'fast', count: 15, interval: 600 },
      { type: 'tank', count: 8, interval: 1600 }
    ]
  },
  // 第11波: 极高难度
  {
    waveNumber: 11,
    enemies: [
      { type: 'basic', count: 20, interval: 700 },
      { type: 'fast', count: 18, interval: 500 },
      { type: 'tank', count: 10, interval: 1400 }
    ]
  },
  // 第12波: Boss波 - 最终挑战
  {
    waveNumber: 12,
    enemies: [
      { type: 'basic', count: 25, interval: 600 },
      { type: 'fast', count: 20, interval: 500 },
      { type: 'tank', count: 12, interval: 1200 }
    ],
    isBossWave: true
  }
]
