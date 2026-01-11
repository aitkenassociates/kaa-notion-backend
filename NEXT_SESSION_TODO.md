# Next Session TODO

## Summary

Attempted to execute POST_MERGE_TODO.md tasks on 2026-01-11.

---

## Completed Tasks

### 1. Database Schema Verification
- **Status:** Already Complete
- The Prisma schema already contains the required models:
  - `PasswordResetToken` model (lines 106-121 in `prisma/schema.prisma`)
  - `inviteToken` and `inviteTokenExpiresAt` fields on `TeamMember` (lines 527-528)
- Migration directory exists: `prisma/migrations/20260110000000_priority10_future_enhancements/`

### 2. Dependencies Installation
- **Status:** Complete
- Ran `npm install` successfully (2635 packages)

---

## Blocked Tasks

### Prisma Generate/Migrate
- **Status:** BLOCKED - Network Restriction
- Prisma engine binary downloads fail with 403 Forbidden
- Error: `Failed to fetch the engine file at https://binaries.prisma.sh/...`
- **Workaround for Production:** Run in environment with external network access

### Build Verification
- **Status:** BLOCKED - Requires Prisma Client
- TypeScript compilation fails because Prisma client is not generated
- ~178 TypeScript errors, primarily from missing `@prisma/client` exports
- Once Prisma is generated, remaining errors should be minimal

### Tests
- **Status:** BLOCKED - Requires Prisma Client
- Tests cannot run without the Prisma client being generated

---

## Actions Required

### For Next Session (with Network Access)

1. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

2. **Run Migration (if needed)**
   ```bash
   npx prisma migrate dev --name "add_password_reset_and_invite_tokens"
   ```
   Note: Models already exist in schema, so migration may already be applied.

3. **Build and Test**
   ```bash
   cd server
   npm run build
   npm test
   ```

4. **Fix Any Remaining TypeScript Errors**
   Known issues to investigate:
   - Stripe API version mismatch (files using `2023-10-16` vs required `2025-02-24.acacia`)
   - Some `implicit any` type annotations needed

---

## Environment Variables (From POST_MERGE_TODO.md)

Verify in production:
- [ ] `JWT_SECRET` - Must be at least 64 characters
- [ ] `CORS_ORIGINS` or `FRONTEND_URL` - At least one must be set
- [ ] `STRIPE_WEBHOOK_SECRET` - Required if `STRIPE_SECRET_KEY` is set

---

## Manual Testing (From POST_MERGE_TODO.md)

### Security
- [ ] Try logging in with special characters in password: `P@ss<>word!`
- [ ] Verify XSS input is blocked on non-password fields
- [ ] Confirm server rejects weak JWT_SECRET in production mode

### Deliverables API
- [ ] Test `DELETE /api/deliverables/:id` removes file from storage
- [ ] Test `POST /api/projects/:id/deliverables/batch-download` returns signed URLs
- [ ] Verify batch download limit (max 50) is enforced

### Auth
- [ ] Verify Notion admin endpoints require JWT authentication
- [ ] Test admin routes return 401 without valid token

---

## Deferred Work (Future PR)

- **PR #62 - Figma endpoint protection**
  - Create middleware to check `ProjectAssignment.unassignedAt: null`
  - Prevent former team members from accessing Figma files

---

*Created: 2026-01-11*
