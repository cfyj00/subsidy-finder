'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const pwChecks = {
    length:  password.length >= 8,
    upper:   /[A-Z]/.test(password),
    number:  /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const pwStrength = Object.values(pwChecks).filter(Boolean).length;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    if (!pwChecks.length)  { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (!pwChecks.upper)   { setError('비밀번호에 대문자(A-Z)를 1개 이상 포함해 주세요.'); return; }
    if (!pwChecks.number)  { setError('비밀번호에 숫자를 1개 이상 포함해 주세요.'); return; }
    if (!pwChecks.special) { setError('비밀번호에 특수문자(!@#$ 등)를 1개 이상 포함해 주세요.'); return; }
    setLoading(true);
    setError('');
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message === 'User already registered' ? '이미 가입된 이메일입니다.' : '가입 중 오류가 발생했습니다.');
      setLoading(false);
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-4">📧</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">이메일을 확인해 주세요</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          <strong>{email}</strong>로 인증 링크를 보냈습니다.<br />
          메일함을 확인하고 링크를 클릭해 주세요.
        </p>
        <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium text-sm">
          로그인으로 이동 →
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">회원가입</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름 (선택)</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="홍길동"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이메일 <span className="text-red-500">*</span></label>
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">비밀번호 <span className="text-red-500">*</span></label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="8자 이상, 대문자·숫자·특수문자 포함"
              className="w-full px-4 py-2.5 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {/* 비밀번호 강도 표시 */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1,2,3,4].map(n => (
                  <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${pwStrength >= n
                    ? pwStrength <= 1 ? 'bg-red-400' : pwStrength <= 2 ? 'bg-amber-400' : pwStrength <= 3 ? 'bg-blue-400' : 'bg-emerald-500'
                    : 'bg-gray-200 dark:bg-slate-600'
                  }`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                <span className={pwChecks.length  ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}>✓ 8자 이상</span>
                <span className={pwChecks.upper   ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}>✓ 대문자</span>
                <span className={pwChecks.number  ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}>✓ 숫자</span>
                <span className={pwChecks.special ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}>✓ 특수문자</span>
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">비밀번호 확인 <span className="text-red-500">*</span></label>
          <input
            type="password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="비밀번호 재입력"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> 가입 중...</> : '가입하기'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">로그인</Link>
      </p>
    </>
  );
}
