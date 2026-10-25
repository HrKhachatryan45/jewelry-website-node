// Tiny fetch wrapper for the Luxe Jewelry REST API.
// Sends cookies (JWT + guest cart) and normalises errors.

const BASE = '/api';

export async function api(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const opts = { method, credentials: 'include', headers: { ...headers } };

  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return raw ? res : data;
}

export const get = (p) => api(p);
export const post = (p, body) => api(p, { method: 'POST', body });
export const put = (p, body) => api(p, { method: 'PUT', body });
export const del = (p) => api(p, { method: 'DELETE' });

// Formatting helpers shared with the public site.
export const money = (n) => new Intl.NumberFormat('hy-AM').format(Math.round(Number(n) || 0));
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('hy-AM', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
