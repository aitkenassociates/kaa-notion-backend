import React, { useState, useEffect } from 'react';
import './ProjectTimeline.css';

interface Milestone {
  id: string;
  name: string;
  order: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate?: string;
  completedAt?: string;
}

interface TimelineData {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  progress: number;
  currentMilestone?: {
    id: string;
    name: string;
    order: number;
  };
  nextDueDate?: string;
  estimatedCompletion?: string;
}

interface ProjectTimelineProps {
  projectId: string;
  onMilestoneClick?: (milestone: Milestone) => void;
  onComplete?: (milestoneId: string) => void;
  compact?: boolean;
}

const ProjectTimeline: React.FC<ProjectTimelineProps> = ({
  projectId,
  onMilestoneClick,
  onComplete,
  compact = false
}) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchMilestones();
  }, [projectId]);

  const fetchMilestones = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/milestones/project/${projectId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch milestones');
      }

      const data = await response.json();
      setMilestones(data.milestones || []);
      setTimeline(data.timeline || null);
      setError(null);
    } catch (err) {
      console.error('Error fetching milestones:', err);
      setError('Unable to load project timeline');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMilestone = async (milestoneId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/milestones/${milestoneId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to complete milestone');
      }

      // Refresh timeline
      await fetchMilestones();
      onComplete?.(milestoneId);
    } catch (err) {
      console.error('Error completing milestone:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '✅';
      case 'IN_PROGRESS':
        return '🔄';
      default:
        return '⏳';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'milestone-completed';
      case 'IN_PROGRESS':
        return 'milestone-in-progress';
      default:
        return 'milestone-pending';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="project-timeline-container">
        <div className="timeline-loading">
          <div className="loading-spinner" />
          <span>Loading timeline...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-timeline-container">
        <div className="timeline-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={fetchMilestones} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`project-timeline-container ${compact ? 'compact' : ''}`}>
      {/* Progress Overview */}
      <div className="timeline-header">
        <div className="timeline-title">
          <h3>📋 Project Timeline</h3>
          {timeline && (
            <span className="progress-badge">
              {timeline.progress}% Complete
            </span>
          )}
        </div>

        {timeline && (
          <div className="timeline-stats">
            <div className="stat">
              <span className="stat-value">{timeline.completed}</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat">
              <span className="stat-value">{timeline.inProgress}</span>
              <span className="stat-label">In Progress</span>
            </div>
            <div className="stat">
              <span className="stat-value">{timeline.pending}</span>
              <span className="stat-label">Upcoming</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {timeline && (
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${timeline.progress}%` }}
            />
          </div>
          {timeline.estimatedCompletion && (
            <span className="estimated-completion">
              Est. completion: {formatDate(timeline.estimatedCompletion)}
            </span>
          )}
        </div>
      )}

      {/* Current Milestone Highlight */}
      {timeline?.currentMilestone && (
        <div className="current-milestone-banner">
          <span className="current-label">Currently Working On:</span>
          <span className="current-name">{timeline.currentMilestone.name}</span>
        </div>
      )}

      {/* Milestones List */}
      <div className="milestones-list">
        {milestones.map((milestone, index) => (
          <div
            key={milestone.id}
            className={`milestone-item ${getStatusClass(milestone.status)} ${
              expandedMilestone === milestone.id ? 'expanded' : ''
            }`}
            onClick={() => {
              if (!compact) {
                setExpandedMilestone(
                  expandedMilestone === milestone.id ? null : milestone.id
                );
              }
              onMilestoneClick?.(milestone);
            }}
          >
            {/* Timeline Line */}
            <div className="milestone-connector">
              <div className={`connector-line ${index === 0 ? 'first' : ''} ${
                index === milestones.length - 1 ? 'last' : ''
              }`} />
              <div className={`connector-dot ${getStatusClass(milestone.status)}`}>
                {milestone.status === 'COMPLETED' ? '✓' : milestone.order}
              </div>
            </div>

            {/* Milestone Content */}
            <div className="milestone-content">
              <div className="milestone-header">
                <span className="milestone-status-icon">
                  {getStatusIcon(milestone.status)}
                </span>
                <h4 className="milestone-name">{milestone.name}</h4>
                {milestone.dueDate && milestone.status !== 'COMPLETED' && (
                  <span className="milestone-due-date">
                    Due: {formatDate(milestone.dueDate)}
                  </span>
                )}
              </div>

              {/* Expanded Details */}
              {!compact && expandedMilestone === milestone.id && (
                <div className="milestone-details">
                  <div className="detail-row">
                    <span className="detail-label">Status:</span>
                    <span className={`detail-value status-${milestone.status.toLowerCase()}`}>
                      {milestone.status.replace('_', ' ')}
                    </span>
                  </div>
                  {milestone.completedAt && (
                    <div className="detail-row">
                      <span className="detail-label">Completed:</span>
                      <span className="detail-value">
                        {formatDate(milestone.completedAt)}
                      </span>
                    </div>
                  )}
                  {milestone.status === 'IN_PROGRESS' && onComplete && (
                    <button
                      className="complete-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompleteMilestone(milestone.id);
                      }}
                    >
                      ✅ Mark Complete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {milestones.length === 0 && (
        <div className="timeline-empty">
          <span className="empty-icon">📭</span>
          <p>No milestones yet</p>
          <span className="empty-hint">
            Milestones will appear here as your project progresses
          </span>
        </div>
      )}
    </div>
  );
};

export default ProjectTimeline;
