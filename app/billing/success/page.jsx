'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Card, { CardHeader, CardBody, CardFooter } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Spinner from '../../../components/ui/Spinner';
import EmptyState from '../../../components/ui/EmptyState';
import { completePayment } from '../../../lib/api';
import { formatPrice } from '../../../lib/format';
import { useCart } from '../../../context/CartContext';

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 3000;

const STATUS_COPY = {
  paid: {
    title: 'Payment confirmed',
    body: 'Your order is locked in. We have emailed a receipt and you can follow the fulfilment status from your account.',
    tone: 'success',
    label: 'Paid',
  },
  pending: {
    title: 'Still confirming your payment',
    body: 'Your provider has not finished settling this transaction. It usually clears within a few minutes — you can safely close this page and check your account later.',
    tone: 'warning',
    label: 'Pending',
  },
  failed: {
    title: 'Payment failed',
    body: 'The provider declined this transaction and nothing was charged. Try again with a different provider or payment method.',
    tone: 'danger',
    label: 'Failed',
  },
  canceled: {
    title: 'Payment cancelled',
    body: 'You cancelled the checkout before it completed. Nothing was charged to your account.',
    tone: 'neutral',
    label: 'Cancelled',
  },
};

function BillingSuccessInner() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('ref') || searchParams.get('reference') || '';
  const { clear } = useCart();

  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(Boolean(reference));
  const [attempts, setAttempts] = useState(0);

  const clearedRef = useRef(false);
  const pollCountRef = useRef(0);
  const timerRef = useRef(null);
  const activeRef = useRef(true);

  const runCheck = useCallback(
    async (ref) => {
      if (!ref) return;
      setChecking(true);
      setError('');
      try {
        const data = await completePayment(ref);
        if (!activeRef.current) return;
        setResult(data || null);
        pollCountRef.current += 1;
        setAttempts(pollCountRef.current);

        const status = data && data.status;

        if (status === 'paid' && !clearedRef.current) {
          clearedRef.current = true;
          const itemId = (data && data.itemId) || '';
          if (typeof itemId === 'string' && itemId.startsWith('order:')) {
            try {
              clear();
            } catch (cartError) {
              // A cart that cannot be cleared must never break the receipt view.
            }
          }
        }

        if (status === 'pending' && pollCountRef.current < MAX_POLLS) {
          timerRef.current = setTimeout(() => {
            if (activeRef.current) runCheck(ref);
          }, POLL_INTERVAL_MS);
        } else {
          setChecking(false);
        }
      } catch (err) {
        if (!activeRef.current) return;
        setChecking(false);
        setError(
          (err && err.message) ||
            'We could not reach the payments service to confirm this transaction.'
        );
      }
    },
    [clear]
  );

  useEffect(() => {
    activeRef.current = true;
    pollCountRef.current = 0;
    clearedRef.current = false;
    setResult(null);
    setAttempts(0);

    if (reference) {
      runCheck(reference);
    } else {
      setChecking(false);
    }

    return () => {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reference, runCheck]);

  const handleRetry = () => {
    pollCountRef.current = 0;
    setAttempts(0);
    runCheck(reference);
  };

  if (!reference) {
    return (
      <section className="stack">
        <h1>Payment reference missing</h1>
        <EmptyState
          title="No payment to confirm"
          description="This page needs a payment reference in the address bar. Start a checkout from the membership page and your provider will send you back here automatically."
          action={
            <Button as="a" href="/pricing" variant="primary" size="md">
              Go to membership
            </Button>
          }
        />
      </section>
    );
  }

  const status = result && result.status ? result.status : null;
  const copy = (status && STATUS_COPY[status]) || null;
  const showSpinner = checking && !copy;

  return (
    <section className="stack">
      <h1>Checkout status</h1>
      <p>
        Reference <code>{reference}</code>. We are confirming this transaction directly with the
        payment provider — no card details ever touch STREET/PLATINUM.
      </p>

      <Card>
        <CardHeader>
          <div className="cluster">
            <h2>{copy ? copy.title : 'Confirming your payment'}</h2>
            {copy ? <Badge tone={copy.tone} size="md">{copy.label}</Badge> : null}
          </div>
        </CardHeader>

        <CardBody>
          {showSpinner ? (
            <div className="cluster" aria-live="polite">
              <Spinner size="md" label="Confirming payment" />
              <p>Talking to the payment provider. This can take a few seconds.</p>
            </div>
          ) : null}

          {error ? (
            <div className="stack" role="alert">
              <p>{error}</p>
              <p>
                If you were charged, nothing is lost — the webhook will finalise your order and it
                will appear in your account history.
              </p>
            </div>
          ) : null}

          {copy ? (
            <div className="stack" aria-live="polite">
              <p>{copy.body}</p>
              {result && typeof result.amount === 'number' ? (
                <p>
                  Amount: <strong>{formatPrice(result.amount, result.currency || 'USD')}</strong>
                  {result.kind === 'subscription' ? ' — membership' : ''}
                </p>
              ) : null}
              {result && result.itemId ? (
                <p className="user-text">
                  Item: <code>{result.itemId}</code>
                </p>
              ) : null}
              {status === 'pending' && attempts >= MAX_POLLS ? (
                <p>
                  We stopped checking after {MAX_POLLS} attempts. Refresh this page or check your
                  account in a few minutes.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardBody>

        <CardFooter>
          <div className="cluster">
            {status === 'paid' ? (
              <Button as="a" href="/account" variant="primary" size="md">
                View my orders
              </Button>
            ) : null}
            {status === 'pending' || error ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleRetry}
                loading={checking}
                disabled={checking}
              >
                Check again
              </Button>
            ) : null}
            {status === 'failed' || status === 'canceled' ? (
              <Button as="a" href="/pricing" variant="primary" size="md">
                Try another provider
              </Button>
            ) : null}
            <Button as="a" href="/shop" variant="secondary" size="md">
              Back to the drop
            </Button>
          </div>
        </CardFooter>
      </Card>
    </section>
  );
}

function BillingSuccessFallback() {
  return (
    <section className="stack">
      <h1>Checkout status</h1>
      <Card>
        <CardBody>
          <div className="cluster">
            <Spinner size="md" label="Loading payment details" />
            <p>Loading payment details…</p>
          </div>
        </CardBody>
      </Card>
    </section>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<BillingSuccessFallback />}>
      <BillingSuccessInner />
    </Suspense>
  );
}