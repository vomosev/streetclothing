'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Card, { CardHeader, CardBody, CardFooter } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { getSubscription, cancelSubscription, getManageUrl } from '../../lib/api';
import { formatDate, titleCase } from '../../lib/format';

function statusTone(status) {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'success';
    case 'past_due':
    case 'pending':
      return 'warning';
    case 'canceled':
    case 'expired':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function BillingPage() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [subscription, setSubscription] = useState(null);

  const [manageUrl, setManageUrl] = useState(null);
  const [manageBusy, setManageBusy] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const data = await getSubscription();
      setSubscription(data && data.subscription ? data.subscription : null);
      setStatus('ready');
    } catch (err) {
      if (err && err.status === 401) {
        setSubscription(null);
        setStatus('unauthenticated');
        return;
      }
      setError((err && err.message) || 'We could not load your membership right now.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await load();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    let active = true;
    if (status !== 'ready' || !subscription) {
      setManageUrl(null);
      return () => {
        active = false;
      };
    }
    (async () => {
      try {
        const data = await getManageUrl();
        if (!active) return;
        setManageUrl(data && data.url ? data.url : null);
      } catch (err) {
        if (active) setManageUrl(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [status, subscription]);

  async function handleManage() {
    if (!manageUrl) return;
    setManageBusy(true);
    try {
      window.location.href = manageUrl;
    } finally {
      setManageBusy(false);
    }
  }

  async function handleCancel() {
    setCancelBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      const data = await cancelSubscription();
      setSubscription(data && data.subscription ? data.subscription : null);
      setActionMessage('Your membership will not renew. You keep access until the end of the current period.');
      setConfirmOpen(false);
    } catch (err) {
      setActionError((err && err.message) || 'We could not cancel the membership. Please try again.');
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <section className="page-section stack">
      <header className="page-header">
        <h1>Billing</h1>
        <p>
          Manage your STREET/PLATINUM membership — early drop access, free member shipping and
          member-only colourways.
        </p>
      </header>

      {status === 'loading' ? <LoadingState rows={2} variant="panel" /> : null}

      {status === 'error' ? <ErrorState message={error} onRetry={load} /> : null}

      {status === 'unauthenticated' ? (
        <EmptyState
          title="Sign in to view billing"
          description="Your membership details are tied to your account. Sign in to review or cancel your plan."
          action={
            <div className="cluster">
              <Button as="a" href="/login?next=/billing">
                Sign in
              </Button>
              <Button as="a" href="/pricing" variant="secondary">
                See membership
              </Button>
            </div>
          }
        />
      ) : null}

      {status === 'ready' && !subscription ? (
        <EmptyState
          title="No active membership"
          description="You are shopping as a guest. Join Street Pass for early access to every drop, free shipping and member-only colourways."
          action={
            <Button as="a" href="/pricing">
              See membership plans
            </Button>
          }
        />
      ) : null}

      {status === 'ready' && subscription ? (
        <Card>
          <CardHeader>
            <div className="cluster cluster--between">
              <h2 className="card-title">{titleCase(String(subscription.planId || 'Membership').replace(/[-_]/g, ' '))}</h2>
              <Badge tone={statusTone(subscription.status)} size="md">
                {titleCase(String(subscription.status || 'unknown').replace(/_/g, ' '))}
              </Badge>
            </div>
          </CardHeader>

          <CardBody>
            <dl className="detail-list">
              <div className="detail-list__row">
                <dt>Plan</dt>
                <dd className="user-text">{subscription.planId || '—'}</dd>
              </div>
              <div className="detail-list__row">
                <dt>Renews / ends</dt>
                <dd>{subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : '—'}</dd>
              </div>
              <div className="detail-list__row">
                <dt>Auto-renew</dt>
                <dd>{subscription.cancelAtPeriodEnd ? 'Off — cancels at period end' : 'On'}</dd>
              </div>
              <div className="detail-list__row">
                <dt>Paid with</dt>
                <dd>{subscription.provider ? titleCase(subscription.provider) : '—'}</dd>
              </div>
            </dl>

            <p className="form-message" role="status" aria-live="polite">
              {actionMessage}
            </p>
            {actionError ? (
              <p className="form-error" role="alert">
                {actionError}
              </p>
            ) : null}
          </CardBody>

          <CardFooter>
            <div className="cluster">
              {manageUrl ? (
                <Button variant="secondary" onClick={handleManage} loading={manageBusy}>
                  Manage billing
                </Button>
              ) : null}
              {!subscription.cancelAtPeriodEnd && subscription.status !== 'canceled' ? (
                <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                  Cancel membership
                </Button>
              ) : null}
              <Button as="a" href="/pricing" variant="ghost">
                Change plan
              </Button>
            </div>
          </CardFooter>
        </Card>
      ) : null}

      <p>
        Questions about an order or a charge? Head to your <Link href="/account">account</Link> for
        order history, or browse the current <Link href="/shop">drop</Link>.
      </p>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!cancelBusy) setConfirmOpen(false);
        }}
        title="Cancel your membership?"
        footer={
          <div className="cluster cluster--end">
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={cancelBusy}
            >
              Keep membership
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelBusy}>
              Yes, cancel
            </Button>
          </div>
        }
      >
        <p>
          You will keep early drop access and free member shipping until
          {subscription && subscription.currentPeriodEnd
            ? ` ${formatDate(subscription.currentPeriodEnd)}`
            : ' the end of the current period'}
          . After that your membership will not renew and member pricing ends.
        </p>
      </Modal>
    </section>
  );
}