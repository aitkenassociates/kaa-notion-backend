# Claude Code Prompt Queue
# Reference: "Run the next pending prompt from .claude/prompt-queue.md"

## How to Use
1. Add prompts to the appropriate section below
2. Tell Claude: "Run the next pending prompt" or "Run all pending prompts in [section]"
3. Claude will execute and update status from `[ ]` to `[x]`

---

## Phase 2: Lead Capture & Intake (Current Focus)

### 2.1 Tier Router Implementation
- [x] `new-util`: tierRouter.ts - Implement tier recommendation algorithm with IntakeFormData input, returns TierRecommendation with tier (1-4), reason, confidence, needsManualReview
- [ ] `test`: tierRouter.test.ts - Test all tier routing logic: budget ranges, timelines, project types, asset combinations, edge cases

### 2.2 Lead API Endpoints
- [ ] `new-endpoint`: POST /api/leads - Create lead from intake form, run tier router, return recommendation
- [ ] `new-endpoint`: GET /api/leads - List leads with pagination, filtering by status and tier (admin only)
- [ ] `new-endpoint`: GET /api/leads/:id - Get single lead with tier recommendation details
- [ ] `new-endpoint`: PATCH /api/leads/:id - Update lead status, override tier recommendation (admin only)
- [ ] `new-endpoint`: POST /api/leads/:id/convert - Convert lead to client after payment

### 2.3 Intake Form Components
- [ ] `new-form`: IntakeForm - Multi-step intake form with budget, timeline, project type, address, assets (hasSurvey, hasDrawings)
- [ ] `new-component`: TierRecommendation - Display recommended tier with pricing and features after form submission
- [ ] `new-component`: TierCard - Individual tier display with name, price, features, CTA button
- [ ] `new-component`: TierComparison - Side-by-side comparison of all 4 tiers

---

## Phase 3: Payment & Client Creation

### 3.1 Stripe Integration
- [ ] `stripe-integration`: Checkout session creation for tiers 1-3 with tier-specific pricing from Stripe products
- [ ] `new-endpoint`: POST /api/checkout/create-session - Create Stripe checkout session with tier, lead_id, success/cancel URLs
- [ ] `new-webhook`: POST /api/webhooks/stripe - Handle checkout.session.completed, payment_intent.succeeded, payment_intent.failed
- [ ] `new-util`: stripeHelpers.ts - Verify webhook signatures, construct events, idempotent processing

### 3.2 User & Client Creation
- [ ] `new-endpoint`: POST /api/auth/register - Create user account (email/password for SAGE, address for KAA)
- [ ] `new-endpoint`: POST /api/auth/login - Authenticate user, return JWT token
- [ ] `new-endpoint`: GET /api/auth/me - Get current user profile with client/tier info
- [ ] `new-service`: clientService.ts - Create client from lead after payment, link user/client/lead/project

### 3.3 Project Auto-Creation
- [ ] `new-service`: projectService.ts - Create project with tier-specific milestones after payment
- [ ] `new-util`: milestoneTemplates.ts - Define milestone templates for each tier (Tier 1: Intake→Concept→Delivery, Tier 2: Intake→Draft→Review→Revisions→Final, etc.)

---

## Phase 4: Client Portal

### 4.1 Project Endpoints
- [ ] `new-endpoint`: GET /api/projects - List user's projects with status and progress
- [ ] `new-endpoint`: GET /api/projects/:id - Get project with milestones, deliverables, payment status
- [ ] `new-endpoint`: PATCH /api/projects/:id - Update project status (admin only)

### 4.2 Milestone Endpoints
- [ ] `new-endpoint`: GET /api/projects/:id/milestones - Get milestones for project
- [ ] `new-endpoint`: PATCH /api/milestones/:id - Update milestone status, completed_at (admin only)

### 4.3 Deliverable Endpoints
- [ ] `new-endpoint`: GET /api/projects/:id/deliverables - Get deliverables for project
- [ ] `new-endpoint`: POST /api/projects/:id/deliverables - Upload deliverable (admin only)
- [ ] `new-endpoint`: GET /api/deliverables/:id/download - Get signed download URL for file

### 4.4 Portal Components
- [ ] `new-component`: ProjectDashboard - Main portal view with project list, status, quick actions
- [ ] `new-component`: ProjectDetail - Full project view with milestones timeline, deliverables, status
- [ ] `new-component`: MilestoneTimeline - Visual timeline of project milestones with status indicators
- [ ] `new-component`: DeliverableList - Grid/list of project deliverables with download buttons
- [ ] `new-component`: DeliverableCard - Individual deliverable with thumbnail, name, download action

### 4.5 Portal Hooks
- [ ] `new-hook`: useProjects - Fetch user's projects with React Query, handle loading/error
- [ ] `new-hook`: useProject - Fetch single project with milestones and deliverables
- [ ] `new-hook`: useMilestones - Fetch milestones by project ID
- [ ] `new-hook`: useDeliverables - Fetch deliverables by project ID

---

## Phase 5: Admin Dashboard

### 5.1 Admin Endpoints
- [ ] `new-endpoint`: GET /api/admin/dashboard - Dashboard stats (leads by status, projects by tier, revenue)
- [ ] `new-endpoint`: GET /api/admin/leads - All leads with filtering, sorting, pagination
- [ ] `new-endpoint`: GET /api/admin/projects - All projects with filtering, sorting, pagination
- [ ] `new-endpoint`: GET /api/admin/clients - All clients with tier, status, project count

