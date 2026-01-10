/**
 * Lead Routes
 * API endpoints for lead management and tier routing.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, LeadStatus, Prisma, UserType } from '@prisma/client';
import { AppError, notFound, validationError, forbidden, internalError } from '../utils/AppError';
import { recordLeadCreated } from '../config/metrics';
import {
  createLeadSchema,
  leadFiltersSchema,
  updateLeadSchema,
  type CreateLeadInput,
  type LeadFiltersInput,
  type UpdateLeadInput,
} from '../utils';
import { validateBody, validateQuery } from '../middleware';

// ============================================================================
// TYPES
// ============================================================================

// Use the AuthenticatedRequest from projects.ts pattern
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    userType: UserType;
    tier?: number;
  };
}

interface TierRecommendation {
  tier: 1 | 2 | 3 | 4;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  needsManualReview: boolean;
}

// ============================================================================
// TIER ROUTER (Server-side implementation)
// ============================================================================

const BUDGET_THRESHOLDS = {
  TIER_1_MIN: 2500,
  TIER_1_MAX: 7500,
  TIER_2_MIN: 7500,
  TIER_2_MAX: 15000,
  TIER_3_MIN: 15000,
  TIER_3_MAX: 35000,
  TIER_4_MIN: 35000,
};

function calculateTierFromBudget(budget: number): 1 | 2 | 3 | 4 {
  if (budget >= BUDGET_THRESHOLDS.TIER_4_MIN) return 4;
  if (budget >= BUDGET_THRESHOLDS.TIER_3_MIN) return 3;
  if (budget >= BUDGET_THRESHOLDS.TIER_2_MIN) return 2;
  return 1;
}

function calculateTierRecommendation(data: {
  budget?: number;
  timelineWeeks?: number;
  projectType?: string;
  hasSurvey: boolean;
  hasDrawings: boolean;
}): TierRecommendation {
  let tier: 1 | 2 | 3 | 4 = 2; // Default
  const reasons: string[] = [];
  let needsManualReview = false;

  // Budget-based routing
  if (data.budget) {
    tier = calculateTierFromBudget(data.budget);
    reasons.push(`Budget suggests Tier ${tier}`);
  }

  // Asset-based adjustments
  if (!data.hasSurvey && !data.hasDrawings) {
    tier = Math.max(tier, 3) as 1 | 2 | 3 | 4;
    reasons.push('No existing assets - site visit required');
    needsManualReview = true;
  }

  // Project type adjustments
  const complexTypes = ['new_build', 'complex', 'multiple_properties', 'major_renovation'];
  if (data.projectType && complexTypes.includes(data.projectType)) {
    tier = Math.max(tier, 3) as 1 | 2 | 3 | 4;
    reasons.push(`${data.projectType} requires higher tier service`);
    needsManualReview = true;
  }

  if (data.projectType === 'multiple_properties') {
    tier = 4;
    reasons.push('Multiple properties require white-glove service');
    needsManualReview = true;
  }

  // Tier 4 always needs review
  if (tier === 4) {
    needsManualReview = true;
  }

  // Calculate confidence
  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (!data.budget) {
    confidence = 'medium';
  }
  if (needsManualReview) {
    confidence = 'low';
  }

  return {
    tier,
    reason: reasons.join('. ') || 'Standard tier assignment',
    confidence,
    needsManualReview,
  };
}

// ============================================================================
// ROUTE FACTORY
// ============================================================================

export function createLeadsRouter(prisma: PrismaClient): Router {
  const router = Router();

  // ============================================================================
  /**
   * @openapi
   * /api/leads:
   *   post:
   *     summary: Create a new lead
   *     description: Submit intake form data and receive tier recommendation
   *     tags: [Leads]
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateLeadRequest'
   *     responses:
   *       201:
   *         description: Lead created with tier recommendation
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     lead:
   *                       $ref: '#/components/schemas/Lead'
   *                     tierRecommendation:
   *                       type: object
   *                       properties:
   *                         tier:
   *                           type: integer
   *                         reason:
   *                           type: string
   *                         confidence:
   *                           type: string
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   */
  router.post(
    '/',
    validateBody(createLeadSchema),
    async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body as CreateLeadInput;

      // Check for existing lead with same email
      const existingLead = await prisma.lead.findFirst({
        where: { email: data.email },
      });

      if (existingLead) {
        // Return existing lead instead of creating duplicate
        const recommendation = calculateTierRecommendation({
          budget: data.budget,
          timelineWeeks: data.timelineWeeks,
          projectType: data.projectType,
          hasSurvey: data.hasSurvey,
          hasDrawings: data.hasDrawings,
        });

        return res.json({
          success: true,
          data: {
            lead: existingLead,
            recommendation,
            isExisting: true,
          },
        });
      }

      // Calculate tier recommendation
      const recommendation = calculateTierRecommendation({
        budget: data.budget,
        timelineWeeks: data.timelineWeeks,
        projectType: data.projectType,
        hasSurvey: data.hasSurvey,
        hasDrawings: data.hasDrawings,
      });

      // Create lead
      const lead = await prisma.lead.create({
        data: {
          email: data.email,
          name: data.name,
          projectAddress: data.projectAddress,
          budgetRange: data.budgetRange,
          timeline: data.timeline,
          projectType: data.projectType,
          hasSurvey: data.hasSurvey,
          hasDrawings: data.hasDrawings,
          recommendedTier: recommendation.tier,
          routingReason: recommendation.reason,
          status: recommendation.needsManualReview ? 'NEEDS_REVIEW' : 'NEW',
        },
      });

      // Record metrics
      recordLeadCreated(recommendation.tier);

      res.status(201).json({
        success: true,
        data: {
          lead,
          recommendation,
          isExisting: false,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  /**
   * @openapi
   * /api/leads:
   *   get:
   *     summary: List leads with filtering
   *     description: Admin only - get paginated list of leads
   *     tags: [Leads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [NEW, QUALIFIED, NEEDS_REVIEW, CLOSED]
   *       - in: query
   *         name: tier
   *         schema:
   *           type: integer
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Paginated list of leads
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Lead'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  router.get(
    '/',
    validateQuery(leadFiltersSchema),
    async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      // Check admin/team access
      if (authReq.user && !['ADMIN', 'TEAM'].includes(authReq.user.userType)) {
        throw forbidden('Admin or team access required');
      }

      const { page, limit, status, tier, search, startDate, endDate } =
        req.query as unknown as LeadFiltersInput;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Prisma.LeadWhereInput = {};

      if (status) {
        where.status = status as LeadStatus;
      }

      if (tier) {
        where.recommendedTier = tier;
      }

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { projectAddress: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (startDate) {
        where.createdAt = { ...(where.createdAt as any), gte: new Date(startDate) };
      }

      if (endDate) {
        where.createdAt = { ...(where.createdAt as any), lte: new Date(endDate) };
      }

      // Fetch leads
      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            client: {
              select: {
                id: true,
                status: true,
              },
            },
            projects: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        }),
        prisma.lead.count({ where }),
      ]);

      // Format response
      const formattedLeads = leads.map((lead) => ({
        id: lead.id,
        email: lead.email,
        name: lead.name,
        projectAddress: lead.projectAddress,
        budgetRange: lead.budgetRange,
        timeline: lead.timeline,
        projectType: lead.projectType,
        hasSurvey: lead.hasSurvey,
        hasDrawings: lead.hasDrawings,
        recommendedTier: lead.recommendedTier,
        routingReason: lead.routingReason,
        status: lead.status,
        isConverted: !!lead.clientId,
        client: lead.client,
        projects: lead.projects,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      }));

      res.json({
        success: true,
        data: formattedLeads,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // GET /api/leads/:id - Get single lead with details
  // ============================================================================
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const lead = await prisma.lead.findUnique({
        where: { id },
        include: {
          client: {
            select: {
              id: true,
              tier: true,
              status: true,
              projectAddress: true,
            },
          },
          projects: {
            select: {
              id: true,
              name: true,
              tier: true,
              status: true,
              paymentStatus: true,
              createdAt: true,
            },
          },
        },
      });

      if (!lead) {
        throw notFound('Lead not found');
      }

      // Calculate current recommendation (may differ from stored)
      const currentRecommendation = calculateTierRecommendation({
        projectType: lead.projectType || undefined,
        hasSurvey: lead.hasSurvey,
        hasDrawings: lead.hasDrawings,
      });

      res.json({
        success: true,
        data: {
          ...lead,
          isConverted: !!lead.clientId,
          currentRecommendation,
          createdAt: lead.createdAt.toISOString(),
          updatedAt: lead.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // PATCH /api/leads/:id - Update lead status/tier (admin only)
  // ============================================================================
  router.patch(
    '/:id',
    validateBody(updateLeadSchema),
    async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      // Check admin/team access
      if (authReq.user && !['ADMIN', 'TEAM'].includes(authReq.user.userType)) {
        throw forbidden('Admin or team access required');
      }

      const { id } = req.params;
      const data = req.body as UpdateLeadInput;

      // Check lead exists
      const existingLead = await prisma.lead.findUnique({ where: { id } });
      if (!existingLead) {
        throw notFound('Lead not found');
      }

      // Build update data
      const updateData: Prisma.LeadUpdateInput = {};

      if (data.status) {
        updateData.status = data.status as LeadStatus;
      }

      if (data.recommendedTier) {
        updateData.recommendedTier = data.recommendedTier;
        if (data.tierOverrideReason) {
          updateData.routingReason = `Manual override: ${data.tierOverrideReason}`;
        }
      }

      if (data.name !== undefined) {
        updateData.name = data.name;
      }

      // Update lead
      const updatedLead = await prisma.lead.update({
        where: { id },
        data: updateData,
        include: {
          client: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: {
          ...updatedLead,
          isConverted: !!updatedLead.clientId,
          createdAt: updatedLead.createdAt.toISOString(),
          updatedAt: updatedLead.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // POST /api/leads/:id/convert - Convert lead to client
  // ============================================================================
  router.post('/:id/convert', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      // Check admin/team access
      if (authReq.user && !['ADMIN', 'TEAM'].includes(authReq.user.userType)) {
        throw forbidden('Admin or team access required');
      }

      const { id } = req.params;

      // Get lead
      const lead = await prisma.lead.findUnique({
        where: { id },
        include: { client: true },
      });

      if (!lead) {
        throw notFound('Lead not found');
      }

      if (lead.clientId) {
        throw validationError('Lead has already been converted to a client');
      }

      // Validate lead is qualified
      if (lead.status !== 'QUALIFIED') {
        throw validationError('Lead must be qualified before conversion');
      }

      // Create user and client in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create user account with a temporary password
        // The user will set their own password during first login/email verification
        const tempPasswordHash = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const user = await tx.user.create({
          data: {
            email: lead.email,
            passwordHash: tempPasswordHash, // Will be replaced on first login
            userType: 'SAGE_CLIENT' as UserType,
          },
        });

        // Create client profile
        const client = await tx.client.create({
          data: {
            userId: user.id,
            tier: lead.recommendedTier,
            status: 'ONBOARDING',
            projectAddress: lead.projectAddress,
          },
        });

        // Update lead with client reference
        const updatedLead = await tx.lead.update({
          where: { id },
          data: {
            clientId: client.id,
            status: 'CLOSED',
          },
        });

        // Create initial project
        const project = await tx.project.create({
          data: {
            clientId: client.id,
            leadId: lead.id,
            tier: lead.recommendedTier,
            name: `${lead.projectAddress} Project`,
            status: 'ONBOARDING',
            paymentStatus: 'pending',
          },
        });

        return {
          user,
          client,
          lead: updatedLead,
          project,
        };
      });

      res.status(201).json({
        success: true,
        data: {
          message: 'Lead successfully converted to client',
          lead: {
            ...result.lead,
            createdAt: result.lead.createdAt.toISOString(),
            updatedAt: result.lead.updatedAt.toISOString(),
          },
          client: {
            id: result.client.id,
            tier: result.client.tier,
            status: result.client.status,
          },
          project: {
            id: result.project.id,
            name: result.project.name,
            tier: result.project.tier,
            status: result.project.status,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // GET /api/leads/stats - Get lead statistics (admin only)
  // ============================================================================
  router.get('/stats/overview', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      // Check admin/team access
      if (authReq.user && !['ADMIN', 'TEAM'].includes(authReq.user.userType)) {
        throw forbidden('Admin or team access required');
      }

      const [
        totalLeads,
        newLeads,
        qualifiedLeads,
        needsReviewLeads,
        closedLeads,
        byTier,
        thisMonth,
        converted,
      ] = await Promise.all([
        prisma.lead.count(),
        prisma.lead.count({ where: { status: 'NEW' } }),
        prisma.lead.count({ where: { status: 'QUALIFIED' } }),
        prisma.lead.count({ where: { status: 'NEEDS_REVIEW' } }),
        prisma.lead.count({ where: { status: 'CLOSED' } }),
        prisma.lead.groupBy({
          by: ['recommendedTier'],
          _count: true,
        }),
        prisma.lead.count({
          where: {
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
        prisma.lead.count({
          where: {
            clientId: { not: null },
          },
        }),
      ]);

      const tierCounts = byTier.reduce((acc, item) => {
        acc[item.recommendedTier] = item._count;
        return acc;
      }, {} as Record<number, number>);

      const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

      res.json({
        success: true,
        data: {
          total: totalLeads,
          byStatus: {
            NEW: newLeads,
            QUALIFIED: qualifiedLeads,
            NEEDS_REVIEW: needsReviewLeads,
            CLOSED: closedLeads,
          },
          byTier: {
            1: tierCounts[1] || 0,
            2: tierCounts[2] || 0,
            3: tierCounts[3] || 0,
            4: tierCounts[4] || 0,
          },
          thisMonth,
          converted,
          conversionRate,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
