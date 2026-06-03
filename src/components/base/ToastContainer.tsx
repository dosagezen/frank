
import { useEffect, useState } from 'react';
import { useToast, ToastType } from '../../contexts/ToastContext';

const iconMap: Record<ToastType, string> = {
  success: 'ri-check-line',
  error: 'ri-close-circle-line',
  warning: 'ri-alert-line',
  info: 'ri-information-line',
};

const colorMap: Record<ToastType, { bg: string; icon: string; bar: string; border: string }> = {
  success: {
    bg: 'bg-white dark:bg-gray-800',
    icon: 'text-emerald-500',
    bar: 'bg-emerald-500',
    border: 'border-gray-100 dark:border-gray-700',
  },
  error: {
    bg: 'bg-white dark:bg-gray-800',
    icon: 'text-red-500',
    bar: 'bg-red-500',
    border: 'border-gray-100 dark:border-gray-700',
  },
  warning: {
    bg: 'bg-white dark:bg-gray-800',
    icon: 'text-amber-500',
    bar: 'bg-amber-500',
    border: 'border-gray-100 dark:border-gray-700',
  },
  info: {
    bg: 'bg-white dark:bg-gray-800',
    icon: 'text-sky-500',
    bar: 'bg-sky-500',
    border: 'border-gray-100 dark:border-gray-700',
  },
};

interface ToastItemProps {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  onDismiss: (id: string) => void;
}

function ToastItem({ id, message, type, duration, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const colors = colorMap[type];

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [duration]);

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(id), 280);
    }, duration - 300);
    return () => clearTimeout(exitTimer);
  }, [id, duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 280);
  };

  return (
    <div
      className={`relative flex items-center gap-3 w-[360px] max-w-[calc(100vw-32px)] px-4 py-3.5 rounded-xl shadow-lg border ${colors.bg} ${colors.border} overflow-hidden transition-all duration-300 ${
        isExiting
          ? 'opacity-0 translate-x-8 scale-95'
          : 'opacity-100 translate-x-0 scale-100'
      }`}
      style={{
        animation: isExiting ? undefined : 'toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 4px 24px -4px rgba(0,0,0,0.08), 0 2px 8px -2px rgba(0,0,0,0.04)',
      }}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gray-100 dark:bg-gray-700/50">
        <div
          className={`h-full ${colors.bar} transition-none rounded-full`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Icon */}
      <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${colors.icon} flex-shrink-0`}
        style={{ backgroundColor: type === 'success' ? 'rgba(16,185,129,0.1)' : type === 'error' ? 'rgba(239,68,68,0.1)' : type === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(14,165,233,0.1)' }}
      >
        <i className={`${iconMap[type]} text-lg`}></i>
      </div>

      {/* Message */}
      <p className="flex-1 text-[13px] font-medium text-gray-800 dark:text-gray-200 leading-snug pr-1">
        {message}
      </p>

      {/* Close */}
      <button
        onClick={handleDismiss}
        className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer flex-shrink-0"
      >
        <i className="ri-close-line text-sm"></i>
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(24px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem
              id={toast.id}
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onDismiss={dismissToast}
            />
          </div>
        ))}
      </div>
    </>
  );
}
