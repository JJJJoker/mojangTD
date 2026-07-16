import type { MahjongSuit, MahjongNumber, MahjongTile } from '../types/game'

/**
 * 麻将牌山管理类
 * 
 * 管理108张麻将数牌(万条筒各4套)的抽取和归还机制
 * 支持阶段重置和Fisher-Yates洗牌算法
 */
export class MahjongDeck {
  private deck: MahjongTile[]      // 当前牌山
  private usedTiles: MahjongTile[] // 已使用区(保留的牌)
  private phase: number            // 当前阶段

  /**
   * 初始化牌山
   * 创建108张麻将数牌并洗牌
   */
  constructor() {
    this.deck = []
    this.usedTiles = []
    this.phase = 1
    this.initializeDeck()
    this.shuffle()
  }

  /**
   * 初始化牌山
   * 创建108张麻将数牌: [1-9]万条筒 × 4套
   */
  private initializeDeck(): void {
    const suits: MahjongSuit[] = ['wan', 'tiao', 'tong']
    const numbers: MahjongNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    
    this.deck = []
    
    // 每种花色9个点数,每个点数4张牌
    for (let i = 0; i < 4; i++) {
      for (const suit of suits) {
        for (const number of numbers) {
          this.deck.push({ suit, number })
        }
      }
    }
  }

  /**
   * Fisher-Yates洗牌算法
   * 确保每张牌的随机位置分布
   */
  private shuffle(): void {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]
    }
  }

  /**
   * 从牌山顶部抽取指定数量的牌
   * 
   * @param count - 要抽取的牌数
   * @returns 抽取的牌数组
   * @throws Error 当牌山数量不足时抛出错误
   */
  draw(count: number): MahjongTile[] {
    if (count > this.deck.length) {
      throw new Error(`牌山不足!需要${count}张,但只剩${this.deck.length}张`)
    }
    
    const drawn = this.deck.splice(0, count)
    return drawn
  }

  /**
   * 将指定的牌归还到牌山并重新洗牌
   * 
   * @param tiles - 要归还的牌数组
   */
  returnToDeck(tiles: MahjongTile[]): void {
    this.deck.push(...tiles)
    this.shuffle()
  }

  /**
   * 从牌山中查找并移除指定牌,加入已使用区
   * 
   * @param tile - 要移除的牌
   * @returns 是否成功找到并移除
   */
  removeFromDeck(tile: MahjongTile): boolean {
    const index = this.deck.findIndex(
      t => t.suit === tile.suit && t.number === tile.number
    )
    
    if (index !== -1) {
      const removed = this.deck.splice(index, 1)[0]
      this.usedTiles.push(removed)
      return true
    }
    
    return false
  }

  /**
   * 获取牌山剩余牌数
   * 
   * @returns 剩余牌的数量
   */
  remaining(): number {
    return this.deck.length
  }

  /**
   * 检查是否需要补充牌山
   * 当剩余牌数少于5张时需要补充
   * 
   * @returns 是否需要补充
   */
  needsRefill(): boolean {
    return this.deck.length < 5
  }

  /**
   * 补充牌山
   * 重置阶段+1,重新初始化牌山,清空已使用区
   */
  refill(): void {
    this.phase += 1
    this.initializeDeck()
    this.usedTiles = []
    this.shuffle()
  }

  /**
   * 获取当前阶段
   * 
   * @returns 当前阶段号
   */
  getPhase(): number {
    return this.phase
  }
}

// 测试示例:
// const deck = new MahjongDeck()
// console.log('初始牌数:', deck.remaining()) // 108
// const drawn = deck.draw(5)
// console.log('抽取5张后:', deck.remaining()) // 103
// deck.returnToDeck(drawn)
// console.log('归还后:', deck.remaining()) // 108
