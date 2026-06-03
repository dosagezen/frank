import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { fetchAllMembers } from '../../../services/teamService';
import { useAuth } from '../../../contexts/AuthContext';
import { safeFetchMany } from '../../../services/supabaseHelpers';
import { useToast } from '../../../contexts/ToastContext';
import DatePicker from '../../../components/base/DatePicker';
import UserAvatar from '../../../components/base/UserAvatar';
import { formatDateBR } from '../../../utils/dateHelpers';

interface NewTaskModalProps {
  isOpen?: boolean;
  onClose: () => void;
  taskToEdit?: any;
}

interface Project {
  id: string;
  nome: string;
  user_id: string;
}

interface Sprint {
  id: string;
  name: string;
  end_date: string;
}

interface TeamMember {
  id: string;
  nome: string;
  cargo: string;
  avatar_url: string | null;
}

export default function NewTaskModal({ isOpen, onClose, taskToEdit }: NewTaskModalProps) {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project: '',
    sprint: '',
    status: 'fazer',
    priority: 'media',
    assignee: '',
    dueDate: '',
    tags: [] as string[],
    categoria: '',
    tempoEstimado: '',
    recurrenceType: 'none',
    recurrenceEndDate: '',
    observacoes: ''
  });

  const [tagInput, setTagInput] = useState('');
  const [availableSprints, setAvailableSprints] = useState<Sprint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Carregar projetos do Supabase
  useEffect(() => {
    if (isOpen && user) {
      loadProjects();
      loadTeamMembers();
    }
  }, [isOpen, user, isAdmin]);

  const loadProjects = async () => {
    try {
      if (!user) return;

      if (isAdmin) {
        // Admin vê todos os projetos
        const projectsData = await safeFetchMany(async () =>
          supabase
            .from('projects')
            .select('id, nome, user_id')
            .order('nome', { ascending: true })
        );

        setProjects(projectsData);
      } else {
        // Buscar projetos onde o usuário é criador
        const ownProjects = await safeFetchMany(async () =>
          supabase
            .from('projects')
            .select('id, nome, user_id')
            .eq('user_id', user.id)
            .order('nome', { ascending: true })
        );

        // Buscar projetos onde o usuário é membro
        const memberProjectsRel = await safeFetchMany(async () =>
          supabase
            .from('project_members')
            .select('project_id')
            .eq('profile_id', user.id)
        );

        const memberProjectIds = memberProjectsRel.map(mp => mp.project_id);

        if (memberProjectIds.length > 0) {
          const memberProjectsData = await safeFetchMany(async () =>
            supabase
              .from('projects')
              .select('id, nome, user_id')
              .in('id', memberProjectIds)
              .order('nome', { ascending: true })
          );

          // Combinar projetos próprios e projetos onde é membro (sem duplicatas)
          const allProjects = [...ownProjects];
          memberProjectsData.forEach(mp => {
            if (!allProjects.find(p => p.id === mp.id)) {
              allProjects.push(mp);
            }
          });

          // Ordenar por nome
          allProjects.sort((a, b) => a.nome.localeCompare(b.nome));
          setProjects(allProjects);
        } else {
          setProjects(ownProjects);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
    }
  };

  const loadTeamMembers = async () => {
    try {
      setLoadingMembers(true);
      const members = await fetchAllMembers();
      setTeamMembers(members);
    } catch (error) {
      console.error('Erro ao carregar membros da equipe:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Atualizar sprints quando o projeto for selecionado
  useEffect(() => {
    if (formData.project) {
      loadSprints(formData.project);
    } else {
      setAvailableSprints([]);
    }
    setFormData(prev => ({ ...prev, sprint: '' }));
  }, [formData.project]);

  const loadSprints = async (projectId: string) => {
    try {
      const sprints = await safeFetchMany(async () =>
        supabase
          .from('project_sprints')
          .select('id, name, end_date')
          .eq('project_id', projectId)
          .order('sprint_order', { ascending: true })
      );

      setAvailableSprints(sprints);
    } catch (error) {
      console.error('Erro ao carregar sprints:', error);
      setAvailableSprints([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const maxSize = 50 * 1024 * 1024; // 50MB

    // Validar tamanho dos arquivos
    const invalidFiles = newFiles.filter(file => file.size > maxSize);
    if (invalidFiles.length > 0) {
      showToast(`Arquivos excedem o limite de 50MB: ${invalidFiles.map(f => f.name).join(', ')}`, 'warning');
      return;
    }

    setAttachments(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return 'ri-file-pdf-line';
    if (type.includes('image')) return 'ri-image-line';
    if (type.includes('video')) return 'ri-video-line';
    if (type.includes('word') || type.includes('document')) return 'ri-file-word-line';
    if (type.includes('excel') || type.includes('spreadsheet')) return 'ri-file-excel-line';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'ri-file-ppt-line';
    if (type.includes('zip') || type.includes('rar')) return 'ri-file-zip-line';
    return 'ri-file-line';
  };

  const uploadAttachments = async (taskId: string, userId: string) => {
    if (attachments.length === 0) return;

    setUploading(true);
    try {
      for (const file of attachments) {
        // Upload do arquivo para o Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Obter URL pública do arquivo
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        // Salvar metadados no banco de dados
        const { error: dbError } = await supabase
          .from('files')
          .insert([{
            user_id: userId,
            name: file.name,
            type: file.type,
            size: file.size,
            url: publicUrl,
            storage_path: fileName,
            task_id: taskId,
            project_id: formData.project || null
          }]);

        if (dbError) throw dbError;
      }
    } catch (error) {
      console.error('Erro ao fazer upload dos anexos:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.assignee || !formData.dueDate) {
      showToast('Por favor, preencha todos os campos obrigatórios', 'warning');
      return;
    }

    // Validar permissão no projeto selecionado
    if (formData.project && !isAdmin) {
      if (!user) {
        showToast('Usuário não autenticado', 'error');
        return;
      }

      // Buscar informações do projeto
      const projectData = projects.find(p => p.id === formData.project);

      if (!projectData) {
        showToast('Projeto não encontrado', 'error');
        return;
      }

      const isOwner = projectData.user_id === user.id;

      // Se não é o criador, verificar se é membro
      if (!isOwner) {
        const memberData = await safeFetchMany(async () =>
          supabase
            .from('project_members')
            .select('id')
            .eq('project_id', formData.project)
            .eq('profile_id', user.id)
        );

        if (memberData.length === 0) {
          showToast('Você não tem permissão para criar tarefas neste projeto', 'error');
          return;
        }
      }
    }

    // Validar data de término da recorrência
    if (formData.recurrenceType !== 'none' && formData.recurrenceEndDate) {
      const startDate = new Date(formData.dueDate);
      const endDate = new Date(formData.recurrenceEndDate);
      if (endDate < startDate) {
        showToast('A data de término da recorrência não pode ser anterior à data inicial', 'warning');
        return;
      }
    }

    try {
      setLoading(true);
      
      if (!user) {
        showToast('Usuário não autenticado', 'error');
        return;
      }

      // Buscar dados atualizados do responsável SEMPRE da tabela profiles (fonte da verdade)
      const { data: assigneeProfile } = await supabase
        .from('profiles')
        .select('nome, avatar_url')
        .eq('id', formData.assignee)
        .maybeSingle();

      const taskData = {
        user_id: user.id,
        title: formData.title,
        description: formData.description || null,
        project_id: formData.project || null,
        sprint_id: formData.sprint || null,
        status: formData.status,
        priority: formData.priority,
        responsavel_id: formData.assignee,
        assignee: assigneeProfile?.nome || '',
        due_date: formData.dueDate,
        tags: formData.tags.length > 0 ? formData.tags : null,
        categoria: formData.categoria || null,
        tempo_estimado: formData.tempoEstimado || null,
        progress: formData.status === 'feito' ? 100 : 0,
        recurrence_type: formData.recurrenceType,
        recurrence_end_date: formData.recurrenceType !== 'none' && formData.recurrenceEndDate ? formData.recurrenceEndDate : null,
        recurrence_parent_id: null,
        observacoes: formData.observacoes || null,
        updated_at: new Date().toISOString()
      };

      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (error) throw error;

      // Upload dos anexos
      if (attachments.length > 0) {
        await uploadAttachments(newTask.id, user.id);
      }

      showToast('Tarefa criada com sucesso!', 'success');
      
      setFormData({
        title: '',
        description: '',
        status: 'fazer',
        priority: 'media',
        project: '',
        sprint: '',
        assignee: '',
        dueDate: '',
        tags: [],
        categoria: '',
        tempoEstimado: '',
        recurrenceType: 'none',
        recurrenceEndDate: '',
        observacoes: ''
      });
      setTagInput('');
      setAttachments([]);
      onClose();
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
      showToast('Erro ao criar tarefa. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) });
  };

  const handleCloseModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onClose();
  };

  const getRecurrenceSummary = () => {
    if (formData.recurrenceType === 'none') return null;
    
    let summary = 'Repete ';
    switch (formData.recurrenceType) {
      case 'daily':
        summary += 'diariamente';
        break;
      case 'weekly':
        summary += 'semanalmente';
        break;
      case 'biweekly':
        summary += 'quinzenalmente';
        break;
      case 'monthly':
        summary += 'mensalmente';
        break;
      case 'bimonthly':
        summary += 'bimestralmente';
        break;
      case 'quarterly':
        summary += 'trimestralmente';
        break;
      case 'yearly':
        summary += 'anualmente';
        break;
    }
    
    if (formData.recurrenceEndDate) {
      summary += ` até ${new Date(formData.recurrenceEndDate).toLocaleDateString('pt-BR')}`;
    } else {
      summary += ' (sem data de término)';
    }
    
    return summary;
  };

  // Não renderizar se não estiver aberto
  if (isOpen === false) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleCloseModal}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Nova Tarefa
          </h2>
          <button
            type="button"
            onClick={handleCloseModal}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
            {/* Título */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Título da Tarefa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                placeholder="Ex: Implementar nova funcionalidade"
                required
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setFormData({ ...formData, description: e.target.value });
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                rows={4}
                placeholder="Descreva os detalhes da tarefa..."
                maxLength={500}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                {formData.description.length}/500 caracteres
              </div>
            </div>

            {/* Projeto e Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Projeto
                </label>
                <select
                  value={formData.project}
                  onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                  className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundPosition: 'right 12px center'
                  }}
                >
                  <option value="">Sem projeto</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundPosition: 'right 12px center'
                  }}
                >
                  <option value="fazer">Fazer</option>
                  <option value="fazendo">Fazendo</option>
                  <option value="feito">Feito</option>
                  <option value="aguardando">Aguardando</option>
                  <option value="parado">Parado</option>
                </select>
              </div>
            </div>

            {/* Sprint */}
            {formData.project && availableSprints.length > 0 && (
              <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Sprint do Projeto
                </label>
                <select
                  value={formData.sprint}
                  onChange={(e) => setFormData({ ...formData, sprint: e.target.value })}
                  className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundPosition: 'right 12px center'
                  }}
                >
                  <option value="">Nenhuma sprint selecionada</option>
                  {availableSprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name} - Até {formatDateBR(sprint.end_date)}
                    </option>
                  ))}
                </select>
                {formData.sprint && (
                  <p className="text-xs text-teal-700 dark:text-teal-400 mt-2 flex items-center gap-1">
                    <i className="ri-information-line"></i>
                    Esta tarefa será vinculada à sprint selecionada
                  </p>
                )}
              </div>
            )}

            {formData.project && availableSprints.length === 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <i className="ri-alert-line"></i>
                  Este projeto não possui sprints cadastradas
                </p>
              </div>
            )}

            {/* Prioridade e Responsável */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Prioridade
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundPosition: 'right 12px center'
                  }}
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>

              {/* Responsável */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Responsável <span className="text-red-500">*</span>
                </label>
                {loadingMembers ? (
                  <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg flex items-center gap-2">
                    <i className="ri-loader-4-line animate-spin text-gray-400"></i>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Carregando...
                    </span>
                  </div>
                ) : (
                  <select
                    value={formData.assignee}
                    onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                    className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundPosition: 'right 12px center'
                    }}
                    required
                  >
                    <option value="">Selecione um responsável</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.nome} {member.cargo ? `- ${member.cargo}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {formData.assignee && (
                  <div className="mt-2 flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    {(() => {
                      const selectedMember = teamMembers.find(m => m.id === formData.assignee);
                      if (!selectedMember) return null;
                      return (
                        <>
                          <UserAvatar
                            avatarUrl={selectedMember.avatar_url}
                            nome={selectedMember.nome}
                            size="sm"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {selectedMember.nome}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Categoria e Tempo Estimado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Categoria
                </label>
                <input
                  type="text"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Ex: Desenvolvimento, Design..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Tempo Estimado
                </label>
                <input
                  type="text"
                  value={formData.tempoEstimado}
                  onChange={(e) => setFormData({ ...formData, tempoEstimado: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Ex: 4 horas, 2 dias..."
                />
              </div>
            </div>

            {/* Data de Entrega e Recorrência */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Data Entrega <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={formData.dueDate}
                  onChange={(val) => setFormData({ ...formData, dueDate: val })}
                  placeholder="Selecione a data"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <i className="ri-repeat-line text-teal-600 dark:text-teal-400"></i>
                  Recorrência
                </label>
                <select
                  value={formData.recurrenceType}
                  onChange={(e) => setFormData({ ...formData, recurrenceType: e.target.value })}
                  className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundPosition: 'right 12px center'
                  }}
                >
                  <option value="none">Não se repete</option>
                  <option value="daily">Diário</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="monthly">Mensal</option>
                  <option value="bimonthly">Bimestral</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
            </div>

            {/* Detalhes da Recorrência */}
            {formData.recurrenceType !== 'none' && (
              <p className="text-sm text-teal-700 dark:text-teal-400 flex items-center gap-2 -mt-2">
                <i className="ri-information-line"></i>
                <span className="font-medium">{getRecurrenceSummary()}</span>
              </p>
            )}

            {/* Tags */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Digite uma tag e pressione Enter"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-lg text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-teal-900 dark:hover:text-teal-300 cursor-pointer"
                      >
                        <i className="ri-close-line"></i>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <i className="ri-sticky-note-line text-teal-600 dark:text-teal-400"></i>
                Observações / Notas Internas
              </label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setFormData({ ...formData, observacoes: e.target.value });
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                rows={3}
                placeholder="Anotações internas, lembretes ou observações sobre esta tarefa..."
                maxLength={500}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                {formData.observacoes.length}/500 caracteres
              </div>
            </div>

            {/* Anexos */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Anexar Arquivos
              </label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
                <label className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-upload-cloud-line text-4xl text-gray-400 dark:text-gray-500"></i>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Clique para selecionar arquivos ou arraste aqui
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Tamanho máximo: 50MB por arquivo
                    </p>
                  </div>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Lista de arquivos selecionados */}
              {attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Arquivos selecionados ({attachments.length}):
                  </p>
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-lg flex-shrink-0">
                        <i className={`${getFileIcon(file.type)} text-lg text-teal-600 dark:text-teal-400`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(index)}
                        className="w-8 h-8 flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                      >
                        <i className="ri-close-line text-lg"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer"
              disabled={loading || uploading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || uploading || loadingMembers}
            >
              {loading ? (uploading ? 'Enviando anexos...' : 'Criando...') : 'Criar Tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
