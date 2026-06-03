import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { fetchAllMembers } from '../../../services/teamService';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import UserAvatar from '../../../components/base/UserAvatar';

interface TeamMember {
  id: string;
  nome: string;
  cargo: string;
  avatar_url: string | null;
}

interface QuickAddTaskInSprintProps {
  projectId: string;
  sprintId: string;
  onTaskAdded: () => void;
  onCancel: () => void;
}

export default function QuickAddTaskInSprint({
  projectId,
  sprintId,
  onTaskAdded,
  onCancel,
}: QuickAddTaskInSprintProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('media');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('fazer');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleInputRef.current?.focus();
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoadingMembers(true);
      const members = await fetchAllMembers();
      setTeamMembers(members);
      // Pré-selecionar o usuário atual se estiver na lista
      if (user) {
        const self = members.find((m: TeamMember) => m.id === user.id);
        if (self) setAssigneeId(self.id);
      }
    } catch {
      // silencioso
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showToast('Digite o título da tarefa', 'warning');
      titleInputRef.current?.focus();
      return;
    }
    if (!assigneeId) {
      showToast('Selecione um responsável', 'warning');
      return;
    }
    if (!dueDate) {
      showToast('Informe a data de entrega', 'warning');
      return;
    }
    if (!user) return;

    try {
      setSaving(true);

      const { data: assigneeProfile } = await supabase
        .from('profiles')
        .select('nome, avatar_url')
        .eq('id', assigneeId)
        .maybeSingle();

      const { error } = await supabase.from('tasks').insert([
        {
          user_id: user.id,
          title: title.trim(),
          description: null,
          project_id: projectId,
          sprint_id: sprintId,
          status,
          priority,
          responsavel_id: assigneeId,
          assignee: assigneeProfile?.nome || '',
          due_date: dueDate,
          tags: null,
          categoria: null,
          tempo_estimado: null,
          progress: status === 'feito' ? 100 : 0,
          recurrence_type: 'none',
          recurrence_end_date: null,
          recurrence_parent_id: null,
          observacoes: null,
          updated_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      showToast('Tarefa adicionada à sprint!', 'success');
      onTaskAdded();
    } catch (err) {
      console.error('[QuickAddTask] Erro:', err);
      showToast('Erro ao criar tarefa. Tente novamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedMember = teamMembers.find((m) => m.id === assigneeId);

  const priorityOptions = [
    { value: 'baixa', label: 'Baixa', icon: 'ri-arrow-down-s-fill', color: 'text-emerald-500' },
    { value: 'media', label: 'Média', icon: 'ri-arrow-right-s-fill', color: 'text-amber-500' },
    { value: 'alta', label: 'Alta', icon: 'ri-arrow-up-s-fill', color: 'text-red-500' },
  ];

  const statusOptions = [
    { value: 'fazer', label: 'A Fazer' },
    { value: 'fazendo', label: 'Fazendo' },
    { value: 'aguardando', label: 'Aguardando' },
  ];

  const selectedPriority = priorityOptions.find((p) => p.value === priority)!;

  return (
    <div className="mx-2 mb-2 rounded-lg border border-teal-300 dark:border-teal-600 bg-teal-50/60 dark:bg-teal-900/10 shadow-sm overflow-hidden">
      {/* Linha do título */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <i className="ri-checkbox-blank-circle-line text-gray-400 dark:text-gray-500 text-base"></i>
        </div>
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Título da tarefa... (Enter para salvar, Esc para cancelar)"
          className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none border-none focus:ring-0 min-w-0"
          disabled={saving}
          maxLength={200}
        />
      </div>

      {/* Linha de campos rápidos */}
      <div className="flex items-center gap-2 px-3 pb-2 flex-wrap">
        {/* Prioridade */}
        <div className="relative group">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="appearance-none pl-6 pr-2 py-1 text-[11px] font-medium rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors"
            disabled={saving}
          >
            {priorityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <i
            className={`${selectedPriority.icon} ${selectedPriority.color} absolute left-1.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none`}
          ></i>
        </div>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="appearance-none px-2 py-1 text-[11px] font-medium rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors"
          disabled={saving}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Responsável */}
        <div className="flex items-center gap-1.5">
          {selectedMember && (
            <UserAvatar
              avatarUrl={selectedMember.avatar_url || ''}
              nome={selectedMember.nome}
              size="xs"
            />
          )}
          {loadingMembers ? (
            <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <i className="ri-loader-4-line animate-spin text-xs"></i>
              Carregando...
            </span>
          ) : (
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="appearance-none px-2 py-1 text-[11px] font-medium rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors max-w-[130px]"
              disabled={saving}
            >
              <option value="">Responsável...</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Data de entrega */}
        <div className="flex items-center gap-1">
          <i className="ri-calendar-line text-gray-400 dark:text-gray-500 text-xs"></i>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-2 py-1 text-[11px] font-medium rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors"
            disabled={saving}
          />
        </div>
      </div>

      {/* Rodapé com ações */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-teal-200 dark:border-teal-700/50 bg-white/50 dark:bg-gray-800/30">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">
          <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Enter</kbd> salvar
          &nbsp;·&nbsp;
          <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Esc</kbd> cancelar
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <i className="ri-loader-4-line animate-spin text-xs"></i>
                Salvando...
              </>
            ) : (
              <>
                <i className="ri-add-line text-xs"></i>
                Adicionar Tarefa
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
