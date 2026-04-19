CREATE TABLE goal_investments (
  id             BIGSERIAL PRIMARY KEY,
  goal_id        BIGINT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  investment_id  BIGINT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  allocation_pct NUMERIC(5,2) NOT NULL CHECK (allocation_pct > 0 AND allocation_pct <= 100),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(goal_id, investment_id)
);

ALTER TABLE goal_investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_all_goal_investments
  ON goal_investments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
