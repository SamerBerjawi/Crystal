import React from 'react';
import { Widget } from '../types';
import Icon from './ui/Icon';
import { Row } from './ui/Display';
import { Dialog } from './ui/Overlays';
import { EmptyState } from './ui/States';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableWidgets: Widget[];
  onAddWidget: (widgetId: string) => void;
  /** The view being edited, named in the dialog. */
  viewLabel?: string;
}

const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, availableWidgets, onAddWidget, viewLabel }) => (
  <Dialog isOpen={isOpen} onClose={onClose} title="Add a widget" description={viewLabel ? `Widgets that belong on ${viewLabel}. It goes at the end, and you can move it from there.` : 'It goes at the end of your Overview, and you can move it from there.'}>
    {availableWidgets.length > 0 ? (
      <div className="-mx-2 divide-y divide-line">
        {availableWidgets.map(widget => (
          <Row
            key={widget.id}
            title={widget.name}
            context={widget.description}
            leading={<span className="flex size-9 items-center justify-center rounded-full bg-inset text-muted"><Icon name={widget.icon || 'dashboard-square-add'} size={18} /></span>}
            trailing={<Icon name="add-01" size={18} className="text-muted" />}
            onPress={() => { onAddWidget(widget.id); onClose(); }}
          />
        ))}
      </div>
    ) : (
      <EmptyState icon="dashboard-square-add" title="Every widget is on show" description={viewLabel ? `Remove one from ${viewLabel} to add it again later.` : 'Remove one from Overview to add it again later.'} className="py-8" />
    )}
  </Dialog>
);

export default AddWidgetModal;
