import React, { useRef, type PropsWithChildren } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  motion,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"
import type { MotionProps } from "motion/react"

import { cn } from "../../lib/utils"

export interface DockProps
  extends Omit<MotionProps & React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof dockVariants> {
  className?: string
  iconSize?: number
  iconMagnification?: number
  disableMagnification?: boolean
  iconDistance?: number
  direction?: "top" | "middle" | "bottom"
  children: React.ReactNode
}

const DEFAULT_SIZE = 36
const DEFAULT_MAGNIFICATION = 48
const DEFAULT_DISTANCE = 140
const DEFAULT_DISABLEMAGNIFICATION = false

interface DockContextType {
  mouseX: MotionValue<number>
  iconSize: number
  iconMagnification: number
  disableMagnification: boolean
  iconDistance: number
}

const DockContext = React.createContext<DockContextType | null>(null)

const dockVariants = cva(
  "supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 mx-auto mt-8 flex h-[58px] w-max items-center justify-center gap-2 rounded-2xl border p-2 backdrop-blur-md"
)

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  (
    {
      className,
      children,
      iconSize = DEFAULT_SIZE,
      iconMagnification = DEFAULT_MAGNIFICATION,
      disableMagnification = DEFAULT_DISABLEMAGNIFICATION,
      iconDistance = DEFAULT_DISTANCE,
      direction = "middle",
      ...props
    },
    ref
  ) => {
    const mouseX = useMotionValue(Infinity)

    const renderChildren = () => {
      return React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            mouseX,
            size: (child.props as any)?.size ?? iconSize,
            magnification: (child.props as any)?.magnification ?? iconMagnification,
            disableMagnification: (child.props as any)?.disableMagnification ?? disableMagnification,
            distance: (child.props as any)?.distance ?? iconDistance,
          })
        }
        return child
      })
    }

    return (
      <DockContext.Provider
        value={{
          mouseX,
          iconSize,
          iconMagnification,
          disableMagnification,
          iconDistance,
        }}
      >
        <motion.div
          ref={ref}
          onMouseMove={(e) => mouseX.set(e.clientX)}
          onMouseLeave={() => mouseX.set(Infinity)}
          {...props}
          className={cn(dockVariants({ className }), {
            "items-start": direction === "top",
            "items-center": direction === "middle",
            "items-end": direction === "bottom",
          })}
        >
          {renderChildren()}
        </motion.div>
      </DockContext.Provider>
    )
  }
)

Dock.displayName = "Dock"

export interface DockIconProps extends Omit<
  MotionProps & React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  size?: number
  magnification?: number
  disableMagnification?: boolean
  distance?: number
  mouseX?: MotionValue<number>
  className?: string
  children?: React.ReactNode
  props?: PropsWithChildren
}

const DockIcon = React.forwardRef<HTMLDivElement, DockIconProps>(
  (
    {
      size,
      magnification,
      disableMagnification,
      distance,
      mouseX,
      className,
      children,
      style,
      ...props
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLDivElement>(null)
    React.useImperativeHandle(forwardedRef, () => internalRef.current!)

    const context = React.useContext(DockContext)
    const defaultMouseX = useMotionValue(Infinity)

    const resolvedMouseX = mouseX ?? context?.mouseX ?? defaultMouseX
    const resolvedSize = size ?? context?.iconSize ?? DEFAULT_SIZE
    const resolvedMagnification = magnification ?? context?.iconMagnification ?? DEFAULT_MAGNIFICATION
    const resolvedDistance = distance ?? context?.iconDistance ?? DEFAULT_DISTANCE
    const resolvedDisableMagnification = disableMagnification ?? context?.disableMagnification ?? DEFAULT_DISABLEMAGNIFICATION

    const distanceCalc = useTransform(resolvedMouseX, (val: number) => {
      const bounds = internalRef.current?.getBoundingClientRect() ?? { x: 0, width: 0 }
      return val - bounds.x - bounds.width / 2
    })

    const targetSize = resolvedDisableMagnification ? resolvedSize : resolvedMagnification

    const sizeTransform = useTransform(
      distanceCalc,
      [-resolvedDistance, 0, resolvedDistance],
      [resolvedSize, targetSize, resolvedSize]
    )

    const scaleSize = useSpring(sizeTransform, {
      mass: 0.1,
      stiffness: 150,
      damping: 12,
    })

    return (
      <motion.div
        ref={internalRef}
        style={{ width: scaleSize, height: scaleSize, ...style }}
        className={cn(
          "flex aspect-square cursor-pointer items-center justify-center rounded-full p-0.5",
          resolvedDisableMagnification && "hover:bg-muted-foreground transition-colors",
          className
        )}
        {...props}
      >
        <div className="flex size-full items-center justify-center">{children}</div>
      </motion.div>
    )
  }
)

DockIcon.displayName = "DockIcon"

export interface DockSeparatorProps {
  className?: string
}

const DockSeparator: React.FC<DockSeparatorProps> = ({ className }) => (
  <div
    role="separator"
    aria-orientation="vertical"
    className={cn("mx-1 h-7 w-px self-center shrink-0 bg-line/80", className)}
  />
)

DockSeparator.displayName = "DockSeparator"

export { Dock, DockIcon, DockSeparator, dockVariants }
