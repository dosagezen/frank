import { memo } from 'react';

interface WeekInfo {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  daysInTimeline: number;
  monthYear: string;
}

interface MonthInfo {
  label: string;
  year: number;
  month: number;
  totalDays: number;
  weeks: WeekInfo[];
}

interface GanttHeaderProps {
  months: MonthInfo[];
  dayWidth: number;
  totalDays: number;
  timelineRef: React.RefObject<HTMLDivElement>;
  isCurrentMonth: (year: number, month: number) => boolean;
  isCurrentWeek: (week: WeekInfo) => boolean;
}

const GanttHeader = memo(({
  months,
  dayWidth,
  totalDays,
  timelineRef,
  isCurrentMonth,
  isCurrentWeek,
}: GanttHeaderProps) => {
  return (
    <div className="flex border-b border-zinc-800">
      {/* Coluna esquerda header */}
      <div className="w-[340px] md:w-[280px] flex-shrink-0 px-4 py-3 border-r border-zinc-800 bg-zinc-900/50">
        <div className="text-xs uppercase text-zinc-500 font-medium tracking-wide">
          Eventos / Projetos / Sprints / Tarefas
        </div>
      </div>

      {/* Timeline header com scroll sincronizado */}
      <div
        className="flex-1 overflow-x-auto overflow-y-hidden gantt-scroll"
        ref={timelineRef}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div style={{ width: `${totalDays * dayWidth}px` }}>
          {/* Linha 1: Meses */}
          <div className="flex border-b border-zinc-800/50">
            {months.map((monthData, idx) => (
              <div
                key={idx}
                className={`flex-shrink-0 px-2 py-2 text-center relative border-r border-zinc-800/50 ${
                  isCurrentMonth(monthData.year, monthData.month)
                    ? 'bg-teal-500/[0.08]'
                    : 'bg-zinc-900/30'
                }`}
                style={{ width: `${monthData.totalDays * dayWidth}px` }}
              >
                <div className="text-xs font-bold text-zinc-300">{monthData.label}</div>
              </div>
            ))}
          </div>

          {/* Linha 2: Semanas */}
          <div className="flex bg-zinc-900/20">
            {months.map((monthData, monthIdx) => (
              <div
                key={monthIdx}
                className="flex flex-shrink-0"
                style={{ width: `${monthData.totalDays * dayWidth}px` }}
              >
                {monthData.weeks.map((week, weekIdx) => (
                  <div
                    key={weekIdx}
                    className={`flex-shrink-0 px-1 py-2 text-center border-r border-zinc-800/30 ${
                      isCurrentWeek(week) ? 'bg-teal-500/[0.05]' : ''
                    }`}
                    style={{ width: `${week.daysInTimeline * dayWidth}px` }}
                  >
                    <div className="text-[10px] font-normal text-zinc-500">
                      Sem {week.weekNumber}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

GanttHeader.displayName = 'GanttHeader';

export default GanttHeader;