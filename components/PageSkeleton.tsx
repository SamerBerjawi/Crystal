import React from 'react';

interface PageSkeletonProps {
  variant?: 'dashboard' | 'list' | 'detail' | 'grid';
}

const PageSkeleton: React.FC<PageSkeletonProps> = ({ variant = 'list' }) => {
  return (
    <div className="w-full space-y-6 animate-pulse p-2">
      {/* Header Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/5 dark:border-white/5">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-line-strong rounded-lg" />
          <div className="h-4 w-72 bg-inset rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-24 bg-line-strong rounded-xl" />
          <div className="h-10 w-32 bg-line-strong rounded-xl" />
        </div>
      </div>

      {variant === 'dashboard' && (
        <>
          {/* Hero / Stat Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-surface border border-line rounded-2xl p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 bg-line-strong rounded" />
                  <div className="w-8 h-8 rounded-lg bg-line-strong" />
                </div>
                <div className="h-8 w-32 bg-line-strong rounded-lg" />
              </div>
            ))}
          </div>

          {/* Main Chart / Content Blocks */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-72 bg-surface border border-line rounded-3xl p-6" />
            <div className="h-72 bg-surface border border-line rounded-3xl p-6" />
          </div>
        </>
      )}

      {variant === 'list' && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-16 bg-surface border border-line rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-line-strong" />
                <div className="space-y-1.5">
                  <div className="h-4 w-36 bg-line-strong rounded" />
                  <div className="h-3 w-24 bg-line rounded" />
                </div>
              </div>
              <div className="h-5 w-20 bg-line-strong rounded" />
            </div>
          ))}
        </div>
      )}

      {variant === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-surface border border-line rounded-3xl p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-line-strong" />
                <div className="h-6 w-16 bg-line-strong rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-5 w-32 bg-line-strong rounded" />
                <div className="h-4 w-48 bg-line rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {variant === 'detail' && (
        <div className="space-y-6">
          <div className="h-48 bg-surface border border-line rounded-3xl p-6" />
          <div className="h-64 bg-surface border border-line rounded-3xl p-6" />
        </div>
      )}
    </div>
  );
};

export default PageSkeleton;
