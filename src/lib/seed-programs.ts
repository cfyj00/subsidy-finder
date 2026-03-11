// seed-programs.ts
// 더 이상 사용하지 않습니다.
// 실제 데이터는 /api/cron/sync-programs 엔드포인트를 통해 bizinfo, data.go.kr 등 공공 API에서 수집합니다.

import type { Program } from '@/types/database';
export const SEED_PROGRAMS: Omit<Program, 'id' | 'created_at' | 'updated_at'>[] = [];
