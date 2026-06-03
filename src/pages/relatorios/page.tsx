
import { useState, useEffect, useCallback, useRef } from 'react';
import StatsCards from './components/StatsCards';
import WeeklyProductivityChart from './components/WeeklyProductivityChart';
import PerformanceTrendChart from './components/PerformanceTrendChart';
import TaskDistributionChart from './components/TaskDistributionChart';
import ProjectsProgressChart from './components/ProjectsProgressChart';
import PriorityBreakdown from './components/PriorityBreakdown';
import TeamRanking from './components/TeamRanking';
import RecentActivityList from './components/RecentActivityList';
import SprintBurndownChart from './components/SprintBurndownChart';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { safeFetchMany } from '../../services/supabaseHelpers';
import { useCachedData } from '../../hooks/useCachedData';

interface ProjectOption {
  id: string;
  nome: string;
  cor: string | null;
}

interface RelatoriosData {
  stats: {
    tarefasConcluidas: number;
    totalTarefas: number;
    projetosAtivos: number;
    taxaConclusao: number;
    membrosAtivos: number;
    tarefasAtrasadas: number;
  };
  weeklyData: any[];
  trendData: any[];
  statusData: any[];
  projectsData: any[];
  priorityData: any[];
  teamData: any[];
  activityData: any[];
  accessibleProjectIds: string[];
  projectsList: ProjectOption[];
}

