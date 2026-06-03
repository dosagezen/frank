import { useState, useEffect, useRef } from 'react';
import { deleteProject } from '../../../services/projectsService';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';
import ActivityTab from './ActivityTab';
import SprintsTab from './SprintsTab';
import TeamTab from './TeamTab';
import UserAvatar from '../../../components/base/UserAvatar';
import { parseDate, formatDateBR } from '../../../utils/dateHelpers';

interface ProjectDetailsModalProps {
  project: any;
  onClose: () => void;
  onEdit: (project: any) => void;
  onProjectDeleted: () => void;
  initialTab?: 'visao-geral' | 'equipe' | 'atividades' | 'sprints';
}

export default function ProjectDetailsModal({ project, onClose, onEdit, onProjectDeleted, initialTab = 'visao-geral' }: ProjectDetailsModalProps) {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'visao-geral' | 'equipe' | 'atividades' | 'sprints'>(initialTab);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [fullTeam, setFullTeam] = useState<any[]>([]);
  const [productManagerId, setProductManagerId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Atualizar aba ativa quando initialTab mudar
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Carregar equipe e PM do banco de dados
  useEffect(() => {
    const loadTeamAndPM = async () => {
      if (!project?.id) return;

      // Timeout de segurança: 12 segundos
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current) {
          console.warn('[ProjectDetailsModal] Timeout ao carregar equipe');
        }
      }, 12000);

      try {
        // Buscar membros e PM em paralelo
        const [membersRes, pmRes] = await Promise.all([
          supabase
            .from('project_members')
            .select('profile_id, nome, avatar, cargo')
            .eq('project_id', project.id),
          supabase
            .from('project_product_manager')
            .select('member_id')
            .eq('project_id', project.id)
            .maybeSingle(),
        ]);

        clearTimeout(timeoutId);
        if (!isMountedRef.current) return;

        if (pmRes.data?.member_id) {
          setProductManagerId(pmRes.data.member_id);
        }

        const membersData = membersRes.data || [];
        const profileIds = membersData.map((m: any) => m.profile_id).filter(Boolean);
        if (project.user_id && !profileIds.includes(project.user_id)) {
          profileIds.push(project.user_id);
        }

        if (profileIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, nome, cargo, avatar_url')
            .in('id', profileIds);

          if (!isMountedRef.current) return;

          const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

          const team = profileIds.map((pid: string) => {
            const profile = profilesMap.get(pid);
            const memberRow = membersData.find((m: any) => m.profile_id === pid);
            return {
              profile_id: pid,
              nome: profile?.nome || memberRow?.nome || 'Sem nome',
              cargo: profile?.cargo || memberRow?.cargo || '',
              avatar: profile?.avatar_url || memberRow?.avatar || null,
              isCreator: pid === project.user_id,
            };
          });

          setFullTeam(team);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('Erro ao carregar equipe:', err);
      }
    };

    loadTeamAndPM();
  }, [project?.id]);

  // Verificar permissões
  useEffect(() => {
    const checkPermissions = async () => {
      if (!user) { setCanManage(false); return; }
      if (isAdmin) { setCanManage(true); return; }
      if (project.user_id === user.id) { setCanManage(true); return; }

      try {
        const { data: memberData } = await supabase
          .from('project_members')
          .select('id')
          .eq('project_id', project.id)
          .eq('profile_id', user.id)
          .maybeSingle();

        if (isMountedRef.current) setCanManage(!!memberData);
      } catch {
        if (isMountedRef.current) setCanManage(false);
      }
    };

    checkPermissions();
  }, [user, isAdmin, project]);

  const handleEditProject = () => {
    onEdit(project);
  };

  const handleDeleteProject = () => {
    setShowDeleteProjectConfirm(true);
    setDeleteError(null);
  };

  const confirmDeleteProject = async () => {
    if (!project.id) {
      setDeleteError('ID do projeto não encontrado');
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError(null);
      
      await deleteProject(project.id);
      
      setShowDeleteProjectConfirm(false);
      onClose();
      onProjectDeleted();
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      setDeleteError('Erro ao excluir projeto. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ✅ NOVA FUNÇÃO: Calcular status de prazo usando deadline
  const getDeadlineStatus = (): 'on-time' | 'overdue' | 'completed-on-time' | 'completed-late' | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!project.deadline) return null;

    const deadline = parseDate(project.deadline)!;
    deadline.setHours(0, 0, 0, 0);

    if (project.prazo) {
      const prazo = parseDate(project.prazo)!;
      prazo.setHours(0, 0, 0, 0);

      if (prazo > deadline) {
        return 'completed-late';
      }
      return 'completed-on-time';
    }

    if (deadline < today) {
      return 'overdue';
    }

    return 'on-time';
  };

  // ✅ NOVA FUNÇÃO: Obter badge de status de prazo
  const getDeadlineStatusBadge = () => {
    const status = getDeadlineStatus();
    
    if (!status) return null;

    switch (status) {
      case 'overdue':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm font-semibold">
            <i className="ri-alarm-warning-line text-base"></i>
            Atrasado
          </div>
        );
      case 'completed-late':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg text-sm font-semibold">
            <i className="ri-error-warning-line text-base"></i>
            Concluído com atraso
          </div>
        );
      case 'completed-on-time':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-semibold">
            <i className="ri-checkbox-circle-line text-base"></i>
            Concluído no prazo
          </div>
        );
      case 'on-time':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-semibold">
            <i className="ri-time-line text-base"></i>
            Em andamento
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'concluida':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'em-andamento':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pendente':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluida':
        return 'ri-checkbox-circle-fill';
      case 'em-andamento':
        return 'ri-time-line';
      case 'pendente':
        return 'ri-checkbox-blank-circle-line';
      default:
        return 'ri-checkbox-blank-circle-line';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'concluida':
        return 'Concluída';
      case 'em-andamento':
        return 'Em Andamento';
      case 'pendente':
        return 'Pendente';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'media':
        return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
      case 'baixa':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'alta':
        return 'Alta';
      case 'media':
        return 'Média';
      case 'baixa':
        return 'Baixa';
      default:
        return priority;
    }
  };

  const getKanbanStageText = (stage: string) => {
    switch (stage) {
      case 'backlog':
        return 'Backlog';
      case 'desafio':
        return 'Desafio';
      case 'persona':
        return 'Persona';
      case 'proposta-valor':
        return 'Proposta de Valor';
      case 'validacao':
        return 'Validação';
      case 'mvp':
        return 'MVP';
      default:
        return stage;
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length <= 2) {
      return cleaned;
    } else if (cleaned.length <= 3) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    } else if (cleaned.length <= 7) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 3)} ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 3)} ${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const dateStr = date.toLocaleDateString('pt-BR');
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return { date: dateStr, time: timeStr };
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'feito':
      case 'concluida':
      case 'concluido':
      case 'done':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'em-andamento':
      case 'fazendo':
      case 'doing':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'fazer':
      case 'pendente':
      case 'todo':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'feito':
      case 'concluida':
      case 'concluido':
      case 'done':
        return 'ri-checkbox-circle-fill';
      case 'em-andamento':
      case 'fazendo':
      case 'doing':
        return 'ri-time-line';
      case 'fazer':
      case 'pendente':
      case 'todo':
        return 'ri-checkbox-blank-circle-line';
      default:
        return 'ri-checkbox-blank-circle-line';
    }
  };

  const getTaskStatusLabel = (status: string) => {
    switch (status) {
      case 'feito':
      case 'concluida':
      case 'concluido':
      case 'done':
        return 'Concluída';
      case 'em-andamento':
      case 'fazendo':
      case 'doing':
        return 'Em Andamento';
      case 'fazer':
      case 'pendente':
      case 'todo':
        return 'A Fazer';
      default:
        return status;
    }
  };

  const getTaskPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'alta':
        return 'ri-arrow-up-line text-red-500';
      case 'media':
        return 'ri-arrow-right-line text-amber-500';
      case 'baixa':
        return 'ri-arrow-down-line text-green-500';
      default:
        return 'ri-subtract-line text-gray-400';
    }
  };

  // Função para calcular progresso baseado nas tarefas reais
  const calcProgress = () => {
    const total = project.total_tarefas || 0;
    const concluidas = project.tarefas_concluidas || 0;
    if (total === 0) return 0;
    return Math.round((concluidas / total) * 100);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
        <div 
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            {/* Coluna 1: Informações do Projeto - 4 colunas */}
            <div className={`col-span-1 ${canManage ? 'sm:col-span-4' : 'sm:col-span-5'} min-w-0`}>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 truncate">
                {project.nome}
              </h2>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 line-clamp-2">
                {project.descricao}
              </p>
              {!canManage && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-xs font-medium">
                  <i className="ri-eye-line text-sm"></i>
                  Somente visualização
                </div>
              )}
            </div>

            {/* Coluna 2: Botão Editar - 1 coluna (só aparece se pode gerenciar) */}
            {canManage && (
              <div className="col-span-1 sm:col-span-1 flex items-center justify-center">
                <button 
                  onClick={handleEditProject}
                  className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="ri-edit-line text-lg"></i>
                  Editar
                </button>
              </div>
            )}

            {/* Coluna 3: Botão Excluir + Fechar - 1 coluna */}
            <div className="col-span-1 sm:col-span-1 flex items-center justify-end gap-2">
              {canManage && (
                <button 
                  onClick={handleDeleteProject}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
                >
                  <i className="ri-delete-bin-line text-lg"></i>
                  Excluir
                </button>
              )}
              <button 
                onClick={onClose}
                className="p-2.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 sm:gap-2 px-4 sm:px-6 pt-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto flex-shrink-0">
            <button
              onClick={() => setActiveTab('visao-geral')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'visao-geral'
                  ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <i className="ri-dashboard-line mr-1 sm:mr-2"></i>
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('sprints')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'sprints'
                  ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <i className="ri-stack-line mr-1 sm:mr-2"></i>
              Sprints
            </button>
            <button
              onClick={() => setActiveTab('equipe')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'equipe'
                  ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <i className="ri-team-line mr-1 sm:mr-2"></i>
              Equipe
            </button>
            <button
              onClick={() => setActiveTab('atividades')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'atividades'
                  ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <i className="ri-list-check-2 mr-1 sm:mr-2"></i>
              Atividades
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {activeTab === 'visao-geral' && (
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Descrição
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                    {project.descricao}
                  </p>
                </div>

                {/* Progress */}
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Progresso do Projeto
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Conclusão
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {project.tarefas_concluidas || 0}/{project.total_tarefas || 0} tarefas
                        </span>
                        <span className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                          {calcProgress()}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                      <div
                        className="bg-teal-600 dark:bg-teal-500 h-3 rounded-full transition-all"
                        style={{ width: `${calcProgress()}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Informações
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 flex items-center justify-center bg-teal-100 dark:bg-teal-900/20 rounded-lg">
                          <i className="ri-flow-chart text-lg text-teal-600 dark:text-teal-400"></i>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Etapa do Kanban</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {getKanbanStageText(project.kanban_stage)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 flex items-center justify-center bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                          <i className="ri-team-line text-lg text-purple-600 dark:text-purple-400"></i>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Equipe</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {fullTeam.length} {fullTeam.length === 1 ? 'membro' : 'membros'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 flex items-center justify-center bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                          <i className="ri-task-line text-lg text-blue-600 dark:text-blue-400"></i>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Tarefas</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {project.tarefas_concluidas || 0}/{project.total_tarefas || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                          <i className="ri-flag-line text-lg text-amber-600 dark:text-amber-400"></i>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Prioridade</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {getPriorityText(project.prioridade)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {project.cor && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 flex items-center justify-center rounded-lg" style={{ backgroundColor: project.cor }}>
                            <i className="ri-palette-line text-lg text-white"></i>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Cor do Projeto</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{project.cor}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Datas + Badge de Status */}
                {(project.data_inicio || project.deadline || project.prazo) && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Cronograma
                      </h3>
                      {getDeadlineStatusBadge()}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {project.data_inicio && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center bg-green-100 dark:bg-green-900/20 rounded-lg">
                              <i className="ri-calendar-check-line text-lg text-green-600 dark:text-green-400"></i>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Data Início</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {formatDateBR(project.data_inicio)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      {project.deadline && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                              <i className="ri-calendar-event-line text-lg text-amber-600 dark:text-amber-400"></i>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Deadline</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {formatDateBR(project.deadline)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Prazo planejado
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      {project.prazo && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                              <i className="ri-checkbox-circle-line text-lg text-blue-600 dark:text-blue-400"></i>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Data Término</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {formatDateBR(project.prazo)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Concluído em
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Product Manager - ✅ CORRIGIDO: Usar productManagerId do banco */}
                {productManagerId && fullTeam.length > 0 && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Product Manager (PM)
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      {(() => {
                        const pm = fullTeam.find((m: any) => m.profile_id === productManagerId);
                        return pm ? (
                          <div className="flex items-center gap-4">
                            <UserAvatar
                              avatarUrl={pm.avatar}
                              nome={pm.nome}
                              size="xl"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {pm.nome}
                              </h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {pm.cargo}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">Não definido</p>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Setores Demandantes e Contatos */}
                {project.sectorContacts && project.sectorContacts.length > 0 && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      P.O (Product Owner) / Setores Demandantes e Contatos
                    </h3>
                    <div className="space-y-3">
                      {project.sectorContacts.map((sector: any) => (
                        <div
                          key={sector.id}
                          className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-2.5 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-md text-xs font-bold">
                              {sector.sigla}
                            </span>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {sector.nome_setor}
                            </h4>
                          </div>

                          {sector.contatos && sector.contatos.length > 0 ? (
                            <div className="space-y-2">
                              {sector.contatos.map((contact: any) => (
                                <div
                                  key={contact.id}
                                  className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                                >
                                  <div className="w-8 h-8 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-full flex-shrink-0">
                                    <i className="ri-user-line text-sm text-teal-600 dark:text-teal-400"></i>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {contact.nome}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                      {contact.email && (
                                        <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                          <i className="ri-mail-line mr-1"></i>
                                          {contact.email}
                                        </span>
                                      )}
                                      {contact.telefone && (
                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                          <i className="ri-phone-line mr-1"></i>
                                          {formatPhoneNumber(contact.telefone)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                              Nenhum contato cadastrado
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Parado - Log de Justificativas */}
                {project.stopLogs && project.stopLogs.length > 0 && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Histórico de Paradas
                    </h3>
                    <div className="space-y-3">
                      {project.stopLogs.map((log: any, index: number) => {
                        const { date, time } = formatDateTime(log.data_parada);
                        return (
                          <div
                            key={log.id}
                            className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
                          >
                            <p className="text-sm text-gray-900 dark:text-white mb-2 leading-relaxed">
                              {log.justificativa}
                            </p>
                            <p className="text-xs font-mono text-gray-600 dark:text-gray-400">
                              #{index + 1} - {getKanbanStageText(log.kanban_stage)} - {date} às {time} - {log.usuario}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Agregado */}
                {project.agregado && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Agregado
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center bg-teal-100 dark:bg-teal-900/20 rounded-lg">
                          <i className="ri-folder-line text-lg text-teal-600 dark:text-teal-400"></i>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Projeto Relacionado</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {project.agregado}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Entregáveis */}
                {project.entregaveis && project.entregaveis.length > 0 && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Entregáveis
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {project.entregaveis.map((entregavel: any, index: number) => (
                        <div
                          key={index}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg border border-purple-200 dark:border-purple-800"
                        >
                          <i className="ri-price-tag-3-line text-sm"></i>
                          <span className="text-sm font-medium capitalize">{entregavel.nome || entregavel}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links Úteis */}
                {project.links && project.links.length > 0 && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Links Úteis
                    </h3>
                    <div className="space-y-2">
                      {project.links.map((link: any) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-teal-500 dark:hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-all cursor-pointer group"
                        >
                          <div className="w-10 h-10 flex items-center justify-center bg-teal-100 dark:bg-teal-900/20 rounded-lg group-hover:bg-teal-200 dark:group-hover:bg-teal-900/30 transition-all flex-shrink-0">
                            <i className="ri-link text-lg text-teal-600 dark:text-teal-400"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {link.title}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                              {link.url}
                            </p>
                          </div>
                          <div className="w-8 h-8 flex items-center justify-center text-gray-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-all flex-shrink-0">
                            <i className="ri-external-link-line text-lg"></i>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'sprints' && (
              <SprintsTab project={project} />
            )}

            {activeTab === 'equipe' && (
              <TeamTab project={project} />
            )}

            {activeTab === 'atividades' && (
              <ActivityTab projectId={project.id} />
            )}
          </div>
        </div>
      </div>

      {/* Delete Project Confirmation Modal */}
      {showDeleteProjectConfirm && (
        <div 
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setShowDeleteProjectConfirm(false);
              setDeleteError(null);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 flex items-center justify-center bg-red-100 dark:bg-red-900/30 rounded-full flex-shrink-0">
                <i className="ri-alert-line text-2xl text-red-600 dark:text-red-400"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Excluir o Projeto?
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Esta ação não pode ser desfeita
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                  <i className="ri-error-warning-line text-red-600 dark:text-red-400"></i>
                  <p className="text-sm text-red-800 dark:text-red-300">{deleteError}</p>
                </div>
              )}
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Tem certeza que deseja excluir o projeto <strong>{project.nome}</strong>?
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                O projeto será <strong>permanentemente removido</strong> e não poderá ser recuperado. Todos os dados associados, incluindo sprints, tarefas, arquivos e histórico também serão excluídos.
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteProjectConfirm(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteProject}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Excluindo...
                  </>
                ) : (
                  'Excluir Projeto'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
