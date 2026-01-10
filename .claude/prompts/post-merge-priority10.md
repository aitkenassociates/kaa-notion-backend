# Post-Merge Setup: Priority 10 Features

Run these steps after merging the Priority 10 branch to set up the new features.

## Step 1: Database Migration

Run Prisma migration to create the new database tables for Priority 10 features:

```bash
npx prisma migrate dev --name priority10_future_enhancements
```

This creates tables for:
- TeamMember, ProjectAssignment (team collaboration)
- Subscription (billing)
- Referral, ReferralCredit (referral system)
- PortfolioProject, PortfolioImage (portfolio gallery)

And adds columns:
- Client: maxProjects, referralCode
- Project: archivedAt

## Step 2: Environment Variables

Add these environment variables to `.env`:

```env
# Stripe Subscription (required for subscription billing)
STRIPE_SPROUT_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_SPROUT_YEARLY_PRICE_ID=price_xxxxx
STRIPE_CANOPY_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_CANOPY_YEARLY_PRICE_ID=price_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Push Notifications (required for PWA push)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

To generate VAPID keys:
```bash
npx web-push generate-vapid-keys
```

## Step 3: Stripe Product Setup

Create subscription products in Stripe Dashboard:

1. **Sprout (Tier 2)**
   - Monthly: $49/month
   - Yearly: $470/year (20% discount)

2. **Canopy (Tier 3)**
   - Monthly: $99/month
   - Yearly: $950/year

3. **Configure Webhook**
   - Endpoint: `https://yourdomain.com/api/subscriptions/webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`

## Step 4: Generate Prisma Client

Regenerate the Prisma client to include new models:

```bash
npx prisma generate
```

## Step 5: Seed Initial Data (Optional)

Create an initial team owner:

```typescript
// Run in Prisma Studio or create a seed script
await prisma.teamMember.create({
  data: {
    userId: 'your-admin-user-id',
    role: 'OWNER',
    isActive: true,
    acceptedAt: new Date(),
  },
});
```

## Step 6: Verify Installation

Test the new endpoints:

```bash
# Portfolio
curl http://localhost:3001/api/portfolio
curl http://localhost:3001/api/portfolio/categories
curl http://localhost:3001/api/portfolio/featured

# Subscriptions
curl http://localhost:3001/api/subscriptions/pricing

# Referrals
curl http://localhost:3001/api/referrals/config

# Team (requires auth)
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/team/members
```

## Step 7: Frontend Routes (Manual)

Add routes to your React Router configuration:

```tsx
// In your router config
<Route path="/portfolio" element={<PortfolioGallery />} />
<Route path="/settings/subscription" element={<SubscriptionManagement />} />
<Route path="/settings/referrals" element={<ReferralDashboard />} />
<Route path="/admin/team" element={<TeamManagement />} />
```

## Verification Checklist

- [ ] Database migration completed successfully
- [ ] All environment variables configured
- [ ] Stripe products and webhook created
- [ ] Prisma client regenerated
- [ ] API endpoints responding
- [ ] Frontend components accessible
- [ ] Team owner created (for team management)
