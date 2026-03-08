// ─── 서류 가이드 데이터 ─────────────────────────────────────────────────────────

export type DocumentCategory =
  | '기본서류'
  | '재무서류'
  | '인증서류'
  | '사업서류'
  | '특수서류';

export type IssuingMethod = '온라인' | '방문' | '자체작성' | '온라인+방문';

export interface DocumentGuide {
  id: string;
  name: string;                    // 서류명
  category: DocumentCategory;
  issuingOrg: string;              // 발급기관
  issuingMethod: IssuingMethod;
  cost: string;                    // 발급비용
  validity: string;                // 유효기간
  processingTime: string;          // 소요시간
  description: string;             // 한 줄 설명
  purpose: string;                 // 어디에 쓰이는지
  steps: string[];                 // 발급 절차
  tips: string[];                  // 꿀팁
  cautions: string[];              // 주의사항
  onlineUrl?: string;              // 온라인 발급 링크
  applicableTo?: string;           // 적용 대상 (법인 전용 등)
  relatedPrograms?: string[];      // 자주 요구되는 프로그램 예시
}

export const DOCUMENT_GUIDES: DocumentGuide[] = [
  // ─── 기본서류 ──────────────────────────────────────────────────────────────
  {
    id: 'business-reg',
    name: '사업자등록증',
    category: '기본서류',
    issuingOrg: '국세청 (세무서)',
    issuingMethod: '온라인+방문',
    cost: '무료',
    validity: '없음 (보통 3개월 이내 발급본 요구)',
    processingTime: '즉시 (온라인)',
    description: '사업체 존재를 증명하는 가장 기본적인 서류',
    purpose: '거의 모든 지원사업 신청 시 필수 제출',
    steps: [
      '홈택스(hometax.go.kr) 로그인',
      '민원증명 → 사업자등록증명 선택',
      '용도 선택 후 PDF 출력 또는 공문서 발급',
    ],
    tips: [
      '홈택스에서 24시간 무료 발급 가능해요',
      '제출용은 "사업자등록증명원"을 발급하면 더 공신력 있어요',
      '업종이 변경됐다면 정정신고 후 재발급하세요',
    ],
    cautions: [
      '복사본은 대부분 인정 안 돼요 — 반드시 새로 출력하세요',
      '보통 신청일 기준 3개월 이내 발급본을 요구해요',
    ],
    onlineUrl: 'https://www.hometax.go.kr',
  },
  {
    id: 'business-reg-cert',
    name: '사업자등록증명원',
    category: '기본서류',
    issuingOrg: '국세청 홈택스',
    issuingMethod: '온라인',
    cost: '무료',
    validity: '3개월',
    processingTime: '즉시',
    description: '사업자 등록 사실을 공적으로 증명하는 서류 (사업자등록증보다 공신력 높음)',
    purpose: '공공기관 제출용, 금융기관 제출용으로 선호',
    steps: [
      '홈택스 로그인',
      '민원증명 → 사업자등록증명 클릭',
      '수령 방법: 인터넷 발급 → PDF 저장',
    ],
    tips: [
      '"휴업·폐업 여부 포함" 옵션을 선택해서 발급하면 신뢰도가 높아요',
      '사업자등록증 대신 이 서류를 요구하는 기관이 많아요',
    ],
    cautions: [
      '사업자등록증과는 다른 서류예요 — 제출 요건을 꼭 확인하세요',
    ],
    onlineUrl: 'https://www.hometax.go.kr',
  },
  {
    id: 'corporate-reg',
    name: '법인등기부등본',
    category: '기본서류',
    issuingOrg: '인터넷등기소',
    issuingMethod: '온라인',
    cost: '700원 (열람) / 1,000원 (발급)',
    validity: '3개월',
    processingTime: '즉시',
    description: '법인의 설립일, 대표자, 주소, 자본금 등을 공식 증명하는 서류',
    purpose: '법인 기업 지원사업 신청 시 기본 제출 서류',
    steps: [
      '인터넷등기소(iros.go.kr) 접속',
      '법인 등기 열람/발급 선택',
      '법인명 또는 법인등록번호로 검색 후 발급',
    ],
    tips: [
      '"말소사항 포함" 옵션으로 발급하면 전체 이력을 볼 수 있어요',
      '공동대표인 경우 대표자 모두 표기됐는지 확인하세요',
    ],
    cautions: [
      '법인 기업만 해당 — 개인사업자는 필요 없어요',
      '등기 변경(주소·대표자) 후 반드시 재발급하세요',
    ],
    onlineUrl: 'https://www.iros.go.kr',
    applicableTo: '법인 전용',
  },
  {
    id: 'seal-cert',
    name: '인감증명서',
    category: '기본서류',
    issuingOrg: '주민센터 (개인) / 법원등기소 (법인)',
    issuingMethod: '방문',
    cost: '600원',
    validity: '3개월',
    processingTime: '당일 발급',
    description: '등록된 인감(도장)이 본인 것임을 증명하는 서류',
    purpose: '중요 계약서, 지원사업 협약서 등에 사용',
    steps: [
      '신분증 지참 후 가까운 주민센터 방문',
      '인감증명서 발급 신청서 작성',
      '600원 납부 후 즉시 발급',
    ],
    tips: [
      '미리 인감 등록이 되어 있어야 해요 — 처음이라면 등록부터',
      '전자본인서명확인서로 대체 가능한 경우도 있으니 먼저 확인해 보세요',
    ],
    cautions: [
      '방문 필수 — 온라인 발급 불가능',
      '법인은 법인인감증명서를 별도 발급해야 해요',
    ],
  },

  // ─── 재무서류 ──────────────────────────────────────────────────────────────
  {
    id: 'financial-statements',
    name: '재무제표 (손익계산서·재무상태표)',
    category: '재무서류',
    issuingOrg: '세무사 / 국세청 홈택스',
    issuingMethod: '온라인+방문',
    cost: '무료 (홈택스) / 유료 (세무사 대행)',
    validity: '없음 (최근 1~2개 사업연도 기준)',
    processingTime: '즉시 (홈택스)',
    description: '기업의 재무 상태와 경영 성과를 보여주는 핵심 회계 서류',
    purpose: '지원 규모 산정, 자격 요건 확인 (매출액·자산 기준)',
    steps: [
      '홈택스 로그인',
      '조회/발급 → 세금신고납부 → 부가가치세 과세표준증명 또는 결산 재무제표 확인',
      '세무사에게 의뢰하면 공인 재무제표(감사보고서)를 받을 수 있어요',
    ],
    tips: [
      '보통 최근 2개 사업연도(전전년도·전년도) 제출을 요구해요',
      '신생기업(1년 미만)은 최근 결산 재무제표가 없어도 신청 가능한 사업이 많아요',
      '외부감사 대상 법인은 감사보고서로 대체할 수 있어요',
    ],
    cautions: [
      '세무 신고를 정확히 해야 해요 — 허위 신고는 지원사업 취소 사유',
      '재무제표 기준으로 매출·직원 수 요건을 판단하니 꼭 확인하세요',
    ],
    onlineUrl: 'https://www.hometax.go.kr',
  },
  {
    id: 'vat-cert',
    name: '부가가치세 과세표준증명원',
    category: '재무서류',
    issuingOrg: '국세청 홈택스',
    issuingMethod: '온라인',
    cost: '무료',
    validity: '3개월',
    processingTime: '즉시',
    description: '연간 매출 규모를 공식 증명하는 서류',
    purpose: '매출 기준 자격 확인, 중소기업·소상공인 여부 판단에 사용',
    steps: [
      '홈택스 로그인',
      '민원증명 → 과세표준증명 선택',
      '조회 연도 선택 후 발급',
    ],
    tips: [
      '부가세 면세사업자는 "면세사업자 수입금액증명"을 발급받아야 해요',
      '여러 사업연도 제출 시 연도별로 각각 발급하세요',
    ],
    cautions: [
      '부가세 신고를 아직 안 했다면 발급이 안 돼요 — 신고 먼저!',
    ],
    onlineUrl: 'https://www.hometax.go.kr',
  },
  {
    id: 'national-tax-cert',
    name: '국세납세증명서',
    category: '재무서류',
    issuingOrg: '국세청 홈택스 / 세무서',
    issuingMethod: '온라인',
    cost: '무료',
    validity: '30일',
    processingTime: '즉시',
    description: '국세(소득세·법인세·부가세 등) 체납이 없음을 증명',
    purpose: '거의 모든 보조금 사업 신청 시 필수 — 체납 시 지원 불가',
    steps: [
      '홈택스 로그인',
      '민원증명 → 납세증명서 선택',
      '용도 선택 후 즉시 발급',
    ],
    tips: [
      '미납 세금이 있으면 먼저 납부하세요 — 발급 자체가 안 돼요',
      '신청 직전에 발급해야 유효기간(30일) 내 제출할 수 있어요',
    ],
    cautions: [
      '유효기간이 30일로 매우 짧아요 — 신청 직전에 발급하세요',
      '분납 중이라도 납부 계획 승인 시 발급 가능한 경우 있어요',
    ],
    onlineUrl: 'https://www.hometax.go.kr',
  },
  {
    id: 'local-tax-cert',
    name: '지방세납세증명서',
    category: '재무서류',
    issuingOrg: '위택스 / 구청·시청',
    issuingMethod: '온라인',
    cost: '무료',
    validity: '30일',
    processingTime: '즉시',
    description: '지방세(재산세·주민세 등) 체납이 없음을 증명',
    purpose: '국세납세증명서와 함께 보조금 신청 필수 서류',
    steps: [
      '위택스(wetax.go.kr) 로그인',
      '납세증명서 발급 메뉴 선택',
      '사업장 기준 발급 후 저장',
    ],
    tips: [
      '국세와 지방세 납세증명서를 세트로 준비해 두세요',
      '위택스 외에도 정부24(gov.kr)에서 발급 가능해요',
    ],
    cautions: [
      '국세와는 별개 서류예요 — 둘 다 필요한 경우가 많아요',
    ],
    onlineUrl: 'https://www.wetax.go.kr',
  },

  // ─── 인증서류 ──────────────────────────────────────────────────────────────
  {
    id: 'social-insurance',
    name: '4대보험 사업장 가입자 명부',
    category: '인증서류',
    issuingOrg: '4대사회보험 정보연계센터',
    issuingMethod: '온라인',
    cost: '무료',
    validity: '3개월',
    processingTime: '즉시',
    description: '직원들의 4대보험(건강·국민연금·고용·산재) 가입 현황을 증명',
    purpose: '고용 인원 수 확인, 상시근로자 수 산정에 사용',
    steps: [
      '4대사회보험포털(4insure.or.kr) 로그인',
      '사업장 관리 → 가입자 명부 조회',
      '인쇄 또는 PDF 저장',
    ],
    tips: [
      '상시근로자 수 산정 기준이 되는 핵심 서류예요',
      '월별로 인원 변동이 있다면 최근 3개월 평균으로 산정해요',
    ],
    cautions: [
      '일용직·프리랜서는 4대보험 미가입인 경우가 많아서 상시근로자 수에서 제외돼요',
      '4대보험에 가입 안 된 직원은 존재 자체를 인정받기 어려울 수 있어요',
    ],
    onlineUrl: 'https://www.4insure.or.kr',
  },
  {
    id: 'employment-insurance-cert',
    name: '고용보험 피보험자격 이력내역서',
    category: '인증서류',
    issuingOrg: '고용보험 EDI / 고용24',
    issuingMethod: '온라인',
    cost: '무료',
    validity: '3개월',
    processingTime: '즉시',
    description: '근로자의 고용보험 취득·상실 이력을 보여주는 서류',
    purpose: '고용 창출 실적, 청년 고용 확인 등에 사용',
    steps: [
      '고용24(work.go.kr) 또는 고용보험 EDI 로그인',
      '피보험자격 이력내역서 발급 메뉴',
      '기간 설정 후 출력',
    ],
    tips: [
      '신규 채용 확인, 고용 유지 증명 등에 자주 쓰여요',
    ],
    cautions: [
      '고용보험 미신고 직원은 이력이 없어요 — 미리 확인하세요',
    ],
    onlineUrl: 'https://www.work.go.kr',
  },
  {
    id: 'sme-cert',
    name: '중소기업 확인서',
    category: '인증서류',
    issuingOrg: '중소벤처기업부 (SMBA)',
    issuingMethod: '온라인',
    cost: '무료',
    validity: '1년',
    processingTime: '2~3일',
    description: '중소기업기본법상 중소기업 해당 여부를 공식 확인하는 서류',
    purpose: '중소기업 대상 지원사업의 자격 요건 증명',
    steps: [
      '중소기업 현황정보시스템(bizinfo.go.kr) 접속',
      '중소기업 확인서 신청 메뉴',
      '사업자 정보 입력 후 신청 → 2~3일 내 발급',
    ],
    tips: [
      '유효기간이 1년이니 미리 발급해두면 여러 사업에 재사용할 수 있어요',
      '소기업 해당 여부도 함께 확인되니 메모해 두세요',
    ],
    cautions: [
      '매출·자산·직원 수에 따라 중소기업 여부가 달라질 수 있어요',
      '대기업 계열사는 중소기업에서 제외될 수 있어요',
    ],
    onlineUrl: 'https://www.bizinfo.go.kr',
  },
  {
    id: 'micro-biz-cert',
    name: '소상공인 확인서',
    category: '인증서류',
    issuingOrg: '소상공인시장진흥공단',
    issuingMethod: '온라인',
    cost: '무료',
    validity: '1년',
    processingTime: '즉시~1일',
    description: '소상공인기본법상 소상공인임을 공식 확인하는 서류',
    purpose: '소상공인 전용 지원사업 신청 시 필수',
    steps: [
      '소상공인 마당(소상공인시장진흥공단 홈페이지) 접속',
      '소상공인 확인서 신청',
      '사업자 정보 조회 후 즉시 또는 익일 발급',
    ],
    tips: [
      '업종별 소상공인 기준이 달라요 (제조업 10인 미만, 서비스업 5인 미만 등)',
      '소상공인 지원사업은 이 확인서가 있으면 훨씬 빠르게 진행돼요',
    ],
    cautions: [
      '상시근로자 수 기준이 업종마다 달라요 — 직접 확인하세요',
    ],
    onlineUrl: 'https://www.sbiz.or.kr',
  },
  {
    id: 'venture-cert',
    name: '벤처기업확인서',
    category: '인증서류',
    issuingOrg: '중소벤처기업부 / 벤처확인종합관리시스템',
    issuingMethod: '온라인',
    cost: '무료',
    validity: '2년',
    processingTime: '1~4주',
    description: '벤처기업육성에 관한 특별조치법상 벤처기업임을 인증하는 서류',
    purpose: '벤처기업 우대 지원사업 신청, 세제 혜택, 투자 유치에 활용',
    steps: [
      '벤처확인종합관리시스템(venturein.or.kr) 접속',
      '벤처기업확인 신청',
      '유형 선택 (기술평가보증·투자·연구개발 등)',
      '심사 후 1~4주 내 결과 통보',
    ],
    tips: [
      '벤처 인증이 있으면 가점을 주는 사업이 많아요 — 꼭 챙기세요',
      '기술신용보증기금이나 중소기업진흥공단을 통한 신청이 빠를 수 있어요',
    ],
    cautions: [
      '인증 심사 기간이 길어요 — 미리 준비하세요',
      '요건 (기술성·성장성·혁신성)을 꼼꼼히 확인하세요',
    ],
    onlineUrl: 'https://www.venturein.or.kr',
    applicableTo: '벤처기업 인증 필요 시',
  },
  {
    id: 'innobiz-cert',
    name: '이노비즈(Innobiz) 인증서',
    category: '인증서류',
    issuingOrg: '중소벤처기업부 (이노비즈협회)',
    issuingMethod: '온라인+방문',
    cost: '무료',
    validity: '3년',
    processingTime: '1~3개월',
    description: '기술혁신형 중소기업(이노비즈)임을 인증하는 서류',
    purpose: '이노비즈 전용·우대 지원사업, 금융 우대, 공공조달 가점',
    steps: [
      '이노비즈넷(innobiz.net) 접속',
      '이노비즈 인증 신청',
      '현장 실사 + 온라인 자가진단 평가',
      '평균 1~3개월 소요',
    ],
    tips: [
      '유효기간이 3년이니 한번 받으면 오래 쓸 수 있어요',
      '기술개발 활동 지표 (R&D 투자비율, 특허 등)를 미리 정리해 두세요',
    ],
    cautions: [
      '업력 3년 이상, 제조·서비스업 중소기업만 신청 가능해요',
    ],
    onlineUrl: 'https://www.innobiz.net',
    applicableTo: '기술혁신형 중소기업',
  },

  // ─── 사업서류 ──────────────────────────────────────────────────────────────
  {
    id: 'business-plan',
    name: '사업계획서',
    category: '사업서류',
    issuingOrg: '자체 작성',
    issuingMethod: '자체작성',
    cost: '무료 (자체작성) / 유료 (컨설팅 의뢰)',
    validity: '없음 (사업별 최신 양식 확인 필수)',
    processingTime: '1~2주 (충분한 준비 권장)',
    description: '지원사업 신청의 핵심 서류 — 사업 목적, 추진 계획, 기대 효과 등을 작성',
    purpose: '심사위원이 지원금을 줄지 결정하는 가장 중요한 서류',
    steps: [
      '해당 지원사업 공고문 다운로드 → 양식 확인',
      '사업 현황, 문제점, 해결방안, 기대효과 순서로 작성',
      '수치·근거 자료 첨부 (매출 데이터, 시장 규모 등)',
      '첨삭·검토 후 최종 제출',
    ],
    tips: [
      '공고문의 "평가 기준"을 먼저 읽고 거기에 맞춰 작성하세요',
      '"문제 → 해결책 → 기대효과" 구조가 심사위원에게 설득력 있어요',
      '숫자와 구체적 근거를 많이 쓸수록 좋아요 (막연한 표현 ❌)',
      'AI 상담 메뉴에서 작성 도움을 받아보세요!',
    ],
    cautions: [
      '양식이 사업마다 달라요 — 반드시 공고문 양식을 사용하세요',
      '분량 제한이 있는 경우 엄수하세요 (초과 시 감점)',
      '추상적인 표현보다 구체적 수치와 계획이 훨씬 유리해요',
    ],
  },
  {
    id: 'quotation',
    name: '견적서',
    category: '사업서류',
    issuingOrg: '공급업체 (장비·서비스 제공업체)',
    issuingMethod: '방문',
    cost: '무료',
    validity: '보통 30~90일',
    processingTime: '1~7일 (업체 요청 후)',
    description: '도입 예정 장비·시스템·서비스의 예상 비용을 공급업체로부터 받는 서류',
    purpose: '사업비 산정, 자부담 비율 계산, 지원금 규모 산정',
    steps: [
      '도입 예정 장비·서비스 공급업체 선정',
      '공급업체에 견적 요청 (품목·수량·규격 명시)',
      '사업자 명의 견적서 발급 요청',
    ],
    tips: [
      '견적서는 2~3개 업체에서 받아 비교하면 심사에 유리해요',
      '부가세 포함/제외 여부를 명시한 견적서를 받으세요',
      '공급업체 사업자등록번호·대표자 서명이 있어야 인정돼요',
    ],
    cautions: [
      '지인 업체 견적만 받으면 특혜 의심 받을 수 있어요 — 복수 견적 권장',
      '실제 구매 예정 업체의 견적서여야 해요 (허위 견적 금지)',
    ],
  },
  {
    id: 'lease-contract',
    name: '사업장 임대차계약서',
    category: '사업서류',
    issuingOrg: '임대인 (건물주)',
    issuingMethod: '자체작성',
    cost: '무료',
    validity: '계약 기간 중 유효',
    processingTime: '즉시 (계약 시 교부)',
    description: '사업장 사용 권한을 증명하는 계약서',
    purpose: '사업장 실재 확인, 지원금 후속 관리 주소 확인',
    steps: [
      '건물주(임대인)와 임대차계약 체결 시 사본 보관',
      '확정일자 받은 계약서면 더욱 공신력 있어요',
    ],
    tips: [
      '자가 소유 사업장은 건물등기부등본으로 대체 가능해요',
      '계약 기간이 지원사업 기간을 포함하는지 확인하세요',
    ],
    cautions: [
      '전차인 계약(재임대)이면 추가 확인이 필요해요',
      '주소가 사업자등록증과 동일해야 해요',
    ],
  },
  {
    id: 'factory-reg',
    name: '공장등록증',
    category: '사업서류',
    issuingOrg: '한국산업단지공단 / 시·군·구청',
    issuingMethod: '방문',
    cost: '무료',
    validity: '없음 (변경 시 갱신)',
    processingTime: '5~10일',
    description: '제조업 공장 설립 및 운영 사실을 증명하는 서류',
    purpose: '스마트공장, 제조업 특화 지원사업 신청 필수',
    steps: [
      '관할 시·군·구청 또는 산업단지 관리기관 방문',
      '공장등록 신청서 + 배치도·면적 서류 제출',
      '현장 확인 후 등록증 발급',
    ],
    tips: [
      '제조업 지원사업에서 자주 요구해요 — 미리 발급받아 두세요',
    ],
    cautions: [
      '제조업 영위 사업장만 해당돼요',
      '공장 이전·증설 시 반드시 변경 등록하세요',
    ],
    applicableTo: '제조업 전용',
  },
  {
    id: 'employment-contract',
    name: '근로계약서',
    category: '사업서류',
    issuingOrg: '자체 작성',
    issuingMethod: '자체작성',
    cost: '무료',
    validity: '계약 기간 중 유효',
    processingTime: '입사 즉시 작성',
    description: '고용 사실과 근로 조건(급여·시간·직무)을 명시하는 계약서',
    purpose: '고용 창출 지원사업, 청년 고용 확인, 인건비 지원 증빙',
    steps: [
      '고용노동부 표준 근로계약서 양식 다운로드',
      '근로자와 서명·날인 후 각 1부씩 보관',
    ],
    tips: [
      '표준 근로계약서 양식을 사용하면 법적 요건을 자동 충족해요',
      '인건비 지원 사업 신청 시 핵심 증빙 서류가 돼요',
    ],
    cautions: [
      '근로계약서 미작성은 노동법 위반이에요 — 입사 즉시 작성!',
      '계약직·아르바이트도 근로계약서가 필요해요',
    ],
    onlineUrl: 'https://www.moel.go.kr',
  },

  // ─── 특수서류 ──────────────────────────────────────────────────────────────
  {
    id: 'women-biz-cert',
    name: '여성기업 확인서',
    category: '특수서류',
    issuingOrg: '여성기업종합지원센터',
    issuingMethod: '온라인',
    cost: '무료',
    validity: '2년',
    processingTime: '1~2주',
    description: '여성이 실질적으로 소유·경영하는 기업임을 인증',
    purpose: '여성기업 우대 공공조달, 지원사업 가점 또는 우선 지원',
    steps: [
      '여성기업종합지원센터(wbiz.or.kr) 온라인 신청',
      '대표자·지분율 확인 서류 제출',
      '심사 후 1~2주 내 발급',
    ],
    tips: [
      '공공조달 우선구매 혜택이 있어요 — 해당되면 꼭 발급받으세요',
      '여성기업 전용 창업·경영 지원사업 혜택을 받을 수 있어요',
    ],
    cautions: [
      '여성 대표자가 지분 30% 이상 보유해야 해요',
    ],
    onlineUrl: 'https://www.wbiz.or.kr',
    applicableTo: '여성 대표 기업',
  },
  {
    id: 'disabled-biz-cert',
    name: '장애인기업 확인서',
    category: '특수서류',
    issuingOrg: '장애인기업종합지원센터',
    issuingMethod: '온라인',
    cost: '무료',
    validity: '2년',
    processingTime: '1~2주',
    description: '장애인이 경영하는 기업임을 공식 인증',
    purpose: '장애인기업 전용 지원사업, 공공조달 우선구매',
    steps: [
      '장애인기업종합지원센터(debc.or.kr) 신청',
      '장애인등록증 + 사업자 서류 제출',
    ],
    tips: [
      '장애인 기업 특화 지원사업이 생각보다 많아요 — 꼭 활용하세요',
    ],
    cautions: [
      '장애인 대표자 지분 30% 이상 필요',
    ],
    onlineUrl: 'https://www.debc.or.kr',
    applicableTo: '장애인 대표 기업',
  },
  {
    id: 'youth-biz-cert',
    name: '청년창업 확인서류 (대표자 주민등록등본)',
    category: '특수서류',
    issuingOrg: '주민센터 / 정부24',
    issuingMethod: '온라인',
    cost: '무료 (정부24)',
    validity: '3개월',
    processingTime: '즉시',
    description: '청년 기업주 나이 확인을 위한 주민등록등본',
    purpose: '청년창업 지원사업 (만 39세 이하 또는 만 34세 이하 등 기준)',
    steps: [
      '정부24(gov.kr) 로그인',
      '주민등록등본 발급 신청',
      '즉시 PDF 출력',
    ],
    tips: [
      '사업마다 청년 나이 기준이 달라요 (만 34세·39세·45세 등) — 공고문 필독',
      '정부24에서 24시간 무료 발급 가능해요',
    ],
    cautions: [
      '주민등록증 사본은 일반적으로 인정 안 해요 — 등본이나 초본을 발급하세요',
    ],
    onlineUrl: 'https://www.gov.kr',
    applicableTo: '청년창업 지원사업 신청 시',
  },
  {
    id: 'social-enterprise-cert',
    name: '사회적기업 인증서',
    category: '특수서류',
    issuingOrg: '고용노동부',
    issuingMethod: '온라인',
    cost: '무료',
    validity: '3년',
    processingTime: '2~4개월',
    description: '사회적기업육성법에 따라 사회적기업임을 인증하는 서류',
    purpose: '사회적기업 전용 지원사업, 세제 혜택, 공공조달 우선구매',
    steps: [
      '사회적기업 진흥원 또는 지역 고용센터를 통해 상담',
      '예비사회적기업 → 사회적기업 단계로 신청',
      '요건: 취약계층 고용, 사회서비스 제공 등',
    ],
    tips: [
      '인증 전 예비사회적기업으로 먼저 활동하면 인증이 유리해요',
      '인증 후 인건비 지원, 사업개발비 지원 등 혜택이 풍부해요',
    ],
    cautions: [
      '인증 요건이 까다로워요 — 전문 컨설팅을 받는 것이 좋아요',
      '영업이익의 2/3 이상을 사회적 목적에 사용해야 해요',
    ],
    applicableTo: '사회적기업',
  },
];

