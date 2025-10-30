import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { User } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface EditUserModalProps {
  user: User | null;
  onClose: () => void;
  onSave: (email: string, updates: Partial<User>) => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onSave }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      onSave(user.email, { firstName, lastName });
    }
  };

  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";

  if (!user) return null;

  return (
    <Modal onClose={onClose} title={`Edit User: ${user.firstName} ${user.lastName}`} zIndexClass="z-[60]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label htmlFor="edit-firstName" className={labelStyle}>First Name</label>
                <input
                    id="edit-firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={INPUT_BASE_STYLE}
                    required
                />
            </div>
            <div>
                <label htmlFor="edit-lastName" className={labelStyle}>Last Name</label>
                <input
                    id="edit-lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={INPUT_BASE_STYLE}
                    required
                />
            </div>
        </div>
        <div>
            <label className={labelStyle}>Email</label>
            <p className="p-2 text-light-text-secondary dark:text-dark-text-secondary">{user.email}</p>
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
          <button type="submit" className={BTN_PRIMARY_STYLE}>Save Changes</button>
        </div>
      </form>
    </Modal>
  );
};

export default EditUserModal;