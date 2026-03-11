import { NextResponse } from 'next/server';

// 시드 데이터 엔드포인트 비활성화
// 실제 데이터는 /api/cron/sync-programs 를 통해 공공 API에서 수집합니다.
export async function POST() {
  return NextResponse.json({
    message: '시드 엔드포인트가 비활성화되었습니다. 실제 데이터는 /api/cron/sync-programs 를 사용하세요.',
    disabled: true,
  }, { status: 410 });
}
