CREATE TABLE lendings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  due_date DATE NOT NULL,
  lent_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  lent_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lending_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lending_id UUID NOT NULL REFERENCES lendings(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1)
);

CREATE INDEX lendings_created_at_idx ON lendings (created_at DESC);
CREATE INDEX lending_items_lending_id_idx ON lending_items (lending_id);
