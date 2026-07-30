import { cn } from "@/lib/utils"

export interface AnimatedCircularProgressBarProps {
  max?: number
  min?: number
  value?: number
  gaugePrimaryColor?: string
  gaugeSecondaryColor?: string
  className?: string
}

export function AnimatedCircularProgressBar({
  max = 100,
  min = 0,
  value,
  gaugePrimaryColor = "var(--primary-500, #6366f1)",
  gaugeSecondaryColor = "rgba(128, 128, 128, 0.15)",
  className,
}: AnimatedCircularProgressBarProps) {
  const isIndeterminate = value === undefined
  const displayValue = isIndeterminate ? 65 : value
  const circumference = 2 * Math.PI * 45
  const percentPx = circumference / 100
  const currentPercent = Math.round(((displayValue - min) / (max - min)) * 100)

  return (
    <div
      className={cn(
        "relative size-16 text-xs font-bold flex items-center justify-center shrink-0",
        isIndeterminate && "animate-spin duration-1000",
        className
      )}
      style={
        {
          "--circle-size": "100px",
          "--circumference": circumference,
          "--percent-to-px": `${percentPx}px`,
          "--gap-percent": "5",
          "--offset-factor": "0",
          "--transition-length": "1s",
          "--transition-step": "200ms",
          "--delay": "0s",
          "--percent-to-deg": "3.6deg",
          transform: "translateZ(0)",
        } as React.CSSProperties
      }
    >
      <svg
        fill="none"
        className="size-full"
        strokeWidth="2"
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="45"
          strokeWidth="8"
          strokeDashoffset="0"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-30"
          style={{ stroke: gaugeSecondaryColor }}
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          strokeWidth="8"
          strokeDashoffset="0"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-100"
          style={
            {
              stroke: gaugePrimaryColor,
              "--stroke-percent": currentPercent,
              strokeDasharray:
                "calc(var(--stroke-percent) * var(--percent-to-px)) var(--circumference)",
              transition:
                "var(--transition-length) ease var(--delay),stroke var(--transition-length) ease var(--delay)",
              transitionProperty: "stroke-dasharray,transform",
              transform:
                "rotate(calc(-90deg + var(--gap-percent) * var(--offset-factor) * var(--percent-to-deg)))",
              transformOrigin:
                "calc(var(--circle-size) / 2) calc(var(--circle-size) / 2)",
            } as React.CSSProperties
          }
        />
      </svg>
      {!isIndeterminate && (
        <span
          data-current-value={currentPercent}
          className="animate-in fade-in absolute inset-0 m-auto size-fit font-mono font-black"
        >
          {currentPercent}%
        </span>
      )}
    </div>
  )
}

export default AnimatedCircularProgressBar;
