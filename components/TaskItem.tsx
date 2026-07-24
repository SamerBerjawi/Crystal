
import React from 'react';
import { Task, TaskPriority } from '../types';
import { parseLocalDate } from '../utils';

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
    const date = parseLocalDate(dateString);
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
                group relative bg-white dark:bg-dark-card p-5 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm 
                hover:shadow-xl hover:-translate-y-1 transition-all duration-500 cursor-pointer overflow-hidden
                ${isJustCompleted ? 'animate-celebrate ring-2 ring-primary-500' : ''} 
                ${task.status === 'Done' ? 'opacity-60 bg-gray-50/50 dark:bg-black/10' : ''}
            `}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black  tracking-widest border border-black/5 dark:border-white/5 shadow-sm ${priorityStyle.bg} ${priorityStyle.text}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot} shadow-sm`}></div>
                        {task.priority}
                    </div>
                    {task.status === 'Done' && (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                             <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                        </div>
                    )}
                </div>

                <h4 className={`text-sm font-bold text-light-text dark:text-dark-text mb-2 leading-snug tracking-tight ${task.status === 'Done' ? 'line-through opacity-50' : ''}`}>
                    {task.title}
                </h4>
                
                {task.description && (
                    <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60 line-clamp-2 mb-4 leading-relaxed">
                        {task.description}
                    </p>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                    {dateInfo ? (
                        <div className={`flex items-center gap-2 text-[9px] font-black  tracking-widest ${dateInfo.color}`}>
                            <span className="material-symbols-outlined text-[14px] opacity-40">calendar_today</span>
                            <span>{dateInfo.text}</span>
                        </div>
                    ) : (
                        <span className="text-[9px] font-black  tracking-widest text-light-text-secondary dark:text-dark-text-secondary opacity-30">No Temporal Limit</span>
                    )}
                    
                    {task.reminderDate && (
                         <div className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary group-hover:text-primary-500 transition-colors">
                              <span className="material-symbols-outlined text-[16px]">notifications</span>
                         </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskItem;
