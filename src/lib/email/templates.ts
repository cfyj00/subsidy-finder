/**
 * 이메일 HTML 템플릿 모음
 */

export interface DeadlineEmailData {
  programTitle: string;
  daysLeft: number;
  applicationEnd: string; // YYYY-MM-DD
  programUrl: string;     // 상세 페이지 URL
  appUrl: string;         // 앱 기본 URL
  isBookmark: boolean;    // true=북마크, false=진행중 지원
}

export function buildDeadlineEmailHtml(data: DeadlineEmailData): string {
  const {
    programTitle,
    daysLeft,
    applicationEnd,
    programUrl,
    appUrl,
    isBookmark,
  } = data;

  const emoji   = daysLeft === 1 ? '🚨' : daysLeft === 3 ? '⏰' : '📅';
  const urgency = daysLeft === 1 ? '오늘이 마지막 기회입니다!' : `${daysLeft}일 남았습니다.`;
  const context = isBookmark
    ? '북마크한 지원사업의 마감이 임박했습니다.'
    : '진행 중인 지원사업의 마감이 임박했습니다.';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>마감 D-${daysLeft} 알림 — 지실장</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Apple SD Gothic Neo',Malgun Gothic,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

          <!-- 헤더 -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:28px 36px;text-align:center;">
              <p style="margin:0;color:#c7d2fe;font-size:13px;letter-spacing:.05em;">지실장 · 정부지원사업 도우미</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;font-weight:700;">
                ${emoji} 마감 D-${daysLeft}
              </h1>
            </td>
          </tr>

          <!-- 본문 -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 6px;color:#64748b;font-size:13px;">${context}</p>
              <h2 style="margin:0 0 20px;color:#1e293b;font-size:18px;font-weight:700;line-height:1.4;">
                ${programTitle}
              </h2>

              <!-- 마감 배지 -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:${daysLeft === 1 ? '#fef2f2' : '#fffbeb'};border:1px solid ${daysLeft === 1 ? '#fca5a5' : '#fcd34d'};border-radius:8px;padding:12px 20px;">
                    <span style="color:${daysLeft === 1 ? '#dc2626' : '#d97706'};font-size:15px;font-weight:600;">
                      신청 마감: ${applicationEnd} · ${urgency}
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7;">
                ${isBookmark
                  ? '관심 있으신 지원사업의 마감이 다가왔습니다. 지금 바로 지실장에서 자격 요건을 확인하고 신청 준비를 완료하세요.'
                  : '준비하고 계신 지원사업의 마감이 다가왔습니다. 서류를 최종 점검하고 기한 내에 제출을 완료하세요.'}
              </p>

              <!-- CTA 버튼 -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#4f46e5;border-radius:10px;">
                    <a href="${programUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      ${isBookmark ? '지원사업 확인하기 →' : '신청 현황 보기 →'}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 구분선 -->
          <tr>
            <td style="padding:0 36px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" />
            </td>
          </tr>

          <!-- 푸터 -->
          <tr>
            <td style="padding:20px 36px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                이 메일은 지실장(${appUrl})에서 북마크하거나 진행 중인 지원사업의<br/>
                마감 알림으로 자동 발송됩니다.<br/>
                알림을 끄려면 앱 내 설정 → 알림 관리에서 변경하세요.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildDeadlineEmailText(data: DeadlineEmailData): string {
  return `[지실장] 마감 D-${data.daysLeft} 알림

${data.programTitle}

신청 마감: ${data.applicationEnd}
마감까지 ${data.daysLeft}일 남았습니다.

지금 바로 확인하세요: ${data.programUrl}

---
지실장 · 정부지원사업 도우미
${data.appUrl}
`;
}
