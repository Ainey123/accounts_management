let _redirecting401 = false;

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
    if (res.status === 401 && typeof window !== 'undefined') {
      // Never redirect for auth endpoints (login/logout) — just throw
      const isAuthPath = path.startsWith('/api/auth/');
      if (!isAuthPath && !_redirecting401) {
        _redirecting401 = true;
        localStorage.removeItem('nexus_user');
        localStorage.removeItem('nexus_active_job');
        document.cookie = 'nexus_user=; path=/; max-age=0';
        // Only redirect if we are NOT already on the login page
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        } else {
          // Already on login page, just reset the flag after a delay
          setTimeout(() => { _redirecting401 = false; }, 2000);
        }
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
