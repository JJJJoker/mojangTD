import type { GridCell } from '../types/game'

export const MAP_CONFIG = {
  rows: 15,
  cols: 20,
  cellSize: 40, // 每个格子的像素大小
  startPos: { row: 0, col: 2 },      // 起点(顶部绿色区域)
  minePos: { row: 7, col: 10 },       // 矿坑(中心黄色区域)
  endPos: { row: 14, col: 17 }        // 终点(右下角红色区域)
}

// 初始化空地图
export function initializeGrid(): GridCell[][] {
  const { rows, cols, startPos, endPos } = MAP_CONFIG
  const grid: GridCell[][] = []
  
  for (let row = 0; row < rows; row++) {
    grid[row] = []
    for (let col = 0; col < cols; col++) {
      if (row === startPos.row && col === startPos.col) {
        grid[row][col] = { row, col, type: 'start' }
      } else if (row === endPos.row && col === endPos.col) {
        grid[row][col] = { row, col, type: 'end' }
      } else if (row === 7 && col === 10) {
        // 矿坑位置(地图中央)
        grid[row][col] = { row, col, type: 'mine' }
      } else {
        grid[row][col] = { row, col, type: 'empty' }
      }
    }
  }
  
  return grid
}

// 将格子坐标转换为像素坐标
export function gridToPixel(row: number, col: number): { x: number; y: number } {
  const { cellSize } = MAP_CONFIG
  return {
    x: col * cellSize + cellSize / 2,
    y: row * cellSize + cellSize / 2
  }
}

// 将像素坐标转换为格子坐标
export function pixelToGrid(x: number, y: number): { row: number; col: number } {
  const { cellSize } = MAP_CONFIG
  return {
    row: Math.floor(y / cellSize),
    col: Math.floor(x / cellSize)
  }
}
