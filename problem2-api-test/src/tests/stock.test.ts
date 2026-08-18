import { describe, it, beforeEach, expect } from 'vitest'
import { getStock, resetStore } from './helpers/api'
import { PRODUCTS } from './fixtures/products'

describe('재고 조회 GET /v1/products/:productId/stock', () => {
  beforeEach(async () => {
    await resetStore()
  })

  it('TC-01: 재고 있는 상품 조회 시 재고 수량과 soldOut=false를 반환한다', async () => {
    const res = await getStock(PRODUCTS.NORMAL.productId)

    expect(res.status).toBe(200)
    expect(res.body.productId).toBe(PRODUCTS.NORMAL.productId)
    expect(res.body.stock).toBe(PRODUCTS.NORMAL.initialStock)
    expect(res.body.soldOut).toBe(false)
  })

  it('TC-02: 재고 0인 상품 조회 시 stock=0, soldOut=true를 반환한다', async () => {
    const res = await getStock(PRODUCTS.SOLD_OUT.productId)

    expect(res.status).toBe(200)
    expect(res.body.stock).toBe(0)
    expect(res.body.soldOut).toBe(true)
  })

  it('TC-03: 존재하지 않는 상품 조회 시 404와 PRODUCT_NOT_FOUND를 반환한다', async () => {
    const res = await getStock(PRODUCTS.NOT_FOUND.productId)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('PRODUCT_NOT_FOUND')
  })
})
