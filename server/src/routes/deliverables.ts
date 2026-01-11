/**
 * Deliverables Routes
 * API endpoints for deliverable management.
 *
 * Routes:
 * - GET /api/projects/:projectId/deliverables - Get all deliverables for a project
 * - POST /api/projects/:projectId/deliverables - Upload a new deliverable (admin only)
 * - GET /api/deliverables/:id - Get single deliverable details
 * - GET /api/deliverables/:id/download - Get signed download URL
 * - DELETE /api/deliverables/:id - Delete deliverable (admin only)
 */

import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from './projects';
import { logger } from '../logger';
import { internalError } from '../utils/AppError';
import { recordDeliverableUploaded } from '../config/metrics';
import { getStorageService } from '../services/storageService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Deliverable category types
 */
export type DeliverableCategory =
  | 'Document'
  | 'Photo'
  | 'Rendering'
  | 'FloorPlan'
  | 'Invoice'
  | 'Contract'
  | 'Other';

/**
 * Deliverable detail response
 */
interface DeliverableDetail {
  id: string;
  projectId: string;
  name: string;
  category: string;
  description: string | null;
  fileType: string;
  fileSize: number;
  fileSizeFormatted: string;
  createdAt: Date;
  uploadedBy: {
    id: string;
    email: string | null;
  };
}

/**
 * Project deliverables response with summary
 */
interface ProjectDeliverablesResponse {
  success: boolean;
  data: {
    projectId: string;
    projectName: string;
    summary: {
      total: number;
      byCategory: Record<string, number>;
      totalSize: number;
      totalSizeFormatted: string;
    };
    deliverables: DeliverableDetail[];
  };
}

/**
 * Create deliverable request body
 */
interface CreateDeliverableBody {
  name: string;
  category: DeliverableCategory;
  description?: string;
  filePath: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
}

/**
 * Signed URL response
 */
interface SignedUrlResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    downloadUrl: string;
    expiresAt: Date;
    fileType: string;
    fileSize: number;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format file size to human-readable string
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate a signed URL for file download
 * In production, this would use Supabase Storage signed URLs
 * For now, returns the file URL with an expiry parameter
 */
function generateSignedUrl(fileUrl: string, expiresInMinutes: number = 60): { url: string; expiresAt: Date } {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
  
  // In production, replace with actual Supabase Storage signed URL generation:
  // const { data } = await supabase.storage.from('deliverables').createSignedUrl(filePath, expiresInMinutes * 60);
  
  // For now, append expiry as query param (placeholder implementation)
  const url = new URL(fileUrl);
  url.searchParams.set('expires', expiresAt.getTime().toString());
  url.searchParams.set('token', Buffer.from(`${fileUrl}:${expiresAt.getTime()}`).toString('base64').slice(0, 32));
  
  return { url: url.toString(), expiresAt };
}

/**
 * Validate file type is allowed
 */
function isAllowedFileType(mimeType: string): boolean {
  const allowedTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Design files
    'application/postscript', // AI, EPS
    'image/vnd.dwg', // DWG
    'application/acad', // DWG alternate
    // Archives
    'application/zip',
    'application/x-rar-compressed',
  ];
  
  return allowedTypes.includes(mimeType);
}

/**
 * Transform deliverable to detail format
 */
function toDeliverableDetail(deliverable: {
  id: string;
  projectId: string;
  name: string;
  category: string;
  description: string | null;
  fileType: string;
  fileSize: number;
  createdAt: Date;
  uploadedBy: {
    id: string;
    email: string | null;
  };
}): DeliverableDetail {
  return {
    id: deliverable.id,
    projectId: deliverable.projectId,
    name: deliverable.name,
    category: deliverable.category,
    description: deliverable.description,
    fileType: deliverable.fileType,
    fileSize: deliverable.fileSize,
    fileSizeFormatted: formatFileSize(deliverable.fileSize),
    createdAt: deliverable.createdAt,
    uploadedBy: {
      id: deliverable.uploadedBy.id,
      email: deliverable.uploadedBy.email,
    },
  };
}

// ============================================================================
// ROUTE FACTORY
// ============================================================================

/**
 * Create deliverables router with dependency injection
 */
