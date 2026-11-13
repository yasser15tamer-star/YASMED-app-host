import { useEffect, useState } from 'react';
import { type LucideIcon, Pill, Power, ChevronDown, X, Phone } from 'lucide-react';
import { SocialLinks } from '@/components/SocialLinks';

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarProps {
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  fullName: string;
  roleLabel: string;
  onSignOut: () => void;
  storeName: string;
  open: boolean;
  onClose: () => void;
}

const BRAND = {
  logoSrc: '', 
  nameEn: 'YASMED',
  nameAr: 'ياسـمـد',
  slogan: 'Your Pharmacy Partner',
  tagline: 'نظام إدارة الصيدليات والمخازن',
};

const CONTACT = {
  title: 'للتواصل مع مصمم البرنامج',
  name: 'أ/ ياسر تامر محمد السعيد',
  subtitle: 'دعم فني • تطوير • استفسارات',
  phone: '01013629789',
};

// مجموعات الأدمن زي ما هي تماماً من غير أي تعديل
const ADMIN_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'الموردين والأسعار',
    keys: [
      'comparison',
      'comparison-comprehensive',
      'wholesale-suppliers',
      'retail-suppliers',
      'pharmacy-suppliers',
      'client-sheets',
      'upload',
    ],
  },
  {
    title: 'التسوق والطلبات',
    keys: ['cart', 'orders'],
  },
  {
    title: 'النظام',
    keys: ['clients', 'employees', 'settings'],
  },
];

// مجموعات العميل
const CLIENT_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'الموردين والأسعار',
    keys: [
      'comparison',
      'comparison-comprehensive',
      'wholesale-suppliers',
      'retail-suppliers',
      'pharmacy-suppliers',
      'client-sheets',
      'upload',
    ],
  },
  {
    title: 'التسوق والطلبات',
    keys: ['cart', 'orders'],
  },
];

const RENAMES: Record<string, string> = {
  'pharmacy-suppliers': 'مخازن وموردين الصيدليات',
  'comparison': 'مركز مقارنة الموردين',
  'comparison-comprehensive': 'مقارنة الأسعار الشاملة',
  'wholesale-suppliers': 'مخازن وموردين الجملة',
  'retail-suppliers': 'مخازن وموردين القطاعي',
  'client-sheets': 'شيتات العملاء',
  'orders': 'الطلبات',
  'clients': 'إدارة العملاء',
  'employees': 'إدارة الموظفين',
  'settings': 'الإعدادات',
  'account': 'الحساب',
  'upload': 'إرسال ملفات الإكسيل',
};

let persistedOpenGroup: string | null = 'الموردين والأسعار';

const CARD_BASE =
  'w-full flex items-center justify-between gap-3 rounded-xl border px-4 text-right font-bold transition-all duration-200';
const CARD_ACTIVE =
  'bg-[#0b7ae0] border-sky-300 text-white shadow-[0_0_16px_rgba(56,189,248,0.4)]';
const CARD_IDLE =
  'bg-[#0a2540]/70 border-sky-500/20 text-white hover:bg-[#0d3357] hover:border-sky-400/50';

