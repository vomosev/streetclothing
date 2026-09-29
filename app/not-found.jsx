import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';

export const metadata = {
  title: 'Page not found — STREET/PLATINUM',
  description: 'The page you were looking for is no longer part of the drop.',
};

export default function NotFound() {
  return (
    <section className="section">
      <h1>404 — Off the rail</h1>
      <p>
        The link you followed points at something that is no longer stocked. Head back to the shop
        to see what is live in the current drop.
      </p>
      <EmptyState
        title="This page slipped out of the drop"
        description="Pieces rotate fast around here. The catalogue below is always current."
        action={
          <Button as="a" href="/shop" variant="primary" size="md">
            Back to the shop
          </Button>
        }
      />
    </section>
  );
}