CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX books_title_trgm_idx ON books USING gin (title gin_trgm_ops);
CREATE INDEX books_author_trgm_idx ON books USING gin (author gin_trgm_ops);