// ─── 헬퍼 함수 ───────────────────────────────────────────────────────────────

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  '기본서류',
  '재무서류',
  '인증서류',
  '사업서류',
  '특수서류',
];

export const CATEGORY_META: Record<DocumentCategory, { label: string; color: string; bg: string; emoji: string }> = {
  기본서류:  { label: '기본서류',  color: 'text-blue-700 dark:text-blue-300',   bg: 'bg-blue-100 dark:bg-blue-900/40',   emoji: '🏢' },
  재무서류:  { label: '재무서류',  color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-900/40', emoji: '💰' },
  인증서류:  { label: '인증서류',  color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/40', emoji: '🏅' },
  사업서류:  { label: '사업서류',  color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-100 dark:bg-orange-900/40', emoji: '📋' },
  특수서류:  { label: '특수서류',  color: 'text-rose-700 dark:text-rose-300',    bg: 'bg-rose-100 dark:bg-rose-900/40',   emoji: '⭐' },
};

export const METHOD_META: Record<IssuingMethod, { label: string; color: string }> = {
  온라인:      { label: '온라인 발급',   color: 'text-green-600 dark:text-green-400' },
  방문:        { label: '방문 발급',     color: 'text-orange-600 dark:text-orange-400' },
  자체작성:    { label: '자체 작성',     color: 'text-blue-600 dark:text-blue-400' },
  '온라인+방문': { label: '온라인·방문', color: 'text-purple-600 dark:text-purple-400' },
};
