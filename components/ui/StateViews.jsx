'use client';

import EmptyState from './EmptyState';
import Button from './Button';
import Spinner from './Spinner';

/**
 * LoadingState
 * Renders fixed-height skeleton blocks that reserve the same space the real
 * content will occupy, so nothing reflows when the data lands.
 *
 * variant:
 *  - 'cards'  : product-grid skeletons (aspect-ratio artwork + two text lines)
 *  - 'rows'   : table/list row skeletons
 *  - 'panel'  : a single tall panel (detail pages, summaries)
 *  - 'text'   : a few lines of running text
 */
export function LoadingState({ rows = 3, variant = 'cards', label = 'Loading' }) {
  const count = Math.max(1, Number(rows) || 1);
  const items = Array.from({ length: count }, (_, index) => index);

  if (variant === 'rows') {
    return (
      <div className="skeleton-list" role="status" aria-live="polite" aria-busy="true">
        <span className="visually-hidden">{label}</span>
        {items.map((index) => (
          <div className="skeleton-row" key={index}>
            <span className="skeleton skeleton--line skeleton--line-lg" />
            <span className="skeleton skeleton--line skeleton--line-sm" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'panel') {
    return (
      <div className="skeleton-panel" role="status" aria-live="polite" aria-busy="true">
        <span className="visually-hidden">{label}</span>
        <span className="skeleton skeleton--block" />
        <div className="skeleton-lines">
          <span className="skeleton skeleton--line skeleton--line-lg" />
          <span className="skeleton skeleton--line skeleton--line-md" />
          <span className="skeleton skeleton--line skeleton--line-sm" />
        </div>
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className="skeleton-lines" role="status" aria-live="polite" aria-busy="true">
        <span className="visually-hidden">{label}</span>
        {items.map((index) => (
          <span
            className={`skeleton skeleton--line ${
              index % 3 === 2 ? 'skeleton--line-sm' : 'skeleton--line-lg'
            }`}
            key={index}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="skeleton-grid" role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      {items.map((index) => (
        <div className="skeleton-card" key={index}>
          <span className="skeleton skeleton--art" />
          <div className="skeleton-lines">
            <span className="skeleton skeleton--line skeleton--line-lg" />
            <span className="skeleton skeleton--line skeleton--line-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * ErrorState
 * Shared failure presentation with an optional retry action.
 */
export function ErrorState({
  title = 'We could not load this',
  message = 'Something went wrong while talking to the store. Try again in a moment.',
  onRetry,
  retryLabel = 'Try again',
  retrying = false,
}) {
  return (
    <div className="state-view state-view--danger" role="alert">
      <EmptyState
        tone="danger"
        title={title}
        description={message}
        icon={
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
            <path
              d="M12 3.2 1.8 20.8h20.4L12 3.2Zm0 5.3c.6 0 1 .45 1 1v4.3a1 1 0 0 1-2 0V9.5c0-.55.4-1 1-1Zm0 8.1a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"
              fill="currentColor"
            />
          </svg>
        }
        action={
          typeof onRetry === 'function' ? (
            <Button variant="secondary" size="md" onClick={onRetry} loading={retrying}>
              {retryLabel}
            </Button>
          ) : null
        }
      />
    </div>
  );
}

/**
 * OfflineNotice
 * Shown when the API host itself cannot be reached, so the storefront still
 * renders something deliberate instead of an empty screen.
 */
export function OfflineNotice({
  title = 'The catalogue is temporarily unavailable',
  children,
  onRetry,
  checking = false,
}) {
  return (
    <div className="state-view state-view--offline" role="status" aria-live="polite">
      <EmptyState
        tone="warning"
        title={title}
        description={
          children ||
          'We cannot reach the STREET/PLATINUM store service right now. Your bag is saved on this device — please try again shortly.'
        }
        icon={
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
            <path
              d="M3.3 4.7 4.7 3.3l16 16-1.4 1.4-3-3H6.8a4.3 4.3 0 0 1-.7-8.54c.1-.5.27-.98.5-1.42L3.3 4.7Zm5.4 2.6A5.2 5.2 0 0 1 17.9 9.6a4.3 4.3 0 0 1 2.6 7.1L8.7 7.3Z"
              fill="currentColor"
            />
          </svg>
        }
        action={
          typeof onRetry === 'function' ? (
            <Button variant="secondary" size="md" onClick={onRetry} loading={checking}>
              {checking ? 'Checking' : 'Check again'}
            </Button>
          ) : null
        }
      />
      {checking ? (
        <p className="state-view__hint">
          <Spinner size="sm" label="Reconnecting" /> Reconnecting to the store service…
        </p>
      ) : null}
    </div>
  );
}

export default LoadingState;