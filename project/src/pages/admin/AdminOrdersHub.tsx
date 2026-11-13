import { useState } from 'react';
import { AdminOrders } from '@/pages/admin/AdminOrders';
import { AdminSales } from '@/pages/admin/AdminSales';
import { AdminPurchases } from '@/pages/admin/AdminPurchases';
import { ShoppingCart, Receipt, Truck } from 'lucide-react';

type Tab = 'orders' | 'sales' | 'purchases';

const tabs = [
  { key: 'orders' as Tab, label: 'الطلبات', icon: ShoppingCart },
  { key: 'sales' as Tab, label: 'المبيعات', icon: Receipt },
  { key: 'purchases' as Tab, label: 'المشتريات', icon: Truck },
];

export function AdminOrdersHub() {
  const [tab, setTab] = useState<Tab>('orders');

  return (
    <div>
      <div className="flex gap-1 p-1.5 mb-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm w-fit max-w-full overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                tab === t.key ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'orders' && <AdminOrders />}
      {tab === 'sales' && <AdminSales />}
      {tab === 'purchases' && <AdminPurchases />}
    </div>
  );
}