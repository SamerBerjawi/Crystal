import { type ComponentPropsWithoutRef, type ReactNode } from "react"
import { ArrowRightIcon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import AppIcon from "@/components/ui/Icon"

export interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode
  className?: string
}

export interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
  name?: string
  className?: string
  background?: ReactNode
  Icon?: React.ElementType | string | ReactNode
  description?: string
  href?: string
  cta?: string
  children?: ReactNode
  header?: ReactNode
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-3 gap-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  children,
  header,
  ...props
}: BentoCardProps) => {
  const renderIcon = () => {
    if (!Icon) return null
    if (typeof Icon === "string") {
      return (
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-500 border border-primary-500/20 origin-left transform-gpu transition-all duration-300 ease-in-out group-hover:scale-90">
          <AppIcon name={Icon} className="text-2xl" />
        </div>
      )
    }
    if (typeof Icon === "function") {
      const IconComponent = Icon as React.ElementType
      return (
        <IconComponent className="h-12 w-12 origin-left transform-gpu text-neutral-700 dark:text-neutral-300 transition-all duration-300 ease-in-out group-hover:scale-75" />
      )
    }
    return <>{Icon}</>
  }

  return (
    <div
      key={name}
      className={cn(
        "group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-3xl",
        // light styles
        "bg-white text-light-text [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)] border border-black/5",
        // dark styles
        "dark:bg-dark-card dark:text-dark-text transform-gpu dark:[box-shadow:0_-20px_80px_-20px_#ffffff14_inset] dark:border-white/5",
        className
      )}
      {...props}
    >
      {background && <div className="absolute inset-0 -z-1 overflow-hidden">{background}</div>}

      {children ? (
        <div className="relative z-10 flex flex-col justify-between h-full w-full p-6">
          {children}
        </div>
      ) : (
        <>
          {header && <div className="relative z-10">{header}</div>}
          <div className="p-6 relative z-10 flex flex-col justify-between h-full">
            <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-2 transition-all duration-300 lg:group-hover:-translate-y-6">
              {renderIcon()}
              {name && (
                <h3 className="text-xl font-bold tracking-tight text-light-text dark:text-dark-text">
                  {name}
                </h3>
              )}
              {description && (
                <p className="max-w-lg text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  {description}
                </p>
              )}
            </div>

            {cta && (
              <>
                <div
                  className={cn(
                    "pointer-events-none flex w-full translate-y-0 transform-gpu flex-row items-center transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:hidden mt-4"
                  )}
                >
                  <Button
                    variant="link"
                    size="sm"
                    className="pointer-events-auto p-0 text-primary-500 font-semibold"
                    {...(href ? { render: <a href={href} />, nativeButton: false } : {})}
                  >
                    {cta}
                    <ArrowRightIcon className="ms-2 h-4 w-4 rtl:rotate-180" />
                  </Button>
                </div>

                <div
                  className={cn(
                    "pointer-events-none absolute bottom-0 hidden w-full translate-y-10 transform-gpu flex-row items-center p-6 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:flex"
                  )}
                >
                  <Button
                    variant="link"
                    size="sm"
                    className="pointer-events-auto p-0 text-primary-500 font-semibold"
                    {...(href ? { render: <a href={href} />, nativeButton: false } : {})}
                  >
                    {cta}
                    <ArrowRightIcon className="ms-2 h-4 w-4 rtl:rotate-180" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/[0.02] group-hover:dark:bg-white/[0.02]" />
    </div>
  )
}

export { BentoCard, BentoGrid }
