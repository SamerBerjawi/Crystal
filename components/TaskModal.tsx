
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Task, TaskPriority, TaskStatus } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE } from '../constants';

interface TaskModalProps {
  onClose: () => void;
  onSave: (task: Omit<Task, 'id'> & { id?: string }) => void;
  onDelete: (id: string) => void;
  task?: Task | null;
}

const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High'];
const STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Done'];

const TaskModal: React.FC<TaskModalProps> = ({ onClose, onSave, onDelete, task }) => {
    const isEditing = !!task;
    const [title, setTitle] = useState(task?.title || '');
    const [description, setDescription] = useState(task?.description || '');
    const [dueDate, setDueDate] = useState(task?.dueDate || '');
    const [reminderDate, setReminderDate] = useState(task?.reminderDate || '');
    const [status, setStatus] = useState<TaskStatus>(task?.status || 'To Do');
    const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'Medium');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: task?.id, title, description, dueDate, status, priority, reminderDate: dueDate ? reminderDate : '' });
    };

    const handleDeleteClick = () => {
        if (task?.id) {
            onDelete(task.id);
        }
    };

    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";

    return (
        <Modal onClose={onClose} title={isEditing ? 'Edit Task' : 'New Task'}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="title" className={labelStyle}>Title</label>
                    <input 
                        id="title" 
                        type="text" 
                        value={title} 
                        onChange={e => setTitle(e.target.value)} 
                        className={`${INPUT_BASE_STYLE} !text-lg font-semibold`} 
                        placeholder="What needs to be done?"
                        required 
                        autoFocus 
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className={labelStyle}>Priority</label>
                        <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg">
                            {PRIORITIES.map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPriority(p)}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                        priority === p 
                                        ? (p === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : p === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300')
                                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className={labelStyle}>Status</label>
                        <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg">
                            {STATUSES.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setStatus(s)}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                        status === s 
                                        ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' 
                                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="dueDate" className={labelStyle}>Due Date</label>
                            <input 
                                id="dueDate" 
                                type="date" 
                                value={dueDate} 
                                onChange={e => {
                                    setDueDate(e.target.value);
                                    if (!e.target.value) setReminderDate('');
                                }} 
                                className={INPUT_BASE_STYLE} 
                            />
                        </div>
                        <div>
                            <label htmlFor="reminderDate" className={labelStyle}>Reminder</label>
                            <input 
                                id="reminderDate" 
                                type="date" 
                                value={reminderDate} 
                                onChange={e => setReminderDate(e.target.value)} 
                                className={`${INPUT_BASE_STYLE} disabled:opacity-50 disabled:cursor-not-allowed`} 
                                disabled={!dueDate}
                                max={dueDate}
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label htmlFor="description" className={labelStyle}>Notes</label>
                    <textarea 
                        id="description" 
                        value={description} 
                        onChange={e => setDescription(e.target.value)} 
                        className={INPUT_BASE_STYLE} 
                        rows={3}
                        placeholder="Add details..."
                    ></textarea>
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-black/10 dark:border-white/10 mt-4">
                    <div>
                        {isEditing && (
                            <button type="button" onClick={handleDeleteClick} className={BTN_DANGER_STYLE}>Delete</button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                        <button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Add Task'}</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default TaskModal;
