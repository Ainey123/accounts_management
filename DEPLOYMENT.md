# 🚀 DEPLOYMENT CHECKLIST

## ✅ Completed
- [x] Gmail OAuth integration built
- [x] Email sync with duplicate prevention
- [x] Database schema updated
- [x] Production build successful
- [x] Environment variables documented
- [x] README with setup instructions

## 📋 TODO: Deploy to Production

### Step 1: Get PostgreSQL Database (FREE options)
Choose ONE:
1. **Supabase**: https://supabase.com/
2. **Neon**: https://neon.tech/
3. **Render**: https://render.com/

Create a database and copy the connection URL.

### Step 2: Set Up Google OAuth
1. Go to: https://console.cloud.google.com/apis/credentials
2. Enable Gmail API
3. Create OAuth 2.0 Client ID (Web application)
4. Add redirect URIs:
   - `http://localhost:3000/api/gmail/callback` (for testing)
   - `https://YOUR-APP.vercel.app/api/gmail/callback` (for production)
5. Copy Client ID and Client Secret

### Step 3: Deploy to Vercel
1. Go to: https://vercel.com
2. Click "New Project"
3. Import your GitHub repo: `Ainey123/accounts_management`
4. Add Environment Variables:
   ```
   DATABASE_URL=postgresql://... (from Step 1)
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name (optional)
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-preset (optional)
   ```
5. Click "Deploy"

### Step 4: Update Google OAuth
After deployment, add your Vercel URL to Google Cloud Console:
- Authorized JavaScript origins: `https://YOUR-APP.vercel.app`
- Authorized redirect URIs: `https://YOUR-APP.vercel.app/api/gmail/callback`

### Step 5: Test
1. Open your Vercel URL
2. Login with: `admin@gmail.com` / `password123`
3. Go to "Gmail Connection"
4. Click "Connect Gmail"
5. Authorize your Google account
6. Click "Sync Emails Now"

## 🎉 Done!

Your app is now live with working Gmail integration!
