let _redirecting401 = false;

export async function apiFetch(path, options = {}, retries = 2) {
  const method = options.method || 'GET';
  const url = method === 'GET' ? `${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}` : path;
  
  try {
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

      // Automatically retry idempotent GET queries on transient 5xx / connection pool errors
      if (retries > 0 && method === 'GET' && res.status >= 500) {
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((r) => setTimeout(r, 350 + jitter));
        return apiFetch(path, options, retries - 1);
      }

      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  } catch (err) {
    if (retries > 0 && method === 'GET' && !err.message?.includes('401')) {
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, 350 + jitter));
      return apiFetch(path, options, retries - 1);
    }
    throw err;
  }
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  if (user.role === 'EMPLOYEE') {
    safe.pin = password;
  }
  return safe;
}
