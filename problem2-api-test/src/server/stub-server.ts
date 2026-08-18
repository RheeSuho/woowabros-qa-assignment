import express, { Request, Response } from 'express'
import { store } from './store'

export const app = express()
app.use(express.json())

// GET /v1/products/:productId/stock — 재고 조회
app.get('/v1/products/:productId/stock', (req: Request, res: Response) => {
  const { productId } = req.params
  const product = store.getProduct(productId)

  if (!product) {
    return res.status(404).json({
      error: 'PRODUCT_NOT_FOUND',
      message: `상품 ${productId}를 찾을 수 없습니다.`,
    })
  }

  return res.status(200).json({
    productId: product.productId,
    name: product.name,
    stock: product.stock,
    soldOut: product.stock === 0,
  })
})

// POST /v1/orders — 주문 생성 (재고 차감)
app.post('/v1/orders', async (req: Request, res: Response) => {
  const { productId, quantity, customerId = 'GUEST' } = req.body

  if (!productId || quantity === undefined) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      message: 'productId와 quantity는 필수입니다.',
    })
  }

  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({
      error: 'INVALID_QUANTITY',
      message: 'quantity는 1 이상의 정수여야 합니다.',
    })
  }

  // 상품 존재 여부 선행 확인 (락 없이)
  if (!store.getProduct(productId)) {
    return res.status(404).json({
      error: 'PRODUCT_NOT_FOUND',
      message: `상품 ${productId}를 찾을 수 없습니다.`,
    })
  }

  const result = await store.decrementStock(productId, quantity, customerId)

  if (!result.success) {
    const status = result.reason === 'PRODUCT_NOT_FOUND' ? 404 : 409
    return res.status(status).json({
      error: result.reason,
      message: '재고가 부족하거나 품절된 상품입니다.',
    })
  }

  const updated = store.getProduct(productId)!
  return res.status(201).json({
    orderId: result.order!.orderId,
    productId,
    quantity,
    customerId,
    status: 'COMPLETED',
    remainingStock: updated.stock,
    soldOut: updated.stock === 0,
  })
})

// POST /v1/orders/:orderId/cancel — 주문 취소 (재고 복구)
app.post('/v1/orders/:orderId/cancel', async (req: Request, res: Response) => {
  const { orderId } = req.params
  const result = await store.restoreStock(orderId)

  if (!result.success) {
    const status = result.reason === 'ORDER_NOT_FOUND' ? 404 : 409
    return res.status(status).json({
      error: result.reason,
      message: result.reason === 'ORDER_NOT_FOUND'
        ? `주문 ${orderId}를 찾을 수 없습니다.`
        : '이미 취소된 주문입니다.',
    })
  }

  return res.status(200).json({
    orderId,
    status: 'CANCELLED',
    currentStock: result.currentStock,
    availableForPurchase: (result.currentStock ?? 0) > 0,
  })
})

// POST /v1/test/reset — 테스트 격리용 스토어 초기화
app.post('/v1/test/reset', (_req: Request, res: Response) => {
  store.reset()
  return res.status(200).json({ message: 'store reset complete' })
})

// 단독 실행 시에만 서버 바인딩 (테스트에서 import 시 바인딩 안 함)
if (require.main === module) {
  app.listen(3000, () => console.log('Stub server running on http://localhost:3000'))
}
