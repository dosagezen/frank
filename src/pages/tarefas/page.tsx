import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import TaskFormModal from './components/TaskFormModal';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useCachedData } from '../../hooks/useCachedData';
import { CACHE_KEYS } from '../../services/localCache';
import { fetchTasks, fetchTaskProjectOptions } from '../../services/tasksService';
import type { Task, ProjectOption } from '../../services/tasksService';
import { invalidateTaskCaches } from '../../services/realtimeSyncService';
import { notifyTaskFieldsChanged, checkUpcomingDeadlineNotifications } from '../../services/notificationsService';
import UserAvatar from '../../components/base/UserAvatar';
import PageLoading from '../../components/PageLoading';
import PageError from '../../components/PageError';

interface TeamMemberOption {
  id: string;
  nome: string;
}

export default function TarefasPage() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [taskScope, setTaskScope] = useState<'all' | 'mine' | 'done'>('all');
  const [statusDropdownTaskId, setStatusDropdownTaskId] = useState<string | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [initialTab, setInitialTab] = useState<'detalhes' | 'subtarefas' | 'comentarios' | 'anexos'>('detalhes');

  const { data: tasks, loading, error, retry, invalidate } = useCachedData<Task[]>(
    CACHE_KEYS.TASKS,
    fetchTasks,
    { ttl: 3 * 60 * 1000, staleWhileRevalidate: true } // 3 minutos
  );

  const { data: projectOptionsData } = useCachedData<ProjectOption[]>(
    CACHE_KEYS.TAREFAS_PROJECT_OPTIONS,
    fetchTaskProjectOptions,
    { ttl: 15 * 60 * 1000, staleWhileRevalidate: true, enabled: !!user } // 15 minutos
  );

  const projectOptions = projectOptionsData ?? [];

  useEffect(() => {
    const loadTeamMembers = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, nome')
          .order('nome', { ascending: true });
        if (data) {
          // Exclui o usuário logado da lista de equipe
          const others = data.filter((m: TeamMemberOption) => m.id !== user?.id);
          setTeamMembers(others);
        }
      } catch (err) {
        console.error('Erro ao carregar membros:', err);
      }
    };
    if (user?.id) loadTeamMembers();
  }, [user?.id]);

  useEffect(() => {
    const taskIdParam = searchParams.get('taskId');
    const tabParam = searchParams.get('tab');
    if (taskIdParam && tasks && tasks.length > 0) {
      const targetTask = tasks.find(t => t.id === taskIdParam);
      if (targetTask) {
        let tab: 'detalhes' | 'subtarefas' | 'comentarios' | 'anexos' = 'detalhes';
        if (tabParam === 'comments' || tabParam === 'comentarios') tab = 'comentarios';
        else if (tabParam === 'subtasks' || tabParam === 'subtarefas') tab = 'subtarefas';
        else if (tabParam === 'attachments' || tabParam === 'anexos') tab = 'anexos';
        setInitialTab(tab);
        setTaskToEdit(targetTask);
        setShowTaskForm(true);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('taskId');
        newParams.delete('tab');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, tasks]);

  const handleTaskChanged = useCallback(async () => {
    await invalidateTaskCaches();
    invalidate();
  }, [invalidate]);

  useEffect(() => {
    if (user?.id) checkUpcomingDeadlineNotifications(user.id);
  }, [user?.id]);

  useEffect(() => {
    const handleGlobalSearch = (event: CustomEvent) => {
      const query = event.detail?.query || '';
      setSearchQuery(query);
    };
    window.addEventListener('global-search' as any, handleGlobalSearch);
    return () => window.removeEventListener('global-search' as any, handleGlobalSearch);
  }, []);

  useEffect(() => { applyFilters(); }, [tasks, filterStatus, filterPriority, filterProject, filterTeam, searchQuery, taskScope]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownTaskId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyFilters = () => {
    if (!tasks) return;
    let filtered = [...tasks];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    } else {
      if (taskScope === 'mine') {
        filtered = filtered.filter(task =>
          task.status !== 'feito' && task.responsavel.id === user?.id
        );
      } else {
        filtered = filtered.filter(task => task.status !== 'feito');
      }
    }

    if (filterProject !== 'all') {
      if (filterProject === 'none') filtered = filtered.filter(task => !task.project_id);
      else filtered = filtered.filter(task => task.project_id === filterProject);
    }
    if (filterPriority !== 'all') filtered = filtered.filter(task => task.prioridade === filterPriority);
    if (filterTeam !== 'all') filtered = filtered.filter(task => task.responsavel.id === filterTeam);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        task.titulo.toLowerCase().includes(query) ||
        task.descricao.toLowerCase().includes(query) ||
        task.categoria.toLowerCase().includes(query)
      );
    }
    setFilteredTasks(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fazer': return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      case 'fazendo': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400';
      case 'aguardando': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400';
      case 'parado': return 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400';
      case 'feito': return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'fazer': return 'Fazer';
      case 'fazendo': return 'Fazendo';
      case 'aguardando': return 'Aguardando';
      case 'parado': return 'Parado';
      case 'feito': return 'Feito';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta': return 'text-red-600 dark:text-red-400';
      case 'media': return 'text-amber-600 dark:text-amber-400';
      case 'baixa': return 'text-green-600 dark:text-green-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'alta': return 'Alta';
      case 'media': return 'Média';
      case 'baixa': return 'Baixa';
      default: return priority;
    }
  };

  const handleInlineStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const currentTask = tasks?.find(t => t.id === taskId);
      const oldStatus = currentTask?.status || '';
      const newProgress = newStatus === 'feito' ? 100 : (currentTask?.progress || 0);
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, progress: newProgress, updated_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw error;
      setStatusDropdownTaskId(null);
      showToast('Status atualizado com sucesso!', 'success');
      if (currentTask && user && oldStatus !== newStatus) {
        notifyTaskFieldsChanged({
          taskId,
          taskTitle: currentTask.titulo,
          oldData: { status: oldStatus, progress: currentTask.progress || 0 },
          newData: { status: newStatus, progress: newProgress },
          responsavelId: currentTask.responsavel.id,
          actorId: user.id,
        });
      }
      await handleTaskChanged();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showToast('Erro ao atualizar status', 'error');
    }
  };

  const statusOptions = [
    { value: 'fazer', label: 'Fazer', color: 'bg-gray-500 dark:bg-gray-400' },
    { value: 'fazendo', label: 'Fazendo', color: 'bg-blue-500 dark:bg-blue-400' },
    { value: 'aguardando', label: 'Aguardando', color: 'bg-yellow-500 dark:bg-yellow-400' },
    { value: 'parado', label: 'Parado', color: 'bg-orange-500 dark:bg-orange-400' },
    { value: 'feito', label: 'Feito', color: 'bg-green-500 dark:bg-green-400' },
  ];

  const InlineStatusSelect = ({ task }: { task: Task }) => {
    const isOpen = statusDropdownTaskId === task.id;
    return (
      <div className="relative" ref={isOpen ? statusDropdownRef : undefined}>
        <span
          onClick={(e) => { e.stopPropagation(); setStatusDropdownTaskId(isOpen ? null : task.id); }}
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-teal-400 dark:hover:ring-offset-gray-800 ${getStatusColor(task.status)}`}
        >
          {getStatusLabel(task.status)}
          <i className={`ri-arrow-down-s-line text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}></i>
        </span>
        {isOpen && (
          <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={(e) => { e.stopPropagation(); handleInlineStatusChange(task.id, opt.value); }}
                className={`w-full text-left px-3 py-2 text-sm font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${task.status === opt.value ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${opt.color}`}></span>
                <span className="flex-1">{opt.label}</span>
                {task.status === opt.value && <i className="ri-check-line text-teal-600 dark:text-teal-400"></i>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleToggleComplete = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const newStatus = task.status === 'feito' ? 'fazer' : 'feito';
    const newProgress = newStatus === 'feito' ? 100 : task.progress || 0;
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, progress: newProgress, updated_at: new Date().toISOString() })
        .eq('id', task.id);
      if (error) throw error;
      showToast(newStatus === 'feito' ? 'Tarefa concluída! ✓' : 'Tarefa reaberta!', 'success');
      if (user && task.status !== newStatus) {
        notifyTaskFieldsChanged({
          taskId: task.id,
          taskTitle: task.titulo,
          oldData: { status: task.status, progress: task.progress || 0 },
          newData: { status: newStatus, progress: newProgress },
          responsavelId: task.responsavel.id,
          actorId: user.id,
        });
      }
      await handleTaskChanged();
    } catch (err) {
      console.error('Erro ao atualizar tarefa:', err);
      showToast('Erro ao atualizar tarefa', 'error');
    }
  };

  const openEditForm = (e: React.MouseEvent | null, task: Task) => {
    if (e) e.stopPropagation();
    setInitialTab('detalhes');
    setTaskToEdit(task);
    setShowTaskForm(true);
  };

  const openNewTaskForm = () => {
    setInitialTab('detalhes');
    setTaskToEdit(null);
    setShowTaskForm(true);
  };

  const handleCloseForm = () => {
    setShowTaskForm(false);
    setTaskToEdit(null);
    setInitialTab('detalhes');
    handleTaskChanged();
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      showToast('Tarefa excluída com sucesso!', 'success');
      setShowTaskForm(false);
      setTaskToEdit(null);
      await handleTaskChanged();
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error);
      showToast('Erro ao excluir tarefa. Tente novamente.', 'error');
    }
  };

  const handleDeleteFromCard = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.')) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      showToast('Tarefa excluída com sucesso!', 'success');
      await handleTaskChanged();
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error);
      showToast('Erro ao excluir tarefa. Tente novamente.', 'error');
    }
  };

  const getOpenTasksCount = () => {
    if (!tasks) return 0;
    return tasks.filter(task => task.status !== 'feito').length;
  };

  const getDoneTasksCount = () => {
    if (!tasks) return 0;
    return tasks.filter(task => task.status === 'feito').length;
  };

  const getMyTasksCount = () => {
    if (!user || !tasks) return 0;
    return tasks.filter(task =>
      task.status !== 'feito' && task.responsavel.id === user.id
    ).length;
  };

  const getTaskCountByStatus = (status: string) => {
    if (!tasks) return 0;
    if (status === 'all') return tasks.length;
    return tasks.filter(task => task.status === status).length;
  };

  const SubtaskProgress = ({ task }: { task: Task }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const stats = task.subtaskStats;
    if (!stats || stats.total === 0) return null;
    const percent = Math.round((stats.completed / stats.total) * 100);
    const allDone = stats.completed === stats.total;
    return (
      <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
        <span className={`text-xs font-medium ${allDone ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>Subtarefas</span>
        <div className="flex items-center gap-2 mt-1">
          <i className={`ri-list-check text-xs flex-shrink-0 ${allDone ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}></i>
          <div className="relative flex-1" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden cursor-default">
              <div className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500 dark:bg-green-400' : 'bg-blue-500 dark:bg-blue-400'}`} style={{ width: `${percent}%` }} />
            </div>
            {showTooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                <div className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-lg whitespace-nowrap ${allDone ? 'bg-green-600' : 'bg-blue-600'}`}>
                  {percent}% concluído
                  <div className={`absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent ${allDone ? 'border-t-green-600' : 'border-t-blue-600'}`}></div>
                </div>
              </div>
            )}
          </div>
          <span className={`text-xs font-semibold whitespace-nowrap flex-shrink-0 ${allDone ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>{stats.completed}/{stats.total}</span>
        </div>
      </div>
    );
  };

  if (loading) return <PageLoading message="Carregando tarefas..." />;
  if (error) return <PageError message="Erro ao carregar tarefas" error={error} onRetry={retry} />;

  return (
    <>
      {/* Título + botão Nova Tarefa */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Tarefas</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>Gerencie todas as suas tarefas e acompanhe o progresso</p>
        </div>
        <button onClick={openNewTaskForm} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors cursor-pointer whitespace-nowrap shadow-sm">
          <i className="ri-add-line text-base"></i>Nova Tarefa
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setTaskScope('all')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer whitespace-nowrap ${taskScope === 'all' ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              <i className="ri-list-check-2 text-sm"></i>
              <span>Abertas</span>
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${taskScope === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`}>{getOpenTasksCount()}</span>
            </button>
            <button onClick={() => setTaskScope('mine')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer whitespace-nowrap ${taskScope === 'mine' ? 'bg-teal-700 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              <i className="ri-user-line text-sm"></i>
              <span>Minhas</span>
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${taskScope === 'mine' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`}>{getMyTasksCount()}</span>
            </button>
          </div>
          <div className="w-px h-7 bg-gray-200 dark:bg-gray-600 flex-shrink-0"></div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer w-auto max-w-[140px]">
              <option value="all">Projetos</option>
              <option value="none">Sem Projeto</option>
              {projectOptions.map(proj => <option key={proj.id} value={proj.id}>{proj.nome}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer w-auto max-w-[130px]">
              <option value="all">Status ({getTaskCountByStatus('all')})</option>
              <option value="fazer">Fazer ({getTaskCountByStatus('fazer')})</option>
              <option value="fazendo">Fazendo ({getTaskCountByStatus('fazendo')})</option>
              <option value="aguardando">Aguardando ({getTaskCountByStatus('aguardando')})</option>
              <option value="parado">Parado ({getTaskCountByStatus('parado')})</option>
              <option value="feito">Feito ({getTaskCountByStatus('feito')})</option>
            </select>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer w-auto max-w-[120px]">
              <option value="all">Prioridades</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
            <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer w-auto max-w-[140px]">
              <option value="all">Equipe</option>
              {teamMembers.map(member => (
                <option key={member.id} value={member.id}>{member.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Modo de Visualização:</span>
          <div className="flex gap-1">
            <button onClick={() => setViewMode('list')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${viewMode === 'list' ? 'bg-teal-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              <i className="ri-list-unordered"></i>Lista
            </button>
            <button onClick={() => setViewMode('board')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${viewMode === 'board' ? 'bg-teal-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              <i className="ri-layout-grid-line"></i>Kanban
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Tarefas */}
      {viewMode === 'list' ? (
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <i className="ri-task-line text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {taskScope === 'mine' ? 'Nenhuma tarefa aberta atribuída a você' : 'Nenhuma tarefa aberta encontrada'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {taskScope === 'mine' ? 'Você não tem tarefas abertas atribuídas a você no momento.' : 'Comece criando uma nova tarefa para organizar seu trabalho.'}
              </p>
              {taskScope === 'mine' ? (
                <button onClick={() => setTaskScope('all')} className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium cursor-pointer">Ver Tarefas Abertas</button>
              ) : (
                <button onClick={openNewTaskForm} className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium cursor-pointer">Criar Primeira Tarefa</button>
              )}
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div key={task.id} onClick={() => openEditForm(null, task)} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 py-3 px-4 hover:shadow-md transition-all cursor-pointer group ${task.status === 'feito' ? 'opacity-70' : ''}`}>
                <div className="flex items-start gap-3">
                  {/* Botão de check */}
                  <button
                    onClick={(e) => handleToggleComplete(e, task)}
                    className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
                      task.status === 'feito'
                        ? 'bg-green-500 border-green-500 text-white hover:bg-green-600 hover:border-green-600'
                        : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 text-transparent hover:text-green-400'
                    }`}
                    title={task.status === 'feito' ? 'Reabrir tarefa' : 'Marcar como concluída'}
                  >
                    <i className="ri-check-line text-xs"></i>
                  </button>
                  <div className="flex-shrink-0 mt-0.5"><UserAvatar avatarUrl={task.responsavel.avatar} nome={task.responsavel.nome} size="xl" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className={`text-base font-semibold text-gray-900 dark:text-white ${task.status === 'feito' ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>{task.titulo}</h3>
                          {task.canEdit && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button onClick={(e) => openEditForm(e, task)} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 dark:hover:text-teal-400 transition-colors cursor-pointer" title="Editar tarefa"><i className="ri-pencil-line text-sm"></i></button>
                              <button onClick={(e) => handleDeleteFromCard(e, task.id)} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors cursor-pointer" title="Excluir tarefa"><i className="ri-delete-bin-line text-sm"></i></button>
                            </div>
                          )}
                        </div>
                        {task.descricao && <p className={`text-sm text-gray-600 dark:text-gray-400 line-clamp-1 ${task.status === 'feito' ? 'line-through' : ''}`}>{task.descricao}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <InlineStatusSelect task={task} />
                        {!task.canEdit && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"><i className="ri-eye-line"></i></span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400"><i className="ri-user-line text-xs"></i><span className="text-xs">{task.responsavel.nome}</span></div>
                      <div className={`flex items-center gap-1.5 font-medium ${getPriorityColor(task.prioridade)}`}><i className="ri-flag-line text-xs"></i><span className="text-xs">{getPriorityLabel(task.prioridade)}</span></div>
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400"><i className="ri-calendar-line text-xs"></i><span className="text-xs">{task.prazo}</span></div>
                      {task.project && <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400"><i className="ri-folder-line text-xs"></i><span className="text-xs">{task.project.nome}</span></div>}
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          {task.tags.slice(0, 2).map((tag, index) => <span key={index} className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded text-xs font-medium">{tag}</span>)}
                          {task.tags.length > 2 && <span className="text-xs text-gray-500 dark:text-gray-400">+{task.tags.length - 2}</span>}
                        </div>
                      )}
                    </div>
                    <SubtaskProgress task={task} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {['fazer', 'fazendo', 'aguardando', 'parado', 'feito'].map((status) => {
            const statusTasks = filteredTasks.filter(task => task.status === status);
            return (
              <div key={status} className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{getStatusLabel(status)}</h3>
                  <span className="px-2 py-1 bg-white dark:bg-gray-700 rounded-full text-xs font-bold text-gray-700 dark:text-gray-300">{statusTasks.length}</span>
                </div>
                <div className="space-y-3">
                  {statusTasks.map((task) => (
                    <div key={task.id} onClick={() => openEditForm(null, task)} className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2 flex-1">{task.titulo}</h4>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {task.canEdit ? (
                            <>
                              <button onClick={(e) => openEditForm(e, task)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 dark:hover:text-teal-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100" title="Editar"><i className="ri-pencil-line text-xs"></i></button>
                              <button onClick={(e) => handleDeleteFromCard(e, task.id)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100" title="Excluir"><i className="ri-delete-bin-line text-xs"></i></button>
                            </>
                          ) : (
                            <i className="ri-eye-line text-amber-600 dark:text-amber-400 text-sm flex-shrink-0"></i>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0"><UserAvatar avatarUrl={task.responsavel.avatar} nome={task.responsavel.nome} size="sm" className="w-full h-full" /></div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{task.responsavel.nome}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${getPriorityColor(task.prioridade)}`}>{getPriorityLabel(task.prioridade)}</span>
                        <span className="text-gray-500 dark:text-gray-400">{task.prazo}</span>
                      </div>
                      <SubtaskProgress task={task} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskFormModal
        isOpen={showTaskForm}
        onClose={handleCloseForm}
        taskToEdit={taskToEdit}
        onDelete={taskToEdit?.canEdit ? handleDeleteTask : undefined}
        initialTab={initialTab}
      />
    </>
  );
}
