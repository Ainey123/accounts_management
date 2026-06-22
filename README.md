# NEXUS OPERATIONS - Enterprise Management System

Production-grade multi-tenant operations platform with Gmail integration.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Google Cloud Console account (for Gmail OAuth)

### Local Development Setup

1. **Clone and install:**
```bash
git clone https://github.com/Ainey123/accounts_management.git
cd accounts_management
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` and add your credentials (see Google OAuth Setup below).

3. **Initialize database:**
```bash
npx prisma generate
npx prisma db push
npm run seed  # Creates admin and employee users
```

4. **Run development server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Default Login Credentials
- **Admin:** `admin@gmail.com` / `password123`
- **Employee:** `user@gmail.com` / `user123`

## 📧 Google OAuth Setup (Required for Gmail Integration)

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Gmail API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it

### Step 2: Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Configure OAuth consent screen:
   - User Type: External
   - App name: NEXUS Operations
   - User support email: your email
   - Developer contact: your email
4. Create OAuth client ID:
   - Application type: **Web application**
   - Name: NEXUS Operations Web
   - **Authorized JavaScript origins:**
     - `http://localhost:3000` (development)
     - `https://your-app.vercel.app` (production)
   - **Authorized redirect URIs:**
     - `http://localhost:3000/api/gmail/callback` (development)
     - `https://your-app.vercel.app/api/gmail/callback` (production)
5. Copy your **Client ID** and **Client Secret**

### Step 3: Add to .env
```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

## 🗄️ Database Configuration

### Development (SQLite)
Already configured in `.env`:
```env
DATABASE_URL="file:./prisma/dev.db"
```

### Production (PostgreSQL)
Get a PostgreSQL database from:
- [Supabase](https://supabase.com/) (Free tier available)
- [Neon](https://neon.tech/) (Free tier available)
- [Render](https://render.com/) (Free tier available)

Add to `.env`:
```env
DATABASE_URL="postgresql://user:password@host:port/database"
```

## 🌐 Vercel Deployment

### Step 1: Push to GitHub
```bash
git add .
git commit -m "feat: complete Gmail OAuth integration and production setup"
git push origin main
```

### Step 2: Deploy to Vercel
1. Go to [Vercel](https://vercel.com/)
2. Import your GitHub repository
3. Configure Environment Variables:
   - `DATABASE_URL` (PostgreSQL URL)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
   - `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
4. Update Google Cloud Console redirect URI to: `https://your-app.vercel.app/api/gmail/callback`
5. Deploy!

## 📁 Project Structure

```
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed script
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── gmail-oauth/    # Google OAuth endpoints
│   │   │   ├── gmail-sync/     # Email sync endpoint
│   │   │   ├── gmail-account/  # Account management
│   │   │   └── gmail/          # Save emails to DB
│   │   ├── gmail/              # Gmail connection UI
│   │   └── ...
│   └── components/
└── .env.example
```

## 🔑 Features

### Gmail Integration
- ✅ OAuth 2.0 authentication
- ✅ Automatic email scanning
- ✅ Duplicate prevention
- ✅ Stores: sender, subject, date, time
- ✅ No replies sent to Gmail (read-only)

### Database
- ✅ User management (Admin/Employee roles)
- ✅ Gmail OAuth token storage
- ✅ Ticket/email tracking
- ✅ Job metadata management
- ✅ Expense tracking
- ✅ Quotation & invoice system

### Security
- ✅ Password hashing (scrypt)
- ✅ Secure token storage
- ✅ Role-based access control
- ✅ Environment variable protection

## 🛠️ Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npx prisma studio    # Open database GUI
```

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | ✅ |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | ❌ |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary upload preset | ❌ |

## 🐛 Troubleshooting

### OAuth not working?
1. Check redirect URIs match exactly in Google Cloud Console
2. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
3. Check browser console for errors

### Database connection failed?
1. Verify `DATABASE_URL` is correct
2. Run `npx prisma db push` to sync schema
3. Check database provider is accessible

### Gmail sync not fetching emails?
1. Ensure Gmail account is connected
2. Check OAuth scopes include `gmail.readonly`
3. Verify Gmail API is enabled in Google Cloud Console

## 📄 License

Private - All rights reserved

## 👥 Support

For issues or questions, contact the development team.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
