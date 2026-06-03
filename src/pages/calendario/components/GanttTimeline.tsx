import { memo } from 'react';

interface HierarchyItem {
  id: string;
  type: 'project' | 'sprint' | 'task' | 'event';
  name: string;
  level: number;
  hasChildren?: boolean;
  color?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  projectId?: string;
  sprintId?: string;
  prazo?: Date;
  isRecurring?: boolean;
  occurrences?: Date[];
}

interface MonthInfo {
  label: string;
  year: number;
  month: number;
  totalDays: number;
  weeks: any[];
}

interface GanttTimelineProps {
  visibleItems: HierarchyItem[];
  months: MonthInfo[];
  dayWidth: number;
  totalDays: number;
  startDate: Date;
  scrollBodyRef: React.RefObject<HTMLDivElement>;
  handleBodyScroll: () => void;
  getTodayPosition: () => number;
  scrollToToday: () => void;
  todayTooltip: string;
  getBarPosition: (start?: Date, end?: Date) => { left: number; width: number } | null;
  getOverdueExtension: (deadline?: Date, prazo?: Date) => { left: number; width: number } | null;
  getStatusColor: (status?: string) => string;
  handleEventClick: (id: string) => void;
  getFullEventById: (id: string) => any;
  setEventTooltip: (tooltip: any) => void;
}

