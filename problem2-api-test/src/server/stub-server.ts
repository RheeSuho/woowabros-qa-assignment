import path from 'path'
import express, { Request, Response } from 'express'
import swaggerUi from 'swagger-ui-express'
import { store } from './store'

export const app = express()
app.use(express.json())

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'B마트 재고 API (Stub Server)',
    version: '1.0.0',
    description: [
      '우아한형제들 과제 - B마트 재고 관리 API 스텁 서버.',
      '',
      '**초기 상품 데이터:**',
      '- `P001` 떡볶이 세트 — 재고 10개',
      '- `P002` 순대국밥 — 재고 1개 (동시성 테스트용)',
      '- `P003` 김밥 도시락 — 품절',
    ].join('\n'),
  },
  paths: {
    '/v1/products/{productId}/stock': {
      get: {
        summary: '재고 조회',
        description: '장바구니 담기 시점에 호출. 재고를 차감하지 않습니다.',
        parameters: [{
          name: 'productId', in: 'path', required: true,
          schema: { type: 'string', enum: ['P001', 'P002', 'P003'] },
          description: 'P001(재고 있음) / P002(재고 1개) / P003(품절)',
        }],
        responses: {
          '200': {
            description: '조회 성공',
            content: { 'application/json': { example: { productId: 'P001', name: '떡볶이 세트', stock: 10, soldOut: false } } },
          },
          '404': { description: '존재하지 않는 상품' },
        },
      },
    },
    '/v1/orders': {
      post: {
        summary: '주문 생성 (재고 차감)',
        description: '결제 완료 시점에 호출. 재고를 즉시 차감합니다.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'quantity'],
                properties: {
                  productId: { type: 'string', example: 'P001' },
                  quantity: { type: 'integer', minimum: 1, example: 1 },
                  customerId: { type: 'string', example: 'C001' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: '주문 성공 — 재고 차감됨' },
          '400': { description: 'INVALID_QUANTITY — quantity가 0 이하' },
          '404': { description: 'PRODUCT_NOT_FOUND' },
          '409': { description: 'OUT_OF_STOCK / INSUFFICIENT_STOCK' },
        },
      },
    },
    '/v1/orders/{orderId}/cancel': {
      post: {
        summary: '주문 취소 (재고 복구)',
        description: '취소 즉시 재고를 복구합니다. 다른 고객이 바로 구매 가능한 상태로 전환됩니다.',
        parameters: [{
          name: 'orderId', in: 'path', required: true,
          schema: { type: 'string', example: 'O0001' },
          description: '주문 생성 후 응답에서 받은 orderId 입력',
        }],
        responses: {
          '200': { description: '취소 성공 — 재고 복구됨' },
          '404': { description: 'ORDER_NOT_FOUND' },
          '409': { description: 'ALREADY_CANCELLED' },
        },
      },
    },
    '/v1/test/reset': {
      post: {
        summary: '스토어 초기화 (테스트용)',
        description: '모든 주문을 제거하고 재고를 초기값으로 되돌립니다.',
        responses: {
          '200': { description: '초기화 완료' },
        },
      },
    },
  },
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// 테스트 러너 UI
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'test-runner.html'))
})

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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const os = require('os')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const localtunnel = require('localtunnel')
  const PORT = 3000

  app.listen(PORT, '0.0.0.0', async () => {
    const nets = os.networkInterfaces() as Record<string, Array<{ family: string; address: string; internal: boolean }>>
    const localIp = Object.values(nets)
      .flat()
      .find((n) => n.family === 'IPv4' && !n.internal)?.address ?? 'unknown'

    console.log(`\nStub server running`)
    console.log(`  Local   : http://localhost:${PORT}`)
    console.log(`  Network : http://${localIp}:${PORT}`)

    try {
      const tunnel = await localtunnel({ port: PORT })
      console.log(`  Public  : ${tunnel.url}  ← 외부 접속용 (인터넷 어디서나)`)
      tunnel.on('error', () => {})
    } catch {
      console.log(`  Public  : (터널 연결 실패 — 네트워크 주소 사용)`)
    }

    console.log()
  })
}
