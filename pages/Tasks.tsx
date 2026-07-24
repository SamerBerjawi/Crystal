
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
import StatCard from '../components/StatCard';

interface TasksProps {
  tasks: Task[];
  saveTask: (task: Omit<Task, 'id'> & { id?: string }) => void;
  deleteTask: (id: string) => void;
  taskOrder: string[];
  setTaskOrder: React.Dispatch<React.SetStateAction<string[]>>;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
const STATUS_ORDER: TaskStatus[] = ['To Do', 'In Progress', 'Done'];

const Tasks: React.FC<TasksProps & { setCurrentPage?: (page: any) => void }> = ({ tasks, saveTask, deleteTask, taskOrder, setTaskOrder, setCurrentPage }) => {
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
        <div className="w-full pb-24 space-y-12 animate-fade-in-up px-4">
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

            {/* Navigation & Header */}
            <div className="space-y-6 pt-4">
                {setCurrentPage && (
                    <nav className="flex items-center gap-3">
                        <button 
                            onClick={() => setCurrentPage('Settings')} 
                            className="group flex items-center gap-2 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary  tracking-widest hover:text-primary-500 transition-colors"
                        >
                            <div className="w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all">
                                <span className="material-symbols-outlined text-sm">arrow_back</span>
                            </div>
                            <span>Back to Control Center</span>
                        </button>
                    </nav>
                )}
                
                <PageHeader
                    markerIcon="fact_check"
                    markerLabel="Operational Protocols"
                    title="Action Board"
                    subtitle="Track follow-ups, recursive obligations, and semantic chores tied to system nodes."
                    actions={
                        <button onClick={() => handleOpenModal()} className="px-8 py-4 bg-primary-500 text-white rounded-2xl text-[10px] font-black  tracking-[0.2em] shadow-xl shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                            <span className="material-symbols-outlined text-xl">add_circle</span>
                            New Operational Task
                        </button>
                    }
                />
            </div>
            
            {/* Productivity Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Completion Matrix" 
                    value={`${stats.rate}%`} 
                    subtext={`${stats.completed} nodes verified`} 
                    icon="verified" 
                    colorClass="bg-blue-500 text-white shadow-blue-500/20" 
                />
                <StatCard 
                    title="Priority Signals" 
                    value={stats.pendingHigh} 
                    subtext="Critical latency items" 
                    icon="priority_high" 
                    colorClass={stats.pendingHigh > 0 ? "bg-red-500 text-white shadow-red-500/20" : "bg-emerald-500 text-white shadow-emerald-500/20"} 
                />
                <StatCard 
                    title="Temporal Window" 
                    value={stats.dueSoon} 
                    subtext="Due in 7-day cycle" 
                    icon="event_upcoming" 
                    colorClass="bg-amber-500 text-white shadow-amber-500/20" 
                />
                <StatCard 
                    title="Active Workload" 
                    value={stats.total - stats.completed} 
                    subtext="Unreconciled nodes" 
                    icon="analytics" 
                    colorClass="bg-indigo-500 text-white shadow-indigo-500/20" 
                />
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 px-2">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-6 bg-primary-500 rounded-full"></div>
                    <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight opacity-60">Execution Queue</h3>
                </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto">
                     <div className="relative flex-grow min-w-[200px]">
                        <select 
                            value={sortBy} 
                            onChange={e => setSortBy(e.target.value as any)} 
                            className="w-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl px-5 py-4 text-[10px] font-black  tracking-widest appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-sm"
                        >
                            <option value="manual">Manual Sequence</option>
                            <option value="priority-desc">Priority Sift</option>
                            <option value="dueDate-asc">Temporal Sort</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                            <span className="material-symbols-outlined text-lg">swap_vert</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Heatmap Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                    <div className="w-2 h-6 bg-purple-500 rounded-full"></div>
                    <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight opacity-60">Temporal Density</h3>
                </div>
                <div className="w-full overflow-x-auto flex justify-center py-2">
                    <TasksHeatmap tasks={tasks} />
                </div>
            </section>

            {/* Kanban Board */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {STATUS_ORDER.map(status => {
                    const tasksInColumn = groupedAndSortedTasks[status] || [];
                    const statusColorMap: Record<TaskStatus, string> = {
                        'To Do': 'bg-slate-500',
                        'In Progress': 'bg-blue-500',
                        'Done': 'bg-emerald-500'
                    };
                    
                    return (
                        <div key={status} className="space-y-6">
                            <header className="flex justify-between items-center px-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${statusColorMap[status]}`}></div>
                                    <h3 className="text-[11px] font-bold tracking-[0.2em] text-light-text dark:text-dark-text opacity-80">
                                        {status}
                                    </h3>
                                    <span className="text-[10px] font-black bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-lg opacity-40">
                                        {tasksInColumn.length}
                                    </span>
                                </div>
                                {status === 'To Do' && (
                                    <button onClick={() => handleOpenModal()} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-primary-500 hover:text-white transition-all">
                                        <span className="material-symbols-outlined text-lg">add</span>
                                    </button>
                                )}
                            </header>
                            
                            <div className="space-y-4 min-h-[400px]">
                                {tasksInColumn.length === 0 ? (
                                    <div className="h-40 border-2 border-dashed border-black/5 dark:border-white/5 rounded-[2rem] flex flex-col items-center justify-center gap-2 opacity-20">
                                        <span className="material-symbols-outlined text-3xl">task_alt</span>
                                        <span className="text-[10px] font-black  tracking-widest">Queue Clear</span>
                                    </div>
                                ) : (
                                    tasksInColumn.map(task => {
                                        const isDraggable = sortBy === 'manual' && (task.status === 'To Do' || task.status === 'In Progress');
                                        const isBeingDragged = draggedItem?.id === task.id;
                                        const isDragOver = dragOverItem?.id === task.id;
                                        
                                        return (
                                            <div
                                                key={task.id}
                                                className={`transition-all duration-300 ${isDragOver ? 'pt-4' : ''}`}
                                                onDragOver={(e) => isDraggable && handleDragOver(e, task)}
                                                onDrop={() => isDraggable && handleDrop(task)}
                                                onDragLeave={isDraggable ? handleDragLeave : undefined}
                                            >
                                                {isDragOver && (
                                                    <div className="h-24 border-2 border-dashed border-primary-500/20 rounded-3xl mb-4 bg-primary-500/5 animate-pulse"></div>
                                                )}
                                                <div
                                                    draggable={isDraggable}
                                                    onDragStart={(e) => isDraggable && handleDragStart(e, task)}
                                                    onDragEnd={isDraggable ? handleDragEnd : undefined}
                                                    className={`${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''} ${isBeingDragged ? 'opacity-40 scale-95 blur-sm' : ''}`}
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
