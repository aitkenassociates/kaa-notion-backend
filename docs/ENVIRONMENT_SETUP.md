# KAA Notion Backend - Environment Setup Guide

Complete guide for setting up the development, staging, and production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Environment Variables](#environment-variables)
4. [Database Setup](#database-setup)
5. [External Services](#external-services)
6. [CI/CD Configuration](#cicd-configuration)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| Node.js | 18.x or higher | [nodejs.org](https://nodejs.org) |
| npm | 9.x or higher | Included with Node.js |
| Git | 2.x or higher | [git-scm.com](https://git-scm.com) |
| PostgreSQL | 14+ (optional) | Via Supabase or local |

### Verify Installation

```bash
node --version    # Should be v18.x or higher
npm --version     # Should be 9.x or higher
git --version     # Should be 2.x or higher
```

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url> kaa-notion-backend
cd kaa-notion-backend
```

### 2. Install Dependencies

```bash
# Install all dependencies (root + frontend)
npm run install-all
```

### 3. Set Up Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your values
nano .env
```

### 4. Initialize the Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations (requires DATABASE_URL)
npm run prisma:migrate

# Optional: Open Prisma Studio to view data
npm run prisma:studio
```

### 5. Start Development Server

```bash
# Start both backend and frontend
npm run dev

# Or start individually:
npm start              # Backend only (port 3001)
cd kaa-app && npm start  # Frontend only (port 3000)
```

---

## Environment Variables

### Backend Server (.env)

Create a `.env` file in the root directory:

```env
# ===================
# Server Configuration
# ===================
NODE_ENV=development
PORT=3001

# ===================
# Database (Supabase)
# ===================
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
SUPABASE_URL="https://[PROJECT].supabase.co"
SUPABASE_ANON_KEY="[your-anon-key]"
SUPABASE_SERVICE_ROLE_KEY="[your-service-role-key]"

# ===================
# Notion Integration
# ===================
NOTION_API_KEY="secret_[your-notion-key]"
NOTION_DATABASE_ID="[your-database-id]"
NOTION_PROJECTS_DB_ID="[projects-database-id]"

# ===================
# Stripe Payment
# ===================
STRIPE_SECRET_KEY="sk_test_[your-key]"
STRIPE_WEBHOOK_SECRET="whsec_[your-secret]"
STRIPE_PRICE_TIER_1="price_[tier1-id]"
STRIPE_PRICE_TIER_2="price_[tier2-id]"
STRIPE_PRICE_TIER_3="price_[tier3-id]"

# ===================
# OpenAI (Chat/AI)
# ===================
OPENAI_API_KEY="sk-[your-key]"

# ===================
# Authentication
# ===================
JWT_SECRET="[your-jwt-secret-min-32-chars]"
JWT_EXPIRES_IN="7d"

# ===================
# Email (Nodemailer)
# ===================
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="[email-user]"
SMTP_PASS="[email-password]"
EMAIL_FROM="noreply@kaa.com"
```

### Frontend (.env - kaa-app/)

Create a `.env` file in the `kaa-app/` directory:

```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SUPABASE_URL="https://[PROJECT].supabase.co"
REACT_APP_SUPABASE_ANON_KEY="[your-anon-key]"
REACT_APP_STRIPE_PUBLIC_KEY="pk_test_[your-key]"
```

### Test Environment (.env.test)

A separate environment file for running tests:

```env
NODE_ENV=test
DATABASE_URL="postgresql://test:test@localhost:5432/kaa_test"
SUPABASE_URL="https://test.supabase.co"
SUPABASE_ANON_KEY="test-anon-key"
NOTION_API_KEY="test-notion-key"
STRIPE_SECRET_KEY="sk_test_placeholder"
JWT_SECRET="test-jwt-secret-for-testing-only"
```

---

## Database Setup

### Using Supabase (Recommended)

1. Create a project at [supabase.com](https://supabase.com)
2. Get your connection string from **Settings > Database > Connection string**
3. Copy the URL to your `.env` as `DATABASE_URL`
4. Run migrations:

```bash
npm run prisma:migrate
```

### Local PostgreSQL (Alternative)

```bash
# Create local database
createdb kaa_development

# Update DATABASE_URL
DATABASE_URL="postgresql://localhost:5432/kaa_development"

# Run migrations
npm run prisma:migrate
```

### Database Commands

```bash
npm run prisma:generate   # Regenerate Prisma client
npm run prisma:migrate    # Create/run migrations
npm run prisma:deploy     # Deploy migrations (production)
npm run prisma:studio     # Open database GUI
npm run prisma:seed       # Seed initial data
```

---

## External Services

### Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Copy the "Internal Integration Token"
4. Share your databases with the integration
5. Add to `.env`:

```env
NOTION_API_KEY="secret_..."
NOTION_DATABASE_ID="..."
```

### Stripe Payment

1. Create account at [stripe.com](https://stripe.com)
2. Get API keys from Dashboard > Developers > API keys
3. Create products and prices for each tier
4. Add to `.env`:

```env
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### For Webhook Testing (Local)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/payments/webhook
```

### OpenAI API

1. Create account at [platform.openai.com](https://platform.openai.com)
2. Generate API key from Dashboard > API Keys
3. Add to `.env`:

```env
OPENAI_API_KEY="sk-..."
```

---

## CI/CD Configuration

### GitHub Actions Secrets

Add these secrets in your GitHub repository (Settings > Secrets > Actions):

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel deployment token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Frontend Vercel project ID |
| `VERCEL_API_PROJECT_ID` | Backend Vercel project ID |
| `REACT_APP_API_URL` | Production API URL |
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI token (optional) |

### Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `ci.yml` | Push/PR to main, develop | Run tests, lint, build |
| `deploy.yml` | Push to main | Deploy to production |
| `lighthouse.yml` | Push to main, staging | Performance auditing |

---

## Deployment

### Vercel Deployment

The project is configured for Vercel deployment.

#### Automatic Deployment

Pushes to `main` branch trigger automatic deployment via GitHub Actions.

#### Manual Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd kaa-app
vercel

# Deploy backend (from root)
vercel
```

### Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings > Environment Variables
3. Add all required variables from `.env`
4. Select appropriate environments (Production, Preview, Development)

---

## Troubleshooting

### Common Issues

#### "Cannot find module '@prisma/client'"

```bash
npm run prisma:generate
```

#### "Connection refused" on database

- Check `DATABASE_URL` is correct
- Ensure database is running
- Verify network access/firewall rules

#### "CORS error" in browser

- Verify `REACT_APP_API_URL` matches backend URL
- Check CORS configuration in `notion-api-server-enhanced.js`

#### "Notion API error: unauthorized"

- Verify `NOTION_API_KEY` is correct
- Ensure integration has access to the database
- Check database sharing permissions

### Port Conflicts

```bash
# Find process using a port
lsof -i :3000

# Kill process
kill -9 [PID]
```

### Reset Development Environment

```bash
# Remove dependencies
rm -rf node_modules kaa-app/node_modules

# Clear cache
npm cache clean --force

# Reinstall
npm run install-all

# Reset database
npm run prisma:migrate -- --force
```

---

## Quick Start Checklist

- [ ] Node.js 18+ installed
- [ ] Repository cloned
- [ ] Dependencies installed (`npm run install-all`)
- [ ] `.env` file created with all variables
- [ ] Database connection working
- [ ] Prisma client generated
- [ ] Migrations applied
- [ ] Backend server starts (`npm start`)
- [ ] Frontend server starts (`cd kaa-app && npm start`)
- [ ] Can access http://localhost:3000
- [ ] API health check passes (http://localhost:3001/api/health)

---

## Support

For issues:
- Check existing documentation in `/docs`
- Review error logs
- Consult the main `CLAUDE.md` file for project context
