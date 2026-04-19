export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    icon TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, type)
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    category_id INTEGER NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS investments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_type TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity >= 0),
    buy_price REAL NOT NULL CHECK(buy_price >= 0),
    current_price REAL CHECK(current_price >= 0),
    buy_date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investment_id INTEGER NOT NULL,
    price REAL NOT NULL CHECK(price >= 0),
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (investment_id) REFERENCES investments(id)
);

CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL CHECK(target_amount > 0),
    current_amount REAL DEFAULT 0 CHECK(current_amount >= 0),
    target_date DATE,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date DATE NOT NULL,
    linked_transaction_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (linked_transaction_id) REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`

export const DEFAULT_CATEGORIES: Array<[string, 'income' | 'expense']> = [
  ['Makanan', 'expense'],
  ['Transportasi', 'expense'],
  ['Hiburan', 'expense'],
  ['Tagihan', 'expense'],
  ['Kesehatan', 'expense'],
  ['Belanja', 'expense'],
  ['Lainnya', 'expense'],
  ['Gaji', 'income'],
  ['Bonus', 'income'],
  ['Dividen', 'income'],
  ['Lainnya', 'income'],
]
