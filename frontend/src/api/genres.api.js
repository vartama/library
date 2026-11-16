import client from './client';

export function getGenres() {
  return client.get('/genres');
}

export function createGenre(genre) {
  return client.post('/genres', genre);
}

export function updateGenre(id, changes) {
  return client.patch(`/genres/${id}`, changes);
}

export function deleteGenre(id) {
  return client.delete(`/genres/${id}`);
}
