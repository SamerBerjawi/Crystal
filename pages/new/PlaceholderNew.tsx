import React from 'react';
import { Button, Card, EmptyState } from '../../components/new/ui';
import { useShellNew } from '../../components/new/shellContext';

/**
 * Stand-in for a New page that is not built yet (UI_UX_DESIGN_REFERENCE.md §5.0). It never renders classic UI
 * inside ShellNew: it links to the classic page instead.
 */
export const PlaceholderNew: React.FC<{ title: string; classicPath: string }> = ({ title, classicPath }) => {
  const { navigate } = useShellNew();
  return (
    <Card className="mx-auto mt-2 max-w-2xl">
      <EmptyState
        icon="sparkles"
        title={`${title} is being rebuilt`}
        body="This page has not been redesigned yet. Its features are still available in the classic UI."
        action={<Button variant="cta" icon="external" onClick={() => navigate(classicPath)}>Open in classic UI</Button>}
      />
    </Card>
  );
};
