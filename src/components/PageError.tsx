interface PageErrorProps {
  message?: string;
  error?: Error | null;
  onRetry?: () => void;
}

export default function PageError({ 
  message = 'Erro ao carregar dados', 
  error, 
  onRetry 
}: PageErrorProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-4">
          <i className="ri-error-warning-line text-5xl text-red-500"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {message}
        </h3>
        {error && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {error.message}
          </p>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap inline-flex items-center gap-2"
          >
            <i className="ri-refresh-line"></i>
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
