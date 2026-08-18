import { describe, it, beforeEach, expect } from 'vitest'
import { createOrder, resetStore, delay } from './helpers/api'
import { PRODUCTS } from './fixtures/products'

describe('동시성 POST /v1/orders', () => {
  beforeEach(async () => {
    await resetStore()
  })

  it('TC-14: 재고 1개 상품에 수십ms 간격 동시 요청 → 정확히 1건 성공, 1건 품절 처리', async () => {
    // 고객 A 요청 발사 (t=0)
    // 서버는 DB 조회 시뮬레이션(50ms) 동안 락을 보유
    const orderA = createOrder(PRODUCTS.LOW_STOCK.productId, 1, 'customer-A')

    // 30ms 후 고객 B 요청 발사 (t=30ms)
    // A가 아직 락을 보유 중이므로 B는 락 해제까지 대기
    await delay(30)
    const orderB = createOrder(PRODUCTS.LOW_STOCK.productId, 1, 'customer-B')

    const [resultA, resultB] = await Promise.all([orderA, orderB])

    const statuses = [resultA.status, resultB.status]
    const successCount = statuses.filter(s => s === 201).length
    const failCount = statuses.filter(s => s === 409).length

    // 핵심 검증: 선착순으로 정확히 1건 성공, 1건 품절
    expect(successCount).toBe(1)
    expect(failCount).toBe(1)

    // 실패한 요청은 OUT_OF_STOCK 에러여야 한다
    const failedResult = resultA.status === 409 ? resultA : resultB
    expect(failedResult.body.error).toBe('OUT_OF_STOCK')

    // 성공한 주문의 최종 재고는 0 (품절)
    const successResult = resultA.status === 201 ? resultA : resultB
    expect(successResult.body.remainingStock).toBe(0)
    expect(successResult.body.soldOut).toBe(true)
  })
})
