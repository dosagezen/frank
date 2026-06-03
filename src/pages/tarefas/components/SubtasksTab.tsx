
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import DatePicker from '../../../components/base/DatePicker';
import UserAvatar from '../../../components/base/UserAvatar';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

interface TeamMember {
  id: string;
  nome: string;
  cargo: string;
  avatar_url: string | null;
}

interface Subtask {
  id: string;
  task_id: string;
  titulo: string;
  concluida: boolean;
  due_date: string | null;
  responsavel_id: string | null;
  created_at: string;
  sort_order: number;
  responsavel?: TeamMember | null;
}

interface SubtasksTabProps {
  taskId: string | null;
  taskTitle: string;
  teamMembers: TeamMember[];
  isEditMode: boolean;
}

/* ------------------------------------------------------------------ */
/*  Componente de item arrastável                                       */
/* ------------------------------------------------------------------ */
interface SortableSubtaskItemProps {
  subtask: Subtask;
  index: number;
  totalCount: number;
  teamMembers: TeamMember[];
  togglingId: string | null;
  deletingId: string | null;
  editingId: string | null;
  saving: boolean;
  editTitle: string;
  editDueDate: string;
  editResponsavel: string;
  selectStyle: React.CSSProperties;
  onToggleComplete: (subtask: Subtask) => void;
  onStartEditing: (subtask: Subtask) => void;
  onCancelEditing: () => void;
  onSaveEdit: (subtaskId: string) => void;
  onDelete: (subtaskId: string) => void;
  onEditTitleChange: (val: string) => void;
  onEditDueDateChange: (val: string) => void;
  onEditResponsavelChange: (val: string) => void;
}

