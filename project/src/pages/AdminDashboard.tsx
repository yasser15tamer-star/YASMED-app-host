import { useState } from 'react';
import { DashboardShell, type NavItem } from '@/components/DashboardShell';
import { AdminHome } from '@/pages/admin/AdminHome';
import { WholesaleSuppliers } from '@/pages/admin/WholesaleSuppliers';
import { RetailSuppliers } from '@/pages/admin/RetailSuppliers';
import { PharmacySuppliers } from '@/pages/admin/PharmacySuppliers';
import { AdminComparison } from '@/pages/admin/AdminComparison';
import { AdminOrdersHub } from '@/pages/admin/AdminOrdersHub';
import { AdminClientManagement } from '@/pages/admin/AdminClientManagement';
import { AdminEmployeeManagement } from '@/pages/admin/AdminEmployeeManagement';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { AdminClientSheets } from '@/pages/admin/AdminClientSheets';
import { Home, ShoppingCart, Users, Briefcase, Settings, FileSpreadsheet, Layers, Store, Building2, Pill } from 'lucide-react';

// عناصر القائمة للأدمن متوافقة مع الـ GROUPS الموجودة في الـ Sidebar
const adminNavItems: NavItem[] = [
  { key: 'home', label: 'الرئيسية', icon: Home },
  { key: 'comparison-comprehensive', label: 'مقارنة الأسعار الشاملة', icon: Layers },
  { key: 'wholesale-suppliers', label: 'مخازن وموردين الجملة', icon: Building2 },
  { key: 'retail-suppliers', label: 'مخازن وموردين القطاعي', icon: Store },
  { key: 'pharmacy-suppliers', label: 'مخازن وموردين الصيدليات', icon: Pill },
  { key: 'client-sheets', label: 'شيتات العملاء', icon: FileSpreadsheet },
  { key: 'orders', label: 'الطلبات', icon: ShoppingCart },
  { key: 'clients', label: 'إدارة العملاء', icon: Users },
  { key: 'employees', label: 'إدارة الموظفين', icon: Briefcase },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
];

export function AdminDashboard() {
  const [activePage, setActivePage] = useState('home');

  const renderPage = () => {
    switch (activePage) {
      case 'home': return <AdminHome />;
      case 'comparison-comprehensive': return <AdminComparison />;
      case 'wholesale-suppliers': return <WholesaleSuppliers />;
      case 'retail-suppliers': return <RetailSuppliers />;
      case 'pharmacy-suppliers': return <PharmacySuppliers />;
      case 'client-sheets': return <AdminClientSheets />;
      case 'orders': return <AdminOrdersHub />;
      case 'clients': return <AdminClientManagement />;
      case 'employees': return <AdminEmployeeManagement />;
      case 'settings': return <AdminSettings />;
      default: return <AdminHome />;
    }
  };

  return (
    <DashboardShell items={adminNavItems} activeKey={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </DashboardShell>
  );
}