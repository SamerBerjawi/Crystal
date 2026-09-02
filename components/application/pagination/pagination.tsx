import React from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { cx } from "@/lib/utils/cx";

export interface PaginationPageMinimalCenterProps {
    page: number;
    total: number;
    onPageChange?: (page: number) => void;
    className?: string;
    totalItems?: number;
    itemsPerPage?: number;
    onItemsPerPageChange?: (itemsPerPage: number) => void;
}

export const PaginationPageMinimalCenter: React.FC<PaginationPageMinimalCenterProps> = ({
    page,
    total,
    onPageChange,
    className,
    totalItems,
    itemsPerPage,
    onItemsPerPageChange,
}) => {
    const canPrev = page > 1;
    const canNext = page < total;

    return (
        <div
            className={cx(
                "flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-secondary bg-primary px-4 py-3 md:px-6 md:pt-3 md:pb-4",
                className
            )}
        >
            {/* Left / Prev Button */}
            <div className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-3 order-2 sm:order-1">
                <button
                    type="button"
                    disabled={!canPrev}
                    onClick={() => canPrev && onPageChange?.(page - 1)}
                    className={cx(
                        "inline-flex items-center gap-2 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm font-semibold text-secondary shadow-xs transition duration-150 ease-linear cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                        "hover:bg-secondary active:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary"
                    )}
                >
                    <ArrowLeft className="size-4 stroke-[2px]" />
                    <span>Previous</span>
                </button>

                {/* Mobile Page indicator */}
                <span className="sm:hidden text-xs font-medium text-tertiary">
                    Page {page} of {Math.max(1, total)}
                </span>

                <button
                    type="button"
                    disabled={!canNext}
                    onClick={() => canNext && onPageChange?.(page + 1)}
                    className={cx(
                        "sm:hidden inline-flex items-center gap-2 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm font-semibold text-secondary shadow-xs transition duration-150 ease-linear cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                        "hover:bg-secondary active:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary"
                    )}
                >
                    <span>Next</span>
                    <ArrowRight className="size-4 stroke-[2px]" />
                </button>
            </div>

            {/* Center: Page Info & Total records */}
            <div className="hidden sm:flex items-center gap-3 order-1 sm:order-2">
                <span className="text-sm font-medium text-tertiary">
                    Page <span className="font-semibold text-primary">{page}</span> of{" "}
                    <span className="font-semibold text-primary">{Math.max(1, total)}</span>
                </span>
                {typeof totalItems === "number" && (
                    <>
                        <span className="text-tertiary opacity-40">•</span>
                        <span className="text-xs font-medium text-quaternary">
                            {totalItems} total records
                        </span>
                    </>
                )}
            </div>

            {/* Right: Next Button and Optional Page Size Selector */}
            <div className="hidden sm:flex items-center gap-3 order-3">
                {itemsPerPage && onItemsPerPageChange && (
                    <div className="flex items-center gap-2 mr-2">
                        <span className="text-xs text-quaternary font-medium">Show</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                            className="text-xs font-semibold rounded-lg border border-secondary bg-primary px-2 py-1.5 text-secondary outline-none cursor-pointer focus:ring-1 focus:ring-primary-500"
                        >
                            <option value={15}>15</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                )}
                <button
                    type="button"
                    disabled={!canNext}
                    onClick={() => canNext && onPageChange?.(page + 1)}
                    className={cx(
                        "inline-flex items-center gap-2 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm font-semibold text-secondary shadow-xs transition duration-150 ease-linear cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                        "hover:bg-secondary active:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary"
                    )}
                >
                    <span>Next</span>
                    <ArrowRight className="size-4 stroke-[2px]" />
                </button>
            </div>
        </div>
    );
};
