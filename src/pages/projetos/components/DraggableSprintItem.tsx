import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDateBR } from '../../../utils/dateHelpers';

interface SprintForm {
  id?: string;
  name: string;
  startDate?: string;
  endDate: string;
  members: string[];
  status: string;
}

interface DraggableSprintItemProps {
  sprint: SprintForm;
  index: number;
  editingSprintIndex: number | null;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  dragId: string;
}

export default function DraggableSprintItem({
  sprint,
  index,
  editingSprintIndex,
  onEdit,
  onRemove,
  dragId,
}: DraggableSprintItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dragId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as any,
  };

  const getStatusBadge = (status: string) => {
    if (status === 'concluida') {
      return {
        className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
        label: 'Concluída',
      };
    }
    if (status === 'em-andamento') {
      return {
        className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
        label: 'Em Andamento',
      };
    }
    return {
      className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
      label: 'Pendente',
    };
  };

  const statusBadge = getStatusBadge(sprint.status);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
        isDragging
          ? 'shadow-lg bg-white dark:bg-gray-800 border-teal-400 dark:border-teal-600 ring-2 ring-teal-200 dark:ring-teal-800'
          : editingSprintIndex === index
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 ring-1 ring-amber-300 dark:ring-amber-700'
          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing rounded transition-colors flex-shrink-0 touch-none"
        {...attributes}
        {...listeners}
        title="Arrastar para reordenar"
      >
        <i className="ri-draggable text-lg"></i>
      </button>

      <div className="w-8 h-8 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-lg flex-shrink-0">
        <i className="ri-flashlight-line text-teal-600 dark:text-teal-400 text-sm"></i>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          #{index + 1} - {sprint.name}
        </p>
        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
          {/* ✅ CORRIGIDO: Usar formatDateBR para evitar problema de timezone */}
          {sprint.startDate || sprint.endDate ? (
            <span className="flex items-center gap-1">
              <i className="ri-calendar-event-line"></i>
              {sprint.startDate && sprint.endDate ? (
                <>
                  {formatDateBR(sprint.startDate)}
                  {' → '}
                  {formatDateBR(sprint.endDate)}
                </>
              ) : sprint.endDate ? (
                formatDateBR(sprint.endDate)
              ) : sprint.startDate ? (
                `Início: ${formatDateBR(sprint.startDate)}`
              ) : null}
            </span>
          ) : null}

          {sprint.members && sprint.members.length > 0 && (
            <span className="flex items-center gap-1">
              <i className="ri-team-line"></i>
              {sprint.members.length} {sprint.members.length === 1 ? 'membro' : 'membros'}
            </span>
          )}

          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => onEdit(index)}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            editingSprintIndex === index
              ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30'
              : 'text-teal-500 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20'
          }`}
          title="Editar sprint"
        >
          <i className="ri-edit-line text-sm"></i>
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer flex-shrink-0"
        >
          <i className="ri-delete-bin-line text-sm"></i>
        </button>
      </div>
    </div>
  );
}
