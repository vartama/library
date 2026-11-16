import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Set by the store (configureAuth) so this module does not import the store back.
let auth = {
  getToken: () => null,
  onUnauthorized: () => {},
};

export function configureAuth(handlers) {
  auth = { ...auth, ...handlers };
}

client.interceptors.request.use((config) => {
  const token = auth.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// No response at all: the API is down, the URL is wrong or CORS blocked the request.
export const NETWORK_ERROR = 'Cannot reach the server. Check that the API is running and try again.';

// Logged in the browser console during development, with the request id from the API, so a
// failure can be matched with the backend log line `[req <id>]`.
function logApiError({ method, url, status, message, requestId }) {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return;
  console.error(
    `[api] ${method?.toUpperCase()} ${url} → ${status ?? 'no response'}: ${message}`,
    requestId ? `(request ${requestId})` : `(baseURL ${client.defaults.baseURL})`,
  );
}

// Successful responses resolve to the API's `data` field; failures reject with an Error whose
// message comes from the API, so components can show `err.message` directly.
// A 401 means the session is gone, except on the sign-in request itself (`skipAuthRedirect`).
client.interceptors.response.use(
  (res) => res.data?.data,
  (err) => {
    const status = err.response?.status;
    const message = err.response ? err.response.data?.message || err.message : NETWORK_ERROR;
    const requestId = err.response?.headers?.['x-request-id'];

    logApiError({ method: err.config?.method, url: err.config?.url, status, message, requestId });

    if (status === 401 && !err.config?.skipAuthRedirect) {
      auth.onUnauthorized();
    }

    const error = new Error(message);
    error.status = status;
    error.details = err.response?.data?.details;
    error.requestId = requestId;
    return Promise.reject(error);
  },
);

export default client;
