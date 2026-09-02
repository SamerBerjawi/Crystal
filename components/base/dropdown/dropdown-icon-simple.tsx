import type { FC, ReactNode } from "react";
import { DotsThreeVertical as DotsVertical } from "@phosphor-icons/react";
import { Dropdown } from "./dropdown";

export interface DropdownIconSimpleProps {
    icon?: FC<{ className?: string }>;
    triggerAriaLabel?: string;
    className?: string;
    children?: ReactNode;
}

export const DropdownIconSimple = ({
    icon: Icon = DotsVertical,
    triggerAriaLabel = "More options",
    className,
    children,
}: DropdownIconSimpleProps) => {
    return (
        <Dropdown.Root>
            <Dropdown.DotsButton aria-label={triggerAriaLabel} className={className}>
                {Icon !== DotsVertical && <Icon className="size-5" />}
            </Dropdown.DotsButton>
            <Dropdown.Popover className="w-48">
                {children ? (
                    <Dropdown.Menu>{children}</Dropdown.Menu>
                ) : (
                    <Dropdown.Menu>
                        <Dropdown.Item label="Export table view" />
                        <Dropdown.Item label="Density settings" />
                        <Dropdown.Item label="Refresh feed" />
                    </Dropdown.Menu>
                )}
            </Dropdown.Popover>
        </Dropdown.Root>
    );
};
