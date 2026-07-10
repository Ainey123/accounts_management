export async function apiFetch(path, options = {}) {
  const method = options.method || 'GET';
  const url = method === 'GET' ? `${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}` : path;
  
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    cache: 'no-store',
    ...options,
  });
  const contentType = res.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  
  let data = {};
  if (isJson) {
    data = await res.json().catch(() => ({}));
  } else {
    throw new Error(`API returned non-JSON response (status: ${res.status}). You might need to log in again.`);
  }

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}
