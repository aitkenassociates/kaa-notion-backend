/**
 * Portfolio Routes
 * API endpoints for portfolio gallery management
 */

import { Router, Request, Response } from 'express';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware';
import * as portfolioService from '../services/portfolioService';

const router = Router();

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * GET /api/portfolio
 * Get all public portfolio projects with pagination
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { page, limit, tag, projectType, featured } = req.query;

    const portfolios = await portfolioService.getPublicPortfolios({
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      tag: tag as string,
      projectType: projectType as string,
      featured: featured === 'true',
    });

    res.json(portfolios);
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    res.status(500).json({ error: 'Failed to fetch portfolios' });
  }
});

/**
 * GET /api/portfolio/featured
 * Get featured portfolio projects
 */
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const featured = await portfolioService.getFeaturedPortfolios(
      limit ? parseInt(limit as string, 10) : 6
    );
    res.json(featured);
  } catch (error) {
    console.error('Error fetching featured portfolios:', error);
    res.status(500).json({ error: 'Failed to fetch featured portfolios' });
  }
});

/**
 * GET /api/portfolio/categories
 * Get all categories with project counts
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const tags = await portfolioService.getPortfolioTags();
    res.json(tags);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/portfolio/:slug
 * Get a single portfolio project by slug
 */
router.get('/:slug', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const portfolio = await portfolioService.getPortfolioBySlug(slug);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Check if portfolio is published or user is admin
    const isAdmin = (req as any).user?.role === 'ADMIN';
    if (!portfolio.publishedAt && !isAdmin) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    res.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * POST /api/portfolio
 * Create a new portfolio project (admin only)
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const portfolio = await portfolioService.createPortfolio(req.body);
    res.status(201).json(portfolio);
  } catch (error: any) {
    console.error('Error creating portfolio:', error);
    res.status(400).json({ error: error.message || 'Failed to create portfolio' });
  }
});

/**
 * POST /api/portfolio/from-project/:projectId
 * Create portfolio from an existing project (admin only)
 */
router.post('/from-project/:projectId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { projectId } = req.params;
    const portfolio = await portfolioService.createFromProject(projectId, req.body);
    res.status(201).json(portfolio);
  } catch (error: any) {
    console.error('Error creating portfolio from project:', error);
    res.status(400).json({ error: error.message || 'Failed to create portfolio' });
  }
});

/**
 * PUT /api/portfolio/:id
 * Update a portfolio project (admin only)
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const portfolio = await portfolioService.updatePortfolio(id, req.body);
    res.json(portfolio);
  } catch (error: any) {
    console.error('Error updating portfolio:', error);
    res.status(400).json({ error: error.message || 'Failed to update portfolio' });
  }
});

/**
 * DELETE /api/portfolio/:id
 * Delete a portfolio project (admin only)
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    await portfolioService.deletePortfolio(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting portfolio:', error);
    res.status(400).json({ error: error.message || 'Failed to delete portfolio' });
  }
});

/**
 * POST /api/portfolio/:id/publish
 * Publish a portfolio project (admin only)
 */
router.post('/:id/publish', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const portfolio = await portfolioService.publishPortfolio(id);
    res.json(portfolio);
  } catch (error: any) {
    console.error('Error publishing portfolio:', error);
    res.status(400).json({ error: error.message || 'Failed to publish portfolio' });
  }
});

/**
 * POST /api/portfolio/:id/unpublish
 * Unpublish a portfolio project (admin only)
 */
router.post('/:id/unpublish', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const portfolio = await portfolioService.unpublishPortfolio(id);
    res.json(portfolio);
  } catch (error: any) {
    console.error('Error unpublishing portfolio:', error);
    res.status(400).json({ error: error.message || 'Failed to unpublish portfolio' });
  }
});

/**
 * POST /api/portfolio/:id/feature
 * Feature/unfeature a portfolio project (admin only)
 */
router.post('/:id/feature', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { featured } = req.body;
    // Use toggleFeatured for simple toggle, or update with featured field
    const portfolio = await portfolioService.updatePortfolio(id, { featured: featured !== false });
    res.json(portfolio);
  } catch (error: any) {
    console.error('Error featuring portfolio:', error);
    res.status(400).json({ error: error.message || 'Failed to feature portfolio' });
  }
});

// ============================================
// IMAGE MANAGEMENT
// ============================================

/**
 * POST /api/portfolio/:id/images
 * Add an image to a portfolio (admin only)
 */
router.post('/:id/images', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const image = await portfolioService.addImage(id, req.body);
    res.status(201).json(image);
  } catch (error: any) {
    console.error('Error adding image:', error);
    res.status(400).json({ error: error.message || 'Failed to add image' });
  }
});

/**
 * PUT /api/portfolio/:id/images/:imageId
 * Update an image (admin only)
 */
router.put('/:id/images/:imageId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { imageId } = req.params;
    const image = await portfolioService.updateImage(imageId, req.body);
    res.json(image);
  } catch (error: any) {
    console.error('Error updating image:', error);
    res.status(400).json({ error: error.message || 'Failed to update image' });
  }
});

/**
 * DELETE /api/portfolio/:id/images/:imageId
 * Delete an image (admin only)
 */
router.delete('/:id/images/:imageId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { imageId } = req.params;
    await portfolioService.deleteImage(imageId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting image:', error);
    res.status(400).json({ error: error.message || 'Failed to delete image' });
  }
});

/**
 * POST /api/portfolio/:id/images/:imageId/cover
 * Set an image as cover (admin only)
 */
router.post('/:id/images/:imageId/cover', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id, imageId } = req.params;
    const portfolio = await portfolioService.setCoverImage(id, imageId);
    res.json(portfolio);
  } catch (error: any) {
    console.error('Error setting cover image:', error);
    res.status(400).json({ error: error.message || 'Failed to set cover image' });
  }
});

/**
 * PUT /api/portfolio/:id/images/reorder
 * Reorder images (admin only)
 */
router.put('/:id/images/reorder', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { imageIds } = req.body;

    if (!Array.isArray(imageIds)) {
      return res.status(400).json({ error: 'imageIds must be an array' });
    }

    await portfolioService.reorderImages(id, imageIds);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error reordering images:', error);
    res.status(400).json({ error: error.message || 'Failed to reorder images' });
  }
});

export default router;
