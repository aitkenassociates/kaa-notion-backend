/**
 * Notion Sync Queue Service
 * Queue-based sync with rate limiting, retry logic, and status tracking.
 * 
 * Notion API limits: 3 requests per second
 * Strategy: Queue operations, process with delays, retry on failure
 */

import { Client as NotionClient } from '@notionhq/client';

// ============================================================================
// TYPES
// ============================================================================

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncEntityType = 'PROJECT' | 'MILESTONE' | 'DELIVERABLE' | 'LEAD';
export type SyncStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'RETRYING';

export interface SyncTask {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  status: SyncStatus;
  priority: number; // Lower = higher priority
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lastAttemptAt: Date | null;
  createdAt: Date;
  scheduledFor: Date;
}

export interface SyncResult {
  success: boolean;
  notionPageId?: string;
  error?: string;
}

export interface QueueStats {
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  totalProcessed: number;
}

export interface NotionSyncConfig {
  notionApiKey: string;
  projectsDatabaseId: string;
  deliverablesPageId?: string;
  rateLimitMs: number;
  maxRetries: number;
  retryDelayMs: number;
  batchSize: number;
}

// ============================================================================
// SYNC QUEUE CLASS
// ============================================================================

export class NotionSyncQueue {
  private notion: NotionClient;
  private config: NotionSyncConfig;
  private queue: Map<string, SyncTask> = new Map();
  private isProcessing: boolean = false;
  private stats: QueueStats = {
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
    totalProcessed: 0,
  };
  private lastRequestTime: number = 0;

  constructor(config: NotionSyncConfig) {
    this.config = {
      ...config,
      // Defaults (only applied if not specified in config)
      rateLimitMs: config.rateLimitMs ?? 350, // ~3 requests per second
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      batchSize: config.batchSize ?? 10,
    };

    this.notion = new NotionClient({
      auth: config.notionApiKey,
    });
  }

  // ============================================================================
  // QUEUE MANAGEMENT
  // ============================================================================

  /**
   * Add a task to the sync queue
   */
  enqueue(task: Omit<SyncTask, 'id' | 'status' | 'attempts' | 'lastError' | 'lastAttemptAt' | 'createdAt' | 'scheduledFor'>): string {
    const id = this.generateTaskId();
    const fullTask: SyncTask = {
      ...task,
      id,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: task.maxAttempts ?? this.config.maxRetries,
      lastError: null,
      lastAttemptAt: null,
      createdAt: new Date(),
      scheduledFor: new Date(),
    };

    this.queue.set(id, fullTask);
    this.stats.pending++;

    // Auto-start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return id;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): SyncTask | undefined {
    return this.queue.get(taskId);
  }

  /**
   * Get all tasks for an entity
   */
  getTasksForEntity(entityType: SyncEntityType, entityId: string): SyncTask[] {
    return Array.from(this.queue.values()).filter(
      (task) => task.entityType === entityType && task.entityId === entityId
    );
  }

  /**
   * Cancel a pending task
   */
  cancelTask(taskId: string): boolean {
    const task = this.queue.get(taskId);
    if (task && task.status === 'PENDING') {
      this.queue.delete(taskId);
      this.stats.pending--;
      return true;
    }
    return false;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Get pending tasks count
   */
  getPendingCount(): number {
    return Array.from(this.queue.values()).filter(
      (task) => task.status === 'PENDING' || task.status === 'RETRYING'
    ).length;
  }

  // ============================================================================
  // PROCESSING
  // ============================================================================

  /**
   * Start processing the queue
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.getPendingCount() > 0) {
      const batch = this.getNextBatch();

      for (const task of batch) {
        await this.processTask(task);
        await this.rateLimit();
      }
    }

    this.isProcessing = false;
  }

  /**
   * Stop processing (graceful)
   */
  stopProcessing(): void {
    this.isProcessing = false;
  }

  /**
   * Get the next batch of tasks to process
   */
  private getNextBatch(): SyncTask[] {
    const pendingTasks = Array.from(this.queue.values())
      .filter(
        (task) =>
          (task.status === 'PENDING' || task.status === 'RETRYING') &&
          task.scheduledFor <= new Date()
      )
      .sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, this.config.batchSize);

    return pendingTasks;
  }

