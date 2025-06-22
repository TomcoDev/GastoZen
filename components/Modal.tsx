
import React, { ReactNode } from 'react';
import { XIcon } from '../constants';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300 ease-in-out"
      onClick={onClose} // Close modal on backdrop click
    >
      <div 
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full ${sizeClasses[size]} flex flex-col ${isOpen ? 'animate-modalEnter' : 'animate-modalLeave'}`}
        style={{ animationDuration: '0.3s' }} 
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
            aria-label="Cerrar modal"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(100vh-12rem)] md:max-h-[calc(100vh-15rem)]"> {/* Scrollable content area with max height */}
          {children}
        </div>
      </div>
      {/* 
        Keyframes for modalEnter/Leave (conceptual for Tailwind JIT, typically in config):
        @keyframes modalEnter { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes modalLeave { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }
        .animate-modalEnter { animation: modalEnter 0.3s forwards; }
        .animate-modalLeave { animation: modalLeave 0.3s forwards; }
      */}
    </div>
  );
};

export default Modal;
