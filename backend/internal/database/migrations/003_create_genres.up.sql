CREATE TABLE genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX genres_name_lower_idx ON genres (LOWER(name));

INSERT INTO genres (name)
SELECT DISTINCT genre FROM books
ON CONFLICT DO NOTHING;

ALTER TABLE books ADD COLUMN genre_id UUID REFERENCES genres(id) ON DELETE RESTRICT;

UPDATE books b
SET genre_id = g.id
FROM genres g
WHERE LOWER(b.genre) = LOWER(g.name);

ALTER TABLE books ALTER COLUMN genre_id SET NOT NULL;
ALTER TABLE books DROP COLUMN genre;

CREATE INDEX books_genre_id_idx ON books (genre_id);
