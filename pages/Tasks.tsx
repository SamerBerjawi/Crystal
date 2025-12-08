
import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, TaskPriority } from '../types';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, SELECT_STYLE } from '../constants';
import Modal from '../components/Modal';
import TasksHeatmap from '../components/TasksHeatmap';
import TaskItem from '../components/TaskItem';
import ConfirmationModal from '../components/ConfirmationModal';
import Card from '../components/Card';
import { parseLocalDate } from '../utils';

interface TasksProps {
  tasks: Task[];
  saveTask: (task: Omit<Task, 'id'> & { id?: string }) => void;
  deleteTask: (id: string) => void;
  taskOrder: string[];
  setTaskOrder: React.Dispatch<React.SetStateAction<string[]>>;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
const STATUS_ORDER: TaskStatus[] = ['To Do', 'In Progress', 'Done'];

const TaskForm: React.FC<{ task?: Task | null, onSave: (task: Omit<Task, 'id'> & { id?: string }) => void, onClose: () => void, onDelete: (id: string) => void }> = ({ task, onSave, onClose, onDelete }) => {
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

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (task?.id) {
            onDelete(task.id);
        }
    };

    return (
        <Modal onClose={onClose} title={task ? 'Edit Task' : 'Add New Task'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Title</label>
                    <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} className={INPUT_BASE_STYLE} required autoFocus />
                </div>
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Description (Optional)</label>
                    <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} className={INPUT_BASE_STYLE} rows={3}></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="dueDate" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Due Date (Optional)</label>
                        <input id="dueDate" type="date" value={dueDate} onChange={e => {
                            setDueDate(e.target.value);
                            if (!e.target.value) {
                                setReminderDate('');
                            }
                        }} className={INPUT_BASE_STYLE} />
                    </div>
                     <div>
                        <label htmlFor="reminderDate" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Reminder (Optional)</label>
                        <input 
                            id="reminderDate" 
                            type="date" 
                            value={reminderDate} 
                            onChange={e => setReminderDate(e.target.value)} 
                            className={`${INPUT_BASE_STYLE} disabled:opacity-50 disabled:cursor-not-allowed`} 
                            disabled={!dueDate}
                            max={dueDate}
                            title={!dueDate ? "Set a due date to enable reminders" : ""}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="priority" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Priority</label>
                        <div className={SELECT_WRAPPER_STYLE}>
                            <select id="priority" value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className={INPUT_BASE_STYLE}>
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="status" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Status</label>
                        <div className={SELECT_WRAPPER_STYLE}>
                            <select id="status" value={status} onChange={e => setStatus(e.target.value as TaskStatus)} className={INPUT_BASE_STYLE}>
                                <option value="To Do">To Do</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Done">Done</option>
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-black/10 dark:border-white/10 mt-4">
                    <div>
                        {task?.id && (
                            <button type="button" onClick={handleDeleteClick} className={BTN_DANGER_STYLE}>Delete Task</button>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                        <button type="submit" className={BTN_PRIMARY_STYLE}>{task ? 'Save Changes' : 'Add Task'}</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

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
            {isModalOpen && <TaskForm task={editingTask} onSave={handleSave} onClose={() => setIsModalOpen(false)} onDelete={handleDeleteRequest} />}
            
            <ConfirmationModal 
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Task"
                message="Are you sure you want to delete this task? This action cannot be undone."
                confirmButtonText="Delete"
                confirmButtonVariant="danger"
            />

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    {/* <h2 className="text-3xl font-bold text-light-text dark:text-dark-text">Tasks</h2> */}
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage your financial to-dos and track productivity.</p>
                </div>
                <button onClick={() => handleOpenModal()} className={BTN_PRIMARY_STYLE}>
                    <span className="material-symbols-outlined text-xl mr-2">add</span>
                    Add Task
                </button>
            </header>

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

            {/* Controls */}
            <div className="flex justify-end">
                 <div className={SELECT_WRAPPER_STYLE}>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className={`${SELECT_STYLE} !py-2 !text-sm`}>
                        <option value="manual">Manual Sort (Drag & Drop)</option>
                        <option value="priority-desc">Sort by Priority</option>
                        <option value="dueDate-asc">Sort by Due Date</option>
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
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
