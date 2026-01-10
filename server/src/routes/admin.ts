/**
 * Admin Routes
 * API endpoints for admin dashboard and management.
 *
 * Routes:
 * - GET /api/admin/dashboard - Dashboard stats (leads, projects, revenue)
 * - GET /api/admin/leads - All leads with filtering, sorting, pagination
 * - GET /api/admin/projects - All projects with filtering, sorting, pagination
 * - GET /api/admin/clients - All clients with tier, status, project count
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { Client as NotionClient } from '@notionhq/client';
import { getPageTitle, mapNotionStatusToPostgres } from '../utils/notionHelpers';
import { logger } from '../logger';
import { internalError } from '../utils/AppError';
import { requireAuth, requireAdmin } from '../middleware';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardStats {
  leads: {
    total: number;
    byStatus: Record<string, number>;
    thisMonth: number;
    conversionRate: number;
  };
  projects: {
    total: number;
    active: number;
    byTier: Record<number, number>;
    byStatus: Record<string, number>;
  };
  clients: {
    total: number;
    active: number;
    byTier: Record<number, number>;
  };
  revenue: {
    total: number;
    thisMonth: number;
    byTier: Record<number, number>;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: Date;
  }>;
}

interface PaginationParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parsePaginationParams(query: any): PaginationParams {
  return {
    page: Math.max(1, parseInt(query.page || '1')),
    limit: Math.min(100, Math.max(1, parseInt(query.limit || '20'))),
    sortBy: query.sortBy || 'createdAt',
    sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc',
  };
}

function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// ============================================================================
// ROUTE FACTORY
// ============================================================================

export function createAdminRouter(prisma: PrismaClient): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // GET /api/admin/dashboard - Dashboard stats
  // -------------------------------------------------------------------------
  router.get('/dashboard', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startOfMonth = getStartOfMonth();

      // Parallel queries for dashboard stats
      const [
        // Leads stats
        totalLeads,
        leadsThisMonth,
        leadsByStatus,
        convertedLeads,

        // Projects stats
        totalProjects,
        activeProjects,
        projectsByTier,
        projectsByStatus,

        // Clients stats
        totalClients,
        activeClients,
        clientsByTier,

        // Revenue stats
        totalRevenue,
        revenueThisMonth,
        revenueByTier,

        // Recent activity
        recentAuditLogs,
      ] = await Promise.all([
        // Leads
        prisma.lead.count(),
        prisma.lead.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.lead.groupBy({ by: ['status'], _count: true }),
        prisma.lead.count({ where: { status: 'CLOSED', clientId: { not: null } } }),

        // Projects
        prisma.project.count(),
        prisma.project.count({
          where: { status: { notIn: ['DELIVERED', 'CLOSED'] } },
        }),
        prisma.project.groupBy({ by: ['tier'], _count: true }),
        prisma.project.groupBy({ by: ['status'], _count: true }),

        // Clients
        prisma.client.count(),
        prisma.client.count({ where: { status: 'ACTIVE' } }),
        prisma.client.groupBy({ by: ['tier'], _count: true }),

        // Revenue
        prisma.payment.aggregate({
          where: { status: 'SUCCEEDED' },
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
          where: { status: 'SUCCEEDED', createdAt: { gte: startOfMonth } },
          _sum: { amount: true },
        }),
        prisma.payment.groupBy({
          by: ['tier'],
          where: { status: 'SUCCEEDED' },
          _sum: { amount: true },
        }),

        // Recent activity
        prisma.auditLog.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { email: true } },
          },
        }),
      ]);

      // Transform grouped data
      const leadsByStatusMap: Record<string, number> = {};
      leadsByStatus.forEach((item) => {
        leadsByStatusMap[item.status] = item._count;
      });

      const projectsByTierMap: Record<number, number> = {};
      projectsByTier.forEach((item) => {
        projectsByTierMap[item.tier] = item._count;
      });

      const projectsByStatusMap: Record<string, number> = {};
      projectsByStatus.forEach((item) => {
        projectsByStatusMap[item.status] = item._count;
      });

      const clientsByTierMap: Record<number, number> = {};
      clientsByTier.forEach((item) => {
        clientsByTierMap[item.tier] = item._count;
      });

      const revenueByTierMap: Record<number, number> = {};
      revenueByTier.forEach((item) => {
        revenueByTierMap[item.tier] = item._sum.amount || 0;
      });

      // Calculate conversion rate
      const conversionRate = totalLeads > 0 
        ? Math.round((convertedLeads / totalLeads) * 100) 
        : 0;

      // Format recent activity
      const recentActivity = recentAuditLogs.map((log) => ({
        id: log.id,
        type: log.action,
        description: `${log.user?.email || 'System'} ${log.action.replace('_', ' ')} ${log.resourceType || ''}`,
        timestamp: log.createdAt,
      }));

      const stats: DashboardStats = {
        leads: {
          total: totalLeads,
          byStatus: leadsByStatusMap,
          thisMonth: leadsThisMonth,
          conversionRate,
        },
        projects: {
          total: totalProjects,
          active: activeProjects,
          byTier: projectsByTierMap,
          byStatus: projectsByStatusMap,
        },
        clients: {
          total: totalClients,
          active: activeClients,
          byTier: clientsByTierMap,
        },
        revenue: {
          total: totalRevenue._sum.amount || 0,
          thisMonth: revenueThisMonth._sum.amount || 0,
          byTier: revenueByTierMap,
        },
        recentActivity,
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(internalError('Failed to fetch dashboard stats', error as Error));
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/admin/leads - All leads with filtering
  // -------------------------------------------------------------------------
  router.get('/leads', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortBy, sortOrder } = parsePaginationParams(req.query);
      const { status, tier, search, startDate, endDate } = req.query;

      // Build where clause
      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (tier) {
        where.recommendedTier = parseInt(tier as string);
      }

      if (search) {
        where.OR = [
          { email: { contains: search as string, mode: 'insensitive' } },
          { name: { contains: search as string, mode: 'insensitive' } },
          { projectAddress: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      // Get total count
      const total = await prisma.lead.count({ where });

      // Get leads
      const leads = await prisma.lead.findMany({
        where,
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
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      });

      res.json({
        success: true,
        data: leads.map((lead) => ({
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
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(internalError('Failed to fetch leads', error as Error));
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/admin/projects - All projects with filtering
  // -------------------------------------------------------------------------
  router.get('/projects', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortBy, sortOrder } = parsePaginationParams(req.query);
      const { status, tier, paymentStatus, search } = req.query;

      // Build where clause
      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (tier) {
        where.tier = parseInt(tier as string);
      }

      if (paymentStatus) {
        where.paymentStatus = paymentStatus;
      }

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { client: { projectAddress: { contains: search as string, mode: 'insensitive' } } },
        ];
      }

      // Get total count
      const total = await prisma.project.count({ where });

      // Get projects
      const projects = await prisma.project.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              tier: true,
              status: true,
              projectAddress: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
          milestones: {
            select: {
              id: true,
              status: true,
            },
          },
          payments: {
            where: { status: 'SUCCEEDED' },
            select: {
              amount: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      });

      res.json({
        success: true,
        data: projects.map((project) => {
          const totalMilestones = project.milestones.length;
          const completedMilestones = project.milestones.filter(
            (m) => m.status === 'COMPLETED'
          ).length;
          const totalPaid = project.payments.reduce((sum, p) => sum + p.amount, 0);

          return {
            id: project.id,
            name: project.name,
            tier: project.tier,
            status: project.status,
            paymentStatus: project.paymentStatus,
            notionPageId: project.notionPageId,
            client: {
              id: project.client.id,
              email: project.client.user.email,
              projectAddress: project.client.projectAddress,
              status: project.client.status,
            },
            progress: {
              completed: completedMilestones,
              total: totalMilestones,
              percentage: totalMilestones > 0
                ? Math.round((completedMilestones / totalMilestones) * 100)
                : 0,
            },
            totalPaid,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          };
        }),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(internalError('Failed to fetch projects', error as Error));
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/admin/clients - All clients with stats
  // -------------------------------------------------------------------------
  router.get('/clients', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortBy, sortOrder } = parsePaginationParams(req.query);
      const { status, tier, search } = req.query;

      // Build where clause
      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (tier) {
        where.tier = parseInt(tier as string);
      }

      if (search) {
        where.OR = [
          { user: { email: { contains: search as string, mode: 'insensitive' } } },
          { projectAddress: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      // Get total count
      const total = await prisma.client.count({ where });

      // Get clients
      const clients = await prisma.client.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              lastLogin: true,
            },
          },
          projects: {
            select: {
              id: true,
              name: true,
              status: true,
              tier: true,
            },
          },
          leads: {
            select: {
              id: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Get payment totals for each client
      const clientIds = clients.map((c) => c.id);
      const payments = await prisma.payment.groupBy({
        by: ['projectId'],
        where: {
          status: 'SUCCEEDED',
          project: { clientId: { in: clientIds } },
        },
        _sum: { amount: true },
      });

      // Create payment map
      const paymentMap = new Map<string, number>();
      for (const client of clients) {
        const projectIds = client.projects.map((p) => p.id);
        const total = payments
          .filter((p) => projectIds.includes(p.projectId))
          .reduce((sum, p) => sum + (p._sum.amount || 0), 0);
        paymentMap.set(client.id, total);
      }

      res.json({
        success: true,
        data: clients.map((client) => ({
          id: client.id,
          userId: client.userId,
          email: client.user.email,
          tier: client.tier,
          status: client.status,
          projectAddress: client.projectAddress,
          lastLogin: client.user.lastLogin,
          stats: {
            projectCount: client.projects.length,
            activeProjects: client.projects.filter(
              (p) => p.status !== 'DELIVERED' && p.status !== 'CLOSED'
            ).length,
            leadCount: client.leads.length,
            totalPaid: paymentMap.get(client.id) || 0,
          },
          projects: client.projects.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            tier: p.tier,
          })),
          createdAt: client.createdAt,
          updatedAt: client.updatedAt,
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(internalError('Failed to fetch clients', error as Error));
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/admin/sync/health - Notion-Postgres reconciliation health check
  // -------------------------------------------------------------------------
  router.get(
    '/sync/health',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const notionApiKey = process.env.NOTION_API_KEY;
        const projectsDatabaseId = process.env.NOTION_PROJECTS_DATABASE_ID;

        if (!notionApiKey) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Notion API not configured',
            },
          });
        }

        if (!projectsDatabaseId) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Notion projects database ID not configured',
            },
          });
        }

        const notion = new NotionClient({ auth: notionApiKey });

        const comparison = {
          timestamp: new Date().toISOString(),
          projects: {
            postgres: {
              total: 0,
              withNotionLink: 0,
              withoutNotionLink: 0,
            },
            notion: {
              total: 0,
              linked: 0,
              unlinked: 0,
            },
            discrepancies: [] as Array<{
              projectId: string;
              notionPageId: string;
              issues: Array<{
                field: string;
                postgres?: string;
                notion?: string;
                error?: string;
                message?: string;
                timeDiffSeconds?: number;
              }>;
            }>,
          },
          syncStatus: 'unknown' as string,
        };

        // Get all projects from Postgres
        const postgresProjects = await prisma.project.findMany({
          where: {
            notionPageId: { not: null },
          },
          select: {
            id: true,
            name: true,
            status: true,
            notionPageId: true,
            updatedAt: true,
            tier: true,
          },
        });

        comparison.projects.postgres.total = await prisma.project.count();
        comparison.projects.postgres.withNotionLink = postgresProjects.length;
        comparison.projects.postgres.withoutNotionLink =
          comparison.projects.postgres.total - postgresProjects.length;

        // Compare with Notion if database ID is configured
        try {
          const notionPages = await (notion as any).databases.query({
            database_id: projectsDatabaseId,
            page_size: 100, // Limit for performance
          });

          comparison.projects.notion.total = notionPages.results.length;

          // Compare each project
          for (const project of postgresProjects) {
            if (!project.notionPageId) continue;

            try {
              const notionPage = await notion.pages.retrieve({
                page_id: project.notionPageId,
              });
              const notionTitle = getPageTitle(notionPage);
              const properties = (notionPage as any).properties || {};
              const notionStatus = properties.Status?.select?.name;
              const mappedNotionStatus = mapNotionStatusToPostgres(notionStatus);

              const discrepancy: {
                projectId: string;
                notionPageId: string;
                issues: Array<{
                  field: string;
                  postgres?: string;
                  notion?: string;
                  timeDiffSeconds?: number;
                  error?: string;
                  message?: string;
                }>;
              } = {
                projectId: project.id,
                notionPageId: project.notionPageId,
                issues: [],
              };

              // Check for name mismatch
              if (notionTitle && notionTitle !== 'Untitled' && notionTitle !== project.name) {
                discrepancy.issues.push({
                  field: 'name',
                  postgres: project.name,
                  notion: notionTitle,
                });
              }

              // Check for status mismatch
              if (mappedNotionStatus && mappedNotionStatus !== project.status) {
                discrepancy.issues.push({
                  field: 'status',
                  postgres: project.status,
                  notion: mappedNotionStatus,
                });
              }

              // Check timestamp (Notion should be newer or equal if synced)
              const notionTimestamp = new Date((notionPage as any).last_edited_time);
              const postgresTimestamp = new Date(project.updatedAt);

              // If Notion is significantly newer (> 1 minute), might need sync
              const timeDiff = notionTimestamp.getTime() - postgresTimestamp.getTime();
              if (timeDiff > 60000) {
                // 1 minute threshold
                discrepancy.issues.push({
                  field: 'timestamp',
                  postgres: project.updatedAt.toISOString(),
                  notion: (notionPage as any).last_edited_time,
                  timeDiffSeconds: Math.floor(timeDiff / 1000),
                });
              }

              if (discrepancy.issues.length > 0) {
                comparison.projects.discrepancies.push(discrepancy);
              } else {
                comparison.projects.notion.linked++;
              }
            } catch (notionError) {
              // Notion page not found or inaccessible
              comparison.projects.discrepancies.push({
                projectId: project.id,
                notionPageId: project.notionPageId,
                issues: [
                  {
                    field: 'notion_access',
                    error: 'Notion page not found or inaccessible',
                    message: (notionError as Error).message,
                  },
                ],
              });
            }
          }

          comparison.projects.notion.unlinked =
            comparison.projects.notion.total - comparison.projects.notion.linked;

          // Determine sync status
          const discrepancyCount = comparison.projects.discrepancies.length;
          const totalLinked = comparison.projects.notion.linked;
          const totalWithIssues =
            discrepancyCount + comparison.projects.postgres.withoutNotionLink;

          if (totalWithIssues === 0) {
            comparison.syncStatus = 'healthy';
          } else if (
            totalLinked > 0 &&
            discrepancyCount / (totalLinked + discrepancyCount) < 0.1
          ) {
            comparison.syncStatus = 'mostly_synced'; // Less than 10% discrepancies
          } else {
            comparison.syncStatus = 'needs_attention';
          }
        } catch (notionError) {
          logger.error('Error querying Notion database', {
            error: (notionError as Error).message,
            databaseId: projectsDatabaseId,
          });
          comparison.syncStatus = 'error';
          comparison.projects.notion.total = -1; // Indicate error
        }

        // Log audit
        await prisma.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'sync_health_check',
            resourceType: 'sync',
            details: {
              syncStatus: comparison.syncStatus,
              discrepancyCount: comparison.projects.discrepancies.length,
            },
          },
        });

        res.json({
          success: true,
          data: comparison,
        });
      } catch (error) {
        next(internalError('Failed to perform sync health check', error as Error));
      }
    }
  );

  return router;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default createAdminRouter;
