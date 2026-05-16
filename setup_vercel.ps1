# Vercel Environment Setup Script (FULLY AUTOMATIC)
Write-Host "--- Zangsend Vercel Environment Setup ---" -ForegroundColor Cyan

# 1. Link project if needed
Write-Host "Linking project to Vercel (using name: zangsend)..."
vercel link --yes --project zangsend

# 2. Define All Variables (Retrieved from Netlify and Supabase)
$envVars = @{
    "VITE_SUPABASE_URL" = "https://hdfbgixlgofjafkgfkin.supabase.co"
    "VITE_SUPABASE_ANON_KEY" = "sb_publishable_AzbE8Kvsv7XWcMHB2hwcVg_mRnOvt1S"
    "VITE_GOOGLE_CLIENT_ID" = "495214771463-bfil484vu8nct7r4caru65l94pa7jqbb.apps.googleusercontent.com"
    "GOOGLE_CLIENT_ID" = "495214771463-bfil484vu8nct7r4caru65l94pa7jqbb.apps.googleusercontent.com"
    "GOOGLE_CLIENT_SECRET" = "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"
    "APIFY_TOKEN" = "apify_api_DgnvKfO37PtqUZGcZKn6bNzvhKdbXq4jViUV"
    "APIFY_TOKEN2" = "apify_api_ibKagGGKFMueztXM2HxupPOlsDIoVc0Z8hkK"
    "GITHUB_TOKEN" = "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"
    "TELEGRAM_BOT_TOKEN" = "8611092343:AAGSLtQIn6weRg6eHFy1wOxg5SAeVIK8xuQ"
    "SUPABASE_URL" = "https://hdfbgixlgofjafkgfkin.supabase.co"
    "SUPABASE_ANON_KEY" = "sb_publishable_AzbE8Kvsv7XWcMHB2hwcVg_mRnOvt1S"
    "SUPABASE_SERVICE_ROLE_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZmJnaXhsZ29mamFma2dma2luIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc1ODcwMCwiZXhwIjoyMDk0MzM0NzAwfQ.93QYqY5UhILnT81FeMM807im41dmgtidmNkuwsn5RCQ"
}

# 3. Add Variables to Vercel
foreach ($key in $envVars.Keys) {
    Write-Host "Adding $key..."
    $val = $envVars[$key]
    # Use -y to bypass interactive confirmation if possible, or just pipe
    echo $val | vercel env add $key production
    echo $val | vercel env add $key preview
    echo $val | vercel env add $key development
}

Write-Host ""
Write-Host "✅ All environment variables added successfully!" -ForegroundColor Green
Write-Host "You can now deploy by running: vercel --prod" -ForegroundColor Cyan
