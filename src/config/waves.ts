import type { WaveConfig } from '../types/game'

/**
 * 波次配置
 * 每波敌人数量、类型和血量倍率
 */
export const WAVES: WaveConfig[] = [
  // ========== 第1阶段: 新手教学 (波次1-3) ==========
  { 
    waveNumber: 1, 
    enemies: [{ type: 'basic', count: 8, interval: 1200 }],  // 5→8, 间隔缩短
    healthMultiplier: 1.2  // 120%血量 - 基础倍率提升
  },
  { 
    waveNumber: 2, 
    enemies: [{ type: 'basic', count: 12, interval: 1000 }],  // 8→12, 间隔缩短
    healthMultiplier: 1.6  // 160%血量
  },
  { 
    waveNumber: 3, 
    enemies: [
      { type: 'basic', count: 10, interval: 900 },  // 6→10, 间隔缩短
      { type: 'fast', count: 5, interval: 800 }  // 3→5, 间隔缩短
    ],
    healthMultiplier: 2.0  // 200%血量
  },
  
  // ========== 第2阶段: 逐渐加强 (波次4-6) ==========
  { 
    waveNumber: 4, 
    enemies: [
      { type: 'basic', count: 15, interval: 800 },  // 10→15, 间隔缩短
      { type: 'fast', count: 8, interval: 700 }  // 5→8, 间隔缩短
    ],
    healthMultiplier: 2.5  // 250%血量
  },
  { 
    waveNumber: 5, 
    enemies: [
      { type: 'basic', count: 12, interval: 700 },  // 8→12, 间隔缩短
      { type: 'fast', count: 9, interval: 600 },  // 6→9, 间隔缩短
      { type: 'tank', count: 3, interval: 2000 }  // 2→3, 间隔缩短
    ],
    healthMultiplier: 3.0  // 300%血量
  },
  { 
    waveNumber: 6, 
    enemies: [
      { type: 'basic', count: 18, interval: 700 },  // 12→18, 间隔缩短
      { type: 'fast', count: 12, interval: 500 },  // 8→12, 间隔缩短
      { type: 'tank', count: 5, interval: 1800 }  // 3→5, 间隔缩短
    ],
    healthMultiplier: 3.5  // 350%血量
  },
  
  // ========== 第3阶段: 中期挑战 (波次7-9) ==========
  { 
    waveNumber: 7, 
    enemies: [
      { type: 'basic', count: 18, interval: 600 },  // 12→18, 间隔缩短
      { type: 'fast', count: 15, interval: 500 },  // 10→15, 间隔缩短
      { type: 'tank', count: 6, interval: 1500 }  // 4→6, 间隔缩短
    ],
    healthMultiplier: 4.0  // 400%血量
  },
  { 
    waveNumber: 8, 
    enemies: [
      { type: 'basic', count: 22, interval: 600 },  // 15→22, 间隔缩短
      { type: 'fast', count: 18, interval: 450 },  // 12→18, 间隔缩短
      { type: 'tank', count: 8, interval: 1400 }  // 5→8, 间隔缩短
    ],
    healthMultiplier: 5.0  // 500%血量
  },
  { 
    waveNumber: 9, 
    enemies: [
      { type: 'basic', count: 22, interval: 500 },  // 15→22, 间隔缩短
      { type: 'fast', count: 22, interval: 450 },  // 15→22, 间隔缩短
      { type: 'tank', count: 9, interval: 1200 }  // 6→9, 间隔缩短
    ],
    healthMultiplier: 6.0  // 600%血量
  },
  
  // ========== 第4阶段: 后期困难 (波次10-20) ==========
  { 
    waveNumber: 10, 
    enemies: [
      { type: 'basic', count: 30, interval: 500 },  // 20→30, 间隔缩短
      { type: 'fast', count: 22, interval: 450 },  // 15→22, 间隔缩短
      { type: 'tank', count: 12, interval: 1000 }  // 8→12, 间隔缩短
    ],
    healthMultiplier: 7.0  // 700%血量
  },
  { 
    waveNumber: 11, 
    enemies: [
      { type: 'basic', count: 30, interval: 450 },  // 20→30, 间隔缩短
      { type: 'fast', count: 27, interval: 400 },  // 18→27, 间隔缩短
      { type: 'tank', count: 15, interval: 900 }  // 10→15, 间隔缩短
    ],
    healthMultiplier: 8.5  // 850%血量
  },
  { 
    waveNumber: 12, 
    enemies: [
      { type: 'basic', count: 38, interval: 400 },  // 25→38, 间隔缩短
      { type: 'fast', count: 30, interval: 350 },  // 20→30, 间隔缩短
      { type: 'tank', count: 18, interval: 800 }  // 12→18, 间隔缩短
    ],
    isBossWave: true,
    healthMultiplier: 10.0  // 1000%血量 - Boss波
  },
  { 
    waveNumber: 13, 
    enemies: [
      { type: 'basic', count: 40, interval: 400 },
      { type: 'fast', count: 32, interval: 350 },
      { type: 'tank', count: 20, interval: 750 }
    ],
    healthMultiplier: 12.0
  },
  { 
    waveNumber: 14, 
    enemies: [
      { type: 'basic', count: 42, interval: 380 },
      { type: 'fast', count: 35, interval: 330 },
      { type: 'tank', count: 22, interval: 700 }
    ],
    healthMultiplier: 14.0
  },
  { 
    waveNumber: 15, 
    enemies: [
      { type: 'basic', count: 45, interval: 360 },
      { type: 'fast', count: 38, interval: 310 },
      { type: 'tank', count: 25, interval: 650 }
    ],
    isBossWave: true,
    healthMultiplier: 16.0  // Boss波
  },
  { 
    waveNumber: 16, 
    enemies: [
      { type: 'basic', count: 48, interval: 350 },
      { type: 'fast', count: 40, interval: 300 },
      { type: 'tank', count: 28, interval: 600 }
    ],
    healthMultiplier: 18.0
  },
  { 
    waveNumber: 17, 
    enemies: [
      { type: 'basic', count: 50, interval: 340 },
      { type: 'fast', count: 42, interval: 290 },
      { type: 'tank', count: 30, interval: 580 }
    ],
    healthMultiplier: 20.0
  },
  { 
    waveNumber: 18, 
    enemies: [
      { type: 'basic', count: 52, interval: 330 },
      { type: 'fast', count: 45, interval: 280 },
      { type: 'tank', count: 32, interval: 560 }
    ],
    healthMultiplier: 22.0
  },
  { 
    waveNumber: 19, 
    enemies: [
      { type: 'basic', count: 55, interval: 320 },
      { type: 'fast', count: 48, interval: 270 },
      { type: 'tank', count: 35, interval: 540 }
    ],
    healthMultiplier: 24.0
  },
  { 
    waveNumber: 20, 
    enemies: [
      { type: 'basic', count: 58, interval: 310 },
      { type: 'fast', count: 50, interval: 260 },
      { type: 'tank', count: 38, interval: 520 }
    ],
    isBossWave: true,
    healthMultiplier: 26.0  // Boss波
  },
  
  // ========== 第5阶段: 极难挑战 (波次21-35) ==========
  { 
    waveNumber: 21, 
    enemies: [
      { type: 'basic', count: 60, interval: 300 },
      { type: 'fast', count: 52, interval: 250 },
      { type: 'tank', count: 40, interval: 500 }
    ],
    healthMultiplier: 28.0
  },
  { 
    waveNumber: 22, 
    enemies: [
      { type: 'basic', count: 62, interval: 290 },
      { type: 'fast', count: 55, interval: 240 },
      { type: 'tank', count: 42, interval: 480 }
    ],
    healthMultiplier: 30.0
  },
  { 
    waveNumber: 23, 
    enemies: [
      { type: 'basic', count: 65, interval: 280 },
      { type: 'fast', count: 58, interval: 230 },
      { type: 'tank', count: 45, interval: 460 }
    ],
    healthMultiplier: 32.0
  },
  { 
    waveNumber: 24, 
    enemies: [
      { type: 'basic', count: 68, interval: 270 },
      { type: 'fast', count: 60, interval: 220 },
      { type: 'tank', count: 48, interval: 440 }
    ],
    healthMultiplier: 34.0
  },
  { 
    waveNumber: 25, 
    enemies: [
      { type: 'basic', count: 70, interval: 260 },
      { type: 'fast', count: 62, interval: 210 },
      { type: 'tank', count: 50, interval: 420 }
    ],
    isBossWave: true,
    healthMultiplier: 36.0  // Boss波
  },
  { 
    waveNumber: 26, 
    enemies: [
      { type: 'basic', count: 72, interval: 250 },
      { type: 'fast', count: 65, interval: 200 },
      { type: 'tank', count: 52, interval: 400 }
    ],
    healthMultiplier: 38.0
  },
  { 
    waveNumber: 27, 
    enemies: [
      { type: 'basic', count: 75, interval: 240 },
      { type: 'fast', count: 68, interval: 190 },
      { type: 'tank', count: 55, interval: 380 }
    ],
    healthMultiplier: 40.0
  },
  { 
    waveNumber: 28, 
    enemies: [
      { type: 'basic', count: 78, interval: 230 },
      { type: 'fast', count: 70, interval: 180 },
      { type: 'tank', count: 58, interval: 360 }
    ],
    healthMultiplier: 42.0
  },
  { 
    waveNumber: 29, 
    enemies: [
      { type: 'basic', count: 80, interval: 220 },
      { type: 'fast', count: 72, interval: 170 },
      { type: 'tank', count: 60, interval: 340 }
    ],
    healthMultiplier: 44.0
  },
  { 
    waveNumber: 30, 
    enemies: [
      { type: 'basic', count: 82, interval: 210 },
      { type: 'fast', count: 75, interval: 160 },
      { type: 'tank', count: 62, interval: 320 }
    ],
    isBossWave: true,
    healthMultiplier: 46.0  // Boss波
  },
  { 
    waveNumber: 31, 
    enemies: [
      { type: 'basic', count: 85, interval: 200 },
      { type: 'fast', count: 78, interval: 150 },
      { type: 'tank', count: 65, interval: 300 }
    ],
    healthMultiplier: 48.0
  },
  { 
    waveNumber: 32, 
    enemies: [
      { type: 'basic', count: 88, interval: 190 },
      { type: 'fast', count: 80, interval: 140 },
      { type: 'tank', count: 68, interval: 280 }
    ],
    healthMultiplier: 50.0
  },
  { 
    waveNumber: 33, 
    enemies: [
      { type: 'basic', count: 90, interval: 180 },
      { type: 'fast', count: 82, interval: 130 },
      { type: 'tank', count: 70, interval: 260 }
    ],
    healthMultiplier: 52.0
  },
  { 
    waveNumber: 34, 
    enemies: [
      { type: 'basic', count: 92, interval: 170 },
      { type: 'fast', count: 85, interval: 120 },
      { type: 'tank', count: 72, interval: 240 }
    ],
    healthMultiplier: 54.0
  },
  { 
    waveNumber: 35, 
    enemies: [
      { type: 'basic', count: 95, interval: 160 },
      { type: 'fast', count: 88, interval: 110 },
      { type: 'tank', count: 75, interval: 220 }
    ],
    isBossWave: true,
    healthMultiplier: 56.0  // Boss波
  },
  
  // ========== 第6阶段: 终极挑战 (波次36-50) ==========
  { 
    waveNumber: 36, 
    enemies: [
      { type: 'basic', count: 98, interval: 150 },
      { type: 'fast', count: 90, interval: 100 },
      { type: 'tank', count: 78, interval: 200 }
    ],
    healthMultiplier: 58.0
  },
  { 
    waveNumber: 37, 
    enemies: [
      { type: 'basic', count: 100, interval: 140 },
      { type: 'fast', count: 92, interval: 95 },
      { type: 'tank', count: 80, interval: 190 }
    ],
    healthMultiplier: 60.0
  },
  { 
    waveNumber: 38, 
    enemies: [
      { type: 'basic', count: 102, interval: 130 },
      { type: 'fast', count: 95, interval: 90 },
      { type: 'tank', count: 82, interval: 180 }
    ],
    healthMultiplier: 62.0
  },
  { 
    waveNumber: 39, 
    enemies: [
      { type: 'basic', count: 105, interval: 120 },
      { type: 'fast', count: 98, interval: 85 },
      { type: 'tank', count: 85, interval: 170 }
    ],
    healthMultiplier: 64.0
  },
  { 
    waveNumber: 40, 
    enemies: [
      { type: 'basic', count: 108, interval: 110 },
      { type: 'fast', count: 100, interval: 80 },
      { type: 'tank', count: 88, interval: 160 }
    ],
    isBossWave: true,
    healthMultiplier: 66.0  // Boss波
  },
  { 
    waveNumber: 41, 
    enemies: [
      { type: 'basic', count: 110, interval: 100 },
      { type: 'fast', count: 102, interval: 75 },
      { type: 'tank', count: 90, interval: 150 }
    ],
    healthMultiplier: 68.0
  },
  { 
    waveNumber: 42, 
    enemies: [
      { type: 'basic', count: 112, interval: 95 },
      { type: 'fast', count: 105, interval: 70 },
      { type: 'tank', count: 92, interval: 140 }
    ],
    healthMultiplier: 70.0
  },
  { 
    waveNumber: 43, 
    enemies: [
      { type: 'basic', count: 115, interval: 90 },
      { type: 'fast', count: 108, interval: 65 },
      { type: 'tank', count: 95, interval: 130 }
    ],
    healthMultiplier: 72.0
  },
  { 
    waveNumber: 44, 
    enemies: [
      { type: 'basic', count: 118, interval: 85 },
      { type: 'fast', count: 110, interval: 60 },
      { type: 'tank', count: 98, interval: 120 }
    ],
    healthMultiplier: 74.0
  },
  { 
    waveNumber: 45, 
    enemies: [
      { type: 'basic', count: 120, interval: 80 },
      { type: 'fast', count: 112, interval: 55 },
      { type: 'tank', count: 100, interval: 110 }
    ],
    isBossWave: true,
    healthMultiplier: 76.0  // Boss波
  },
  { 
    waveNumber: 46, 
    enemies: [
      { type: 'basic', count: 122, interval: 75 },
      { type: 'fast', count: 115, interval: 50 },
      { type: 'tank', count: 102, interval: 100 }
    ],
    healthMultiplier: 78.0
  },
  { 
    waveNumber: 47, 
    enemies: [
      { type: 'basic', count: 125, interval: 70 },
      { type: 'fast', count: 118, interval: 45 },
      { type: 'tank', count: 105, interval: 90 }
    ],
    healthMultiplier: 80.0
  },
  { 
    waveNumber: 48, 
    enemies: [
      { type: 'basic', count: 128, interval: 65 },
      { type: 'fast', count: 120, interval: 40 },
      { type: 'tank', count: 108, interval: 80 }
    ],
    healthMultiplier: 82.0
  },
  { 
    waveNumber: 49, 
    enemies: [
      { type: 'basic', count: 130, interval: 60 },
      { type: 'fast', count: 122, interval: 35 },
      { type: 'tank', count: 110, interval: 70 }
    ],
    healthMultiplier: 84.0
  },
  { 
    waveNumber: 50, 
    enemies: [
      { type: 'basic', count: 135, interval: 55 },
      { type: 'fast', count: 125, interval: 30 },
      { type: 'tank', count: 115, interval: 60 }
    ],
    isBossWave: true,
    healthMultiplier: 86.0  // 最终Boss波
  }
]
