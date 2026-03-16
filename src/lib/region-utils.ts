/**
 * 지역명 정규화 유틸리티
 * DB에 약칭(충북, 경기 등)과 전체명(충청북도, 경기도 등)이 혼재 → 양방향 매핑
 */

export const SIDO_ALIASES: Record<string, string[]> = {
  '서울특별시':     ['서울'],
  '부산광역시':     ['부산'],
  '대구광역시':     ['대구'],
  '인천광역시':     ['인천'],
  '광주광역시':     ['광주'],
  '대전광역시':     ['대전'],
  '울산광역시':     ['울산'],
  '세종특별자치시':  ['세종'],
  '경기도':        ['경기'],
  '강원특별자치도':  ['강원', '강원도'],
  '충청북도':       ['충북'],
  '충청남도':       ['충남'],
  '전북특별자치도':  ['전북', '전라북도'],
  '전라남도':       ['전남'],
  '경상북도':       ['경북'],
  '경상남도':       ['경남'],
  '제주특별자치도':  ['제주', '제주도'],
};

/** 프로그램 지역 문자열 r이 사용자의 sido(전체명)에 해당하는지 판단 */
export function sidoMatches(regionStr: string, sido: string): boolean {
  if (regionStr.includes(sido) || sido.includes(regionStr)) return true;
  return (SIDO_ALIASES[sido] ?? []).some(
    (a) => regionStr.includes(a) || a.includes(regionStr),
  );
}

/** 소속 시도 full name (target_regions 미입력 시 source 기반 fallback) */
export const SOURCE_SIDO: Record<string, string> = {
  seoul:    '서울특별시',
  gyeonggi: '경기도',
  busan:    '부산광역시',
  incheon:  '인천광역시',
  daegu:    '대구광역시',
  daejeon:  '대전광역시',
  gwangju:  '광주광역시',
  ulsan:    '울산광역시',
};

/** 제목 "[경남]", "[대구ㆍ경북]" 패턴에서 지역 목록 추출 */
export const TITLE_REGION_MAP: Record<string, string> = {
  '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시',
  '인천': '인천광역시', '광주': '광주광역시', '대전': '대전광역시',
  '울산': '울산광역시', '세종': '세종특별자치시', '경기': '경기도',
  '강원': '강원특별자치도', '충북': '충청북도', '충남': '충청남도',
  '전북': '전북특별자치도', '전남': '전라남도',
  '경북': '경상북도', '경남': '경상남도', '제주': '제주특별자치도',
};
