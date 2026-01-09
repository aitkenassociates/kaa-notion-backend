/**
 * Notion Sync Routes
 *
 * API endpoints for bidirectional sync between Postgres and Notion:
 * - Sync projects to/from Notion
 * - Sync milestones
 * - Sync deliverables
 * - Webhook handlers for Notion updates
 */

const express = require('express');
const { Client } = require('@notionhq/client');
const prisma = require('../lib/prisma');
require('dotenv').config();

const router = express.Router();

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Notion database IDs
const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID;
const MILESTONES_DB_ID = process.env.NOTION_MILESTONES_DB_ID;
const DELIVERABLES_DB_ID = process.env.NOTION_DELIVERABLES_DB_ID;

// Sync queue for reliable updates
const syncQueue = [];
let isProcessingQueue = false;

/**
 * GET /api/notion-sync/status
 * Get sync status and configuration
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      notionConfigured: !!process.env.NOTION_API_KEY,
      databases: {
        projects: !!PROJECTS_DB_ID,
        milestones: !!MILESTONES_DB_ID,
        deliverables: !!DELIVERABLES_DB_ID
      },
      queueLength: syncQueue.length,
      isProcessing: isProcessingQueue
    };

    // Test Notion connection
    if (process.env.NOTION_API_KEY) {
      try {
        await notion.users.me();
        status.notionConnected = true;
      } catch (err) {
        status.notionConnected = false;
        status.notionError = err.message;
      }
    }

    res.json(status);
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

/**
 * POST /api/notion-sync/projects/:projectId/to-notion
 * Sync a project from Postgres to Notion
 */
router.post('/projects/:projectId/to-notion', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!PROJECTS_DB_ID) {
      return res.status(400).json({
        error: 'Notion Projects database not configured'
      });
    }

    // Get project from Postgres
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: {
          include: {
            user: {
              select: { email: true, address: true }
            }
          }
        },
        milestones: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    let notionPageId = project.notionPageId;

    if (notionPageId) {
      // Update existing Notion page
      await notion.pages.update({
        page_id: notionPageId,
        properties: mapProjectToNotionProperties(project)
      });
    } else {
      // Create new Notion page
      const page = await notion.pages.create({
        parent: { database_id: PROJECTS_DB_ID },
        properties: mapProjectToNotionProperties(project),
        children: generateProjectPageContent(project)
      });

      notionPageId = page.id;

      // Update Postgres with Notion page ID
      await prisma.project.update({
        where: { id: projectId },
        data: { notionPageId }
      });
    }

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'project_synced_to_notion',
        resourceType: 'project',
        resourceId: projectId,
        details: { notionPageId }
      }
    });

    res.json({
      success: true,
      notionPageId,
      notionUrl: `https://notion.so/${notionPageId.replace(/-/g, '')}`
    });
  } catch (error) {
    console.error('Error syncing project to Notion:', error);
    res.status(500).json({ error: 'Failed to sync to Notion', details: error.message });
  }
});

/**
 * POST /api/notion-sync/projects/:projectId/from-notion
 * Sync a project from Notion to Postgres
 */
router.post('/projects/:projectId/from-notion', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { notionPageId: true }
    });

    if (!project?.notionPageId) {
      return res.status(400).json({
        error: 'Project not linked to Notion page'
      });
    }

    // Get Notion page
    const page = await notion.pages.retrieve({
      page_id: project.notionPageId
    });

    // Map Notion properties to Postgres fields
    const updates = mapNotionPropertiesToProject(page.properties);

    // Update Postgres
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: updates
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'project_synced_from_notion',
        resourceType: 'project',
        resourceId: projectId,
        details: updates
      }
    });

    res.json({
      success: true,
      project: updatedProject
    });
  } catch (error) {
    console.error('Error syncing project from Notion:', error);
    res.status(500).json({ error: 'Failed to sync from Notion', details: error.message });
  }
});

/**
 * POST /api/notion-sync/bulk-sync
 * Sync all projects bidirectionally
 */
router.post('/bulk-sync', async (req, res) => {
  try {
    const { direction = 'to-notion' } = req.body;

    const projects = await prisma.project.findMany({
      include: {
        client: {
          include: {
            user: { select: { email: true, address: true } }
          }
        },
        milestones: { orderBy: { order: 'asc' } }
      }
    });

    const results = {
      total: projects.length,
      synced: 0,
      failed: 0,
      errors: []
    };

    for (const project of projects) {
      try {
        if (direction === 'to-notion') {
          await queueSyncJob('project-to-notion', project.id);
        } else {
          if (project.notionPageId) {
            await queueSyncJob('project-from-notion', project.id);
          }
        }
        results.synced++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          projectId: project.id,
          error: err.message
        });
      }
    }

    // Start processing queue
    processSyncQueue();

    res.json({
      success: true,
      results,
      message: `Queued ${results.synced} projects for sync`
    });
  } catch (error) {
    console.error('Error bulk syncing:', error);
    res.status(500).json({ error: 'Failed to bulk sync' });
  }
});

