import { NextResponse } from 'next/server';

// OAuth callback handler - shows HTML page to communicate with parent window
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Gmail Connection</title>
    </head>
    <body style="background: #0f1117; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
      <div style="text-align: center;">
        <div style="font-size: 18px; color: #94a3b8; margin-bottom: 16px; font-family: system-ui;">
          ${error ? 'Connection failed' : 'Completing Gmail connection...'}
        </div>
        <div style="width: 40px; height: 40px; margin: 0 auto; border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #00f2fe; border-radius: 50%; animation: spin 1s linear infinite;" />
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      <script>
        (async () => {
          try {
            ${error 
              ? `window.opener?.postMessage({ type: 'gmail-oauth-error', error: '${error}' }, '*');`
              : code 
                ? `
                  const response = await fetch('/api/gmail-oauth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: '${code}' }),
                  });
                  const data = await response.json();
                  if (data.success) {
                    window.opener?.postMessage({ type: 'gmail-oauth-success', email: data.email, tokens: data.tokens }, '*');
                  } else {
                    window.opener?.postMessage({ type: 'gmail-oauth-error', error: data.error }, '*');
                  }
                `
                : `window.opener?.postMessage({ type: 'gmail-oauth-error', error: 'No code received' }, '*');`
            }
          } catch (err) {
            window.opener?.postMessage({ type: 'gmail-oauth-error', error: err.message }, '*');
          }
          setTimeout(() => window.close(), 1000);
        })();
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
