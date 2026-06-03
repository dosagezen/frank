
import { useState, useRef, useEffect } from 'react';
import type { ConhecimentoItem } from '../../../mocks/conhecimento';
import { useToast } from '../../../contexts/ToastContext';
import { useUserProfile } from '../../../contexts/UserProfileContext';

interface NovoConhecimentoModalProps {
  onClose: () => void;
  onAdd: (conhecimento: Omit<ConhecimentoItem, 'id' | 'visualizado' | 'visualizacoes'>) => void;
  existingTags?: string[];
}

export default function NovoConhecimentoModal({ onClose, onAdd, existingTags = [] }: NovoConhecimentoModalProps) {
  const { showToast } = useToast();
  const { profile } = useUserProfile();

  const getAutorName = () => {
    if (profile?.full_name) return profile.full_name;
    if (profile?.nome) return profile.nome;
    return '';
  };

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    link: '',
    thumbnail: '',
    autor: getAutorName(),
    tags: [] as string[]
  });
  const [newTag, setNewTag] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = existingTags.filter(
    tag =>
      tag.toLowerCase().includes(newTag.trim().toLowerCase()) &&
      !formData.tags.includes(tag) &&
      newTag.trim() !== ''
  );

  const isNewTag =
    newTag.trim() !== '' &&
    !existingTags.some(t => t.toLowerCase() === newTag.trim().toLowerCase()) &&
    !formData.tags.includes(newTag.trim());

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tagInputRef.current && !tagInputRef.current.contains(e.target as Node) &&
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.descricao || !formData.link || !formData.autor) {
      showToast('Preencha todos os campos obrigatórios', 'warning');
      return;
    }
    const hoje = new Date();
    const dataFormatada = hoje.toLocaleDateString('pt-BR');
    onAdd({ ...formData, dataPublicacao: dataFormatada });
    onClose();
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !formData.tags.includes(trimmed)) {
      setFormData({ ...formData, tags: [...formData.tags, trimmed] });
    }
    setNewTag('');
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    tagInputRef.current?.focus();
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < filteredSuggestions.length) {
        addTag(filteredSuggestions[activeSuggestionIndex]);
      } else if (newTag.trim()) {
        addTag(newTag);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Adicionar Novo Conteúdo
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <i className="ri-close-line text-2xl text-gray-500"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Título */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Título do Conteúdo *
            </label>
            <input
              type="text"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Ex: Tutorial de React Hooks"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Descrição / Sinopse *
            </label>
            <textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
              placeholder="Descreva brevemente o que o conteúdo ensina ou aborda..."
              required
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
              {formData.descricao.length}/500 caracteres
            </div>
          </div>

          {/* Link */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Link do Conteúdo *
            </label>
            <input
              type="url"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="https://..."
              required
            />
          </div>

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              URL da Thumbnail (opcional)
            </label>
            <input
              type="url"
              value={formData.thumbnail}
              onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="https://... (deixe em branco para usar imagem padrão)"
            />
            {formData.thumbnail && (
              <div className="mt-3 w-full h-40 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img
                  src={formData.thumbnail}
                  alt="Thumbnail"
                  loading="lazy"
                  className="w-full h-32 object-cover rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Autor */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Postado por
            </label>
            <div className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <i className="ri-user-line text-teal-500"></i>
              <span className="text-sm">{formData.autor || 'Carregando...'}</span>
            </div>
          </div>

          {/* Tags com Autocomplete */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="relative">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={newTag}
                    onChange={(e) => {
                      setNewTag(e.target.value);
                      setShowSuggestions(true);
                      setActiveSuggestionIndex(-1);
                    }}
                    onFocus={() => newTag.trim() && setShowSuggestions(true)}
                    onKeyDown={handleTagKeyDown}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                    placeholder="Digite uma tag e pressione Enter ou selecione uma existente"
                  />

                  {/* Dropdown de sugestões */}
                  {showSuggestions && newTag.trim() !== '' && (filteredSuggestions.length > 0 || isNewTag) && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto"
                    >
                      {filteredSuggestions.map((tag, idx) => (
                        <button
                          key={tag}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); addTag(tag); }}
                          className={`w-full text-left px-4 py-2.5 flex items-center gap-2 text-sm transition-colors cursor-pointer ${
                            activeSuggestionIndex === idx
                              ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <i className="ri-price-tag-3-line text-teal-500 text-base"></i>
                          {tag}
                        </button>
                      ))}

                      {isNewTag && (
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); addTag(newTag); }}
                          className="w-full text-left px-4 py-2.5 flex items-center gap-2 text-sm border-t border-gray-100 dark:border-gray-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors cursor-pointer"
                        >
                          <i className="ri-add-circle-line text-teal-500 text-base"></i>
                          Criar tag <strong>"{newTag.trim()}"</strong>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => newTag.trim() && addTag(newTag)}
                  className="px-5 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
                >
                  <i className="ri-add-line mr-1"></i>
                  Adicionar
                </button>
              </div>

              {existingTags.length > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1">
                  <i className="ri-lightbulb-line text-teal-400"></i>
                  Digite para buscar tags existentes ou crie uma nova
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-sm font-medium rounded-full flex items-center gap-2 whitespace-nowrap"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:bg-teal-200 dark:hover:bg-teal-800 rounded-full p-0.5 cursor-pointer"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
            >
              Adicionar Conteúdo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
