import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

let browserClient: ReturnType<typeof createSupabaseBrowser> | null = null;

export function getSupabaseBrowser() {
  if (!browserClient) {
    browserClient = createSupabaseBrowser();
  }
  return browserClient;
}
