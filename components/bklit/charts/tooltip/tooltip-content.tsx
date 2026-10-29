import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatCurrencyAmount, toProperCase } from "../chart-formatters";

export interface TooltipRow {
  color: string;
  label: string;
  value: ReactNode;
}

export interface TooltipContentProps {
  title?: string;
  rows: TooltipRow[];
  /** Currency code for formatting numeric amounts (e.g. "EUR", "USD"). Default: "EUR" */
  currency?: string;
  /** Optional additional content (e.g., markers) */
  children?: ReactNode;
}

export interface TooltipHeaderProps {
  children: ReactNode;
  className?: string;
}

/**
 * Renders a row's value. If numeric, formats it using the application's
 * standard split-weight currency styling (§1.2 rule 1).
 */
function renderRowValue(value: ReactNode, currency: string = "EUR"): ReactNode {
  if (typeof value === "number") {
    const { sign, symbol, digits, fraction, rest } = formatCurrencyAmount(value, currency);
    return (
      <span className="tabular-nums text-sm font-medium whitespace-nowrap">
        {sign}
        {symbol && (
          <span className="text-chart-tooltip-muted mr-0.5 font-normal">
            {symbol}
          </span>
        )}
        <span className="text-chart-tooltip-foreground font-semibold">{digits}</span>
        {fraction && (
          <span className="text-chart-tooltip-muted text-xs font-normal">
            {fraction}
          </span>
        )}
        {rest}
      </span>
    );
  }
  return value;
}

/**
 * Popover-style header row: medium-weight label separated from the body by a
 * full-width border. Use it at the top of custom `ChartTooltip` `content`.
 */
export function TooltipHeader({ children, className }: TooltipHeaderProps) {
  return (
    <div
      className={cn(
        "border-b border-chart-tooltip-border px-3.5 py-2.5 text-left font-medium text-chart-tooltip-foreground text-sm",
        className
      )}
      style={{ borderBottomColor: "var(--chart-tooltip-border)" }}
    >
      {children}
    </div>
  );
}

TooltipHeader.displayName = "TooltipHeader";

export function TooltipContent({
  title,
  rows,
  currency = "EUR",
  children,
}: TooltipContentProps) {
  const hasBody = rows.length > 0 || Boolean(children);
  return (
    <div>
      {title && <TooltipHeader>{title}</TooltipHeader>}
      {hasBody && (
        <div className="px-3.5 py-3">
          {rows.length > 0 && (
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  className="flex items-center justify-between gap-6"
                  key={`${row.label}-${row.color}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="truncate text-chart-tooltip-muted text-sm">
                      {toProperCase(row.label)}
                    </span>
                  </div>
                  <span className="text-right font-medium text-chart-tooltip-foreground text-sm tabular-nums">
                    {renderRowValue(row.value, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {children && (
            <div
              className={cn(
                "transition-opacity duration-200 ease-out",
                rows.length > 0 && "mt-2"
              )}
            >
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

TooltipContent.displayName = "TooltipContent";

export default TooltipContent;
