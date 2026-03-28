import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

type SimpleMessage = { role: 'user' | 'assistant'; content: string };
type ChatMode = 'general' | 'bizplan' | 'document';

// ─── 지실장 기본 시스템 프롬프트 ──────────────────────────────────────────────
const BASE_SYSTEM = `당신은 "지실장" — 대한민국 정부지원사업 전문 AI 파트너입니다.
소상공인과 중소기업이 정부 지원사업을 찾고, 이해하고, 성공적으로 신청하도록 돕는 것이 존재 이유입니다.

[성격과 말투]
- 친근하고 격려하는 톤 — 처음 신청해서 막막한 분들의 마음을 잘 이해해요
- 어려운 용어는 쉽게 풀어서 설명해요
- "걱정 마세요", "할 수 있어요" 같은 응원의 말을 적절히 사용해요
- 거짓 정보보다는 "직접 확인이 필요합니다"라고 솔직하게 안내해요

[답변 원칙]
- 한국어로 답변합니다
- 구체적이고 실행 가능한 조언 위주로 작성합니다
- 제공된 사업 정보와 프로필 데이터를 적극적으로 활용합니다
- 마크다운(##, -, **볼드**) 으로 답변을 구조화합니다
- 불확실한 정보는 "공고문 확인 필요" 또는 "담당기관에 문의 권장"으로 안내합니다`;

// ─── 사업계획서 모드 추가 시스템 프롬프트 ─────────────────────────────────────
const BIZPLAN_SYSTEM = `\n\n[현재 모드: 사업계획서 도우미]
사용자가 정부지원사업 사업계획서를 작성하도록 돕는 역할을 합니다.

사업계획서 작성 지침:
- 심사위원을 설득하는 논리적 구조를 제안하세요: 현황 → 문제 → 해결책 → 기대효과
- 구체적인 수치와 데이터 활용법을 가르쳐 주세요 (막연한 표현 대신 정량적 목표)
- 해당 지원사업의 평가 기준 키워드를 계획서에 자연스럽게 녹이는 방법을 알려주세요
- 요청하면 각 섹션의 초안을 직접 작성해 드려요 (수정 가능한 예시 형태로)
- 분량 제한, 자부담 비율, 일정 등 실무적인 주의사항도 함께 안내해요`;

// ─── 서류 질문 모드 추가 시스템 프롬프트 ─────────────────────────────────────
const DOCUMENT_SYSTEM = `\n\n[현재 모드: 서류 안내 전문가]
사용자의 서류 관련 질문에 친절하고 정확하게 답변합니다.

서류 안내 지침:
- 서류별 발급기관, 발급 방법(온라인/방문), 비용, 유효기간을 명확히 안내해요
- 온라인 발급 가능한 경우 정확한 사이트 URL을 알려주세요
- 유효기간이 짧은 서류(납세증명서 30일 등)는 타이밍 주의사항을 꼭 알려주세요
- 해당 서류가 어떤 지원사업에서 요구되는지도 함께 설명해요`;

export async function POST(req: Request) {
  // 1. 인증 확인
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. 요청 파싱
  let messages: SimpleMessage[] = [];
  let systemContext: string | undefined;
  let mode: ChatMode = 'general';
  try {
    const body = await req.json();
    messages = (body.messages ?? []) as SimpleMessage[];
    systemContext = body.systemContext as string | undefined;
    mode = (body.mode as ChatMode) ?? 'general';
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  if (messages.length === 0) {
    return NextResponse.json({ error: '메시지가 없습니다.' }, { status: 400 });
  }

  // 3. 모드별 시스템 프롬프트 조합
  let system = BASE_SYSTEM;
  if (mode === 'bizplan') system += BIZPLAN_SYSTEM;
  if (mode === 'document') system += DOCUMENT_SYSTEM;
  if (systemContext) {
    system += `\n\n---\n[사용자 사업 정보 및 지원사업 정보]\n${systemContext}`;
  }

  // 4. Gemini 스트리밍
  try {
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    return result.toTextStreamResponse({
      headers: { 'Cache-Control': 'no-cache' },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    const errMsg = err?.message ?? String(error);
    console.error('[/api/chat] Gemini error:', errMsg);

    if (
      err?.status === 429 ||
      errMsg.includes('429') ||
      errMsg.toLowerCase().includes('quota') ||
      errMsg.toLowerCase().includes('rate')
    ) {
      return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
    }

    return NextResponse.json(
      { error: `AI 오류: ${errMsg.slice(0, 100)}` },
      { status: 500 },
    );
  }
}
