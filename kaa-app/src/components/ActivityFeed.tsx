import React, { useState, useEffect, useCallback } from 'react';
import './ActivityFeed.css';

interface Activity {
  id: string;
  type: string;
  message: string;
  user: string;
  userType: string;
  timestamp: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

interface ActivityFeedProps {
  projectId?: string;
  userId?: string;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  showFilters?: boolean;
  compact?: boolean;
  onActivityClick?: (activity: Activity) => void;
}

type FilterType = 'all' | 'milestone' | 'deliverable' | 'payment' | 'project';

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  projectId,
  userId,
  limit = 20,
  autoRefresh = false,
  refreshInterval = 30000,
  showFilters = true,
  compact = false,
  onActivityClick
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const fetchActivities = useCallback(async () => {
    try {
      let endpoint = `${API_URL}/api/activity/feed?limit=${limit}`;

      if (projectId) {
        endpoint = `${API_URL}/api/activity/project/${projectId}?limit=${limit}`;
      } else if (userId) {
        endpoint = `${API_URL}/api/activity/user/${userId}?limit=${limit}`;
      }

      if (filter !== 'all') {
        endpoint += `&types=${getFilterTypes(filter)}`;
      }

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }

      const data = await response.json();
      setActivities(data.feed || data.activities || []);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Unable to load activity feed');
    } finally {
      setLoading(false);
    }
  }, [API_URL, projectId, userId, limit, filter]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchActivities, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchActivities]);

  const getFilterTypes = (filter: FilterType): string => {
    const typeMapping: Record<FilterType, string> = {
      all: '',
      milestone: 'milestone_created,milestone_completed,milestone_started,milestone_updated',
      deliverable: 'image_uploaded,image_deleted,deliverable_uploaded',
      payment: 'payment_initiated,payment_completed,payment_failed',
      project: 'project_created,project_updated'
    };
    return typeMapping[filter] || '';
  };

  const getActivityIcon = (type: string): string => {
    const iconMapping: Record<string, string> = {
      // Milestone
      milestone_created: '📍',
      milestone_completed: '✅',
      milestone_started: '🚀',
      milestone_updated: '📝',

      // Deliverable
      image_uploaded: '🖼️',
      image_deleted: '🗑️',
      deliverable_uploaded: '📤',

      // Payment
      payment_initiated: '💳',
      payment_completed: '💰',
      payment_failed: '❌',
      payment_refunded: '↩️',

      // Project
      project_created: '🎉',
      project_updated: '📋',
      project_synced_to_notion: '🔄',

      // User
      login: '🔐',
      logout: '👋',

      // Default
      default: '📌'
    };

    return iconMapping[type] || iconMapping.default;
  };

  const getActivityColor = (type: string): string => {
    if (type.includes('completed') || type.includes('success')) return 'success';
    if (type.includes('failed') || type.includes('deleted')) return 'error';
    if (type.includes('started') || type.includes('initiated')) return 'warning';
    if (type.includes('created') || type.includes('uploaded')) return 'primary';
    return 'default';
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }

    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }

    // Format as date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getUserAvatar = (user: string, userType: string): string => {
    if (userType === 'SYSTEM') return '🤖';
    if (userType === 'TEAM' || userType === 'ADMIN') return '👤';
    return '😊';
  };

  if (loading) {
    return (
      <div className="activity-feed-container">
        <div className="activity-loading">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>Loading activity...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="activity-feed-container">
        <div className="activity-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={fetchActivities} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`activity-feed-container ${compact ? 'compact' : ''}`}>
      {/* Header */}
      <div className="activity-header">
        <div className="activity-title">
          <h3>📊 Activity Feed</h3>
          {autoRefresh && (
            <span className="auto-refresh-indicator">
              🔄 Auto-refresh
            </span>
          )}
        </div>

        {showFilters && (
          <div className="activity-filters">
            {(['all', 'milestone', 'deliverable', 'payment', 'project'] as FilterType[]).map(
              (filterOption) => (
                <button
                  key={filterOption}
                  className={`filter-button ${filter === filterOption ? 'active' : ''}`}
                  onClick={() => setFilter(filterOption)}
                >
                  {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Activity List */}
      <div className="activity-list">
        {activities.map((activity, index) => (
          <div
            key={activity.id}
            className={`activity-item color-${getActivityColor(activity.type)}`}
            onClick={() => onActivityClick?.(activity)}
            role={onActivityClick ? 'button' : undefined}
            tabIndex={onActivityClick ? 0 : undefined}
          >
            {/* Timeline Indicator */}
            <div className="activity-timeline">
              <span className="activity-icon">
                {getActivityIcon(activity.type)}
              </span>
              {index < activities.length - 1 && <div className="timeline-line" />}
            </div>

            {/* Content */}
            <div className="activity-content">
              <div className="activity-message">
                <span className="user-avatar">
                  {getUserAvatar(activity.user, activity.userType)}
                </span>
                <span className="message-text">{activity.message}</span>
              </div>

              <div className="activity-meta">
                <span className="activity-user">{activity.user}</span>
                <span className="activity-time">
                  {formatTimestamp(activity.timestamp)}
                </span>
              </div>

              {/* Details (non-compact only) */}
              {!compact && activity.details && Object.keys(activity.details).length > 0 && (
                <div className="activity-details">
                  {Object.entries(activity.details)
                    .filter(([key]) => !['projectId', 'userId'].includes(key))
                    .slice(0, 3)
                    .map(([key, value]) => (
                      <span key={key} className="detail-tag">
                        {key}: {String(value)}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {activities.length === 0 && (
        <div className="activity-empty">
          <span className="empty-icon">📭</span>
          <p>No activity yet</p>
          <span className="empty-hint">
            Activity will appear here as your project progresses
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="activity-footer">
        <span className="last-updated">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </span>
        <button
          className="refresh-button"
          onClick={fetchActivities}
          title="Refresh activity feed"
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};

export default ActivityFeed;
