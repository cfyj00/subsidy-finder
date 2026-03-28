'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { Eye, EyeOff, Loader2 } from 'lucide-react';


function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // 저장된 이메일 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('saved_email');
    if (saved) {
      setEmail(saved);
      setRememberEmail(true);
    }
    const msg = searchParams.get('message');
    if (msg === 'confirmed') setMessage('이메일 인증이 완료되었습니다. 로그인해 주세요.');
    if (msg === 'signout') setMessage('로그아웃 되었습니다.');
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError('Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // 아이디 기억 처리
    if (rememberEmail) {
      localStorage.setItem('saved_email', email);
    } else {
      localStorage.removeItem('saved_email');
    }
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">로그인</h2>

      {/* Google 소셜 로그인 */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors mb-4 disabled:opacity-60"
      >
        {googleLoading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M47.5 24.5C47.5 22.6 47.3 20.8 47 19H24V29.5H37.2C36.6 32.5 34.8 35 32.1 36.7V43.3H40.1C44.7 39.1 47.5 32.3 47.5 24.5Z" fill="#4285F4"/>
            <path d="M24 48C30.6 48 36.1 45.8 40.1 43.3L32.1 36.7C29.9 38.1 27.2 39 24 39C17.6 39 12.2 34.8 10.2 29.1H2V35.9C5.9 43.7 14.3 48 24 48Z" fill="#34A853"/>
            <path d="M10.2 29.1C9.7 27.7 9.5 26.2 9.5 24.5C9.5 22.8 9.8 21.3 10.2 19.9V13.1H2C0.7 15.9 0 19.1 0 24.5C0 29.9 0.7 33.1 2 35.9L10.2 29.1Z" fill="#FBBC05"/>
            <path d="M24 10C27.5 10 30.6 11.2 33 13.5L40.3 6.2C36.1 2.3 30.6 0 24 0C14.3 0 5.9 4.3 2 12.1L10.2 18.9C12.2 13.2 17.6 10 24 10Z" fill="#EA4335"/>
          </svg>
        )}
        Google로 로그인
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
        <span className="text-xs text-gray-400 dark:text-gray-500">또는 이메일로 로그인</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
      </div>

      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이메일</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">비밀번호</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full px-4 py-2.5 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {/* 아이디 기억 + 비밀번호 찾기 */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={e => setRememberEmail(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">아이디 기억</span>
          </label>
          <Link href="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-700">
            비밀번호 찾기
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> 로그인 중...</> : '로그인'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        계정이 없으신가요?{' '}
        <Link href="/signup" className="text-indigo-600 hover:text-indigo-700 font-medium">회원가입</Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center py-4 text-gray-400 text-sm">로딩 중...</div>}>
      <LoginForm />
    </Suspense>
  );
}
