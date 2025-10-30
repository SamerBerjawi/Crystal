import React from 'react';

interface ChatFabProps {
  onClick: () => void;
}

const ChatFab: React.FC<ChatFabProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-primary-500 text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-primary-600 transition-all transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 z-50"
      aria-label="Open AI Assistant"
    >
      <span className="material-symbols-outlined text-3xl">forum</span>
    </button>
  );
};

export default ChatFab;