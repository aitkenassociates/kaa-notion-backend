import React, { useState, useEffect, useCallback } from 'react';
import './TierUpgradeModal.css';

interface Tier {
  id: number;
  name: string;
  price: number | null;
  description: string;
  features: string[];
  byInvitation?: boolean;
}

interface TierUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: number;
  clientId?: string;
  projectId?: string;
  email?: string;
  onUpgradeSuccess?: (newTier: number) => void;
}

const TIER_DETAILS: Tier[] = [
  {
    id: 1,
    name: 'The Concept',
    price: 299,
    description: 'AI-powered concept designs with DIY guidance',
    features: [
      'AI-generated concept designs',
      'Plant recommendations',
      'DIY implementation guide',
      '1 revision included',
      'Digital delivery'
    ]
  },
  {
    id: 2,
    name: 'The Builder',
    price: 1499,
    description: 'Custom design plans with designer checkpoints',
    features: [
      'Custom design plans',
      'Designer review checkpoints',
      'Detailed plant list',
      'Material specifications',
      '2 revisions included',
      'Digital + print delivery'
    ]
  },
  {
    id: 3,
    name: 'The Concierge',
    price: 4999,
    description: 'Full design service with site visits',
    features: [
      'On-site consultation',
      'Complete design package',
      'Construction documents',
      'Contractor coordination',
      'Unlimited revisions',
      'Project management support'
    ]
  },
  {
    id: 4,
    name: 'KAA White Glove',
    price: null,
    description: 'Premium full-service landscape architecture',
    features: [
      'Dedicated project team',
      'Full design-build coordination',
      'Premium material selections',
      'Construction oversight',
      'Ongoing maintenance planning',
      'Lifetime design relationship'
    ],
    byInvitation: true
  }
];

const TierUpgradeModal: React.FC<TierUpgradeModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  clientId,
  projectId,
  email,
  onUpgradeSuccess
}) => {
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTier(null);
      setError(null);
      setCheckoutUrl(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleUpgrade = useCallback(async () => {
    if (!selectedTier || selectedTier <= currentTier) return;

    const tier = TIER_DETAILS.find(t => t.id === selectedTier);
    if (!tier) return;

    if (tier.byInvitation) {
      // For invitation-only tier, show contact message
      setError('This tier is by invitation only. Please contact us at info@kaa.com');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/subscriptions/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: selectedTier,
          clientId,
          projectId,
          email,
          successUrl: `${window.location.origin}/upgrade/success?tier=${selectedTier}`,
          cancelUrl: `${window.location.origin}/upgrade/cancel`
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout');
      }

      const data = await response.json();

      if (data.url) {
        setCheckoutUrl(data.url);
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Upgrade error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process upgrade');
    } finally {
      setLoading(false);
    }
  }, [selectedTier, currentTier, clientId, projectId, email, API_URL]);

  const formatPrice = (price: number | null): string => {
    if (price === null) return 'Custom';
    return `$${price.toLocaleString()}`;
  };

  const getTierBadge = (tierId: number): string => {
    if (tierId === currentTier) return 'Current';
    if (tierId < currentTier) return '';
    if (tierId === 4) return 'Premium';
    return 'Upgrade';
  };

  const isUpgrade = (tierId: number): boolean => {
    return tierId > currentTier;
  };

  if (!isOpen) return null;

  return (
    <div className="tier-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="tier-modal"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        {/* Header */}
        <div className="tier-modal-header">
          <div className="header-content">
            <h2>🚀 Upgrade Your Plan</h2>
            <p>Unlock more features and get better results with an upgraded tier</p>
          </div>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="tier-error">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Tier Cards */}
        <div className="tier-cards">
          {TIER_DETAILS.map((tier) => {
            const badge = getTierBadge(tier.id);
            const isCurrentTier = tier.id === currentTier;
            const canUpgrade = isUpgrade(tier.id);
            const isSelected = selectedTier === tier.id;

            return (
              <div
                key={tier.id}
                className={`tier-card ${isCurrentTier ? 'current' : ''} ${
                  canUpgrade ? 'upgradeable' : ''
                } ${isSelected ? 'selected' : ''} ${
                  tier.byInvitation ? 'invitation-only' : ''
                }`}
                onClick={() => canUpgrade && setSelectedTier(tier.id)}
                role={canUpgrade ? 'button' : undefined}
                tabIndex={canUpgrade ? 0 : undefined}
              >
                {/* Badge */}
                {badge && (
                  <span className={`tier-badge ${badge.toLowerCase()}`}>
                    {badge}
                  </span>
                )}

                {/* Tier Info */}
                <div className="tier-header">
                  <h3 className="tier-name">{tier.name}</h3>
                  <div className="tier-price">
                    <span className="price-value">{formatPrice(tier.price)}</span>
                    {tier.price && <span className="price-suffix">one-time</span>}
                  </div>
                </div>

                <p className="tier-description">{tier.description}</p>

                {/* Features */}
                <ul className="tier-features">
                  {tier.features.map((feature, index) => (
                    <li key={index}>
                      <span className="feature-check">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Selection Indicator */}
                {canUpgrade && (
                  <div className="selection-indicator">
                    <span className={`radio ${isSelected ? 'selected' : ''}`}>
                      {isSelected && '●'}
                    </span>
                    <span>{isSelected ? 'Selected' : 'Select this plan'}</span>
                  </div>
                )}

                {tier.byInvitation && (
                  <div className="invitation-notice">
                    <span>📧</span>
                    <span>Contact us for availability</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison Highlight */}
        {selectedTier && selectedTier > currentTier && (
          <div className="upgrade-comparison">
            <span className="comparison-icon">⬆️</span>
            <span>
              Upgrading from{' '}
              <strong>{TIER_DETAILS[currentTier - 1]?.name}</strong>
              {' → '}
              <strong>{TIER_DETAILS[selectedTier - 1]?.name}</strong>
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="tier-modal-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>

          <button
            className="upgrade-button"
            onClick={handleUpgrade}
            disabled={!selectedTier || selectedTier <= currentTier || loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Processing...
              </>
            ) : checkoutUrl ? (
              'Redirecting...'
            ) : selectedTier && TIER_DETAILS[selectedTier - 1]?.byInvitation ? (
              'Contact Us'
            ) : (
              <>
                Upgrade to {selectedTier ? TIER_DETAILS[selectedTier - 1]?.name : 'Selected Plan'}
                {selectedTier && TIER_DETAILS[selectedTier - 1]?.price && (
                  <span className="button-price">
                    {formatPrice(TIER_DETAILS[selectedTier - 1].price)}
                  </span>
                )}
              </>
            )}
          </button>
        </div>

        {/* Trust Indicators */}
        <div className="trust-indicators">
          <span>🔒 Secure payment with Stripe</span>
          <span>💳 All major cards accepted</span>
          <span>🤝 30-day satisfaction guarantee</span>
        </div>
      </div>
    </div>
  );
};

export default TierUpgradeModal;
