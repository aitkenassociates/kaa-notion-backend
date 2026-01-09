/**
 * Milestones Routes
 *
 * API endpoints for project timeline and milestone management:
 * - Milestone CRUD operations
 * - Status updates
 * - Timeline visualization data
 */

const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

/**
 * GET /api/milestones
 * List milestones with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { projectId, status, tier } = req.query;

    const where = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (tier) where.tier = parseInt(tier);

    const milestones = await prisma.milestone.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            tier: true
          }
        }
      },
      orderBy: [
        { projectId: 'asc' },
        { order: 'asc' }
      ]
    });

    res.json({ milestones });
  } catch (error) {
    console.error('Error fetching milestones:', error);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

/**
 * GET /api/milestones/project/:projectId
 * Get all milestones for a project (timeline view)
 */
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const milestones = await prisma.milestone.findMany({
      where: { projectId },
      orderBy: { order: 'asc' }
    });

    // Calculate timeline statistics
    const total = milestones.length;
    const completed = milestones.filter(m => m.status === 'COMPLETED').length;
    const inProgress = milestones.filter(m => m.status === 'IN_PROGRESS').length;
    const pending = milestones.filter(m => m.status === 'PENDING').length;

    // Calculate progress percentage
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Find current milestone (first in-progress or first pending)
    const currentMilestone = milestones.find(m => m.status === 'IN_PROGRESS')
      || milestones.find(m => m.status === 'PENDING');

    // Estimated completion based on due dates
    const upcomingDueDates = milestones
      .filter(m => m.dueDate && m.status !== 'COMPLETED')
      .map(m => new Date(m.dueDate))
      .sort((a, b) => a - b);

    const nextDueDate = upcomingDueDates[0] || null;
    const finalDueDate = upcomingDueDates[upcomingDueDates.length - 1] || null;

    res.json({
      milestones,
      timeline: {
        total,
        completed,
        inProgress,
        pending,
        progress,
        currentMilestone: currentMilestone ? {
          id: currentMilestone.id,
          name: currentMilestone.name,
          order: currentMilestone.order
        } : null,
        nextDueDate,
        estimatedCompletion: finalDueDate
      }
    });
  } catch (error) {
    console.error('Error fetching project milestones:', error);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

/**
 * GET /api/milestones/:id
 * Get single milestone details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            client: {
              include: {
                user: {
                  select: {
                    email: true,
                    address: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    res.json({ milestone });
  } catch (error) {
    console.error('Error fetching milestone:', error);
    res.status(500).json({ error: 'Failed to fetch milestone' });
  }
});

/**
 * POST /api/milestones
 * Create a new milestone
 */
router.post('/', async (req, res) => {
  try {
    const { projectId, name, tier, order, dueDate } = req.body;

    if (!projectId || !name || tier === undefined) {
      return res.status(400).json({
        error: 'projectId, name, and tier are required'
      });
    }

    // Get the highest order for this project if not specified
    let milestoneOrder = order;
    if (milestoneOrder === undefined) {
      const lastMilestone = await prisma.milestone.findFirst({
        where: { projectId },
        orderBy: { order: 'desc' }
      });
      milestoneOrder = lastMilestone ? lastMilestone.order + 1 : 1;
    }

    const milestone = await prisma.milestone.create({
      data: {
        projectId,
        name,
        tier: parseInt(tier),
        order: milestoneOrder,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'PENDING'
      }
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'milestone_created',
        resourceType: 'milestone',
        resourceId: milestone.id,
        details: { projectId, name, tier, order: milestoneOrder }
      }
    });

    res.status(201).json({ milestone });
  } catch (error) {
    console.error('Error creating milestone:', error);
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

/**
 * PATCH /api/milestones/:id
 * Update milestone details
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, order, dueDate } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (status !== undefined) updateData.status = status;
    if (order !== undefined) updateData.order = order;
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }

    // Auto-set completedAt when status changes to COMPLETED
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    } else if (status === 'PENDING' || status === 'IN_PROGRESS') {
      updateData.completedAt = null;
    }

    const milestone = await prisma.milestone.update({
      where: { id },
      data: updateData
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'milestone_updated',
        resourceType: 'milestone',
        resourceId: id,
        details: updateData
      }
    });

    res.json({ milestone });
  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

/**
 * POST /api/milestones/:id/complete
 * Mark milestone as completed
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const milestone = await prisma.milestone.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      },
      include: {
        project: {
          select: { id: true, name: true, clientId: true }
        }
      }
    });

    // Check if this was the last milestone
    const remainingMilestones = await prisma.milestone.count({
      where: {
        projectId: milestone.projectId,
        status: { not: 'COMPLETED' }
      }
    });

    // Auto-advance next milestone to IN_PROGRESS
    if (remainingMilestones > 0) {
      const nextMilestone = await prisma.milestone.findFirst({
        where: {
          projectId: milestone.projectId,
          status: 'PENDING'
        },
        orderBy: { order: 'asc' }
      });

      if (nextMilestone) {
        await prisma.milestone.update({
          where: { id: nextMilestone.id },
          data: { status: 'IN_PROGRESS' }
        });
      }
    } else {
      // All milestones completed - update project status
      await prisma.project.update({
        where: { id: milestone.projectId },
        data: { status: 'DELIVERED' }
      });
    }

    // Log activity
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: 'milestone_completed',
        resourceType: 'milestone',
        resourceId: id,
        details: {
          projectId: milestone.projectId,
          milestoneName: milestone.name,
          remainingMilestones
        }
      }
    });

    res.json({
      milestone,
      projectComplete: remainingMilestones === 0
    });
  } catch (error) {
    console.error('Error completing milestone:', error);
    res.status(500).json({ error: 'Failed to complete milestone' });
  }
});

/**
 * POST /api/milestones/:id/start
 * Mark milestone as in-progress
 */
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    const milestone = await prisma.milestone.update({
      where: { id },
      data: { status: 'IN_PROGRESS' }
    });

    // Update project status if needed
    await prisma.project.update({
      where: { id: milestone.projectId },
      data: { status: 'IN_PROGRESS' }
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'milestone_started',
        resourceType: 'milestone',
        resourceId: id,
        details: {
          projectId: milestone.projectId,
          milestoneName: milestone.name
        }
      }
    });

    res.json({ milestone });
  } catch (error) {
    console.error('Error starting milestone:', error);
    res.status(500).json({ error: 'Failed to start milestone' });
  }
});

