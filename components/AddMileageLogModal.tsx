import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MileageLog } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { toLocalISOString } from '../utils';
import Icon from './ui/Icon';

interface AddMileageLogModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSave: (log: Omit<MileageLog, 'id'> & { id?: string }) => void;
  logToEdit?: MileageLog | null;
}

const AddMileageLogModal: React.FC<AddMileageLogModalProps> = ({
  isOpen = true,
  onClose,
  onSave,
  logToEdit
}) => {
  const isEditing = !!logToEdit;
  const [date, setDate] = useState(toLocalISOString(new Date()));
  const [reading, setReading] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (logToEdit) {
      setDate(logToEdit.date);
      setReading(String(logToEdit.reading));
    } else {
      setDate(toLocalISOString(new Date()));
      setReading('');
    }

    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
  }, [logToEdit]);

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
    if (date && reading !== '') {
      const parsedReading = parseInt(reading, 10);
      if (!isNaN(parsedReading)) {
        onSave({ id: logToEdit?.id, date, reading: parsedReading });
        handleClose();
      }
    }
  };

  const content = (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Sidebar Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div 
          className={`w-screen max-w-lg bg-white dark:bg-dark-card backdrop-blur-2xl dark:shadow-[inset_1px_0_0_0_rgba(255,255,255,0.1)] text-light-text dark:text-dark-text shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-teal-500/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20 shadow-xs">
                <Icon name="speed" className="text-2xl" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                  {isEditing ? 'Edit Mileage Entry' : 'Log Vehicle Mileage'}
                </h2>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  Track odometer readings and service milestones
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

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

              {/* Reading Card */}
              <div className="p-6 rounded-3xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="reading" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Odometer Reading (km) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative group">
                    <input
                      id="reading"
                      type="number"
                      value={reading}
                      onChange={(e) => setReading(e.target.value)}
                      className={`${INPUT_BASE_STYLE} pr-14 h-14 !text-2xl font-bold tabular-nums`}
                      placeholder="e.g. 45000"
                      required
                      autoFocus
                      min="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                      KM
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="date" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Logged Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`${INPUT_BASE_STYLE} h-12`}
                    required
                  />
                </div>
              </div>

            </div>

            {/* Sticky Bottom Actions */}
            <div className="p-6 border-t border-black/5 dark:border-white/5 bg-white/90 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
              <button 
                type="button" 
                onClick={handleClose} 
                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95`}
              >
                <span>{isEditing ? 'Save Changes' : 'Record Mileage'}</span>
                <Icon name="check" className="text-base" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default AddMileageLogModal;