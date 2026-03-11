/**
 * GET /api/naver-news?q=검색어&display=5
 *
 * 네이버 뉴스 검색 API 서버사이드 프록시.
 * 클라이언트에 API 키를 노출하지 않기 위해 서버에서 중계합니다.
 */

import { NextResponse } from 'next/server';

// HTML 태그 및 HTML 엔티티 제거
function stripHtml(str: string): string {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .trim();
}

export interface NaverNewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;   // "Mon, 10 Mar 2026 09:00:00 +0900"
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query   = searchParams.get('q')?.trim();
  const display = Math.min(Number(searchParams.get('display') ?? '5'), 10);

  if (!query) {
    return NextResponse.json({ items: [] });
  }

  const clientId     = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: '네이버 API 키 미설정', items: [] }, { status: 503 });
  }

  try {
    // "정부지원사업" 키워드를 자동으로 붙여서 관련도 높은 뉴스만 가져옴
    const enhancedQuery = `정부지원사업 ${query}`;
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(enhancedQuery)}&display=${display}&sort=date`;

    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id':     clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      // 캐시: 10분
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Naver API error: ${res.status}`, items: [] }, { status: res.status });
    }

    const data = await res.json();
    const items: NaverNewsItem[] = (data.items ?? []).map((item: {
      title: string;
      link: string;
      originallink?: string;
      description: string;
      pubDate: string;
    }) => ({
      title:       stripHtml(item.title),
      link:        item.originallink || item.link,
      description: stripHtml(item.description),
      pubDate:     item.pubDate,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error('[naver-news]', err);
    return NextResponse.json({ error: '뉴스 검색 실패', items: [] }, { status: 500 });
  }
}
