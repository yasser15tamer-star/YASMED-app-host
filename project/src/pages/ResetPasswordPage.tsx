import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Lock, CheckCircle2 } from 'lucide-react';

export function ResetPasswordPage() {
  const { completePasswordRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('كلمة السر يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (password !== confirm) {
      setError('كلمتا السر غير متطابقتين');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError('تعذّر تغيير كلمة السر، حاول طلب رابط جديد من صفحة الدخول');
      return;
    }
    setDone(true);
  };

  const finish = async () => {
    await signOut();
    completePasswordRecovery();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl shadow-black/10 border border-sky-500/10 p-6">
        {done ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-800">تم تغيير كلمة السر بنجاح</h2>
            <p className="text-sm text-slate-500">يمكنك الآن تسجيل الدخول بكلمة السر الجديدة.</p>
            <Button type="button" size="lg" className="w-full bg-[#0b7ae0] hover:bg-[#0a68c4] text-white" onClick={finish}>
              الذهاب لتسجيل الدخول
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-800">تعيين كلمة سر جديدة</h2>
              <p className="text-sm text-slate-500">اكتب كلمة السر الجديدة للحساب.</p>
            </div>

            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="كلمة السر الجديدة"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-10 pl-4 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="تأكيد كلمة السر"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-10 pl-4 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                required
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full bg-[#0b7ae0] hover:bg-[#0a68c4] text-white shadow-lg shadow-sky-500/25" disabled={loading}>
              {loading ? 'جارٍ الحفظ...' : 'حفظ كلمة السر'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
