import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import NewProjectModal from "./components/NewProjectModal";
import ProjectDetailsModal from "./components/ProjectDetailsModal";
import { useToast } from "../../contexts/ToastContext";
import UserAvatar from "../../components/base/UserAvatar";
import { useCachedData } from "../../hooks/useCachedData";
import { CACHE_KEYS } from "../../services/localCache";
import { fetchProjects, invalidateProjectCaches } from "../../services/projectsService";
import PageLoading from "../../components/PageLoading";
import PageError from "../../components/PageError";

interface TeamMemberDisplay {
  profile_id: string;
  nome: string;
  avatar: string;
  cargo: string;
  isCreator?: boolean;
}

interface ProjectTasksData {
  total: number;
  concluidas: number;
}

export default function ProjetosPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightRef = useRef<HTMLDivElement>(null);

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [initialTab, setInitialTab] = useState<'visao-geral' | 'equipe' | 'atividades' | 'sprints'>('visao-geral');

  // ✅ Hook principal de projetos
  const { data: projects, loading, error, retry, invalidate } = useCachedData(
    CACHE_KEYS.PROJECTS,
    fetchProjects,
    { ttl: 3 * 60 * 1000 }
  );

  // ✅ Hook para equipes (teams + PMs)
  const fetchTeamsData = useCallback(async () => {
    if (!projects || projects.length === 0) {
      return { teams: {}, pms: {} };
    }

    const projectIds = projects.map((p: any) => p.id);

    const [membersResult, pmsResult] = await Promise.all([
      supabase
        .from('project_members')
        .select('project_id, profile_id')
        .in('project_id', projectIds),
      supabase
        .from('project_product_manager')
        .select('project_id, member_id')
        .in('project_id', projectIds)
    ]);

    const allMembers = membersResult.data || [];
    const allPMs = pmsResult.data || [];

    const allProfileIds = new Set<string>();
    allMembers.forEach(m => allProfileIds.add(m.profile_id));
    projects.forEach((p: any) => {
      if (p.user_id) allProfileIds.add(p.user_id);
    });

    const profileIdsArray = Array.from(allProfileIds).filter(Boolean);
    let profilesMap = new Map<string, any>();

    if (profileIdsArray.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome, avatar_url, cargo')
        .in('id', profileIdsArray);

      if (profiles) {
        profiles.forEach(p => profilesMap.set(p.id, p));
      }
    }

    const teamsObj: Record<string, TeamMemberDisplay[]> = {};

    projects.forEach((project: any) => {
      const projectId = project.id;
      const creatorId = project.user_id;

      const memberEntries = allMembers.filter(m => m.project_id === projectId);
      const members: TeamMemberDisplay[] = memberEntries.map(m => {
        const profile = profilesMap.get(m.profile_id);
        return {
          profile_id: m.profile_id,
          nome: profile?.nome || 'Sem nome',
          avatar: profile?.avatar_url || '', // ✅ Deixar vazio - UserAvatar faz fallback
          cargo: profile?.cargo || 'Membro',
          isCreator: m.profile_id === creatorId,
        };
      });

      const creatorInTeam = members.some(m => m.profile_id === creatorId);

      if (!creatorInTeam && creatorId) {
        const creatorProfile = profilesMap.get(creatorId);
        if (creatorProfile) {
          members.unshift({
            profile_id: creatorId,
            nome: creatorProfile.nome || 'Usuário',
            avatar: creatorProfile.avatar_url || '', // ✅ Deixar vazio
            cargo: creatorProfile.cargo || 'Membro',
            isCreator: true,
          });
        }
      }

      teamsObj[projectId] = members;
    });

    const pmsObj: Record<string, string> = {};
    allPMs.forEach(pm => {
      pmsObj[pm.project_id] = pm.member_id;
    });

    return { teams: teamsObj, pms: pmsObj };
  }, [projects]);

  const { data: teamsData } = useCachedData(
    CACHE_KEYS.PROJECTS_TEAMS,
    fetchTeamsData,
    { ttl: 3 * 60 * 1000, enabled: !!projects && projects.length > 0 }
  );

  // ✅ Hook para tarefas
  const fetchTasksData = useCallback(async () => {
    if (!projects || projects.length === 0) {
      return ;
    }

    const { data: allTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, project_id, status');

    if (tasksError) {
      console.error('[TASKS ERROR]', tasksError);
      return {};
    }

    const tasksObj: Record<string, ProjectTasksData> = {};
    
    projects.forEach((project: any) => {
      const projectTasks = allTasks?.filter(t => t.project_id === project.id) || [];
      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter(t => t.status === 'feito').length;
      
      tasksObj[project.id] = { total: totalTasks, concluidas: completedTasks };
    });

    return tasksObj;
  }, [projects]);

  const { data: tasksData } = useCachedData(
    CACHE_KEYS.PROJECTS_TASKS,
    fetchTasksData,
    { ttl: 3 * 60 * 1000, enabled: !!projects && projects.length > 0 }
  );

  // Callback para invalidar cache após salvar/excluir
  const handleProjectChanged = useCallback(async () => {
    await invalidateProjectCaches();
    invalidate();
  }, [invalidate]);

  const getProgress = (projectId: string): number => {
    if (!tasksData || !tasksData[projectId]) return 0;
    const { total, concluidas } = tasksData[projectId];
    return total === 0 ? 0 : Math.round((concluidas / total) * 100);
  };

  const getTotalTasks = (projectId: string): number => {
    return tasksData?.[projectId]?.total || 0;
  };

  const getCompletedTasks = (projectId: string): number => {
    return tasksData?.[projectId]?.concluidas || 0;
  };

  const getProjectTeam = (project: any): TeamMemberDisplay[] => {
    return teamsData?.teams?.[project.id] || [];
  };

  const getProjectPM = (project: any): TeamMemberDisplay | null => {
    if (!teamsData?.pms || !teamsData?.teams) return null;
    
    const pmId = teamsData.pms[project.id];
    if (!pmId) return null;

    const team = teamsData.teams[project.id] || [];
    return team.find(m => m.profile_id === pmId) || null;
  };

  // ✅ NOVA FUNÇÃO: Calcular status de prazo usando deadline
  const getDeadlineStatus = (project: any): 'on-time' | 'overdue' | 'completed-on-time' | 'completed-late' | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!project.deadline) return null;

    const deadline = new Date(project.deadline + 'T12:00:00');
    deadline.setHours(0, 0, 0, 0);

    if (project.prazo) {
      const prazo = new Date(project.prazo + 'T12:00:00');
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

  // Captura o estado de navegação vindo da busca global
  useEffect(() => {
    const state = location.state as { searchQuery?: string; projectId?: string } | null;
    if (state?.searchQuery) {
      setSearchTerm(state.searchQuery);
      setFilterStatus('all');
    }
    if (state?.projectId) {
      setHighlightedProjectId(state.projectId);
    }
    // Limpa o state da navegação para não persistir ao recarregar
    window.history.replaceState({}, '');
  }, [location.state]);

  // Scroll para o projeto destacado após carregar
  useEffect(() => {
    if (!loading && highlightedProjectId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [loading, highlightedProjectId, projects]);

  // Detectar query param ?projectId=xxx para abrir projeto via notificação
  useEffect(() => {
    const projectIdParam = searchParams.get('projectId');
    const tabParam = searchParams.get('tab');
    
    if (projectIdParam && projects && projects.length > 0 && !selectedProject) {
      const targetProject = projects.find((p: any) => p.id === projectIdParam);
      if (targetProject) {
        // Definir aba inicial se vier do parâmetro
        if (tabParam === 'sprints') {
          setInitialTab('sprints');
        } else if (tabParam === 'equipe') {
          setInitialTab('equipe');
        } else if (tabParam === 'atividades') {
          setInitialTab('atividades');
        } else {
          setInitialTab('visao-geral');
        }
        
        setSelectedProject(targetProject);
        
        // Limpar os params da URL sem recarregar
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('projectId');
        newParams.delete('tab');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, projects, selectedProject]);

  const filteredProjects = projects?.filter(project => {
    const matchesSearch = project.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || project.kanban_stage === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusColor = (stage: string) => {
    const colors: Record<string, string> = {
      'backlog': 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
      'desafio': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      'persona': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
      'proposta-valor': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
      'validacao': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
      'mvp': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    };
    return colors[stage] || colors.backlog;
  };

  const getStatusLabel = (stage: string) => {
    const labels: Record<string, string> = {
      'backlog': 'Backlog',
      'desafio': 'Desafio',
      'persona': 'Persona',
      'proposta-valor': 'Proposta de Valor',
      'validacao': 'Validação',
      'mvp': 'MVP',
    };
    return labels[stage] || stage || 'Backlog';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Não definido';
    const date = new Date(dateString + 'T12:00:00');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta':
        return 'text-red-600 dark:text-red-400';
      case 'media':
        return 'text-amber-600 dark:text-amber-400';
      case 'baixa':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
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

  const handleEditProject = (project: any) => {
    setEditingProject(project);
    setSelectedProject(null);
    setIsNewProjectModalOpen(true);
  };

  const handleCloseNewProjectModal = () => {
    setIsNewProjectModalOpen(false);
    setEditingProject(null);
  };

  const clearGlobalSearch = () => {
    setSearchTerm('');
    setHighlightedProjectId(null);
  };

  const hasGlobalSearch = highlightedProjectId !== null || (searchTerm.trim() !== '' && location.state !== null);

  if (loading) {
    return <PageLoading message="Carregando projetos..." />;
  }

  if (error) {
    return <PageError message="Erro ao carregar projetos" error={error} onRetry={retry} />;
  }

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Projetos
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>
            Gerencie seus projetos e acompanhe o progresso
          </p>
        </div>
        <button
          onClick={() => setIsNewProjectModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line text-lg"></i>
          <span className="text-sm font-medium">Novo Projeto</span>
        </button>
      </div>

      {/* Banner de busca global ativa */}
      {(highlightedProjectId || searchTerm.trim() !== '') && (
        <div className="mb-5 flex items-center justify-between bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl px-5 py-3 max-w-full">
          <div className="flex items-center gap-3">
            <i className="ri-search-line text-teal-600 dark:text-teal-400 text-lg"></i>
            <div>
              <span className="text-sm font-medium text-teal-800 dark:text-teal-200">
                Buscando por: <strong>&quot;{searchTerm}&quot;</strong>
              </span>
              <span className="ml-3 text-sm text-teal-600 dark:text-teal-400">
                — {filteredProjects.length} {filteredProjects.length === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>
          </div>
          <button
            onClick={clearGlobalSearch}
            className="flex items-center gap-1.5 text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-100 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-close-line text-base"></i>
            Limpar busca
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-5 max-w-full">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Buscar projetos..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value === '') setHighlightedProjectId(null);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm cursor-pointer"
          >
            <option value="all">Todas as etapas</option>
            <option value="backlog">Backlog</option>
            <option value="desafio">Desafio</option>
            <option value="persona">Persona</option>
            <option value="proposta-valor">Proposta de Valor</option>
            <option value="validacao">Validação</option>
            <option value="mvp">MVP</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <i className="ri-grid-line"></i>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <i className="ri-list-check"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Projects list/grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center max-w-full">
          <i className="ri-folder-line text-5xl text-gray-400 mb-4"></i>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nenhum projeto encontrado</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchTerm || filterStatus !== 'all' ? 'Tente ajustar os filtros de busca' : 'Crie seu primeiro projeto para começar'}
          </p>
          {searchTerm && (
            <button onClick={clearGlobalSearch} className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer">
              Limpar busca e ver todos
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch max-w-full">
          {filteredProjects.map((project) => {
            const team = getProjectTeam(project);
            const pm = getProjectPM(project);
            const isHighlighted = project.id === highlightedProjectId;
            const deadlineStatus = getDeadlineStatus(project);
            return (
              <div key={project.id} ref={isHighlighted ? highlightRef : null} className="flex flex-col">
                <div
                  onClick={() => setSelectedProject(project)}
                  className={`flex flex-col flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 hover:shadow-md transition-all cursor-pointer ${isHighlighted ? 'ring-2 ring-teal-500 ring-offset-2 dark:ring-offset-gray-900' : project.status === 'parado' ? 'border-2 border-red-500 dark:border-red-400 ring-1 ring-red-500/20 dark:ring-red-400/20' : 'border border-transparent'}`}
                >
                  {isHighlighted && (
                    <div className="-mx-5 -mt-5 mb-3 bg-teal-500 text-white text-xs font-semibold px-4 py-1.5 flex items-center gap-2 rounded-t-xl">
                      <i className="ri-search-line"></i>
                      Resultado da sua busca
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white break-words">{project.nome}</h3>
                        {project.status === 'parado' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold flex-shrink-0">
                            <i className="ri-pause-circle-fill text-xs"></i>Parado
                          </span>
                        )}
                        {deadlineStatus === 'overdue' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold flex-shrink-0">
                            <i className="ri-alarm-warning-line text-xs"></i>Atrasado
                          </span>
                        )}
                      </div>
                      {project.descricao && <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{project.descricao}</p>}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${getStatusColor(project.kanban_stage)}`}>{getStatusLabel(project.kanban_stage)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pb-3 border-b border-gray-200 dark:border-gray-700 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><i className="ri-flag-line"></i>Prioridade</p>
                      <p className={`text-sm font-semibold ${getPriorityColor(project.prioridade)}`}>{getPriorityText(project.prioridade)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><i className="ri-calendar-line"></i>Deadline</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(project.deadline)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><i className="ri-task-line"></i>Tarefas</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{getCompletedTasks(project.id)}/{getTotalTasks(project.id)}</p>
                    </div>
                  </div>
                  {project.sprints && project.sprints.length > 0 && (
                    <div className="pb-3 border-b border-gray-200 dark:border-gray-700 mb-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1"><i className="ri-time-line"></i>Sprints ({project.sprints.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {project.sprints.slice(0, 3).map((sprint: any, idx: number) => (
                          <span key={sprint.id} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium" title={sprint.name}>Sprint {idx + 1}</span>
                        ))}
                        {project.sprints.length > 3 && <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">+{project.sprints.length - 3}</span>}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-200 dark:border-gray-700 mb-4">
                    {pm && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1"><i className="ri-user-star-line"></i>Product Manager</p>
                        <div className="flex items-center gap-2">
                          <UserAvatar avatarUrl={pm.avatar} nome={pm.nome} size="sm" />
                          <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{pm.nome}</span>
                        </div>
                      </div>
                    )}
                    {project.sectorContacts && project.sectorContacts.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1"><i className="ri-building-line"></i>P.O / Setores</p>
                        <div className="flex flex-wrap gap-1">
                          {project.sectorContacts.slice(0, 2).map((sector: any) => (
                            <span key={sector.id} className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded text-xs font-semibold" title={sector.nome_setor}>{sector.sigla}</span>
                          ))}
                          {project.sectorContacts.length > 2 && <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded text-xs font-semibold">+{project.sectorContacts.length - 2}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                  {project.entregaveis && project.entregaveis.length > 0 && (
                    <div className="pb-3 border-b border-gray-200 dark:border-gray-700 mb-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1"><i className="ri-price-tag-3-line"></i>Entregáveis</p>
                      <div className="flex flex-wrap gap-1.5">
                        {project.entregaveis.slice(0, 4).map((entregavel: any, idx: number) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded text-xs font-medium capitalize">
                            <i className="ri-checkbox-circle-fill text-xs"></i>{entregavel.nome || entregavel}
                          </span>
                        ))}
                        {project.entregaveis.length > 4 && <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded text-xs font-medium">+{project.entregaveis.length - 4}</span>}
                      </div>
                    </div>
                  )}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progresso</span>
                      <span className="text-sm font-bold text-teal-600 dark:text-teal-400">{getProgress(project.id)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-teal-600 dark:bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${getProgress(project.id)}%` }}></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      {team.length > 0 ? (
                        <>
                          <div className="flex -space-x-2">
                            {team.slice(0, 4).map((membro, index) => (
                              <div key={membro.profile_id || index} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden flex-shrink-0" title={membro.nome}>
                                <UserAvatar avatarUrl={membro.avatar} nome={membro.nome} size="md" className="w-full h-full" />
                              </div>
                            ))}
                            {team.length > 4 && (
                              <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">+{team.length - 4}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">{team.length} membro{team.length !== 1 ? 's' : ''}</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400">Sem equipe</span>
                      )}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedProject(project); }} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-sm rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer flex-shrink-0">Ver</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-w-full">
          {filteredProjects.map((project) => {
            const team = getProjectTeam(project);
            const pm = getProjectPM(project);
            const progress = getProgress(project.id);
            const totalTasks = getTotalTasks(project.id);
            const completedTasks = getCompletedTasks(project.id);
            const isHighlighted = project.id === highlightedProjectId;
            const deadlineStatus = getDeadlineStatus(project);
            return (
              <div key={project.id} ref={isHighlighted ? highlightRef : null}>
                <div
                  onClick={() => setSelectedProject(project)}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer ${isHighlighted ? 'ring-2 ring-teal-500 ring-offset-2 dark:ring-offset-gray-900' : project.status === 'parado' ? 'border-2 border-red-500 dark:border-red-400 ring-1 ring-red-500/20 dark:ring-red-400/20' : 'border border-gray-200 dark:border-gray-700'}`}
                >
                  {isHighlighted && (
                    <div className="bg-teal-500 text-white text-xs font-semibold px-4 py-1.5 flex items-center gap-2 rounded-t-xl">
                      <i className="ri-search-line"></i>Resultado da sua busca
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{project.nome}</h3>
                            {project.status === 'parado' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold flex-shrink-0 whitespace-nowrap">
                                <i className="ri-pause-circle-fill text-xs"></i>Parado
                              </span>
                            )}
                            {deadlineStatus === 'overdue' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold flex-shrink-0 whitespace-nowrap">
                                <i className="ri-alarm-warning-line text-xs"></i>Atrasado
                              </span>
                            )}
                          </div>
                          {project.descricao && <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{project.descricao}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${getStatusColor(project.kanban_stage)}`}>{getStatusLabel(project.kanban_stage)}</span>
                        <span className={`text-xs font-semibold whitespace-nowrap ${getPriorityColor(project.prioridade)}`}><i className="ri-flag-fill mr-1"></i>{getPriorityText(project.prioridade)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 flex-wrap mb-4">
                      <div className="flex items-center gap-3 min-w-[200px] flex-1 max-w-xs">
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className="bg-teal-600 dark:bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">{progress}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <i className="ri-task-line text-base w-4 h-4 flex items-center justify-center"></i>
                        <span className="font-medium">{completedTasks}/{totalTasks}</span>
                        <span className="text-xs">tarefas</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <i className="ri-calendar-line text-base w-4 h-4 flex items-center justify-center"></i>
                        <span className="font-medium">{formatDate(project.deadline)}</span>
                      </div>
                      {project.sprints && project.sprints.length > 0 && (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                          <i className="ri-time-line text-base w-4 h-4 flex items-center justify-center"></i>
                          <span className="font-medium">{project.sprints.length}</span>
                          <span className="text-xs">sprint{project.sprints.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {project.entregaveis && project.entregaveis.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex flex-wrap gap-1">
                            {project.entregaveis.slice(0, 3).map((entregavel: any, idx: number) => (
                              <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded text-xs font-medium capitalize">{entregavel.nome || entregavel}</span>
                            ))}
                            {project.entregaveis.length > 3 && <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded text-xs font-medium">+{project.entregaveis.length - 3}</span>}
                          </div>
                        </div>
                      )}
                      {project.sectorContacts && project.sectorContacts.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex flex-wrap gap-1">
                            {project.sectorContacts.slice(0, 3).map((sector: any) => (
                              <span key={sector.id} className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded text-xs font-semibold" title={sector.nome_setor}>{sector.sigla}</span>
                            ))}
                            {project.sectorContacts.length > 3 && <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded text-xs font-semibold">+{project.sectorContacts.length - 3}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-5">
                        {pm && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">PM:</span>
                            <UserAvatar avatarUrl={pm.avatar} nome={pm.nome} size="sm" />
                            <span className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[100px]">{pm.nome}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">Equipe:</span>
                          {team.length > 0 ? (
                            <>
                              <div className="flex -space-x-2">
                                {team.slice(0, 5).map((membro, index) => (
                                  <div key={membro.profile_id || index} className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden flex-shrink-0" title={membro.nome}>
                                    <UserAvatar avatarUrl={membro.avatar} nome={membro.nome} size="sm" className="w-full h-full" />
                                  </div>
                                ))}
                                {team.length > 5 && (
                                  <div className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">+{team.length - 5}</span>
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{team.length} membro{team.length !== 1 ? 's' : ''}</span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">Sem equipe</span>
                          )}
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedProject(project); }} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-sm rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer flex-shrink-0">Ver Detalhes</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={handleCloseNewProjectModal}
        onProjectSaved={handleProjectChanged}
        editingProject={editingProject}
      />

      {selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          onClose={() => { setSelectedProject(null); setInitialTab('visao-geral'); }}
          onEdit={handleEditProject}
          onProjectDeleted={handleProjectChanged}
          initialTab={initialTab}
        />
      )}
    </>
  );
}
