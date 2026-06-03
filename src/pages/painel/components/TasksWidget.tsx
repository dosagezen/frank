
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';
import { useCachedData } from '../../../hooks/useCachedData';
import { CACHE_KEYS } from '../../../services/localCache';
import UserAvatar from '../../../components/base/UserAvatar';

interface Task {
  id: string;
  title: string;
  project_id?: string;
  priority: string;
  status: string;
  assignee?: string;
  due_date?: string;
  responsavel_id?: string;
  user_id?: string;
  responsavel?: { id: string; nome: string; avatar_url: string | null } | null;
  project?: { id: string; nome: string; user_id: string } | null;
}

interface TasksPayload {
  tasks: Task[];
  profiles: Record<string, { id: string; nome: string; avatar_url: string | null }>;
  projects: Record<string, { id: string; nome: string; user_id: string }>;
}

export default function TasksWidget() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState('todas');

  const fetchTasks = useCallback(async (): Promise<TasksPayload> => {
    let tasksData: Task[] = [];
    const profilesMap: Record<string, { id: string; nome: string; avatar_url: string | null }> = {};
    const projectsMap: Record<string, { id: string; nome: string; user_id: string }> = {};

    if (isAdmin) {
      const { data } = await supabase
        .from('tasks')
        .select(`
          id, title, priority, status, assignee, due_date, responsavel_id, project_id, user_id,
          project:projects(id, nome, user_id),
          responsavel:profiles!tasks_responsavel_id_fkey(id, nome, avatar_url)
        `)
        .order('due_date', { ascending: true })
        .limit(6);

      tasksData = data || [];
    } else {
      const [ownProjects, memberProjects] = await Promise.all([
        supabase.from('projects').select('id').eq('user_id', user!.id),
        supabase.from('project_members').select('project_id').eq('profile_id', user!.id),
      ]);

      const accessibleProjectIds = [
        ...new Set([
          ...(ownProjects.data?.map((p: any) => p.id) || []),
          ...(memberProjects.data?.map((mp: any) => mp.project_id) || []),
        ]),
      ];

      const { data } = await supabase
        .from('tasks')
        .select(`
          id, title, priority, status, assignee, due_date, responsavel_id, project_id, user_id,
          project:projects(id, nome, user_id),
          responsavel:profiles!tasks_responsavel_id_fkey(id, nome, avatar_url)
        `)
        .order('due_date', { ascending: true });

      const allTasks = data || [];
      tasksData = allTasks
        .filter((task: any) => {
          if (task.user_id === user!.id) return true;
          if (task.project_id && accessibleProjectIds.includes(task.project_id)) return true;
          return false;
        })
        .slice(0, 6);
    }

    tasksData.forEach((task: any) => {
      if (task.responsavel) profilesMap[task.responsavel.id] = task.responsavel;
      if (task.project) projectsMap[task.project.id] = task.project;
    });

    return { tasks: tasksData, profiles: profilesMap, projects: projectsMap };
  }, [user, isAdmin]);

  const { data, loading } = useCachedData<TasksPayload>(
    CACHE_KEYS.PAINEL_TASKS,
    fetchTasks,
    { ttl: 3 * 60 * 1000, enabled: !!user } // 3 minutos
  );

  const tasks = data?.tasks || [];
  const profiles = data?.profiles || {};
  const projects = data?.projects || {};

  const filters = [
    { id: 'todas', label: 'Todas', count: tasks.length },
    { id: 'fazer', label: 'Fazer', count: tasks.filter(t => t.status === 'fazer').length },
    { id: 'fazendo', label: 'Fazendo', count: tasks.filter(t => t.status === 'fazendo').length },
    { id: 'aguardando', label: 'Aguardando', count: tasks.filter(t => t.status === 'aguardando').length },
    { id: 'parado', label: 'Parado', count: tasks.filter(t => t.status === 'parado').length },
    { id: 'feito', label: 'Feito', count: tasks.filter(t => t.status === 'feito').length },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta': return 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400';
      case 'media': return 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400';
      case 'baixa': return 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fazendo': return 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400';
      case 'fazer': return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      case 'aguardando': return 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-400';
      case 'parado': return 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400';
      case 'feito': return 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400';
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

  const getDueDateLabel = (dueDate?: string) => {
    if (!dueDate) return 'Sem prazo';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    if (diffDays === -1) return 'Ontem';
    if (diffDays > 1 && diffDays <= 7) return `${diffDays} dias`;
    if (diffDays > 7 && diffDays <= 14) return '1 semana';
    if (diffDays < 0) return 'Atrasado';
    return new Date(dueDate).toLocaleDateString('pt-BR');
  };

  const filteredTasks = selectedFilter === 'todas' ? tasks : tasks.filter(t => t.status === selectedFilter);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-950/30 flex-shrink-0">
            <i className="ri-task-line text-xl text-teal-600 dark:text-teal-400"></i>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Minhas Tarefas
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
              {loading ? 'Carregando...' : `${tasks.length} tarefas no total`}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/tarefas')}
          className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium text-sm whitespace-nowrap cursor-pointer self-start sm:self-auto"
        >
          Ver todos
        </button>
      </div>

      <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${
                selectedFilter === f.id
                  ? 'bg-teal-600 dark:bg-teal-500 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span className="sm:hidden">{f.label}</span>
              <span className="hidden sm:inline">{f.label} ({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <i className="ri-loader-4-line text-2xl text-teal-600 dark:text-teal-400 animate-spin"></i>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-8">
            <i className="ri-task-line text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma tarefa encontrada</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredTasks.map((task) => {
              const profile = task.responsavel_id ? profiles[task.responsavel_id] : null;
              const project = task.project_id ? projects[task.project_id] : null;
              return (
                <div
                  key={task.id}
                  onClick={() => navigate('/tarefas')}
                  className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer border border-gray-200 dark:border-gray-600 overflow-hidden min-w-0 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0 mb-3 min-w-0">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm sm:text-base break-words group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {task.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{project?.nome || 'Sem projeto'}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap flex-shrink-0">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${getPriorityColor(task.priority)}`}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${getStatusColor(task.status)}`}>
                        {getStatusLabel(task.status)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 text-xs sm:text-sm min-w-0">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 min-w-0 overflow-hidden">
                      <UserAvatar
                        avatarUrl={profile?.avatar_url}
                        nome={profile?.nome || task.assignee || 'Sem responsável'}
                        size="sm"
                        className="flex-shrink-0"
                      />
                      <span className="truncate">{profile?.nome || task.assignee || 'Sem responsável'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 whitespace-nowrap flex-shrink-0">
                      <i className="ri-calendar-line"></i>
                      <span>{getDueDateLabel(task.due_date)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