export default function RelatoriosPage() {
  const { user, isAdmin } = useAuth();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPeriodDays = useCallback(() => {
    if (period === '7d') return 7;
    if (period === '30d') return 30;
    return 90;
  }, [period]);

  const cacheKey = `relatorios-${period}-${selectedProjectId}-${user?.id ?? 'anon'}`;

  const fetchFn = useCallback(async (): Promise<RelatoriosData> => {
    if (!user) {
      return {
        stats: { tarefasConcluidas: 0, totalTarefas: 0, projetosAtivos: 0, taxaConclusao: 0, membrosAtivos: 0, tarefasAtrasadas: 0 },
        weeklyData: [], trendData: [], statusData: [], projectsData: [],
        priorityData: [], teamData: [], activityData: [],
        accessibleProjectIds: [], projectsList: [],
      };
    }

    let accessibleProjectIds: string[] = [];
    let projectsList: ProjectOption[] = [];

    if (isAdmin) {
      const allProjects = await safeFetchMany(() =>
        supabase.from('projects').select('id, nome, cor').order('nome', { ascending: true })
      );
      accessibleProjectIds = allProjects.map((p: any) => p.id);
      projectsList = allProjects.map((p: any) => ({ id: p.id, nome: p.nome, cor: p.cor }));
    } else {
      const ownProjects = await safeFetchMany(() =>
        supabase.from('projects').select('id, nome, cor').eq('user_id', user.id).order('nome', { ascending: true })
      );
      const memberProjects = await safeFetchMany(() =>
        supabase.from('project_members').select('project_id').eq('profile_id', user.id)
      );
      const ownIds = ownProjects.map((p: any) => p.id);
      const memberIds = memberProjects.map((mp: any) => mp.project_id);
      const allIds = [...new Set([...ownIds, ...memberIds])];
      accessibleProjectIds = allIds;

      let memberProjectDetails: any[] = [];
      const memberOnlyIds = memberIds.filter((id: string) => !ownIds.includes(id));
      if (memberOnlyIds.length > 0) {
        memberProjectDetails = await safeFetchMany(() =>
          supabase.from('projects').select('id, nome, cor').in('id', memberOnlyIds).order('nome', { ascending: true })
        );
      }
      projectsList = [...ownProjects, ...memberProjectDetails]
        .map((p: any) => ({ id: p.id, nome: p.nome, cor: p.cor }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }

    const filteredProjectIds =
      selectedProjectId === 'all'
        ? accessibleProjectIds
        : accessibleProjectIds.filter(id => id === selectedProjectId);

    let allTasks: any[] = [];
    if (filteredProjectIds.length > 0) {
      const projectTasks = await safeFetchMany(() =>
        supabase
          .from('tasks')
          .select('id, status, priority, due_date, created_at, project_id, responsavel_id, updated_at, user_id')
          .in('project_id', filteredProjectIds)
      );
      allTasks = [...projectTasks];
    }
    if (selectedProjectId === 'all') {
      // Buscar tarefas pessoais criadas pelo usuário
      const personalTasks = await safeFetchMany(() =>
        supabase
          .from('tasks')
          .select('id, status, priority, due_date, created_at, project_id, responsavel_id, updated_at, user_id')
          .is('project_id', null)
          .eq('user_id', user.id)
      );
      
      // Buscar tarefas onde o usuário é responsável (mas não criador)
      const assignedTasks = await safeFetchMany(() =>
        supabase
          .from('tasks')
          .select('id, status, priority, due_date, created_at, project_id, responsavel_id, updated_at, user_id')
          .eq('responsavel_id', user.id)
          .neq('user_id', user.id)
      );
      
      // Combinar todas as tarefas, removendo duplicatas
      const taskIds = new Set(allTasks.map(t => t.id));
      const uniquePersonalTasks = personalTasks.filter((t: any) => !taskIds.has(t.id));
      const uniqueAssignedTasks = assignedTasks.filter((t: any) => !taskIds.has(t.id));
      
      allTasks = [...allTasks, ...uniquePersonalTasks, ...uniqueAssignedTasks];
    } else {
      // Quando um projeto específico está selecionado, também incluir tarefas onde o usuário é responsável
      const assignedTasksInProject = await safeFetchMany(() =>
        supabase
          .from('tasks')
          .select('id, status, priority, due_date, created_at, project_id, responsavel_id, updated_at, user_id')
          .eq('responsavel_id', user.id)
          .eq('project_id', selectedProjectId)
          .neq('user_id', user.id)
      );
      
      // Remover duplicatas
      const taskIds = new Set(allTasks.map(t => t.id));
      const uniqueAssignedTasks = assignedTasksInProject.filter((t: any) => !taskIds.has(t.id));
      allTasks = [...allTasks, ...uniqueAssignedTasks];
    }

    const days = getPeriodDays();
    const today = new Date().toISOString().split('T')[0];
    const totalTarefas = allTasks.length;
    const tarefasConcluidas = allTasks.filter(t => t.status === 'feito').length;
    const tarefasAtrasadas = allTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'feito').length;
    const taxaConclusao = totalTarefas > 0 ? Math.round((tarefasConcluidas / totalTarefas) * 100) : 0;
    const activeProjectCount = selectedProjectId === 'all' ? accessibleProjectIds.length : 1;

    const stats = { tarefasConcluidas, totalTarefas, projetosAtivos: activeProjectCount, taxaConclusao, membrosAtivos: 0, tarefasAtrasadas };

    const statusData = [
      { name: 'A Fazer', value: allTasks.filter(t => t.status === 'a-fazer' || t.status === 'pendente' || !t.status).length, color: '#9ca3af' },
      { name: 'Em Progresso', value: allTasks.filter(t => t.status === 'fazendo' || t.status === 'em-andamento').length, color: '#3b82f6' },
      { name: 'Aguardando', value: allTasks.filter(t => t.status === 'aguardando').length, color: '#f59e0b' },
      { name: 'Concluída', value: tarefasConcluidas, color: '#10b981' },
    ];

    const prioCounts = {
      alta: allTasks.filter(t => t.priority === 'alta').length,
      media: allTasks.filter(t => t.priority === 'media').length,
      baixa: allTasks.filter(t => t.priority === 'baixa').length,
      semPrioridade: allTasks.filter(t => !t.priority || t.priority === 'nenhuma').length,
    };
    const priorityData = [
      { name: 'Alta', value: prioCounts.alta, color: '#ef4444', bgColor: 'bg-red-50 dark:bg-red-950/30', icon: 'ri-fire-fill' },
      { name: 'Média', value: prioCounts.media, color: '#f59e0b', bgColor: 'bg-amber-50 dark:bg-amber-950/30', icon: 'ri-alert-fill' },
      { name: 'Baixa', value: prioCounts.baixa, color: '#10b981', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'ri-arrow-down-circle-fill' },
      { name: 'Sem prioridade', value: prioCounts.semPrioridade, color: '#9ca3af', bgColor: 'bg-gray-50 dark:bg-gray-700', icon: 'ri-subtract-line' },
    ];

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = dayNames[d.getDay()];
      const concluidas = allTasks.filter(t => t.status === 'feito' && t.updated_at?.split('T')[0] === dateStr).length;
      const criadas = allTasks.filter(t => t.created_at?.split('T')[0] === dateStr).length;
      weeklyData.push({ day: dayName, concluidas, criadas });
    }

    const trendData = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - (w * 7 + 6));
      const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      const label = `${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`;
      const concluidas = allTasks.filter(t => t.status === 'feito' && t.updated_at?.split('T')[0] >= weekStartStr && t.updated_at?.split('T')[0] <= weekEndStr).length;
      const criadas = allTasks.filter(t => t.created_at?.split('T')[0] >= weekStartStr && t.created_at?.split('T')[0] <= weekEndStr).length;
      trendData.push({ date: label, concluidas, criadas });
    }

    const projectIdsForProgress = selectedProjectId === 'all' ? accessibleProjectIds : [selectedProjectId];
    let projectsData: any[] = [];
    if (projectIdsForProgress.length > 0) {
      const projectColors = ['#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899', '#10b981', '#f97316'];
      const { data: projectsListData } = await supabase
        .from('projects').select('id, nome, cor').in('id', projectIdsForProgress).order('nome', { ascending: true }).limit(8);
      if (projectsListData) {
        const allProjectTasks = selectedProjectId === 'all'
          ? allTasks
          : await safeFetchMany(() => supabase.from('tasks').select('id, status, project_id').eq('project_id', selectedProjectId));
        projectsData = projectsListData.map((project: any, idx: number) => {
          const projectTasks = allProjectTasks.filter((t: any) => t.project_id === project.id);
          const total = projectTasks.length;
          const completed = projectTasks.filter((t: any) => t.status === 'feito').length;
          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
          return { id: project.id, name: project.nome, completed, total, percentage, color: project.cor || projectColors[idx % projectColors.length] };
        }).filter((p: any) => p.total > 0);
      }
    }

    const { data: profiles } = await supabase.from('profiles').select('id, nome, avatar_url, cargo');
    let teamData: any[] = [];
    let membrosAtivos = 0;
    if (profiles) {
      teamData = profiles.map((profile: any) => {
        const memberTasks = allTasks.filter(t => t.responsavel_id === profile.id);
        const totalMember = memberTasks.length;
        const concluidas = memberTasks.filter(t => t.status === 'feito').length;
        const percentual = totalMember > 0 ? Math.round((concluidas / totalMember) * 100) : 0;
        return { id: profile.id, nome: profile.nome || 'Sem nome', avatar: profile.avatar_url || '', cargo: profile.cargo || 'Membro', totalTarefas: totalMember, concluidas, percentual };
      }).filter((m: any) => m.totalTarefas > 0).sort((a: any, b: any) => b.percentual - a.percentual || b.concluidas - a.concluidas).slice(0, 8);
      membrosAtivos = teamData.length;
    }

    let activityQuery = supabase
      .from('project_activity_log')
      .select('id, user_id, action_type, field_name, description, created_at, project_id')
      .order('created_at', { ascending: false })
      .limit(10);

    if (selectedProjectId !== 'all') {
      activityQuery = activityQuery.eq('project_id', selectedProjectId);
    } else if (!isAdmin && accessibleProjectIds.length > 0) {
      activityQuery = activityQuery.in('project_id', accessibleProjectIds);
    } else if (!isAdmin && accessibleProjectIds.length === 0) {
      // Sem projetos acessíveis, retorna vazio
      activityQuery = activityQuery.eq('project_id', 'none');
    }

    const { data: recentLogs } = await activityQuery;

    let activityData: any[] = [];
    if (recentLogs && profiles) {
      const profilesMap = new Map(profiles.map((p: any) => [p.id, p]));
      activityData = recentLogs.map((log: any) => {
        const profile = profilesMap.get(log.user_id);
        const userName = (profile as any)?.nome || 'Usuário';
        let action = '', icon = 'ri-edit-line', iconColor = 'text-teal-600 dark:text-teal-400', iconBg = 'bg-teal-50 dark:bg-teal-950/30';
        if (log.action_type === 'create') { action = 'criou'; icon = 'ri-add-circle-line'; iconColor = 'text-emerald-600 dark:text-emerald-400'; iconBg = 'bg-emerald-50 dark:bg-emerald-950/30'; }
        else if (log.action_type === 'field_change') { action = `alterou ${log.field_name || 'campo'} em`; icon = 'ri-edit-2-line'; }
        else if (log.action_type === 'member_added') { action = 'adicionou membro em'; icon = 'ri-user-add-line'; iconColor = 'text-amber-600 dark:text-amber-400'; iconBg = 'bg-amber-50 dark:bg-amber-950/30'; }
        else if (log.action_type === 'member_removed') { action = 'removeu membro de'; icon = 'ri-user-unfollow-line'; iconColor = 'text-rose-600 dark:text-rose-400'; iconBg = 'bg-rose-50 dark:bg-rose-950/30'; }
        else { action = log.description || 'atualizou'; }
        const target = log.description || 'projeto';
        const now = new Date(); const created = new Date(log.created_at);
        const diffMs = now.getTime() - created.getTime();
        const diffMin = Math.floor(diffMs / 60000); const diffHours = Math.floor(diffMs / 3600000); const diffDays = Math.floor(diffMs / 86400000);
        let timeAgo = '';
        if (diffMin < 1) timeAgo = 'Agora mesmo';
        else if (diffMin < 60) timeAgo = `${diffMin} min atrás`;
        else if (diffHours < 24) timeAgo = `${diffHours}h atrás`;
        else if (diffDays < 7) timeAgo = `${diffDays}d atrás`;
        else timeAgo = created.toLocaleDateString('pt-BR');
        return { id: log.id, userName, action, target, timeAgo, icon, iconColor, iconBg };
      });
    }

    return {
      stats: { ...stats, membrosAtivos },
      weeklyData, trendData, statusData, projectsData,
      priorityData, teamData, activityData,
      accessibleProjectIds, projectsList,
    };
  }, [user, isAdmin, getPeriodDays, selectedProjectId]);

  const { data, loading, isRevalidating, retry } = useCachedData<RelatoriosData>(
    cacheKey,
    fetchFn,
    { enabled: !!user, ttl: 10 * 60 * 1000 } // 10 minutos
  );

  const stats = data?.stats ?? { tarefasConcluidas: 0, totalTarefas: 0, projetosAtivos: 0, taxaConclusao: 0, membrosAtivos: 0, tarefasAtrasadas: 0 };
  const weeklyData = data?.weeklyData ?? [];
  const trendData = data?.trendData ?? [];
  const statusData = data?.statusData ?? [];
  const projectsData = data?.projectsData ?? [];
  const priorityData = data?.priorityData ?? [];
  const teamData = data?.teamData ?? [];
  const activityData = data?.activityData ?? [];
  const accessibleProjectIds = data?.accessibleProjectIds ?? [];
  const projectsList = data?.projectsList ?? [];

  const selectedProject = projectsList.find(p => p.id === selectedProjectId);

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Relatórios</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Análise de desempenho e produtividade da equipe
            {isRevalidating && (
              <span className="ml-2 text-xs text-teal-500 dark:text-teal-400">
                <i className="ri-refresh-line animate-spin mr-1"></i>atualizando...
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-teal-300 dark:hover:border-teal-600 transition-colors cursor-pointer min-w-[180px] max-w-[260px]">
              {selectedProjectId !== 'all' && selectedProject?.cor && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedProject.cor }}></span>}
              {selectedProjectId === 'all' && <i className="ri-folder-chart-line text-base text-gray-400 dark:text-gray-500 flex-shrink-0"></i>}
              <span className="truncate flex-1 text-left">{selectedProjectId === 'all' ? 'Todos os projetos' : selectedProject?.nome || 'Projeto'}</span>
              <i className={`ri-arrow-down-s-line text-base text-gray-400 flex-shrink-0 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`}></i>
            </button>
            {isProjectDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700"><p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 py-1">Filtrar por projeto</p></div>
                <div className="max-h-64 overflow-y-auto p-1.5">
                  <button onClick={() => { setSelectedProjectId('all'); setIsProjectDropdownOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${selectedProjectId === 'all' ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                    <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0"><i className="ri-apps-line text-sm text-gray-500 dark:text-gray-400"></i></div>
                    <div className="flex-1 min-w-0"><span className="text-sm font-medium truncate block">Todos os projetos</span><span className="text-[11px] text-gray-400 dark:text-gray-500">{projectsList.length} projeto{projectsList.length !== 1 ? 's' : ''}</span></div>
                    {selectedProjectId === 'all' && <i className="ri-check-line text-teal-600 dark:text-teal-400 text-base flex-shrink-0"></i>}
                  </button>
                  {projectsList.length > 0 && <div className="my-1.5 mx-2 border-t border-gray-100 dark:border-gray-700"></div>}
                  {projectsList.map((project) => (
                    <button key={project.id} onClick={() => { setSelectedProjectId(project.id); setIsProjectDropdownOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${selectedProjectId === project.id ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (project.cor || '#14b8a6') + '18' }}><i className="ri-folder-3-line text-sm" style={{ color: project.cor || '#14b8a6' }}></i></div>
                      <span className="text-sm font-medium truncate flex-1">{project.nome}</span>
                      {selectedProjectId === project.id && <i className="ri-check-line text-teal-600 dark:text-teal-400 text-base flex-shrink-0"></i>}
                    </button>
                  ))}
                  {projectsList.length === 0 && <div className="px-3 py-4 text-center"><p className="text-xs text-gray-400 dark:text-gray-500">Nenhum projeto encontrado</p></div>}
                </div>
              </div>
            )}
          </div>
          <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
            {[{ value: '7d' as const, label: '7 dias' }, { value: '30d' as const, label: '30 dias' }, { value: '90d' as const, label: '90 dias' }].map((opt) => (
              <button key={opt.value} onClick={() => setPeriod(opt.value)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${period === opt.value ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>{opt.label}</button>
            ))}
          </div>
          <button onClick={() => retry()} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer" title="Atualizar dados">
            <i className={`ri-refresh-line text-lg ${(loading || isRevalidating) ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {selectedProjectId !== 'all' && selectedProject && (
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/40 rounded-full">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedProject.cor || '#14b8a6' }}></span>
            <span className="text-xs font-medium text-teal-700 dark:text-teal-300">Filtrando: {selectedProject.nome}</span>
            <button onClick={() => setSelectedProjectId('all')} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-teal-200 dark:hover:bg-teal-800/50 transition-colors cursor-pointer"><i className="ri-close-line text-xs text-teal-600 dark:text-teal-400"></i></button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 flex items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950/30 mb-4"><i className="ri-loader-4-line animate-spin text-2xl text-teal-600 dark:text-teal-400"></i></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Carregando relatórios...</p>
        </div>
      ) : (
        <>
          <StatsCards stats={stats} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            <div className="lg:col-span-2 min-w-0"><WeeklyProductivityChart data={weeklyData} /></div>
            <div className="min-w-0"><TaskDistributionChart data={statusData} /></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <div className="min-w-0"><PerformanceTrendChart data={trendData} /></div>
            <div className="min-w-0"><ProjectsProgressChart data={projectsData} /></div>
          </div>
          <div className="mb-5"><SprintBurndownChart accessibleProjectIds={accessibleProjectIds} selectedProjectId={selectedProjectId} /></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="min-w-0"><PriorityBreakdown data={priorityData} /></div>
            <div className="min-w-0"><TeamRanking members={teamData} /></div>
            <div className="min-w-0"><RecentActivityList activities={activityData} /></div>
          </div>
        </>
      )}
    </>
  );
}
