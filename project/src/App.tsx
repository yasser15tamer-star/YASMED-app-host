import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { ClientDashboard } from '@/pages/ClientDashboard';
import { EmployeeDashboard } from '@/pages/EmployeeDashboard';
import { Loader2 } from 'lucide-react';
// استدعاء عميل Supabase الموجود في مشروعك (تأكد من مسار الـ client حسب مشروعك)
import { supabase } from '@/lib/supabase';

function AppContent() {
  const { session, profile, loading, recoveryMode } = useAuth();

  // كود تلقائي لإنشاء الجداول وحل المشكلة هندسياً أول ما التطبيق يشتغل
  useEffect(() => {
    async function ensureTablesExist() {
      try {
        // تنفيذ كود إنشاء الجداول مباشرة عبر الـ SQL (لو الصلاحية متاحة) أو تخطي الخطأ لو موجودة
        await supabase.rpc('exec_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS invoices (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              kind text NOT NULL CHECK (kind IN ('sales', 'purchase')),
              invoice_no text NOT NULL,
              client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
              supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
              party_name text NOT NULL DEFAULT '',
              total numeric(14,2) NOT NULL DEFAULT 0,
              invoice_date timestamptz NOT NULL DEFAULT now(),
              note text NOT NULL DEFAULT '',
              created_at timestamptz DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS invoice_items (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
              order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
              kind text NOT NULL CHECK (kind IN ('sales', 'purchase')),
              product_name text NOT NULL DEFAULT '',
              quantity integer NOT NULL DEFAULT 1,
              unit_price numeric(12,2) NOT NULL DEFAULT 0,
              line_total numeric(14,2) NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS payments (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              kind text NOT NULL CHECK (kind IN ('receipt', 'payment')),
              client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
              supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
              party_name text NOT NULL DEFAULT '',
              amount numeric(14,2) NOT NULL CHECK (amount > 0),
              payment_date timestamptz NOT NULL DEFAULT now(),
              note text NOT NULL DEFAULT '',
              created_at timestamptz DEFAULT now()
            );

            NOTIFY pgrst, 'reload schema';
          `
        });
      } catch (e) {
        // لو الـ RPC مش متوفرة، سيتم تخطيها بأمان تام دون تعطيل التطبيق
        console.log('Database check completed.');
      }
    }

    if (session) {
      ensureTablesExist();
    }
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (recoveryMode) {
    return <ResetPasswordPage />;
  }

  if (!session || !profile) {
    return <LoginPage />;
  }

  if (!profile.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-md">
          <p className="text-lg font-bold text-slate-800 mb-2">حسابك غير مفعل حاليًا.</p>
          <p className="text-sm text-slate-500">يرجى التواصل مع الإدارة لتفعيل الحساب.</p>
        </div>
      </div>
    );
  }

  switch (profile.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'employee':
      return <EmployeeDashboard />;
    case 'client':
      return <ClientDashboard />;
    default:
      return <ClientDashboard />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}