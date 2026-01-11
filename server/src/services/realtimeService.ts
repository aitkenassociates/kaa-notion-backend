/**
 * Real-time Notification Service
 * WebSocket-based notifications for clients and team members.
 */

import { WebSocket, WebSocketServer } from 'ws';
import { FigmaClient } from '../figma-client';
import { logger } from '../logger';
import { verifyToken, TokenPayload } from './authService';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType =
  | 'milestone_completed'
  | 'deliverable_uploaded'
  | 'deliverable_ready'
  | 'project_status_changed'
  | 'payment_received'
  | 'message_received'
  | 'appointment_reminder'
  | 'document_shared'
  | 'system_alert';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface WebSocketMessage {
  type:
    | 'notification'
    | 'connection'
    | 'ping'
    | 'pong'
    | 'subscribe'
    | 'unsubscribe'
    | 'getFile'
    | 'getFileNodes'
    | 'fileData'
    | 'nodesData'
    | 'error';
  payload?: unknown;
  data?: unknown;
  message?: string;
  fileKey?: string;
  nodeIds?: string[];
}

export interface ClientConnection {
  userId: string;
  userType: 'client' | 'team' | 'admin';
  projectIds: string[];
  socket: WebSocket;
  connectedAt: Date;
  lastPing: Date;
}

export interface RealtimeConfig {
  pingInterval: number; // ms
  connectionTimeout: number; // ms
  maxConnectionsPerUser: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: RealtimeConfig = {
  pingInterval: 30000, // 30 seconds
  connectionTimeout: 120000, // 2 minutes
  maxConnectionsPerUser: 5,
};

let config: RealtimeConfig = { ...DEFAULT_CONFIG };

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

// Map of userId -> array of connections (supports multiple tabs/devices)
const connections = new Map<string, ClientConnection[]>();

// Map of projectId -> array of userIds subscribed to that project
const projectSubscriptions = new Map<string, Set<string>>();

let wss: WebSocketServer | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let figmaClient: FigmaClient | null = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the real-time service with an existing WebSocket server
 */
export function initRealtimeService(
  webSocketServer: WebSocketServer,
  overrides: Partial<RealtimeConfig> = {},
  figmaClientInstance?: FigmaClient
): void {
  config = { ...config, ...overrides };
  wss = webSocketServer;
  figmaClient = figmaClientInstance ?? null;

  // Set up connection handler
  wss.on('connection', handleConnection);

  // Start ping interval to keep connections alive
  pingInterval = setInterval(pingAllConnections, config.pingInterval);

  logger.info('Real-time service initialized', {
    pingInterval: config.pingInterval,
    connectionTimeout: config.connectionTimeout,
  });
}

/**
 * Shutdown the real-time service
 */
export function shutdownRealtimeService(): void {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }

  // Close all connections
  connections.forEach((userConnections) => {
    userConnections.forEach((conn) => {
      conn.socket.close(1001, 'Server shutting down');
    });
  });

  connections.clear();
  projectSubscriptions.clear();
  wss = null;

  logger.info('Real-time service shutdown complete');
}

// ============================================================================
// CONNECTION HANDLING
// ============================================================================

/**
 * Handle new WebSocket connection
 */
