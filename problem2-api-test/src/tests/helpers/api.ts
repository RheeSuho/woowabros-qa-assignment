import supertest from 'supertest'
import { expect } from 'vitest'
import { app } from '../../server/stub-server'

export const request = supertest(app)

// --- API 클라이언트 헬퍼 ---
// 엔드포인트별 호출을 캡슐화해 테스트 코드에서 URL 문자열 중복 제거

export const getStock = (productId: string) =>
  request.get(`/v1/products/${productId}/stock`)

export const createOrder = (productId: string, quantity: number, customerId = 'C_TEST') =>
  request.post('/v1/orders').send({ productId, quantity, customerId })

export const cancelOrder = (orderId: string) =>
  request.post(`/v1/orders/${orderId}/cancel`)

export const resetStore = () =>
  request.post('/v1/test/reset')

// --- 검증 헬퍼 ---
// Then 구문에서 반복되는 재고 상태 확인을 한 줄로 표현

export async function expectStock(
  productId: string,
  expectedStock: number,
  expectedSoldOut?: boolean
): Promise<void> {
  const res = await getStock(productId)
  expect(res.status).toBe(200)
  expect(res.body.stock).toBe(expectedStock)
  if (expectedSoldOut !== undefined) {
    expect(res.body.soldOut).toBe(expectedSoldOut)
  }
}

// --- 유틸 ---

export const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))
