// 스텁 서버 초기 시드 데이터와 동일한 값으로 정의
// store.ts의 INITIAL_PRODUCTS와 반드시 동기화 유지
export const PRODUCTS = {
  NORMAL: {
    productId: 'P001',
    name: '떡볶이 세트',
    initialStock: 10,
  },
  LOW_STOCK: {
    productId: 'P002',
    name: '순대국밥',
    initialStock: 1,
  },
  SOLD_OUT: {
    productId: 'P003',
    name: '김밥 도시락',
    initialStock: 0,
  },
  NOT_FOUND: {
    productId: 'P999',
  },
} as const
