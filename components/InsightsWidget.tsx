import React from 'react';
import type { Page } from '../types';
import type { Insight, InsightKind } from '../utils/insightsModel';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import Icon from './ui/Icon';
import { EmptyState } from './ui/States';
import { fitRows, useWidgetBox } from './ui/WidgetGrid';

const KIND_META: Record<InsightKind, { label: string; icon: string }> = {
  cashFlow: { label: 'Cash flow', icon: 'warning' },
  idleCash: { label: 'Idle cash', icon: 'wallet' },
  spendingAnomaly: { label: 'Spending', icon: 'trending_up' },
  savingsRate: { label: 'Savings rate', icon: 'savings' },
  subscriptions: { label: 'Subscriptions', icon: 'repeat' },
};

export interface InsightsWidgetProps {
  insights: Insight[];
  onDismiss: (id: string) => void;
  onNavigate?: (page: Page) => void;
}

const InsightsWidget: React.FC<InsightsWidgetProps> = ({ insights, onDismiss, onNavigate }) => {
  const box = useWidgetBox();
  // Each insight with its action is about 112px; in a short widget the action goes and a row is 76px.
  const compact = box.height > 0 && box.height < 220;
  const fit = fitRows(box, compact ? 76 : 112, 4);
  const count = box.height === 0 || fit >= insights.length - 1 ? insights.length : Math.max(1, fit - 1);
  const hidden = insights.length - count;

  if (insights.length === 0) {
    return (
      <EmptyState
        icon="lightbulb"
        title="Nothing calling for attention"
        description="When your cash flow dips, a category runs high, or idle cash builds up, it shows here."
        className="h-full py-4"
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
    <ul className="min-h-0 flex-1 divide-y divide-line overflow-hidden">
      {insights.slice(0, count).map(insight => {
        const meta = KIND_META[insight.kind];
        return (
          <li key={insight.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={insight.tone} icon={meta.icon}>{meta.label}</Badge>
                <span className="type-body-strong text-ink">{insight.title}</span>
              </div>
              <p className={`type-caption mt-1 text-muted ${compact ? 'line-clamp-1' : ''}`}>{insight.body}</p>
              {!compact && insight.page && onNavigate && (
                <div className="mt-2">
                  <Button size="sm" variant="ghost" icon="arrow_forward" onPress={() => onNavigate(insight.page!)}>
                    Open {insight.page}
                  </Button>
                </div>
              )}
            </div>
            <IconButton
              icon="close"
              label={`Dismiss ${insight.title}`}
              iconSize={16}
              onPress={() => onDismiss(insight.id)}
            />
          </li>
        );
      })}
    </ul>
    {hidden > 0 && <p className="type-caption mt-2 shrink-0 text-muted">+{hidden} more {hidden === 1 ? 'insight' : 'insights'}</p>}
    </div>
  );
};

export default InsightsWidget;
