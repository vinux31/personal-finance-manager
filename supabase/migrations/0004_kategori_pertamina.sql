-- supabase/migrations/0004_kategori_pertamina.sql
-- Tambah 5 kategori income khusus Pertamina
INSERT INTO categories (name, type, icon) VALUES
  ('THR Keagamaan',          'income', '💰'),
  ('IKI (Insentif Kinerja)', 'income', '📈'),
  ('Jaspro / Tantiem',       'income', '🏭'),
  ('Gaji ke-13',             'income', '💵'),
  ('Tunjangan Cuti',         'income', '🏖️')
ON CONFLICT (name, type) DO NOTHING;
