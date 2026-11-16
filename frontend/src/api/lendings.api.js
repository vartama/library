import client from './client';

export function createLending(lending) {
  return client.post('/lendings', lending);
}

export function getLendings() {
  return client.get('/lendings');
}
