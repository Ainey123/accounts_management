'use client';

export default function Error({ error, reset }) {
  return (
    <div style={{ 
      minHeight: '60vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 40
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Page failed to load</h2>
        <p style={{ color: '#94a3b8', marginBottom: 24 }}>
          {error?.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <button 
          onClick={() => reset()}
          className="nexus-btn nexus-btn-primary"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
