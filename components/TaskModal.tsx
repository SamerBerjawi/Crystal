import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Task, TaskPriority, TaskStatus } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import Icon from './ui/Icon';

interface TaskModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id'> & { id?: string }) => void;
  onDelete: (id: string) => void;
  task?: Task | null;
}

const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High'];
const STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Done'];

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; bg: string; icon: string }> = {
  Low: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: 'low_priority' },
  Medium: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: 'flag' },
  High: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', icon: 'priority_high' },
};

const STATUS_CONFIG: Record<TaskStatus, { color: string; icon: string }> = {
  'To Do': { color: 'text-gray-500', icon: 'radio_button_unchecked' },
  'In Progress': { color: 'text-amber-500', icon: 'timelapse' },
  Done: { color: 'text-emerald-500', icon: 'check_circle' },
};

const TaskModal: React.FC<TaskModalProps> = ({ isOpen = true, onClose, onSave, onDelete, task }) => {
  const isEditing = !!task;
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [reminderDate, setReminderDate] = useState(task?.reminderDate || '');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'To Do');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'Medium');

  // Animation state
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setDueDate(task.dueDate || '');
      setReminderDate(task.reminderDate || '');
      setStatus(task.status || 'To Do');
      setPriority(task.priority || 'Medium');
    } else {
      setTitle('');
      setDescription('');
      setDueDate('');
      setReminderDate('');
      setStatus('To Do');
      setPriority('Medium');
    }

    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
  }, [task, isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please specify an objective title for this task.');
      return;
    }

    onSave({
      id: task?.id,
      title: title.trim(),
      description: description.trim(),
      dueDate,
      status,
      priority,
      reminderDate: dueDate ? reminderDate : '',
    });
    handleClose();
  };

  const handleDeleteClick = () => {
    if (task?.id) {
      onDelete(task.id);
      handleClose();
    }
  };

  const labelStyle =
    'block text-2xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5';

  const content = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Slide-out Sidebar Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 pointer-events-none">
        <div
          className={`pointer-events-auto w-screen max-w-full sm:max-w-xl md:max-w-2xl h-screen bg-white/90 dark:bg-[#16171a]/90 backdrop-blur-2xl text-light-text dark:text-white shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col justify-between transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ambient Top Glow */}
          <div className="absolute top-0 right-0 left-0 h-40 bg-gradient-to-b from-primary-500/10 via-emerald-500/5 to-transparent pointer-events-none" />

          {/* Header matching CategoryModal */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary-500/20 to-emerald-500/20 text-primary-500 flex items-center justify-center border border-primary-500/30 shadow-md">
                <Icon name={isEditing ? 'edit_note' : 'task_alt'} className="text-2xl" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                    {isEditing ? 'Edit Task' : 'New Task'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                    {priority}
                  </span>
                </div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  Operational milestones, reminders & action items
                </p>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close drawer"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          {/* 2. PRIORITY SELECTOR TOP RIBBON */}
          <div className="px-6 pt-4 pb-2 shrink-0">
            <div className="p-1 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center gap-1 border border-black/5 dark:border-white/5">
              {PRIORITIES.map((p) => {
                const isSelected = priority === p;
                const cfg = PRIORITY_CONFIG[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isSelected
                        ? `bg-white dark:bg-dark-card ${cfg.color} shadow-sm border border-black/5 dark:border-white/10`
                        : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <Icon name={cfg.icon} className="text-sm" />
                    <span>{p} Priority</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. SCROLLABLE FORM BODY */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar">
            <form id="task-drawer-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Objective Title Hero Card */}
              <div className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                <label htmlFor="task-title" className={labelStyle}>
                  Objective Title
                </label>
                <input
                  id="task-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`${INPUT_BASE_STYLE} !h-14 !text-xl font-bold tracking-tight bg-white dark:bg-white/[0.03]`}
                  placeholder="Define mission goal..."
                  required
                  autoFocus
                />
              </div>

              {/* Lifecycle & Status Card */}
              <div className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                <div>
                  <label className={labelStyle}>Execution Status</label>
                  <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5">
                    {STATUSES.map((s) => {
                      const isSelected = status === s;
                      const cfg = STATUS_CONFIG[s];
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(s)}
                          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm border border-black/5 dark:border-white/10'
                              : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}
                        >
                          <Icon name={cfg.icon} className="text-sm" />
                          <span>{s}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scheduling Parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-black/5 dark:border-white/5">
                  <div>
                    <label htmlFor="task-dueDate" className={labelStyle}>
                      Maturity Event (Due Date)
                    </label>
                    <div className="relative">
                      <Icon
                        name="event"
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base"
                      />
                      <input
                        id="task-dueDate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => {
                          setDueDate(e.target.value);
                          if (!e.target.value) setReminderDate('');
                        }}
                        className={`${INPUT_BASE_STYLE} h-11 pl-10 font-medium`}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="task-reminderDate" className={labelStyle}>
                      Notification / Recall Alert
                    </label>
                    <div className="relative">
                      <Icon
                        name="notifications_active"
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base"
                      />
                      <input
                        id="task-reminderDate"
                        type="date"
                        value={reminderDate}
                        onChange={(e) => setReminderDate(e.target.value)}
                        className={`${INPUT_BASE_STYLE} h-11 pl-10 font-medium disabled:opacity-30 transition-all`}
                        disabled={!dueDate}
                        max={dueDate}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Supplemental Context / Directives */}
              <div className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                <label htmlFor="task-description" className={labelStyle}>
                  Supplemental Directives & Sub-Tasks
                </label>
                <textarea
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className={`${INPUT_BASE_STYLE} !text-xs leading-relaxed p-4 bg-white dark:bg-white/[0.03] resize-none`}
                  placeholder="Specify detailed context, checklist items, or notes for this task..."
                />
              </div>
            </form>
          </div>

          {/* 4. STICKY ACTION FOOTER */}
          <div className="p-6 border-t border-black/5 dark:border-white/5 bg-white/80 dark:bg-[#16171a]/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                >
                  Delete Task
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className={`${BTN_SECONDARY_STYLE} !py-2.5 !px-5 text-xs font-bold tracking-wider uppercase`}
              >
                Cancel
              </button>

              <button
                type="submit"
                form="task-drawer-form"
                className={`${BTN_PRIMARY_STYLE} !py-2.5 !px-8 text-xs font-black tracking-wider uppercase shadow-md shadow-primary-500/20`}
              >
                {isEditing ? 'Commit Changes' : 'Initialize Objective'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default TaskModal;
