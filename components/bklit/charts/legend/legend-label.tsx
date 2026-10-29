import { cn } from "@/lib/utils";
import { toProperCase } from "../chart-formatters";
import { useLegendItem } from "./legend-context";

export interface LegendLabelProps {
  /** Label class name. Default: "text-sm font-medium" */
  className?: string;
  /** Whether to format label in Proper Case. Default: true */
  properCase?: boolean;
}

export function LegendLabel({
  className = "text-sm font-medium",
  properCase = true,
}: LegendLabelProps) {
  const { item } = useLegendItem();

  return (
    <span className={cn("text-legend-foreground", className)}>
      {properCase ? toProperCase(item.label) : item.label}
    </span>
  );
}

LegendLabel.displayName = "LegendLabel";
