// Temporary Prisma type stubs until prisma generate can be run
// Remove this file after running: npx prisma generate

declare module '@prisma/client' {
  export class PrismaClient {
    constructor(options?: any);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $queryRaw<T = any>(query: TemplateStringsArray | string, ...values: any[]): Promise<T>;
    $executeRaw(query: TemplateStringsArray | string, ...values: any[]): Promise<number>;
    $transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T>;
    $transaction<T>(promises: Promise<T>[]): Promise<T[]>;
    $transaction<T>(arg: ((prisma: PrismaClient) => Promise<T>) | Promise<T>[], options?: any): Promise<T | T[]>;

    // Models
    user: any;
    client: any;
    lead: any;
    project: any;
    milestone: any;
    deliverable: any;
    payment: any;
    tier: any;
    teamMember: any;
    projectAssignment: any;
    notification: any;
    message: any;
    revisionRequest: any;
    subscription: any;
    referral: any;
    referralCredit: any;
    auditLog: any;
    syncJob: any;
    processedStripeEvent: any;
    pushSubscription: any;
    designIdea: any;
    portfolioProject: any;
    portfolioImage: any;
    portfolioTag: any;
  }

  export namespace Prisma {
    export type PrismaPromise<T> = Promise<T>;
    export type TransactionClient = PrismaClient;
    export type InputJsonValue = string | number | boolean | null | { [key: string]: InputJsonValue } | InputJsonValue[];
    export type PrismaClientOptions = any;

    // TransactionIsolationLevel as both const and type
    export const TransactionIsolationLevel: {
      ReadUncommitted: 'ReadUncommitted';
      ReadCommitted: 'ReadCommitted';
      RepeatableRead: 'RepeatableRead';
      Serializable: 'Serializable';
    };
    export type TransactionIsolationLevel = 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';

    // Select types for query optimization
    export type UserSelect = Record<string, boolean | any>;
    export type ProjectSelect = Record<string, boolean | any>;
    export type ClientSelect = Record<string, boolean | any>;
    export type LeadSelect = Record<string, boolean | any>;
    export type MilestoneSelect = Record<string, boolean | any>;
    export type DeliverableSelect = Record<string, boolean | any>;
    export type NotificationSelect = Record<string, boolean | any>;
    export type MessageSelect = Record<string, boolean | any>;

    // Include types for relations
    export type ProjectInclude = Record<string, boolean | any>;
    export type ClientInclude = Record<string, boolean | any>;
    export type LeadInclude = Record<string, boolean | any>;

    // Query types
    export type UserWhereInput = any;
    export type UserWhereUniqueInput = any;
    export type UserCreateInput = any;
    export type UserUpdateInput = any;

    export type ClientWhereInput = any;
    export type ClientWhereUniqueInput = any;
    export type ClientCreateInput = any;
    export type ClientUpdateInput = any;

    export type LeadWhereInput = any;
    export type LeadWhereUniqueInput = any;
    export type LeadCreateInput = any;
    export type LeadUpdateInput = any;

    export type ProjectWhereInput = any;
    export type ProjectWhereUniqueInput = any;
    export type ProjectCreateInput = any;
    export type ProjectUpdateInput = any;

    export type MilestoneWhereInput = any;
    export type MilestoneWhereUniqueInput = any;
    export type MilestoneCreateInput = any;
    export type MilestoneUpdateInput = any;

    export type DeliverableWhereInput = any;
    export type DeliverableWhereUniqueInput = any;
    export type DeliverableCreateInput = any;
    export type DeliverableUpdateInput = any;

    export type PaymentWhereInput = any;
    export type PaymentWhereUniqueInput = any;
    export type PaymentCreateInput = any;
    export type PaymentUpdateInput = any;

    // Error types
    export class PrismaClientKnownRequestError extends Error {
      code: string;
      meta?: any;
    }
    export class PrismaClientUnknownRequestError extends Error {}
    export class PrismaClientValidationError extends Error {}
    export class PrismaClientInitializationError extends Error {}
  }

  // Use string literal union types instead of enums for better compatibility
  export type UserType = 'KAA_CLIENT' | 'SAGE_CLIENT' | 'TEAM' | 'ADMIN';
  export const UserType: {
    KAA_CLIENT: 'KAA_CLIENT';
    SAGE_CLIENT: 'SAGE_CLIENT';
    TEAM: 'TEAM';
    ADMIN: 'ADMIN';
  };

  export type LeadStatus = 'NEW' | 'QUALIFIED' | 'NEEDS_REVIEW' | 'CONVERTED' | 'CLOSED';
  export const LeadStatus: {
    NEW: 'NEW';
    QUALIFIED: 'QUALIFIED';
    NEEDS_REVIEW: 'NEEDS_REVIEW';
    CONVERTED: 'CONVERTED';
    CLOSED: 'CLOSED';
  };

