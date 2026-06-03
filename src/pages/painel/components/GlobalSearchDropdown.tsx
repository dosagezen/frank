
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SearchResult, SearchResultType } from '../../../services/globalSearchService';
import { TYPE_CONFIG } from '../../../services/globalSearchService';

interface Props {
  query: string;
  results: SearchResult[];
  loading: boolean;
  onClose: () => void;
}

const TYPE_LABELS: Record<SearchResultType, string> = {
  tarefa: 'Tarefas',
  projeto: 'Projetos',
  sprint: 'Sprints',
  evento: 'Eventos',
  conhecimento: 'Conhecimento',
  membro: 'Membros',
};

const TYPE_ORDER: SearchResultType[] = [
  'tarefa',
  'projeto',
  'sprint',
  'evento',
  'conhecimento',
  'membro',
];

export default function GlobalSearchDropdown({
  query,
  results,
  loading,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const grouped = TYPE_ORDER.reduce<Record<string, SearchResult[]>>(
    (acc, type) => {
      const items = results.filter((r) => r.type === type);
      if (items.length > 0) acc[type] = items;
      return acc;
    },
    {}
  );

  const hasResults = results.length > 0;

  const handleSelect = (result: SearchResult) => {
    try {
      navigate(result.path);
    } catch (err) {
      console.error('Navigation error:', err);
    } finally {
      onClose();
    }
  };

  const getIconForType = (type: SearchResultType): string => {
    const icons: Record<SearchResultType, string> = {
      tarefa: 'ri-task-line',
      projeto: 'ri-folder-line',
      sprint: 'ri-timer-line',
      evento: 'ri-calendar-line',
      conhecimento: 'ri-book-line',
      membro: 'ri-user-line',
    };
    return icons[type] ?? 'ri-search-line';
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        ref={ref}
        className="absolute left-0 top-full mt-2 w-full max-w-[480px] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[500px] overflow-y-auto"
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 mb-3">
              <i className="ri-search-line text-lg text-gray-400"></i>
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Nenhum resultado para &quot;{query}&quot;
            </p>
          </div>
        ) : (
          <>
            {TYPE_ORDER.filter((type) => grouped[type]).map((type) => (
              <div
                key={type}
                className="p-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-2">
                  {TYPE_LABELS[type]}
                </h4>
                <div className="space-y-1">
                  {grouped[type].map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex-shrink-0">
                        <i className={`${getIconForType(type)} text-white text-sm`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {result.title}
                        </p>
                        {result.subtitle && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
