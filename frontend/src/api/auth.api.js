import client from './client';

export function login(credentials) {
  return client.post('/auth/login', credentials, { skipAuthRedirect: true });
}

export function getProfile() {
  return client.get('/auth/me');
}