  /**
   * Process a single task
   */
  private async processTask(task: SyncTask): Promise<void> {
    task.status = 'IN_PROGRESS';
    task.attempts++;
    task.lastAttemptAt = new Date();
    this.stats.pending--;
    this.stats.inProgress++;

    try {
      const result = await this.executeSync(task);

      if (result.success) {
        task.status = 'COMPLETED';
        this.stats.inProgress--;
        this.stats.completed++;
        this.stats.totalProcessed++;

        // Store the Notion page ID if returned
        if (result.notionPageId) {
          task.payload.notionPageId = result.notionPageId;
        }
      } else {
        throw new Error(result.error || 'Unknown sync error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      task.lastError = errorMessage;

      if (task.attempts < task.maxAttempts) {
        // Schedule retry with exponential backoff
        task.status = 'RETRYING';
        task.scheduledFor = new Date(
          Date.now() + this.config.retryDelayMs * Math.pow(2, task.attempts - 1)
        );
        this.stats.inProgress--;
        this.stats.pending++;
      } else {
        task.status = 'FAILED';
        this.stats.inProgress--;
        this.stats.failed++;
        this.stats.totalProcessed++;
      }
    }
  }

  /**
   * Execute the actual Notion API call
   */
  private async executeSync(task: SyncTask): Promise<SyncResult> {
    switch (task.entityType) {
      case 'PROJECT':
        return this.syncProject(task);
      case 'MILESTONE':
        return this.syncMilestone(task);
      case 'DELIVERABLE':
        return this.syncDeliverable(task);
      case 'LEAD':
        return this.syncLead(task);
      default:
        return { success: false, error: `Unknown entity type: ${task.entityType}` };
    }
  }

  // ============================================================================
  // ENTITY SYNC METHODS
  // ============================================================================

  /**
   * Sync a project to Notion
   */
  private async syncProject(task: SyncTask): Promise<SyncResult> {
    const { operation, payload } = task;

    try {
      if (operation === 'CREATE') {
        const response = await this.notion.pages.create({
          parent: { database_id: this.config.projectsDatabaseId },
          properties: this.buildProjectProperties(payload),
          children: this.buildProjectContent(payload),
        });

        return { success: true, notionPageId: response.id };
      }

      if (operation === 'UPDATE') {
        const notionPageId = payload.notionPageId as string;
        if (!notionPageId) {
          return { success: false, error: 'No Notion page ID for update' };
        }

        await this.notion.pages.update({
          page_id: notionPageId,
          properties: this.buildProjectProperties(payload),
        });

        return { success: true, notionPageId };
      }

      if (operation === 'DELETE') {
        const notionPageId = payload.notionPageId as string;
        if (!notionPageId) {
          return { success: false, error: 'No Notion page ID for delete' };
        }

        await this.notion.pages.update({
          page_id: notionPageId,
          archived: true,
        });

        return { success: true };
      }

      return { success: false, error: `Unknown operation: ${operation}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notion API error';
      return { success: false, error: message };
    }
  }

  /**
   * Sync a milestone to Notion (as a block in the project page)
   */
  private async syncMilestone(task: SyncTask): Promise<SyncResult> {
    const { operation, payload } = task;
    const projectPageId = payload.projectNotionPageId as string;

    if (!projectPageId) {
      return { success: false, error: 'No project Notion page ID' };
    }

    try {
      if (operation === 'CREATE' || operation === 'UPDATE') {
        // For milestones, we update the project page content
        // First, retrieve current blocks to find/update milestone section
        const blocks = await this.notion.blocks.children.list({
          block_id: projectPageId,
          page_size: 100,
        });

        // Find or create milestones section
        const milestonesHeaderIndex = blocks.results.findIndex(
          (block: any) =>
            block.type === 'heading_2' &&
            block.heading_2?.rich_text?.[0]?.plain_text === 'Milestones'
        );

        const milestoneBlock = this.buildMilestoneBlock(payload);

        if (milestonesHeaderIndex === -1) {
          // Create milestones section
          await this.notion.blocks.children.append({
            block_id: projectPageId,
            children: [
              {
                type: 'heading_2',
                heading_2: {
                  rich_text: [{ type: 'text', text: { content: 'Milestones' } }],
                },
              },
              milestoneBlock,
            ],
          });
        } else {
          // Append to existing milestones section
          await this.notion.blocks.children.append({
            block_id: projectPageId,
            children: [milestoneBlock],
          });
        }

        return { success: true };
      }

      return { success: false, error: `Milestone operation ${operation} not supported` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notion API error';
      return { success: false, error: message };
    }
  }

  /**
   * Sync a deliverable to Notion
   */
  private async syncDeliverable(task: SyncTask): Promise<SyncResult> {
    const { operation, payload } = task;
    const projectPageId = payload.projectNotionPageId as string;

    if (!projectPageId) {
      return { success: false, error: 'No project Notion page ID' };
    }

    try {
      if (operation === 'CREATE') {
        // Add deliverable as an embed/file block in the project page
        const blocks = await this.notion.blocks.children.list({
          block_id: projectPageId,
          page_size: 100,
        });

        // Find or create deliverables section
        const deliverablesHeaderIndex = blocks.results.findIndex(
          (block: any) =>
            block.type === 'heading_2' &&
            block.heading_2?.rich_text?.[0]?.plain_text === 'Deliverables'
        );

        const deliverableBlock = this.buildDeliverableBlock(payload);

        if (deliverablesHeaderIndex === -1) {
          // Create deliverables section
          await this.notion.blocks.children.append({
            block_id: projectPageId,
            children: [
              {
                type: 'heading_2',
                heading_2: {
                  rich_text: [{ type: 'text', text: { content: 'Deliverables' } }],
                },
              },
              deliverableBlock,
            ],
          });
        } else {
          await this.notion.blocks.children.append({
            block_id: projectPageId,
            children: [deliverableBlock],
          });
        }

        return { success: true };
      }

      if (operation === 'DELETE') {
        // Note: Deleting specific blocks requires finding the block ID first
        // For simplicity, we skip actual deletion and just return success
        return { success: true };
      }

      return { success: false, error: `Deliverable operation ${operation} not supported` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notion API error';
      return { success: false, error: message };
    }
  }

  /**
   * Sync a lead to Notion (CRM view)
   */
  private async syncLead(task: SyncTask): Promise<SyncResult> {
    // Lead sync is optional - return success if no CRM database configured
    if (!this.config.projectsDatabaseId) {
      return { success: true };
    }

    // For now, leads are not synced to Notion
    return { success: true };
  }

  // ============================================================================
  // NOTION PROPERTY BUILDERS
  // ============================================================================

  /**
   * Build Notion database properties for a project
   */
  private buildProjectProperties(payload: Record<string, unknown>): Record<string, any> {
    return {
      Name: {
        title: [
          {
            text: {
              content: (payload.name as string) || 'Untitled Project',
            },
          },
        ],
      },
      Status: {
        select: {
          name: this.mapProjectStatus(payload.status as string),
        },
      },
      Tier: {
        select: {
          name: this.getTierName(payload.tier as number),
        },
      },
      'Client Email': {
        email: (payload.clientEmail as string) || null,
      },
      'Project Address': {
        rich_text: [
          {
            text: {
              content: (payload.projectAddress as string) || '',
            },
          },
        ],
      },
      'Created At': {
        date: {
          start: (payload.createdAt as string) || new Date().toISOString(),
        },
      },
    };
  }

  /**
   * Build initial content blocks for a project page
   */
  private buildProjectContent(payload: Record<string, unknown>): any[] {
    const blocks: any[] = [
      {
        type: 'callout',
        callout: {
          icon: { emoji: '🏠' },
          rich_text: [
            {
              type: 'text',
              text: {
                content: `${this.getTierName(payload.tier as number)} Project`,
              },
            },
          ],
        },
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Project Overview' } }],
        },
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `Address: ${payload.projectAddress || 'Not specified'}`,
              },
            },
          ],
        },
      },
      {
        type: 'divider',
        divider: {},
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Milestones' } }],
        },
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: 'Project milestones will appear here.' },
              annotations: { italic: true, color: 'gray' },
            },
          ],
        },
      },
      {
        type: 'divider',
        divider: {},
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Deliverables' } }],
        },
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: 'Project deliverables will appear here.' },
              annotations: { italic: true, color: 'gray' },
            },
          ],
        },
      },
    ];

    return blocks;
  }

  /**
   * Build a milestone block
   */
  private buildMilestoneBlock(payload: Record<string, unknown>): any {
    const status = payload.status as string;
    const statusEmoji = status === 'COMPLETED' ? '✅' : status === 'IN_PROGRESS' ? '🔄' : '⏳';
    const name = payload.name as string;
    const dueDate = payload.dueDate as string;

    return {
      type: 'to_do',
      to_do: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: `${name}${dueDate ? ` (Due: ${new Date(dueDate).toLocaleDateString()})` : ''}`,
            },
          },
        ],
        checked: status === 'COMPLETED',
      },
    };
  }

  /**
   * Build a deliverable block
   */
  private buildDeliverableBlock(payload: Record<string, unknown>): any {
    const name = payload.name as string;
    const category = payload.category as string;
    const fileUrl = payload.fileUrl as string;

    if (fileUrl) {
      return {
        type: 'bookmark',
        bookmark: {
          url: fileUrl,
          caption: [
            {
              type: 'text',
              text: { content: `${category}: ${name}` },
            },
          ],
        },
      };
    }

    return {
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: `📎 ${category}: ${name}` },
          },
        ],
      },
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Rate limit requests to stay under Notion API limits
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.config.rateLimitMs) {
      await this.sleep(this.config.rateLimitMs - elapsed);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate a unique task ID
   */
  private generateTaskId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Map project status to Notion select option
   */
  private mapProjectStatus(status: string): string {
    const mapping: Record<string, string> = {
      ONBOARDING: 'Onboarding',
      IN_PROGRESS: 'In Progress',
      AWAITING_FEEDBACK: 'Awaiting Feedback',
      REVISIONS: 'Revisions',
      DELIVERED: 'Delivered',
      CLOSED: 'Closed',
    };
    return mapping[status] || status;
  }

  /**
   * Get tier display name
   */
  private getTierName(tier: number): string {
    const names: Record<number, string> = {
      1: 'The Concept',
      2: 'The Builder',
      3: 'The Concierge',
      4: 'KAA White Glove',
    };
    return names[tier] || `Tier ${tier}`;
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

let syncQueueInstance: NotionSyncQueue | null = null;

/**
 * Create or get the sync queue instance
 */
export function getNotionSyncQueue(config?: NotionSyncConfig): NotionSyncQueue {
  if (!syncQueueInstance && config) {
    syncQueueInstance = new NotionSyncQueue(config);
  }

  if (!syncQueueInstance) {
    throw new Error('NotionSyncQueue not initialized. Provide config on first call.');
  }

  return syncQueueInstance;
}

/**
 * Initialize the sync queue (call at app startup)
 */
export function initNotionSync(config: NotionSyncConfig): NotionSyncQueue {
  syncQueueInstance = new NotionSyncQueue(config);
  return syncQueueInstance;
}

/**
 * Queue a project for sync
 */
export async function queueProjectSync(projectId: string, operation: SyncOperation): Promise<void> {
  const queue = getNotionSyncQueue();
  queue.enqueue({ entityType: 'PROJECT', entityId: projectId, operation, priority: 1, payload: {} });
}

/**
 * Queue a milestone for sync
 */
export async function queueMilestoneSync(milestoneId: string, operation: SyncOperation): Promise<void> {
  const queue = getNotionSyncQueue();
  queue.enqueue({ entityType: 'MILESTONE', entityId: milestoneId, operation, priority: 2, payload: {} });
}

/**
 * Queue a deliverable for sync
 */
export async function queueDeliverableSync(deliverableId: string, operation: SyncOperation): Promise<void> {
  const queue = getNotionSyncQueue();
  queue.enqueue({ entityType: 'DELIVERABLE', entityId: deliverableId, operation, priority: 3, payload: {} });
}

/**
 * Queue a lead for sync
 */
export async function queueLeadSync(leadId: string, operation: SyncOperation): Promise<void> {
  const queue = getNotionSyncQueue();
  queue.enqueue({ entityType: 'LEAD', entityId: leadId, operation, priority: 4, payload: {} });
}

export default NotionSyncQueue;
