import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { supabase } from '../../../lib/supabaseClient';
import { safeFetchMany } from '../../../services/supabaseHelpers';
import { parseDate, formatDateBR } from '../../../utils/dateHelpers';

interface Sprint {
  id: string;
  name: string;
  project_id: string;
  end_date: string | null;
  status: string | null;
  created_at: string;
}

interface BurndownPoint {
  day: string;
  label: string;
  ideal: number;
  real: number | null;
}

interface SprintBurndownChartProps {
  accessibleProjectIds: string[];
  selectedProjectId: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700">
      <p className="text-xs font-semibold text-gray-900 dark:text-white mb-2">
        {label}
      </p>
      {payload.map((entry, index) => {
        if (entry.value === null || entry.value === undefined) return null;
        return (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600 dark:text-gray-400">
              {entry.name}:
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {entry.value} {entry.value === 1 ? 'tarefa' : 'tarefas'}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default function SprintBurndownChart({
  accessibleProjectIds,
  selectedProjectId,
}: SprintBurndownChartProps) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [burndownData, setBurndownData] = useState<BurndownPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sprintInfo, setSprintInfo] = useState<{
    totalTasks: number;
    completedTasks: number;
    remainingTasks: number;
    daysLeft: number;
  } | null>(null);

  // Load sprints
  useEffect(() => {
    const loadSprints = async () => {
      const projectIds =
        selectedProjectId === 'all'
          ? accessibleProjectIds
          : [selectedProjectId];

      if (projectIds.length === 0) {
        setSprints([]);
        setLoading(false);
        return;
      }

      try {
        const data = await safeFetchMany(() =>
          supabase
            .from('project_sprints')
            .select('id, name, project_id, end_date, status, created_at')
            .in('project_id', projectIds)
            .order('created_at', { ascending: false })
        );

        setSprints(data || []);

        // Auto-select first active sprint or first sprint
        if (data && data.length > 0) {
          const activeSprint = data.find(
            (s: Sprint) =>
              s.status === 'em-andamento' || s.status === 'ativa'
          );
          setSelectedSprintId(activeSprint?.id || data[0].id);
        } else {
          setSelectedSprintId('');
        }
      } catch (err) {
        console.error('Erro ao carregar sprints:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSprints();
  }, [accessibleProjectIds, selectedProjectId]);

  // Load burndown data for selected sprint
  const loadBurndown = useCallback(async () => {
    if (!selectedSprintId) {
      setBurndownData([]);
      setSprintInfo(null);
      return;
    }

    try {
      const sprint = sprints.find((s) => s.id === selectedSprintId);
      if (!sprint) return;

      // Get tasks for this sprint from both sprint_tasks and tasks tables
      const [sprintTasksData, mainTasksData] = await Promise.all([
        safeFetchMany(() =>
          supabase
            .from('sprint_tasks')
            .select('id, status, created_at')
            .eq('sprint_id', selectedSprintId)
        ),
        safeFetchMany(() =>
          supabase
            .from('tasks')
            .select('id, status, created_at, updated_at')
            .eq('sprint_id', selectedSprintId)
        ),
      ]);

      // Combine tasks, prefer main tasks if available
      const mainTaskIds = new Set(
        (mainTasksData || []).map((t: any) => t.id)
      );
      const allTasks = [
        ...(mainTasksData || []),
        ...(sprintTasksData || []).filter(
          (st: any) => !mainTaskIds.has(st.id)
        ),
      ];

      const totalTasks = allTasks.length;

      if (totalTasks === 0) {
        setBurndownData([]);
        setSprintInfo({
          totalTasks: 0,
          completedTasks: 0,
          remainingTasks: 0,
          daysLeft: 0,
        });
        return;
      }

      // ✅ CORRIGIDO: Usar parseDate para evitar problema de timezone
      // Determine sprint date range
      const sprintStart = parseDate(sprint.created_at.split('T')[0]) || new Date(sprint.created_at);
      sprintStart.setHours(0, 0, 0, 0);

      let sprintEnd: Date;
      if (sprint.end_date) {
        sprintEnd = parseDate(sprint.end_date) || new Date(sprint.end_date);
      } else {
        // Default 14 days if no end date
        sprintEnd = new Date(sprintStart);
        sprintEnd.setDate(sprintEnd.getDate() + 14);
      }
      sprintEnd.setHours(23, 59, 59, 999);

      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const totalDays = Math.max(
        1,
        Math.ceil(
          (sprintEnd.getTime() - sprintStart.getTime()) / (1000 * 60 * 60 * 24)
        )
      );

      // Build burndown points
      const points: BurndownPoint[] = [];
      const idealDecrement = totalTasks / totalDays;

      // Count completed tasks by date
      const completedByDate = new Map<string, number>();
      allTasks.forEach((task: any) => {
        const isCompleted =
          task.status === 'feito' ||
          task.status === 'concluida' ||
          task.status === 'concluido';
        if (isCompleted) {
          const completedDate = task.updated_at || task.created_at;
          if (completedDate) {
            const dateStr = new Date(completedDate)
              .toISOString()
              .split('T')[0];
            completedByDate.set(
              dateStr,
              (completedByDate.get(dateStr) || 0) + 1
            );
          }
        }
      });

      let cumulativeCompleted = 0;
      const endDate = sprintEnd < today ? sprintEnd : today;

      for (let i = 0; i <= totalDays; i++) {
        const currentDate = new Date(sprintStart);
        currentDate.setDate(currentDate.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];

        const idealRemaining = Math.max(
          0,
          totalTasks - idealDecrement * i
        );

        // Count tasks completed on or before this date
        const completedOnDay = completedByDate.get(dateStr) || 0;
        cumulativeCompleted += completedOnDay;

        const realRemaining = totalTasks - cumulativeCompleted;

        const isPast = currentDate <= endDate;
        const isToday = dateStr === today.toISOString().split('T')[0];

        const dayLabel = `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

        points.push({
          day: dateStr,
          label: dayLabel,
          ideal: Math.round(idealRemaining * 10) / 10,
          real: isPast || isToday ? realRemaining : null,
        });
      }

      setBurndownData(points);

      // Sprint info
      const completedTasks = allTasks.filter(
        (t: any) =>
          t.status === 'feito' ||
          t.status === 'concluida' ||
          t.status === 'concluido'
      ).length;

      const daysLeft = Math.max(
        0,
        Math.ceil(
          (sprintEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
      );

      setSprintInfo({
        totalTasks,
        completedTasks,
        remainingTasks: totalTasks - completedTasks,
        daysLeft,
      });
    } catch (err) {
      console.error('Erro ao carregar burndown:', err);
    }
  }, [selectedSprintId, sprints]);

  useEffect(() => {
    loadBurndown();
  }, [loadBurndown]);

  const selectedSprint = useMemo(
    () => sprints.find((s) => s.id === selectedSprintId),
    [sprints, selectedSprintId]
  );

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'em-andamento':
      case 'ativa':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">
            Em andamento
          </span>
        );
      case 'concluida':
      case 'concluido':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            Concluída
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            Pendente
          </span>
        );
    }
  };

  const burndownHealth = useMemo(() => {
    if (!sprintInfo || sprintInfo.totalTasks === 0) return null;
    const completionRate =
      (sprintInfo.completedTasks / sprintInfo.totalTasks) * 100;

    // Compare real vs ideal at current point
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPoint = burndownData.find((p) => p.day === todayStr);
    if (!todayPoint || todayPoint.real === null) return null;

    const diff = todayPoint.real - todayPoint.ideal;
    if (diff <= 0) {
      return {
        status: 'ahead',
        label: 'Adiantado',
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        icon: 'ri-arrow-up-circle-fill',
      };
    } else if (diff <= sprintInfo.totalTasks * 0.15) {
      return {
        status: 'ontrack',
        label: 'No ritmo',
        color: 'text-teal-600 dark:text-teal-400',
        bg: 'bg-teal-50 dark:bg-teal-950/30',
        icon: 'ri-checkbox-circle-fill',
      };
    } else {
      return {
        status: 'behind',
        label: 'Atrasado',
        color: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/30',
        icon: 'ri-error-warning-fill',
      };
    }
  }, [sprintInfo, burndownData]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-32 mb-6" />
          <div className="h-72 bg-gray-50 dark:bg-gray-700/50 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2
            className="text-base sm:text-lg font-bold text-gray-900 dark:text-white"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Burndown da Sprint
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Progresso real vs ideal de conclusão de tarefas
          </p>
        </div>

        {/* Sprint selector */}
        {sprints.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-teal-300 dark:hover:border-teal-600 transition-colors cursor-pointer min-w-[200px] max-w-[280px]"
            >
              <i className="ri-speed-mini-line text-base text-teal-500 flex-shrink-0" />
              <span className="truncate flex-1 text-left text-xs">
                {selectedSprint?.name || 'Selecionar sprint'}
              </span>
              <i
                className={`ri-arrow-down-s-line text-sm text-gray-400 flex-shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 py-1">
                    Selecionar Sprint
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {sprints.map((sprint) => (
                    <button
                      key={sprint.id}
                      onClick={() => {
                        setSelectedSprintId(sprint.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                        selectedSprintId === sprint.id
                          ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {sprint.name}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                          {/* ✅ CORRIGIDO: Usar formatDateBR para evitar problema de timezone */}
                          {sprint.end_date
                            ? `Até ${formatDateBR(sprint.end_date, { day: '2-digit', month: '2-digit' })}`
                            : 'Sem data final'}
                        </span>
                      </div>
                      {getStatusBadge(sprint.status)}
                      {selectedSprintId === sprint.id && (
                        <i className="ri-check-line text-teal-600 dark:text-teal-400 text-base flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sprint info cards */}
      {sprintInfo && sprintInfo.totalTasks > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
              Total
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {sprintInfo.totalTasks}
            </p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Concluídas
            </p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
              {sprintInfo.completedTasks}
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              Restantes
            </p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
              {sprintInfo.remainingTasks}
            </p>
          </div>
          <div className="rounded-lg px-3 py-2.5 flex items-center gap-2" style={{ backgroundColor: burndownHealth ? undefined : undefined }}>
            {burndownHealth ? (
              <div className={`flex items-center gap-2 w-full rounded-lg px-3 py-2.5 -mx-3 -my-2.5 ${burndownHealth.bg}`}>
                <div className="flex-1">
                  <p className={`text-[11px] font-medium ${burndownHealth.color}`}>
                    Status
                  </p>
                  <div className="flex items-center gap-1.5">
                    <i className={`${burndownHealth.icon} text-sm ${burndownHealth.color}`} />
                    <p className={`text-sm font-bold ${burndownHealth.color}`}>
                      {burndownHealth.label}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2.5 w-full -mx-3 -my-2.5">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  Dias restantes
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {sprintInfo.daysLeft}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart or empty state */}
      {sprints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14">
          <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700 mb-3">
            <i className="ri-speed-mini-line text-2xl text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Nenhuma sprint encontrada
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs">
            Crie sprints nos seus projetos para visualizar o gráfico de burndown
          </p>
        </div>
      ) : burndownData.length === 0 || (sprintInfo && sprintInfo.totalTasks === 0) ? (
        <div className="flex flex-col items-center justify-center py-14">
          <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700 mb-3">
            <i className="ri-bar-chart-box-line text-2xl text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Sprint sem tarefas
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs">
            Adicione tarefas a esta sprint para gerar o gráfico de burndown
          </p>
        </div>
      ) : (
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={burndownData}>
              <defs>
                <linearGradient id="burndownIdealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.08} />
                  <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="burndownRealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                allowDecimals={false}
                domain={[0, 'dataMax']}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#e5e7eb" />

              {/* Ideal line (dashed) */}
              <Area
                type="monotone"
                dataKey="ideal"
                name="Ideal"
                stroke="#d1d5db"
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="url(#burndownIdealGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#9ca3af', strokeWidth: 2, stroke: '#fff' }}
              />

              {/* Real line */}
              <Area
                type="monotone"
                dataKey="real"
                name="Real"
                stroke="#14b8a6"
                strokeWidth={2.5}
                fill="url(#burndownRealGrad)"
                dot={{ r: 3, fill: '#14b8a6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#14b8a6', strokeWidth: 2, stroke: '#fff' }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      {burndownData.length > 0 && sprintInfo && sprintInfo.totalTasks > 0 && (
        <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 border-t-2 border-dashed border-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Ideal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-teal-500 rounded-full" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Real
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
