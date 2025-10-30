import React, { useState, useRef } from 'react';
import { User } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_DANGER_STYLE } from '../constants';
import ConfirmationModal from '../components/ConfirmationModal';
import InviteUserModal from '../components/InviteUserModal';
import EditUserModal from '../components/EditUserModal';

interface UserManagementProps {
  currentUser: User;
  allUsers: User[];
  onUpdateUser: (email: string, updates: Partial<User>) => void;
  onDeleteUser: (email: string) => void;
  onInviteUser: (newUser: Pick<User, 'firstName' | 'lastName' | 'email'>) => void;
  onAdminPasswordReset: (email: string) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUser, allUsers, onUpdateUser, onDeleteUser, onInviteUser, onAdminPasswordReset }) => {
    const [isInviteModalOpen, setInviteModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState<User | null>(null);
    const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);


    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setActiveActionMenu(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (currentUser.role !== 'Administrator') {
        return (
            <Card>
                <div className="text-center py-12">
                    <span className="material-symbols-outlined text-5xl text-red-500 mb-2">lock</span>
                    <h3 className="text-xl font-bold">Access Denied</h3>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">You do not have permission to access this page.</p>
                </div>
            </Card>
        );
    }
    
    const handleEditClick = (user: User) => {
        setEditingUser(user);
        setEditModalOpen(true);
        setActiveActionMenu(null);
    }
    
    const handleDeleteClick = (user: User) => {
        setConfirmingDelete(user);
        setActiveActionMenu(null);
    };

    const handleToggleStatus = (user: User) => {
        onUpdateUser(user.email, { status: user.status === 'Active' ? 'Inactive' : 'Active' });
        setActiveActionMenu(null);
    };

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            {isInviteModalOpen && (
                <InviteUserModal 
                    onClose={() => setInviteModalOpen(false)}
                    onInvite={(newUser) => {
                        onInviteUser(newUser);
                        setInviteModalOpen(false);
                    }}
                />
            )}
            {isEditModalOpen && editingUser && (
                <EditUserModal 
                    user={editingUser}
                    onClose={() => setEditModalOpen(false)}
                    onSave={(email, updates) => {
                        onUpdateUser(email, updates);
                        setEditModalOpen(false);
                    }}
                />
            )}

            {confirmingDelete && (
                <ConfirmationModal
                    isOpen={!!confirmingDelete}
                    onClose={() => setConfirmingDelete(null)}
                    onConfirm={() => {
                        onDeleteUser(confirmingDelete.email);
                        setConfirmingDelete(null);
                    }}
                    title="Confirm User Deletion"
                    message={`Are you sure you want to delete the user "${confirmingDelete.firstName} ${confirmingDelete.lastName}" (${confirmingDelete.email})? This will also delete all their associated financial data. This action is irreversible.`}
                    confirmButtonText="Delete User"
                />
            )}
            
            <header>
                 <div className="flex items-center gap-4">
                    <button onClick={() => window.history.back()} className="text-light-text-secondary dark:text-dark-text-secondary p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        <span className="hover:underline cursor-pointer">Settings</span>
                        <span> / </span>
                        <span className="text-light-text dark:text-dark-text font-medium">User Management</span>
                    </div>
                </div>
                <div className="mt-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-light-text dark:text-dark-text">User Management</h2>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage users and their permissions.</p>
                    </div>
                    <button onClick={() => setInviteModalOpen(true)} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}>
                        <span className="material-symbols-outlined">person_add</span>
                        Invite User
                    </button>
                </div>
            </header>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-black/10 dark:border-white/10">
                                <th className="p-4 text-sm uppercase font-semibold text-light-text-secondary dark:text-dark-text-secondary">User</th>
                                <th className="p-4 text-sm uppercase font-semibold text-light-text-secondary dark:text-dark-text-secondary">Role</th>
                                <th className="p-4 text-sm uppercase font-semibold text-light-text-secondary dark:text-dark-text-secondary">Status</th>
                                <th className="p-4 text-sm uppercase font-semibold text-light-text-secondary dark:text-dark-text-secondary">Last Login</th>
                                <th className="p-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5">
                            {allUsers.map(user => (
                                <tr key={user.email}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-4">
                                            <img src={user.profilePictureUrl} alt="" className="w-10 h-10 rounded-full object-cover"/>
                                            <div>
                                                <p className="font-semibold text-light-text dark:text-dark-text">{user.firstName} {user.lastName} {user.email === currentUser.email && <span className="text-xs text-primary-500">(You)</span>}</p>
                                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-light-text dark:text-dark-text">{user.role}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>{user.status}</span>
                                    </td>
                                    <td className="p-4 text-light-text-secondary dark:text-dark-text-secondary">{new Date(user.lastLogin).toLocaleString()}</td>
                                    <td className="p-4 text-right">
                                        {user.email !== currentUser.email && (
                                            <div className="relative" ref={activeActionMenu === user.email ? actionMenuRef : null}>
                                                <button onClick={() => setActiveActionMenu(activeActionMenu === user.email ? null : user.email)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                                                    <span className="material-symbols-outlined">more_vert</span>
                                                </button>
                                                {activeActionMenu === user.email && (
                                                    <div className="absolute right-0 mt-2 w-48 bg-light-card dark:bg-dark-card rounded-md shadow-lg border border-black/5 dark:border-white/10 z-10 py-1">
                                                        <button onClick={() => handleEditClick(user)} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Edit</button>
                                                        <button onClick={() => handleToggleStatus(user)} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">{user.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
                                                        <button onClick={() => { onAdminPasswordReset(user.email); setActiveActionMenu(null); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Reset Password</button>
                                                        <div className="my-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                                                        <button onClick={() => handleDeleteClick(user)} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10">Delete</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default UserManagement;