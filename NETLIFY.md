# Netlify Deployment Guide

This project has been updated to support deployment on Netlify with full background scheduling capabilities.

## 1. Environment Variables

You must set the following environment variables in your Netlify Site Settings (**Site settings > Build & deploy > Environment > Environment variables**):

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL (e.g., `https://xxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anon/Public Key |
| `SUPABASE_SERVICE_ROLE_KEY` | **CRITICAL**: Your Supabase Service Role Key (found in API settings). This is required for background functions to update the database. |
| `APIFY_TOKEN` | Your primary Apify API Token. |
| `APIFY_TOKEN2` | (Optional) A fallback Apify API Token for rotation. |
| `GOOGLE_CLIENT_ID` | Your Google OAuth2 Client ID (for Gmail OAuth). |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth2 Client Secret. |
| `REDIRECT_URI` | Your deployed site's callback URL (e.g., `https://your-site.netlify.app/api/oauth-callback`). |
| `URL` | (Auto-set by Netlify) Used for tracking links. |

## 2. Functions

The following functions have been created in `netlify/functions`:

- `send-email`: Sends emails via Gmail SMTP or OAuth2.
- `process-queue`: Manually triggers the email queue.
- `process-queue-scheduled`: **Scheduled Function** that runs every minute to send scheduled emails.
- `find-email`: Synchronous profile finding for quick autofill.
- `find-email-background`: **Background Function** that performs the full 24-actor waterfall finding (up to 15 mins).
- `create-draft`: Creates drafts in Gmail.
- `oauth-callback`: Handles Google OAuth2 redirect.
- `track`: Handles link and open tracking.

## 3. Scheduled Tasks

The `process-queue-scheduled` function is configured to run every minute (`* * * * *`). This ensures that even when your browser is closed, Zangsend will continue to send scheduled emails according to your distribution settings.

## 4. Long-running Tasks (Email Finding)

The email finding process now uses Netlify **Background Functions**. When you click "Find Emails", the frontend triggers a background task and then polls the database for results. This allows the process to run for up to 15 minutes, far exceeding the standard 10s limit.
