export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur mb-3">
            <span className="text-2xl">🤝</span>
          </div>
          <h1 className="text-2xl font-bold text-white">지실장</h1>
          <p className="text-indigo-300 text-sm mt-1">정부지원 사업엔, 함께가요 지실장!</p>
        </div>
        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
