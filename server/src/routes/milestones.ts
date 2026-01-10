/**
 * Milestones Routes
 * API endpoints for milestone management.
 *
 * Routes:
 * - GET /api/projects/:projectId/milestones - Get all milestones for a project
 * - GET /api/milestones/:id - Get single milestone details
 * - PATCH /api/milestones/:id - Update milestone status (admin only)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, MilestoneStatus as PrismaMilestoneStatus } from '@prisma/client';
import { MilestoneStatus } from '../services/projectService';
import { logger } from '../logger';
import { internalError } from '../utils/AppError';
import { requireAuth, requireAdmin, type AuthenticatedUser } from '../middleware';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Milestone detail response
 */
interface MilestoneDetail {
  id: string;
  projectId: string;
  tier: number;
  name: string;
  order: number;
  status: MilestoneStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  // Computed fields
  isOverdue: boolean;
  daysUntilDue: number | null;
}

/**
 * Project milestones response with summary
 */
interface ProjectMilestonesResponse {
  success: boolean;
  data: {
    projectId: string;
    projectName: string;
    tier: number;
    summary: {
      total: number;
      completed: number;
      inProgress: number;
      pending: number;
      percentage: number;
    };
    milestones: MilestoneDetail[];
  };
}

/**
 * Update milestone request body
 */
