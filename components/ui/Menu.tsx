import React, { useRef, useState } from 'react';
import {
  Menu as AriaMenu,
  MenuItem,
  MenuTrigger,
  Popover as AriaPopover,
  Separator,
} from 'react-aria-components';
import Icon from './Icon';
import { BottomSheet, popoverStyles } from './Overlays';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cn } from '../../lib/utils';

export interface MenuAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  isDestructive?: boolean;
  isDisabled?: boolean;
  /** Draws a line above this item. */
  startsGroup?: boolean;
  onAction: () => void;
}

const itemStyles = (destructive?: boolean) => cn(
  'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 outline-none pointer-coarse:min-h-11 max-md:min-h-12 data-[focused]:bg-inset data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
  destructive ? 'text-money-out' : 'text-ink'
);

const menuItems = (items: MenuAction[]) => items.flatMap(item => [
  ...(item.startsGroup ? [<Separator key={`${item.id}-line`} className="mx-2.5 my-1.5 border-t border-line" />] : []),
  <MenuItem key={item.id} id={item.id} textValue={item.label} isDisabled={item.isDisabled} className={itemStyles(item.isDestructive)}>
    {item.icon && <Icon name={item.icon} size={20} className="shrink-0" />}
    <span className="type-body min-w-0 flex-1 truncate">{item.label}</span>
    {item.shortcut && <kbd className="type-caption shrink-0 text-muted max-md:hidden">{item.shortcut}</kbd>}
  </MenuItem>,
]);

/** Actions, not values, with icons and shortcuts. Destructive items go last. A bottom sheet on phones. */
export const Menu: React.FC<{
  trigger: React.ReactElement;
  title: string;
  items: MenuAction[];
  placement?: React.ComponentProps<typeof AriaPopover>['placement'];
  /** Extra content above the items, such as who is signed in. */
  header?: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ trigger, title, items, placement = 'bottom end', header, footer }) => {
  const isPhone = useIsMobile();
  const [isOpen, setOpen] = useState(false);

  const list = (
    <AriaMenu
      aria-label={title}
      autoFocus={isPhone ? undefined : 'first'}
      onAction={id => {
        setOpen(false);
        items.find(item => item.id === id)?.onAction();
      }}
      className="outline-none"
    >
      {menuItems(items)}
    </AriaMenu>
  );

  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={setOpen}>
      {trigger}
      {isPhone ? (
        <BottomSheet isOpen={isOpen} onClose={() => setOpen(false)} title={title}>
          {header}
          {list}
          {footer}
        </BottomSheet>
      ) : (
        <AriaPopover placement={placement} offset={8} className={cn(popoverStyles, 'min-w-[220px] max-w-[320px] p-1.5')}>
          {header}
          <div className="max-h-[calc(40px*12+12px)] overflow-y-auto">{list}</div>
          {footer}
        </AriaPopover>
      )}
    </MenuTrigger>
  );
};

/** A menu that opens where the pointer is, for right-click. It closes on choosing, Escape or a click outside. */
export const PointerMenu: React.FC<{
  point: { x: number; y: number };
  title: string;
  items: MenuAction[];
  onClose: () => void;
}> = ({ point, title, items, onClose }) => {
  const anchor = useRef<HTMLSpanElement>(null);

  return (
    <>
      <span ref={anchor} aria-hidden="true" className="pointer-events-none fixed size-px" style={{ left: point.x, top: point.y }} />
      <AriaPopover triggerRef={anchor} isOpen onOpenChange={open => { if (!open) onClose(); }} placement="bottom start" offset={4} className={cn(popoverStyles, 'min-w-56 max-w-80 p-1.5')}>
        <p className="type-caption truncate px-2.5 pb-1 pt-1.5 text-muted">{title}</p>
        <AriaMenu
          aria-label={title}
          autoFocus="first"
          onAction={id => { onClose(); items.find(item => item.id === id)?.onAction(); }}
          className="outline-none"
        >
          {menuItems(items)}
        </AriaMenu>
      </AriaPopover>
    </>
  );
};
