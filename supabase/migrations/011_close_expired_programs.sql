-- ──────────────────────────────────────────────────────────────
-- 011: 만료된 지원사업 status → 'closed' 일괄 업데이트
-- ──────────────────────────────────────────────────────────────

-- 1) application_end 가 현재일 이전인 사업 닫기
UPDATE programs
SET status = 'closed'
WHERE application_end < CURRENT_DATE
  AND status NOT IN ('closed', 'expected');

-- 2) application_end 없는데 제목에 지난 연도 포함된 사업 닫기
--    예: "2025년도 스마트공장 구축 지원", "2024년도 수출바우처" 등
UPDATE programs
SET status = 'closed'
WHERE application_end IS NULL
  AND status = 'open'
  AND (
    title ILIKE '%2020년도%' OR title ILIKE '%2021년도%' OR
    title ILIKE '%2022년도%' OR title ILIKE '%2023년도%' OR
    title ILIKE '%2024년도%' OR title ILIKE '%2025년도%'
  );
