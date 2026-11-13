import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/Badge';
import { supabase, type Order } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  Loader2, Pill, ReceiptText, CalendarDays, Clock, ChevronDown, XCircle, AlertCircle
} from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ClientOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openOrders, setOpenOrders] = useState<string[]>([]);
  const toggleOrder = (key: string) =>
    setOpenOrders(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  const [confirmCancelKey, setConfirmCancelKey] = useState<string | null>(null);
  const [cancellingKey, setCancellingKey] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data: orderData, error } = await supabase.from('orders').select('*').eq('client_id', profile.id).order('created_at', { ascending: false });
    if (error) setError('فشل في تحميل الطلبات');
    else setOrders(orderData || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleCancelOrder = async (key: string, ids: string[]) => {
    if (!profile || ids.length === 0) return;
    setCancellingKey(key); setCancelError(null);
    const { data: cancelledCount, error } = await supabase.rpc('client_cancel_orders', { p_order_ids: ids });
    if (error || !cancelledCount) {
      setCancelError('تعذّر إلغاء الطلب، ممكن الإدارة بدأت تتعامل معاه');
    } else {
      setConfirmCancelKey(null);
      await fetchOrders();
    }
    setCancellingKey(null);
  };

  const statusLabels: Record<string, string> = {
    pending: 'قيد الانتظار', processing: 'قيد المعالجة', completed: 'مكتمل', cancelled: 'ملغي',
  };
  const statusBadgeMap: Record<string, 'found' | 'similar' | 'not_found' | 'default'> = {
    pending: 'similar', processing: 'default', completed: 'found', cancelled: 'not_found',
  };

  const orderGroups = (() => {
    const map = new Map<string, Order[]>();
    orders.forEach(o => {
      const list = map.get(o.created_at) || [];
      list.push(o);
      map.set(o.created_at, list);
    });
    const oldestFirst = Array.from(map.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    return oldestFirst
      .map(([createdAt, items], idx) => {
        const statuses = items.map(i => i.status);
        const groupStatus =
          statuses.every(st => st === 'cancelled') ? 'cancelled'
          : statuses.every(st => st === 'completed' || st === 'cancelled') ? 'completed'
          : statuses.some(st => st === 'processing' || st === 'completed') ? 'processing'
          : 'pending';
        return {
          createdAt,
          number: idx + 1,
          items,
          groupStatus,
          total: items.reduce((sum, i) => sum + i.final_price * i.quantity, 0),
          qty: items.reduce((sum, i) => sum + i.quantity, 0),
        };
      })
      .reverse();
  })();

  return (
    <div className="pb-32 lg:pb-0">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-800 text-white shadow-lg shadow-blue-600/30 ring-4 ring-blue-50">
            <ReceiptText className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">طلباتي</h2>
            <p className="mt-0.5 text-sm text-slate-500">تابع حالة طلباتك السابقة وتفاصيلها</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : orderGroups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-gradient-to-b from-white to-slate-50 px-6 py-20 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 ring-8 ring-blue-50/50">
            <ReceiptText className="h-10 w-10 text-blue-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-800">لا توجد طلبات سابقة</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            الطلبات التي ستؤكدها من السلة ستظهر هنا.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orderGroups.map(group => {
            const d = new Date(group.createdAt);
            const isOpen = openOrders.includes(group.createdAt);
            const pendingIds = group.items.filter(i => i.status === 'pending').map(i => i.id);
            const confirming = confirmCancelKey === group.createdAt;
            const cancelled = group.groupStatus === 'cancelled';
            return (
              <div
                key={group.createdAt}
                className={`overflow-hidden rounded-3xl border bg-white transition-all duration-200 ${isOpen ? 'border-blue-300 shadow-lg shadow-blue-500/10' : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'}`}
              >
                <button
                  type="button"
                  onClick={() => toggleOrder(group.createdAt)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-4 py-4 text-right transition hover:bg-slate-50/70 sm:gap-4 sm:px-5"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-800 text-white shadow-md shadow-blue-600/25">
                    <ReceiptText className="h-5 w-5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-base font-extrabold text-slate-900">
                        طلب رقم <span dir="ltr" className="inline-block tabular-nums text-blue-700">#{String(group.number).padStart(4, '0')}</span>
                      </span>
                      <Badge status={statusBadgeMap[group.groupStatus]}>{statusLabels[group.groupStatus]}</Badge>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {d.toLocaleDateString('ar-EG')}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="font-semibold text-slate-600">{group.items.length} صنف · {group.qty} قطعة</span>
                    </span>
                  </span>

                  <span className="shrink-0 text-left">
                    <span className="block text-[11px] font-semibold text-slate-400">إجمالي الطلب</span>
                    <span className={`block text-lg font-extrabold tabular-nums sm:text-xl ${cancelled ? 'text-slate-400 line-through' : 'text-blue-700'}`}>{fmt(group.total)} <span className="text-xs font-bold text-blue-500">ج.م</span></span>
                  </span>

                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${isOpen ? 'rotate-180 border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-400'}`}>
                    <ChevronDown className="h-5 w-5" />
                  </span>
                </button>

                <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    <div className="divide-y divide-slate-100 border-t border-slate-100">
                      {group.items.map(order => (
                        <div key={order.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Pill className="h-5 w-5" /></div>
                            <div className="min-w-0">
                              <p className="text-sm font-extrabold leading-snug text-slate-900">{order.product_name}</p>
                              <p className="mt-1 text-xs text-slate-500">المورد: {order.supplier_alias} · الكمية: {order.quantity}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-left">
                            <p className="text-sm font-extrabold tabular-nums text-slate-900">{fmt(order.final_price * order.quantity)} ج.م</p>
                            <p dir="ltr" className="mt-0.5 text-[11px] tabular-nums text-slate-400">{fmt(order.final_price)} × {order.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {pendingIds.length > 0 && (
                      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
                        {confirming ? (
                          <div className="space-y-3">
                            <p className="flex items-center gap-2 text-sm font-bold text-red-700">
                              <AlertCircle className="h-4 w-4 shrink-0" /> متأكد إنك عايز تلغي الطلب ده؟
                            </p>
                            {cancelError && <p className="text-xs font-semibold text-red-600">{cancelError}</p>}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleCancelOrder(group.createdAt, pendingIds)}
                                disabled={cancellingKey === group.createdAt}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-extrabold text-white shadow-md shadow-red-600/25 transition hover:bg-red-700 disabled:opacity-60 sm:flex-none sm:px-6"
                              >
                                {cancellingKey === group.createdAt ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                نعم، إلغاء الطلب
                              </button>
                              <button
                                onClick={() => { setConfirmCancelKey(null); setCancelError(null); }}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
                              >
                                رجوع
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-slate-500">تقدر تلغي الطلب طالما هو قيد الانتظار</p>
                            <button
                              onClick={() => { setConfirmCancelKey(group.createdAt); setCancelError(null); }}
                              className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-extrabold text-red-600 transition hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" /> إلغاء الطلب
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}