/**
 * POST /api/notion-sync/milestones/:milestoneId/to-notion
 * Sync milestone to Notion
 */
router.post('/milestones/:milestoneId/to-notion', async (req, res) => {
  try {
    const { milestoneId } = req.params;

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: {
          select: { notionPageId: true, name: true }
        }
      }
    });

    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (!milestone.project.notionPageId) {
      return res.status(400).json({
        error: 'Project not linked to Notion. Sync project first.'
      });
    }

    // Add milestone as block to project page
    await notion.blocks.children.append({
      block_id: milestone.project.notionPageId,
      children: [{
        type: 'to_do',
        to_do: {
          rich_text: [{
            type: 'text',
            text: { content: milestone.name }
          }],
          checked: milestone.status === 'COMPLETED'
        }
      }]
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error syncing milestone to Notion:', error);
    res.status(500).json({ error: 'Failed to sync milestone' });
  }
});

/**
 * POST /api/notion-sync/webhook
 * Handle Notion webhook updates (for future Notion webhook support)
 */
router.post('/webhook', async (req, res) => {
  try {
    const { type, page, database } = req.body;

    console.log('Notion webhook received:', type);

    // Verify webhook signature if configured
    // const signature = req.headers['x-notion-signature'];

    switch (type) {
      case 'page_updated':
        await handlePageUpdate(page);
        break;

      case 'page_created':
        await handlePageCreated(page);
        break;

      case 'page_deleted':
        await handlePageDeleted(page);
        break;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * GET /api/notion-sync/queue
 * Get sync queue status
 */
router.get('/queue', async (req, res) => {
  res.json({
    queueLength: syncQueue.length,
    isProcessing: isProcessingQueue,
    items: syncQueue.slice(0, 10) // Show first 10 items
  });
});

/**
 * POST /api/notion-sync/queue/process
 * Manually trigger queue processing
 */
router.post('/queue/process', async (req, res) => {
  if (isProcessingQueue) {
    return res.json({ message: 'Queue is already being processed' });
  }

  processSyncQueue();
  res.json({ message: 'Queue processing started' });
});

/**
 * DELETE /api/notion-sync/queue/clear
 * Clear the sync queue
 */
router.delete('/queue/clear', async (req, res) => {
  const cleared = syncQueue.length;
  syncQueue.length = 0;
  res.json({ cleared });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map project data to Notion properties
 */
function mapProjectToNotionProperties(project) {
  return {
    'Name': {
      title: [{ text: { content: project.name } }]
    },
    'Status': {
      select: { name: mapStatusToNotion(project.status) }
    },
    'Tier': {
      number: project.tier
    },
    'Client': {
      rich_text: [{
        text: {
          content: project.client?.user?.email || project.client?.user?.address || 'Unknown'
        }
      }]
    },
    'Created': {
      date: { start: project.createdAt.toISOString() }
    },
    'Updated': {
      date: { start: project.updatedAt.toISOString() }
    },
    'Progress': {
      number: calculateProgress(project.milestones)
    }
  };
}

/**
 * Map Notion properties to project data
 */
function mapNotionPropertiesToProject(properties) {
  const updates = {};

  if (properties['Name']?.title?.[0]?.plain_text) {
    updates.name = properties['Name'].title[0].plain_text;
  }

  if (properties['Status']?.select?.name) {
    updates.status = mapNotionStatusToPostgres(properties['Status'].select.name);
  }

  return updates;
}

/**
 * Generate Notion page content for a project
 */
function generateProjectPageContent(project) {
  const blocks = [
    {
      type: 'heading_2',
      heading_2: {
        rich_text: [{ text: { content: 'Project Overview' } }]
      }
    },
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          text: {
            content: `Tier ${project.tier} Project - ${getTierName(project.tier)}`
          }
        }]
      }
    },
    {
      type: 'divider',
      divider: {}
    },
    {
      type: 'heading_2',
      heading_2: {
        rich_text: [{ text: { content: 'Milestones' } }]
      }
    }
  ];

  // Add milestones as to-do items
  for (const milestone of project.milestones || []) {
    blocks.push({
      type: 'to_do',
      to_do: {
        rich_text: [{
          text: { content: `${milestone.order}. ${milestone.name}` }
        }],
        checked: milestone.status === 'COMPLETED'
      }
    });
  }

  return blocks;
}

/**
 * Map Postgres status to Notion
 */
function mapStatusToNotion(status) {
  const mapping = {
    'ONBOARDING': 'Onboarding',
    'IN_PROGRESS': 'In Progress',
    'AWAITING_FEEDBACK': 'Awaiting Feedback',
    'REVISIONS': 'Revisions',
    'DELIVERED': 'Delivered',
    'CLOSED': 'Closed'
  };
  return mapping[status] || status;
}

/**
 * Map Notion status to Postgres
 */
function mapNotionStatusToPostgres(status) {
  const mapping = {
    'Onboarding': 'ONBOARDING',
    'In Progress': 'IN_PROGRESS',
    'Awaiting Feedback': 'AWAITING_FEEDBACK',
    'Revisions': 'REVISIONS',
    'Delivered': 'DELIVERED',
    'Closed': 'CLOSED'
  };
  return mapping[status] || 'IN_PROGRESS';
}

/**
 * Get tier name
 */
function getTierName(tier) {
  const names = {
    1: 'The Concept',
    2: 'The Builder',
    3: 'The Concierge',
    4: 'KAA White Glove'
  };
  return names[tier] || 'Unknown';
}

/**
 * Calculate project progress from milestones
 */
function calculateProgress(milestones) {
  if (!milestones || milestones.length === 0) return 0;
  const completed = milestones.filter(m => m.status === 'COMPLETED').length;
  return Math.round((completed / milestones.length) * 100);
}

/**
 * Queue a sync job
 */
async function queueSyncJob(type, resourceId, data = {}) {
  const job = {
    id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    resourceId,
    data,
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date()
  };

  syncQueue.push(job);
  return job;
}

/**
 * Process sync queue
 */
async function processSyncQueue() {
  if (isProcessingQueue || syncQueue.length === 0) return;

  isProcessingQueue = true;

  while (syncQueue.length > 0) {
    const job = syncQueue[0];

    try {
      job.attempts++;

      switch (job.type) {
        case 'project-to-notion':
          await syncProjectToNotion(job.resourceId);
          break;

        case 'project-from-notion':
          await syncProjectFromNotion(job.resourceId);
          break;

        case 'milestone-to-notion':
          await syncMilestoneToNotion(job.resourceId);
          break;
      }

      // Success - remove from queue
      syncQueue.shift();

    } catch (error) {
      console.error(`Sync job failed (attempt ${job.attempts}):`, error);

      if (job.attempts >= job.maxAttempts) {
        // Max attempts reached - remove and log failure
        syncQueue.shift();
        await prisma.auditLog.create({
          data: {
            action: 'sync_failed',
            resourceType: job.type,
            resourceId: job.resourceId,
            details: {
              error: error.message,
              attempts: job.attempts
            }
          }
        });
      } else {
        // Retry later - move to end of queue
        syncQueue.shift();
        syncQueue.push(job);
      }
    }

    // Small delay between jobs
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  isProcessingQueue = false;
}

/**
 * Sync project to Notion (internal)
 */
async function syncProjectToNotion(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: {
        include: { user: { select: { email: true, address: true } } }
      },
      milestones: { orderBy: { order: 'asc' } }
    }
  });

  if (!project || !PROJECTS_DB_ID) return;

  if (project.notionPageId) {
    await notion.pages.update({
      page_id: project.notionPageId,
      properties: mapProjectToNotionProperties(project)
    });
  } else {
    const page = await notion.pages.create({
      parent: { database_id: PROJECTS_DB_ID },
      properties: mapProjectToNotionProperties(project),
      children: generateProjectPageContent(project)
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { notionPageId: page.id }
    });
  }
}

