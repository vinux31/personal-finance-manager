-- ============================================================
-- 0013_bill_payments: Tabel rekam jejak pembayaran tagihan
-- ============================================================

CREATE TABLE bill_payments (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurring_template_id BIGINT NOT NULL REFERENCES recurring_templates(id) ON DELETE CASCADE,
  paid_date             DATE NOT NULL,
  amount                NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  transaction_id        BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bill payments"
  ON bill_payments FOR ALL
  USING      (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);