  export type ProjectStatus = 'INTAKE' | 'ONBOARDING' | 'IN_PROGRESS' | 'AWAITING_FEEDBACK' | 'REVISIONS' | 'DELIVERED' | 'CLOSED';
  export const ProjectStatus: {
    INTAKE: 'INTAKE';
    ONBOARDING: 'ONBOARDING';
    IN_PROGRESS: 'IN_PROGRESS';
    AWAITING_FEEDBACK: 'AWAITING_FEEDBACK';
    REVISIONS: 'REVISIONS';
    DELIVERED: 'DELIVERED';
    CLOSED: 'CLOSED';
  };

  export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  export const MilestoneStatus: {
    PENDING: 'PENDING';
    IN_PROGRESS: 'IN_PROGRESS';
    COMPLETED: 'COMPLETED';
  };

  export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  export const PaymentStatus: {
    PENDING: 'PENDING';
    SUCCEEDED: 'SUCCEEDED';
    FAILED: 'FAILED';
    REFUNDED: 'REFUNDED';
  };

  export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';
  export const SyncStatus: {
    PENDING: 'PENDING';
    SYNCED: 'SYNCED';
    FAILED: 'FAILED';
  };

  export type NotificationType = 'PROJECT_UPDATE' | 'MILESTONE_COMPLETED' | 'DELIVERABLE_READY' | 'MESSAGE_RECEIVED' | 'PAYMENT_RECEIVED' | 'REVISION_REQUESTED' | 'SYSTEM';
  export const NotificationType: {
    PROJECT_UPDATE: 'PROJECT_UPDATE';
    MILESTONE_COMPLETED: 'MILESTONE_COMPLETED';
    DELIVERABLE_READY: 'DELIVERABLE_READY';
    MESSAGE_RECEIVED: 'MESSAGE_RECEIVED';
    PAYMENT_RECEIVED: 'PAYMENT_RECEIVED';
    REVISION_REQUESTED: 'REVISION_REQUESTED';
    SYSTEM: 'SYSTEM';
  };

  export type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'TRIALING' | 'PAUSED' | 'PENDING' | 'TRIAL';
  export const SubscriptionStatus: {
    ACTIVE: 'ACTIVE';
    CANCELED: 'CANCELED';
    PAST_DUE: 'PAST_DUE';
    TRIALING: 'TRIALING';
    PAUSED: 'PAUSED';
    PENDING: 'PENDING';
    TRIAL: 'TRIAL';
  };

  export type TeamRole = 'OWNER' | 'ADMIN' | 'DESIGNER' | 'VIEWER';
  export const TeamRole: {
    OWNER: 'OWNER';
    ADMIN: 'ADMIN';
    DESIGNER: 'DESIGNER';
    VIEWER: 'VIEWER';
  };

  export type ReferralStatus = 'PENDING' | 'CLICKED' | 'SIGNED_UP' | 'CONVERTED' | 'REWARDED';
  export const ReferralStatus: {
    PENDING: 'PENDING';
    CLICKED: 'CLICKED';
    SIGNED_UP: 'SIGNED_UP';
    CONVERTED: 'CONVERTED';
    REWARDED: 'REWARDED';
  };

  // Model types
  export type User = {
    id: string;
    email: string;
    passwordHash: string | null;
    name: string | null;
    type: UserType;
    userType: UserType; // Alias for type
    tier?: number;
    role?: string;
    createdAt: Date;
    updatedAt: Date;
  };

  export type Client = {
    id: string;
    userId: string;
    tierId: number;
    stripeCustomerId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };

  export type Lead = {
    id: string;
    email: string;
    name: string | null;
    status: LeadStatus;
    recommendedTier: number | null;
    tierOverride: number | null;
    createdAt: Date;
    updatedAt: Date;
  };

  export type Project = {
    id: string;
    clientId: string;
    name: string;
    status: ProjectStatus;
    tierId: number;
    createdAt: Date;
    updatedAt: Date;
  };

  export type Milestone = {
    id: string;
    projectId: string;
    name: string;
    status: MilestoneStatus;
    order: number;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  export type Deliverable = {
    id: string;
    projectId: string;
    name: string;
    fileUrl: string | null;
    category: string | null;
    createdAt: Date;
    updatedAt: Date;
  };

  export type Payment = {
    id: string;
    clientId: string;
    projectId: string | null;
    amount: number;
    status: PaymentStatus;
    stripePaymentIntentId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };

  export type Tier = {
    id: number;
    name: string;
    price: number;
    description: string | null;
    features: string[];
  };

  export type TeamMember = {
    id: string;
    userId: string;
    role: TeamRole;
    name?: string;
    createdAt: Date;
    updatedAt: Date;
  };

  export type PortfolioProject = {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    location: string | null;
    featured: boolean;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  export type PortfolioImage = {
    id: string;
    portfolioProjectId: string;
    url: string;
    alt: string | null;
    order: number;
    createdAt: Date;
    updatedAt: Date;
  };

  export type Subscription = {
    id: string;
    userId: string;
    stripeSubscriptionId: string | null;
    status: SubscriptionStatus;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
}
