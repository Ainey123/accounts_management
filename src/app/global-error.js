'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body>
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#06070a',
          color: '#f8fafc',
          fontFamily: 'system-ui, sans-serif',
          padding: 20
        }}>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <h1 style={{ fontSize: 24, marginBottom: 16 }}>Something went wrong</h1>
            <p style={{ color: '#94a3b8', marginBottom: 24 }}>
              {error?.message || 'An unexpected error occurred.'}
            </p>
            <button 
              onClick={() => reset()}
              style={{
                padding: '12px 24px',
                background: '#00f2fe',
                color: '#06070a',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
