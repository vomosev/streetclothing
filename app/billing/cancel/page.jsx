'use client';

import Card, { CardBody } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';

export default function BillingCancelPage() {
  return (
    <section className="stack">
      <header className="page-header">
        <h1>Payment cancelled</h1>
        <p>
          No charge was made. Your bag and membership are exactly as you left them, so you can pick
          up again whenever the drop feels right.
        </p>
      </header>

      <Card>
        <CardBody>
          <EmptyState
            title="Nothing was charged"
            description="The checkout window was closed before the payment completed. You can choose another payment provider or head back to your bag to review the pieces first."
            action={
              <div className="cluster">
                <Button as="a" href="/pricing" variant="primary" size="md">
                  Back to membership
                </Button>
                <Button as="a" href="/cart" variant="secondary" size="md">
                  Review your bag
                </Button>
                <Button as="a" href="/shop" variant="ghost" size="md">
                  Keep shopping
                </Button>
              </div>
            }
          />
        </CardBody>
      </Card>
    </section>
  );
}