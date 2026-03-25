import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://subsidy-finder-pied.vercel.app';

  // 정적 페이지
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  // 공개 지원사업 페이지 동적 생성
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: programs } = await supabase
      .from('programs')
      .select('id, created_at, status')
      .in('status', ['open', 'upcoming', 'always', 'expected'])
      .order('created_at', { ascending: false })
      .limit(500);

    const programPages: MetadataRoute.Sitemap = (programs ?? []).map(p => ({
      url: `${baseUrl}/p/${p.id}`,
      lastModified: new Date(p.created_at),
      changeFrequency: p.status === 'open' ? 'daily' : 'weekly',
      priority: p.status === 'open' ? 0.9 : 0.7,
    }));

    return [...staticPages, ...programPages];
  } catch {
    return staticPages;
  }
}
