import React from 'react';
import Modal from './Modal';
import { Widget } from '../types';
import Icon from './ui/Icon';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableWidgets: Widget[];
  onAddWidget: (widgetId: string) => void;
}

const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, availableWidgets, onAddWidget }) => {
  if (!isOpen) return null;
  
  const handleAdd = (widgetId: string) => {
    onAddWidget(widgetId);
    onClose();
  };

  return (
    <Modal onClose={onClose} title="Add Dashboard Widget">
      <div className="space-y-2.5">
        {availableWidgets.length > 0 ? (
          availableWidgets.map(widget => (
            <button
              key={widget.id}
              onClick={() => handleAdd(widget.id)}
              className="w-full text-left p-3.5 rounded-2xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 hover:border-primary-500/30 hover:bg-primary-500/5 transition-all text-xs font-bold flex items-center justify-between group active:scale-98 cursor-pointer"
            >
              <span className="text-light-text dark:text-dark-text group-hover:text-primary-500 transition-colors">{widget.name}</span>
              <Icon name="add" className="text-gray-400 group-hover:text-primary-500 group-hover:scale-110 transition-transform text-lg" />
            </button>
          ))
        ) : (
          <p className="text-center text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary py-6">
            All available widgets are already on display.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default AddWidgetModal;