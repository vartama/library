import client from './client';

export function getBooks(params) {
  return client.get('/books', { params });
}

export function getOverview() {
  return client.get('/books/overview');
}

export function createBook(book) {
  return client.post('/books', book);
}

export function deleteBook(id) {
  return client.delete(`/books/${id}`);
}

export function updateBook(id, changes) {
  return client.patch(`/books/${id}`, changes);
}
