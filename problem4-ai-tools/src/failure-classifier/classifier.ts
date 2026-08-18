import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { CLASSIFIER_SYSTEM_PROMPT } from './prompts'

dotenv.config()

interface ClassificationResult {
  classification: 'INFRA' | 'FLAKY' | 'REAL_BUG'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  summary: string
  root_cause: string
  recommended_action: string
}

const LABEL: Record<ClassificationResult['classification'], string> = {
  INFRA:    '🔧 인프라 문제',
  FLAKY:    '⚡ Flaky 테스트',
  REAL_BUG: '🐛 실제 버그',
}

// API 없이 동작을 보여주기 위한 Mock 응답
const MOCK_RESULTS: Record<string, ClassificationResult> = {
  'infra.txt': {
    classification: 'INFRA',
    confidence: 'HIGH',
    summary: 'Android 에뮬레이터 부팅 실패로 인한 ADB 연결 오류',
    root_cause: 'CI 환경에서 에뮬레이터가 120초 내에 부팅되지 않아 ADB 연결 거부. 앱 코드나 테스트 로직과 무관한 환경 문제.',
    recommended_action: 'CI 에뮬레이터 부팅 타임아웃 증가 또는 실제 기기(Device Farm) 사용으로 전환. 에뮬레이터 스냅샷 활용 권장.',
  },
  'flaky.txt': {
    classification: 'FLAKY',
    confidence: 'HIGH',
    summary: '홈 화면 로딩 지연으로 인한 요소 탐색 타임아웃 (5000ms 초과)',
    root_cause: 'CI 환경에서 네트워크 지연 또는 기기 성능으로 인해 rv_store_list가 5초 내에 렌더링되지 않음. 재실행 3회 중 1회 통과한 것이 Flaky 근거.',
    recommended_action: 'waitUntilLoaded() timeout을 10000ms로 증가. CI 기기 스펙 검토. 또는 앱 시작 시 스플래시/로딩 화면 대기 로직 추가.',
  },
  'real-bug.txt': {
    classification: 'REAL_BUG',
    confidence: 'HIGH',
    summary: '결제 완료 후 주문 상태가 "접수 대기"가 아닌 "결제 실패"로 표시됨',
    root_cause: '3회 모두 동일한 AssertionError 발생. "결제 실패" 상태는 앱 또는 결제 서버의 로직 오류. Flaky가 아닌 일관된 실패.',
    recommended_action: '결제 API 응답 로그 확인. 결제 수단/환경 설정 점검. 개발팀에 버그 리포트 즉시 접수.',
  },
}

async function classifyWithApi(log: string): Promise<ClassificationResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: CLASSIFIER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `아래 테스트 실패 로그를 분석하세요:\n\n${log}` }],
  })
  const raw = (message.content[0] as { type: string; text: string }).text
  return JSON.parse(raw) as ClassificationResult
}

function printResult(filename: string, result: ClassificationResult, isMock: boolean): void {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`📄 ${filename}${isMock ? '  [MOCK]' : ''}`)
  console.log(`분류: ${LABEL[result.classification]}  (신뢰도: ${result.confidence})`)
  console.log(`요약: ${result.summary}`)
  console.log(`원인: ${result.root_cause}`)
  console.log(`권고: ${result.recommended_action}`)
}

async function main(): Promise<void> {
  const useMock = !process.env.ANTHROPIC_API_KEY || process.argv.includes('--mock')
  const logsDir = path.join(__dirname, 'sample-logs')
  const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.txt')).sort()

  console.log(`🔍 CI 실패 로그 자동 분류기${useMock ? ' (Mock 모드)' : ''}`)
  console.log(`총 ${logFiles.length}개 로그 분석 중...\n`)

  for (const file of logFiles) {
    const log = fs.readFileSync(path.join(logsDir, file), 'utf-8')
    const result = useMock
      ? MOCK_RESULTS[file] ?? { classification: 'FLAKY', confidence: 'LOW', summary: 'Mock 없음', root_cause: '-', recommended_action: '-' }
      : await classifyWithApi(log)
    printResult(file, result, useMock)
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`✅ 분석 완료`)
}

main().catch(console.error)
