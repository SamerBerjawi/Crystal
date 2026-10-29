import React from 'react';
import { Button, Card, EmptyState } from '../../components/new/ui';
import { useShellNew } from '../../components/new/shellContext';
import { newPathFor } from '../../utils/newRoutes';

/** Unknown `-new` URL. Stays in the New UI rather than bouncing to the classic dashboard. */
export const NotFoundNew: React.FC<{ path: string }> = ({ path }) => {
  const { navigate } = useShellNew();
  return (
    <Card className="mx-auto mt-2 max-w-2xl">
      <EmptyState
        icon="alert"
        title="Page not found"
        body={<>There is no page at <code className="rounded bg-nv-inset px-1.5 py-0.5 text-nv-ink">{path}</code>.</>}
        action={<Button variant="cta" icon="home" onClick={() => navigate(newPathFor('Dashboard'))}>Go to dashboard</Button>}
      />
    </Card>
  );
};
