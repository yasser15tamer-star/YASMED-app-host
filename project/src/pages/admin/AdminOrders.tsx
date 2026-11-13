import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { supabase, type Order } from '@/lib/supabase';
import {
  AlertCircle,
  Loader2,
  ShoppingCart,
  Search,
  Trash2,
  Printer,
  Settings2,
  ChevronDown,
  Users,
  Wallet,
  Clock,
  Package,
  FilePlus,
} from 'lucide-react';

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'cancelled';
type PrintMode = 'both' | 'purchase' | 'sales';

const statusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  processing: 'قيد المعالجة',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const statusOptions = ['pending', 'processing', 'completed', 'cancelled'] as const;

const statusSelectStyles: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-sky-50 text-sky-700 border-sky-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
};

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pad = (n: number) => String(n).padStart(2, '0');

const lineTotal = (o: Order) => (o.final_price || 0) * (o.quantity || 0);

const clientBase = (name: string) => name.replace(/\s*\[.*$/, '').trim() || name;
const clientType = (name: string) => {
  const m = name.match(/\[\s*([^\]\-–—]+)/);
  return m ? m[1].trim() : '';
};

interface OrderGroup {
  client: string;
  orders: Order[];
  total: number;
  suppliers: string[];
}

interface PrintMeta {
  date: string;
  time: string;
  stamp: string;
  seq: number;
}

interface InvoiceData {
  kind: 'purchase' | 'sales';
  title: string;
  brand: string;
  subtitle: string;
  partyName: string;
  number: string;
  orders: Order[];
  clientDetails?: Order;
  copyLabel?: string;
}

interface InfoCell {
  label: string;
  value: string;
  span?: number;
  ltr?: boolean;
  icon: React.ReactNode;
}

function makeMeta(): PrintMeta {
  const d = new Date();
  const h = d.getHours();
  return {
    date: `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`,
    time: `${pad(h % 12 === 0 ? 12 : h % 12)}:${pad(d.getMinutes())} ${h < 12 ? 'ص' : 'م'}`,
    stamp: `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(h)}${pad(d.getMinutes())}${pad(d.getSeconds())}`,
    seq: Math.floor(Math.random() * 900) + 100,
  };
}

function groupBy(list: Order[], keyFn: (o: Order) => string): [string, Order[]][] {
  const map = new Map<string, Order[]>();
  list.forEach(o => {
    const k = keyFn(o);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(o);
  });
  return Array.from(map.entries());
}

function Ico({ children, size = 26 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#14449a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function InvoicePage({ inv, meta }: { inv: InvoiceData; meta: PrintMeta }) {
  const itemsCount = inv.orders.length;
  const total = inv.orders.reduce((s, o) => s + lineTotal(o), 0);
  const totalDiscount = inv.orders.reduce(
    (s, o) => s + ((o.price || 0) * (o.quantity || 0) - lineTotal(o)),
    0
  );

  const cd = inv.clientDetails;

  const legalIcon = (
    <Ico>
      <path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4" />
    </Ico>
  );

  const info: InfoCell[] = [
    {
      label: 'المورد',
      value: inv.partyName,
      icon: (
        <Ico>
          <rect x="5" y="3" width="10" height="18" rx="1" />
          <path d="M15 9h4v12h-4M8 7h4M8 11h4M8 15h4" />
        </Ico>
      ),
    },
    {
      label: 'رقم الفاتورة',
      value: inv.number,
      ltr: true,
      icon: (
        <Ico>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v4h4M9 13h7M9 17h7" />
        </Ico>
      ),
    },
    {
      label: 'التاريخ والوقت',
      value: `${meta.date}  -  ${meta.time}`,
      icon: (
        <Ico>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4M8 14h2M12 14h2M16 14h2M8 17h2M12 17h2M16 17h2" />
        </Ico>
      ),
    },
    ...(inv.kind === 'sales' && cd
      ? [
          {
            label: 'العميل',
            value: (() => {
              const n = cd.client_name || '';
              if (!n) return 'غير متوفر';
              const ty = clientType(n);
              return ty ? `${clientBase(n)} (${ty})` : clientBase(n);
            })(),
            icon: <Ico><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c.8-4 3.5-6 8-6s7.2 2 8 6" /></Ico>,
          },
          {
            label: 'التواصل',
            value:
              cd.client_contact_numbers?.map(c => `${c.label}: ${c.number}`).join(' | ') || 'غير متوفر',
            icon: <Ico><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></Ico>,
          },
          {
            label: 'العنوان',
            value:
              [cd.client_province, cd.client_city, cd.client_address].filter(Boolean).join(' - ') ||
              'غير متوفر',
            icon: <Ico><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2" /></Ico>,
          },
          ...(cd.client_license_number
            ? [{ label: 'رقم الترخيص', value: String(cd.client_license_number), ltr: true, icon: legalIcon }]
            : []),
          ...(cd.client_tax_number
            ? [{ label: 'الرقم الضريبي', value: String(cd.client_tax_number), ltr: true, icon: legalIcon }]
            : []),
          ...(cd.client_commercial_record
            ? [{ label: 'السجل التجاري', value: String(cd.client_commercial_record), ltr: true, icon: legalIcon }]
            : []),
        ]
      : []),
  ];

  return (
    <div className="inv-page">
      <div className="inv-header">
        <svg className="inv-header-bg" viewBox="0 0 794 200" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="hdrLight" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e8f0fb" />
              <stop offset="1" stopColor="#f7fafe" />
            </linearGradient>
            <linearGradient id="hdrNavy" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#0b2a6b" />
              <stop offset="1" stopColor="#1a53b0" />
            </linearGradient>
          </defs>
          <rect width="794" height="200" fill="url(#hdrLight)" />
          <path d="M0 150 C120 170 250 190 380 188 C560 186 700 150 794 118 L794 200 L0 200 Z" fill="url(#hdrNavy)" />
          <path d="M0 132 C140 160 290 168 430 160 C600 150 720 110 794 84" fill="none" stroke="#7ac143" strokeWidth="4" strokeLinecap="round" />
          <path d="M794 0 L794 96 C770 70 764 30 794 0Z" fill="#14449a" />
        </svg>

        <div className="inv-brand">
          <div className="inv-brand-name">{inv.brand}</div>
        </div>

        <div className="inv-tagline">
          <div className="inv-tagline-1">معاً ..</div>
          <div className="inv-tagline-2">نبني مستقبل أفضل</div>
          <div className="inv-heart">
            <span />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14449a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
              <path d="M7 11h3l1.5-2.5L13 13l1-2h3" />
            </svg>
            <span />
          </div>
        </div>
      </div>

      <div className="inv-title-wrap">
        <div className="inv-title">
          <div className="inv-title-icon">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h9l4 4v14H6z" />
              <path d="M15 3v4h4M9 12h7M9 16h7" />
            </svg>
          </div>
          <span>{inv.title}</span>
        </div>
        <div className="inv-subtitle">{inv.subtitle}</div>
        {inv.copyLabel && <div className="inv-copy-label">({inv.copyLabel})</div>}
      </div>

      <div className="inv-info">
        {info.map(c => (
          <div
            className="inv-cell"
            style={{ gridColumn: `span ${c.span || 2}` }}
            key={c.label}
          >
            <div className="inv-cell-icon">{c.icon}</div>
            <div className="inv-cell-text">
              <b>{c.label}</b>
              <span dir={c.ltr ? 'ltr' : undefined} style={c.ltr ? { textAlign: 'right' } : undefined}>
                {c.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      <table className="inv-table">
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '32%' }}>الصنف</th>
            <th style={{ width: '9%' }}>الكمية</th>
            <th>سعر الشراء</th>
            <th>خصم</th>
            <th>سعر بعد الخصم</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {inv.orders.map((o, i) => (
            <tr key={o.id}>
              <td className="inv-bold">{i + 1}</td>
              <td className="inv-bold inv-name-cell">{o.product_name}</td>
              <td>{o.quantity}</td>
              <td>{money(o.price || 0)}</td>
              <td>{money(o.discount || 0)}%</td>
              <td>{money(o.final_price || 0)}</td>
              <td className="inv-bold">{money(lineTotal(o))} ج.م</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inv-bottom">
        <div className="inv-notes">
          <div className="inv-notes-head">
            <Ico size={30}>
              <path d="M6 3h9l4 4v14H6z" />
              <path d="M15 3v4h4M9 12h7M9 16h7" />
            </Ico>
            <span>ملاحظات</span>
          </div>
          <p>{inv.brand} يرحب بكم دائماً</p>
          <p>مع أطيب التمنيات بدوام الصحة والعافية</p>
          <svg className="inv-notes-wave" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 30 C60 10 120 10 180 24 C230 34 270 22 300 12" fill="none" stroke="#14449a" strokeWidth="3" />
            <path d="M0 36 C70 20 130 20 190 30 C240 38 275 30 300 22" fill="none" stroke="#7ac143" strokeWidth="3" />
          </svg>
        </div>

        <div className="inv-summary">
          <div className="inv-sum-row">
            <span className="inv-sum-label">
              <Ico size={24}>
                <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
                <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
              </Ico>
              إجمالي الأصناف
            </span>
            <b>{itemsCount}</b>
          </div>
          <div className="inv-sum-row">
            <span className="inv-sum-label">
              <span className="inv-pct">%</span>
              إجمالي الخصم
            </span>
            <b>{money(totalDiscount)}</b>
          </div>
          <div className="inv-total">
            <span className="inv-sum-label">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <ellipse cx="12" cy="6" rx="7" ry="3" />
                <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
              </svg>
              الإجمالي بعد الخصم
            </span>
            <b>ج.م {money(total)}</b>
          </div>
        </div>
      </div>

      <div className="inv-sign">
        <div className="inv-sign-box">
          <span className="inv-sign-label">الختم</span>
        </div>
        <div className="inv-sign-box">
          <span className="inv-sign-label">الإمضاء</span>
        </div>
      </div>

      <div className="inv-footer">
        <svg className="inv-footer-wave" viewBox="0 0 794 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 22 C160 4 330 6 500 20 C640 32 730 22 794 10 L794 40 L0 40 Z" fill="#0b2a6b" />
          <path d="M0 22 C160 4 330 6 500 20 C640 32 730 22 794 10" fill="none" stroke="#7ac143" strokeWidth="5" />
        </svg>
        <div className="inv-footer-body">
          <div className="inv-footer-row">
            <div className="inv-footer-brand">
              <div>
                <div className="inv-footer-yas">YASMED</div>
                <div className="inv-footer-sub">Your Pharmacy Partner</div>
              </div>
            </div>
            <div className="inv-footer-phone">
              <div className="inv-footer-circle">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
                </svg>
              </div>
              <div>
                <div className="inv-footer-small">يمكنك التواصل معنا على الرقم التالي</div>
                <b dir="ltr">01013629789</b>
              </div>
            </div>
            <div className="inv-footer-addr">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
              </svg>
              <span>الدقهلية - المنصورة - مصر</span>
            </div>
            <div className="inv-footer-slogan">
              <div>معاً ... لنحقق</div>
              <div>الأفضل</div>
            </div>
          </div>
          <div className="inv-footer-rights">
            جميع الحقوق محفوظة لياسمد تحت إشراف أ/ ياسر تامر محمد السعيد
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showPrintSettings, setShowPrintSettings] = useState(false);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [invoiceName, setInvoiceName] = useState<string>(() => {
    try { return localStorage.getItem('invoice_brand_name') || 'ياسر'; } catch { return 'ياسر'; }
  });
  const [customClientName, setCustomClientName] = useState('');
  const [printMode, setPrintMode] = useState<PrintMode>('both');
  const [warehouseCopy, setWarehouseCopy] = useState(false);
  const [printOrders, setPrintOrders] = useState<Order[] | null>(null);
  const [printMeta, setPrintMeta] = useState<PrintMeta | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) setError('فشل في تحميل الطلبات');
    else setOrders(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    try { localStorage.setItem('invoice_brand_name', invoiceName); } catch { /* ignore */ }
  }, [invoiceName]);

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) setError('فشل في تحديث حالة الطلب');
    else fetchOrders();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) setError('فشل في حذف الطلب');
    else {
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
      fetchOrders();
    }
  };

  const bulkDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${ids.length} طلب؟ لا يمكن التراجع.`)) return;
    setBusy(true);
    const { error } = await supabase.from('orders').delete().in('id', ids);
    if (error) setError('فشل في حذف الطلبات');
    else {
      setError(null);
      setSelected(new Set());
      await fetchOrders();
    }
    setBusy(false);
  };

  const handlePrint = (list: Order[]) => {
    if (list.length === 0) return;
    setPrintMeta(makeMeta());
    setPrintOrders(list);
    setTimeout(() => window.print(), 250);
  };

  // ---------- حفظ الأصناف كفواتير محلياً (تخزين مؤقت يعمل بدون داتابيز) ----------
  const SALES_MARGIN_PERCENT = 0;

  const saveInvoices = async (list: Order[]) => {
    if (list.length === 0) return;
    setBusy(true);
    setError(null);
    type O = Order & { client_id?: string; supplier_id?: string };
    const all = list as O[];

    const stamp = makeMeta().stamp;
    let created = 0;

    try {
      const localInvoicesSales = JSON.parse(localStorage.getItem('local_invoices_sales') || '[]');
      const localItemsSales = JSON.parse(localStorage.getItem('local_invoice_items_sales') || '[]');
      const localInvoicesPurchase = JSON.parse(localStorage.getItem('local_invoices_purchase') || '[]');
      const localItemsPurchase = JSON.parse(localStorage.getItem('local_invoice_items_purchase') || '[]');

      for (const kind of ['sales', 'purchase'] as const) {
        const groups = groupBy(all, o =>
          kind === 'sales' ? (o.client_id || o.client_name) : (o.supplier_id || o.supplier_real_name)
        );
        let n = 0;
        for (const [, os] of groups) {
          n++;
          const unit = (o: O) =>
            kind === 'sales'
              ? Math.round((o.final_price || 0) * (1 + SALES_MARGIN_PERCENT / 100) * 100) / 100
              : o.final_price || 0;
          const total = os.reduce((s, o) => s + unit(o) * (o.quantity || 0), 0);

          const invId = 'inv_' + Date.now() + '_' + Math.random();
          const invoiceNo = `${kind === 'sales' ? 'SO' : 'PO'}-${stamp}-${n}`;
          const partyName = kind === 'sales' ? os[0].client_name : os[0].supplier_real_name;

          const newInv = {
            id: invId,
            kind,
            invoice_no: invoiceNo,
            client_id: kind === 'sales' ? os[0].client_id || null : null,
            supplier_id: kind === 'purchase' ? os[0].supplier_id || null : null,
            party_name: partyName,
            total,
            invoice_date: new Date().toISOString(),
          };

          const newItems = os.map(o => ({
            id: 'item_' + Date.now() + '_' + Math.random(),
            invoice_id: invId,
            order_id: o.id,
            kind,
            product_name: o.product_name,
            quantity: o.quantity,
            unit_price: unit(o),
            line_total: unit(o) * (o.quantity || 0),
          }));

          if (kind === 'sales') {
            localInvoicesSales.push(newInv);
            localItemsSales.push(...newItems);
          } else {
            localInvoicesPurchase.push(newInv);
            localItemsPurchase.push(...newItems);
          }
          created++;
        }
      }

      localStorage.setItem('local_invoices_sales', JSON.stringify(localInvoicesSales));
      localStorage.setItem('local_invoice_items_sales', JSON.stringify(localItemsSales));
      localStorage.setItem('local_invoices_purchase', JSON.stringify(localInvoicesPurchase));
      localStorage.setItem('local_invoice_items_purchase', JSON.stringify(localItemsPurchase));

      window.alert(`تم حفظ ${created} فاتورة بنجاح! انتقل إلى صفحة المبيعات أو المشتريات لرؤيتها فوراً.`);
    } catch (e) {
      console.error(e);
      window.alert('حدث خطأ أثناء الحفظ.');
    }

    setBusy(false);
    setSelected(new Set());
  };

  const invoices: InvoiceData[] = useMemo(() => {
    if (!printOrders || printOrders.length === 0 || !printMeta) return [];
    const list: InvoiceData[] = [];
    const brandName = invoiceName.trim() || 'ياسر';

    if (printMode === 'both' || printMode === 'purchase') {
      groupBy(printOrders, o => (o.supplier_real_name || 'غير محدد').trim()).forEach(([real, os], i) => {
        const purchaseInv: InvoiceData = {
          kind: 'purchase',
          title: 'فـاتورة مشتريات',
          brand: brandName,
          subtitle: `من مخزن ${real}`,
          partyName: real,
          number: `PO-${printMeta.stamp}-${printMeta.seq + i}`,
          orders: os,
        };
        list.push(purchaseInv);
        if (warehouseCopy) {
          list.push({ ...purchaseInv, copyLabel: 'نسخة المخزن' });
        }
      });
    }

    if (printMode === 'both' || printMode === 'sales') {
      const byClient = groupBy(printOrders, o => (o.client_name || 'بدون اسم').trim());
      byClient.forEach(([client, os], i) => {
        const shownClient = byClient.length === 1 && customClientName.trim() ? customClientName.trim() : clientBase(client);
        list.push({
          kind: 'sales',
          title: 'فـاتورة مبيعات',
          brand: brandName,
          subtitle: `إلى ${shownClient}`,
          partyName: brandName,
          number: `SO-${printMeta.stamp}-${printMeta.seq + 50 + i}`,
          orders: os,
          clientDetails: os[0],
        });
      });
    }
    return list;
  }, [printOrders, printMeta, printMode, invoiceName, customClientName, warehouseCopy]);

  const filteredOrders = useMemo(
    () =>
      orders.filter(o => {
        if (statusFilter !== 'all' && o.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            o.client_name.toLowerCase().includes(q) ||
            o.product_name.toLowerCase().includes(q) ||
            o.supplier_real_name.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [orders, search, statusFilter]
  );

  const groups: OrderGroup[] = useMemo(() => {
    const map = new Map<string, OrderGroup>();
    filteredOrders.forEach(o => {
      const key = (o.client_name || 'بدون اسم').trim();
      if (!map.has(key)) map.set(key, { client: key, orders: [], total: 0, suppliers: [] });
      const g = map.get(key)!;
      g.orders.push(o);
      g.total += lineTotal(o);
      if (o.supplier_real_name && !g.suppliers.includes(o.supplier_real_name)) {
        g.suppliers.push(o.supplier_real_name);
      }
    });
    return Array.from(map.values());
  }, [filteredOrders]);

  const selectedOrders = useMemo(() => orders.filter(o => selected.has(o.id)), [orders, selected]);

  const toggleGroup = (client: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(client)) next.delete(client);
      else next.add(client);
      return next;
    });
  };

  const allCollapsed = groups.length > 0 && groups.every(g => collapsed.has(g.client));
  const toggleAllGroups = () => setCollapsed(allCollapsed ? new Set() : new Set(groups.map(g => g.client)));

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroupSelection = (g: OrderGroup) => {
    setSelected(prev => {
      const next = new Set(prev);
      const all = g.orders.every(o => next.has(o.id));
      g.orders.forEach(o => (all ? next.delete(o.id) : next.add(o.id)));
      return next;
    });
  };

  const grandTotal = filteredOrders.reduce((s, o) => s + lineTotal(o), 0);
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={selected.size > 0 ? 'pb-24' : ''}>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          body * { visibility: hidden; }
          #printable-invoice, #printable-invoice * { visibility: visible; }
          #printable-invoice {
            position: absolute; left: 0; top: 0; width: 100%;
            direction: rtl; background: white;
          }
        }
        #printable-invoice, #printable-invoice * {
          -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box;
        }
        .inv-page {
          width: 210mm; min-height: 296mm; margin: 0 auto; background: #fff; color: #0b2a6b;
          display: flex; flex-direction: column; direction: rtl; position: relative; overflow: hidden; isolation: isolate;
          page-break-after: always; break-after: page;
        }
        .inv-page:last-child { page-break-after: auto; break-after: auto; }
        .inv-header { position: relative; height: 150px; flex-shrink: 0; }
        .inv-header-bg { position: absolute; inset: 0; width: 100%; height: 100%; }
        .inv-brand {
          position: absolute; top: 30px; right: 36px; width: 200px; display: flex; flex-direction: column;
          align-items: center; gap: 4px; padding: 0; background: none;
        }
        .inv-brand-name { font-size: 40px; font-weight: 900; color: #0b2a6b; line-height: 1.15; text-align: center; max-width: 100%; word-break: break-word; }
        .inv-brand-name::after { content: ''; display: block; height: 4px; width: 60%; margin: 4px auto 0; border-radius: 4px; background: #7ac143; }
        .inv-tagline { position: absolute; top: 22px; left: 40px; text-align: center; color: #14449a; font-style: italic; }
        .inv-tagline-1 { font-size: 26px; font-weight: 900; line-height: 1.2; }
        .inv-tagline-2 { font-size: 24px; font-weight: 900; line-height: 1.3; }
        .inv-heart { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
        .inv-heart span { flex: 1; height: 2px; background: #14449a; min-width: 60px; }
        .inv-title-wrap { margin-top: -30px; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 2; flex-shrink: 0; }
        .inv-title {
          background: linear-gradient(135deg, #0b2a6b, #14449a); color: #fff; border-radius: 48px;
          padding: 10px 26px 10px 54px; font-size: 36px; font-weight: 900; display: flex; align-items: center; gap: 16px;
          box-shadow: 0 6px 16px rgba(11, 42, 107, .3); border: 3px solid #fff; outline: 2px solid #cfdcf0;
        }
        .inv-title-icon { width: 50px; height: 50px; border: 2.5px solid #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .inv-subtitle {
          margin-top: -8px; padding: 14px 44px 8px; background: #f3f7fd; border: 1px solid #cfdcf0; border-top: 0;
          border-radius: 0 0 26px 26px; font-weight: 900; font-size: 18px; color: #0b2a6b; z-index: -1; position: relative;
          box-shadow: 0 3px 8px rgba(11, 42, 107, .12);
        }
        .inv-copy-label { margin-top: 6px; font-weight: 900; font-size: 14px; color: #4f9a2a; }
        .inv-info {
          margin: 16px 24px 0; display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;
          padding: 0; border: 0; background: none; flex-shrink: 0;
        }
        .inv-cell { background: #fff; border: 1px solid #d6e2f3; border-right: 4px solid #14449a; box-shadow: 0 1px 3px rgba(11,42,107,.08); border-radius: 12px; padding: 8px 12px; display: flex; align-items: center; gap: 10px; min-width: 0; }
        .inv-cell-icon { flex-shrink: 0; display: flex; }
        .inv-cell-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
        .inv-cell-text b { font-size: 15px; color: #0b2a6b; font-weight: 900; }
        .inv-cell-text span {
          font-size: 12.5px; color: #3d5282; font-weight: 700;
          overflow-wrap: anywhere; word-break: normal; line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .inv-table {
          margin: 14px 24px 0; width: calc(100% - 48px); border-collapse: separate; border-spacing: 0;
          border: 1px solid #cfdcf0; border-radius: 16px; overflow: hidden; flex-shrink: 0;
        }
        .inv-table th {
          background: linear-gradient(135deg, #0b2a6b, #14449a); color: #fff; padding: 9px 6px;
          font-size: 14px; font-weight: 800; text-align: center; border-left: 1px solid rgba(255,255,255,.22);
        }
        .inv-table th:last-child { border-left: 0; }
        .inv-table td {
          padding: 10px 6px; font-size: 13.5px; text-align: center; color: #1e3a6e; font-weight: 600;
          border-top: 1px solid #e3ebf7; border-left: 1px solid #e3ebf7;
        }
        .inv-table td:last-child { border-left: 0; }
        .inv-table tbody tr:nth-child(even) td { background: #f6f9fe; }
        .inv-table tr { break-inside: avoid; page-break-inside: avoid; }
        .inv-bold { font-weight: 900 !important; color: #0b2a6b !important; }
        .inv-name-cell { text-align: right !important; padding-right: 14px !important; }
        .inv-bottom { margin: 14px 24px 0; display: flex; gap: 16px; align-items: stretch; break-inside: avoid; flex-shrink: 0; }

        .inv-notes {
          flex: 1; position: relative; background: #f3f7fd; border: 1px solid #cfdcf0;
          border-radius: 18px; padding: 12px 18px 38px; overflow: hidden;
        }
        .inv-notes-head { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 900; color: #0b2a6b; margin-bottom: 8px; }
        .inv-notes p { margin: 4px 0; text-align: center; font-size: 14px; font-weight: 700; color: #3d5282; }
        .inv-notes-wave { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 34px; }

        .inv-summary { width: 46%; display: flex; flex-direction: column; gap: 7px; }
        .inv-sum-row {
          display: flex; align-items: center; justify-content: space-between;
          background: #eef4fb; border-radius: 12px; padding: 9px 14px;
          font-size: 15px; font-weight: 800; color: #0b2a6b;
        }
        .inv-sum-row b { font-size: 17px; }
        .inv-sum-label { display: flex; align-items: center; gap: 8px; }
        .inv-pct { font-size: 22px; font-weight: 900; color: #14449a; width: 24px; text-align: center; }
        .inv-total {
          display: flex; align-items: center; justify-content: space-between;
          background: linear-gradient(135deg, #0b2a6b, #1a53b0); color: #fff;
          border-radius: 14px; padding: 12px 16px; font-size: 17px; font-weight: 900;
        }
        .inv-total b { font-size: 24px; }

        .inv-sign { margin: 14px 24px 0; display: flex; gap: 16px; flex-shrink: 0; }
        .inv-sign-box {
          flex: 1; height: 70px; border: 1.5px dashed #9db4d8; border-radius: 14px;
          display: flex; align-items: flex-start; justify-content: center; padding-top: 6px;
        }
        .inv-sign-label { font-size: 13px; font-weight: 800; color: #3d5282; }

        .inv-footer { margin-top: auto; position: relative; flex-shrink: 0; padding-top: 14px; }
        .inv-footer-wave { display: block; width: 100%; height: 34px; }
        .inv-footer-body { background: #0b2a6b; color: #fff; padding: 6px 24px 10px; margin-top: -1px; }
        .inv-footer-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .inv-footer-brand { display: flex; align-items: center; gap: 8px; }
        .inv-footer-logo { background: #fff; border-radius: 10px; padding: 3px; display: flex; }
        .inv-footer-yas { font-size: 18px; font-weight: 900; letter-spacing: 1px; line-height: 1.1; }
        .inv-footer-sub { font-size: 9px; opacity: .85; }
        .inv-footer-phone { display: flex; align-items: center; gap: 8px; }
        .inv-footer-circle { width: 38px; height: 38px; border: 2px solid #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .inv-footer-small { font-size: 9.5px; opacity: .9; }
        .inv-footer-phone b { font-size: 14px; }
        .inv-footer-addr { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; }
        .inv-footer-slogan { font-size: 12px; font-weight: 800; font-style: italic; text-align: center; line-height: 1.3; }
        .inv-footer-rights { text-align: center; font-size: 10.5px; margin-top: 8px; opacity: .9; }
      `}</style>

      {printOrders && printMeta && (
        <div id="printable-invoice" className="hidden print:block">
          {invoices.map((inv, idx) => (
            <InvoicePage key={idx} inv={inv} meta={printMeta} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">الطلبات</h1>
          <p className="text-sm text-slate-500 mt-1">تابع طلبات عملائك، غير حالتها واطبع الفواتير</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrintSettings(!showPrintSettings)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold shadow-sm hover:bg-slate-50"
          >
            <Settings2 className="w-4 h-4 text-teal-600" /> إعدادات الطباعة
          </button>
        </div>
      </div>

      {showPrintSettings && (
        <Card className="mb-6 border-teal-200 bg-teal-50/30">
          <CardBody className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم المؤسسة أعلى الفاتورة</label>
              <input
                type="text"
                value={invoiceName}
                onChange={e => setInvoiceName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                placeholder="مثال: ياسر"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل المخصص (اختياري)</label>
              <input
                type="text"
                value={customClientName}
                onChange={e => setCustomClientName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                placeholder="يترك فارغاً لاستخدام اسم العميل الأصلي"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نوع الفواتير المطبوعة</label>
              <select
                value={printMode}
                onChange={e => setPrintMode(e.target.value as PrintMode)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
              >
                <option value="both">مشتريات و مبيعات معاً</option>
                <option value="purchase">فواتير الشراء فقط</option>
                <option value="sales">فواتير البيع فقط</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={warehouseCopy}
                  onChange={e => setWarehouseCopy(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                />
                طباعة نسخة إضافية من فاتورة المشتريات للمخزن
              </label>
            </div>
          </CardBody>
        </Card>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'العملاء', value: String(groups.length), icon: Users, tone: 'bg-sky-50 text-sky-600' },
          { label: 'الطلبات', value: String(filteredOrders.length), icon: Package, tone: 'bg-teal-50 text-teal-600' },
          { label: 'إجمالي المبالغ', value: `${money(grandTotal)} ج.م`, icon: Wallet, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'قيد الانتظار', value: String(statusCounts['pending'] || 0), icon: Clock, tone: 'bg-amber-50 text-amber-600' },
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

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالعميل، المنتج، المورد..."
            className="w-full min-h-[46px] pr-11 pl-4 text-sm rounded-2xl border border-slate-200/80 bg-white shadow-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['all', 'pending', 'processing', 'completed', 'cancelled'] as StatusFilter[]).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st === 'all' ? 'الكل' : statusLabels[st]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-slate-500">{groups.length} عميل · {filteredOrders.length} طلب</span>
        <button onClick={toggleAllGroups} className="text-xs font-bold text-teal-600 hover:text-teal-700">
          {allCollapsed ? 'فرد كل الطلبات' : 'طي الكل'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-600 animate-spin" /></div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 text-center py-16 px-4">
          <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-700">لا توجد طلبات مطابقة</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => {
            const isCollapsed = collapsed.has(g.client);
            const allSelected = g.orders.every(o => selected.has(o.id));
            const someSelected = g.orders.some(o => selected.has(o.id));

            return (
              <div key={g.client} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-5 py-4 bg-slate-50/50 border-b border-slate-100">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={() => toggleGroupSelection(g)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <button onClick={() => toggleGroup(g.client)} className="flex items-center gap-3 flex-1 min-w-[200px] text-right">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 font-extrabold flex items-center justify-center">
                      {clientBase(g.client).charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-800">{clientBase(g.client)}</h3>
                      <p className="text-xs text-slate-500">{g.orders.length} طلبات · الموردين: {g.suppliers.join(', ')}</p>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 mr-auto transition-transform ${isCollapsed ? 'rotate-90' : ''}`} />
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="text-base font-extrabold text-teal-700 tabular-nums">{money(g.total)} ج.م</span>
                    <button
                      onClick={() => handlePrint(g.orders)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-sm"
                    >
                      <Printer className="w-4 h-4" /> طباعة
                    </button>
                    <button
                      onClick={() => saveInvoices(g.orders)}
                      disabled={busy}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 shadow-sm disabled:opacity-50"
                      title="حفظ كفواتير بيع وشراء"
                    >
                      <FilePlus className="w-4 h-4" /> حفظ كفواتير
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-10"></th>
                          <th className="p-3">المنتج</th>
                          <th className="p-3">الكمية</th>
                          <th className="p-3">السعر</th>
                          <th className="p-3">الخصم</th>
                          <th className="p-3">سعر بعد الخصم</th>
                          <th className="p-3">الإجمالي</th>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3">الحالة</th>
                          <th className="p-3 text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {g.orders.map(o => (
                          <tr key={o.id} className="hover:bg-slate-50/80">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selected.has(o.id)}
                                onChange={() => toggleOne(o.id)}
                                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                              />
                            </td>
                            <td className="p-3 font-bold text-slate-800">{o.product_name}</td>
                            <td className="p-3 tabular-nums">{o.quantity}</td>
                            <td className="p-3 tabular-nums">{money(o.price || 0)}</td>
                            <td className="p-3 tabular-nums text-teal-600 font-bold">{money(o.discount || 0)}%</td>
                            <td className="p-3 tabular-nums">{money(o.final_price || 0)}</td>
                            <td className="p-3 font-extrabold text-teal-700 tabular-nums">{money(lineTotal(o))} ج.م</td>
                            <td className="p-3 text-slate-400">{new Date(o.created_at).toLocaleDateString('ar-EG')}</td>
                            <td className="p-3">
                              <select
                                value={o.status}
                                onChange={e => handleStatusChange(o.id, e.target.value)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusSelectStyles[o.status] || ''}`}
                              >
                                {statusOptions.map(st => (
                                  <option key={st} value={st}>{statusLabels[st]}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDelete(o.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                                title="حذف الطلب"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-6 right-1/2 translate-x-1/2 z-40 bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <span className="text-xs font-bold bg-teal-600 text-white px-2.5 py-1 rounded-xl">{selected.size} محدد</span>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={() => handlePrint(selectedOrders)}
            className="flex items-center gap-1.5 text-xs font-bold hover:text-teal-400 transition-colors"
          >
            <Printer className="w-4 h-4" /> طباعة المحددة
          </button>
          <button
            onClick={() => saveInvoices(selectedOrders)}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-bold hover:text-sky-400 transition-colors disabled:opacity-50"
          >
            <FilePlus className="w-4 h-4" /> حفظ كفواتير
          </button>
          <button
            onClick={() => bulkDelete(Array.from(selected))}
            className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> حذف
          </button>
        </div>
      )}
    </div>
  );
}