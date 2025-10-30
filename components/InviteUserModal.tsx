import React, { useState } from 'react';
import Modal from './Modal';
import { User } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface InviteUserModalProps {
  onClose: () => void;
  onInvite: (newUser: Pick<User, 'firstName' | 'lastName' | 'email'>) => void;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({ onClose, onInvite }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onInvite({ firstName, lastName, email });
    };

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    
    return (
        <Modal onClose={onClose} title="Invite New User" zIndexClass="z-[60]">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    The new user will be created with the 'Member' role and a temporary password will be generated.
                </p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="firstName" className={labelStyle}>First Name</label>
                        <input
                            id="firstName"
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className={INPUT_BASE_STYLE}
                            required
                            autoFocus
                        />
                    </div>
                    <div>
                        <label htmlFor="lastName" className={labelStyle}>Last Name</label>
                        <input
                            id="lastName"
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className={INPUT_BASE_STYLE}
                            required
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="email" className={labelStyle}>Email Address</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={INPUT_BASE_STYLE}
                        required
                    />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>Send Invitation</button>
                </div>
            </form>
        </Modal>
    );
};

export default InviteUserModal;