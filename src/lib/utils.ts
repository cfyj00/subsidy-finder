/**
 * 공용 유틸리티 함수 모음
 * 여러 컴포넌트/파일에서 공유되는 헬퍼 함수들
 */

/**
 * 문자열이 실제 사람 이름처럼 보이는지 판별합니다.
 * managing_org 필드에 담당자 이름이 들어올 때 UI에서 구분하기 위해 사용합니다.
 * - 2~4자 한글만으로 구성된 경우 이름으로 판단
 * - 단, "기관", "공단", "센터", "청", "부", "원", "처" 등이 포함되면 기관명으로 판단
 */
export function isPersonName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  // 기관 키워드가 있으면 기관명
  if (/기관|공단|센터|진흥원|재단|청|부처|본부|처$|원$|청$|부$|실$|과$|팀$|위원회|협회|연합|조합|시청|군청|구청|도청|공사|주식|유한|협동|사업단|지원단|운영단/.test(trimmed)) return false;
  // 2~4자 한글 이름 패턴 (성+이름)
  return /^[가-힣]{2,4}$/.test(trimmed);
}
