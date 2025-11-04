import React from 'react';
import { Task, TaskPriority } from '../types';
import Card from './Card';
import { parseDateAsUTC } from '../utils';

interface TaskItemProps {
  task: Task;
  onEdit: (task: Task) => void;
  isJustCompleted: boolean;
}

const PRIORITY_STYLES: Record<TaskPriority, { text: string; bg: string }> = {
    'High': { text: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/40' },
    'Medium': { text: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
    'Low': { text: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/40' },
};

const TaskItem: React.FC<TaskItemProps> = ({ task, onEdit, isJustCompleted }) => (
    <Card onClick={() => onEdit(task)} className={`p-4 cursor-pointer hover:shadow-lg hover:-translate-y-1 dark:hover:bg-dark-border/50 transition-all duration-300 ${isJustCompleted ? 'animate-celebrate' : ''} ${task.status === 'Done' ? 'opacity-60' : ''}`}>
        <div className="flex justify-between items-start">
            <p className={`font-semibold text-light-text dark:text-dark-text pr-2 ${task.status === 'Done' ? 'line-through' : ''}`}>{task.title}</p>
            <div className={`px-2 py-0.5 text-xs font-semibold rounded-full ${PRIORITY_STYLES[task.priority].bg} ${PRIORITY_STYLES[task.priority].text}`}>{task.priority}</div>
        </div>
        {task.description && <p className={`text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1 ${task.status === 'Done' ? 'line-through' : ''}`}>{task.description}</p>}
        <div className="flex items-center gap-4 mt-2">
            {task.dueDate && (
                <div className="flex items-center gap-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    <span className="material-symbols-outlined text-sm">event</span>
                    <span>{parseDateAsUTC(task.dueDate).toLocaleDateString('en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
            )}
            {task.reminderDate && (
                <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                    <span className="material-symbols-outlined text-sm">notifications</span>
                    <span>{parseDateAsUTC(task.reminderDate).toLocaleDateString('en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
            )}
        </div>
    </Card>
);

export default TaskItem;