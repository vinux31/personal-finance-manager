CREATE TABLE pay_periods (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label      TEXT        NOT NULL,
  start_date DATE        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, start_date)
);

ALTER TABLE pay_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pay_periods"
  ON pay_periods FOR ALL
  USING      (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);
