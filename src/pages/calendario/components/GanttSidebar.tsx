import { memo } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

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

interface GanttSidebarProps {
  visibleItems: HierarchyItem[];
  expandedItems: Set<string>;
  tasksBySprint: Map<string, HierarchyItem[]>;
  leftColumnRef: React.RefObject<HTMLDivElement>;
  toggleExpand: (itemId: string) => void;
  getStatusColor: (status?: string) => string;
  handleLeftScroll: () => void;
  handleEventClick: (id: string) => void;
  getFullEventById: (id: string) => any;
  setEventTooltip: (tooltip: any) => void;
  SortableTask: React.ComponentType<{ item: HierarchyItem; children: React.ReactNode }>;
  DroppableSprint: React.ComponentType<{ item: HierarchyItem; children: React.ReactNode }>;
  DraggableTask: React.ComponentType<{ item: HierarchyItem; children: React.ReactNode }>;
}

const GanttSidebar = memo(({
  visibleItems,
  expandedItems,
  tasksBySprint,
  leftColumnRef,
  toggleExpand,
  getStatusColor,
  handleLeftScroll,
  handleEventClick,
  getFullEventById,
  setEventTooltip,
  SortableTask,
  DroppableSprint,
  DraggableTask,
}: GanttSidebarProps) => {
  return (
    <div
      ref={leftColumnRef}
      className="w-[340px] md:w-[280px] flex-shrink-0 border-r border-zinc-800 overflow-y-auto bg-zinc-900 gantt-scroll"
      onScroll={handleLeftScroll}
    >
      <div className="pb-20">
        {visibleItems.map((item) => {
          // Pular tarefas que pertencem a uma sprint — já renderizadas pelo SortableContext
          if (item.type === 'task' && item.sprintId) return null;

          const itemContent = (
            <div
              key={item.id}
              className={`flex items-center px-4 py-3 border-b border-zinc-800/50 hover:bg-white/[0.03] transition-colors group ${
                item.type === 'event' ? 'cursor-pointer' : 'cursor-pointer'
              }`}
              style={{ paddingLeft: `${16 + item.level * 24}px`, height: '48px' }}
              title={item.type === 'event' ? undefined : item.name}
              onClick={() => {
                if (item.type === 'event') {
                  handleEventClick(item.id);
                }
              }}
              onMouseEnter={(e) => {
                if (item.type === 'event') {
                  const fullEvent = getFullEventById(item.id);
                  if (fullEvent) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setEventTooltip({
                      event: fullEvent,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                    });
                  }
                }
              }}
              onMouseLeave={() => {
                if (item.type === 'event') {
                  setEventTooltip(null);
                }
              }}
            >
              {/* Chevron */}
              {item.hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(item.id);
                  }}
                  className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors mr-2"
                >
                  <i
                    className={`ri-arrow-${
                      expandedItems.has(item.id) ? 'down' : 'right'
                    }-s-line text-sm`}
                  ></i>
                </button>
              )}

              {/* Espaçador se não tem chevron */}
              {!item.hasChildren && item.level > 0 && <div className="w-6 flex-shrink-0" />}

              {/* Indicador de status para tarefas */}
              {item.type === 'task' && item.status && (
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 mr-2"
                  style={{ backgroundColor: getStatusColor(item.status) }}
                />
              )}

              {/* Nome do item */}
              <div
                className={`flex-1 truncate ${
                  item.type === 'project'
                    ? 'text-base font-bold text-zinc-100'
                    : item.type === 'sprint'
                    ? 'text-sm font-semibold text-zinc-300'
                    : item.type === 'event'
                    ? 'text-xs font-normal text-zinc-400 hover:text-zinc-200'
                    : 'text-xs font-normal text-zinc-400'
                }`}
                style={{
                  letterSpacing:
                    item.type === 'project' ? '-0.01em' : item.type === 'sprint' ? '0.01em' : '0',
                }}
              >
                {item.name}
              </div>

              {/* Cor do projeto (apenas para projetos) */}
              {item.type === 'project' && item.color && item.id !== 'events-section' && (
                <div
                  className="w-3 h-3 rounded flex-shrink-0 ml-2"
                  style={{ backgroundColor: item.color }}
                />
              )}
            </div>
          );

          // Renderizar sprints com droppable
          if (item.type === 'sprint') {
            const sprintTasks = tasksBySprint.get(item.id) || [];
            const taskIds = sprintTasks.map((t) => t.id);
            const isExpanded = expandedItems.has(item.id);

            return (
              <div key={item.id}>
                <DroppableSprint item={item}>
                  {itemContent}
                </DroppableSprint>
                
                {/* SortableContext envolve TODAS as tarefas da sprint */}
                {isExpanded && taskIds.length > 0 && (
                  <SortableContext
                    items={taskIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {sprintTasks.map((taskItem) => {
                      const taskContent = (
                        <div
                          className="flex items-center px-4 py-3 border-b border-zinc-800/50 hover:bg-white/[0.03] transition-colors group cursor-pointer"
                          style={{ paddingLeft: `${16 + taskItem.level * 24}px`, height: '48px' }}
                          title={taskItem.name}
                        >
                          <div className="w-6 flex-shrink-0" />
                          {taskItem.status && (
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0 mr-2"
                              style={{ backgroundColor: getStatusColor(taskItem.status) }}
                            />
                          )}
                          <div className="flex-1 truncate text-xs font-normal text-zinc-400">
                            {taskItem.name}
                          </div>
                        </div>
                      );

                      return (
                        <SortableTask key={taskItem.id} item={taskItem}>
                          {taskContent}
                        </SortableTask>
                      );
                    })}
                  </SortableContext>
                )}
              </div>
            );
          }

          // Renderizar tarefas fora de sprint com draggable simples
          if (item.type === 'task' && !item.sprintId) {
            return (
              <DraggableTask key={item.id} item={item}>
                {itemContent}
              </DraggableTask>
            );
          }

          // Projetos e eventos renderizam normalmente
          return <div key={item.id}>{itemContent}</div>;
        })}
      </div>
    </div>
  );
});

GanttSidebar.displayName = 'GanttSidebar';

export default GanttSidebar;