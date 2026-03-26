/**
 * INFLX Shared API Client
 * Platform-agnostic — works in Next.js (web) and React Native (mobile)
 * Token retrieval is injected via getToken() to abstract AsyncStorage vs localStorage
 */

const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:3001/v1';

/**
 * Create an API client bound to a token source.
 * @param {() => Promise<string|null>} getToken - async function returning JWT or null
 * @param {(reason: string) => void} onUnauthorized - called on 401 to clear session
 */
export function createApiClient(getToken, onUnauthorized) {
  async function request(method, path, body, options = {}) {
    const token = await getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method,
      headers,
    };

    if (body !== undefined && body !== null) {
      config.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, config);
    } catch (networkError) {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: 'Unable to connect to server. Check your internet connection.' },
      };
    }

    // Handle 401 — token expired or invalid
    if (response.status === 401) {
      if (onUnauthorized) {
        onUnauthorized('Session expired. Please log in again.');
      }
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' },
      };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return {
        success: false,
        error: { code: 'PARSE_ERROR', message: 'Invalid response from server.' },
      };
    }

    return data;
  }

  return {
    get:    (path, options) => request('GET', path, null, options),
    post:   (path, body, options) => request('POST', path, body, options),
    patch:  (path, body, options) => request('PATCH', path, body, options),
    put:    (path, body, options) => request('PUT', path, body, options),
    delete: (path, options) => request('DELETE', path, null, options),
  };
}

/**
 * Default web client — reads token from localStorage
 * Used by admin-web and brand-web (Next.js client components)
 */
export function createWebClient(onUnauthorized) {
  const getToken = () => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return Promise.resolve(localStorage.getItem('inflx_token'));
  };
  return createApiClient(getToken, onUnauthorized);
}

export { API_BASE_URL };
