/**
 * Project Routes
 *
 * API endpoints for project management including:
 * - Project CRUD operations
 * - Project image uploads to Supabase Storage
 * - Project deliverables management
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { uploadFile, deleteFile, getSignedUrl } = require('../lib/supabase');
const prisma = require('../lib/prisma');

const router = express.Router();

// Configure multer for memory storage (for cloud uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for images
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  }
});

// Storage bucket name
const BUCKET_NAME = 'project-images';

/**
 * GET /api/projects
 * List all projects (with optional filters)
 */
router.get('/', async (req, res) => {
  try {
    const { clientId, status, tier, limit = 50, offset = 0 } = req.query;

    const where = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    if (tier) where.tier = parseInt(tier);

    const projects = await prisma.project.findMany({
      where,
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
        },
        milestones: {
          orderBy: { order: 'asc' }
        },
        deliverables: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        _count: {
          select: {
            milestones: true,
            deliverables: true,
            payments: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.project.count({ where });

    res.json({
      projects,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + projects.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/projects/:id
 * Get single project with full details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                address: true,
                userType: true
              }
            }
          }
        },
        milestones: {
          orderBy: { order: 'asc' }
        },
        deliverables: {
          include: {
            uploadedBy: {
              select: {
                email: true,
                userType: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req, res) => {
  try {
    const { clientId, name, tier, leadId } = req.body;

    if (!clientId || !name || !tier) {
      return res.status(400).json({
        error: 'clientId, name, and tier are required'
      });
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Create project with default milestones based on tier
    const project = await prisma.project.create({
      data: {
        clientId,
        name,
        tier: parseInt(tier),
        leadId: leadId || null,
        status: 'ONBOARDING',
        milestones: {
          create: getMilestonesForTier(parseInt(tier))
        }
      },
      include: {
        milestones: {
          orderBy: { order: 'asc' }
        }
      }
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'project_created',
        resourceType: 'project',
        resourceId: project.id,
        details: { name, tier, clientId }
      }
    });

    res.status(201).json({ project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * PATCH /api/projects/:id
 * Update project details
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, notionPageId } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (status !== undefined) updateData.status = status;
    if (notionPageId !== undefined) updateData.notionPageId = notionPageId;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        milestones: {
          orderBy: { order: 'asc' }
        }
      }
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'project_updated',
        resourceType: 'project',
        resourceId: id,
        details: updateData
      }
    });

    res.json({ project });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * POST /api/projects/:id/images
 * Upload project image to Supabase Storage
 */
router.post('/:id/images', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { category = 'General', description } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, clientId: true }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Generate unique filename
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    const filename = `${id}/${timestamp}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Upload to Supabase Storage
    const { path: storagePath, publicUrl } = await uploadFile(
      file.buffer,
      BUCKET_NAME,
      filename,
      file.mimetype
    );

    // Create deliverable record
    const deliverable = await prisma.deliverable.create({
      data: {
        projectId: id,
        name: file.originalname,
        filePath: storagePath,
        fileUrl: publicUrl,
        fileSize: file.size,
        fileType: file.mimetype,
        category,
        description: description || null,
        uploadedById: req.body.userId || project.clientId // Fallback to client
      }
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        userId: req.body.userId || null,
        action: 'image_uploaded',
        resourceType: 'deliverable',
        resourceId: deliverable.id,
        details: {
          projectId: id,
          fileName: file.originalname,
          fileSize: file.size,
          category
        }
      }
    });

    res.status(201).json({
      success: true,
      deliverable: {
        id: deliverable.id,
        name: deliverable.name,
        fileUrl: publicUrl,
        fileSize: deliverable.fileSize,
        fileType: deliverable.fileType,
        category: deliverable.category,
        createdAt: deliverable.createdAt
      }
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({
      error: 'Failed to upload image',
      details: error.message
    });
  }
});

/**
 * GET /api/projects/:id/images
 * List all images for a project
 */
router.get('/:id/images', async (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.query;

    const where = {
      projectId: id,
      fileType: {
        startsWith: 'image/'
      }
    };

    if (category) {
      where.category = category;
    }

    const images = await prisma.deliverable.findMany({
      where,
      select: {
        id: true,
        name: true,
        fileUrl: true,
        fileSize: true,
        fileType: true,
        category: true,
        description: true,
        createdAt: true,
        uploadedBy: {
          select: {
            email: true,
            userType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ images });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

/**
 * DELETE /api/projects/:projectId/images/:imageId
 * Delete a project image
 */
router.delete('/:projectId/images/:imageId', async (req, res) => {
  try {
    const { projectId, imageId } = req.params;

    // Get the deliverable
    const deliverable = await prisma.deliverable.findFirst({
      where: {
        id: imageId,
        projectId
      }
    });

    if (!deliverable) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete from Supabase Storage
    try {
      await deleteFile(BUCKET_NAME, deliverable.filePath);
    } catch (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete database record
    await prisma.deliverable.delete({
      where: { id: imageId }
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'image_deleted',
        resourceType: 'deliverable',
        resourceId: imageId,
        details: {
          projectId,
          fileName: deliverable.name
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

/**
 * GET /api/projects/:id/deliverables
 * List all deliverables for a project
 */
router.get('/:id/deliverables', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, fileType } = req.query;

    const where = { projectId: id };
    if (category) where.category = category;
    if (fileType) where.fileType = { startsWith: fileType };

    const deliverables = await prisma.deliverable.findMany({
      where,
      include: {
        uploadedBy: {
          select: {
            email: true,
            userType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ deliverables });
  } catch (error) {
    console.error('Error fetching deliverables:', error);
    res.status(500).json({ error: 'Failed to fetch deliverables' });
  }
});

/**
 * Helper: Get default milestones for a tier
 */
function getMilestonesForTier(tier) {
  const milestones = {
    1: [ // The Concept - Automated
      { name: 'Intake Form', order: 1, tier: 1 },
      { name: 'AI Concept Generation', order: 2, tier: 1 },
      { name: 'Concept Delivery', order: 3, tier: 1 },
      { name: 'Client Review', order: 4, tier: 1 },
      { name: 'Revisions (1)', order: 5, tier: 1 },
      { name: 'Final Delivery', order: 6, tier: 1 }
    ],
    2: [ // The Builder - Low Touch
      { name: 'Intake & Survey Review', order: 1, tier: 2 },
      { name: 'Site Analysis', order: 2, tier: 2 },
      { name: 'Concept Development', order: 3, tier: 2 },
      { name: 'Designer Checkpoint', order: 4, tier: 2 },
      { name: 'Draft Plans', order: 5, tier: 2 },
      { name: 'Client Presentation', order: 6, tier: 2 },
      { name: 'Revisions (2)', order: 7, tier: 2 },
      { name: 'Final Plans', order: 8, tier: 2 },
      { name: 'Plant List & Specs', order: 9, tier: 2 }
    ],
    3: [ // The Concierge - Site Visits
      { name: 'Initial Consultation', order: 1, tier: 3 },
      { name: 'Site Visit & Survey', order: 2, tier: 3 },
      { name: 'Concept Options', order: 3, tier: 3 },
      { name: 'Designer Review', order: 4, tier: 3 },
      { name: 'Client Selection', order: 5, tier: 3 },
      { name: 'Schematic Design', order: 6, tier: 3 },
      { name: 'Design Development', order: 7, tier: 3 },
      { name: 'Client Review Session', order: 8, tier: 3 },
      { name: 'Construction Documents', order: 9, tier: 3 },
      { name: 'Contractor Coordination', order: 10, tier: 3 },
      { name: 'Final Walkthrough', order: 11, tier: 3 }
    ],
    4: [ // KAA White Glove - Full Service
      { name: 'Discovery Session', order: 1, tier: 4 },
      { name: 'Site Analysis & Survey', order: 2, tier: 4 },
      { name: 'Vision Board', order: 3, tier: 4 },
      { name: 'Schematic Options (3+)', order: 4, tier: 4 },
      { name: 'Principal Review', order: 5, tier: 4 },
      { name: 'Client Presentation', order: 6, tier: 4 },
      { name: 'Design Refinement', order: 7, tier: 4 },
      { name: 'Design Development', order: 8, tier: 4 },
      { name: 'Material Selections', order: 9, tier: 4 },
      { name: 'Construction Documents', order: 10, tier: 4 },
      { name: 'Permit Coordination', order: 11, tier: 4 },
      { name: 'Bid Package', order: 12, tier: 4 },
      { name: 'Contractor Selection', order: 13, tier: 4 },
      { name: 'Construction Admin', order: 14, tier: 4 },
      { name: 'Final Walkthrough', order: 15, tier: 4 },
      { name: 'Project Closeout', order: 16, tier: 4 }
    ]
  };

  return milestones[tier] || milestones[1];
}

module.exports = router;
