/**
 * Services Index
 * Central export point for all backend services.
 */

// Project Service - handles project creation with tier-specific milestones
export {
  ProjectService,
  createProjectService,
  // Types
  type CreateProjectInput,
  type CreateProjectResult,
  type ProjectWithDetails,
  type DatabaseAdapter,
  // Status enums
  ProjectStatus,
  MilestoneStatus,
  LeadStatus,
  ClientStatus,
  PaymentStatus,
} from './projectService';

// Prisma Database Adapter - Prisma implementation of DatabaseAdapter
export { PrismaDatabaseAdapter, createPrismaAdapter } from './prismaAdapter';

// Milestone Templates - tier-specific milestone definitions
export {
  type TierId,
  type MilestoneTemplate,
  type TierMilestoneConfig,
  getMilestoneTemplates,
  getTierConfig,
  getRequiredMilestones,
  generateMilestoneDueDates,
  getEstimatedCompletionDate,
  isValidTier,
  TIER_MILESTONE_CONFIGS,
} from './milestoneTemplates';

// Notion Sync Queue - rate-limited queue for Notion API operations
export {
  NotionSyncQueue,
  getNotionSyncQueue,
  initNotionSync,
  type SyncOperation,
  type SyncEntityType,
  type SyncStatus,
  type SyncTask,
  type SyncResult,
  type QueueStats,
  type NotionSyncConfig,
} from './notionSyncQueue';

// Notion Sync Service - high-level sync operations
export {
  NotionSyncService,
  initNotionSyncService,
  getNotionSyncService,
  type ProjectSyncData,
  type MilestoneSyncData,
  type DeliverableSyncData,
  type SyncOptions,
} from './notionSync';

// Storage Service - Supabase Storage for file uploads
export {
  StorageService,
  initStorageService,
  getStorageService,
  type StorageConfig,
  type UploadOptions,
  type UploadResult,
  type SignedUrlResult,
  type DeleteResult,
  type FileMetadata,
} from './storageService';

// Audit Service - Centralized audit logging
export {
  AuditService,
  initAuditService,
  getAuditService,
  type AuditAction,
  type ResourceType,
  type AuditLogEntry,
  type AuditLogRecord,
  type AuditQueryOptions,
} from './auditService';

// Auth Service - User authentication and JWT management
export {
  initAuthService,
  getAuthConfig,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  extractToken,
  registerUser,
  loginUser,
  getUserProfile,
  initiatePasswordReset,
  completePasswordReset,
  type AuthConfig,
  type TokenPayload,
  type AuthResult,
  type RegisterInput,
  type LoginInput,
  type UserProfile,
} from './authService';

// Client Service - Client creation from leads
export {
  ClientService,
  createClientService,
  initClientService,
  getClientService,
  type CreateClientFromLeadInput,
  type CreateClientResult,
  type ClientWithDetails,
} from './clientService';

// Email Service - Transactional emails
export {
  initEmailService,
  sendEmail,
  sendWelcomeEmail,
  sendPaymentConfirmation,
  sendMilestoneNotification,
  sendDeliverableNotification,
  EmailTemplates,
  type EmailConfig,
  type EmailOptions,
  type EmailResult,
} from './emailService';

// Health Service - Health monitoring and checks
export {
  performHealthCheck,
  livenessCheck,
  readinessCheck,
  type HealthStatus,
  type ComponentHealth,
  type HealthCheckResult,
} from './healthService';

// Slack Service - Team notifications
export {
  initSlackService,
  isSlackEnabled,
  sendSlackMessage,
  notifyNewLead,
  notifyPaymentReceived,
  notifyProjectStatusChange,
  notifyMilestoneCompleted,
  notifyDocumentUploaded,
  notifyAlert,
  type SlackConfig,
  type SlackMessage,
} from './slackService';

// Webhook Service - External event notifications
export {
  initWebhookService,
  generateSignature,
  verifySignature,
  registerWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhook,
  listWebhooks,
  triggerWebhook,
  triggerLeadCreated,
  triggerPaymentSucceeded,
  triggerProjectStatusChanged,
  triggerMilestoneCompleted,
  triggerDeliverableUploaded,
  type WebhookEventType,
  type WebhookEndpoint,
  type WebhookPayload,
  type WebhookConfig,
} from './webhookService';

// Calendar Service - Appointment scheduling
export {
  initCalendarService,
  setWorkingHours,
  getWorkingHours,
  getAvailableSlots,
  isSlotAvailable,
  createAppointment,
  getAppointment,
  updateAppointment,
  cancelAppointment,
  listAppointments,
  getUpcomingAppointments,
  generateICS,
  type CalendarConfig,
  type TimeSlot,
  type Appointment,
  type AppointmentAttendee,
  type AppointmentStatus,
  type AppointmentType,
  type CreateAppointmentInput,
  type AvailabilityQuery,
  type WorkingHours,
} from './calendarService';

// Cache Service - Redis/Memory caching
export {
  initCacheService,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheInvalidateTag,
  cacheClear,
  cacheStats,
  isCacheAvailable,
  withCache,
  CACHE_KEYS,
  CacheTags,
  type CacheConfig,
  type CacheOptions,
  type CacheStats,
} from './cacheService';

// Real-time Service - WebSocket notifications
export {
  initRealtimeService,
  shutdownRealtimeService,
  notifyUser,
  notifyProject,
  notifyTeam,
  broadcast,
  buildMilestoneNotification,
  buildDeliverableNotification,
  buildProjectStatusNotification,
  buildPaymentNotification,
  buildMessageNotification,
  buildSystemAlertNotification,
  getRealtimeStats,
  isUserConnected,
  type NotificationType,
  type Notification,
  type WebSocketMessage,
  type ClientConnection,
  type RealtimeConfig,
  type RealtimeStats,
} from './realtimeService';

// Messaging Service - Message threads and conversations
export {
  initMessagingService,
  createThread,
  getThread,
  getThreadsForUser,
  updateThreadStatus,
  archiveThread,
  addParticipant,
  removeParticipant,
  sendMessage,
  getMessages,
  markMessagesAsRead,
  deleteMessage,
  getMessagingStats,
  getUnreadCount,
  clearAllMessages,
  type MessageStatus,
  type ThreadStatus,
  type ParticipantRole,
  type MessageAttachment,
  type Message,
  type ThreadParticipant,
  type MessageThread,
  type CreateThreadInput,
  type SendMessageInput,
  type MessagingConfig,
  type MessagingStats,
} from './messagingService';

// Referral Service - Referral codes, tracking, and rewards
export {
  initReferralService,
  createReferralCode,
  getReferralCode,
  getUserReferralCode,
  validateReferralCode,
  deactivateReferralCode,
  applyReferral,
  convertReferral,
  getReferral,
  getReferralByEmail,
  getReferralsByReferrer,
  getRewardsByUser,
  approveReward,
  markRewardPaid,
  cancelReward,
  getReferralStats,
  getUserReferralStats,
  clearAllReferrals,
  type ReferralStatus,
  type RewardType,
  type RewardStatus,
  type ReferralCode,
  type Referral,
  type ReferralReward,
  type ReferralConfig,
  type CreateReferralCodeInput,
  type ApplyReferralInput,
  type ConvertReferralInput,
  type ReferralStats,
} from './referralService';
