
import React from 'react';
import { ContributionPlanStep } from '../types';
import { formatCurrency } from '../utils';

interface GoalContributionPlanProps {
  plan: Record<string, ContributionPlanStep[]> | null;
  isLoading: boolean;
  error: string | null;
}

const GoalContributionPlan: React.FC<GoalContributionPlanProps> = ({ plan, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8 mt-4">
        <svg className="animate-spin h-8 w-8 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="ml-4 text-light-text-secondary dark:text-dark-text-secondary">Generating your smart plan...</p>
      </div>
    );
  }

  if (error) {
    return <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">{error}</div>;
  }

  if (!plan) {
    return null; // Don't show anything before the user has clicked generate
  }
  
  if (Object.keys(plan).length === 0) {
      return <div className="mt-6 text-center text-light-text-secondary dark:text-dark-text-secondary">No contribution plan needed for the selected goals.</div>;
  }

  return (
    <div className="mt-6 space-y-6">
      {Object.entries(plan).map(([goalName, steps]) => (
        <div key={goalName}>
          <h4 className="font-semibold text-lg mb-2 text-light-text dark:text-dark-text">{goalName}</h4>
          <div className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
            <div className="divide-y divide-black/5 dark:divide-white/5">
                {/* FIX: Cast `steps` to `ContributionPlanStep[]` to resolve the type error on `.sort`. The sort logic is also improved to handle non-date strings correctly. */}
                {(steps as ContributionPlanStep[]).sort((a, b) => {
                    if (a.date === 'Upfront Contribution') return -1;
                    if (b.date === 'Upfront Contribution') return 1;
                    // FIX: Handle 'Warning' and other non-date strings to prevent invalid date errors.
                    if (a.date.includes('-') && b.date.includes('-')) {
                        return new Date(a.date).getTime() - new Date(b.date).getTime();
                    }
                    if (a.date.includes('-')) return -1; // Dates before strings
                    if (b.date.includes('-')) return 1;
                    return a.date.localeCompare(b.date); // Fallback for other strings
                }).map((step, index) => (
                <div key={index} className={`p-3 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm ${step.notes ? 'bg-yellow-100/50 dark:bg-yellow-900/20' : ''}`}>
                    <div className="font-medium flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-light-text-secondary dark:text-dark-text-secondary">
                            {step.date.startsWith('Upfront') ? 'star' : 'calendar_month'}
                        </span>
                        {/* FIX: Ensure that only valid date strings are passed to the Date constructor. */}
                        <span>{step.date.includes('-') ? new Date(step.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : step.date}</span>
                    </div>
                    <div className="text-light-text-secondary dark:text-dark-text-secondary">
                        From <span className="font-semibold text-light-text dark:text-dark-text">{step.accountName}</span>
                    </div>
                    <div className="text-left sm:text-right font-bold text-base">
                        {step.accountName === 'Unfunded Shortfall' ? 
                            <span className="text-red-500">{formatCurrency(step.amount, 'EUR')}</span> :
                            formatCurrency(step.amount, 'EUR')
                        }
                    </div>
                    {step.notes && <div className="sm:col-span-3 text-xs text-yellow-700 dark:text-yellow-200 pt-1">{step.notes}</div>}
                </div>
                ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GoalContributionPlan;
