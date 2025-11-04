import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, TaskPriority } from '../types';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, SELECT_STYLE } from '../constants';
import Card from '../components/Card';
import Modal from '../components/Modal';
import TasksHeatmap from '../components/TasksHeatmap';
import TaskItem from '../components/TaskItem';

interface TasksProps {
  tasks: Task[];
  saveTask: (task: Omit<Task, 'id'> & { id?: string }) => void;
  deleteTask: (id: string) => void;
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

    const handleDelete = () => {
        if (task?.id && window.confirm('Are you sure you want to delete this task?')) {
            onDelete(task.id);
        }
    };

    return (
        <Modal onClose={onClose} title={task ? 'Edit Task' : 'Add New Task'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Title</label>
                    <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} className={INPUT_BASE_STYLE} required />
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
                <div className="flex justify-between items-center pt-4">
                    <div>
                        {task?.id && (
                            <button type="button" onClick={handleDelete} className={BTN_DANGER_STYLE}>Delete Task</button>
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

const Tasks: React.FC<TasksProps> = ({ tasks, saveTask, deleteTask }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [sortBy, setSortBy] = useState<'priority-desc' | 'dueDate-asc'>('priority-desc');
    const [justCompletedTaskId, setJustCompletedTaskId] = useState<string | null>(null);

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
    
    const handleDelete = (id: string) => {
        deleteTask(id);
        setIsModalOpen(false);
    };

    const groupedAndSortedTasks = useMemo(() => {
        const grouped = tasks.reduce((acc, task) => {
            (acc[task.status] = acc[task.status] || []).push(task);
            return acc;
        }, {} as Record<TaskStatus, Task[]>);

        for (const status in grouped) {
            grouped[status as TaskStatus].sort((a, b) => {
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
    }, [tasks, sortBy]);

    return (
        <div className="space-y-6">
            {isModalOpen && <TaskForm task={editingTask} onSave={handleSave} onClose={() => setIsModalOpen(false)} onDelete={handleDelete} />}
            
            <TasksHeatmap tasks={tasks} />

            <header className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    {/* <h2 className="text-3xl font-bold">Tasks</h2> */}
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage your financial to-dos.</p>
                </div>
                <div className="flex items-end gap-4">
                     <div className={SELECT_WRAPPER_STYLE}>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className={SELECT_STYLE}>
                            <option value="priority-desc">Sort by Priority</option>
                            <option value="dueDate-asc">Sort by Due Date</option>
                        </select>
                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                    </div>
                    <button onClick={() => handleOpenModal()} className={BTN_PRIMARY_STYLE}>Add Task</button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {STATUS_ORDER.map(status => {
                    const tasksInColumn = groupedAndSortedTasks[status] || [];
                    return (
                        <div key={status} className="bg-light-bg dark:bg-dark-bg/50 p-4 rounded-xl space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <span>{status}</span>
                                <span className="text-sm bg-gray-200 dark:bg-gray-700 rounded-full px-2">{tasksInColumn.length}</span>
                            </h3>
                            <div className="space-y-4 min-h-[100px]">
                                {tasksInColumn.map(task => (
                                    <TaskItem key={task.id} task={task} onEdit={handleOpenModal} isJustCompleted={task.id === justCompletedTaskId} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Tasks;