import { describe, it, beforeEach, expect } from 'vitest'
import { createOrder, cancelOrder, expectStock, resetStore } from './helpers/api'
import { PRODUCTS } from './fixtures/products'

describe('주문 생성 POST /v1/orders', () => {
  beforeEach(async () => {
    await resetStore()
  })

  it('TC-04: 정상 주문 시 201을 반환하고 재고가 즉시 차감된다', async () => {
    const quantity = 3
    const res = await createOrder(PRODUCTS.NORMAL.productId, quantity)

    expect(res.status).toBe(201)
    expect(res.body.orderId).toBeDefined()
    expect(res.body.status).toBe('COMPLETED')
    expect(res.body.remainingStock).toBe(PRODUCTS.NORMAL.initialStock - quantity)

    // 재고 조회로 실제 차감 확인
    await expectStock(PRODUCTS.NORMAL.productId, PRODUCTS.NORMAL.initialStock - quantity)
  })

  it('TC-05: 재고 1개 상품 주문 성공 후 즉시 품절로 전환된다', async () => {
    const res = await createOrder(PRODUCTS.LOW_STOCK.productId, 1)

    expect(res.status).toBe(201)
    expect(res.body.remainingStock).toBe(0)
    expect(res.body.soldOut).toBe(true)

    await expectStock(PRODUCTS.LOW_STOCK.productId, 0, true)
  })

  it('TC-06: 품절 상품 주문 시 409와 OUT_OF_STOCK를 반환한다', async () => {
    const res = await createOrder(PRODUCTS.SOLD_OUT.productId, 1)

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('OUT_OF_STOCK')
  })

  it('TC-07: 존재하지 않는 상품 주문 시 404를 반환한다', async () => {
    const res = await createOrder(PRODUCTS.NOT_FOUND.productId, 1)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('PRODUCT_NOT_FOUND')
  })

  it('TC-08: quantity가 0이면 400과 INVALID_QUANTITY를 반환한다', async () => {
    const res = await createOrder(PRODUCTS.NORMAL.productId, 0)

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_QUANTITY')
  })

  it('TC-09: 요청 수량이 현재 재고를 초과하면 409와 INSUFFICIENT_STOCK를 반환한다', async () => {
    const res = await createOrder(PRODUCTS.NORMAL.productId, PRODUCTS.NORMAL.initialStock + 1)

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('INSUFFICIENT_STOCK')
  })
})

describe('주문 취소 POST /v1/orders/:orderId/cancel', () => {
  beforeEach(async () => {
    await resetStore()
  })

  it('TC-10: 정상 취소 시 차감된 재고가 즉시 복구된다', async () => {
    const quantity = 3
    const orderRes = await createOrder(PRODUCTS.NORMAL.productId, quantity)
    expect(orderRes.status).toBe(201)
    const { orderId } = orderRes.body

    const cancelRes = await cancelOrder(orderId)

    expect(cancelRes.status).toBe(200)
    expect(cancelRes.body.status).toBe('CANCELLED')
    expect(cancelRes.body.currentStock).toBe(PRODUCTS.NORMAL.initialStock)
    expect(cancelRes.body.availableForPurchase).toBe(true)

    await expectStock(PRODUCTS.NORMAL.productId, PRODUCTS.NORMAL.initialStock, false)
  })

  it('TC-11: 존재하지 않는 주문 취소 시 404를 반환한다', async () => {
    const res = await cancelOrder('O9999')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('ORDER_NOT_FOUND')
  })

  it('TC-12: 이미 취소된 주문을 재취소하면 409와 ALREADY_CANCELLED를 반환한다', async () => {
    const orderRes = await createOrder(PRODUCTS.NORMAL.productId, 1)
    const { orderId } = orderRes.body

    await cancelOrder(orderId)
    const res = await cancelOrder(orderId)

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('ALREADY_CANCELLED')
  })

  it('TC-13: 취소 후 재고 복구 → 다른 고객이 즉시 재주문에 성공한다', async () => {
    // Step 1: 재고 1개 상품 주문 → 품절
    const orderRes = await createOrder(PRODUCTS.LOW_STOCK.productId, 1)
    expect(orderRes.status).toBe(201)
    await expectStock(PRODUCTS.LOW_STOCK.productId, 0, true)

    // Step 2: 취소 → 재고 복구
    const cancelRes = await cancelOrder(orderRes.body.orderId)
    expect(cancelRes.status).toBe(200)
    await expectStock(PRODUCTS.LOW_STOCK.productId, 1, false)

    // Step 3: 다른 고객 재주문 성공 확인
    const reorderRes = await createOrder(PRODUCTS.LOW_STOCK.productId, 1, 'C_OTHER')
    expect(reorderRes.status).toBe(201)
    expect(reorderRes.body.soldOut).toBe(true)
  })
})
