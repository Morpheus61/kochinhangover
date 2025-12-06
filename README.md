# Rock 4 One - Event Registration App

**Harmony for Humanity** 🎸

A modern event registration and entry management system built with Supabase and vanilla JavaScript.

## 🚀 Quick Setup Guide

### Step 1: Database Setup (Supabase)

1. Go to your new Supabase project: https://supabase.com/dashboard/project/nybbovgdsvbwabuqthbd
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/001_rock4one_setup.sql`
4. Click **Run** to execute the SQL

This will create:
- `guests` table for storing registrations
- `users` table for authentication
- Default admin user: **Admin** / **Rock4One2025**

### Step 2: Update Netlify Environment Variables

1. Go to your Netlify dashboard
2. Navigate to **Site Settings** → **Environment Variables**
3. Update these variables:

```
VITE_SUPABASE_URL=https://nybbovgdsvbwabuqthbd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55YmJvdmdkc3Zid2FidXF0aGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTU5NTIsImV4cCI6MjA4MDMzMTk1Mn0.g-1eRhGpiiOICp0tTPjsvAcuIUYur1NIqw1AOt1tugw
```

### Step 3: Deploy Updated Code

Replace the files in your GitHub repository with the updated files:

- `src/index.html`
- `src/main.js`
- `src/styles.css`
- `src/manifest.json`
- `src/config/supabase.js`
- `src/utils/supabase-client.js`
- `src/utils/whatsapp-share.js`
- `src/icons/*` (all icon files)
- `.env`

Push to your GitHub repository, and Netlify will automatically deploy.

### Step 4: First Login

1. Open your app URL
2. Login with:
   - **Username:** Admin
   - **Password:** Rock4One2025
3. **Important:** Change the admin password immediately after first login!

## 📁 Files Updated

| File | Description |
|------|-------------|
| `src/index.html` | Updated branding, colors, and styling |
| `src/main.js` | New Supabase credentials, updated colors and messages |
| `src/styles.css` | New gold/black color scheme |
| `src/manifest.json` | Updated app name and colors |
| `src/config/supabase.js` | New Supabase connection details |
| `src/icons/*` | New Rock 4 One icons |
| `.env` | Environment variables |
| `supabase/migrations/001_rock4one_setup.sql` | Database schema |

## 🎨 Color Scheme

- **Primary (Gold):** #d4a853
- **Secondary (Red):** #c9302c
- **Accent (Bright Gold):** #f5d76e
- **Dark (Black):** #0a0a0a
- **Light (Warm White):** #fff8e7

## 👤 User Roles

- **Admin:** Full access to all features
- **Staff:** Access to registration, guests, and stats
- **Doorman:** Access to entry verification and guest list only

## 📱 Features

- ✅ Guest Registration
- ✅ QR Code Generation & Scanning
- ✅ WhatsApp Pass Sharing
- ✅ Entry Verification
- ✅ Statistics Dashboard
- ✅ PDF/CSV Export
- ✅ PWA Support (installable)
- ✅ Offline Support

## 🔒 Security Notes

1. Change the default admin password after setup
2. The app uses Row Level Security (RLS) in Supabase
3. All API keys are safe for client-side use (anon key only)

## 📞 Support

For issues or customizations, contact your developer.

---

**Rock 4 One** - Harmony for Humanity 🎸