function handleConnection(socket: WebSocket, request: { url?: string }): void {
  // Parse authentication from query string (in production, use proper auth)
  const url = new URL(request.url || '', 'ws://localhost');
  const userId = url.searchParams.get('userId');
  const userType = url.searchParams.get('userType') as 'client' | 'team' | 'admin' | null;
  const token = url.searchParams.get('token');

  if (!userId || !userType) {
    logger.warn('WebSocket connection rejected - missing credentials');
    socket.close(4001, 'Authentication required');
    return;
  }

  // Verify the JWT token
  if (!token) {
    logger.warn('WebSocket connection rejected - missing token', { userId });
    socket.close(4001, 'Invalid token');
    return;
  }

  let tokenPayload: TokenPayload;
  try {
    tokenPayload = verifyToken(token, 'access');
  } catch (error) {
    logger.warn('WebSocket connection rejected - invalid token', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    socket.close(4001, 'Invalid or expired token');
    return;
  }

  // Verify that the token belongs to the claimed user
  if (tokenPayload.userId !== userId) {
    logger.warn('WebSocket connection rejected - token/userId mismatch', {
      claimedUserId: userId,
      tokenUserId: tokenPayload.userId
    });
    socket.close(4003, 'Token does not match user');
    return;
  }

  // Verify that the userType matches the token
  const tokenUserType = tokenPayload.userType.toLowerCase();
  const claimedUserType = userType.toLowerCase();
  // Map SAGE_CLIENT/KAA_CLIENT to 'client' for comparison
  const normalizedTokenType = tokenUserType.includes('client') ? 'client' :
                               tokenUserType === 'admin' ? 'admin' :
                               tokenUserType === 'team' ? 'team' : tokenUserType;

  if (normalizedTokenType !== claimedUserType && claimedUserType !== 'admin') {
    logger.warn('WebSocket connection rejected - userType mismatch', {
      claimedUserType: userType,
      tokenUserType: tokenPayload.userType
    });
    socket.close(4003, 'User type does not match token');
    return;
  }

  // Check connection limit per user
  const existingConnections = connections.get(userId) || [];
  if (existingConnections.length >= config.maxConnectionsPerUser) {
    // Close oldest connection
    const oldest = existingConnections.shift();
    if (oldest) {
      oldest.socket.close(4002, 'Too many connections');
    }
  }

  // Create connection object
  const connection: ClientConnection = {
    userId,
    userType,
    projectIds: [],
    socket,
    connectedAt: new Date(),
    lastPing: new Date(),
  };

  // Store connection
  const userConnections = connections.get(userId) || [];
  userConnections.push(connection);
  connections.set(userId, userConnections);

  logger.info('WebSocket client connected', { userId, userType });

  // Send connection confirmation
  sendToSocket(socket, {
    type: 'connection',
    payload: {
      status: 'connected',
      userId,
      serverTime: new Date().toISOString(),
    },
  });

  // Set up message handler
  socket.on('message', (data) => {
    void handleMessage(connection, data);
  });

  // Set up close handler
  socket.on('close', () => handleDisconnect(connection));

  // Set up error handler
  socket.on('error', (error) => {
    logger.error('WebSocket error', { userId, error: error.message });
  });

  // Handle pong responses
  socket.on('pong', () => {
    connection.lastPing = new Date();
  });
}

/**
 * Handle incoming WebSocket message
 */
async function handleMessage(
  connection: ClientConnection,
  data: Buffer | ArrayBuffer | Buffer[]
): Promise<void> {
  try {
    const message = JSON.parse(data.toString()) as WebSocketMessage;

    switch (message.type) {
      case 'ping':
        connection.lastPing = new Date();
        sendToSocket(connection.socket, { type: 'pong' });
        break;

      case 'subscribe':
        handleSubscribe(connection, message.payload as { projectIds?: string[] });
        break;

      case 'unsubscribe':
        handleUnsubscribe(connection, message.payload as { projectIds?: string[] });
        break;

      case 'getFile':
        await handleFigmaGetFile(connection, message);
        break;

      case 'getFileNodes':
        await handleFigmaGetFileNodes(connection, message);
        break;

      default:
        logger.debug('Unknown message type', { type: message.type, userId: connection.userId });
    }
  } catch (error) {
    logger.warn('Invalid WebSocket message', { userId: connection.userId, error });
  }
}

/**
 * Handle subscription to project updates
 */
function handleSubscribe(connection: ClientConnection, payload: { projectIds?: string[] }): void {
  const projectIds = payload?.projectIds || [];

  for (const projectId of projectIds) {
    // Add to connection's subscriptions
    if (!connection.projectIds.includes(projectId)) {
      connection.projectIds.push(projectId);
    }

    // Add to project subscription map
    const subscribers = projectSubscriptions.get(projectId) || new Set();
    subscribers.add(connection.userId);
    projectSubscriptions.set(projectId, subscribers);
  }

  logger.debug('User subscribed to projects', {
    userId: connection.userId,
    projectIds,
  });
}

/**
 * Handle unsubscription from project updates
 */
function handleUnsubscribe(connection: ClientConnection, payload: { projectIds?: string[] }): void {
  const projectIds = payload?.projectIds || [];

  for (const projectId of projectIds) {
    // Remove from connection's subscriptions
    connection.projectIds = connection.projectIds.filter((id) => id !== projectId);

    // Remove from project subscription map
    const subscribers = projectSubscriptions.get(projectId);
    if (subscribers) {
      subscribers.delete(connection.userId);
      if (subscribers.size === 0) {
        projectSubscriptions.delete(projectId);
      }
    }
  }

  logger.debug('User unsubscribed from projects', {
    userId: connection.userId,
    projectIds,
  });
}

/**
 * Handle Figma file request
 */
async function handleFigmaGetFile(connection: ClientConnection, message: WebSocketMessage): Promise<void> {
  if (!figmaClient) {
    sendToSocket(connection.socket, {
      type: 'error',
      message: 'Figma WebSocket support is not configured.',
    });
    return;
  }

  const { fileKey } = getFigmaRequestPayload(message);
  if (!fileKey) {
    sendToSocket(connection.socket, {
      type: 'error',
      message: 'Missing fileKey for getFile request.',
    });
    return;
  }

  try {
    const fileData = await figmaClient.getFile(fileKey);
    sendToSocket(connection.socket, {
      type: 'fileData',
      data: fileData,
      payload: fileData,
    });
  } catch (error) {
    logger.error('Error handling Figma getFile request', {
      userId: connection.userId,
      error: error instanceof Error ? error.message : error,
    });
    sendToSocket(connection.socket, {
      type: 'error',
      message: 'Error processing getFile request.',
    });
  }
}

/**
 * Handle Figma file nodes request
 */
async function handleFigmaGetFileNodes(
  connection: ClientConnection,
  message: WebSocketMessage
): Promise<void> {
  if (!figmaClient) {
    sendToSocket(connection.socket, {
      type: 'error',
      message: 'Figma WebSocket support is not configured.',
    });
    return;
  }

  const { fileKey, nodeIds } = getFigmaRequestPayload(message);
  if (!fileKey) {
    sendToSocket(connection.socket, {
      type: 'error',
      message: 'Missing fileKey for getFileNodes request.',
    });
    return;
  }

  if (!nodeIds || nodeIds.length === 0) {
    sendToSocket(connection.socket, {
      type: 'error',
      message: 'Missing nodeIds for getFileNodes request.',
    });
    return;
  }

  try {
    const nodesData = await figmaClient.getFileNodes(fileKey, nodeIds);
    sendToSocket(connection.socket, {
      type: 'nodesData',
      data: nodesData,
      payload: nodesData,
    });
  } catch (error) {
    logger.error('Error handling Figma getFileNodes request', {
      userId: connection.userId,
      error: error instanceof Error ? error.message : error,
    });
    sendToSocket(connection.socket, {
      type: 'error',
      message: 'Error processing getFileNodes request.',
    });
  }
}

function getFigmaRequestPayload(message: WebSocketMessage): { fileKey?: string; nodeIds?: string[] } {
  const payload = (message.payload ?? {}) as { fileKey?: string; nodeIds?: unknown };
  const fileKey = payload.fileKey ?? message.fileKey;
  const rawNodeIds = payload.nodeIds ?? message.nodeIds;

  if (typeof rawNodeIds === 'string') {
    return { fileKey, nodeIds: rawNodeIds.split(',') };
  }

  if (Array.isArray(rawNodeIds)) {
    return {
      fileKey,
      nodeIds: rawNodeIds.filter((nodeId): nodeId is string => typeof nodeId === 'string'),
    };
  }

  return { fileKey };
}

/**
 * Handle client disconnect
 */
function handleDisconnect(connection: ClientConnection): void {
  const userConnections = connections.get(connection.userId) || [];
  const index = userConnections.indexOf(connection);

  if (index !== -1) {
    userConnections.splice(index, 1);
    if (userConnections.length === 0) {
      connections.delete(connection.userId);

      // Clean up project subscriptions
      for (const projectId of connection.projectIds) {
        const subscribers = projectSubscriptions.get(projectId);
        if (subscribers) {
          subscribers.delete(connection.userId);
          if (subscribers.size === 0) {
            projectSubscriptions.delete(projectId);
          }
        }
      }
    } else {
      connections.set(connection.userId, userConnections);
    }
  }

  logger.info('WebSocket client disconnected', { userId: connection.userId });
}

// ============================================================================
// NOTIFICATION SENDING
// ============================================================================

/**
 * Send notification to a specific user
 */
export function notifyUser(userId: string, notification: Notification): boolean {
  const userConnections = connections.get(userId);

  if (!userConnections || userConnections.length === 0) {
    logger.debug('User not connected', { userId, notificationType: notification.type });
    return false;
  }

  const message: WebSocketMessage = {
    type: 'notification',
    payload: notification,
  };

  let sent = false;
  for (const conn of userConnections) {
    if (conn.socket.readyState === WebSocket.OPEN) {
      sendToSocket(conn.socket, message);
      sent = true;
    }
  }

  if (sent) {
    logger.debug('Notification sent to user', { userId, type: notification.type });
  }

  return sent;
}

/**
 * Send notification to all subscribers of a project
 */
export function notifyProject(projectId: string, notification: Notification): number {
  const subscribers = projectSubscriptions.get(projectId);

  if (!subscribers || subscribers.size === 0) {
    logger.debug('No subscribers for project', { projectId, notificationType: notification.type });
    return 0;
  }

  let count = 0;
  for (const userId of subscribers) {
    if (notifyUser(userId, notification)) {
      count++;
    }
  }

  logger.debug('Notification sent to project subscribers', {
    projectId,
    type: notification.type,
    recipientCount: count,
  });

  return count;
}

/**
 * Send notification to all team members
 */
export function notifyTeam(notification: Notification): number {
  let count = 0;

  connections.forEach((userConnections, userId) => {
    const isTeam = userConnections.some((conn) => conn.userType === 'team' || conn.userType === 'admin');
    if (isTeam) {
      if (notifyUser(userId, notification)) {
        count++;
      }
    }
  });

  logger.debug('Notification sent to team', {
    type: notification.type,
    recipientCount: count,
  });

  return count;
}

/**
 * Broadcast notification to all connected clients
 */
export function broadcast(notification: Notification): number {
  let count = 0;

  connections.forEach((_userConnections, userId) => {
    if (notifyUser(userId, notification)) {
      count++;
    }
  });

  logger.debug('Notification broadcast', {
    type: notification.type,
    recipientCount: count,
  });

  return count;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Send message to a socket
 */
function sendToSocket(socket: WebSocket, message: WebSocketMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

/**
 * Ping all connections to keep them alive
 */
function pingAllConnections(): void {
  const now = new Date();
  const timeout = config.connectionTimeout;

  connections.forEach((userConnections, userId) => {
    userConnections.forEach((conn, index) => {
      // Check if connection has timed out
      if (now.getTime() - conn.lastPing.getTime() > timeout) {
        logger.debug('Connection timed out', { userId });
        conn.socket.terminate();
        userConnections.splice(index, 1);
        return;
      }

      // Send ping
      if (conn.socket.readyState === WebSocket.OPEN) {
        conn.socket.ping();
      }
    });

    if (userConnections.length === 0) {
      connections.delete(userId);
    }
  });
}

// ============================================================================
// NOTIFICATION BUILDERS
// ============================================================================

let notificationIdCounter = 0;

/**
 * Create a notification ID
 */
function generateNotificationId(): string {
  return `notif_${Date.now()}_${++notificationIdCounter}`;
}

/**
 * Build a milestone completed notification
 */
export function buildMilestoneNotification(
  milestoneTitle: string,
  projectName: string,
  data?: Record<string, unknown>
): Notification {
  return {
    id: generateNotificationId(),
    type: 'milestone_completed',
    title: 'Milestone Completed! 🎉',
    message: `${milestoneTitle} has been completed for ${projectName}`,
    data,
    timestamp: new Date().toISOString(),
    read: false,
    priority: 'normal',
  };
}

/**
 * Build a deliverable uploaded notification
 */
export function buildDeliverableNotification(
  deliverableName: string,
  projectName: string,
  data?: Record<string, unknown>
): Notification {
  return {
    id: generateNotificationId(),
    type: 'deliverable_uploaded',
    title: 'New Deliverable Available! 📦',
    message: `${deliverableName} is now available for ${projectName}`,
    data,
    timestamp: new Date().toISOString(),
    read: false,
    priority: 'high',
  };
}

/**
 * Build a project status change notification
 */
export function buildProjectStatusNotification(
  projectName: string,
  oldStatus: string,
  newStatus: string,
  data?: Record<string, unknown>
): Notification {
  return {
    id: generateNotificationId(),
    type: 'project_status_changed',
    title: 'Project Status Updated',
    message: `${projectName} status changed from ${oldStatus} to ${newStatus}`,
    data,
    timestamp: new Date().toISOString(),
    read: false,
    priority: 'normal',
  };
}

/**
 * Build a payment received notification
 */
export function buildPaymentNotification(
  amount: number,
  projectName: string,
  data?: Record<string, unknown>
): Notification {
  return {
    id: generateNotificationId(),
    type: 'payment_received',
    title: 'Payment Received! 💰',
    message: `Payment of $${amount.toLocaleString()} received for ${projectName}`,
    data,
    timestamp: new Date().toISOString(),
    read: false,
    priority: 'high',
  };
}

/**
 * Build a message notification
 */
export function buildMessageNotification(
  senderName: string,
  preview: string,
  data?: Record<string, unknown>
): Notification {
  return {
    id: generateNotificationId(),
    type: 'message_received',
    title: `New Message from ${senderName}`,
    message: preview.length > 100 ? preview.substring(0, 100) + '...' : preview,
    data,
    timestamp: new Date().toISOString(),
    read: false,
    priority: 'normal',
  };
}

/**
 * Build a system alert notification
 */
export function buildSystemAlertNotification(
  title: string,
  message: string,
  priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
  data?: Record<string, unknown>
): Notification {
  return {
    id: generateNotificationId(),
    type: 'system_alert',
    title,
    message,
    data,
    timestamp: new Date().toISOString(),
    read: false,
    priority,
  };
}

// ============================================================================
// STATISTICS
// ============================================================================

export interface RealtimeStats {
  totalConnections: number;
  uniqueUsers: number;
  connectionsByType: {
    client: number;
    team: number;
    admin: number;
  };
  projectSubscriptions: number;
}

/**
 * Get real-time service statistics
 */
export function getRealtimeStats(): RealtimeStats {
  let totalConnections = 0;
  const connectionsByType = { client: 0, team: 0, admin: 0 };

  connections.forEach((userConnections) => {
    totalConnections += userConnections.length;
    userConnections.forEach((conn) => {
      connectionsByType[conn.userType]++;
    });
  });

  return {
    totalConnections,
    uniqueUsers: connections.size,
    connectionsByType,
    projectSubscriptions: projectSubscriptions.size,
  };
}

/**
 * Check if a user is currently connected
 */
export function isUserConnected(userId: string): boolean {
  const userConnections = connections.get(userId);
  return userConnections !== undefined && userConnections.length > 0;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
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
};
