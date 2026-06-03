import { useState, useEffect, useRef, useCallback } from 'react';
import { createProject, updateProject, fetchTeamMembers, fetchProjectsList } from '../../../services/projectsService';
import { invalidateProjectCaches } from '../../../services/realtimeSyncService';
import { supabase } from '../../../lib/supabaseClient';
import DatePicker from '../../../components/base/DatePicker';
import UserAvatar from '../../../components/base/UserAvatar';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import DraggableSprintItem from './DraggableSprintItem';

interface TeamMember {
  id: string;
  profile_id?: string;
  nome: string;
  avatar: string;
  cargo: string;
}

interface SprintForm {
  id?: string;
  name: string;
  startDate?: string;
  endDate: string;
  members: string[];
  status: string;
}

interface SectorContactPerson {
  id?: string;
  nome: string;
  email: string;
  telefone: string;
}

interface SectorContact {
  id?: string;
  sigla: string;
  nomeSetor: string;
  contatos: SectorContactPerson[];
}

interface LinkForm {
  id?: string;
  title: string;
  url: string;
}

interface StopLog {
  id?: string;
  justificativa: string;
  data_parada: string;
  kanban_stage: string;
  usuario: string;
}

interface FormData {
  name: string;
  description: string;
  priority: string;
  status: {
    naoIniciado: boolean;
    emAndamento: boolean;
    parado: boolean;
    concluido: boolean;
  };
  startDate: string;
  endDate: string;
  color: string;
  teamMembers: string[];
  links: LinkForm[];
  sprints: SprintForm[];
  stopLogs: StopLog[];
  kanbanStage: string;
  sectorContacts: SectorContact[];
  productOwner: string[];
  productManager: string[];
  deadline: string;
  agregado: string;
  entregaveis: string[];
  privado: boolean;
  observacoes: string;
}

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectSaved?: () => void;
  onSubmit?: (project: any) => void;
  editingProject?: any;
}

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  priority: 'media',
  status: {
    naoIniciado: true,
    emAndamento: false,
    parado: false,
    concluido: false,
  },
  startDate: '',
  endDate: '',
  color: '#14B8A6',
  teamMembers: [],
  links: [],
  sprints: [],
  stopLogs: [],
  kanbanStage: 'backlog',
  sectorContacts: [],
  productOwner: [],
  productManager: [],
  deadline: '',
  agregado: '',
  entregaveis: [],
  privado: false,
  observacoes: '',
};

const KANBAN_STAGES = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'desafio', label: 'Desafio' },
  { value: 'persona', label: 'Persona' },
  { value: 'proposta-valor', label: 'Proposta de Valor' },
  { value: 'validacao', label: 'Validação' },
  { value: 'mvp', label: 'MVP' },
];

const COLOR_OPTIONS = [
  '#14B8A6',
  '#3B82F6',
  '#8B5CF6',
  '#F59E0B',
  '#EF4444',
  '#10B981',
  '#F97316',
  '#EC4899',
  '#6366F1',
  '#84CC16',
  '#06B6D4',
  '#64748B',
];

async function fetchFreshProjectData(projectId: string): Promise<any | null> {
  try {
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !projectData) return null;

    const [sprintsResult, linksResult, entregaveisResult, sectorsResult, stopLogsResult] =
      await Promise.all([
        supabase.from('project_sprints').select('*').eq('project_id', projectId).order('sprint_order', {
          ascending: true,
        }),
        supabase.from('project_links').select('*').eq('project_id', projectId),
        supabase.from('project_entregaveis').select('*').eq('project_id', projectId),
        supabase.from('project_sector_contacts').select('*').eq('project_id', projectId),
        supabase
          .from('project_stop_logs')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
      ]);

    const sprints = (sprintsResult.data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      startDate: s.start_date || '',
      endDate: s.end_date || '',
      members: s.members || [],
      status: s.status || 'pendente',
    }));

    const sectors = sectorsResult.data || [];
    const sectorIds = sectors.map((s: any) => s.id);
    let contactPersons: any[] = [];
    if (sectorIds.length > 0) {
      const { data: persons } = await supabase
        .from('sector_contact_persons')
        .select('*')
        .in('sector_contact_id', sectorIds);
      contactPersons = persons || [];
    }

    const sectorContacts = sectors.map((s: any) => ({
      id: s.id,
      sigla: s.sigla,
      nomeSetor: s.nome_setor,
      contatos: contactPersons
        .filter((p: any) => p.sector_contact_id === s.id)
        .map((p: any) => ({
          id: p.id,
          nome: p.nome,
          email: p.email || '',
          telefone: p.telefone || '',
        })),
    }));

    return {
      ...projectData,
      sprints,
      links: (linksResult.data || []).map((l: any) => ({
        id: l.id,
        title: l.title,
        url: l.url,
      })),
      entregaveis: entregaveisResult.data || [],
      sectorContacts,
      stopLogs: stopLogsResult.data || [],
    };
  } catch {
    return null;
  }
}

