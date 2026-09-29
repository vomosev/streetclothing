'use client';

import Button from './ui/Button';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import { LoadingState, ErrorState } from './ui/StateViews';

export default function ProviderButtons({
  providers = [],
  loading = false,
  error = null,
  onPay,
  busyId = null,
  label = 'Pay with',
  onRetry,
}) {
  if (loading) {
    return <LoadingState rows={2} variant="lines" />;
  }

  if (error) {
    return (
      <ErrorState
        message={
          typeof error === 'string'
            ? error
            : 'We could not load the payment options. Please try again.'
        }
        onRetry={onRetry}
      />
    );
  }

  if (!Array.isArray(providers) || providers.length === 0) {
    return (
      <EmptyState
        title="Payments are not available yet"
        description="Payments are not available yet — check back soon. Our checkout opens as soon as the next drop goes live."
      />
    );
  }

  const busy = Boolean(busyId);

  return (
    <div className="provider-buttons stack">
      <p className="provider-buttons__label text-muted">{label}</p>
      <div className="provider-buttons__list cluster">
        {providers.map((provider) => {
          const id = provider?.id || '';
          const providerLabel = provider?.label || id || 'Provider';
          const mode = provider?.mode;
          const isBusy = busyId === id;

          return (
            <div key={id || providerLabel} className="provider-buttons__item">
              <Button
                variant={isBusy ? 'primary' : 'secondary'}
                size="md"
                loading={isBusy}
                disabled={busy && !isBusy}
                onClick={() => {
                  if (typeof onPay === 'function' && id) {
                    onPay(id);
                  }
                }}
                aria-label={`${label} ${providerLabel}`}
              >
                {providerLabel}
              </Button>
              {mode && mode !== 'live' ? (
                <Badge tone="warning" size="sm">
                  {mode}
                </Badge>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}