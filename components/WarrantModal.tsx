import React from 'react';
import InvestmentModal from './InvestmentModal';
import { Warrant } from '../types';

interface WarrantModalProps {
  onClose: () => void;
  onSave: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
  warrantToEdit?: Warrant | null;
}

const WarrantModal: React.FC<WarrantModalProps> = ({
  onClose,
  onSave,
  warrantToEdit,
}) => {
  return (
    <InvestmentModal
      onClose={onClose}
      onSaveGrant={onSave}
      warrantToEdit={warrantToEdit}
      initialMode="grant"
    />
  );
};

export default WarrantModal;
