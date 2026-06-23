# 🚀 PERMANENT DEPLOYMENT GUIDE

## ✅ Current Status
- [x] Gmail OAuth integration built
- [x] Complaint-only email filtering built
- [x] Email sync with duplicate prevention
- [x] Route protection middleware added
- [x] Database schema updated
- [x] Production build successful
- [x] Environment variables documented

## 🎯 Goal: Permanent Live App with Non-Expiring Links

### Step 1: Get PostgreSQL Database (FREE — Permanent)
Choose ONE:
1. **Supabase**: https://supabase.com/ (recommended — free tier forever)
2. **Neon**: https://neon.tech/ (free tier available)
3. **Render**: https://render.com/ (free tier available)

Create a database and copy the **connection URL** (looks like `postgresql://user:password@host:port/database`).

### Step 2: Set Up Google OAuth (Permanent — CRITICAL)

#### 2a. Create OAuth Client
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **"Create Project"** if needed (name it anything)
3. Click **"Enable APIs and Services"** → Search **"Gmail API"** → Enable
4. Go to **"Credentials"** → **"Create Credentials"** → **"OAuth client ID"**
5. Application type: **Web application**
6. Name: anything (e.g. "NEXUS Operations")
7. **Authorized redirect URIs** — add BOTH:
   - `http://localhost:3000/api/gmail/callback`
   - `https://accounts-management-eight.vercel.app/api/gmail/callback`
8. Click **Create** and copy:
   - **Client ID**
   - **Client Secret**

#### 2b. Configure OAuth Consent Screen (REQUIRED — fixes "Error 400")
1. In Google Cloud Console, go to **"OAuth consent screen"**
2. User Type: **External** (unless you have Google Workspace)
3. Click **"Create"**
4. Fill **ALL** required fields:
   - **App name**: NEXUS Operations
   - **User support email**: your email
   - **Developer contact information**: your email
5. Click **"Save and Continue"**
6. **Scopes**: Click **"Add or Remove Scopes"** → Add:
   - `.../auth/gmail.readonly`
   - `.../auth/userinfo.email`
7. Click **"Save and Continue"**
8. **Test users**: Click **"Add Users"** and add:
   - `fesopreatio@gmail.com`
   - `quratullainsabir@gmail.com`
9. Click **"Save and Continue"**
10. Click **"Back to Dashboard"**
11. **IMPORTANT**: Click **"Publish App"** button at the top (change from "Testing" to "In production")

#### 2c. Why "Error 400" Happens
- If the consent screen is incomplete → Google blocks with "Authorization Error"
- If the user is not added as a test user → Access blocked
- If the redirect URI doesn't match exactly → Invalid request
- The fix is completing ALL steps in 2b above

### Step 3: Deploy to Vercel (Permanent Free Hosting)
1. Go to: https://vercel.com
2. Click **"Add New..." → "Project"**
3. Import your GitHub repo: `Ainey123/accounts_management`
4. Add **Environment Variables** (these are stored permanently on Vercel):
   ```
   DATABASE_URL=postgresql://... (from Step 1)
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   APP_URL=https://accounts-management-eight.vercel.app
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name (optional)
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-upload-preset (optional)
   ```
5. Click **"Deploy"**

> **Note**: Vercel's free tier gives you a permanent URL like `https://accounts-management-eight.vercel.app`. 
> This URL never expires as long as the project exists on Vercel.

### Step 4: Connect Your Gmail
1. Open your Vercel URL
2. Login with your credentials
3. Go to **"Gmail Connection"** in the sidebar
4. Click **"Connect Gmail"**
5. Authorize your Google account
6. Click **"Sync Complaint Emails Now"**

## 🔒 Route Protection (New)

The app now has server-side route protection via middleware:
- Unauthenticated users are redirected to login
- Employees cannot access admin routes
- All routes except `/`, `/api/auth/login`, and Gmail callbacks are protected

## 🔒 How Complaint Filtering Works

The app automatically filters emails to only keep **complaints**:

**Complaint Keywords Detected:**
- complaint, issue, problem, fault, urgent, repair, breakdown, error
- not working, malfunction, maintenance, service, assistance, help
- ticket, work order, electrical, WAPDA, outage, failure, hazard

**Auto-Excluded Senders:**
- linkedin.com, google.com, google security alerts
- GitHub notifications, newsletters, marketing emails

**Auto-Excluded Subjects:**
- Security alerts, new sign-in, password changed, account activity
- Welcome emails, job recommendations, weekly digests

## 🎉 Done!

Your app is now **permanently live** with:
- ✅ Permanent Vercel URL (never expires)
- ✅ Server-side route protection (no more bypassing login)
- ✅ Gmail connected to `fesopreatio@gmail.com`
- ✅ Complaint-only email sync
- ✅ Date, time, subject, and sender extraction
- ✅ Non-complaint emails automatically filtered out

Share the Vercel URL with anyone — it will work permanently!
