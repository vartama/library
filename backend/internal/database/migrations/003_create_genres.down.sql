ALTER TABLE books ADD COLUMN genre TEXT;

UPDATE books b
SET genre = g.name
FROM genres g
WHERE b.genre_id = g.id;

ALTER TABLE books ALTER COLUMN genre SET NOT NULL;
DROP INDEX IF EXISTS books_genre_id_idx;
ALTER TABLE books DROP COLUMN genre_id;
DROP TABLE IF EXISTS genres;
