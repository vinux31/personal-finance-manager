-- supabase/migrations/0016_kategori_expense_tambahan.sql
-- Tambah 3 kategori expense untuk tracking pengeluaran harian
INSERT INTO categories (name, type, icon) VALUES
  ('Rokok',   'expense', '🚬'),
  ('Laundry', 'expense', '🧺'),
  ('Kopi',    'expense', '☕')
ON CONFLICT (name, type) DO NOTHING;
