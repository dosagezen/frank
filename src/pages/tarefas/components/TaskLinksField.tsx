import { useState } from 'react';

export interface TaskLink {
  id: string;
  title: string;
  url: string;
}

interface TaskLinksFieldProps {
  links: TaskLink[];
  onChange: (links: TaskLink[]) => void;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function TaskLinksField({ links, onChange }: TaskLinksFieldProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');

  const handleAdd = () => {
    const url = normalizeUrl(newUrl);
    if (!url) return;
    const title = newTitle.trim() || url;
    const newLink: TaskLink = {
      id: `link_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title,
      url,
    };
    onChange([...links, newLink]);
    setNewTitle('');
    setNewUrl('');
  };

  const handleDelete = (id: string) => {
    onChange(links.filter((l) => l.id !== id));
  };

  const handleStartEdit = (link: TaskLink) => {
    setEditingId(link.id);
    setEditTitle(link.title);
    setEditUrl(link.url);
  };

  const handleSaveEdit = (id: string) => {
    const url = normalizeUrl(editUrl);
    if (!url) return;
    const title = editTitle.trim() || url;
    onChange(links.map((l) => (l.id === id ? { ...l, title, url } : l)));
    setEditingId(null);
    setEditTitle('');
    setEditUrl('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditUrl('');
  };

  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
        <i className="ri-links-line text-teal-600 dark:text-teal-400"></i>
        Links Relacionados
      </label>

      {/* Inputs para adicionar novo link */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="w-56 flex-shrink-0 px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
          placeholder="Título"
        />
        <input
          type="text"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
          placeholder="https://exemplo.com"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newUrl.trim()}
          className="w-10 h-10 flex items-center justify-center bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white disabled:text-gray-400 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          title="Adicionar link"
        >
          <i className="ri-add-line text-lg"></i>
        </button>
      </div>

      {/* Lista de links */}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) =>
            editingId === link.id ? (
              /* Modo edição inline */
              <div
                key={link.id}
                className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-300 dark:border-teal-700 rounded-lg"
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className="ri-link text-teal-500 text-sm"></i>
                </div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-44 flex-shrink-0 px-2 py-1 border border-teal-300 dark:border-teal-600 dark:bg-gray-700 dark:text-white rounded focus:ring-1 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Título"
                />
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveEdit(link.id);
                    }
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="flex-1 min-w-0 px-2 py-1 border border-teal-300 dark:border-teal-600 dark:bg-gray-700 dark:text-white rounded focus:ring-1 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="https://exemplo.com"
                />
                <button
                  type="button"
                  onClick={() => handleSaveEdit(link.id)}
                  className="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-900/60 flex-shrink-0"
                  title="Salvar"
                >
                  <i className="ri-check-line text-sm"></i>
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0"
                  title="Cancelar"
                >
                  <i className="ri-close-line text-sm"></i>
                </button>
              </div>
            ) : (
              /* Modo visualização */
              <div
                key={link.id}
                className="group flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className="ri-link text-teal-500 text-sm"></i>
                </div>
                <span className="w-44 flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  {link.title}
                </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 truncate min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="truncate">{link.url}</span>
                  <i className="ri-external-link-line text-xs flex-shrink-0"></i>
                </a>
                <button
                  type="button"
                  onClick={() => handleStartEdit(link)}
                  className="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer opacity-0 group-hover:opacity-100 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 flex-shrink-0"
                  title="Editar link"
                >
                  <i className="ri-pencil-line text-sm"></i>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(link.id)}
                  className="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex-shrink-0"
                  title="Excluir link"
                >
                  <i className="ri-delete-bin-line text-sm"></i>
                </button>
              </div>
            )
          )}
        </div>
      )}

      {links.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          Nenhum link adicionado ainda.
        </p>
      )}
    </div>
  );
}