async function fetchProjectMembers(projectId: string): Promise<string[]> {
  try {
    const { data } = await supabase.from('project_members').select('profile_id').eq('project_id', projectId);
    return (data || []).map((m: any) => m.profile_id).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchProductManager(projectId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('project_product_manager')
      .select('member_id')
      .eq('project_id', projectId)
      .maybeSingle();
    return data?.member_id || null;
  } catch {
    return null;
  }
}

export default function NewProjectModal({
  isOpen,
  onClose,
  onProjectSaved,
  onSubmit,
  editingProject,
}: NewProjectModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'team' | 'sprints' | 'sectors' | 'extras'>('basic');
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });
  const [teamMembersList, setTeamMembersList] = useState<TeamMember[]>([]);
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editDataLoaded, setEditDataLoaded] = useState(false);

  // Sprint form state
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintStartDate, setNewSprintStartDate] = useState('');
  const [newSprintEndDate, setNewSprintEndDate] = useState('');
  const [newSprintStatus, setNewSprintStatus] = useState('pendente');
  const [newSprintMembers, setNewSprintMembers] = useState<string[]>([]);
  const [sprintMembersDropdownOpen, setSprintMembersDropdownOpen] = useState(false);
  const sprintMembersDropdownRef = useRef<HTMLDivElement>(null);

  // ✅ NOVO: Estado para edição de sprint
  const [editingSprintIndex, setEditingSprintIndex] = useState<number | null>(null);

  // ✅ DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ✅ DnD handler para reordenar sprints
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFormData((prev) => {
      const oldIndex = prev.sprints.findIndex((_, i) => `sprint-${i}` === active.id);
      const newIndex = prev.sprints.findIndex((_, i) => `sprint-${i}` === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const newSprints = arrayMove(prev.sprints, oldIndex, newIndex);

      // Ajustar editingSprintIndex se necessário
      if (editingSprintIndex !== null) {
        if (editingSprintIndex === oldIndex) {
          setEditingSprintIndex(newIndex);
        } else if (oldIndex < editingSprintIndex && newIndex >= editingSprintIndex) {
          setEditingSprintIndex(editingSprintIndex - 1);
        } else if (oldIndex > editingSprintIndex && newIndex <= editingSprintIndex) {
          setEditingSprintIndex(editingSprintIndex + 1);
        }
      }

      return { ...prev, sprints: newSprints };
    });
  }, [editingSprintIndex]);

  // Sector form state
  const [newSectorSigla, setNewSectorSigla] = useState('');
  const [newSectorNome, setNewSectorNome] = useState('');
  const [newContactNome, setNewContactNome] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactTelefone, setNewContactTelefone] = useState('');
  const [selectedSectorIndex, setSelectedSectorIndex] = useState<number | null>(null);

  // Link form state
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Entregavel form state
  const [newEntregavel, setNewEntregavel] = useState('');

  // ✅ CONTROLE DE INICIALIZAÇÃO: Evita re-execução do useEffect
  const initializedForRef = useRef<string | null>(null);
  const isInitializingRef = useRef(false);

  // ✅ SOLUÇÃO DEFINITIVA: useEffect com controle rigoroso de re-execução
  useEffect(() => {
    if (!isOpen) {
      initializedForRef.current = null;
      isInitializingRef.current = false;
      return;
    }

    const currentKey = editingProject?.id ? String(editingProject.id) : 'new';

    if (initializedForRef.current === currentKey) return;
    if (isInitializingRef.current) return;

    isInitializingRef.current = true;

    const doInit = async () => {
      setError(null);
      setEditDataLoaded(false);
      setLoadingTeamMembers(true);
      setLoadingProjects(true);
      setActiveTab('basic');

      if (!editingProject) {
        setFormData({ ...EMPTY_FORM });
      }

      try {
        const [members, projects] = await Promise.all([fetchTeamMembers(), fetchProjectsList()]);

        const normalizedMembers = members.map((m: any) => ({
          id: m.id,
          profile_id: m.id,
          nome: m.nome || 'Sem nome',
          avatar: m.avatar || m.avatar_url || '',
          cargo: m.cargo || 'Membro',
        }));

        setTeamMembersList(normalizedMembers);
        setLoadingTeamMembers(false);
        setAvailableProjects(projects.map((p: any) => p.nome));
        setLoadingProjects(false);

        if (editingProject) {
          const freshProjectData = await fetchFreshProjectData(editingProject.id);
          if (!freshProjectData) {
            setError('Erro ao carregar dados do projeto. Tente novamente.');
            isInitializingRef.current = false;
            return;
          }

          const [projectMemberIds, productManagerId] = await Promise.all([
            fetchProjectMembers(freshProjectData.id),
            fetchProductManager(freshProjectData.id),
          ]);

          const statusMap: Record<string, string> = {
            'nao-iniciado': 'naoIniciado',
            'em-andamento': 'emAndamento',
            parado: 'parado',
            concluido: 'concluido',
          };
          const statusKey = statusMap[freshProjectData.status] || 'naoIniciado';

          setFormData({
            name: freshProjectData.nome || '',
            description: freshProjectData.descricao || '',
            priority: freshProjectData.prioridade || 'media',
            status: {
              naoIniciado: statusKey === 'naoIniciado',
              emAndamento: statusKey === 'emAndamento',
              parado: statusKey === 'parado',
              concluido: statusKey === 'concluido',
            },
            startDate: freshProjectData.data_inicio || '',
            endDate: freshProjectData.prazo || '',
            color: freshProjectData.cor || '#14B8A6',
            teamMembers: projectMemberIds,
            links: freshProjectData.links || [],
            sprints: freshProjectData.sprints || [],
            stopLogs: freshProjectData.stopLogs || [],
            kanbanStage: freshProjectData.kanban_stage || 'backlog',
            sectorContacts: freshProjectData.sectorContacts || [],
            productOwner: [],
            productManager: productManagerId ? [productManagerId] : [],
            deadline: freshProjectData.deadline || '',
            agregado: freshProjectData.agregado || '',
            entregaveis: freshProjectData.entregaveis?.map((e: any) => e.nome || e) || [],
            privado: freshProjectData.privado || false,
            observacoes: freshProjectData.observacoes || '',
          });

          setEditDataLoaded(true);
        }

        initializedForRef.current = currentKey;
      } catch {
        setError('Erro ao carregar dados. Tente novamente.');
      } finally {
        isInitializingRef.current = false;
      }
    };

    doInit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingProject?.id]);

  // Close sprint members dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sprintMembersDropdownRef.current && !sprintMembersDropdownRef.current.contains(e.target as Node)) {
        setSprintMembersDropdownOpen(false);
      }
    };
    if (sprintMembersDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sprintMembersDropdownOpen]);

  const handleAddSprint = () => {
    if (!newSprintName.trim()) return;

    console.log('🔵 STATE START DATE no momento de salvar sprint:', { valor: newSprintStartDate, tipo: typeof newSprintStartDate });

    const newSprint = {
      id: editingSprintIndex !== null ? formData.sprints[editingSprintIndex].id : undefined,
      name: newSprintName,
      startDate: newSprintStartDate,
      endDate: newSprintEndDate,
      members: newSprintMembers,
      status: newSprintStatus,
    };

    console.log('🔵 SPRINT ANTES ENVIO:', { name: newSprint.name, startDate: newSprint.startDate, tipo: typeof newSprint.startDate });

    if (editingSprintIndex !== null) {
      const updatedSprints = [...formData.sprints];
      updatedSprints[editingSprintIndex] = newSprint;
      setFormData((prev) => ({ ...prev, sprints: updatedSprints }));
      setEditingSprintIndex(null);
    } else {
      setFormData((prev) => ({ ...prev, sprints: [...prev.sprints, newSprint] }));
    }

    setNewSprintName('');
    setNewSprintStartDate('');
    setNewSprintEndDate('');
    setNewSprintStatus('pendente');
    setNewSprintMembers([]);
  };

  // ✅ NOVO: Função para iniciar edição de uma sprint
  const handleEditSprint = (index: number) => {
    const sprint = formData.sprints[index];
    setNewSprintName(sprint.name);
    setNewSprintStartDate(sprint.startDate || '');
    setNewSprintEndDate(sprint.endDate);
    setNewSprintStatus(sprint.status);
    setNewSprintMembers(sprint.members);
    setEditingSprintIndex(index);
  };

  // ✅ NOVO: Função para cancelar edição
  const handleCancelEditSprint = () => {
    setNewSprintName('');
    setNewSprintStartDate('');
    setNewSprintEndDate('');
    setNewSprintStatus('pendente');
    setNewSprintMembers([]);
    setEditingSprintIndex(null);
  };

  const handleRemoveSprint = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      sprints: prev.sprints.filter((_, i) => i !== index),
    }));
    // Se estiver editando a sprint removida, cancelar edição
    if (editingSprintIndex === index) {
      handleCancelEditSprint();
    } else if (editingSprintIndex !== null && editingSprintIndex > index) {
      // Ajustar índice se removeu uma sprint antes da que está sendo editada
      setEditingSprintIndex(editingSprintIndex - 1);
    }
  }, [editingSprintIndex, handleCancelEditSprint]);

  const handleAddSector = useCallback(() => {
    if (!newSectorSigla.trim() || !newSectorNome.trim()) return;

    const sector: SectorContact = {
      sigla: newSectorSigla.trim().toUpperCase(),
      nomeSetor: newSectorNome.trim(),
      contatos: [],
    };

    setFormData((prev) => ({
      ...prev,
      sectorContacts: [...prev.sectorContacts, sector],
    }));

    setNewSectorSigla('');
    setNewSectorNome('');
    setSelectedSectorIndex(formData.sectorContacts.length);
  }, [newSectorSigla, newSectorNome, formData.sectorContacts.length]);

  const handleRemoveSector = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      sectorContacts: prev.sectorContacts.filter((_, i) => i !== index),
    }));
    setSelectedSectorIndex(null);
  }, []);

  const handleAddContact = useCallback(() => {
    if (selectedSectorIndex === null || !newContactNome.trim()) return;

    const contact: SectorContactPerson = {
      nome: newContactNome.trim(),
      email: newContactEmail.trim(),
      telefone: newContactTelefone.trim(),
    };

    setFormData((prev) => {
      const updatedSectors = [...prev.sectorContacts];
      updatedSectors[selectedSectorIndex] = {
        ...updatedSectors[selectedSectorIndex],
        contatos: [...updatedSectors[selectedSectorIndex].contatos, contact],
      };
      return { ...prev, sectorContacts: updatedSectors };
    });

    setNewContactNome('');
    setNewContactEmail('');
    setNewContactTelefone('');
  }, [selectedSectorIndex, newContactNome, newContactEmail, newContactTelefone]);

  const handleRemoveContact = useCallback((sectorIndex: number, contactIndex: number) => {
    setFormData((prev) => {
      const updatedSectors = [...prev.sectorContacts];
      updatedSectors[sectorIndex] = {
        ...updatedSectors[sectorIndex],
        contatos: updatedSectors[sectorIndex].contatos.filter((_, i) => i !== contactIndex),
      };
      return { ...prev, sectorContacts: updatedSectors };
    });
  }, []);

  const handleAddLink = useCallback(() => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;

    setFormData((prev) => ({
      ...prev,
      links: [...prev.links, { title: newLinkTitle.trim(), url: newLinkUrl.trim() }],
    }));

    setNewLinkTitle('');
    setNewLinkUrl('');
  }, [newLinkTitle, newLinkUrl]);

  const handleRemoveLink = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index),
    }));
  }, []);

  const handleAddEntregavel = useCallback(() => {
    if (!newEntregavel.trim()) return;

    setFormData((prev) => ({
      ...prev,
      entregaveis: [...prev.entregaveis, newEntregavel.trim()],
    }));

    setNewEntregavel('');
  }, [newEntregavel]);

  const handleRemoveEntregavel = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      entregaveis: prev.entregaveis.filter((_, i) => i !== index),
    }));
  }, []);

  const toggleTeamMember = useCallback((memberId: string) => {
    setFormData((prev) => {
      const isSelected = prev.teamMembers.includes(memberId);
      return {
        ...prev,
        teamMembers: isSelected ? prev.teamMembers.filter((id) => id !== memberId) : [...prev.teamMembers, memberId],
      };
    });
  }, []);

  const toggleProductManager = useCallback((memberId: string) => {
    setFormData((prev) => ({
      ...prev,
      productManager: prev.productManager.includes(memberId) ? [] : [memberId],
    }));
  }, []);

  const toggleSprintMember = useCallback((memberName: string) => {
    setNewSprintMembers((prev) =>
      prev.includes(memberName) ? prev.filter((n) => n !== memberName) : [...prev, memberName],
    );
  }, []);

  const getActiveStatus = (): string => {
    if (formData.status.concluido) return 'concluido';
    if (formData.status.parado) return 'parado';
    if (formData.status.emAndamento) return 'emAndamento';
    return 'naoIniciado';
  };

  const setStatus = useCallback((key: keyof FormData['status']) => {
    setFormData((prev) => ({
      ...prev,
      status: {
        naoIniciado: key === 'naoIniciado',
        emAndamento: key === 'emAndamento',
        parado: key === 'parado',
        concluido: key === 'concluido',
      },
    }));
  }, []);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('O nome do projeto é obrigatório.');
      setActiveTab('basic');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const statusDbMap: Record<string, string> = {
        naoIniciado: 'nao-iniciado',
        emAndamento: 'em-andamento',
        parado: 'parado',
        concluido: 'concluido',
      };
      const activeStatus = getActiveStatus();
      const dbStatus = statusDbMap[activeStatus] || 'nao-iniciado';

      const selectedMembers = teamMembersList.filter((m) =>
        formData.teamMembers.includes(m.id || m.profile_id || ''),
      );

      const projectPayload = {
        nome: formData.name.trim(),
        descricao: formData.description.trim(),
        status: dbStatus,
        prioridade: formData.priority,
        prazo: formData.endDate || null,
        kanban_stage: formData.kanbanStage,
        cor: formData.color,
        data_inicio: formData.startDate || null,
        deadline: formData.deadline || null,
        agregado: formData.agregado.trim() || null,
        observacoes: formData.observacoes.trim() || null,
        privado: formData.privado,
        equipe: selectedMembers.map((m) => ({
          id: m.id,
          profile_id: m.profile_id || m.id,
          nome: m.nome,
          avatar: m.avatar,
          cargo: m.cargo,
        })),
        links: formData.links,
        sprints: formData.sprints.map((s) => ({
          id: (s as any).id,
          name: s.name,
          startDate: s.startDate || '',
          endDate: s.endDate,
          members: s.members,
          status: s.status,
        })),
        entregaveis: formData.entregaveis.map((e) => ({ nome: e })),
        sectorContacts: formData.sectorContacts.map((s) => ({
          sigla: s.sigla,
          nome_setor: s.nomeSetor,
          contatos: s.contatos,
        })),
        productManager: formData.productManager[0] || null,
      };

      if (editingProject) {
        await updateProject(editingProject.id, projectPayload);
      } else {
        await createProject(projectPayload);
      }

      // Invalidar cache após salvar
      await invalidateProjectCaches();

      if (onProjectSaved) onProjectSaved();
      if (onSubmit) onSubmit(projectPayload);

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar projeto. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isEditing = !!editingProject;
  const isLoading = loadingTeamMembers || loadingProjects || (isEditing && !editDataLoaded && !error);

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2
              className="text-xl font-bold text-gray-900 dark:text-white"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {isEditing ? 'Editar Projeto' : 'Novo Projeto'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {isEditing ? 'Atualize as informações do projeto' : 'Preencha as informações do novo projeto'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto flex-shrink-0">
          {[
            { key: 'basic', label: 'Básico', icon: 'ri-file-text-line' },
            { key: 'team', label: 'Equipe', icon: 'ri-team-line' },
            { key: 'sprints', label: 'Sprints', icon: 'ri-flashlight-line' },
            { key: 'sectors', label: 'Setores', icon: 'ri-building-line' },
            { key: 'extras', label: 'Extras', icon: 'ri-more-line' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <i className={tab.icon}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-teal-200 dark:border-teal-800 border-t-teal-600 dark:border-t-teal-400 rounded-full animate-spin"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Carregando dados...</p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                  <i className="ri-error-warning-line text-red-600 dark:text-red-400 flex-shrink-0"></i>
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* ===== TAB: BÁSICO ===== */}
              {activeTab === 'basic' && (
                <div className="space-y-5">
                  {/* Nome */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Nome do Projeto <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Plano de Comunicação 2026"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Descrição
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Descreva o objetivo do projeto..."
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
                    />
                  </div>

                  {/* Etapa Kanban + Prioridade */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Etapa do Kanban
                      </label>
                      <div className="relative">
                        <select
                          value={formData.kanbanStage}
                          onChange={(e) => setFormData((prev) => ({ ...prev, kanbanStage: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none cursor-pointer"
                        >
                          {KANBAN_STAGES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Prioridade
                      </label>
                      <div className="relative">
                        <select
                          value={formData.priority}
                          onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none cursor-pointer"
                        >
                          <option value="baixa">Baixa</option>
                          <option value="media">Média</option>
                          <option value="alta">Alta</option>
                        </select>
                        <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Status
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { key: 'naoIniciado' as const, label: 'Não Iniciado', color: 'gray' },
                        { key: 'emAndamento' as const, label: 'Em Andamento', color: 'blue' },
                        { key: 'parado' as const, label: 'Parado', color: 'red' },
                        { key: 'concluido' as const, label: 'Concluído', color: 'green' },
                      ].map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setStatus(s.key)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                            formData.status[s.key]
                              ? s.color === 'gray'
                                ? 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 border-gray-400 dark:border-gray-500'
                                : s.color === 'blue'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-400 dark:border-blue-600'
                                : s.color === 'red'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-400 dark:border-red-600'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-400 dark:border-green-600'
                              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Datas */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Data Início
                      </label>
                      <DatePicker
                        value={formData.startDate}
                        onChange={(val) => setFormData((prev) => ({ ...prev, startDate: val }))}
                        placeholder="dd/mm/aaaa"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Deadline <span className="text-red-500">*</span>
                      </label>
                      <DatePicker
                        value={formData.deadline}
                        onChange={(val) => setFormData((prev) => ({ ...prev, deadline: val }))}
                        placeholder="dd/mm/aaaa"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Prazo planejado para entrega
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Data Término
                      </label>
                      <DatePicker
                        value={formData.endDate}
                        onChange={(val) => setFormData((prev) => ({ ...prev, endDate: val }))}
                        placeholder="dd/mm/aaaa"
                        disabled={!editingProject}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {editingProject ? 'Data efetiva de conclusão' : 'Preenchido ao concluir o projeto'}
                      </p>
                    </div>
                  </div>

                  {/* Cor */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cor do Projeto
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, color }))}
                          className={`w-8 h-8 rounded-full transition-all cursor-pointer ${
                            formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Privado */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, privado: !prev.privado }))}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        formData.privado ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          formData.privado ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Projeto Privado</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Apenas membros da equipe podem visualizar
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== TAB: EQUIPE ===== */}
              {activeTab === 'team' && (
                <div className="space-y-6">
                  {/* Product Manager */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <i className="ri-user-star-line text-teal-600 dark:text-teal-400"></i>
                      Product Manager (PM)
                    </h3>
                    {loadingTeamMembers ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Carregando membros...</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {teamMembersList.map((member) => {
                          const memberId = member.profile_id || member.id;
                          const isSelected = formData.productManager.includes(memberId);
                          return (
                            <button
                              key={memberId}
                              type="button"
                              onClick={() => toggleProductManager(memberId)}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer text-left ${
                                isSelected
                                  ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700/50'
                              }`}
                            >
                              <UserAvatar avatarUrl={member.avatar} nome={member.nome} size="sm" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.nome}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.cargo}</p>
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                  <i className="ri-star-fill text-amber-500"></i>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Membros da Equipe */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <i className="ri-team-line text-teal-600 dark:text-teal-400"></i>
                      Membros da Equipe
                      <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full text-xs">
                        {formData.teamMembers.length} selecionados
                      </span>
                    </h3>
                    {loadingTeamMembers ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Carregando membros...</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                        {teamMembersList.map((member) => {
                          const memberId = member.profile_id || member.id;
                          const isSelected = formData.teamMembers.includes(memberId);
                          return (
                            <button
                              key={memberId}
                              type="button"
                              onClick={() => toggleTeamMember(memberId)}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer text-left ${
                                isSelected
                                  ? 'border-teal-400 dark:border-teal-600 bg-teal-50 dark:bg-teal-900/20'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700/50'
                              }`}
                            >
                              <UserAvatar avatarUrl={member.avatar} nome={member.nome} size="sm" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.nome}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.cargo}</p>
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                  <i className="ri-checkbox-circle-fill text-teal-600 dark:text-teal-400"></i>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===== TAB: SPRINTS ===== */}
              {activeTab === 'sprints' && (
                <div className="space-y-5">
                  {/* Formulário nova sprint - TOPO */}
                  <div className={`p-4 rounded-xl border border-dashed space-y-4 ${
                    editingSprintIndex !== null
                      ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700'
                      : 'bg-gray-50 dark:bg-gray-700/30 border-gray-300 dark:border-gray-600'
                  }`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        {editingSprintIndex !== null ? (
                          <>
                            <i className="ri-edit-line text-amber-600 dark:text-amber-400"></i>
                            Editando Sprint #{editingSprintIndex + 1}
                          </>
                        ) : (
                          <>
                            <i className="ri-add-circle-line text-teal-600 dark:text-teal-400"></i>
                            Adicionar Nova Sprint
                          </>
                        )}
                      </h3>
                      {editingSprintIndex !== null && (
                        <button
                          type="button"
                          onClick={handleCancelEditSprint}
                          className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
                        >
                          <i className="ri-close-line"></i>
                          Cancelar Edição
                        </button>
                      )}
                    </div>

                    {/* Linha 1: Nome da Sprint */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Nome da Sprint <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newSprintName}
                        onChange={(e) => setNewSprintName(e.target.value)}
                        placeholder="Ex: Sprint 1 - Discovery"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>

                    {/* Linha 2: Data de Início + Data de Término + Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Data de Início
                        </label>
                        <DatePicker
                          value={newSprintStartDate}
                          onChange={(val) => setNewSprintStartDate(val)}
                          placeholder="dd/mm/aaaa"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Data de Término
                        </label>
                        <DatePicker
                          value={newSprintEndDate}
                          onChange={(val) => setNewSprintEndDate(val)}
                          placeholder="dd/mm/aaaa"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Status
                        </label>
                        <div className="relative">
                          <select
                            value={newSprintStatus}
                            onChange={(e) => setNewSprintStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none cursor-pointer"
                          >
                            <option value="pendente">Pendente</option>
                            <option value="em-andamento">Em Andamento</option>
                            <option value="concluida">Concluída</option>
                          </select>
                          <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                        </div>
                      </div>
                    </div>

                    {/* Linha 3: Multi-select dropdown de Membros */}
                    {teamMembersList.length > 0 && (
                      <div ref={sprintMembersDropdownRef} className="relative">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Membros da Sprint
                        </label>
                        <button
                          type="button"
                          onClick={() => setSprintMembersDropdownOpen((prev) => !prev)}
                          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        >
                          <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                            {newSprintMembers.length === 0 ? (
                              <span className="text-gray-400 dark:text-gray-500">Selecionar membros...</span>
                            ) : (
                              <>
                                {newSprintMembers.slice(0, 3).map((memberName) => {
                                  const member = teamMembersList.find((m) => m.nome === memberName);
                                  return (
                                    <span
                                      key={memberName}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 rounded-md text-xs border border-teal-200 dark:border-teal-800"
                                    >
                                      {member && <UserAvatar avatarUrl={member.avatar} nome={member.nome} size="xs" />}
                                      <span className="font-medium truncate max-w-[80px]">{memberName.split(' ')[0]}</span>
                                    </span>
                                  );
                                })}
                                {newSprintMembers.length > 3 && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    +{newSprintMembers.length - 3}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <i className={`ri-arrow-down-s-line text-gray-400 transition-transform flex-shrink-0 ${sprintMembersDropdownOpen ? 'rotate-180' : ''}`}></i>
                        </button>

                        {/* Dropdown list */}
                        {sprintMembersDropdownOpen && (
                          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {teamMembersList.map((member) => {
                              const isSelected = newSprintMembers.includes(member.nome);
                              return (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={() => toggleSprintMember(member.nome)}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                  }`}
                                >
                                  <div className={`w-4 h-4 flex items-center justify-center rounded border flex-shrink-0 transition-colors ${
                                    isSelected
                                      ? 'bg-teal-600 border-teal-600'
                                      : 'border-gray-300 dark:border-gray-500'
                                  }`}>
                                    {isSelected && <i className="ri-check-line text-white text-xs"></i>}
                                  </div>
                                  <UserAvatar avatarUrl={member.avatar} nome={member.nome} size="xs" />
                                  <span className="font-medium truncate">{member.nome}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAddSprint}
                      disabled={!newSprintName.trim()}
                      className={`w-full py-2.5 text-white disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                        editingSprintIndex !== null
                          ? 'bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 dark:disabled:bg-gray-600'
                          : 'bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 dark:disabled:bg-gray-600'
                      }`}
                    >
                      {editingSprintIndex !== null ? (
                        <>
                          <i className="ri-save-line"></i>
                          Salvar Alterações da Sprint
                        </>
                      ) : (
                        <>
                          <i className="ri-add-line"></i>
                          Adicionar Sprint
                        </>
                      )}
                    </button>
                  </div>

                  {/* Lista de sprints com Drag and Drop */}
                  {formData.sprints.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        Sprints adicionadas ({formData.sprints.length})
                        <span className="text-xs font-normal text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <i className="ri-draggable text-sm"></i>
                          Arraste para reordenar
                        </span>
                      </h3>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                      >
                        <SortableContext
                          items={formData.sprints.map((_, i) => `sprint-${i}`)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {formData.sprints.map((sprint, index) => (
                              <DraggableSprintItem
                                key={sprint.id || `sprint-${index}`}
                                dragId={`sprint-${index}`}
                                sprint={sprint}
                                index={index}
                                editingSprintIndex={editingSprintIndex}
                                onEdit={handleEditSprint}
                                onRemove={handleRemoveSprint}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}
                </div>
              )}

              {/* ===== TAB: SETORES ===== */}
              {activeTab === 'sectors' && (
                <div className="space-y-5">
                  {/* Lista de setores */}
                  {formData.sectorContacts.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Setores adicionados ({formData.sectorContacts.length})
                      </h3>
                      {formData.sectorContacts.map((sector, sectorIndex) => (
                        <div
                          key={sectorIndex}
                          className={`rounded-xl border transition-all ${
                            selectedSectorIndex === sectorIndex
                              ? 'border-teal-400 dark:border-teal-600 bg-teal-50/50 dark:bg-teal-900/10'
                              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/30'
                          }`}
                        >
                          <div className="flex items-center gap-3 p-3">
                            <span className="px-2.5 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-md text-xs font-bold flex-shrink-0">
                              {sector.sigla}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{sector.nomeSetor}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {sector.contatos.length} contato{sector.contatos.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedSectorIndex(selectedSectorIndex === sectorIndex ? null : sectorIndex)
                                }
                                className="p-1.5 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30 rounded-lg transition-colors cursor-pointer"
                                title="Adicionar contato"
                              >
                                <i className="ri-user-add-line text-sm"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSector(sectorIndex)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                              >
                                <i className="ri-delete-bin-line text-sm"></i>
                              </button>
                            </div>
                          </div>

                          {/* Contatos do setor */}
                          {sector.contatos.length > 0 && (
                            <div className="px-3 pb-3 space-y-2">
                              {sector.contatos.map((contact, contactIndex) => (
                                <div
                                  key={contactIndex}
                                  className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700"
                                >
                                  <div className="w-7 h-7 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full flex-shrink-0">
                                    <i className="ri-user-line text-xs text-gray-500 dark:text-gray-400"></i>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{contact.nome}</p>
                                    <div className="flex gap-2 flex-wrap">
                                      {contact.email && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{contact.email}</span>
                                      )}
                                      {contact.telefone && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{contact.telefone}</span>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveContact(sectorIndex, contactIndex)}
                                    className="p-1 text-red-400 hover:text-red-600 rounded transition-colors cursor-pointer flex-shrink-0"
                                  >
                                    <i className="ri-close-line text-sm"></i>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Formulário de contato */}
                          {selectedSectorIndex === sectorIndex && (
                            <div className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-gray-600 space-y-2">
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Adicionar contato:</p>
                              <input
                                type="text"
                                value={newContactNome}
                                onChange={(e) => setNewContactNome(e.target.value)}
                                placeholder="Nome do contato *"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="email"
                                  value={newContactEmail}
                                  onChange={(e) => setNewContactEmail(e.target.value)}
                                  placeholder="E-mail"
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                                <input
                                  type="tel"
                                  value={newContactTelefone}
                                  onChange={(e) => setNewContactTelefone(e.target.value)}
                                  placeholder="Telefone"
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleAddContact}
                                disabled={!newContactNome.trim()}
                                className="w-full py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white disabled:text-gray-500 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                              >
                                Adicionar Contato
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulário novo setor */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <i className="ri-add-circle-line text-teal-600 dark:text-teal-400"></i>
                      Adicionar Novo Setor
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Sigla <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newSectorSigla}
                          onChange={(e) => setNewSectorSigla(e.target.value.toUpperCase())}
                          placeholder="Ex: TI"
                          maxLength={10}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent uppercase"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Nome do Setor <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newSectorNome}
                          onChange={(e) => setNewSectorNome(e.target.value)}
                          placeholder="Ex: Tecnologia da Informação"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSector}
                      disabled={!newSectorSigla.trim() || !newSectorNome.trim()}
                      className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      <i className="ri-add-line"></i>
                      Adicionar Setor
                    </button>
                  </div>
                </div>
              )}

              {/* ===== TAB: EXTRAS ===== */}
              {activeTab === 'extras' && (
                <div className="space-y-6">
                  {/* Agregado */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Agregado (Projeto Relacionado)
                    </label>
                    {loadingProjects ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Carregando projetos...</p>
                    ) : (
                      <div className="relative">
                        <select
                          value={formData.agregado}
                          onChange={(e) => setFormData((prev) => ({ ...prev, agregado: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none cursor-pointer"
                        >
                          <option value="">Nenhum</option>
                          {availableProjects
                            .filter((p) => p !== formData.name)
                            .map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                        </select>
                        <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                      </div>
                    )}
                  </div>

                  {/* Entregáveis */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Entregáveis
                    </label>
                    {formData.entregaveis.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {formData.entregaveis.map((e, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg text-sm border border-purple-200 dark:border-purple-800"
                          >
                            <i className="ri-price-tag-3-line text-xs"></i>
                            {e}
                            <button
                              type="button"
                              onClick={() => handleRemoveEntregavel(i)}
                              className="ml-1 text-purple-400 hover:text-purple-600 cursor-pointer"
                            >
                              <i className="ri-close-line text-xs"></i>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newEntregavel}
                        onChange={(e) => setNewEntregavel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddEntregavel();
                          }
                        }}
                        placeholder="Ex: Relatório Final, Protótipo..."
                        className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleAddEntregavel}
                        disabled={!newEntregavel.trim()}
                        className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        <i className="ri-add-line"></i>
                      </button>
                    </div>
                  </div>

                  {/* Links Úteis */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Links Úteis
                    </label>
                    {formData.links.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {formData.links.map((link, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                          >
                            <div className="w-8 h-8 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-lg flex-shrink-0">
                              <i className="ri-link text-teal-600 dark:text-teal-400 text-sm"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{link.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{link.url}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(i)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                            >
                              <i className="ri-delete-bin-line text-sm"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newLinkTitle}
                        onChange={(e) => setNewLinkTitle(e.target.value)}
                        placeholder="Título do link"
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          placeholder="https://..."
                          className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleAddLink}
                          disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}
                          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          <i className="ri-add-line"></i>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Observações
                    </label>
                    <textarea
                      value={formData.observacoes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Observações adicionais sobre o projeto..."
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formData.sprints.length > 0 && (
              <span className="mr-3">
                <i className="ri-flashlight-line mr-1"></i>
                {formData.sprints.length} sprint{formData.sprints.length !== 1 ? 's' : ''}
              </span>
            )}
            {formData.teamMembers.length > 0 && (
              <span className="mr-3">
                <i className="ri-team-line mr-1"></i>
                {formData.teamMembers.length} membro{formData.teamMembers.length !== 1 ? 's' : ''}
              </span>
            )}
            {formData.sectorContacts.length > 0 && (
              <span>
                <i className="ri-building-line mr-1"></i>
                {formData.sectorContacts.length} setor{formData.sectorContacts.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isLoading}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white disabled:text-gray-500 rounded-lg font-medium text-sm transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <i className="ri-save-line"></i>
                  {isEditing ? 'Salvar Alterações' : 'Criar Projeto'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