export function Sidebar({ items, activeKey, onSelect, onSignOut, open, onClose }: SidebarProps) {
  const displayLabel = (item: NavItem) => RENAMES[item.key] ?? item.label;

  const isClientDashboard = items.some(i => i.key === 'upload' || i.key === 'cart' || (i.key === 'account' && !items.some(k => k.key === 'clients')));
  const GROUPS = isClientDashboard ? CLIENT_GROUPS : ADMIN_GROUPS;

  const homeItem = items.find(i => i.key === 'home');
  // للعميل بنخلي زرار الحساب يظهر في الآخر خالص
  const accountItem = isClientDashboard ? items.find(i => i.key === 'account') : null;

  const grouped = GROUPS.map(g => ({
    title: g.title,
    items: g.keys
      .map(k => items.find(i => i.key === k))
      .filter((i): i is NavItem => Boolean(i)),
  })).filter(g => g.items.length > 0);

  const usedKeys = new Set<string>([
    ...(homeItem ? [homeItem.key] : []),
    ...(accountItem ? [accountItem.key] : []),
    ...grouped.flatMap(g => g.items.map(i => i.key)),
  ]);
  const otherItems = items.filter(i => !usedKeys.has(i.key));

  const activeGroupTitle = grouped.find(g => g.items.some(i => i.key === activeKey))?.title;

  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    return activeGroupTitle || persistedOpenGroup;
  });

  useEffect(() => {
    persistedOpenGroup = openGroup;
  }, [openGroup]);

  useEffect(() => {
    if (activeGroupTitle) {
      setOpenGroup(activeGroupTitle);
    }
  }, [activeGroupTitle]);

  const toggleGroup = (title: string) => {
    setOpenGroup(prev => (prev === title ? null : title));
  };

  const renderTopItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = item.key === activeKey;
    return (
      <button
        key={item.key}
        onClick={() => onSelect(item.key)}
        className={`${CARD_BASE} h-12 text-[15px] ${isActive ? CARD_ACTIVE : CARD_IDLE}`}
      >
        <span className="truncate">{displayLabel(item)}</span>
        <Icon className="w-[18px] h-[18px] shrink-0" />
      </button>
    );
  };

  const renderSubItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = item.key === activeKey;
    return (
      <button
        key={item.key}
        onClick={() => onSelect(item.key)}
        className={`${CARD_BASE} h-10 text-sm font-semibold ${isActive ? CARD_ACTIVE : CARD_IDLE}`}
      >
        <span className="truncate">{displayLabel(item)}</span>
        <Icon className="w-4 h-4 shrink-0" />
      </button>
    );
  };

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        aria-hidden={!open}
        className={`fixed lg:sticky top-0 right-0 z-50 h-screen shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          open
            ? 'w-72 xl:w-80 translate-x-0'
            : 'w-72 lg:w-0 translate-x-full lg:translate-x-0 max-lg:invisible'
        }`}
      >
        <div className="relative w-72 xl:w-80 h-full flex flex-col bg-gradient-to-b from-[#071b30] via-[#061a2e] to-[#04101f] border-l border-sky-500/15 shadow-2xl">
          <button
            onClick={onClose}
            aria-label="إغلاق القائمة"
            className="lg:hidden absolute top-3 left-3 z-10 flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Brand */}
          <div className="px-5 pt-6 pb-4 text-center border-b border-sky-500/10">
            <div className="flex items-center justify-center gap-3">
              {BRAND.logoSrc ? (
                <img src={BRAND.logoSrc} alt={BRAND.nameEn} className="w-14 h-14 object-contain" />
              ) : (
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30 ring-1 ring-white/20">
                  <Pill className="w-7 h-7" />
                </div>
              )}
              <div className="text-right leading-tight">
                <h1 className="text-2xl font-extrabold tracking-wide text-white" dir="ltr">{BRAND.nameEn}</h1>
                <p className="text-base font-bold text-sky-400">{BRAND.nameAr}</p>
                <p className="text-[10px] text-slate-400" dir="ltr">{BRAND.slogan}</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-sky-300">{BRAND.tagline}</p>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-4 pt-4 pb-3 space-y-2 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(56,189,248,0.35)_transparent]">
            <h2 className="text-lg font-extrabold text-white px-1 pb-1">القائمة الرئيسية</h2>

            {/* 1. الرئيسية في الأول */}
            {homeItem && renderTopItem(homeItem)}
            {otherItems.map(renderTopItem)}

            {/* 2. المجموعات في النص (الموردين والأسعار + التسوق والطلبات) */}
            {grouped.map(group => {
              const isOpen = openGroup === group.title;
              const hasActive = group.items.some(i => i.key === activeKey);
              return (
                <div key={group.title}>
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className={`w-full flex items-center justify-between gap-2 h-12 px-4 rounded-xl border text-[15px] font-bold transition-all duration-200 ${
                      hasActive
                        ? 'border-sky-400/60 bg-[#0a2a45] text-sky-300'
                        : 'border-sky-500/20 bg-[#0a2540]/70 text-white hover:bg-[#0d3357] hover:border-sky-400/50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {group.title}
                      <span className="text-[11px] font-medium text-slate-400">({group.items.length})</span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="mt-2 mr-3 pr-2 border-r-2 border-sky-500/20 space-y-1.5">
                        {group.items.map(renderSubItem)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 3. زرار الحساب في الآخر خالص تحت كل المجموعات للعميل */}
            {accountItem && renderTopItem(accountItem)}
          </nav>

          {/* التواصل وخروج */}
          <div className="px-4 pb-4 pt-2 space-y-3">
            <div className="rounded-xl border border-sky-500/20 bg-[#0a2540]/50 px-4 py-3 text-center">
              <p className="text-[11px] font-bold text-sky-300">{CONTACT.title}</p>
              <p className="mt-1.5 text-sm font-extrabold text-white">{CONTACT.name}</p>
              <p className="mt-1 text-[11px] text-slate-300">{CONTACT.subtitle}</p>
              <a
                href={`tel:${CONTACT.phone}`}
                dir="ltr"
                className="mt-2 inline-flex items-center justify-center gap-1.5 text-sm font-extrabold text-sky-400 hover:text-sky-300 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                {CONTACT.phone}
              </a>
              <div className="mt-3">
                <SocialLinks variant="compact" />
              </div>
            </div>

            <button
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-[#dc3a50] hover:bg-[#e8485d] active:scale-[0.98] text-white text-sm font-bold shadow-lg shadow-rose-900/30 transition-all duration-200"
            >
              <Power className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}