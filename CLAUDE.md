# KAA Notion Backend - Project Context for Claude Code

## Project Overview
SAGE MVP Platform - A full-stack application providing tiered landscape architecture services with Notion integration for project management and Supabase for data persistence.

## Architecture
```
kaa-notion-backend/
├── notion-api-server-enhanced.js  # Main Express API server
├── kaa-app/                       # React frontend (TypeScript)
├── prisma/                        # Database schema & migrations
├── server/                        # Additional server modules
└── docs/                          # Documentation
```

## Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS
- **Backend:** Express.js, Node.js
- **Database:** Supabase (PostgreSQL) via Prisma ORM
- **External APIs:** Notion API, Stripe, OpenAI
- **Deployment:** Vercel

## Development Commands
```bash
npm run dev           # Start both frontend & backend
npm start             # Start API server only
npm run install-all   # Install root + kaa-app deps
npm run prisma:studio # Open Prisma database GUI
npm run prisma:migrate # Run database migrations
```

## Key Files
- `notion-api-server-enhanced.js` - Main API with all endpoints
- `prisma/schema.prisma` - Database schema
- `kaa-app/src/` - React frontend source
- `.env` - Environment variables (never commit!)

## API Endpoints
- `GET /api/health` - Health check
- `POST /api/auth/*` - Authentication
- `GET/POST /api/projects/*` - Project management
- `POST /api/payments/*` - Stripe integration
- `GET/POST /api/notion/*` - Notion sync

## Business Tiers
| Tier | Name | Price | Description |
|------|------|-------|-------------|
| 1 | Garden Guide | $299 | DIY consultation |
| 2 | Design Package | $1,499 | Custom design plans |
| 3 | Full Service | $4,999+ | Complete design-build |
| 4 | KAA White Glove | Invitation | Premium luxury service |

## Data Flow
1. **Postgres (Supabase):** Source of truth for users, payments, auth
2. **Notion:** Project display, collaboration, client-facing content
3. **Sync:** Bidirectional sync keeps both in sync

## Environment Variables Required
- `DATABASE_URL` - Supabase Postgres connection
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - Supabase API
- `NOTION_API_KEY` - Notion integration
- `STRIPE_SECRET_KEY` - Payment processing
- `OPENAI_API_KEY` - AI chat features

## Mobile Responsiveness
See documentation files:
- `MOBILE_RESPONSIVE_COMPLETE.md`
- `KANBAN_MOBILE_FIX.md`
- `MOBILE_TESTING_GUIDE.md`
