'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { getOrders, getSubscription } from '../../lib/api';
import Card, { CardHeader, CardBody, CardFooter } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { formatPrice, formatDate, titleCase } from '../../lib/format';

function statusTone(status) {
  switch (status) {
    case 'paid':
    case 'active':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'danger';
    case 'canceled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export default function AccountPage() {
  const router = useRouter();
  const { user, status: authStatus, logout } = useAuth();

  const [orders, setOrders] = useState([]);
  const [ordersStatus, setOrdersStatus] = useState('loading');
  const [ordersError, setOrdersError] = useState('');

  const [subscription, setSubscription] = useState(null);
  const [subStatus, setSubStatus] = useState('loading');

  useEffect(() => {
    if (authStatus === 'ready' && !user) {
      router.replace('/login?next=/account');
    }
  }, [authStatus, user, router]);

  const loadOrders = useCallback(async (signal) => {
    setOrdersStatus('loading');
    setOrdersError('');
    try {
      const data = await getOrders({ signal });
      if (signal && signal.aborted) return;
      setOrders(Array.isArray(data && data.orders) ? data.orders : []);
      setOrdersStatus('ready');
    } catch (err) {
      if (signal && signal.aborted) return;
      if (err && err.name === 'AbortError') return;
      setOrdersError((err && err.message) || 'We could not load your order history.');
      setOrdersStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const controller = new AbortController();
    loadOrders(controller.signal);
    return () => controller.abort();
  }, [user, loadOrders]);

  useEffect(() => {
    if (!user) return undefined;
    const controller = new AbortController();
    let active = true;
    setSubStatus('loading');
    getSubscription({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setSubscription((data && data.subscription) || null);
        setSubStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setSubscription(null);
        setSubStatus('error');
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [user]);

  if (authStatus === 'loading' || authStatus === 'idle') {
    return (
      <section className="stack">
        <h1>Account</h1>
        <LoadingState rows={3} variant="panel" />
      </section>
    );
  }

  if (!user) {
    return (
      <section className="stack">
        <h1>Account</h1>
        <EmptyState
          title="Sign in to view your account"
          description="Your order history, membership and saved details live behind the door. Sign in to pick up where you left off."
          action={
            <Button as="a" href="/login?next=/account" variant="primary" size="md">
              Sign in
            </Button>
          }
        />
      </section>
    );
  }

  const columns = [
    {
      key: 'reference',
      header: 'Order',
      render: (row) => <span className="truncate">{row.reference}</span>,
    },
    {
      key: 'created_at',
      header: 'Placed',
      render: (row) => formatDate(row.createdAt || row.created_at),
    },
    {
      key: 'items',
      header: 'Pieces',
      render: (row) => {
        const items = Array.isArray(row.items) ? row.items : [];
        if (!items.length) return '—';
        const names = items
          .map((item) => `${item.name || 'Item'}${item.sizeLabel ? ` (${item.sizeLabel})` : ''} ×${item.quantity || 1}`)
          .join(', ');
        return <span className="user-text">{names}</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={statusTone(row.status)}>{titleCase(row.status || 'pending')}</Badge>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (row) => formatPrice(row.totalCents ?? row.total_cents ?? 0, row.currency || 'USD'),
    },
  ];

  const firstName = (user.fullName || user.email || 'Member').split(' ')[0];

  return (
    <section className="stack">
      <header className="page-header">
        <h1>Welcome back, {firstName}</h1>
        <p>
          Track your drops, manage your STREET PASS membership and keep your details current. Everything you have
          ordered from the vault lives here.
        </p>
      </header>

      <div className="grid grid--two">
        <Card>
          <CardHeader>
            <h2>Profile</h2>
          </CardHeader>
          <CardBody>
            <dl className="detail-list">
              <div className="detail-list__row">
                <dt>Name</dt>
                <dd className="user-text">{user.fullName || '—'}</dd>
              </div>
              <div className="detail-list__row">
                <dt>Email</dt>
                <dd className="user-text">{user.email}</dd>
              </div>
              <div className="detail-list__row">
                <dt>Member ID</dt>
                <dd>#{user.id}</dd>
              </div>
            </dl>
          </CardBody>
          <CardFooter>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <h2>Membership</h2>
          </CardHeader>
          <CardBody>
            {subStatus === 'loading' ? (
              <LoadingState rows={2} variant="lines" />
            ) : subscription ? (
              <div className="stack stack--tight">
                <p className="text-muted">
                  Plan <strong>{titleCase(String(subscription.planId || '').replace(/[-_]/g, ' '))}</strong>
                </p>
                <div className="cluster">
                  <Badge tone={statusTone(subscription.status)}>{titleCase(subscription.status || 'unknown')}</Badge>
                  {subscription.cancelAtPeriodEnd ? <Badge tone="warning">Ends at period end</Badge> : null}
                </div>
                {subscription.currentPeriodEnd ? (
                  <p className="text-muted">Renews {formatDate(subscription.currentPeriodEnd)}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted">
                No active membership. STREET PASS unlocks early drop access, free shipping and member-only colourways.
              </p>
            )}
          </CardBody>
          <CardFooter>
            <div className="cluster">
              <Button as="a" href="/billing" variant="secondary" size="sm">
                Manage billing
              </Button>
              {!subscription ? (
                <Button as="a" href="/pricing" variant="primary" size="sm">
                  See membership
                </Button>
              ) : null}
            </div>
          </CardFooter>
        </Card>
      </div>

      <section className="stack">
        <h2>Order history</h2>
        {ordersStatus === 'loading' ? (
          <LoadingState rows={4} variant="table" />
        ) : ordersStatus === 'error' ? (
          <ErrorState message={ordersError} onRetry={() => loadOrders()} />
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Once you cop a piece from the drop, your receipts and tracking details will show up right here."
            action={
              <Button as="a" href="/shop" variant="primary" size="md">
                Browse the drop
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            rows={orders}
            getRowKey={(row) => row.reference || row.id}
            emptyMessage="No orders yet"
          />
        )}
      </section>

      <p className="text-muted">
        Need help with an order? <Link href="/shop">Keep shopping</Link> or reach the crew at support@streetplatinum.com.
      </p>
    </section>
  );
}