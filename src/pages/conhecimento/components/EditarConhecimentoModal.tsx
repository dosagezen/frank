import { useState } from 'react';
import type { ConhecimentoItem } from '../../../mocks/conhecimento';
import { useToast } from '../../../contexts/ToastContext';

interface EditarConhecimentoModalProps {
  conhecimento: ConhecimentoItem;
  onClose: () => void;
  onSave: (conhecimento: ConhecimentoItem) => void;
}

export default function EditarConhecimentoModal({ conhecimento, onClose, onSave }: EditarConhecimentoModalProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    titulo: conhecimento.titulo,
    descricao: conhecimento.descricao,
    link: conhecimento.link,
    thumbnail: conhecimento.thumbnail,
    tags: conhecimento.tags
  });
  const [newTag, setNewTag] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.titulo || !formData.descricao || !formData.link) {
      showToast('Preencha todos os campos obrigatórios', 'warning');
      return;
    }

    onSave({
      ...conhecimento,
      ...formData
    });
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
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
            Editar Conteúdo
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

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Digite uma tag e pressione Enter"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
              >
                <i className="ri-add-line mr-1"></i>
                Adicionar
              </button>
            </div>
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
                    className="hover:bg-teal-200 dark:hover:bg-teal-800 rounded-full p-0.5"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Autor:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{conhecimento.autor}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Publicado em:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{conhecimento.dataPublicacao}</span>
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
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
