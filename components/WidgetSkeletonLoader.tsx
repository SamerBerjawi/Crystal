import React from 'react';

interface WidgetSkeletonLoaderProps {
    variant?: 'chart' | 'card' | 'list' | 'default';
    className?: string;
}

export const WidgetSkeletonLoader: React.FC<WidgetSkeletonLoaderProps> = ({ variant = 'default', className = '' }) => {
    return (
        <div className={`w-full h-full min-h-[160px] p-5 rounded-3xl border border-black/5 dark:border-white/5 bg-white/60 dark:bg-dark-card/60 backdrop-blur-md animate-pulse flex flex-col justify-between ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gray-200 dark:bg-gray-800" />
                    <div className="space-y-1.5">
                        <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 rounded-md" />
                        <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800/60 rounded" />
                    </div>
                </div>
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-800" />
            </div>

            {variant === 'chart' && (
                <div className="space-y-3 my-4">
                    <div className="h-28 w-full bg-gray-100 dark:bg-gray-800/40 rounded-2xl flex items-end p-3 gap-2">
                        <div className="w-1/6 h-1/2 bg-gray-200 dark:bg-gray-800 rounded-t" />
                        <div className="w-1/6 h-3/4 bg-gray-200 dark:bg-gray-800 rounded-t" />
                        <div className="w-1/6 h-2/3 bg-gray-200 dark:bg-gray-800 rounded-t" />
                        <div className="w-1/6 h-full bg-gray-200 dark:bg-gray-800 rounded-t" />
                        <div className="w-1/6 h-4/5 bg-gray-200 dark:bg-gray-800 rounded-t" />
                        <div className="w-1/6 h-3/5 bg-gray-200 dark:bg-gray-800 rounded-t" />
                    </div>
                </div>
            )}

            {variant === 'list' && (
                <div className="space-y-2.5 my-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between h-10 px-3 rounded-xl bg-gray-100 dark:bg-gray-800/30">
                            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
                            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
                        </div>
                    ))}
                </div>
            )}

            {variant === 'card' && (
                <div className="space-y-3 my-4">
                    <div className="h-8 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg" />
                    <div className="h-3 w-48 bg-gray-100 dark:bg-gray-800/60 rounded" />
                </div>
            )}

            {variant === 'default' && (
                <div className="my-4 space-y-2">
                    <div className="h-6 w-1/2 bg-gray-200 dark:bg-gray-800 rounded-md" />
                    <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-800/50 rounded" />
                </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800/50 rounded" />
                <div className="h-3 w-12 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
        </div>
    );
};

export default WidgetSkeletonLoader;
