import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { getApiBaseUrl } from '../utils';
import ConfirmationModal from '../components/ConfirmationModal';
import InviteUserModal from '../components/InviteUserModal';
import EditUserModal from '../components/EditUserModal';

const API_BASE_URL = getApiBaseUrl();

interface UserManagementProps {
  currentUser: User;
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUser }) => {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isInviteModalOpen, setInviteModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState<User | null>(null);
    const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const fetchUsers = useCallback(async () => {
        const token = localStorage.getItem('finaura_token');
        try {
            const res = await fetch(`${API_BASE_URL}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const users = await res.json();
                setAllUsers(users.map((u: any) => ({...u, firstName: u.first_name, lastName: u.last_name, profilePictureUrl: u.profile_picture_url, is2FAEnabled: u.is_2fa_enabled, lastLogin: u.last_login })));
            } else {
                console.error("Failed to fetch users");
            }
        } catch (error) {
            console.error("Error fetching users", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setActiveActionMenu(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const makeApiCall = async (endpoint: string, method: string, body?: any) => {
        const token = localStorage.getItem('finaura_token');
        try {
            const res = await fetch(`${API_BASE_URL}${endpoint}`, {
                method,
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                fetchUsers(); // Refresh data on success
                return await res.json();
            } else {
                const error = await res.json();
                alert(`Error: ${error.message}`);
                return null;
            }
        } catch (error) {
            alert('An unexpected error occurred.');
            return null;
        }
    };
    
    const onInviteUser = (newUser: Pick<User, 'firstName' | 'lastName' | 'email' | 'role'>) => {
        // This is not implemented on the backend yet, but the structure is here.
        alert("Invite user functionality not fully implemented on backend.");
    };
    const onUpdateUser = (email: string, updates: Partial<User>) => makeApiCall(`/users/${email}`, 'PUT', updates);
    const onDeleteUser = (email: string) => makeApiCall(`/users/${email}`, 'DELETE');
    const onAdminPasswordReset = async (email: string) => {
        const result = await makeApiCall(`/users/${email}/reset-password`, 'POST');
        if (result && result.message) {
            alert(result.message);
        }
    };

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

    const handleToggleAdmin = (user: User) => {
        onUpdateUser(user.email, { role: user.role === 'Administrator' ? 'Member' : 'Administrator' });
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

            <Card className="p-0">
                <table className="w-full text-left table-fixed">
                    <thead>
                        <tr className="border-b border-black/10 dark:border-white/10">
                            <th className="p-4 text-sm uppercase font-semibold text-light-text-secondary dark:text-dark-text-secondary w-[35%]">User</th>
                            <th className="p-4 text-sm uppercase font-semibold text-light-text-secondary dark:text-dark-text-secondary w-[15%]">Role</th>
                            <th className="p-4 text-sm uppercase font-semibold text-light-text-secondary dark:text-dark-text-secondary w-[15%]">Status</th>
                            <th className="p-4 text-sm uppercase font-semibold text-light-text-secondary dark:text-dark-text-secondary w-[25%]">Last Login</th>
                            <th className="p-4 w-[10%] text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {allUsers.map(user => (
                            <tr key={user.email} className={activeActionMenu === user.email ? 'relative z-10' : ''}>
                                <td className="p-4 align-middle">
                                    <div className="flex items-center gap-4">
                                        <img src={user.profilePictureUrl} alt="" className="w-10 h-10 rounded-full object-cover"/>
                                        <div>
                                            <p className="font-semibold text-light-text dark:text-dark-text">{user.firstName} {user.lastName} {user.email === currentUser.email && <span className="text-xs text-primary-500">(You)</span>}</p>
                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-light-text dark:text-dark-text align-middle">{user.role}</td>
                                <td className="p-4 align-middle">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>{user.status}</span>
                                </td>
                                <td className="p-4 text-light-text-secondary dark:text-dark-text-secondary align-middle">{new Date(user.lastLogin).toLocaleString()}</td>
                                <td className="p-4 text-right align-middle">
                                    {user.email !== currentUser.email && (
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleEditClick(user)} className={`${BTN_SECONDARY_STYLE} !py-1 !px-3 !text-sm`}>
                                                Edit
                                            </button>
                                            <div ref={activeActionMenu === user.email ? actionMenuRef : null}>
                                                <button onClick={() => setActiveActionMenu(activeActionMenu === user.email ? null : user.email)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                                                    <span className="material-symbols-outlined">more_vert</span>
                                                </button>
                                                {activeActionMenu === user.email && (
                                                    <div className="absolute right-0 mt-2 w-56 bg-light-card dark:bg-dark-card rounded-md shadow-lg border border-black/5 dark:border-white/10 z-20 py-1">
                                                        <button onClick={() => handleToggleAdmin(user)} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">{user.role === 'Administrator' ? 'Revoke Admin' : 'Make Administrator'}</button>
                                                        <button onClick={() => handleToggleStatus(user)} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">{user.status === 'Active' ? 'Deactivate User' : 'Activate User'}</button>
                                                        <button onClick={() => { onAdminPasswordReset(user.email); setActiveActionMenu(null); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Reset Password</button>
                                                        <div className="my-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                                                        <button onClick={() => handleDeleteClick(user)} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10">Delete User</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
};

export default UserManagement;
