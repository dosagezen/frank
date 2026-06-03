import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { fetchAllMembers } from '../../../services/teamService';
import { useAuth } from '../../../contexts/AuthContext';
import { safeFetchMany } from '../../../services/supabaseHelpers';
import { useToast } from '../../../contexts/ToastContext';
import { notifyTaskFieldsChanged } from '../../../services/notificationsService';
import type { TaskSnapshot } from '../../../services/notificationsService';
import DatePicker from '../../../components/base/DatePicker';
import UserAvatar from '../../../components/base/UserAvatar';
import TaskComments from './TaskComments';
import SubtasksTab from './SubtasksTab';
import TaskLinksField from './TaskLinksField';
import type { TaskLink } from './TaskLinksField';
import { formatDateBR } from '../../../utils/dateHelpers';

interface Project {
  id: string;
  nome: string;
  user_id: string;
}

interface Sprint {
  id: string;
  name: string;
  end_date: string;
}

interface TeamMember {
  id: string;
  nome: string;
  cargo: string;
  avatar_url: string | null;
}

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Se fornecido, o modal opera em modo edição */
  taskToEdit?: any;
  /** Callback chamado após excluir (apenas no modo edição) */
  onDelete?: (taskId: string) => void;
  /** Aba inicial ao abrir o modal (padrão: 'detalhes') */
  initialTab?: 'detalhes' | 'subtarefas' | 'comentarios' | 'anexos';
}

interface FileAttachment {
  id: string;
  name: string;
  original_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
}

