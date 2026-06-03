import { useState } from 'react';
import { inviteMember } from '../../../services/teamService';
import { useToast } from '../../../contexts/ToastContext';

interface NewMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberAdded?: () => void;
  onSuccess?: () => void;
}

export default function NewMemberModal({ isOpen, onClose, onMemberAdded, onSuccess }: NewMemberModalProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    nome: '',
    cargo: '',
    email: '',
    departamento: '',
    telefone: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.cargo || !formData.email) {
      showToast('Por favor, preencha todos os campos obrigatórios.', 'warning');
      return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showToast('Por favor, insira um email válido.', 'warning');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const result = await inviteMember({
        email: formData.email,
        nome: formData.nome,
        cargo: formData.cargo,
        departamento: formData.departamento,
        telefone: formData.telefone,
      });

      if (result.success) {
        showToast(result.message, 'success');
        
        // Aguardar 1.5s para mostrar mensagem de sucesso
        setTimeout(() => {
          handleClose();
          if (onMemberAdded) onMemberAdded();
          if (onSuccess) onSuccess();
        }, 1500);
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      console.error('Erro ao adicionar membro:', err);
      showToast('Erro ao adicionar membro. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      nome: '',
      cargo: '',
      email: '',
      departamento: '',
      telefone: '',
    });
    setError(null);
    setSuccess(null);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Adicionar Novo Membro</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Success Message */}
          {success && (
            <div className="mb-5 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-3">
                <i className="ri-checkbox-circle-line text-green-600 dark:text-green-400 text-xl"></i>
                <p className="text-sm text-green-800 dark:text-green-300">{success}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-3">
                <i className="ri-error-warning-line text-red-600 dark:text-red-400 text-xl"></i>
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-5">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome Completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                placeholder="Ex: João Silva"
                required
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                placeholder="joao@empresa.com"
                required
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Um convite será enviado para este email
              </p>
            </div>

            {/* Cargo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cargo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                placeholder="Ex: Desenvolvedor Frontend"
                required
                disabled={loading}
              />
            </div>

            {/* Departamento e Telefone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Departamento
                </label>
                <input
                  type="text"
                  value={formData.departamento}
                  onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                  placeholder="Ex: Tecnologia"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                  placeholder="(11) 99999-9999"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  <span>Adicionando...</span>
                </>
              ) : (
                <>
                  <i className="ri-user-add-line"></i>
                  <span>Adicionar Membro</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