function SortableSubtaskItem({
  subtask,
  index,
  totalCount,
  teamMembers,
  togglingId,
  deletingId,
  editingId,
  saving,
  editTitle,
  editDueDate,
  editResponsavel,
  selectStyle,
  onToggleComplete,
  onStartEditing,
  onCancelEditing,
  onSaveEdit,
  onDelete,
  onEditTitleChange,
  onEditDueDateChange,
  onEditResponsavelChange,
}: SortableSubtaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  const isEditing = editingId === subtask.id;
  const member = subtask.responsavel_id
    ? teamMembers.find((m) => m.id === subtask.responsavel_id)
    : null;

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4 space-y-3"
      >
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
            Nome da Subtarefa <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSaveEdit(subtask.id);
              }
              if (e.key === 'Escape') onCancelEditing();
            }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Data de Entrega
            </label>
            <DatePicker
              value={editDueDate}
              onChange={(val) => onEditDueDateChange(val)}
              placeholder="Selecione a data"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Responsável
            </label>
            <select
              value={editResponsavel}
              onChange={(e) => onEditResponsavelChange(e.target.value)}
              className="w-full px-3 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
              style={selectStyle}
            >
              <option value="">Sem responsável</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                  {m.cargo ? ` - ${m.cargo}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onSaveEdit(subtask.id)}
            disabled={saving || !editTitle.trim()}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <i className="ri-loader-4-line animate-spin"></i>
            ) : (
              <i className="ri-check-line"></i>
            )}
            Salvar
          </button>
          <button
            type="button"
            onClick={onCancelEditing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer"
            disabled={saving}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-700/50 border rounded-xl p-4 flex items-start gap-3 group transition-all hover:shadow-sm ${
        isDragging ? 'shadow-lg ring-2 ring-teal-400/50' : ''
      } ${
        subtask.concluida
          ? 'border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-900/10'
          : 'border-gray-200 dark:border-gray-600'
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 text-gray-300 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors touch-none"
        {...attributes}
        {...listeners}
        title="Arrastar para reordenar"
      >
        <i className="ri-draggable text-base"></i>
      </button>

      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggleComplete(subtask)}
        disabled={togglingId === subtask.id}
        className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-all cursor-pointer border-2 ${
          subtask.concluida
            ? 'bg-teal-600 dark:bg-teal-500 border-teal-600 dark:border-teal-500'
            : 'border-gray-300 dark:border-gray-500 hover:border-teal-400 dark:hover:border-teal-400'
        } ${togglingId === subtask.id ? 'opacity-50' : ''}`}
      >
        {togglingId === subtask.id ? (
          <i className="ri-loader-4-line animate-spin text-white text-xs"></i>
        ) : subtask.concluida ? (
          <i className="ri-check-line text-white text-sm"></i>
        ) : null}
      </button>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                {index + 1}/{totalCount}
              </span>
              <p
                className={`text-sm font-medium truncate ${
                  subtask.concluida
                    ? 'text-gray-400 dark:text-gray-500 line-through'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {subtask.titulo}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              {subtask.due_date && (
                <span
                  className={`text-xs flex items-center gap-1 ${
                    subtask.concluida
                      ? 'text-gray-400 dark:text-gray-500'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <i className="ri-calendar-line"></i>
                  {new Date(subtask.due_date + 'T00:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              )}
              {member && (
                <span className="flex items-center gap-1.5">
                  <UserAvatar avatarUrl={member.avatar_url} nome={member.nome} size="xs" />
                  <span
                    className={`text-xs ${
                      subtask.concluida
                        ? 'text-gray-400 dark:text-gray-500'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {member.nome}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onStartEditing(subtask)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 dark:hover:text-teal-400 transition-colors cursor-pointer"
              title="Editar subtarefa"
            >
              <i className="ri-pencil-line text-sm"></i>
            </button>
            <button
              type="button"
              onClick={() => onDelete(subtask.id)}
              disabled={deletingId === subtask.id}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
              title="Excluir subtarefa"
            >
              {deletingId === subtask.id ? (
                <i className="ri-loader-4-line animate-spin text-sm"></i>
              ) : (
                <i className="ri-delete-bin-line text-sm"></i>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Componente principal                                                */
/* ------------------------------------------------------------------ */
export default function SubtasksTab({
  taskId,
  taskTitle,
  teamMembers,
  isEditMode,
}: SubtasksTabProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Novo formulário inline
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newResponsavel, setNewResponsavel] = useState('');

  // Edição inline
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editResponsavel, setEditResponsavel] = useState('');

  const completedCount = subtasks.filter((s) => s.concluida).length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (taskId && isEditMode) {
      loadSubtasks();
    }
  }, [taskId, isEditMode]);

  const loadSubtasks = async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('task_subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const enriched = (data || []).map((st: any) => ({
        ...st,
        concluida: st.concluida ?? false,
        sort_order: st.sort_order ?? 0,
        responsavel: st.responsavel_id
          ? teamMembers.find((m) => m.id === st.responsavel_id) || null
          : null,
      }));

      setSubtasks(enriched);
    } catch (err) {
      console.error('Erro ao carregar subtarefas:', err);
      showToast('Erro ao carregar subtarefas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubtask = async () => {
    if (!newTitle.trim()) {
      showToast('Informe o nome da subtarefa', 'warning');
      return;
    }
    if (!taskId) {
      showToast('Salve a tarefa primeiro para adicionar subtarefas', 'warning');
      return;
    }

    try {
      setSaving(true);
      const nextOrder = subtasks.length > 0 ? Math.max(...subtasks.map((s) => s.sort_order)) + 1 : 1;

      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada');
      }

      // Chamar Edge Function para adicionar subtarefa com permissões corretas
      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/add-subtask`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            task_id: taskId,
            titulo: newTitle.trim(),
            due_date: newDueDate || null,
            responsavel_id: newResponsavel || null,
            sort_order: nextOrder,
          }),
        }
      );

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Erro ao adicionar subtarefa');
      }

      const data = result.data;

      const enriched: Subtask = {
        ...data,
        concluida: false,
        sort_order: nextOrder,
        responsavel: newResponsavel ? teamMembers.find((m) => m.id === newResponsavel) || null : null,
      };

      setSubtasks((prev) => [...prev, enriched]);
      setNewTitle('');
      setNewDueDate('');
      setNewResponsavel('');
      setShowNewForm(false);
      showToast('Subtarefa adicionada!', 'success');
    } catch (err: any) {
      console.error('Erro ao adicionar subtarefa:', err);
      showToast(err.message || 'Erro ao adicionar subtarefa', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async (subtask: Subtask) => {
    try {
      setTogglingId(subtask.id);
      const newValue = !subtask.concluida;
      const { error } = await supabase.from('task_subtasks').update({ concluida: newValue }).eq('id', subtask.id);

      if (error) throw error;

      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtask.id ? { ...s, concluida: newValue } : s))
      );
    } catch (err) {
      console.error('Erro ao atualizar subtarefa:', err);
      showToast('Erro ao atualizar subtarefa', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      setDeletingId(subtaskId);
      const { error } = await supabase.from('task_subtasks').delete().eq('id', subtaskId);

      if (error) throw error;

      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
      showToast('Subtarefa removida', 'success');
    } catch (err) {
      console.error('Erro ao excluir subtarefa:', err);
      showToast('Erro ao excluir subtarefa', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (subtask: Subtask) => {
    setEditingId(subtask.id);
    setEditTitle(subtask.titulo);
    setEditDueDate(subtask.due_date || '');
    setEditResponsavel(subtask.responsavel_id || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle('');
    setEditDueDate('');
    setEditResponsavel('');
  };

  const handleSaveEdit = async (subtaskId: string) => {
    if (!editTitle.trim()) {
      showToast('Informe o nome da subtarefa', 'warning');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('task_subtasks')
        .update({
          titulo: editTitle.trim(),
          due_date: editDueDate || null,
          responsavel_id: editResponsavel || null,
        })
        .eq('id', subtaskId);

      if (error) throw error;

      setSubtasks((prev) =>
        prev.map((s) =>
          s.id === subtaskId
            ? {
                ...s,
                titulo: editTitle.trim(),
                due_date: editDueDate || null,
                responsavel_id: editResponsavel || null,
                responsavel: editResponsavel
                  ? teamMembers.find((m) => m.id === editResponsavel) || null
                  : null,
              }
            : s
        )
      );

      setEditingId(null);
      showToast('Subtarefa atualizada!', 'success');
    } catch (err) {
      console.error('Erro ao atualizar subtarefa:', err);
      showToast('Erro ao atualizar subtarefa', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Drag & Drop handler                                                */
  /* ------------------------------------------------------------------ */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = subtasks.findIndex((s) => s.id === active.id);
      const newIndex = subtasks.findIndex((s) => s.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Atualizar estado local imediatamente
      const reordered = arrayMove(subtasks, oldIndex, newIndex);
      const withNewOrder = reordered.map((s, i) => ({ ...s, sort_order: i + 1 }));
      setSubtasks(withNewOrder);

      // Persistir no banco em background
      try {
        const updates = withNewOrder.map((s) =>
          supabase.from('task_subtasks').update({ sort_order: s.sort_order }).eq('id', s.id)
        );
        await Promise.all(updates);
      } catch (err) {
        console.error('Erro ao salvar ordem:', err);
        showToast('Erro ao salvar a nova ordem', 'error');
        // Reverter em caso de erro
        loadSubtasks();
      }
    },
    [subtasks, showToast]
  );

  const selectStyle = {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
    backgroundPosition: 'right 10px center',
  };

  if (!isEditMode) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400 dark:text-gray-500">
          <i className="ri-list-check text-5xl"></i>
          <p className="text-sm font-medium">Subtarefas</p>
          <p className="text-xs text-center max-w-xs">
            Salve a tarefa primeiro para poder adicionar subtarefas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <i className="ri-task-line text-teal-600 dark:text-teal-400"></i>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">
              {taskTitle || 'Tarefa'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {completedCount}/{totalCount} subtarefas concluídas
            </span>
            {totalCount > 0 && (
              <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                <div
                  className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
                  title={`${progressPercent}% concluído`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      progressPercent === 100
                        ? 'bg-green-500 dark:bg-green-400'
                        : 'bg-teal-500 dark:bg-teal-400'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span
                  className={`text-xs font-semibold ${
                    progressPercent === 100 ? 'text-green-600 dark:text-green-400' : 'text-teal-600 dark:text-teal-400'
                  }`}
                >
                  {progressPercent}%
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowNewForm(true);
            setNewTitle('');
            setNewDueDate('');
            setNewResponsavel('');
          }}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-7
          transition-colors text-sm font-medium whitespace-nowrap cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={saving || showNewForm || editingId !== null}
        >
          <i className="ri-add-line"></i>
          Adicionar
        </button>
      </div>

      {/* Formulário inline para nova subtarefa */}
      {showNewForm && (
        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4 space-y-3 animate-in fade-in">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Nome da Subtarefa <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              placeholder="Descreva a subtarefa..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubtask();
                }
                if (e.key === 'Escape') {
                  setShowNewForm(false);
                }
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Data de Entrega
              </label>
              <DatePicker
                value={newDueDate}
                onChange={(val) => setNewDueDate(val)}
                placeholder="Selecione a data"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Responsável
              </label>
              <select
                value={newResponsavel}
                onChange={(e) => setNewResponsavel(e.target.value)}
                className="w-full px-3 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                style={selectStyle}
              >
                <option value="">Sem responsável</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                    {m.cargo ? ` - ${m.cargo}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleAddSubtask}
              disabled={saving || !newTitle.trim()}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-check-line"></i>}
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer"
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de subtarefas */}
      {loading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          <span className="text-sm">Carregando subtarefas...</span>
        </div>
      ) : subtasks.length === 0 && !showNewForm ? (
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-10 text-center">
          <i className="ri-list-check text-5xl text-gray-300 dark:text-gray-600 mb-3"></i>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Nenhuma subtarefa adicionada</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Clique em &quot;Adicionar&quot; para criar subtarefas
          </p>
        </div>
      ) : (
        <>
          {subtasks.length > 1 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5 -mb-2">
              <i className="ri-drag-move-line"></i>
              Arraste para reordenar as subtarefas
            </p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={handleDragEnd}>
            <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {subtasks.map((subtask, index) => (
                  <SortableSubtaskItem
                    key={subtask.id}
                    subtask={subtask}
                    index={index}
                    totalCount={totalCount}
                    teamMembers={teamMembers}
                    togglingId={togglingId}
                    deletingId={deletingId}
                    editingId={editingId}
                    saving={saving}
                    editTitle={editTitle}
                    editDueDate={editDueDate}
                    editResponsavel={editResponsavel}
                    selectStyle={selectStyle}
                    onToggleComplete={handleToggleComplete}
                    onStartEditing={startEditing}
                    onCancelEditing={cancelEditing}
                    onSaveEdit={handleSaveEdit}
                    onDelete={handleDeleteSubtask}
                    onEditTitleChange={setEditTitle}
                    onEditDueDateChange={setEditDueDate}
                    onEditResponsavelChange={setEditResponsavel}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}