/**
 * DELETE /api/milestones/:id
 * Delete a milestone
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const milestone = await prisma.milestone.delete({
      where: { id }
    });

    // Reorder remaining milestones
    await prisma.$executeRaw`
      UPDATE milestones
      SET "order" = "order" - 1
      WHERE project_id = ${milestone.projectId}
        AND "order" > ${milestone.order}
    `;

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'milestone_deleted',
        resourceType: 'milestone',
        resourceId: id,
        details: {
          projectId: milestone.projectId,
          name: milestone.name
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
});

/**
 * POST /api/milestones/reorder
 * Reorder milestones for a project
 */
router.post('/reorder', async (req, res) => {
  try {
    const { projectId, orderedIds } = req.body;

    if (!projectId || !orderedIds || !Array.isArray(orderedIds)) {
      return res.status(400).json({
        error: 'projectId and orderedIds array are required'
      });
    }

    // Update order for each milestone
    const updates = orderedIds.map((id, index) =>
      prisma.milestone.update({
        where: { id },
        data: { order: index + 1 }
      })
    );

    await prisma.$transaction(updates);

    // Fetch updated milestones
    const milestones = await prisma.milestone.findMany({
      where: { projectId },
      orderBy: { order: 'asc' }
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'milestones_reordered',
        resourceType: 'project',
        resourceId: projectId,
        details: { newOrder: orderedIds }
      }
    });

    res.json({ milestones });
  } catch (error) {
    console.error('Error reordering milestones:', error);
    res.status(500).json({ error: 'Failed to reorder milestones' });
  }
});

module.exports = router;
