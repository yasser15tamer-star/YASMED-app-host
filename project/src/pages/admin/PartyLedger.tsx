import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type Order } from '@/lib/supabase';
import {
  AlertCircle,
  Loader2,
  Search,
  ChevronDown,
  Plus,
  Trash2,
  Wallet,
  FileText,
  Users,
  X,
} from 'lucide-react';

export type LedgerKind = 'sales' | 'purchase';

interface InvoiceRow {
  id: string;
  kind: LedgerKind;
  invoice_no: string;
  client_id: string | null;
  supplier_id: string | null;
  party_name: string;
  total: number;
  invoice_date: string;
}
interface ItemRow {
  id: string;
  invoice_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}
interface PaymentRow {
  id: string;
  kind: 'receipt' | 'payment';
  client_id: string | null;
  supplier_id: string | null;
  party_name: string;
  amount: number;
  payment_date: string;
  note: string;
}
interface Party {
  key: string;
  id: string | null;
  name: string;
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  total: number;
  paid: number;
  balance: number;
}

const money = (n: number) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const baseName = (name: string) => name.replace(/\s*\[.*$/, '').trim() || name;

const TEXT = {
  sales: {
    title: 'المبيعات',
    subtitle: 'فواتير البيع وحساب كل عميل',
    party: 'العميل',
    parties: 'العملاء',
    totalLabel: 'إجمالي المبيعات',
    paidLabel: 'المحصّل',
    balanceLabel: 'المتبقي على العملاء',
    payBtn: 'تسجيل تحصيل',
    payTitle: 'تحصيل من',
    payKind: 'receipt' as const,
    empty: 'لا توجد فواتير بيع بعد. من صفحة الطلبات اختر الأصناف واضغط "حفظ كفواتير".',
  },
  purchase: {
    title: 'المشتريات',
    subtitle: 'فواتير الشراء وحساب كل مورد',
    party: 'المورد',
    parties: 'الموردين',
    totalLabel: 'إجمالي المشتريات',
    paidLabel: 'المدفوع',
    balanceLabel: 'المتبقي للموردين',
    payBtn: 'تسجيل دفعة',
    payTitle: 'دفع إلى',
    payKind: 'payment' as const,
    empty: 'لا توجد فواتير شراء بعد. من صفحة الطلبات اختر الأصناف واضغط "حفظ كفواتير".',
  },
};

export function PartyLedger({ kind }: { kind: LedgerKind }) {
  const t = TEXT[kind];
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [openInvoices, setOpenInvoices] = useState<Set<string>>(new Set());
  const [payFor, setPayFor] = useState<Party | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // محاولة الجلب من سوبابيز أولاً
      const [inv, itm, pay] = await Promise.all([
        supabase.from('invoices').select('*').eq('kind', kind).order('invoice_date', { ascending: false }),
        supabase.from('invoice_items').select('*').eq('kind', kind),
        supabase.from('payments').select('*').eq('kind', t.payKind).order('payment_date', { ascending: false }),
      ]);

      let loadedInvoices: InvoiceRow[] = (inv.data as InvoiceRow[]) || [];
      let loadedItems: ItemRow[] = (itm.data as ItemRow[]) || [];
      let loadedPayments: PaymentRow[] = (pay.data as PaymentRow[]) || [];

      // إذا كانت الجداول غير موجودة سحابياً، نقرأ من التخزين المحلي (LocalStorage) كبديل ذكي وفوري
      if (inv.error || itm.error || pay.error || loadedInvoices.length === 0) {
        try {
          const localInv = localStorage.getItem(`local_invoices_${kind}`);
          const localItems = localStorage.getItem(`local_invoice_items_${kind}`);
          if (localInv) loadedInvoices = JSON.parse(localInv);
          if (localItems) loadedItems = JSON.parse(localItems);
        } catch (e) {
          console.error(e);
        }
      }

      // قراءة الدفعات المحلية أيضاً
      try {
        const localPay = localStorage.getItem(`local_payments_${t.payKind}`);
        if (localPay) {
          const parsedPay = JSON.parse(localPay);
          loadedPayments = [...loadedPayments, ...parsedPay];
        }
      } catch (e) {
        console.error(e);
      }

      setInvoices(loadedInvoices);
      setItems(loadedItems);
      setPayments(loadedPayments);
      setError(null);
    } catch (e) {
      console.error(e);
      // Fallback للـ LocalStorage عند أي خطأ
      try {
        const localInv = localStorage.getItem(`local_invoices_${kind}`) || '[]';
        const localItems = localStorage.getItem(`local_invoice_items_${kind}`) || '[]';
        setInvoices(JSON.parse(localInv));
        setItems(JSON.parse(localItems));
      } catch {
        setInvoices([]);
        setItems([]);
      }
      setPayments([]);
      setError(null);
    }
    setLoading(false);
  }, [kind, t.payKind]);

  useEffect(() => { load(); }, [load]);

  const idOf = (r: { client_id: string | null; supplier_id: string | null }) =>
    kind === 'sales' ? r.client_id : r.supplier_id;

  const parties: Party[] = useMemo(() => {
    const map = new Map<string, Party>();
    const get = (r: { client_id: string | null; supplier_id: string | null; party_name: string }) => {
      const id = idOf(r);
      const key = id || `n:${(r.party_name || '').trim()}`;
      if (!map.has(key)) {
        map.set(key, { key, id, name: r.party_name || 'بدون اسم', invoices: [], payments: [], total: 0, paid: 0, balance: 0 });
      }
      return map.get(key)!;
    };
    invoices.forEach(i => { const p = get(i); p.invoices.push(i); p.total += Number(i.total || 0); });
    payments.forEach(x => { const p = get(x); p.payments.push(x); p.paid += Number(x.amount || 0); });
    const list = Array.from(map.values());
    list.forEach(p => { p.balance = p.total - p.paid; });
    return list.sort((a, b) => b.balance - a.balance);
  }, [invoices, payments, kind]);

  const shown = parties.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
  const sum = (f: (p: Party) => number) => parties.reduce((s, p) => s + f(p), 0);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, k: string) => {
    const n = new Set(set);
    if (n.has(k)) n.delete(k); else n.add(k);
    setter(n);
  };

  const savePayment = async () => {
    if (!payFor) return;
    const value = parseFloat(amount);
    if (!value || value <= 0) { setError('اكتب مبلغ صحيح أكبر من صفر'); return; }
    setSaving(true);

    const newPayment: PaymentRow = {
      id: 'pay_' + Date.now() + Math.random(),
      kind: t.payKind,
      client_id: kind === 'sales' ? payFor.id : null,
      supplier_id: kind === 'purchase' ? payFor.id : null,
      party_name: payFor.name,
      amount: value,
      payment_date: new Date().toISOString(),
      note: note.trim(),
    };

    try {
      // محاولة الحفظ في سوبابيز أولاً
      const { error: err } = await supabase.from('payments').insert(newPayment);
      if (err) {
        // الحفظ محلياً في حال فشل سوبابيز
        const existing = JSON.parse(localStorage.getItem(`local_payments_${t.payKind}`) || '[]');
        localStorage.setItem(`local_payments_${t.payKind}`, JSON.stringify([newPayment, ...existing]));
      }
    } catch {
      const existing = JSON.parse(localStorage.getItem(`local_payments_${t.payKind}`) || '[]');
      localStorage.setItem(`local_payments_${t.payKind}`, JSON.stringify([newPayment, ...existing]));
    }

    setSaving(false);
    setError(null); setPayFor(null); setAmount(''); setNote('');
    load();
  };

  const removePayment = async (id: string) => {
    if (!window.confirm('حذف هذه الدفعة؟')) return;
    try {
      await supabase.from('payments').delete().eq('id', id);
    } catch { /* ignore */ }
    
    // الحذف من التخزين المحلي أيضاً
    try {
      const existing = JSON.parse(localStorage.getItem(`local_payments_${t.payKind}`) || '[]');
      const filtered = existing.filter((p: PaymentRow) => p.id !== id);
      localStorage.setItem(`local_payments_${t.payKind}`, JSON.stringify(filtered));
    } catch { /* ignore */ }
    load();
  };

  const removeInvoice = async (inv: InvoiceRow) => {
    if (!window.confirm(`حذف الفاتورة ${inv.invoice_no}؟ هيتم حذف أصنافها كمان، وتقدر تحفظها كفاتورة تاني من صفحة الطلبات.`)) return;
    try {
      await supabase.from('invoices').delete().eq('id', inv.id);
    } catch { /* ignore */ }

    try {
      const localInv = JSON.parse(localStorage.getItem(`local_invoices_${kind}`) || '[]');
      const localItems = JSON.parse(localStorage.getItem(`local_invoice_items_${kind}`) || '[]');
      localStorage.setItem(`local_invoices_${kind}`, JSON.stringify(localInv.filter((i: InvoiceRow) => i.id !== inv.id)));
      localStorage.setItem(`local_invoice_items_${kind}`, JSON.stringify(localItems.filter((i: ItemRow) => i.invoice_id !== inv.id)));
    } catch { /* ignore */ }
    load();
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-EG');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-slate-800">{t.title}</h2>
        <p className="text-sm text-slate-500 mt-1">{t.subtitle}</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: t.parties, value: String(parties.length), icon: Users, tone: 'bg-sky-50 text-sky-600' },
          { label: t.totalLabel, value: `${money(sum(p => p.total))} ج.م`, icon: FileText, tone: 'bg-teal-50 text-teal-600' },
          { label: t.paidLabel, value: `${money(sum(p => p.paid))} ج.م`, icon: Wallet, tone: 'bg-emerald-50 text-emerald-600' },
          { label: t.balanceLabel, value: `${money(sum(p => p.balance))} ج.م`, icon: Wallet, tone: 'bg-amber-50 text-amber-600' },
        ].map(s => {
          const I = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-4 py-3.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${s.tone}`}>
                <I className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-lg font-extrabold text-slate-800 truncate tabular-nums">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative mb-4">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`بحث باسم ${t.party}...`}
          className="w-full min-h-[46px] pr-11 pl-4 text-sm rounded-2xl border border-slate-200/80 bg-white shadow-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 text-teal-600 animate-spin" /></div>
      ) : shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 text-center py-16 px-4">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-700">لا توجد حسابات</p>
          <p className="text-sm text-slate-400 mt-1">{t.empty}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map(p => {
            const isOpen = open.has(p.key);
            return (
              <div key={p.key} className={`bg-white rounded-2xl border border-slate-200/80 border-r-4 ${p.balance > 0.005 ? 'border-r-amber-400' : 'border-r-emerald-500'} shadow-sm overflow-hidden`}>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
                  <button
                    onClick={() => toggle(open, setOpen, p.key)}
                    className="flex items-center gap-3.5 flex-1 min-w-[200px] text-right focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-lg font-extrabold flex items-center justify-center shrink-0">
                      {baseName(p.name).charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-extrabold text-slate-800 truncate">{baseName(p.name)}</div>
                      <div className="text-xs text-slate-500 mt-1">{p.invoices.length} فاتورة · {p.payments.length} دفعة</div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 mr-auto transition-transform ${isOpen ? '' : 'rotate-90'}`} />
                  </button>

                  <div className="flex gap-6 text-center">
                    <div>
                      <div className="text-xs text-slate-500">الإجمالي</div>
                      <div className="font-extrabold text-slate-800 tabular-nums">{money(p.total)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">{t.paidLabel}</div>
                      <div className="font-extrabold text-emerald-700 tabular-nums">{money(p.paid)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">المتبقي</div>
                      <div className={`font-extrabold tabular-nums ${p.balance > 0.005 ? 'text-amber-600' : 'text-emerald-700'}`}>{money(p.balance)}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => { setPayFor(p); setAmount(p.balance > 0 ? String(p.balance.toFixed(2)) : ''); setNote(''); }}
                    className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> {t.payBtn}
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* الفواتير */}
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-700 mb-2">الفواتير</h4>
                      {p.invoices.length === 0 ? (
                        <p className="text-xs text-slate-400">لا توجد فواتير</p>
                      ) : (
                        <div className="space-y-2">
                          {p.invoices.map(inv => {
                            const invOpen = openInvoices.has(inv.id);
                            const rows = items.filter(i => i.invoice_id === inv.id);
                            return (
                              <div key={inv.id} className="bg-white rounded-xl border border-slate-200">
                                <div className="flex items-center gap-2 px-3 py-2.5">
                                  <button onClick={() => toggle(openInvoices, setOpenInvoices, inv.id)} className="flex-1 flex items-center gap-2 text-right">
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${invOpen ? '' : 'rotate-90'}`} />
                                    <span className="text-xs font-bold text-slate-700" dir="ltr">{inv.invoice_no}</span>
                                    <span className="text-xs text-slate-400">{fmtDate(inv.invoice_date)}</span>
                                  </button>
                                  <span className="text-sm font-extrabold text-teal-700 tabular-nums">{money(inv.total)}</span>
                                  <button onClick={() => removeInvoice(inv)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="حذف الفاتورة">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                {invOpen && (
                                  <table className="w-full text-xs border-t border-slate-100">
                                    <thead className="text-slate-500 bg-slate-50">
                                      <tr>
                                        <th className="text-right px-3 py-2 font-bold">الصنف</th>
                                        <th className="px-2 py-2 font-bold">الكمية</th>
                                        <th className="px-2 py-2 font-bold">السعر</th>
                                        <th className="px-2 py-2 font-bold">الإجمالي</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rows.map(r => (
                                        <tr key={r.id} className="border-t border-slate-100">
                                          <td className="px-3 py-2 text-slate-700 font-semibold">{r.product_name}</td>
                                          <td className="px-2 py-2 text-center tabular-nums">{r.quantity}</td>
                                          <td className="px-2 py-2 text-center tabular-nums">{money(r.unit_price)}</td>
                                          <td className="px-2 py-2 text-center font-bold tabular-nums">{money(r.line_total)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* الدفعات */}
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-700 mb-2">{t.paidLabel}</h4>
                      {p.payments.length === 0 ? (
                        <p className="text-xs text-slate-400">لا توجد دفعات</p>
                      ) : (
                        <div className="space-y-2">
                          {p.payments.map(x => (
                            <div key={x.id} className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-slate-400">{fmtDate(x.payment_date)}</div>
                                {x.note && <div className="text-xs text-slate-600 truncate">{x.note}</div>}
                              </div>
                              <span className="text-sm font-extrabold text-emerald-700 tabular-nums">{money(x.amount)}</span>
                              <button onClick={() => removePayment(x.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="حذف الدفعة">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة تسجيل دفعة */}
      {payFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setPayFor(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-800">{t.payTitle} {baseName(payFor.name)}</h3>
              <button onClick={() => setPayFor(null)} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="إغلاق"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-3">المتبقي حالياً: <b className="tabular-nums">{money(payFor.balance)} ج.م</b></p>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">المبلغ</label>
            <input
              type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} autoFocus
              className="w-full px-3 py-2.5 mb-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
            />
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">ملاحظة (اختياري)</label>
            <input
              type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="مثال: تحويل بنكي / كاش"
              className="w-full px-3 py-2.5 mb-4 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
            />
            <div className="flex gap-2">
              <button onClick={savePayment} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50">
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setPayFor(null)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}