interface UpdateMilestoneBody {
  status?: MilestoneStatus;
  dueDate?: string | null;
  completedAt?: string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate if a milestone is overdue
 */
function isOverdue(milestone: { status: string; dueDate: Date | null }): boolean {
  if (milestone.status === 'COMPLETED') return false;
  if (!milestone.dueDate) return false;
  return new Date(milestone.dueDate) < new Date();
}

/**
 * Calculate days until due date
 */
function daysUntilDue(dueDate: Date | null): number | null {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Transform milestone to detail format
 */
function toMilestoneDetail(milestone: {
  id: string;
  projectId: string;
  tier: number;
  name: string;
  order: number;
  status: string;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}): MilestoneDetail {
  return {
    id: milestone.id,
    projectId: milestone.projectId,
    tier: milestone.tier,
    name: milestone.name,
    order: milestone.order,
    status: milestone.status as MilestoneStatus,
    dueDate: milestone.dueDate,
    completedAt: milestone.completedAt,
    createdAt: milestone.createdAt,
    isOverdue: isOverdue(milestone),
    daysUntilDue: daysUntilDue(milestone.dueDate),
  };
}

// ============================================================================
// ROUTE FACTORY
// ============================================================================

/**
 * Create milestones router with dependency injection
 */
export function createMilestonesRouter(prisma: PrismaClient): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // GET /api/projects/:projectId/milestones - Get all milestones for a project
  // -------------------------------------------------------------------------
  router.get(
    '/projects/:projectId/milestones',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params;
        const user = req.user as AuthenticatedUser;

        // Get project with milestones
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            milestones: {
              orderBy: { order: 'asc' },
            },
          },
        });

        if (!project) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Project not found',
            },
          });
        }

        // Authorization check - clients can only see their own projects
        if (user.userType !== 'ADMIN' && user.userType !== 'TEAM') {
          if (project.clientId !== user.clientId) {
            return res.status(403).json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Access denied to this project',
              },
            });
          }
        }

        // Calculate summary
        const total = project.milestones.length;
        const completed = project.milestones.filter((m) => m.status === 'COMPLETED').length;
        const inProgress = project.milestones.filter((m) => m.status === 'IN_PROGRESS').length;
        const pending = project.milestones.filter((m) => m.status === 'PENDING').length;

        const response: ProjectMilestonesResponse = {
          success: true,
          data: {
            projectId: project.id,
            projectName: project.name,
            tier: project.tier,
            summary: {
              total,
              completed,
              inProgress,
              pending,
              percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            },
            milestones: project.milestones.map(toMilestoneDetail),
          },
        };

        res.json(response);
      } catch (error) {
        next(internalError('Failed to fetch milestones', error as Error));
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /api/milestones/:id - Get single milestone details
  // -------------------------------------------------------------------------
  router.get(
    '/milestones/:id',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user as AuthenticatedUser;

        // Get milestone with project info
        const milestone = await prisma.milestone.findUnique({
          where: { id },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                clientId: true,
                tier: true,
                status: true,
              },
            },
          },
        });

        if (!milestone) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Milestone not found',
            },
          });
        }

        // Authorization check - clients can only see milestones from their own projects
        if (user.userType !== 'ADMIN' && user.userType !== 'TEAM') {
          if (milestone.project.clientId !== user.clientId) {
            return res.status(403).json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Access denied to this milestone',
              },
            });
          }
        }

        // Get adjacent milestones for context
        const [previousMilestone, nextMilestone] = await Promise.all([
          prisma.milestone.findFirst({
            where: {
              projectId: milestone.projectId,
              order: { lt: milestone.order },
            },
            orderBy: { order: 'desc' },
            select: { id: true, name: true, status: true, order: true },
          }),
          prisma.milestone.findFirst({
            where: {
              projectId: milestone.projectId,
              order: { gt: milestone.order },
            },
            orderBy: { order: 'asc' },
            select: { id: true, name: true, status: true, order: true },
          }),
        ]);

        res.json({
          success: true,
          data: {
            ...toMilestoneDetail(milestone),
            project: {
              id: milestone.project.id,
              name: milestone.project.name,
              tier: milestone.project.tier,
              status: milestone.project.status,
            },
            navigation: {
              previous: previousMilestone
                ? {
                    id: previousMilestone.id,
                    name: previousMilestone.name,
                    status: previousMilestone.status,
                  }
                : null,
              next: nextMilestone
                ? {
                    id: nextMilestone.id,
                    name: nextMilestone.name,
                    status: nextMilestone.status,
                  }
                : null,
            },
          },
        });
      } catch (error) {
        next(internalError('Failed to fetch milestone', error as Error));
      }
    }
  );

  // -------------------------------------------------------------------------
  // PATCH /api/milestones/:id - Update milestone status (admin only)
  // -------------------------------------------------------------------------
  router.patch(
    '/milestones/:id',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const body = req.body as UpdateMilestoneBody;
        const user = req.user as AuthenticatedUser;

        // Validate status if provided
        if (body.status && !Object.values(MilestoneStatus).includes(body.status)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: `Invalid status. Must be one of: ${Object.values(MilestoneStatus).join(', ')}`,
            },
          });
        }

        // Check milestone exists
        const existingMilestone = await prisma.milestone.findUnique({
          where: { id },
          include: {
            project: {
              select: { id: true, name: true, clientId: true },
            },
          },
        });

        if (!existingMilestone) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Milestone not found',
            },
          });
        }

        // Build update data
        const updateData: {
          status?: PrismaMilestoneStatus;
          dueDate?: Date | null;
          completedAt?: Date | null;
        } = {};

        if (body.status) {
          updateData.status = body.status as PrismaMilestoneStatus;

          // Auto-set completedAt when marking as COMPLETED
          if (body.status === MilestoneStatus.COMPLETED && !existingMilestone.completedAt) {
            updateData.completedAt = new Date();
          }

          // Clear completedAt if moving away from COMPLETED
          if (body.status !== MilestoneStatus.COMPLETED && existingMilestone.completedAt) {
            updateData.completedAt = null;
          }
        }

        if (body.dueDate !== undefined) {
          updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
        }

        if (body.completedAt !== undefined) {
          updateData.completedAt = body.completedAt ? new Date(body.completedAt) : null;
        }

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'NO_UPDATES',
              message: 'No valid fields to update',
            },
          });
        }

        // Update milestone
        const updatedMilestone = await prisma.milestone.update({
          where: { id },
          data: updateData,
        });

        // Log the update
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'milestone_update',
            resourceType: 'milestone',
            resourceId: id,
            details: {
              projectId: existingMilestone.projectId,
              milestoneName: existingMilestone.name,
              previousStatus: existingMilestone.status,
              newStatus: body.status || existingMilestone.status,
              updatedFields: Object.keys(updateData),
            },
          },
        });

        logger.info(
          `Milestone ${id} (${existingMilestone.name}) updated by user ${user.id}`,
          updateData
        );

        // Check if we should auto-advance the next milestone
        if (body.status === MilestoneStatus.COMPLETED) {
          const nextMilestone = await prisma.milestone.findFirst({
            where: {
              projectId: existingMilestone.projectId,
              order: { gt: existingMilestone.order },
              status: PrismaMilestoneStatus.PENDING,
            },
            orderBy: { order: 'asc' },
          });

          if (nextMilestone) {
            await prisma.milestone.update({
              where: { id: nextMilestone.id },
              data: { status: PrismaMilestoneStatus.IN_PROGRESS },
            });

            logger.info(
              `Auto-advanced milestone ${nextMilestone.id} (${nextMilestone.name}) to IN_PROGRESS`
            );
          }

          // Check if all milestones are completed - update project status
          const remainingMilestones = await prisma.milestone.count({
            where: {
              projectId: existingMilestone.projectId,
              status: { not: PrismaMilestoneStatus.COMPLETED },
            },
          });

          if (remainingMilestones === 0) {
            await prisma.project.update({
              where: { id: existingMilestone.projectId },
              data: { status: 'DELIVERED' },
            });

            logger.info(`Project ${existingMilestone.projectId} marked as DELIVERED - all milestones complete`);
          }
        }

        res.json({
          success: true,
          data: toMilestoneDetail(updatedMilestone),
        });
      } catch (error) {
        next(internalError('Failed to update milestone', error as Error));
      }
    }
  );

  return router;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default createMilestonesRouter;
