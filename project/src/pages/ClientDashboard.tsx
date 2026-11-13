import { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardShell, type NavItem } from '@/components/DashboardShell';
import { ClientHome } from '@/pages/client/ClientHome';
import { ClientComparison } from '@/pages/client/ClientComparison';
import { ClientCart } from '@/pages/client/ClientCart';
import { ClientOrders } from '@/pages/client/ClientOrders';
import { ClientAccount } from '@/pages/client/ClientAccount';
import { ClientUpload } from '@/pages/client/ClientUpload';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Home, Search, ShoppingCart, ReceiptText, User, FileSpreadsheet } from 'lucide-react';

export function ClientDashboard() {
  const { profile } = useAuth();
  const [activePage, setActivePage] = useState('home');
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    if (!profile) return;
    const { count } = await supabase.from('cart_items').select('*', { count: 'exact', head: true }).eq('client_id', profile.id).eq('status', 'active');
    setCartCount(count || 0);
  }, [profile]);

  useEffect(() => { fetchCartCount(); }, [fetchCartCount]);

  // فلترة عناصر القائمة بناءً على نوع النشاط (الصيدلية مش هيظهر لها رفع ملفات الإكسيل)
  const clientNavItems = useMemo<NavItem[]>(() => {
    const businessType = profile?.business_type || '';
    // لو النشاط مش صيدلية (يعني مخزن جملة أو قطاعي)، نظهر له زرار رفع الإكسيل
    const isPharmacy = businessType.includes('صيدلية') || businessType.toLowerCase().includes('pharmacy');

    const items: NavItem[] = [
      { key: 'home', label: 'الرئيسية', icon: Home },
      { key: 'comparison', label: 'مركز مقارنة الموردين', icon: Search },
      { key: 'cart', label: 'السلة', icon: ShoppingCart },
      { key: 'orders', label: 'طلباتي', icon: ReceiptText },
    ];

    // لو مش صيدلية (مخزن جملة/قطاعي)، بنضيف زرار رفع ملفات الإكسيل
    if (!isPharmacy) {
      items.push({ key: 'upload', label: 'إرسال ملفات الإكسيل', icon: FileSpreadsheet });
    }

    items.push({ key: 'account', label: 'الحساب', icon: User });

    return items;
  }, [profile?.business_type]);

  const renderPage = () => {
    switch (activePage) {
      case 'home': return <ClientHome onNavigate={setActivePage} cartCount={cartCount} />;
      case 'comparison': return <ClientComparison onCartUpdate={fetchCartCount} />;
      case 'cart': return <ClientCart onCartUpdate={fetchCartCount} />;
      case 'orders': return <ClientOrders />;
      case 'upload': return <ClientUpload />;
      case 'account': return <ClientAccount />;
      default: return <ClientHome onNavigate={setActivePage} cartCount={cartCount} />;
    }
  };

  return (
    <DashboardShell items={clientNavItems} activeKey={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </DashboardShell>
  );
}