export function createDeliverablesRouter(prisma: PrismaClient): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // GET /api/projects/:projectId/deliverables - Get all deliverables for a project
  // -------------------------------------------------------------------------
  router.get(
    '/projects/:projectId/deliverables',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params;
        const { category } = req.query;
        const user = req.user!;

        // Get project with deliverables
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            deliverables: {
              where: category ? { category: category as string } : undefined,
              orderBy: { createdAt: 'desc' },
              include: {
                uploadedBy: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
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
        const total = project.deliverables.length;
        const totalSize = project.deliverables.reduce((sum, d) => sum + d.fileSize, 0);
        
        // Count by category
        const byCategory: Record<string, number> = {};
        project.deliverables.forEach((d) => {
          byCategory[d.category] = (byCategory[d.category] || 0) + 1;
        });

        const response: ProjectDeliverablesResponse = {
          success: true,
          data: {
            projectId: project.id,
            projectName: project.name,
            summary: {
              total,
              byCategory,
              totalSize,
              totalSizeFormatted: formatFileSize(totalSize),
            },
            deliverables: project.deliverables.map(toDeliverableDetail),
          },
        };

        res.json(response);
      } catch (error) {
        next(internalError('Failed to fetch deliverables', error as Error));
      }
    }
  );

  // -------------------------------------------------------------------------
  // POST /api/projects/:projectId/deliverables - Upload a new deliverable
  // -------------------------------------------------------------------------
  router.post(
    '/projects/:projectId/deliverables',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params;
        const body = req.body as CreateDeliverableBody;
        const user = req.user!;

        // Validate required fields
        if (!body.name || !body.category || !body.filePath || !body.fileUrl || !body.fileSize || !body.fileType) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Missing required fields: name, category, filePath, fileUrl, fileSize, fileType',
            },
          });
        }

        // Validate file type
        if (!isAllowedFileType(body.fileType)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_FILE_TYPE',
              message: `File type ${body.fileType} is not allowed`,
            },
          });
        }

        // Check project exists
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true, clientId: true },
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

        // Create deliverable
        const deliverable = await prisma.deliverable.create({
          data: {
            projectId,
            name: body.name,
            category: body.category,
            description: body.description || null,
            filePath: body.filePath,
            fileUrl: body.fileUrl,
            fileSize: body.fileSize,
            fileType: body.fileType,
            uploadedById: user.id,
          },
          include: {
            uploadedBy: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        });

        // Log the upload
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'deliverable_upload',
            resourceType: 'deliverable',
            resourceId: deliverable.id,
            details: {
              projectId,
              fileName: body.name,
              category: body.category,
              fileSize: body.fileSize,
              fileType: body.fileType,
            },
          },
        });

        logger.info(`Deliverable ${deliverable.id} uploaded to project ${projectId} by user ${user.id}`);
        recordDeliverableUploaded(body.category);

        res.status(201).json({
          success: true,
          data: toDeliverableDetail(deliverable),
        });
      } catch (error) {
        next(internalError('Failed to upload deliverable', error as Error));
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /api/deliverables/:id - Get single deliverable details
  // -------------------------------------------------------------------------
  router.get(
    '/deliverables/:id',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;

        // Get deliverable with project info
        const deliverable = await prisma.deliverable.findUnique({
          where: { id },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                clientId: true,
                tier: true,
              },
            },
            uploadedBy: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        });

        if (!deliverable) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Deliverable not found',
            },
          });
        }

        // Authorization check
        if (user.userType !== 'ADMIN' && user.userType !== 'TEAM') {
          if (deliverable.project.clientId !== user.clientId) {
            return res.status(403).json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Access denied to this deliverable',
              },
            });
          }
        }

        res.json({
          success: true,
          data: {
            ...toDeliverableDetail(deliverable),
            project: {
              id: deliverable.project.id,
              name: deliverable.project.name,
              tier: deliverable.project.tier,
            },
          },
        });
      } catch (error) {
        next(internalError('Failed to fetch deliverable', error as Error));
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /api/deliverables/:id/download - Get signed download URL
  // -------------------------------------------------------------------------
  router.get(
    '/deliverables/:id/download',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;

        // Get deliverable with project info
        const deliverable = await prisma.deliverable.findUnique({
          where: { id },
          include: {
            project: {
              select: {
                id: true,
                clientId: true,
              },
            },
          },
        });

        if (!deliverable) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Deliverable not found',
            },
          });
        }

        // Authorization check
        if (user.userType !== 'ADMIN' && user.userType !== 'TEAM') {
          if (deliverable.project.clientId !== user.clientId) {
            return res.status(403).json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Access denied to this deliverable',
              },
            });
          }
        }

        // Generate signed URL (expires in 60 minutes)
        const { url, expiresAt } = generateSignedUrl(deliverable.fileUrl, 60);

        // Log the download request
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'deliverable_download',
            resourceType: 'deliverable',
            resourceId: id,
            details: {
              projectId: deliverable.projectId,
              fileName: deliverable.name,
            },
          },
        });

        const response: SignedUrlResponse = {
          success: true,
          data: {
            id: deliverable.id,
            name: deliverable.name,
            downloadUrl: url,
            expiresAt,
            fileType: deliverable.fileType,
            fileSize: deliverable.fileSize,
          },
        };

        res.json(response);
      } catch (error) {
        next(internalError('Failed to generate download URL', error as Error));
      }
    }
  );

  // -------------------------------------------------------------------------
  // DELETE /api/deliverables/:id - Delete deliverable (admin only)
  // -------------------------------------------------------------------------
  router.delete(
    '/deliverables/:id',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;

        // Get deliverable
        const deliverable = await prisma.deliverable.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            projectId: true,
            filePath: true,
          },
        });

        if (!deliverable) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Deliverable not found',
            },
          });
        }

        // Delete file from Supabase Storage first
        try {
          const storageService = getStorageService();
          const deleteResult = await storageService.deleteFile(deliverable.filePath);

          if (!deleteResult.success) {
            logger.warn('Failed to delete file from storage', {
              deliverableId: id,
              filePath: deliverable.filePath,
              error: deleteResult.error,
            });
            // Continue with database deletion even if storage deletion fails
            // The file can be cleaned up later via a maintenance task
          } else {
            logger.info('File deleted from storage', {
              deliverableId: id,
              filePath: deliverable.filePath,
            });
          }
        } catch (storageError) {
          // Storage service may not be initialized in some environments
          logger.warn('Storage service not available for file deletion', {
            deliverableId: id,
            filePath: deliverable.filePath,
            error: storageError instanceof Error ? storageError.message : 'Unknown error',
          });
        }

        // Delete from database
        await prisma.deliverable.delete({
          where: { id },
        });

        // Log the deletion
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'deliverable_delete',
            resourceType: 'deliverable',
            resourceId: id,
            details: {
              projectId: deliverable.projectId,
              fileName: deliverable.name,
            },
          },
        });

        logger.info(`Deliverable ${id} deleted by user ${user.id}`);

        res.json({
          success: true,
          message: 'Deliverable deleted successfully',
        });
      } catch (error) {
        next(internalError('Failed to delete deliverable', error as Error));
      }
    }
  );

  return router;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default createDeliverablesRouter;