### 5.2 Admin Components
- [ ] `new-component`: AdminDashboard - Overview with stats cards, recent leads, recent projects
- [ ] `new-component`: LeadQueue - Lead management table with status, tier, actions (approve, change tier, close)
- [ ] `new-component`: ProjectsTable - Admin project list with client, tier, status, actions
- [ ] `new-component`: ClientsTable - Client list with tier, projects, status

### 5.3 Admin Actions
- [ ] `new-component`: TierOverrideModal - Modal to change lead's recommended tier with reason
- [ ] `new-component`: LeadReviewPanel - Detailed lead view with intake data, tier recommendation, actions

---

## Phase 6: Notion Sync

### 6.1 Sync Infrastructure
- [ ] `new-service`: notionSyncQueue.ts - Queue-based sync with rate limiting, retry logic, status tracking
- [ ] `prisma-migration`: Add lastSyncedAt, syncStatus columns to projects, milestones, deliverables

### 6.2 Entity Sync
- [ ] `notion-sync`: Project - Create Notion page when project created, sync status updates
- [ ] `notion-sync`: Milestone - Add milestone blocks to project page, update on status change
- [ ] `notion-sync`: Deliverable - Create showcase page for deliverables, link from project page
- [ ] `notion-sync`: Lead - Optional CRM sync for team visibility

---

## Phase 7: File Storage

### 7.1 Supabase Storage
- [ ] `new-service`: storageService.ts - Upload files to Supabase Storage, get signed URLs, delete files
- [ ] `new-endpoint`: POST /api/upload - Handle file upload with validation (size, type), store metadata
- [ ] `new-component`: FileUpload - Drag-drop upload with progress, file type validation, preview

---

## Phase 8: Security & Polish

### 8.1 Authentication Middleware
- [ ] `new-middleware`: auth.ts - JWT verification, attach user to request, handle expired tokens
- [ ] `new-middleware`: requireTier.ts - Check user has required tier for endpoint access
- [ ] `new-middleware`: requireAdmin.ts - Check user is admin or team member

### 8.2 Validation
- [ ] `new-util`: validators.ts - Zod schemas for all API request bodies (lead, project, deliverable)
- [ ] `new-middleware`: validate.ts - Middleware to validate request body against Zod schema

### 8.3 Error Handling
- [ ] `new-middleware`: errorHandler.ts - Global error handler with proper response formatting, logging
- [ ] `new-util`: AppError.ts - Custom error class with code, message, statusCode, details

### 8.4 Audit Logging
- [ ] `new-service`: auditService.ts - Log actions to audit_log table with user, action, resource, details
- [ ] `audit`: Add audit logging to all state-changing endpoints

---

## Database Migrations

### Core Models (Run First)
- [ ] `prisma-migrate`: Initial migration with User, Client, Lead, Project, Tier, Milestone, Payment, Deliverable, AuditLog

### Indexes
- [ ] `prisma-migrate`: Add indexes for email, stripe IDs, foreign keys per data-model.md

---

## Testing

### API Tests
- [ ] `test`: leads.test.ts - Test lead CRUD, tier router integration, conversion flow
- [ ] `test`: auth.test.ts - Test registration, login, token refresh, protected routes
- [ ] `test`: projects.test.ts - Test project CRUD, milestone creation, tier gating
- [ ] `test`: payments.test.ts - Test Stripe webhook handling, payment status updates
- [ ] `test`: deliverables.test.ts - Test upload, download, file metadata

### Component Tests
- [ ] `test`: IntakeForm.test.tsx - Test form validation, submission, tier display
- [ ] `test`: ProjectDashboard.test.tsx - Test loading states, project list, navigation
- [ ] `test`: MilestoneTimeline.test.tsx - Test milestone rendering, status indicators

### E2E Tests
- [ ] `e2e`: lead-to-client.spec.ts - Full flow: intake form → tier recommendation → checkout → portal access
- [ ] `e2e`: client-portal.spec.ts - Login → view projects → view deliverables → download file

---

## Completed
<!-- Move completed items here with date -->

### 2025-01-09
- [x] Initial project setup
- [x] Claude Code configuration files (.claude/config.json, prompts.md, context/)
- [x] Updated .cursorrules with comprehensive guidelines
- [x] `new-util`: tierRouter.ts - Tier recommendation algorithm implementation

---

## Quick Reference

| Prompt Type | Use For |
|-------------|---------|
| `new-endpoint` | API routes (GET, POST, PATCH, DELETE) |
| `new-component` | React components |
| `new-hook` | Custom React hooks with React Query |
| `new-form` | Form components with validation |
| `new-service` | Backend service modules |
| `new-util` | Utility functions |
| `new-middleware` | Express middleware |
| `prisma-migrate` | Database schema changes |
| `notion-sync` | Notion integration for entity |
| `stripe-integration` | Payment features |
| `new-webhook` | Webhook handlers |
| `audit` | Code review / add audit logging |
| `test` | Unit/integration tests |
| `e2e` | End-to-end tests |

---

## Invocation Examples

```bash
# Run next item in current phase
"Run the next pending prompt from Phase 2"

# Run specific section
"Run all Tier Router prompts"

# Run specific type across all phases
"Run all pending new-endpoint prompts"

# Add new item
"Add to prompt queue Phase 4: new-component StatusBadge"

# Check status
"Show me the prompt queue status"

# Skip to specific phase
"Run all Phase 3 prompts"
```
