
import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, TaskPriority } from '../types';
import { BTN_PRIMARY_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, SELECT_STYLE } from '../constants';
import TasksHeatmap from '../components/TasksHeatmap';
import TaskItem from '../components/TaskItem';
import ConfirmationModal from '../components/ConfirmationModal';
import Card from '../components/Card';
import { parseLocalDate } from '../utils';
import TaskModal from '../components/TaskModal';
import PageHeader from '../components/PageHeader';

interface TasksProps {
  tasks: Task[];
  saveTask: (task: Omit<Task, 'id'> & { id?: string }) => void;
  deleteTask: (id: string) => void;
  taskOrder: string[];
  setTaskOrder: React.Dispatch<React.SetStateAction<string[]>>;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
const STATUS_ORDER: TaskStatus[] = ['To Do', 'In Progress', 'Done'];

const MetricCard: React.FC<{ label: string; value: string | number; subtext?: string; color?: string; icon?: string }> = ({ label, value, subtext, color = 'text-light-text dark:text-dark-text', icon }) => (
    <Card className="flex flex-col justify-between h-full p-5">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">{label}</p>
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
            {icon && (
                <div className="p-2 bg-black/5 dark:bg-white/5 rounded-full">
                    <span className="material-symbols-outlined text-xl opacity-70">{icon}</span>
                </div>
            )}
        </div>
        {subtext && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2 font-medium">{subtext}</p>}
    </Card>
);

const Tasks: React.FC<TasksProps> = ({ tasks, saveTask, deleteTask, taskOrder, setTaskOrder }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [sortBy, setSortBy] = useState<'priority-desc' | 'dueDate-asc' | 'manual'>('priority-desc');
    const [justCompletedTaskId, setJustCompletedTaskId] = useState<string | null>(null);
    const [draggedItem, setDraggedItem] = useState<Task | null>(null);
    const [dragOverItem, setDragOverItem] = useState<Task | null>(null);
    
    // Delete Confirmation State
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [taskToDeleteId, setTaskToDeleteId] = useState<string | null>(null);

    // Derived Statistics
    const stats = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'Done').length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const pendingHigh = tasks.filter(t => t.priority === 'High' && t.status !== 'Done').length;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const next7Days = new Date(today);
        next7Days.setDate(today.getDate() + 7);

        const dueSoon = tasks.filter(t => {
            if (t.status === 'Done' || !t.dueDate) return false;
            const d = parseLocalDate(t.dueDate);
            return d >= today && d <= next7Days;
        }).length;

        return { total, completed, rate, pendingHigh, dueSoon };
    }, [tasks]);

    const handleOpenModal = (task?: Task) => {
        setEditingTask(task || null);
        setIsModalOpen(true);
    };

    const handleSave = (taskData: Omit<Task, 'id'> & { id?: string }) => {
        const originalTask = tasks.find(t => t.id === taskData.id);
        if (originalTask && originalTask.status !== 'Done' && taskData.status === 'Done' && taskData.id) {
            setJustCompletedTaskId(taskData.id);
            setTimeout(() => {
                setJustCompletedTaskId(null);
            }, 1000); // Duration matches the animation
        }
        saveTask(taskData);
        setIsModalOpen(false);
    };
    
    const handleDeleteRequest = (id: string) => {
        setTaskToDeleteId(id);
        setIsDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (taskToDeleteId) {
            deleteTask(taskToDeleteId);
            setIsDeleteConfirmOpen(false);
            setIsModalOpen(false);
            setTaskToDeleteId(null);
        }
    };

    const groupedAndSortedTasks = useMemo(() => {
        const grouped = tasks.reduce((acc, task) => {
            (acc[task.status] = acc[task.status] || []).push(task);
            return acc;
        }, {} as Record<TaskStatus, Task[]>);

        for (const status in grouped) {
            grouped[status as TaskStatus].sort((a, b) => {
                if (sortBy === 'manual') {
                    const aIndex = taskOrder.indexOf(a.id);
                    const bIndex = taskOrder.indexOf(b.id);
                    if (aIndex === -1 && bIndex === -1) return 0;
                    if (aIndex === -1) return 1;
                    if (bIndex === -1) return -1;
                    return aIndex - bIndex;
                }
                if (sortBy === 'priority-desc') {
                    return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
                }
                if (sortBy === 'dueDate-asc') {
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                }
                return 0;
            });
        }
        return grouped;
    }, [tasks, sortBy, taskOrder]);
    
    const handleDragStart = (e: React.DragEvent, task: Task) => {
        setDraggedItem(task);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, task: Task) => {
        e.preventDefault();
        if (draggedItem && draggedItem.id !== task.id && draggedItem.status === task.status) {
            setDragOverItem(task);
        }
    };

    const handleDragLeave = () => {
        setDragOverItem(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDragOverItem(null);
    };

    const handleDrop = (targetTask: Task) => {
        if (!draggedItem || draggedItem.id === targetTask.id || draggedItem.status !== targetTask.status) {
            handleDragEnd();
            return;
        }

        const currentOrder = [...taskOrder];
        const draggedId = draggedItem.id;
        
        const newOrder = currentOrder.filter(id => id !== draggedId);
        
        const targetIndex = newOrder.indexOf(targetTask.id);

        if (targetIndex !== -1) {
            newOrder.splice(targetIndex, 0, draggedId);
            setTaskOrder(newOrder);
        }
        handleDragEnd();
    };

    return (
        <div className="space-y-8 pb-10 animate-fade-in-up">
            {isModalOpen && (
                <TaskModal 
                    task={editingTask} 
                    onSave={handleSave} 
                    onClose={() => setIsModalOpen(false)} 
                    onDelete={handleDeleteRequest} 
                />
            )}
            
            <ConfirmationModal 
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Task"
                message="Are you sure you want to delete this task? This action cannot be undone."
                confirmButtonText="Delete"
                confirmButtonVariant="danger"
            />

            {/* Header */}
            <PageHeader
                markerIcon="checklist"
                markerLabel="Action Board"
                title="Tasks"
                subtitle="Track follow-ups, approvals, and chores tied to accounts, invoices, or goals."
                actions={
                    <button onClick={() => handleOpenModal()} className={BTN_PRIMARY_STYLE}>
                        <span className="material-symbols-outlined text-xl mr-2">add</span>
                        Add Task
                    </button>
                }
            />
            
            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-dark-card p-1.5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                <div className="flex-1 w-full md:w-auto">
                     <div className="px-4 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                         {stats.total} Total Tasks • {stats.completed} Completed
                     </div>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto px-1 md:px-0">
                     <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap hidden sm:block">Sort by:</span>
                     <div className={`${SELECT_WRAPPER_STYLE} !w-auto`}>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className={`${SELECT_STYLE} !py-2 !text-sm pr-8 min-w-[140px]`}>
                            <option value="manual">Manual (Drag)</option>
                            <option value="priority-desc">Priority</option>
                            <option value="dueDate-asc">Due Date</option>
                        </select>
                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
                    </div>
                </div>
            </div>

            {/* Productivity Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <div className="col-span-2 lg:col-span-1">
                    <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white border-none relative overflow-hidden h-full p-5">
                         <div className="absolute right-0 top-0 p-4 opacity-10 pointer-events-none">
                             <span className="material-symbols-outlined text-6xl">check_circle</span>
                         </div>
                         <div className="relative z-10 flex flex-col justify-between h-full">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Completion Rate</p>
                                <p className="text-4xl font-extrabold">{stats.rate}%</p>
                            </div>
                            <p className="text-xs font-medium opacity-80 mt-2">{stats.completed} of {stats.total} tasks done</p>
                         </div>
                    </Card>
                </div>
                <MetricCard 
                    label="High Priority Pending" 
                    value={stats.pendingHigh} 
                    subtext="Critical items to address" 
                    color={stats.pendingHigh > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
                    icon="priority_high"
                />
                <MetricCard 
                    label="Due in 7 Days" 
                    value={stats.dueSoon} 
                    subtext="Upcoming deadlines" 
                    color="text-amber-600 dark:text-amber-400"
                    icon="event_upcoming"
                />
                <MetricCard
                    label="Total Active"
                    value={stats.total - stats.completed}
                    subtext="Current workload"
                    icon="list_alt"
                />
            </div>

            {/* Heatmap */}
            <div className="flex justify-center">
                <TasksHeatmap tasks={tasks} />
            </div>

            {/* Kanban Board */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {STATUS_ORDER.map(status => {
                    const tasksInColumn = groupedAndSortedTasks[status] || [];
                    const columnColor = status === 'To Do' ? 'bg-gray-100 dark:bg-white/5' 
                        : status === 'In Progress' ? 'bg-blue-50 dark:bg-blue-900/10' 
                        : 'bg-green-50 dark:bg-green-900/10';
                    
                    return (
                        <div key={status} className={`rounded-2xl p-4 ${columnColor} border border-black/5 dark:border-white/5 flex flex-col h-full min-h-[300px]`}>
                            <header className="flex justify-between items-center mb-4 px-1">
                                <h3 className="font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                                    {status}
                                    <span className="text-xs font-bold bg-white dark:bg-black/20 px-2 py-0.5 rounded-full opacity-70">{tasksInColumn.length}</span>
                                </h3>
                                {status === 'To Do' && (
                                    <button onClick={() => handleOpenModal()} className="text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 p-1 rounded transition-colors" title="Quick Add">
                                        <span className="material-symbols-outlined text-lg">add</span>
                                    </button>
                                )}
                            </header>
                            
                            <div className="space-y-3 flex-grow">
                                {tasksInColumn.length === 0 ? (
                                    <div className="h-32 border-2 border-dashed border-black/5 dark:border-white/10 rounded-xl flex items-center justify-center text-sm text-light-text-secondary dark:text-dark-text-secondary italic">
                                        No tasks
                                    </div>
                                ) : (
                                    tasksInColumn.map(task => {
                                        const isDraggable = sortBy === 'manual' && (task.status === 'To Do' || task.status === 'In Progress');
                                        const isBeingDragged = draggedItem?.id === task.id;
                                        const isDragOver = dragOverItem?.id === task.id;
                                        
                                        return (
                                            <div
                                                key={task.id}
                                                className={`transition-all duration-200 ${isDragOver ? 'translate-y-2' : ''}`}
                                                onDragOver={(e) => isDraggable && handleDragOver(e, task)}
                                                onDrop={() => isDraggable && handleDrop(task)}
                                                onDragLeave={isDraggable ? handleDragLeave : undefined}
                                            >
                                                {isDragOver && <div className="h-1 bg-primary-500 rounded-full mb-2 opacity-50"></div>}
                                                <div
                                                    draggable={isDraggable}
                                                    onDragStart={(e) => isDraggable && handleDragStart(e, task)}
                                                    onDragEnd={isDraggable ? handleDragEnd : undefined}
                                                    className={`${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''} ${isBeingDragged ? 'opacity-40 scale-95' : ''}`}
                                                >
                                                    <TaskItem 
                                                        task={task} 
                                                        onEdit={handleOpenModal} 
                                                        isJustCompleted={task.id === justCompletedTaskId}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

        </div>
    );
};

export default Tasks;
