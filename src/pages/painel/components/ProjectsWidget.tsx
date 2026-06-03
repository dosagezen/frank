import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { fetchProjects, isProjectPrivate, Project } from '../../../services/projectsService';
import { useCachedData } from '../../../hooks/useCachedData';
import { CACHE_KEYS } from '../../../services/localCache';

interface ProjectDisplay {
  id: string;
  nome: string;
  progresso: number;
  status: string;
  deadline: string;
  tarefas_total: number;
  tarefas_concluidas: number;
  membros_count: number;
  raw_status: string;
  isPrivate: boolean;
  updated_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  'planejamento': { label: 'Planejamento', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40', icon: 'ri-draft-line' },
  'em-andamento': { label: 'Em Andamento', color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/40', icon: 'ri-loader-4-line' },
  'concluido': { label: 'Concluído', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/40', icon: 'ri-check-double-line' },
  'pausado': { label: 'Pausado', color: 'text-gray-700 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700', icon: 'ri-pause-circle-line' },
  'cancelado': { label: 'Cancelado', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40', icon: 'ri-close-circle-line' },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Sem alteração';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'Agora mesmo';
  if (diffMin < 60) return `Há ${diffMin} min`;
  if (diffH < 24) return `Há ${diffH}h`;
  if (diffD === 1) return 'Ontem';
  if (diffD < 7) return `Há ${diffD} dias`;
  if (diffD < 30) return `Há ${Math.floor(diffD / 7)} sem.`;
  return `Há ${Math.floor(diffD / 30)} meses`;
}

export default function ProjectsWidget() {
  const navigate = useNavigate();

  const fetchFn = useCallback(async (): Promise<ProjectDisplay[]> => {
    const projectsData = await fetchProjects();

    if (!projectsData || projectsData.length === 0) return [];

    const projectsWithStats = projectsData.map((project: Project) => {
      let diasRestantes = '';
      if (project.deadline) {
        const hoje = new Date();
        const prazo = new Date(project.deadline + 'T12:00:00');
        const diff = Math.ceil((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0) diasRestantes = 'Atrasado';
        else if (diff === 0) diasRestantes = 'Hoje';
        else if (diff === 1) diasRestantes = '1 dia';
        else diasRestantes = `${diff} dias`;
      } else {
        diasRestantes = 'Sem prazo';
      }

      return {
        id: project.id || '',
        nome: project.nome,
        progresso: project.progresso || 0,
        status: project.status,
        raw_status: project.status || 'planejamento',
        tarefas_total: project.total_tarefas || 0,
        tarefas_concluidas: project.tarefas_concluidas || 0,
        membros_count: project.equipe?.length || 0,
        deadline: diasRestantes,
        isPrivate: isProjectPrivate(project),
        updated_at: project.updated_at || project.created_at || null,
      };
    });

    const sorted = [...projectsWithStats].sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return dateB - dateA;
    });

    return sorted.slice(0, 3);
  }, []);

  const { data: projects, loading } = useCachedData<ProjectDisplay[]>(
    CACHE_KEYS.PAINEL_PROJECTS,
    fetchFn
  );

  const displayProjects = projects ?? [];

  const getStatusConfig = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG['planejamento'];

  const getProjectColor = (index: number) => {
    const colors = [
      'bg-teal-600 dark:bg-teal-500',
      'bg-orange-600 dark:bg-orange-500',
      'bg-green-600 dark:bg-green-500',
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden max-w-full">
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
        </div>
        <div className="p-4 sm:p-6 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4 animate-pulse"></div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse"></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (displayProjects.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden max-w-full">
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Projetos Recentes
          </h2>
        </div>
        <div className="p-8 text-center">
          <i className="ri-folder-line text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum projeto cadastrado</p>
          <button
            onClick={() => navigate('/projetos')}
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            Criar Projeto
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden max-w-full">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Projetos Recentes
            </h2>
            <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-semibold flex-shrink-0">
              3
            </span>
          </div>
          <button
            onClick={() => navigate('/projetos')}
            className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium text-sm whitespace-nowrap cursor-pointer flex-shrink-0"
          >
            Ver todos <i className="ri-arrow-right-line ml-1"></i>
          </button>
        </div>
      </div>

      {/* Cards — 1 coluna */}
      <div className="p-4 sm:p-6 flex flex-col gap-3">
        {displayProjects.map((project, index) => {
          const statusConf = getStatusConfig(project.raw_status);
          return (
            <div
              key={project.id}
              className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer border border-gray-200 dark:border-gray-600 group"
              onClick={() => navigate('/projetos')}
            >
              {/* Linha superior: nome + status */}
              <div className="flex items-start justify-between mb-3 gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate flex-1 min-w-0 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {project.nome}
                  </h3>
                  {project.isPrivate && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 flex-shrink-0">
                      <i className="ri-lock-line text-[10px]"></i>
                      Privado
                    </span>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${statusConf.bg} ${statusConf.color}`}>
                  <i className={`${statusConf.icon} text-[10px] w-3 h-3 flex items-center justify-center`}></i>
                  {statusConf.label}
                </span>
              </div>

              {/* Barra de progresso */}
              <div className="mb-3 sm:mb-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Progresso</span>
                  <span className="font-bold text-gray-900 dark:text-white">{project.progresso}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`${getProjectColor(index)} h-1.5 rounded-full transition-all`}
                    style={{ width: `${project.progresso}%` }}
                  ></div>
                </div>
              </div>

              {/* Stats + última alteração */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <i className="ri-checkbox-multiple-line text-[11px]"></i>
                    {project.tarefas_concluidas}/{project.tarefas_total}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-team-line text-[11px]"></i>
                    {project.membros_count}
                  </span>
                  <span className={`flex items-center gap-1 ${project.deadline === 'Atrasado' ? 'text-red-500 dark:text-red-400 font-semibold' : ''}`}>
                    <i className="ri-calendar-line text-[11px]"></i>
                    {project.deadline}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                  <i className="ri-time-line text-[11px]"></i>
                  {timeAgo(project.updated_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
