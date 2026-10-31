import React from 'react';
import { Button } from './ui/Actions';
import { Dialog } from './ui/Overlays';

interface EditRecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditSingle: () => void;
  onEditSeries: () => void;
  onEditFuture?: () => void;
  title?: string;
  message?: string;
}

const EditRecurrenceModal: React.FC<EditRecurrenceModalProps> = ({ isOpen, onClose, onEditSingle, onEditSeries, onEditFuture, title = 'Edit a recurring item', message = 'Which payments do you want to change?' }) => (
  <Dialog isOpen={isOpen} onClose={onClose} title={title} footer={<div className="flex justify-end"><Button variant="ghost" onPress={onClose}>Cancel</Button></div>}>
    <p className="type-body mb-4 text-muted">{message}</p>
    <div className="flex flex-col gap-2">
      <Button onPress={onEditSingle}>Just this one</Button>
      {onEditFuture && <Button variant="secondary" onPress={onEditFuture}>This one and later</Button>}
      <Button variant="secondary" onPress={onEditSeries}>The whole series</Button>
    </div>
  </Dialog>
);

export default EditRecurrenceModal;
