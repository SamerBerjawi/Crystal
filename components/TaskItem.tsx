
import React from 'react';
import { Task, TaskPriority } from '../types';
import { parseDateAsUTC } from '../utils';

interface TaskItemProps {
  task: Task;
  onEdit: (task: Task) => void;
  isJustCompleted: boolean;
}

const PRIORITY_STYLES: Record<TaskPriority, { text: string; bg: string; dot: string }> = {
    'High': { text: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20', dot: 'bg-red-500' },
    'Medium': { text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20', dot: 'bg-amber-500' },
    'Low': { text: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/20', dot: 'bg-blue-500' },
};

const getRelativeDate = (dateString: string): { text: string; color: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = parseDateAsUTC(dateString);
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, color: 'text-red-600 dark:text-red-400 font-bold' };
    if (diffDays === 0) return { text: 'Today', color: 'text-orange-600 dark:text-orange-400 font-bold' };
    if (diffDays === 1) return { text: 'Tomorrow', color: 'text-amber-600 dark:text-amber-400' };
    if (diffDays <= 7) return { text: `In ${diffDays} days`, color: 'text-light-text-secondary dark:text-dark-text-secondary' };
    
    return { 
        text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
        color: 'text-light-text-secondary dark:text-dark-text-secondary' 
    };
};

const TaskItem: React.FC<TaskItemProps> = ({ task, onEdit, isJustCompleted }) => {
    const priorityStyle = PRIORITY_STYLES[task.priority];
    const dateInfo = task.dueDate ? getRelativeDate(task.dueDate) : null;

    return (
        <div 
            onClick={() => onEdit(task)} 
            className={`
                group relative bg-white dark:bg-dark-card p-4 rounded-xl border border-black/5 dark:border-white/5 shadow-sm 
                hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer
                ${isJustCompleted ? 'animate-celebrate ring-2 ring-green-500' : ''} 
                ${task.status === 'Done' ? 'opacity-60 bg-gray-50 dark:bg-black/20' : ''}
            `}
        >
            <div className="flex justify-between items-start mb-2">
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${priorityStyle.bg} ${priorityStyle.text}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`}></div>
                    {task.priority}
                </div>
                {task.status === 'Done' && (
                    <span className="material-symbols-outlined text-green-500 text-xl">check_circle</span>
                )}
            </div>

            <h4 className={`font-semibold text-light-text dark:text-dark-text mb-1 leading-tight ${task.status === 'Done' ? 'line-through text-light-text-secondary dark:text-dark-text-secondary' : ''}`}>
                {task.title}
            </h4>
            
            {task.description && (
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary line-clamp-2 mb-3">
                    {task.description}
                </p>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                {dateInfo ? (
                    <div className={`flex items-center gap-1 text-xs ${dateInfo.color}`}>
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        <span>{dateInfo.text}</span>
                    </div>
                ) : (
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic">No due date</span>
                )}
                
                {task.reminderDate && (
                     <span className="material-symbols-outlined text-[16px] text-light-text-secondary dark:text-dark-text-secondary" title="Reminder set">notifications</span>
                )}
            </div>
        </div>
    );
};

export default TaskItem;