const GanttTimeline = memo(({
  visibleItems,
  months,
  dayWidth,
  totalDays,
  startDate,
  scrollBodyRef,
  handleBodyScroll,
  getTodayPosition,
  scrollToToday,
  todayTooltip,
  getBarPosition,
  getOverdueExtension,
  getStatusColor,
  handleEventClick,
  getFullEventById,
  setEventTooltip,
}: GanttTimelineProps) => {
  return (
    <div
      ref={scrollBodyRef}
      className="flex-1 overflow-x-auto overflow-y-auto relative gantt-scroll"
      onScroll={handleBodyScroll}
    >
      <div className="relative pb-20" style={{ width: `${totalDays * dayWidth}px`, minHeight: '100%' }}>
        {/* Grid vertical com linhas de semana e mês */}
        <div className="absolute inset-0 flex pointer-events-none">
          {months.map((monthData, monthIdx) => {
            let accumulatedWidth = 0;
            return (
              <div key={monthIdx} className="relative" style={{ width: `${monthData.totalDays * dayWidth}px` }}>
                {/* Linha vertical no início do mês */}
                <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.08]" />
                {/* Linhas verticais de separação de semana */}
                {monthData.weeks.map((week, weekIdx) => {
                  const linePosition = accumulatedWidth;
                  accumulatedWidth += week.daysInTimeline * dayWidth;
                  return (
                    <div
                      key={weekIdx}
                      className="absolute top-0 bottom-0 w-px bg-white/[0.04]"
                      style={{ left: `${linePosition}px` }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Linha "Hoje" com triângulo no topo */}
        <div
          className="absolute top-0 bottom-0 w-px bg-red-500/60 z-20"
          style={{ left: `${getTodayPosition()}px` }}
        >
          {/* Triângulo apontando para baixo */}
          <div className="absolute -top-0 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500" />
          </div>
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap cursor-pointer hover:bg-red-400 transition-colors"
            style={{ pointerEvents: 'auto' }}
            onClick={scrollToToday}
            title={todayTooltip}
          >
            HOJE
          </div>
        </div>

        {/* Barras do Gantt */}
        <div className="relative">
          {visibleItems.map((item) => {
            const position = getBarPosition(item.startDate, item.endDate);
            const overdueExtension =
              item.type === 'project' ? getOverdueExtension(item.endDate, item.prazo) : null;

            return (
              <div
                key={item.id}
                className="border-b border-zinc-800/50 relative hover:bg-white/[0.03] transition-colors"
                style={{ height: '48px' }}
              >
                {/* Eventos renderizados */}
                {item.type === 'event' && (() => {
                  const msPerDay = 1000 * 60 * 60 * 24;

                  const tailwindToHex: Record<string, string> = {
                    'bg-red-500': '#ef4444',
                    'bg-orange-500': '#f97316',
                    'bg-amber-500': '#f59e0b',
                    'bg-yellow-500': '#eab308',
                    'bg-lime-500': '#84cc16',
                    'bg-green-500': '#22c55e',
                    'bg-emerald-500': '#10b981',
                    'bg-teal-500': '#14b8a6',
                    'bg-cyan-500': '#06b6d4',
                    'bg-sky-500': '#0ea5e9',
                    'bg-blue-500': '#3b82f6',
                    'bg-indigo-500': '#6366f1',
                    'bg-violet-500': '#8b5cf6',
                    'bg-purple-500': '#a855f7',
                    'bg-fuchsia-500': '#d946ef',
                    'bg-pink-500': '#ec4899',
                    'bg-rose-500': '#f43f5e',
                  };

                  const rawColor = item.color || '';
                  const hexColor = tailwindToHex[rawColor] || (rawColor.startsWith('#') ? rawColor : '#f472b6');
                  const dotColor = (hexColor === '#6b7280') ? '#f472b6' : hexColor;

                  const fullEvent = getFullEventById(item.id);

                  /* Evento não recorrente — ponto único */
                  if (!item.isRecurring || !item.occurrences || item.occurrences.length <= 1) {
                    if (!item.startDate) return null;
                    const dateNorm = new Date(item.startDate);
                    dateNorm.setHours(0, 0, 0, 0);
                    const startNorm = new Date(startDate);
                    startNorm.setHours(0, 0, 0, 0);
                    const daysFromStart = Math.floor((dateNorm.getTime() - startNorm.getTime()) / msPerDay);
                    const leftPx = daysFromStart * dayWidth + dayWidth / 2 - 6;

                    return (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 flex items-center px-2 cursor-pointer hover:opacity-100 transition-opacity z-20"
                        style={{
                          left: `${leftPx}px`,
                          width: '12px',
                          height: '12px',
                          backgroundColor: dotColor,
                          opacity: 0.85,
                          borderRadius: '6px',
                          border: '2px solid rgba(0,0,0,0.3)',
                          boxShadow: `0 0 6px ${dotColor}88`,
                          zIndex: 20,
                        }}
                        onClick={() => handleEventClick(item.id)}
                        onMouseEnter={(e) => {
                          if (fullEvent) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setEventTooltip({
                              event: fullEvent,
                              x: rect.left + rect.width / 2,
                              y: rect.top - 8,
                            });
                          }
                        }}
                        onMouseLeave={() => setEventTooltip(null)}
                      />
                    );
                  }

                  /* Evento recorrente — múltiplos pontos pequenos */
                  return (
                    <>
                      {item.occurrences!.map((occDate, occIdx) => {
                        const occNorm = new Date(typeof occDate === 'string' ? occDate : occDate);
                        occNorm.setHours(0, 0, 0, 0);
                        const startNorm = new Date(startDate);
                        startNorm.setHours(0, 0, 0, 0);
                        const daysFromStart = Math.floor((occNorm.getTime() - startNorm.getTime()) / msPerDay);
                        const leftPx = daysFromStart * dayWidth + dayWidth / 2 - 4;
                        return (
                          <div
                            key={occIdx}
                            className="absolute top-1/2 -translate-y-1/2 flex items-center px-2 cursor-pointer hover:opacity-100 transition-opacity z-20"
                            style={{
                              left: `${leftPx}px`,
                              width: '8px',
                              height: '8px',
                              backgroundColor: dotColor,
                              opacity: 0.85,
                              borderRadius: '6px',
                              border: '2px solid rgba(0,0,0,0.3)',
                              boxShadow: `0 0 4px ${dotColor}66`,
                              zIndex: 20,
                            }}
                            onClick={() => handleEventClick(item.id)}
                            onMouseEnter={(e) => {
                              if (fullEvent) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setEventTooltip({
                                  event: fullEvent,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top - 8,
                                });
                              }
                            }}
                            onMouseLeave={() => setEventTooltip(null)}
                          />
                        );
                      })}
                    </>
                  );
                })()}

                {position && (
                  <>
                    {/* Projeto */}
                    {item.type === 'project' && item.id !== 'events-section' && (
                      <>
                        <div
                          className="absolute top-1/2 -translate-y-1/2 flex items-center px-2 cursor-pointer hover:opacity-100 transition-opacity"
                          style={{
                            left: `${position.left}px`,
                            width: `${position.width}px`,
                            height: '20px',
                            backgroundColor: item.color,
                            opacity: 0.85,
                            borderRadius: '6px',
                          }}
                          title={`${item.name}\nInício: ${item.startDate?.toLocaleDateString(
                            'pt-BR'
                          )}\nDeadline: ${item.endDate?.toLocaleDateString('pt-BR')}${
                            item.prazo ? `\nConcluído em: ${item.prazo.toLocaleDateString('pt-BR')}` : ''
                          }`}
                        >
                          {position.width > 100 && (
                            <span className="text-xs font-medium text-zinc-900 truncate">
                              {item.name}
                            </span>
                          )}
                        </div>

                        {/* Extensão de atraso */}
                        {overdueExtension && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 cursor-pointer hover:opacity-50 transition-opacity"
                            style={{
                              left: `${overdueExtension.left}px`,
                              width: `${overdueExtension.width}px`,
                              height: '20px',
                              backgroundColor: item.color,
                              opacity: 0.3,
                              borderRadius: '6px',
                              borderLeft: `2px dashed ${item.color}`,
                            }}
                            title={`Concluído com atraso\nDeadline: ${item.endDate?.toLocaleDateString(
                              'pt-BR'
                            )}\nConcluído em: ${item.prazo?.toLocaleDateString('pt-BR')}`}
                          />
                        )}
                      </>
                    )}

                    {/* Sprint */}
                    {item.type === 'sprint' && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 rounded cursor-pointer hover:opacity-75 transition-opacity"
                        style={{
                          left: `${position.left}px`,
                          width: `${position.width}px`,
                          height: '16px',
                          backgroundColor: item.color,
                          opacity: 0.45,
                        }}
                        title={`${item.name}\n${item.startDate?.toLocaleDateString(
                          'pt-BR'
                        )} - ${item.endDate?.toLocaleDateString('pt-BR')}`}
                      />
                    )}

                    {/* Tarefa */}
                    {item.type === 'task' && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 rounded-sm cursor-pointer hover:opacity-100 transition-opacity"
                        style={{
                          left: `${position.left}px`,
                          width: `${position.width}px`,
                          height: '12px',
                          backgroundColor: getStatusColor(item.status),
                          opacity: 0.9,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}
                        title={`${item.name}\nStatus: ${item.status}\n${item.startDate?.toLocaleDateString(
                          'pt-BR'
                        )} - ${item.endDate?.toLocaleDateString('pt-BR')}`}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

GanttTimeline.displayName = 'GanttTimeline';

export default GanttTimeline;