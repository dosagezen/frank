import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
  getInitials,
  getAvatarColor,
  fetchAllMembers,
} from '../../../services/teamService';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { notifyTaskFieldsChanged, notifyTaskAttachmentAdded } from '../../../services/notificationsService';
import type { TaskSnapshot } from '../../../services/notificationsService';
import { safeFetchMany } from '../../../services/supabaseHelpers';
import DatePicker from '../../../components/base/DatePicker';
import UserAvatar from '../../../components/base/UserAvatar';

interface TaskDetailsModalProps {
  task: any;
  onClose: () => void;
  onEdit: (task: any) => void;
  onDelete?: (taskId: string) => void;
  isOpen: boolean;
  initialEditMode?: boolean;
}

interface TeamMember {
  id: string;
  nome: string;
  cargo: string;
  avatar_url: string | null;
}

// ✅ ADICIONAR: Interface para comentários
interface Comment {
  id: string;
  content: string;
  user_name: string;
  user_avatar: string | null;
  created_at: string;
}

export default function TaskDetailsModal({
  task,
  onClose,
  onEdit,
  onDelete,
  isOpen,
  initialEditMode = false,
}: TaskDetailsModalProps) {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // ✅ ADICIONAR: Estado para comentários
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [availableSprints, setAvailableSprints] = useState<any[]>([]);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    project_id: '',
    sprint_id: '',
    status: '',
    priority: '',
    responsavel_id: '',
    dueDate: '',
    tags: [] as string[],
    categoria: '',
    tempoEstimado: '',
    recurrenceType: 'none',
    recurrenceEndDate: '',
    observacoes: '',
  });
  const [tagInput, setTagInput] = useState('');

  // Permission comes directly from the parent (calculated in TarefasPage)
  const canManageTasks = task?.canEdit ?? false;

  /* ------------------------------------------------------------------ */
  /*                         EFFECTS & DATA LOADERS                    */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (isOpen && task?.id) {
      loadAttachments();
      loadComments();
      setIsEditing(initialEditMode);
    }
  }, [isOpen, task?.id]);

  // ✅ NOVO: Função para carregar comentários
  const loadComments = async () => {
    if (!task?.id) return;
    
    try {
      setLoadingComments(true);
      const { data, error } = await supabase
        .from('task_comments')
        .select('id, content, user_id, autor_nome, autor_avatar, created_at')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setComments((data || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        user_name: c.autor_nome || 'Usuário',
        user_avatar: c.autor_avatar || null,
        created_at: c.created_at
      })));
    } catch (error) {
      console.error('Erro ao carregar comentários:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  // ✅ NOVO: Função para adicionar comentário
  const handleAddComment = async () => {
    if (!newComment.trim() || !user || !task?.id) return;

    try {
      setSubmittingComment(true);
      
      // Buscar dados do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      const { data, error } = await supabase
        .from('task_comments')
        .insert([{
          task_id: task.id,
          user_id: user.id,
          content: newComment.trim(),
          autor_nome: profile?.nome || user.email || 'Usuário',
          autor_avatar: profile?.avatar_url || null
        }])
        .select()
        .single();

      if (error) throw error;

      // Adicionar comentário à lista
      setComments(prev => [...prev, {
        id: data.id,
        content: data.content,
        user_name: data.autor_nome,
        user_avatar: data.autor_avatar,
        created_at: data.created_at
      }]);

      setNewComment('');
      showToast('Comentário adicionado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      showToast('Erro ao adicionar comentário', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Populate edit form when entering edit mode
  useEffect(() => {
    if (isEditing && task) {
      const dueDate = task.recurrenceInstanceDate
        ? typeof task.recurrenceInstanceDate === 'string' &&
          task.recurrenceInstanceDate.includes('T')
          ? task.recurrenceInstanceDate.split('T')[0]
          : task.recurrenceInstanceDate
        : '';

      setEditForm({
        title: task.titulo || '',
        description: task.descricao || '',
        project_id: task.project_id || '',
        sprint_id: task.sprint_id || '',
        status: task.status || 'fazer',
        priority: task.prioridade || 'media',
        responsavel_id: task.responsavel?.id || '',
        dueDate,
        tags: task.tags || [],
        categoria: task.categoria || '',
        tempoEstimado: task.tempoEstimado || '',
        recurrenceType: task.recurrenceType || 'none',
        recurrenceEndDate: task.recurrenceEndDate || '',
        observacoes: task.observacoes || '',
      });
      setTagInput('');
      loadEditData();
    }
  }, [isEditing, task]);

  // Load sprints when project changes in edit mode
  useEffect(() => {
    if (isEditing && editForm.project_id) {
      loadSprints(editForm.project_id);
    } else if (isEditing) {
      setAvailableSprints([]);
    }
  }, [editForm.project_id, isEditing]);

  const loadEditData = async () => {
    setLoadingMembers(true);
    try {
      const [members, projectsData] = await Promise.all([
        fetchAllMembers(),
        safeFetchMany(async () =>
          supabase
            .from('projects')
            .select('id, nome, user_id')
            .order('nome', { ascending: true })
        ),
      ]);
      setTeamMembers(members);
      setProjects(projectsData);
    } catch (error) {
      console.error('Erro ao carregar dados de edição:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadSprints = async (projectId: string) => {
    try {
      const sprints = await safeFetchMany(async () =>
        supabase
          .from('project_sprints')
          .select('id, name, end_date')
          .eq('project_id', projectId)
          .order('sprint_order', { ascending: true })
      );
      setAvailableSprints(sprints);
    } catch {
      setAvailableSprints([]);
    }
  };

  const loadAttachments = async () => {
    try {
      setLoadingAttachments(true);
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Erro ao carregar anexos:', error);
      showToast(
        'Erro ao carregar anexos. Tente novamente.',
        'error'
      );
    } finally {
      setLoadingAttachments(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*                         FILE HANDLING                               */
  /* ------------------------------------------------------------------ */

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (file.size > maxSize) {
      showToast(
        'O arquivo é muito grande. O tamanho máximo é 50MB.',
        'warning'
      );
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('Usuário não autenticado', 'error');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('files')
        .insert([
          {
            user_id: user.id,
            name: file.name,
            type: file.type,
            size: file.size,
            url: publicUrl,
            storage_path: fileName,
            task_id: task.id,
            project_id: null,
          },
        ]);

      if (dbError) throw dbError;

      // Notificar o responsável sobre o novo anexo
      const responsavelId = task.responsavel?.id;
      if (responsavelId) {
        notifyTaskAttachmentAdded({
          taskId: task.id,
          taskTitle: task.titulo,
          fileName: file.name,
          responsavelId,
          actorId: user.id,
        });
      }

      showToast('Arquivo anexado com sucesso!', 'success');
      loadAttachments();
      e.target.value = '';
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      showToast(
        'Erro ao anexar arquivo. Tente novamente.',
        'error'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file: any) => {
    try {
      showToast('Preparando download...', 'success');

      // Gerar URL assinada com header de download forçado
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(file.storage_path, 120, {
          download: file.name,
        });

      if (error) throw error;
      if (!data?.signedUrl) throw new Error('URL de download não gerada');

      const fileName = file.name || 'arquivo';

      // Estratégia 1: fetch como blob (mais confiável para forçar download)
      try {
        const response = await fetch(data.signedUrl, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        }, 3000);

        return;
      } catch (fetchErr) {
        console.warn('Blob fetch falhou, tentando fallback:', fetchErr);
      }

      // Estratégia 2: fallback — link direto com atributo download
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = fileName;
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 3000);

    } catch (err) {
      console.error('Erro ao baixar arquivo:', err);
      showToast('Erro ao baixar o arquivo. Tente novamente.', 'error');
    }
  };

  const handleDelete = async (file: any) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir o arquivo "${file.name}"?`
      )
    ) {
      return;
    }

    try {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      showToast('Arquivo excluído com sucesso!', 'success');
      loadAttachments();
    } catch (error) {
      console.error('Erro ao excluir arquivo:', error);
      showToast(
        'Erro ao excluir arquivo. Tente novamente.',
        'error'
      );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Math.round((bytes / Math.pow(k, i)) * 100) / 100 +
      ' ' +
      sizes[i]
    );
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return 'ri-file-pdf-line';
    if (type.includes('image')) return 'ri-image-line';
    if (type.includes('video')) return 'ri-video-line';
    if (type.includes('word') || type.includes('document'))
      return 'ri-file-word-line';
    if (type.includes('excel') || type.includes('spreadsheet'))
      return 'ri-file-excel-line';
    if (
      type.includes('powerpoint') ||
      type.includes('presentation')
    )
      return 'ri-file-ppt-line';
    if (type.includes('zip') || type.includes('rar'))
      return 'ri-file-zip-line';
    return 'ri-file-line';
  };

  /* ------------------------------------------------------------------ */
  /*                         UI HELPERS                                  */
  /* ------------------------------------------------------------------ */

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendente':
      case 'fazer':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      case 'em-andamento':
      case 'fazendo':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400';
      case 'concluida':
      case 'feito':
        return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400';
      case 'aguardando':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400';
      case 'parado':
        return 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pendente':
      case 'fazer':
        return 'Fazer';
      case 'em-andamento':
      case 'fazendo':
        return 'Fazendo';
      case 'concluida':
      case 'feito':
        return 'Feito';
      case 'aguardando':
        return 'Aguardando';
      case 'parado':
        return 'Parado';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta':
        return 'text-red-600 dark:text-red-400';
      case 'media':
        return 'text-amber-600 dark:text-amber-400';
      case 'baixa':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'alta':
        return 'Alta';
      case 'media':
        return 'Média';
      case 'baixa':
        return 'Baixa';
      default:
        return priority;
    }
  };

  const getRecurrenceText = (type: string) => {
    switch (type) {
      case 'daily':
        return 'Diário';
      case 'weekly':
        return 'Semanal';
      case 'biweekly':
        return 'Quinzenal';
      case 'monthly':
        return 'Mensal';
      case 'bimonthly':
        return 'Bimestral';
      case 'quarterly':
        return 'Trimestral';
      case 'yearly':
        return 'Anual';
      default:
        return 'Não se repete';
    }
  };

  const getRecurrenceSummary = () => {
    if (editForm.recurrenceType === 'none') return null;

    let summary = 'Repete ';
    switch (editForm.recurrenceType) {
      case 'daily':
        summary += 'diariamente';
        break;
      case 'weekly':
        summary += 'semanalmente';
        break;
      case 'biweekly':
        summary += 'quinzenalmente';
        break;
      case 'monthly':
        summary += 'mensalmente';
        break;
      case 'bimonthly':
        summary += 'bimestralmente';
        break;
      case 'quarterly':
        summary += 'trimestralmente';
        break;
      case 'yearly':
        summary += 'anualmente';
        break;
    }

    if (editForm.recurrenceEndDate) {
      summary += ` até ${new Date(
        editForm.recurrenceEndDate + 'T12:00:00'
      ).toLocaleDateString('pt-BR')}`;
    } else {
      summary += ' (sem data de término)';
    }

    return summary;
  };

  /* ------------------------------------------------------------------ */
  /*                         TAG MANAGEMENT                               */
  /* ------------------------------------------------------------------ */

  const handleAddTag = () => {
    const newTag = tagInput.trim();
    if (newTag && !editForm.tags.includes(newTag)) {
      setEditForm({ ...editForm, tags: [...editForm.tags, newTag] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditForm({
      ...editForm,
      tags: editForm.tags.filter((t) => t !== tagToRemove),
    });
  };

  /* ------------------------------------------------------------------ */
  /*                         SAVE EDIT                                   */
  /* ------------------------------------------------------------------ */

  const handleSaveEdit = async () => {
    if (!editForm.title || !editForm.responsavel_id || !editForm.dueDate) {
      showToast(
        'Preencha todos os campos obrigatórios (título, responsável e prazo)',
        'warning'
      );
      return;
    }

    if (
      editForm.recurrenceType !== 'none' &&
      editForm.recurrenceEndDate
    ) {
      const startDate = new Date(editForm.dueDate);
      const endDate = new Date(editForm.recurrenceEndDate);
      if (endDate < startDate) {
        showToast(
          'A data de término da recorrência não pode ser anterior à data de prazo',
          'warning'
        );
        return;
      }
    }

    try {
      setSaving(true);

      // Buscar nome atualizado do responsável
      const { data: assigneeProfile } = await supabase
        .from('profiles')
        .select('nome, avatar_url')
        .eq('id', editForm.responsavel_id)
        .maybeSingle();

      const updateData = {
        title: editForm.title,
        description: editForm.description || null,
        project_id: editForm.project_id || null,
        sprint_id: editForm.sprint_id || null,
        status: editForm.status,
        priority: editForm.priority,
        responsavel_id: editForm.responsavel_id,
        assignee: assigneeProfile?.nome || '',
        due_date: editForm.dueDate,
        tags:
          editForm.tags.length > 0 ? editForm.tags : null,
        categoria: editForm.categoria || null,
        tempo_estimado: editForm.tempoEstimado || null,
        progress:
          editForm.status === 'feito'
            ? 100
            : task.progress || 0,
        recurrence_type: editForm.recurrenceType,
        recurrence_end_date:
          editForm.recurrenceType !== 'none' &&
          editForm.recurrenceEndDate
            ? editForm.recurrenceEndDate
            : null,
        observacoes: editForm.observacoes || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', task.id);

      if (error) throw error;

      // Notificar responsável sobre TODAS as alterações
      if (user) {
        const oldDueDate = task.recurrenceInstanceDate
          ? typeof task.recurrenceInstanceDate === 'string' &&
            task.recurrenceInstanceDate.includes('T')
            ? task.recurrenceInstanceDate.split('T')[0]
            : task.recurrenceInstanceDate
          : '';

        const oldSnapshot: TaskSnapshot = {
          title: task.titulo || '',
          description: task.descricao || '',
          status: task.status || 'fazer',
          priority: task.prioridade || 'media',
          responsavel_id: task.responsavel?.id || '',
          due_date: oldDueDate,
          project_id: task.project_id || null,
          sprint_id: task.sprint_id || null,
          categoria: task.categoria || null,
          tags: task.tags || null,
          tempo_estimado: task.tempoEstimado || null,
          recurrence_type: task.recurrenceType || 'none',
          recurrence_end_date: task.recurrenceEndDate || null,
          observacoes: task.observacoes || null,
          progress: task.progress || 0,
        };

        const newSnapshot: TaskSnapshot = {
          title: editForm.title,
          description: editForm.description || '',
          status: editForm.status,
          priority: editForm.priority,
          responsavel_id: editForm.responsavel_id,
          due_date: editForm.dueDate,
          project_id: editForm.project_id || null,
          sprint_id: editForm.sprint_id || null,
          categoria: editForm.categoria || null,
          tags: editForm.tags.length > 0 ? editForm.tags : null,
          tempo_estimado: editForm.tempoEstimado || null,
          recurrence_type: editForm.recurrenceType,
          recurrence_end_date:
            editForm.recurrenceType !== 'none' && editForm.recurrenceEndDate
              ? editForm.recurrenceEndDate
              : null,
          observacoes: editForm.observacoes || null,
          progress: editForm.status === 'feito' ? 100 : task.progress || 0,
        };

        notifyTaskFieldsChanged({
          taskId: task.id,
          taskTitle: editForm.title,
          oldData: oldSnapshot,
          newData: newSnapshot,
          responsavelId: editForm.responsavel_id,
          actorId: user.id,
        });
      }

      showToast('Tarefa atualizada com sucesso!', 'success');
      setIsEditing(false);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar tarefa:', error);
      showToast(
        'Erro ao salvar tarefa. Tente novamente.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*                         MARK COMPLETE                               */
  /* ------------------------------------------------------------------ */

  const handleMarkComplete = async (option: 'this' | 'all') => {
    if (!canManageTasks) {
      showToast(
        'Você não tem permissão para marcar esta tarefa como concluída',
        'warning'
      );
      return;
    }

    try {
      if (option === 'this') {
        if (task.isRecurring && task.recurrenceInstanceDate) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { error } = await supabase.from('tasks').insert([
            {
              user_id: user.id,
              title: task.titulo,
              description: task.descricao,
              project_id: task.project_id,
              sprint_id: task.sprint_id,
              status: 'feito',
              priority: task.prioridade,
              responsavel_id: task.responsavel_id,
              assignee: task.responsavel?.nome,
              due_date: task.recurrenceInstanceDate,
              tags: task.tags,
              categoria: task.categoria,
              tempo_estimado: task.tempoEstimado,
              progress: 100,
              recurrence_type: 'none',
              recurrence_parent_id: task.id,
              is_exception: true,
              updated_at: new Date().toISOString(),
            },
          ]);

          if (error) throw error;
          showToast('Ocorrência marcada como concluída!', 'success');
        } else {
          const { error } = await supabase
            .from('tasks')
            .update({
              status: 'feito',
              progress: 100,
              updated_at: new Date().toISOString(),
            })
            .eq('id', task.id);

          if (error) throw error;
          showToast('Tarefa marcada como concluída!', 'success');
        }
      } else {
        const { error } = await supabase
          .from('tasks')
          .update({
            status: 'feito',
            progress: 100,
            recurrence_type: 'none',
            recurrence_end_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id);

        if (error) throw error;
        showToast(
          'Todas as ocorrências foram marcadas como concluídas!',
          'success'
        );
      }

      setShowCompleteDialog(false);
      onClose();
    } catch (error) {
      console.error(
        'Erro ao marcar tarefa como concluída:',
        error
      );
      showToast(
        'Erro ao marcar tarefa como concluída. Tente novamente.',
        'error'
      );
    }
  };

  /* ------------------------------------------------------------------ */
  /*                         DELETE TASK                                 */
  /* ------------------------------------------------------------------ */

  const handleDeleteTask = async () => {
    if (!onDelete || !task?.id) return;
    try {
      setDeleting(true);
      await onDelete(task.id);
    } catch {
      showToast('Erro ao excluir tarefa. Tente novamente.', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*                         RENDERING                                    */
  /* ------------------------------------------------------------------ */

  if (!isOpen || !task) {
    return null;
  }

  /* -------------------------- EDIT MODE --------------------------- */
  if (isEditing) {
    return (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsEditing(false);
          }
        }}
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0 z-10">
            <h2
              className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Editar Tarefa
            </h2>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Título da Tarefa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Ex: Implementar nova funcionalidade"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Descrição
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setEditForm({
                        ...editForm,
                        description: e.target.value,
                      });
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                  rows={3}
                  placeholder="Descreva os detalhes da tarefa..."
                  maxLength={500}
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                  {editForm.description.length}/500 caracteres
                </div>
              </div>

              {/* Project & Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Project */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Projeto
                  </label>
                  <select
                    value={editForm.project_id}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        project_id: e.target.value,
                        sprint_id: '',
                      })
                    }
                    className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
                      backgroundPosition: 'right 12px center',
                    }}
                  >
                    <option value="">Sem projeto</option>
                    {projects.map((project) => (
                      <option
                        key={project.id}
                        value={project.id}
                      >
                        {project.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        status: e.target.value,
                      })
                    }
                    className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
                      backgroundPosition: 'right 12px center',
                    }}
                  >
                    <option value="fazer">Fazer</option>
                    <option value="fazendo">Fazendo</option>
                    <option value="feito">Feito</option>
                    <option value="aguardando">Aguardando</option>
                    <option value="parado">Parado</option>
                  </select>
                </div>
              </div>

              {/* Sprint (if project selected) */}
              {editForm.project_id && availableSprints.length > 0 && (
                <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Sprint do Projeto
                  </label>
                  <select
                    value={editForm.sprint_id}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        sprint_id: e.target.value,
                      })
                    }
                    className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
                      backgroundPosition: 'right 12px center',
                    }}
                  >
                    <option value="">
                      Nenhuma sprint selecionada
                    </option>
                    {availableSprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name} - Até{' '}
                        {new Date(
                          sprint.end_date + 'T12:00:00'
                        ).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Priority & Assignee */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Prioridade
                  </label>
                  <select
                    value={editForm.priority}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        priority: e.target.value,
                      })
                    }
                    className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
                      backgroundPosition: 'right 12px center',
                    }}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>

                {/* Assignee */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Responsável <span className="text-red-500">*</span>
                  </label>
                  {loadingMembers ? (
                    <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg flex items-center gap-2">
                      <i className="ri-loader-4-line animate-spin text-gray-400"></i>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Carregando...
                      </span>
                    </div>
                  ) : (
                    <select
                      value={editForm.responsavel_id}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          responsavel_id: e.target.value,
                        })
                      }
                      className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                      style={{
                        backgroundImage:
                          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
                        backgroundPosition: 'right 12px center',
                      }}
                      required
                    >
                      <option value="">Selecione um responsável</option>
                      {teamMembers.map((member) => (
                        <option
                          key={member.id}
                          value={member.id}
                        >
                          {member.nome}{' '}
                          {member.cargo ? `- ${member.cargo}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Category & Estimated Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={editForm.categoria}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        categoria: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Ex: Desenvolvimento, Design..."
                  />
                </div>

                {/* Estimated Time */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Tempo Estimado
                  </label>
                  <input
                    type="text"
                    value={editForm.tempoEstimado}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        tempoEstimado: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Ex: 4 horas, 2 dias..."
                  />
                </div>
              </div>

              {/* Due Date & Recurrence */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Due Date */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Data Entrega <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    value={editForm.dueDate}
                    onChange={(val) =>
                      setEditForm({ ...editForm, dueDate: val })
                    }
                    placeholder="Selecione a data"
                    required
                  />
                </div>

                {/* Recurrence */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <i className="ri-repeat-line text-teal-600 dark:text-teal-400"></i>
                    Recorrência
                  </label>
                  <select
                    value={editForm.recurrenceType}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        recurrenceType: e.target.value,
                      })
                    }
                    className="w-full px-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
                      backgroundPosition: 'right 12px center',
                    }}
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

              {/* Recurrence Details */}
              {editForm.recurrenceType !== 'none' && (
                <p className="text-sm text-teal-700 dark:text-teal-400 flex items-center gap-2 -mt-2">
                  <i className="ri-information-line"></i>
                  <span className="font-medium">
                    {getRecurrenceSummary()}
                  </span>
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
                {editForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editForm.tags.map((tag) => (
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

              {/* Observações / Notas Internas */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <i className="ri-sticky-note-line text-teal-600 dark:text-teal-400"></i>
                  Observações / Notas Internas
                </label>
                <textarea
                  value={editForm.observacoes}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setEditForm({
                        ...editForm,
                        observacoes: e.target.value,
                      });
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                  rows={3}
                  placeholder="Anotações internas, lembretes ou observações sobre esta tarefa..."
                  maxLength={500}
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                  {editForm.observacoes.length}/500 caracteres
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
              disabled={saving}
            >
              Cancelar
            </button>
            {/* Botão Excluir — entre Cancelar e Salvar */}
            {canManageTasks && onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer flex items-center gap-2"
                disabled={saving || deleting}
              >
                <i className="ri-delete-bin-line"></i>
                Excluir
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveEdit}
              className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving || loadingMembers}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
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
                Tem certeza que deseja excluir a tarefa <strong className="text-gray-900 dark:text-white">"{task.titulo}"</strong>? Esta ação não pode ser desfeita.
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
      </div>
    );
  }

  /* -------------------------- VIEW MODE --------------------------- */
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 break-words" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {task.titulo}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                  task.status
                )}`}
              >
                {getStatusText(task.status)}
              </span>
              {task.recurrenceType && task.recurrenceType !== 'none' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                  <i className="ri-repeat-line"></i>
                  Recorrente
                </span>
              )}
              {!canManageTasks && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  <i className="ri-eye-line"></i>
                  Apenas visualização
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all cursor-pointer flex-shrink-0"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!canManageTasks && (
            <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <i className="ri-information-line text-xl text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"></i>
                <div>
                  <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">
                    Acesso Somente Leitura
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Você pode visualizar esta tarefa, mas precisa ser convidado
                    para o projeto para editá-la ou marcá-la como concluída.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Description */}
            {task.descricao && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <i className="ri-file-text-line text-teal-600 dark:text-teal-400"></i>
                  Descrição
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  {task.descricao}
                </p>
              </div>
            )}

            {/* Recurrence Info */}
            {task.recurrenceType && task.recurrenceType !== 'none' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <i className="ri-repeat-line text-teal-600 dark:text-teal-400"></i>
                  Recorrência
                </h3>
                <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Tipo:
                      </span>
                      <span className="font-semibold text-teal-700 dark:text-teal-400">
                        {getRecurrenceText(task.recurrenceType)}
                      </span>
                    </div>
                    {task.recurrenceEndDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Termina em:
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {new Date(task.recurrenceEndDate).toLocaleDateString(
                            'pt-BR'
                          )}
                        </span>
                      </div>
                    )}
                    {!task.recurrenceEndDate && (
                      <p className="text-xs text-teal-700 dark:text-teal-400">
                        Esta tarefa se repete indefinidamente
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Main Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <i className="ri-information-line text-teal-600 dark:text-teal-400"></i>
                Informações
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Priority */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <i className="ri-flag-line"></i>
                    Prioridade
                  </p>
                  <p
                    className={`text-sm font-semibold ${getPriorityColor(
                      task.prioridade
                    )}`}
                  >
                    {getPriorityText(task.prioridade)}
                  </p>
                </div>

                {/* Due Date */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <i className="ri-calendar-line"></i>
                    Entrega
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {task.prazo}
                  </p>
                </div>

                {/* Category */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <i className="ri-price-tag-3-line"></i>
                    Categoria
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {task.categoria}
                  </p>
                </div>

                {/* Estimated Time */}
                {task.tempoEstimado && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <i className="ri-time-line"></i>
                      Tempo Estimado
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {task.tempoEstimado}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Responsável */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Responsável
              </label>
              {task.responsavel && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <UserAvatar
                    avatarUrl={task.responsavel.avatar}
                    nome={task.responsavel.nome}
                    size="md"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {task.responsavel.nome}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {task.responsavel.email}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <i className="ri-price-tag-3-line text-teal-600 dark:text-teal-400"></i>
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Observações / Notas Internas */}
            {task.observacoes && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <i className="ri-sticky-note-line text-teal-600 dark:text-teal-400"></i>
                  Observações / Notas Internas
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  {task.observacoes}
                </p>
              </div>
            )}

            {/* Attachments */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <i className="ri-attachment-line text-teal-600 dark:text-teal-400"></i>
                Anexos ({attachments.length})
              </h3>

              <div className="mb-4">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg cursor-pointer transition-colors text-sm font-medium">
                  <i className="ri-upload-line"></i>
                  {uploading ? 'Enviando...' : 'Anexar Arquivo'}
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Tamanho máximo: 50MB
                </p>
              </div>

              {loadingAttachments ? (
                <div className="flex items-center justify-center py-8">
                  <i className="ri-loader-4-line text-2xl text-teal-600 dark:text-teal-400 animate-spin"></i>
                </div>
              ) : attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((file) => (
                    <div
                      key={file.id}
                      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="w-10 h-10 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-lg flex-shrink-0">
                        <i
                          className={`${getFileIcon(
                            file.type
                          )} text-lg text-teal-600 dark:text-teal-400`}
                        ></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <span>{formatFileSize(file.size)}</span>
                          <span>&bull;</span>
                          <span>
                            {new Date(
                              file.created_at
                            ).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleDownload(file)}
                          className="w-8 h-8 flex items-center justify-center text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30 rounded-lg transition-colors cursor-pointer"
                          title="Baixar"
                        >
                          <i className="ri-download-line text-lg"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(file)}
                          className="w-8 h-8 flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <i className="ri-attachment-line text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Nenhum arquivo anexado
                  </p>
                </div>
              )}
            </div>

            {/* Comentários */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <i className="ri-chat-3-line text-teal-600 dark:text-teal-400"></i>
                Comentários ({comments.length})
              </h3>
              
              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <i className="ri-loader-4-line text-2xl text-teal-600 dark:text-teal-400 animate-spin"></i>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-4">
                    {comments.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <i className="ri-chat-3-line text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Nenhum comentário ainda. Seja o primeiro a comentar!
                        </p>
                      </div>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <UserAvatar
                            avatarUrl={comment.user_avatar}
                            nome={comment.user_name}
                            size="sm"
                          />
                          <div className="flex-1">
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-gray-900 dark:text-white text-sm">
                                  {comment.user_name}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(comment.created_at).toLocaleDateString('pt-BR')} às{' '}
                                  {new Date(comment.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {comment.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Adicionar novo comentário */}
                  {canManageTasks && (
                    <div className="flex gap-3">
                      <UserAvatar
                        avatarUrl={user?.user_metadata?.avatar_url}
                        nome={user?.user_metadata?.full_name || user?.email || 'Você'}
                        size="sm"
                      />
                      <div className="flex-1">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Escreva um comentário..."
                          rows={3}
                          maxLength={500}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {newComment.length}/500 caracteres
                          </span>
                          <button
                            onClick={handleAddComment}
                            disabled={!newComment.trim() || submittingComment}
                            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submittingComment ? 'Enviando...' : 'Comentar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Subtasks */}
            {task.subtarefas && task.subtarefas.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <i className="ri-list-check text-teal-600 dark:text-teal-400"></i>
                  Subtarefas ({task.subtarefas.filter((st: any) => st.concluida).length}/{task.subtarefas.length})
                </h3>
                <div className="space-y-2">
                  {task.subtarefas.map(
                    (subtarefa: any, index: number) => (
                      <div
                        key={index}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 flex items-center gap-3"
                      >
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                            subtarefa.concluida
                              ? 'bg-teal-600 dark:bg-teal-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          {subtarefa.concluida && (
                            <i className="ri-check-line text-white text-sm"></i>
                          )}
                        </div>
                        <p
                          className={`text-sm flex-1 ${
                            subtarefa.concluida
                              ? 'text-gray-500 dark:text-gray-400 line-through'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {subtarefa.titulo}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
          >
            Fechar
          </button>
          {canManageTasks && task.status !== 'feito' && (
            <button
              onClick={() => {
                if (
                  task.recurrenceType &&
                  task.recurrenceType !== 'none'
                ) {
                  setShowCompleteDialog(true);
                } else {
                  handleMarkComplete('this');
                }
              }}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
            >
              Marcar como Concluída
            </button>
          )}
          {canManageTasks && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
            >
              Editar Tarefa
            </button>
          )}
        </div>
      </div>

      {/* Confirmation dialog for recurring tasks */}
      {showCompleteDialog && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <i className="ri-repeat-line text-teal-600 dark:text-teal-400"></i>
                Tarefa Recorrente
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Esta é uma tarefa recorrente. Como deseja marcar como
                concluída?
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => handleMarkComplete('this')}
                  className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium text-left flex items-start gap-3 cursor-pointer"
                >
                  <i className="ri-checkbox-circle-line text-xl flex-shrink-0 mt-0.5"></i>
                  <div>
                    <div className="font-semibold mb-1">
                      Apenas esta ocorrência
                    </div>
                    <div className="text-xs text-teal-100">
                      Marca apenas esta tarefa como concluída
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => handleMarkComplete('all')}
                  className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium text-left flex items-start gap-3 cursor-pointer"
                >
                  <i className="ri-checkbox-multiple-line text-xl flex-shrink-0 mt-0.5"></i>
                  <div>
                    <div className="font-semibold mb-1">
                      Todas as ocorrências
                    </div>
                    <div className="text-xs text-gray-200">
                      Marca toda a série como concluída
                    </div>
                  </div>
                </button>
              </div>
              <button
                onClick={() => setShowCompleteDialog(false)}
                className="w-full mt-4 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
