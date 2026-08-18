import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { TC_GENERATOR_SYSTEM_PROMPT } from './prompts'

dotenv.config()

interface TestCase {
  id: string
  category: string
  title: string
  precondition: string
  request: { method: string; path: string; body?: Record<string, unknown> }
  expected_status: number
  expected_response: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

interface GenerationResult {
  api: string
  total: number
  test_cases: TestCase[]
}

const PRIORITY_ICON: Record<TestCase['priority'], string> = {
  HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢',
}

const MOCK_RESULT: GenerationResult = {
  api: 'B마트 재고 API',
  total: 11,
  test_cases: [
    { id: 'TC-01', category: '정상', title: '재고 있는 상품 조회 시 200과 soldOut=false 반환', precondition: 'P001 재고 10개', request: { method: 'GET', path: '/v1/products/P001/stock' }, expected_status: 200, expected_response: '{ stock: 10, soldOut: false }', priority: 'HIGH' },
    { id: 'TC-02', category: '정상', title: '품절 상품 조회 시 soldOut=true 반환', precondition: 'P003 재고 0개', request: { method: 'GET', path: '/v1/products/P003/stock' }, expected_status: 200, expected_response: '{ stock: 0, soldOut: true }', priority: 'HIGH' },
    { id: 'TC-03', category: '에러', title: '존재하지 않는 상품 조회 시 404 반환', precondition: '없음', request: { method: 'GET', path: '/v1/products/P999/stock' }, expected_status: 404, expected_response: '{ error: "PRODUCT_NOT_FOUND" }', priority: 'HIGH' },
    { id: 'TC-04', category: '정상', title: '정상 주문 시 201과 재고 차감 확인', precondition: 'P001 재고 10개', request: { method: 'POST', path: '/v1/orders', body: { productId: 'P001', quantity: 3 } }, expected_status: 201, expected_response: '{ status: "COMPLETED", remainingStock: 7 }', priority: 'HIGH' },
    { id: 'TC-05', category: '에러', title: '품절 상품 주문 시 409 OUT_OF_STOCK', precondition: 'P003 재고 0개', request: { method: 'POST', path: '/v1/orders', body: { productId: 'P003', quantity: 1 } }, expected_status: 409, expected_response: '{ error: "OUT_OF_STOCK" }', priority: 'HIGH' },
    { id: 'TC-06', category: '에러', title: '요청 수량 > 재고 시 409 INSUFFICIENT_STOCK', precondition: 'P001 재고 10개', request: { method: 'POST', path: '/v1/orders', body: { productId: 'P001', quantity: 11 } }, expected_status: 409, expected_response: '{ error: "INSUFFICIENT_STOCK" }', priority: 'HIGH' },
    { id: 'TC-07', category: '경계값', title: 'quantity=0 시 400 INVALID_QUANTITY', precondition: '없음', request: { method: 'POST', path: '/v1/orders', body: { productId: 'P001', quantity: 0 } }, expected_status: 400, expected_response: '{ error: "INVALID_QUANTITY" }', priority: 'MEDIUM' },
    { id: 'TC-08', category: '경계값', title: 'quantity=-1 시 400 INVALID_QUANTITY', precondition: '없음', request: { method: 'POST', path: '/v1/orders', body: { productId: 'P001', quantity: -1 } }, expected_status: 400, expected_response: '{ error: "INVALID_QUANTITY" }', priority: 'MEDIUM' },
    { id: 'TC-09', category: '정상', title: '주문 취소 시 200과 재고 복구 확인', precondition: 'P001 주문 완료 (O0001)', request: { method: 'POST', path: '/v1/orders/O0001/cancel' }, expected_status: 200, expected_response: '{ status: "CANCELLED", availableForPurchase: true }', priority: 'HIGH' },
    { id: 'TC-10', category: '에러', title: '이미 취소된 주문 재취소 시 409 ALREADY_CANCELLED', precondition: 'O0001 이미 취소됨', request: { method: 'POST', path: '/v1/orders/O0001/cancel' }, expected_status: 409, expected_response: '{ error: "ALREADY_CANCELLED" }', priority: 'MEDIUM' },
    { id: 'TC-11', category: '동시성', title: '재고 1개 상품에 2요청 동시 도달 → 1건 성공 1건 품절', precondition: 'P002 재고 1개', request: { method: 'POST', path: '/v1/orders', body: { productId: 'P002', quantity: 1 } }, expected_status: 201, expected_response: '1건 201 COMPLETED, 1건 409 OUT_OF_STOCK', priority: 'HIGH' },
  ],
}

async function generateWithApi(spec: string): Promise<GenerationResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: TC_GENERATOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `아래 API 명세로 테스트 케이스를 생성하세요:\n\n${spec}` }],
  })
  const raw = (message.content[0] as { type: string; text: string }).text
  return JSON.parse(raw) as GenerationResult
}

function printResult(result: GenerationResult, isMock: boolean): void {
  console.log(`\n📋 ${result.api} — 총 ${result.total}개 TC 생성${isMock ? '  [MOCK]' : ''}\n`)
  console.log('─'.repeat(70))

  const byCategory = result.test_cases.reduce<Record<string, TestCase[]>>((acc, tc) => {
    acc[tc.category] = acc[tc.category] ?? []
    acc[tc.category].push(tc)
    return acc
  }, {})

  for (const [category, cases] of Object.entries(byCategory)) {
    console.log(`\n【${category}】`)
    for (const tc of cases) {
      console.log(`  ${PRIORITY_ICON[tc.priority]} ${tc.id}  ${tc.title}`)
      console.log(`       요청: ${tc.request.method} ${tc.request.path}`)
      console.log(`       기대: ${tc.expected_status} — ${tc.expected_response}`)
    }
  }

  const outPath = path.join(__dirname, 'generated-tcs.json')
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`\n${'─'.repeat(70)}`)
  console.log(`💾 전체 결과 저장: ${outPath}`)
}

async function main(): Promise<void> {
  const useMock = !process.env.ANTHROPIC_API_KEY || process.argv.includes('--mock')
  const specPath = path.join(__dirname, 'sample-specs', 'stock-api.yaml')
  const spec = fs.readFileSync(specPath, 'utf-8')

  console.log(`🤖 API 명세 → TC 자동 생성기${useMock ? ' (Mock 모드)' : ''}`)
  console.log(`명세 파일: ${path.basename(specPath)}`)
  console.log('생성 중...')

  const result = useMock ? MOCK_RESULT : await generateWithApi(spec)
  printResult(result, useMock)
}

main().catch(console.error)