export default function TaskFormModal({
  isOpen,
  onClose,
  taskToEdit,
  onDelete,
  initialTab,
}: TaskFormModalProps) {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const isEditMode = !!taskToEdit;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project: '',
    sprint: '',
    status: 'fazer',
    priority: 'media',
    assignee: '',
    dueDate: '',
    tags: [] as string[],
    categoria: '',
    tempoEstimado: '',
    recurrenceType: 'none',
    recurrenceEndDate: '',
    observacoes: '',
  });

  const [tagInput, setTagInput] = useState('');
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [availableSprints, setAvailableSprints] = useState<Sprint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Novos estados para anexos existentes e abas
  const [existingAttachments, setExistingAttachments] = useState<FileAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [activeTab, setActiveTab] = useState<'detalhes' | 'subtarefas' | 'comentarios' | 'anexos'>('detalhes');
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [newAttachmentsCount, setNewAttachmentsCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [subtasksCount, setSubtasksCount] = useState(0);
  const [loadingSprints, setLoadingSprints] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<FileAttachment | null>(null);

  // ── Estados para mover sprint ──
  const [movingToSprint, setMovingToSprint] = useState(false);
  const [selectedMoveSprintId, setSelectedMoveSprintId] = useState<string>('');
  const [showMoveSprintConfirm, setShowMoveSprintConfirm] = useState(false);

  /* ------------------------------------------------------------------ */
  /*  Mover tarefa para outra sprint                                      */
  /* ------------------------------------------------------------------ */
  const handleMoveSprint = async () => {
    if (!taskToEdit?.id) return;
    try {
      setMovingToSprint(true);
      const { error } = await supabase
        .from('tasks')
        .update({ sprint_id: selectedMoveSprintId || null })
        .eq('id', taskToEdit.id);
      if (error) throw error;

      const sprintName = selectedMoveSprintId
        ? availableSprints.find((s) => s.id === selectedMoveSprintId)?.name || 'sprint selecionada'
        : 'nenhuma sprint';

      setFormData((prev) => ({ ...prev, sprint: selectedMoveSprintId }));
      setShowMoveSprintConfirm(false);
      showToast(`Tarefa movida para ${sprintName} com sucesso!`, 'success');
    } catch (err) {
      console.error('Erro ao mover tarefa de sprint:', err);
      showToast('Erro ao mover tarefa. Tente novamente.', 'error');
    } finally {
      setMovingToSprint(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Inicializar formulário                                              */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isOpen) return;
    loadProjects();
    loadTeamMembers();
  }, [isOpen, user, isAdmin]);

  // Preencher campos quando em modo edição
  useEffect(() => {
    if (isOpen && isEditMode && taskToEdit) {
      const dueDate = taskToEdit.recurrenceInstanceDate
        ? typeof taskToEdit.recurrenceInstanceDate === 'string' &&
          taskToEdit.recurrenceInstanceDate.includes('T')
          ? taskToEdit.recurrenceInstanceDate.split('T')[0]
          : taskToEdit.recurrenceInstanceDate
        : taskToEdit.prazo
        ? (() => {
            const parts = taskToEdit.prazo.split('/');
            if (parts.length === 3) {
              return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            return taskToEdit.prazo;
          })()
        : '';

      setFormData({
        title: taskToEdit.titulo || '',
        description: taskToEdit.descricao || '',
        project: taskToEdit.project_id || '',
        sprint: taskToEdit.sprint_id || '',
        status: taskToEdit.status || 'fazer',
        priority: taskToEdit.prioridade || 'media',
        assignee: taskToEdit.responsavel?.id || taskToEdit.responsavel_id || '',
        dueDate,
        tags: taskToEdit.tags || [],
        categoria: taskToEdit.categoria || '',
        tempoEstimado: taskToEdit.tempoEstimado || '',
        recurrenceType: taskToEdit.recurrenceType || 'none',
        recurrenceEndDate: taskToEdit.recurrenceEndDate || '',
        observacoes: taskToEdit.observacoes || '',
      });
      setTagInput('');
      setLinks(taskToEdit.links || []);
      setAttachments([]);
      setActiveTab(initialTab || 'detalhes');
      setNewAttachmentsCount(0);
      loadExistingAttachments(taskToEdit.id);
      loadSubtasksCount(taskToEdit.id);
      // Inicializar seletor de mover sprint com o valor atual
      setSelectedMoveSprintId(taskToEdit.sprint_id || '');
    } else if (isOpen && !isEditMode) {
      setFormData({
        title: '',
        description: '',
        project: '',
        sprint: '',
        status: 'fazer',
        priority: 'media',
        assignee: '',
        dueDate: '',
        tags: [],
        categoria: '',
        tempoEstimado: '',
        recurrenceType: 'none',
        recurrenceEndDate: '',
        observacoes: '',
      });
      setTagInput('');
      setLinks([]);
      setAttachments([]);
      setExistingAttachments([]);
      setActiveTab('detalhes');
      setNewAttachmentsCount(0);
      setSubtasksCount(0);
      setSelectedMoveSprintId('');
    }
  }, [isOpen, isEditMode, taskToEdit]);

  // Carregar sprints quando projeto muda
  useEffect(() => {
    if (formData.project) {
      loadSprints(formData.project);
    } else {
      setAvailableSprints([]);
      setLoadingSprints(false);
    }
  }, [formData.project]);

  /* ------------------------------------------------------------------ */
  /*  Loaders                                                             */
  /* ------------------------------------------------------------------ */
  const loadProjects = async () => {
    try {
      if (!user) return;
      if (isAdmin) {
        const data = await safeFetchMany(() =>
          supabase.from('projects').select('id, nome, user_id').order('nome', { ascending: true })
        );
        setProjects(data);
      } else {
        const ownProjects = await safeFetchMany(() =>
          supabase
            .from('projects')
            .select('id, nome, user_id')
            .eq('user_id', user.id)
            .order('nome', { ascending: true })
        );
        const memberRels = await safeFetchMany(() =>
          supabase.from('project_members').select('project_id').eq('profile_id', user.id)
        );
        const memberIds = memberRels.map((m: any) => m.project_id);
        if (memberIds.length > 0) {
          const memberProjects = await safeFetchMany(() =>
            supabase
              .from('projects')
              .select('id, nome, user_id')
              .in('id', memberIds)
              .order('nome', { ascending: true })
          );
          const all = [...ownProjects];
          memberProjects.forEach((mp: any) => {
            if (!all.find((p) => p.id === mp.id)) all.push(mp);
          });
          all.sort((a, b) => a.nome.localeCompare(b.nome));
          setProjects(all);
        } else {
          setProjects(ownProjects);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar projetos:', err);
    }
  };

  const loadTeamMembers = async () => {
    try {
      setLoadingMembers(true);
      const members = await fetchAllMembers();
      setTeamMembers(members);
    } catch (err) {
      console.error('Erro ao carregar membros:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadSprints = async (projectId: string) => {
    try {
      setLoadingSprints(true);
      const sprints = await safeFetchMany(() =>
        supabase
          .from('project_sprints')
          .select('id, name, end_date')
          .eq('project_id', projectId)
          .order('sprint_order', { ascending: true })
      );
      setAvailableSprints(sprints);
    } catch {
      setAvailableSprints([]);
    } finally {
      setLoadingSprints(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Carregar contagem de subtarefas                                     */
  /* ------------------------------------------------------------------ */
  const loadSubtasksCount = async (taskId: string) => {
    try {
      const { count, error } = await supabase
        .from('task_subtasks')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', taskId);
      if (!error) setSubtasksCount(count || 0);
    } catch {
      setSubtasksCount(0);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Carregar anexos existentes (modo edição)                            */
  /* ------------------------------------------------------------------ */
  const loadExistingAttachments = async (taskId: string) => {
    try {
      setLoadingAttachments(true);
      const { data, error } = await supabase
        .from('files')
        .select('id, name, original_name, file_type, file_size, storage_path, created_at')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExistingAttachments(data || []);
    } catch (err) {
      console.error('Erro ao carregar anexos:', err);
      setExistingAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Anexos                                                              */
  /* ------------------------------------------------------------------ */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    const maxSize = 50 * 1024 * 1024;
    const invalid = newFiles.filter((f) => f.size > maxSize);
    if (invalid.length > 0) {
      showToast(`Arquivos excedem 50MB: ${invalid.map((f) => f.name).join(', ')}`, 'warning');
      return;
    }
    
    if (isEditMode && taskToEdit?.id) {
      uploadNewAttachments(newFiles, taskToEdit.id);
    } else {
      setAttachments((prev) => [...prev, ...newFiles]);
      setNewAttachmentsCount((prev) => prev + newFiles.length);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const maxSize = 50 * 1024 * 1024;
    const invalid = newFiles.filter((f) => f.size > maxSize);
    if (invalid.length > 0) {
      showToast(`Arquivos excedem 50MB: ${invalid.map((f) => f.name).join(', ')}`, 'warning');
      return;
    }

    if (isEditMode && taskToEdit?.id) {
      uploadNewAttachments(newFiles, taskToEdit.id);
    } else {
      setAttachments((prev) => [...prev, ...newFiles]);
      setNewAttachmentsCount((prev) => prev + newFiles.length);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setNewAttachmentsCount((prev) => Math.max(0, prev - 1));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return 'ri-file-pdf-line';
    if (type.includes('image')) return 'ri-image-line';
    if (type.includes('video')) return 'ri-video-line';
    if (type.includes('word') || type.includes('document')) return 'ri-file-word-line';
    if (type.includes('excel') || type.includes('spreadsheet')) return 'ri-file-excel-line';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'ri-file-ppt-line';
    if (type.includes('zip') || type.includes('rar')) return 'ri-file-zip-line';
    return 'ri-file-line';
  };

  // Upload imediato de novos anexos (modo edição)
  const uploadNewAttachments = async (files: File[], taskId: string) => {
    if (!user) return;
    
    try {
      setUploading(true);
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        const { error: dbError } = await supabase.from('files').insert([
          {
            user_id: user.id,
            name: file.name,
            original_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: fileName,
            task_id: taskId,
            project_id: formData.project || null,
          },
        ]);
        
        if (dbError) throw dbError;
      }
      
      showToast('Anexos enviados com sucesso!', 'success');
      await loadExistingAttachments(taskId);
    } catch (err) {
      console.error('Erro ao fazer upload dos anexos:', err);
      showToast('Erro ao enviar anexos. Tente novamente.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const uploadAttachments = async (taskId: string, userId: string) => {
    if (attachments.length === 0) return;
    setUploading(true);
    try {
      for (const file of attachments) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);
        if (uploadError) throw uploadError;
        const { error: dbError } = await supabase.from('files').insert([
          {
            user_id: userId,
            name: file.name,
            original_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: fileName,
            task_id: taskId,
            project_id: formData.project || null,
          },
        ]);
        if (dbError) throw dbError;
      }
    } catch (err) {
      console.error('Erro ao fazer upload dos anexos:', err);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  // Excluir anexo existente
  const handleDeleteExistingAttachment = async (attachment: FileAttachment) => {
    setAttachmentToDelete(attachment);
  };

  const confirmDeleteAttachment = async () => {
    if (!attachmentToDelete) return;
    const attachment = attachmentToDelete;
    
    try {
      setDeletingAttachmentId(attachment.id);
      setAttachmentToDelete(null);
      
      // Remover do storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([attachment.storage_path]);
      
      if (storageError) throw storageError;
      
      // Remover do banco
      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', attachment.id);
      
      if (dbError) throw dbError;
      
      showToast('Anexo excluído com sucesso!', 'success');
      setExistingAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (err) {
      console.error('Erro ao excluir anexo:', err);
      showToast('Erro ao excluir anexo. Tente novamente.', 'error');
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  // Download de anexo existente
  const handleDownloadAttachment = async (attachment: FileAttachment) => {
    try {
      showToast('Gerando link de download...', 'success');

      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(attachment.storage_path, 120, {
          download: attachment.original_name || attachment.name || true,
        });

      if (error || !data?.signedUrl) {
        showToast('Erro ao gerar link de download.', 'error');
        return;
      }

      // Navegar diretamente para a URL assinada com download=filename
      // Isso é tratado pelo browser como download real, independente do DevTools
      window.location.assign(data.signedUrl);

    } catch (err: any) {
      console.error('[Download] Erro:', err);
      showToast(`Erro ao baixar: ${err?.message || 'Erro desconhecido'}`, 'error');
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Tags                                                                */
  /* ------------------------------------------------------------------ */
  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tagToRemove) });
  };

  /* ------------------------------------------------------------------ */
  /*  Recorrência                                                         */
  /* ------------------------------------------------------------------ */
  const getRecurrenceSummary = () => {
    if (formData.recurrenceType === 'none') return null;
    const labels: Record<string, string> = {
      daily: 'diariamente',
      weekly: 'semanalmente',
      biweekly: 'quinzenalmente',
      monthly: 'mensalmente',
      bimonthly: 'bimestralmente',
      quarterly: 'trimestralmente',
      yearly: 'anualmente',
    };
    let summary = `Repete ${labels[formData.recurrenceType] || ''}`;
    if (formData.recurrenceEndDate) {
      summary += ` até ${new Date(formData.recurrenceEndDate).toLocaleDateString('pt-BR')}`;
    } else {
      summary += ' (sem data de término)';
    }
    return summary;
  };

  /* ------------------------------------------------------------------ */
  /*  Submit                                                              */
  /* ------------------------------------------------------------------ */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.assignee || !formData.dueDate) {
      showToast('Preencha todos os campos obrigatórios (título, responsável e prazo)', 'warning');
      return;
    }

    if (formData.recurrenceType !== 'none' && formData.recurrenceEndDate) {
      const start = new Date(formData.dueDate);
      const end = new Date(formData.recurrenceEndDate);
      if (end < start) {
        showToast('A data de término da recorrência não pode ser anterior à data de prazo', 'warning');
        return;
      }
    }

    try {
      setLoading(true);
      if (!user) {
        showToast('Usuário não autenticado', 'error');
        return;
      }

      const { data: assigneeProfile } = await supabase
        .from('profiles')
        .select('nome, avatar_url')
        .eq('id', formData.assignee)
        .maybeSingle();

      const taskData = {
        title: formData.title,
        description: formData.description || null,
        project_id: formData.project || null,
        sprint_id: formData.sprint || null,
        status: formData.status,
        priority: formData.priority,
        responsavel_id: formData.assignee,
        assignee: assigneeProfile?.nome || '',
        due_date: formData.dueDate,
        tags: formData.tags.length > 0 ? formData.tags : null,
        categoria: formData.categoria || null,
        tempo_estimado: formData.tempoEstimado || null,
        progress:
          formData.status === 'feito'
            ? 100
            : isEditMode
            ? taskToEdit?.progress || 0
            : 0,
        recurrence_type: formData.recurrenceType,
        recurrence_end_date:
          formData.recurrenceType !== 'none' && formData.recurrenceEndDate
            ? formData.recurrenceEndDate
            : null,
        observacoes: formData.observacoes || null,
        links: links.length > 0 ? links : null,
        updated_at: new Date().toISOString(),
      };

      if (isEditMode) {
        const { error } = await supabase.from('tasks').update(taskData).eq('id', taskToEdit.id);
        if (error) throw error;

        // Construir snapshots antigo e novo para detecção completa de alterações
        if (user) {
          const oldDueDate = taskToEdit.recurrenceInstanceDate
            ? typeof taskToEdit.recurrenceInstanceDate === 'string' &&
              taskToEdit.recurrenceInstanceDate.includes('T')
              ? taskToEdit.recurrenceInstanceDate.split('T')[0]
              : taskToEdit.recurrenceInstanceDate
            : taskToEdit.prazo
            ? (() => {
                const parts = taskToEdit.prazo.split('/');
                if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
                return taskToEdit.prazo;
              })()
            : '';

          const oldSnapshot: TaskSnapshot = {
            title: taskToEdit.titulo || '',
            description: taskToEdit.descricao || '',
            status: taskToEdit.status || 'fazer',
            priority: taskToEdit.prioridade || 'media',
            responsavel_id: taskToEdit.responsavel?.id || taskToEdit.responsavel_id || '',
            due_date: oldDueDate,
            project_id: taskToEdit.project_id || null,
            sprint_id: taskToEdit.sprint_id || null,
            categoria: taskToEdit.categoria || null,
            tags: taskToEdit.tags || null,
            tempo_estimado: taskToEdit.tempoEstimado || null,
            recurrence_type: taskToEdit.recurrenceType || 'none',
            recurrence_end_date: taskToEdit.recurrenceEndDate || null,
            observacoes: taskToEdit.observacoes || null,
            progress: taskToEdit.progress || 0,
          };

          const newSnapshot: TaskSnapshot = {
            title: formData.title,
            description: formData.description || '',
            status: formData.status,
            priority: formData.priority,
            responsavel_id: formData.assignee,
            due_date: formData.dueDate,
            project_id: formData.project || null,
            sprint_id: formData.sprint || null,
            categoria: formData.categoria || null,
            tags: formData.tags.length > 0 ? formData.tags : null,
            tempo_estimado: formData.tempoEstimado || null,
            recurrence_type: formData.recurrenceType,
            recurrence_end_date:
              formData.recurrenceType !== 'none' && formData.recurrenceEndDate
                ? formData.recurrenceEndDate
                : null,
            observacoes: formData.observacoes || null,
            progress: formData.status === 'feito' ? 100 : taskToEdit?.progress || 0,
          };

          // Notificação abrangente — cobre status, reatribuição e todos os outros campos
          notifyTaskFieldsChanged({
            taskId: taskToEdit.id,
            taskTitle: formData.title,
            oldData: oldSnapshot,
            newData: newSnapshot,
            responsavelId: formData.assignee,
            actorId: user.id,
          });
        }

        showToast('Tarefa atualizada com sucesso!', 'success');
      } else {
        const { data: newTask, error } = await supabase
          .from('tasks')
          .insert([{ ...taskData, user_id: user.id, recurrence_parent_id: null }])
          .select()
          .single();
        if (error) throw error;
        if (attachments.length > 0) {
          await uploadAttachments(newTask.id, user.id);
        }
        showToast('Tarefa criada com sucesso!', 'success');
      }

      onClose();
    } catch (err) {
      console.error('Erro ao salvar tarefa:', err);
      showToast('Erro ao salvar tarefa. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Excluir                                                             */
  /* ------------------------------------------------------------------ */
  const handleDeleteTask = async () => {
    if (!onDelete || !taskToEdit?.id) return;
    try {
      setDeleting(true);
      await onDelete(taskToEdit.id);
    } catch {
      showToast('Erro ao excluir tarefa. Tente novamente.', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                              */
  /* ------------------------------------------------------------------ */
  if (!isOpen) return null;

  const selectStyle = {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
    backgroundPosition: 'right 12px center',
  };

  const selectClass =
    'w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer';

  // Contagem de anexos para o badge da aba
  const totalAttachmentsCount = isEditMode ? existingAttachments.length : attachments.length;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <h2
              className="text-2xl font-bold text-gray-900 dark:text-white"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {isEditMode ? 'Editar Tarefa' : 'Nova Tarefa'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
            </button>
          </div>

          {/* Tabs — sempre visíveis */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-6">
            <button
              type="button"
              onClick={() => setActiveTab('detalhes')}
              className={`px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'detalhes'
                  ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <i className="ri-file-list-3-line mr-2"></i>
              Detalhes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('subtarefas')}
              className={`px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'subtarefas'
                  ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <i className="ri-list-check mr-2"></i>
              Subtarefas
              {subtasksCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 text-xs font-semibold rounded-full">
                  {subtasksCount}
                </span>
              )}
            </button>
            {isEditMode && (
              <button
                type="button"
                onClick={() => setActiveTab('comentarios')}
                className={`px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'comentarios'
                    ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <i className="ri-chat-3-line mr-2"></i>
                Comentários
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('anexos')}
              className={`px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'anexos'
                  ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <i className="ri-attachment-2 mr-2"></i>
              Anexos
              {totalAttachmentsCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 text-xs font-semibold rounded-full">
                  {totalAttachmentsCount}
                </span>
              )}
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            {/* Tab: Detalhes */}
            {activeTab === 'detalhes' && (
              <div className="p-6 space-y-5">
                {/* Título */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Título da Tarefa <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Ex: Implementar nova funcionalidade"
                    required
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => {
                      if (e.target.value.length <= 500)
                        setFormData({ ...formData, description: e.target.value });
                    }}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                    rows={4}
                    placeholder="Descreva os detalhes da tarefa..."
                    maxLength={500}
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                    {formData.description.length}/500 caracteres
                  </div>
                </div>

                {/* Projeto e Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Projeto
                    </label>
                    <select
                      value={formData.project}
                      onChange={(e) => setFormData({ ...formData, project: e.target.value, sprint: '' })}
                      className={selectClass}
                      style={selectStyle}
                    >
                      <option value="">Sem projeto</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className={selectClass}
                      style={selectStyle}
                    >
                      <option value="fazer">Fazer</option>
                      <option value="fazendo">Fazendo</option>
                      <option value="aguardando">Aguardando</option>
                      <option value="parado">Parado</option>
                      <option value="feito">Feito</option>
                    </select>
                  </div>
                </div>

                {/* ── BLOCO: Mover para Sprint (apenas modo edição com projeto) ── */}
                {isEditMode && formData.project && (
                  <div className="rounded-xl border-2 border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-900/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
                        <i className="ri-swap-box-line text-teal-600 dark:text-teal-400 text-base"></i>
                      </div>
                      <h4 className="text-sm font-bold text-teal-800 dark:text-teal-300">
                        Mover para Sprint
                      </h4>
                      {formData.sprint && (
                        <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400">
                          <i className="ri-flashlight-line text-xs"></i>
                          {availableSprints.find((s) => s.id === formData.sprint)?.name || 'Sprint atual'}
                        </span>
                      )}
                      {!formData.sprint && (
                        <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          <i className="ri-folder-unknow-line text-xs"></i>
                          Sem sprint
                        </span>
                      )}
                    </div>

                    {loadingSprints ? (
                      <div className="flex items-center gap-2 py-2">
                        <i className="ri-loader-4-line animate-spin text-teal-500 text-sm"></i>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Carregando sprints...</span>
                      </div>
                    ) : availableSprints.length === 0 ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <i className="ri-alert-line"></i>
                        Este projeto não possui sprints cadastradas
                      </p>
                    ) : (
                      <div className="flex items-center gap-2 w-full min-w-0">
                        <div className="flex-1 min-w-0 relative">
                          <select
                            value={selectedMoveSprintId}
                            onChange={(e) => setSelectedMoveSprintId(e.target.value)}
                            className="w-full px-3 pr-8 py-2.5 border border-teal-300 dark:border-teal-700 bg-white dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat cursor-pointer truncate"
                            style={{
                              ...selectStyle,
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <option value="">— Sem sprint —</option>
                            {availableSprints.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                                {/* ✅ CORRIGIDO: Usar formatDateBR para evitar problema de timezone */}
                                {s.end_date
                                  ? ` · até ${formatDateBR(s.end_date)}`
                                  : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowMoveSprintConfirm(true)}
                          disabled={
                            movingToSprint ||
                            selectedMoveSprintId === (formData.sprint || '')
                          }
                          className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap cursor-pointer"
                        >
                          {movingToSprint ? (
                            <>
                              <i className="ri-loader-4-line animate-spin"></i>
                              Movendo...
                            </>
                          ) : (
                            <>
                              <i className="ri-arrow-right-up-line"></i>
                              Mover
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {availableSprints.length > 0 && selectedMoveSprintId !== (formData.sprint || '') && (
                      <p className="text-xs text-teal-700 dark:text-teal-400 mt-2 flex items-center gap-1">
                        <i className="ri-information-line"></i>
                        {selectedMoveSprintId
                          ? `A tarefa será movida para "${availableSprints.find((s) => s.id === selectedMoveSprintId)?.name}"`
                          : 'A tarefa será removida de qualquer sprint'}
                      </p>
                    )}
                  </div>
                )}

                {/* Sprint (modo criação) */}
                {!isEditMode && formData.project && loadingSprints && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center gap-2">
                    <i className="ri-loader-4-line animate-spin text-teal-500"></i>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Carregando sprints...</p>
                  </div>
                )}

                {!isEditMode && formData.project && !loadingSprints && availableSprints.length > 0 && (
                  <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Sprint do Projeto
                    </label>
                    <select
                      value={formData.sprint}
                      onChange={(e) => setFormData({ ...formData, sprint: e.target.value })}
                      className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                      style={selectStyle}
                    >
                      <option value="">Nenhuma sprint selecionada</option>
                      {availableSprints.map((s) => (
                        <option key={s.id} value={s.id}>
                          {/* ✅ CORRIGIDO: Usar formatDateBR para evitar problema de timezone */}
                          {s.name} - Até {formatDateBR(s.end_date)}
                        </option>
                      ))}
                    </select>
                    {formData.sprint && (
                      <p className="text-xs text-teal-700 dark:text-teal-400 mt-2 flex items-center gap-1">
                        <i className="ri-information-line"></i>
                        Esta tarefa será vinculada à sprint selecionada
                      </p>
                    )}
                  </div>
                )}

                {!isEditMode && formData.project && !loadingSprints && availableSprints.length === 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <i className="ri-alert-line"></i>
                      Este projeto não possui sprints cadastradas
                    </p>
                  </div>
                )}

                {/* Prioridade e Responsável */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Prioridade
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className={selectClass}
                      style={selectStyle}
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Responsável <span className="text-red-500">*</span>
                    </label>
                    {loadingMembers ? (
                      <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg flex items-center gap-2">
                        <i className="ri-loader-4-line animate-spin text-gray-400"></i>
                        <span className="text-sm text-gray-500 dark:text-gray-400">Carregando...</span>
                      </div>
                    ) : (
                      <select
                        value={formData.assignee}
                        onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                        className={selectClass}
                        style={selectStyle}
                        required
                      >
                        <option value="">Selecione um responsável</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                            {m.cargo ? ` - ${m.cargo}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {formData.assignee && (() => {
                      const member = teamMembers.find((m) => m.id === formData.assignee);
                      if (!member) return null;
                      return (
                        <div className="mt-2 flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <UserAvatar avatarUrl={member.avatar_url} nome={member.nome} size="sm" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{member.nome}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Categoria e Tempo Estimado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Categoria
                    </label>
                    <input
                      type="text"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                      placeholder="Ex: Desenvolvimento, Design..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Tempo Estimado
                    </label>
                    <input
                      type="text"
                      value={formData.tempoEstimado}
                      onChange={(e) => setFormData({ ...formData, tempoEstimado: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                      placeholder="Ex: 4 horas, 2 dias..."
                    />
                  </div>
                </div>

                {/* Data de Entrega e Recorrência */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Data Entrega <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      value={formData.dueDate}
                      onChange={(val) => setFormData({ ...formData, dueDate: val })}
                      placeholder="Selecione a data"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <i className="ri-repeat-line text-teal-600 dark:text-teal-400"></i>
                      Recorrência
                    </label>
                    <select
                      value={formData.recurrenceType}
                      onChange={(e) => setFormData({ ...formData, recurrenceType: e.target.value })}
                      className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                      style={selectStyle}
                    >
                      <option value="none">Não se repete</option>
                      <option value="daily">Diário</option>
                      <option value="weekly">Semanal</option>
                      <option value="biweekly">Quinzenal</option>
                      <option value="monthly">Mensal</option>
                      <option value="bimonthly">Bimestral</option>
                      <option value="quarterly">Trimestral</option>
                      <option value="yearly">Anual</option>
                    </select>
                  </div>
                </div>

                {formData.recurrenceType !== 'none' && (
                  <p className="text-sm text-teal-700 dark:text-teal-400 flex items-center gap-2 -mt-2">
                    <i className="ri-information-line"></i>
                    <span className="font-medium">{getRecurrenceSummary()}</span>
                  </p>
                )}

                {/* Tags */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Tags
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                      placeholder="Digite uma tag e pressione Enter"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer"
                    >
                      Adicionar
                    </button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-lg text-sm"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-teal-900 dark:hover:text-teal-300 cursor-pointer"
                          >
                            <i className="ri-close-line"></i>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <i className="ri-sticky-note-line text-teal-600 dark:text-teal-400"></i>
                    Observações / Notas Internas
                  </label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => {
                      if (e.target.value.length <= 500)
                        setFormData({ ...formData, observacoes: e.target.value });
                    }}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                    rows={3}
                    placeholder="Anotações internas, lembretes ou observações sobre esta tarefa..."
                    maxLength={500}
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                    {formData.observacoes.length}/500 caracteres
                  </div>
                </div>

                {/* Links */}
                <TaskLinksField links={links} onChange={setLinks} />

              </div>
            )}

            {/* Tab: Subtarefas */}
            {activeTab === 'subtarefas' && (
              <SubtasksTab
                taskId={isEditMode ? taskToEdit?.id : null}
                taskTitle={formData.title}
                teamMembers={teamMembers}
                isEditMode={isEditMode}
              />
            )}

            {/* Tab: Comentários (apenas no modo edição) */}
            {isEditMode && activeTab === 'comentarios' && taskToEdit?.id && (
              <div className="p-6">
                <TaskComments taskId={taskToEdit.id} taskTitle={taskToEdit.titulo || formData.title} />
              </div>
            )}

            {/* Tab: Anexos — disponível em ambos os modos */}
            {activeTab === 'anexos' && (
              <div className="p-6 space-y-5">
                {/* Upload de novos anexos */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    {isEditMode ? 'Adicionar Novos Anexos' : 'Anexar Arquivos'}
                  </label>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                      isDragging
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 scale-[1.01]'
                        : 'border-gray-300 dark:border-gray-600 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <label className={`cursor-pointer block ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
                      <div className="flex flex-col items-center gap-3">
                        <div className={`w-14 h-14 flex items-center justify-center rounded-full transition-colors ${
                          isDragging
                            ? 'bg-teal-100 dark:bg-teal-900/40'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          <i className={`text-3xl transition-colors ${
                            isDragging
                              ? 'ri-download-cloud-2-line text-teal-500 dark:text-teal-400'
                              : 'ri-upload-cloud-line text-gray-400 dark:text-gray-500'
                          }`}></i>
                        </div>
                        <div>
                          <p className={`text-sm font-medium transition-colors ${
                            isDragging
                              ? 'text-teal-600 dark:text-teal-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {isDragging
                              ? 'Solte os arquivos aqui'
                              : 'Clique para selecionar ou arraste arquivos aqui'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Tamanho máximo: 50MB por arquivo
                          </p>
                        </div>
                      </div>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  {uploading && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-teal-600 dark:text-teal-400">
                      <i className="ri-loader-4-line animate-spin"></i>
                      <span className="text-sm">Enviando anexos...</span>
                    </div>
                  )}
                </div>

                {/* Modo criação: lista de arquivos selecionados localmente */}
                {!isEditMode && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                        Arquivos Selecionados
                      </label>
                      {attachments.length > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {attachments.length} {attachments.length === 1 ? 'arquivo' : 'arquivos'}
                        </span>
                      )}
                    </div>

                    {attachments.length === 0 ? (
                      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-8 text-center">
                        <i className="ri-attachment-2 text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Nenhum arquivo selecionado
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Os arquivos serão enviados ao criar a tarefa
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {attachments.map((file, index) => (
                          <div
                            key={index}
                            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <div className="w-10 h-10 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-lg flex-shrink-0">
                              <i className={`${getFileIcon(file.type)} text-xl text-teal-600 dark:text-teal-400`}></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(index)}
                              className="w-8 h-8 flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                              title="Remover arquivo"
                            >
                              <i className="ri-close-line text-lg"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Modo edição: lista de anexos existentes */}
                {isEditMode && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                        Anexos da Tarefa
                      </label>
                      {existingAttachments.length > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {existingAttachments.length} {existingAttachments.length === 1 ? 'arquivo' : 'arquivos'}
                        </span>
                      )}
                    </div>

                    {loadingAttachments ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                        <i className="ri-loader-4-line animate-spin text-lg"></i>
                        <span className="text-sm">Carregando anexos...</span>
                      </div>
                    ) : existingAttachments.length === 0 ? (
                      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-8 text-center">
                        <i className="ri-attachment-2 text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Nenhum anexo nesta tarefa
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {existingAttachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <div className="w-10 h-10 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-lg flex-shrink-0">
                              <i className={`${getFileIcon(attachment.file_type)} text-xl text-teal-600 dark:text-teal-400`}></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {attachment.original_name}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                <span>{formatFileSize(attachment.file_size)}</span>
                                <span>•</span>
                                <span>
                                  {new Date(attachment.created_at).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                  })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleDownloadAttachment(attachment)}
                                className="w-8 h-8 flex items-center justify-center text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30 rounded-lg transition-colors cursor-pointer"
                                title="Baixar arquivo"
                              >
                                <i className="ri-download-line text-lg"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteExistingAttachment(attachment)}
                                className="w-8 h-8 flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={deletingAttachmentId === attachment.id}
                                title="Excluir arquivo"
                              >
                                {deletingAttachmentId === attachment.id ? (
                                  <i className="ri-loader-4-line animate-spin text-lg"></i>
                                ) : (
                                  <i className="ri-delete-bin-line text-lg"></i>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer"
                disabled={loading || uploading}
              >
                Cancelar
              </button>

              {/* Botão Excluir — apenas no modo edição, entre Cancelar e Salvar */}
              {isEditMode && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer flex items-center gap-2"
                  disabled={loading || deleting}
                >
                  <i className="ri-delete-bin-line"></i>
                  Excluir
                </button>
              )}

              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || uploading || loadingMembers}
              >
                {loading
                  ? uploading
                    ? 'Enviando anexos...'
                    : isEditMode
                    ? 'Salvando...'
                    : 'Criando...'
                  : isEditMode
                  ? 'Salvar Alterações'
                  : 'Criar Tarefa'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de confirmação de exclusão */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 flex items-center justify-center bg-red-100 dark:bg-red-900/30 rounded-full flex-shrink-0">
                <i className="ri-delete-bin-line text-xl text-red-600 dark:text-red-400"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Excluir Tarefa</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Tem certeza que deseja excluir a tarefa{' '}
              <strong className="text-gray-900 dark:text-white">"{taskToEdit?.titulo}"</strong>? Esta
              ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium cursor-pointer"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteTask}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Excluindo...
                  </>
                ) : (
                  <>
                    <i className="ri-delete-bin-line"></i>
                    Excluir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de confirmação: mover sprint ── */}
      {showMoveSprintConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-full flex-shrink-0">
                <i className="ri-swap-box-line text-xl text-teal-600 dark:text-teal-400"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mover Tarefa</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Confirma a movimentação da tarefa:
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-6 break-words">
              "{taskToEdit?.titulo}"
            </p>

            <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex-1 text-center">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">De</p>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  <i className="ri-flashlight-line text-xs"></i>
                  {availableSprints.find((s) => s.id === formData.sprint)?.name || 'Sem sprint'}
                </span>
              </div>
              <div className="w-6 h-6 flex items-center justify-center text-teal-500">
                <i className="ri-arrow-right-line text-lg"></i>
              </div>
              <div className="flex-1 text-center">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Para</p>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                  <i className="ri-flashlight-line text-xs"></i>
                  {availableSprints.find((s) => s.id === selectedMoveSprintId)?.name || 'Sem sprint'}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowMoveSprintConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium cursor-pointer"
                disabled={movingToSprint}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleMoveSprint}
                className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={movingToSprint}
              >
                {movingToSprint ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Movendo...
                  </>
                ) : (
                  <>
                    <i className="ri-swap-box-line"></i>
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão de anexo */}
      {attachmentToDelete && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 flex items-center justify-center bg-red-100 dark:bg-red-900/30 rounded-full flex-shrink-0">
                <i className="ri-file-warning-line text-xl text-red-600 dark:text-red-400"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Excluir Anexo</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Tem certeza que deseja excluir o arquivo:
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-6 break-all">
              "{attachmentToDelete.original_name}"
            </p>
            <p className="text-xs text-red-500 dark:text-red-400 mb-6 flex items-center gap-1.5">
              <i className="ri-error-warning-line text-sm"></i>
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAttachmentToDelete(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAttachment}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="ri-delete-bin-line"></i>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
