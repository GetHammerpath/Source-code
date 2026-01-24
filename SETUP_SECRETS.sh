#!/bin/bash
# ⚠️ SECURITY WARNING: This script should NEVER contain actual secrets!
# All secrets should be set via Supabase Dashboard or CLI with actual values
# This script is for reference only
# Script to set Supabase Edge Function secrets
# Run this after linking to your Supabase project

echo "Setting Supabase Edge Function secrets..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Link to project (if not already linked)
echo "📋 Make sure you're linked to the project first:"
echo "   supabase link --project-ref wzpswnuteisyxxwlnqrn"
echo ""
read -p "Press Enter to continue once linked..."

# Set Supabase secrets
echo "🔐 Setting Supabase configuration secrets..."
supabase secrets set SUPABASE_URL=https://wzpswnuteisyxxwlnqrn.supabase.co
supabase secrets set SUPABASE_ANON_KEY=sb_publishable_Rvk6d-mQaD7LN-FjXZjwXg_nc5HIHJ_
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cHN3bnV0ZWlzeXh4d2xucXJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIxOTA1NSwiZXhwIjoyMDc0Nzk1MDU1fQ.7i1WfKIVo281KC_y8jdLB36WJHVdw5ThY92eNVE_nQ8

# Set Provider API keys
echo "🎬 Setting provider API keys..."
supabase secrets set KIE_AI_API_TOKEN=36472cd29581ffdb407f9ffb15923264
supabase secrets set FAL_API_KEY=0ef6de6b-6145-4d18-b7c6-37f95f7cefde:2e433fd0dc9930381111d8db44fdb4bc
supabase secrets set OPENAI_API_KEY=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

# Set pricing configuration
echo "💰 Setting pricing configuration..."
supabase secrets set KIE_COST_PER_MINUTE=0.20
supabase secrets set CREDIT_MARKUP_MULTIPLIER=3
supabase secrets set CREDITS_PER_MINUTE=1

# Set Stripe secret key
# ⚠️ SECURITY: Never commit actual keys to git!
# Get your key from: Stripe Dashboard → Developers → API keys
echo "💳 Setting Stripe secret key..."
echo "⚠️  Please set STRIPE_SECRET_KEY manually in Supabase Dashboard"
echo "   Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions"
echo "   Add secret: STRIPE_SECRET_KEY = (your key from Stripe Dashboard)"
# supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_KEY_HERE

# Set Stripe webhook secret
echo "🔐 Setting Stripe webhook secret..."
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_LsQYDIUAdMbemoh51e6rrtSPeMXhi3Hj

# Set site URL (update this to your production URL)
echo "🌐 Setting site URL..."
supabase secrets set SITE_URL=http://localhost:8080

echo ""
echo "✅ Almost all secrets configured!"
echo ""
echo "⚠️  You still need to set:"
echo "   STUDIO_ACCESS_PRICE_ID (price_...) - after creating $99/month product in Stripe"
echo ""
echo "Set it via:"
echo "   supabase secrets set STUDIO_ACCESS_PRICE_ID=price_..."
