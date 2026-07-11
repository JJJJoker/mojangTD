import React, { useRef, useEffect } from 'react'
import { MAP_CONFIG } from '../config/map'

interface GameCanvasProps {
  width?: number
  height?: number
  onClick?: (gridPos: { row: number; col: number }) => void
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  width = MAP_CONFIG.cols * MAP_CONFIG.cellSize,
  height = MAP_CONFIG.rows * MAP_CONFIG.cellSize,
  onClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      // 适配高分辨率屏幕
      const dpr = window.devicePixelRatio || 1
      canvasRef.current.width = width * dpr
      canvasRef.current.height = height * dpr
      canvasRef.current.style.width = `${width}px`
      canvasRef.current.style.height = `${height}px`
      
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
    }
  }, [width, height])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onClick || !canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 转换为格子坐标
    const { cellSize } = MAP_CONFIG
    const col = Math.floor(x / cellSize)
    const row = Math.floor(y / cellSize)
    
    // 边界检查
    if (row >= 0 && row < MAP_CONFIG.rows && col >= 0 && col < MAP_CONFIG.cols) {
      onClick({ row, col })
    }
  }

  return (
    <canvas
      ref={canvasRef}
      id="game-canvas"
      onClick={handleClick}
      style={{
        border: '2px solid #333',
        cursor: 'pointer',
        display: 'block'
      }}
    />
  )
}
