
import React, { useState } from 'react';
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

    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary  tracking-wider mb-1.5";

    return (
        <Modal onClose={onClose} title={isEditing ? 'Edit Task' : 'New Task'}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/10 blur-[80px] rounded-full" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full" />
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-8 pb-4">
                
                {/* 1. Objective Concept Hero */}
                <div className="bg-white dark:bg-black/20 p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 flex flex-col items-center gap-6 shadow-sm">
                    <div className="flex bg-gray-100 dark:bg-white/10 p-1.5 rounded-2xl border border-black/5 dark:border-white/5 space-x-1 w-full max-w-sm">
                        {PRIORITIES.map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPriority(p)}
                                className={`flex-1 py-2.5 text-[10px] font-black  tracking-[0.2em] rounded-xl transition-all ${
                                    priority === p 
                                    ? `bg-white dark:bg-dark-card shadow-md ring-1 ring-black/5 ${p === 'High' ? 'text-rose-600' : p === 'Medium' ? 'text-amber-600' : 'text-blue-600'}`
                                    : 'text-gray-400 opacity-60'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <div className="w-full h-px bg-black/5 dark:bg-white/5" />

                    <div className="w-full space-y-2">
                        <label htmlFor="title" className="text-[10px] font-black  tracking-[0.3em] text-light-text-secondary dark:text-dark-text-secondary opacity-70 px-4">Objective Brief</label>
                        <input 
                            id="title" 
                            type="text" 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            className={`${INPUT_BASE_STYLE} !text-3xl font-black tracking-tight bg-transparent border-none p-4 focus:ring-0 placeholder-gray-300 dark:placeholder-gray-700 w-full text-center`} 
                            placeholder="Define the mission..."
                            required 
                            autoFocus 
                        />
                    </div>
                </div>

                {/* 2. Execution Logistics */}
                <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-8">
                    <h4 className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-500 text-lg">settings_suggest</span>
                        Operational Configuration
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className={labelStyle}>Deployment Status</label>
                            <div className="flex bg-white dark:bg-black/20 p-1 rounded-xl border border-black/5 dark:border-white/5">
                                {STATUSES.map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setStatus(s)}
                                        className={`flex-1 py-2 text-[9px] font-black  tracking-widest rounded-lg transition-all ${
                                            status === s 
                                            ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' 
                                            : 'text-gray-400 opacity-60'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="dueDate" className={labelStyle}>Maturity Event (Due Date)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-lg">event</span>
                                <input 
                                    id="dueDate" 
                                    type="date" 
                                    value={dueDate} 
                                    onChange={e => {
                                        setDueDate(e.target.value);
                                        if (!e.target.value) setReminderDate('');
                                    }} 
                                    className={`${INPUT_BASE_STYLE} font-black h-12 pl-12  tracking-widest`} 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label htmlFor="reminderDate" className={labelStyle}>Notification / Recall</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-lg">notifications_active</span>
                                <input 
                                    id="reminderDate" 
                                    type="date" 
                                    value={reminderDate} 
                                    onChange={e => setReminderDate(e.target.value)} 
                                    className={`${INPUT_BASE_STYLE} font-black h-12 pl-12  tracking-widest disabled:opacity-20 transition-all`} 
                                    disabled={!dueDate}
                                    max={dueDate}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className={labelStyle}>Contextual Account</label>
                            <div className="bg-white/50 dark:bg-black/20 p-3 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between">
                                <span className="text-[10px] font-black  tracking-widest text-light-text-secondary/60">Auto-Linked Assets</span>
                                <span className="material-symbols-outlined text-emerald-500 text-lg">link</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="description" className={labelStyle}>Supplemental Directives</label>
                        <textarea 
                            id="description" 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            className={`${INPUT_BASE_STYLE} min-h-[120px] !text-sm leading-relaxed p-6 bg-white dark:bg-black/20 border-black/5 dark:border-white/5 focus:ring-1 focus:ring-primary-500/20`} 
                            rows={3}
                            placeholder="Specify detailed context or sub-tasks here..."
                        ></textarea>
                    </div>
                </div>
                
                <div className="flex justify-between items-center pt-6 border-t border-black/5 dark:border-white/5">
                    <div className="w-32">
                        {isEditing && (
                            <button type="button" onClick={handleDeleteClick} className="h-12 px-6 text-[10px] font-black  tracking-widest text-rose-500 hover:bg-rose-500/5 rounded-xl transition-all active:scale-95">Purge Objective</button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-12 px-8  tracking-widest text-[10px] font-black`}>Retract</button>
                        <button type="submit" className={`${BTN_PRIMARY_STYLE} h-12 px-10 gap-3 group animate-glow  tracking-widest text-[10px] font-black`}>
                            {isEditing ? 'Commit Changes' : 'Initialize Objective'}
                            <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">rocket_launch</span>
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default TaskModal;
