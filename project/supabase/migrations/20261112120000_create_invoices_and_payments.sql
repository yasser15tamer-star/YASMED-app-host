-- ============ جدول الفواتير ============
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

-- ============ بنود الفواتير ============
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

-- يمنع تكرار نفس الطلب في فاتورة بيع مرتين، وفي فاتورة شراء مرتين
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_items_order_kind
  ON invoice_items(order_id, kind) WHERE order_id IS NOT NULL;

-- ============ المدفوعات ============
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('receipt', 'payment')),  -- receipt = قبض من عميل ، payment = دفع لمورد
  client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  party_name text NOT NULL DEFAULT '',
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_kind ON invoices(kind);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_supplier ON payments(supplier_id);

-- ============ الأمان: الأدمن بس ============
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_invoices" ON invoices;
CREATE POLICY "admin_all_invoices" ON invoices FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_all_invoice_items" ON invoice_items;
CREATE POLICY "admin_all_invoice_items" ON invoice_items FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_all_payments" ON payments;
CREATE POLICY "admin_all_payments" ON payments FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());
NOTIFY pgrst, 'reload schema';