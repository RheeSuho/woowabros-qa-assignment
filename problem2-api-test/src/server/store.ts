export interface Product {
  productId: string
  name: string
  stock: number
}

export interface Order {
  orderId: string
  productId: string
  quantity: number
  customerId: string
  status: 'COMPLETED' | 'CANCELLED'
  createdAt: number
}

const INITIAL_PRODUCTS: Product[] = [
  { productId: 'P001', name: '떡볶이 세트', stock: 10 },
  { productId: 'P002', name: '순대국밥', stock: 1 },
  { productId: 'P003', name: '김밥 도시락', stock: 0 },
]

// DB 조회 시뮬레이션 지연 — 실제 DB가 없으므로 임의로 설정한 값 (50ms)
// 역할: A 요청(t=0ms)이 이 딜레이 동안 락을 보유하는 사이,
//       B 요청(t=30ms)이 도달해 락을 대기하도록 유도.
//       B 도달 시점(30ms) < DB_DELAY_MS(50ms) 를 만족해야 동시성 시나리오가 성립함.
const DB_DELAY_MS = 50

class Store {
  private products: Map<string, Product> = new Map()
  private orders: Map<string, Order> = new Map()
  private orderCounter = 0
  private locked = false
  private lockQueue: Array<() => void> = []

  constructor() {
    this.reset()
  }

  reset(): void {
    this.products = new Map(INITIAL_PRODUCTS.map(p => [p.productId, { ...p }]))
    this.orders = new Map()
    this.orderCounter = 0
  }

  getProduct(productId: string): Product | undefined {
    return this.products.get(productId)
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId)
  }

  private acquireLock(): Promise<void> {
    if (!this.locked) {
      this.locked = true
      return Promise.resolve()
    }
    return new Promise(resolve => this.lockQueue.push(resolve))
  }

  private releaseLock(): void {
    const next = this.lockQueue.shift()
    if (next) {
      next()
    } else {
      this.locked = false
    }
  }

  async decrementStock(
    productId: string,
    quantity: number,
    customerId: string
  ): Promise<{ success: boolean; reason?: string; order?: Order }> {
    await this.acquireLock()
    try {
      // DB 조회 지연 시뮬레이션 — 이 구간에서 B 요청이 도달해 락을 대기함
      await new Promise(r => setTimeout(r, DB_DELAY_MS))

      const product = this.products.get(productId)
      if (!product) return { success: false, reason: 'PRODUCT_NOT_FOUND' }
      if (product.stock === 0) return { success: false, reason: 'OUT_OF_STOCK' }
      if (product.stock < quantity) return { success: false, reason: 'INSUFFICIENT_STOCK' }

      product.stock -= quantity

      const orderId = `O${String(++this.orderCounter).padStart(4, '0')}`
      const order: Order = {
        orderId,
        productId,
        quantity,
        customerId,
        status: 'COMPLETED',
        createdAt: Date.now(),
      }
      this.orders.set(orderId, order)
      return { success: true, order }
    } finally {
      this.releaseLock()
    }
  }

  async restoreStock(
    orderId: string
  ): Promise<{ success: boolean; reason?: string; currentStock?: number }> {
    await this.acquireLock()
    try {
      const order = this.orders.get(orderId)
      if (!order) return { success: false, reason: 'ORDER_NOT_FOUND' }
      if (order.status === 'CANCELLED') return { success: false, reason: 'ALREADY_CANCELLED' }

      const product = this.products.get(order.productId)!
      product.stock += order.quantity
      order.status = 'CANCELLED'
      return { success: true, currentStock: product.stock }
    } finally {
      this.releaseLock()
    }
  }
}

export const store = new Store()