/**
 * Sync project from Notion (internal)
 */
async function syncProjectFromNotion(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { notionPageId: true }
  });

  if (!project?.notionPageId) return;

  const page = await notion.pages.retrieve({
    page_id: project.notionPageId
  });

  const updates = mapNotionPropertiesToProject(page.properties);

  await prisma.project.update({
    where: { id: projectId },
    data: updates
  });
}

/**
 * Sync milestone to Notion (internal)
 */
async function syncMilestoneToNotion(milestoneId) {
  // Implementation for milestone sync
  console.log('Syncing milestone:', milestoneId);
}

/**
 * Handle Notion page update webhook
 */
async function handlePageUpdate(page) {
  if (!page?.id) return;

  // Find project by Notion page ID
  const project = await prisma.project.findFirst({
    where: { notionPageId: page.id }
  });

  if (project) {
    await queueSyncJob('project-from-notion', project.id);
  }
}

/**
 * Handle Notion page created webhook
 */
async function handlePageCreated(page) {
  console.log('Page created in Notion:', page?.id);
  // Could create corresponding Postgres record
}

/**
 * Handle Notion page deleted webhook
 */
async function handlePageDeleted(page) {
  if (!page?.id) return;

  // Find and unlink project
  const project = await prisma.project.findFirst({
    where: { notionPageId: page.id }
  });

  if (project) {
    await prisma.project.update({
      where: { id: project.id },
      data: { notionPageId: null }
    });
  }
}

module.exports = router;
