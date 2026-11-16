import { beforeEach, describe, expect, it, vi } from 'vitest';
import client, { NETWORK_ERROR, configureAuth } from '../src/api/client';

const [request] = client.interceptors.request.handlers;
const [{ fulfilled, rejected }] = client.interceptors.response.handlers;

const apiError = (status, message, config = {}) => ({
  message: `Request failed with status code ${status}`,
  config,
  response: { status, data: { message } },
});

describe('api client', () => {
  const onUnauthorized = vi.fn();

  beforeEach(() => {
    onUnauthorized.mockReset();
    configureAuth({ getToken: () => 'jwt-123', onUnauthorized });
  });

  it('sends the Bearer token', () => {
    const config = request.fulfilled({ headers: {} });

    expect(config.headers.Authorization).toBe('Bearer jwt-123');
  });

  it('sends no Authorization header when signed out', () => {
    configureAuth({ getToken: () => null });

    expect(request.fulfilled({ headers: {} }).headers).not.toHaveProperty('Authorization');
  });

  it('resolves to the `data` field of the API response', () => {
    expect(fulfilled({ data: { data: [{ id: '1' }] } })).toEqual([{ id: '1' }]);
  });

  it('rejects with the API message, status and details', async () => {
    const axiosError = apiError(409, 'Not enough copies available.');
    axiosError.response.data.details = [{ title: 'X' }];

    const error = await rejected(axiosError).catch((err) => err);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Not enough copies available.');
    expect(error.status).toBe(409);
    expect(error.details).toEqual([{ title: 'X' }]);
  });

  it('explains how to fix it when the server cannot be reached', async () => {
    const error = await rejected({ message: 'Network Error', config: {} }).catch((err) => err);

    expect(error.message).toBe(NETWORK_ERROR);
    expect(error.status).toBeUndefined();
  });

  it('keeps the request id from the API for tracing', async () => {
    const axiosError = apiError(500, 'Internal server error');
    axiosError.response.headers = { 'x-request-id': 'req-42' };

    const error = await rejected(axiosError).catch((err) => err);

    expect(error.requestId).toBe('req-42');
  });

  it('ends the session on a 401', async () => {
    await rejected(apiError(401, 'Your session has expired. Sign in again.')).catch(() => {});

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not end the session for a failed sign-in', async () => {
    await rejected(apiError(401, 'Incorrect username or password.', { skipAuthRedirect: true })).catch(() => {});

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
