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
}

const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, availableWidgets, onAddWidget }) => (
  <Dialog isOpen={isOpen} onClose={onClose} title="Add a widget" description="It goes at the end of your Overview, and you can move it from there.">
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
      <EmptyState icon="dashboard-square-add" title="Every widget is on show" description="Remove one from Overview to add it again later." className="py-8" />
    )}
  </Dialog>
);

export default AddWidgetModal;
