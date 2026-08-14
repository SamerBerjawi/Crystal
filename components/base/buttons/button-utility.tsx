import type { ComponentPropsWithRef, FC, ReactNode } from "react";
import { cx } from "@/lib/utils/cx";
import { Tooltip } from "@/components/base/tooltip/tooltip";

export interface ButtonUtilityProps extends Omit<ComponentPropsWithRef<"button">, "color"> {
    size?: "xs" | "sm" | "md" | "lg";
    color?: "primary" | "secondary" | "tertiary" | "error";
    icon?: FC<{ className?: string }>;
    tooltip?: ReactNode;
    children?: ReactNode;
}

export const ButtonUtility = ({
    size = "sm",
    color = "tertiary",
    icon: Icon,
    tooltip,
    children,
    className,
    disabled,
    type = "button",
    ...props
}: ButtonUtilityProps) => {
    const sizeStyles = {
        xs: "size-7 text-xs p-1 rounded-lg",
        sm: "size-8 text-sm p-1.5 rounded-lg",
        md: "size-9 text-sm p-2 rounded-xl",
        lg: "size-10 text-base p-2.5 rounded-xl",
    };

    const iconSizes = {
        xs: "size-3.5",
        sm: "size-4",
        md: "size-4.5",
        lg: "size-5",
    };

    const colorStyles = {
        primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-xs active:bg-primary-800",
        secondary: "bg-white dark:bg-dark-card text-light-text dark:text-dark-text ring-1 ring-black/10 dark:ring-white/10 hover:bg-black/5 dark:hover:bg-white/5 shadow-xs",
        tertiary: "text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15",
        error: "text-red-600 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20",
    };

    const button = (
        <button
            type={type}
            disabled={disabled}
            className={cx(
                "group inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none select-none shrink-0",
                sizeStyles[size],
                colorStyles[color],
                className
            )}
            {...props}
        >
            {Icon && <Icon className={cx(iconSizes[size], "stroke-[2px] transition-transform group-hover:scale-110")} />}
            {children}
        </button>
    );

    if (tooltip && !disabled) {
        return <Tooltip title={tooltip}>{button}</Tooltip>;
    }

    return button;
};
