import { supabase } from '../lib/supabaseClient';
import { getCached, setCached, invalidateCache, CACHE_KEYS } from './localCache';

// ===========================
// HELPERS
// ===========================

/**
 * Formata uma data para o formato YYYY-MM-DD sem conversão de timezone.
 * Evita o bug de UTC-3 que desloca a data 1 dia para trás.
 */
function formatDateForDB(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  // Adiciona T12:00:00 para garantir que o meio-dia local nunca cruze a meia-noite UTC
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ===========================
// TIPOS E INTERFACES
// ===========================

export interface ProjectMember {
  id?: string;
  profile_id?: string;
  nome: string;
  avatar: string;
  cargo: string;
}

export interface ProjectLink {
  title: string;
  url: string;
}

export interface ProjectEntregavel {
  nome: string;
}

export interface SprintTask {
  titulo: string;
  status: string;
  responsavel: string;
}

export interface ProjectSprint {
  id?: string;
  name: string;
  startDate?: string; // ✅ NOVO: Data de início da sprint
  endDate: string;
  members: string[];
  status: string;
  tarefas?: SprintTask[];
}

export interface SectorContactPerson {
  nome: string;
  email: string;
  telefone: string;
}

export interface ProjectSectorContact {
  sigla: string;
  nome_setor: string;
  contatos?: SectorContactPerson[];
}

export interface Project {
  id?: string;
  nome: string;
  descricao?: string;
  status: string;
  prioridade?: string;
  progresso?: number;
  prazo?: string;
  kanban_stage?: string;
  cor?: string;
  data_inicio?: string;
  deadline?: string;
  agregado?: string;
  observacoes?: string;
  tarefas_concluidas?: number;
  total_tarefas?: number;
  privado?: boolean;
  equipe?: ProjectMember[];
  links?: ProjectLink[];
  entregaveis?: ProjectEntregavel[];
  productManager?: string;
  sprints?: ProjectSprint[];
  sectorContacts?: ProjectSectorContact[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

// ===========================
// FUNÇÕES DE PERMISSÃO
// ===========================

/**
 * Verifica se o usuário pode gerenciar (editar/deletar) um projeto
 */
export async function canUserManageProject(
  userId: string,
  projectId: string
): Promise<{ canManage: boolean; reason?: string }> {
  try {
    // 1. Buscar o projeto
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id, privado')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      return { canManage: false, reason: 'Projeto não encontrado' };
    }

    // 2. Buscar o perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return { canManage: false, reason: 'Perfil não encontrado' };
    }

    // 3. Admin pode tudo
    if (profile.role === 'admin') {
      return { canManage: true };
    }

    // 4. Criador do projeto pode gerenciar
    if (project.user_id === userId) {
      return { canManage: true };
    }

    // 5. Se o projeto é privado, apenas criador e admin podem gerenciar
    if (project.privado) {
      return { canManage: false, reason: 'Projeto privado - apenas o criador pode editar' };
    }

    // 6. Verificar se é membro do projeto
    const { data: member, error: memberError } = await supabase
      .from('project_members')
      .select('profile_id')
      .eq('project_id', projectId)
      .eq('profile_id', userId)
      .maybeSingle();

    if (memberError || !member) {
      return { canManage: false, reason: 'Você não é membro deste projeto' };
    }

    // 7. Membro pode gerenciar projetos públicos
    return { canManage: true };
  } catch (error) {
    console.error('[PERMISSIONS] Erro ao verificar permissões:', error);
    return { canManage: false, reason: 'Erro ao verificar permissões' };
  }
}

/**
 * Verifica se um projeto é privado
 */
export function isProjectPrivate(project: Project): boolean {
  return project.privado === true;
}

// ===========================
// FUNÇÕES DE CACHE
// ===========================

/**
 * Invalida todos os caches relacionados a projetos
 */
export async function invalidateProjectCaches(): Promise<void> {
  await invalidateCache(
    CACHE_KEYS.PROJECTS,
    CACHE_KEYS.PROJECTS_TEAMS,
    CACHE_KEYS.PROJECTS_PMS,
    CACHE_KEYS.PROJECTS_TASKS
  );
}

// ===========================
// FUNÇÕES DE BUSCA
// ===========================

/**
 * Busca todos os membros da equipe (perfis)
 * Usado para popular dropdowns e seleções de membros
 */
export async function fetchTeamMembers(): Promise<ProjectMember[]> {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, nome, avatar_url, cargo')
      .order('nome', { ascending: true });

    if (error) {
      console.error('[TEAM MEMBERS] Erro ao buscar perfis:', error);
      throw error;
    }

    if (!profiles || profiles.length === 0) {
      return [];
    }

    // ✅ CORREÇÃO: Não substituir avatar_url por URL genérica
    // Deixar vazio quando não houver avatar - o componente UserAvatar faz o fallback
    const members: ProjectMember[] = profiles.map((profile) => ({
      id: profile.id,
      profile_id: profile.id,
      nome: profile.nome || 'Sem nome',
      avatar: profile.avatar_url || '', // ✅ Deixar vazio em vez de URL genérica
      cargo: profile.cargo || 'Membro',
    }));

    return members;
  } catch (err) {
    console.error('[TEAM MEMBERS] Erro ao buscar membros:', err);
    return [];
  }
}

/**
 * Busca lista simplificada de projetos (apenas id e nome)
 * Usado para popular dropdowns de projetos agregados
 */
export async function fetchProjectsList(): Promise<Array<{ id: string; nome: string }>> {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, nome')
      .order('nome', { ascending: true });

    if (error) {
      console.error('[PROJECTS LIST] Erro ao buscar projetos:', error);
      throw error;
    }

    if (!projects || projects.length === 0) {
      return [];
    }

    return projects;
  } catch (err) {
    console.error('[PROJECTS LIST] Erro ao buscar lista de projetos:', err);
    return [];
  }
}

/**
 * ✅ OTIMIZADO: Busca todos os projetos com UMA ÚNICA QUERY usando JOINs
 * Reduz drasticamente o número de requisições ao banco
 */
export async function fetchProjects(): Promise<Project[]> {
  try {
    // ✅ UMA ÚNICA QUERY com todos os relacionamentos
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        *,
        project_members (
          profile_id,
          nome,
          avatar,
          cargo
        ),
        project_product_manager (
          member_id
        ),
        project_sprints (
          id,
          name,
          start_date,
          end_date,
          members,
          status,
          sprint_order
        ),
        project_links (
          title,
          url
        ),
        project_entregaveis (
          nome
        ),
        project_sector_contacts (
          id,
          sigla,
          nome_setor,
          sector_contact_persons (
            nome,
            email,
            telefone
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (projectsError) {
      console.error('[PROJECTS SERVICE] Erro ao buscar projetos:', projectsError);
      throw projectsError;
    }

    if (!projects || projects.length === 0) {
      return [];
    }

    // ✅ Buscar tarefas em uma única query
    const projectIds = projects.map(p => p.id);
    const { data: allTasks } = await supabase
      .from('tasks')
      .select('project_id, status')
      .in('project_id', projectIds);

    // ✅ Processar dados localmente (muito mais rápido que múltiplas queries)
    const projectsWithRelations = projects.map((project) => {
      // Membros
      const equipe: ProjectMember[] = (project.project_members || []).map((m: any) => ({
        id: m.profile_id,
        profile_id: m.profile_id,
        nome: m.nome || 'Sem nome',
        avatar: m.avatar || '',
        cargo: m.cargo || 'Membro',
      }));

      // Product Manager
      const pm = project.project_product_manager?.[0];
      const productManager = pm?.member_id || undefined;

      // Sprints — ✅ INCLUIR start_date
      const sprints: ProjectSprint[] = (project.project_sprints || [])
        .sort((a: any, b: any) => (a.sprint_order || 0) - (b.sprint_order || 0))
        .map((s: any) => {
          const mapped = {
            id: s.id,
            name: s.name,
            startDate: s.start_date,
            endDate: s.end_date,
            members: s.members || [],
            status: s.status,
          };
          return mapped;
        });

      // Links
      const links: ProjectLink[] = (project.project_links || []).map((l: any) => ({
        title: l.title,
        url: l.url,
      }));

      // Entregáveis
      const entregaveis: ProjectEntregavel[] = (project.project_entregaveis || []).map((e: any) => ({
        nome: e.nome,
      }));

      // Contatos de setores
      const sectorContacts: ProjectSectorContact[] = (project.project_sector_contacts || []).map((sc: any) => ({
        id: sc.id,
        sigla: sc.sigla,
        nome_setor: sc.nome_setor,
        contatos: (sc.sector_contact_persons || []).map((p: any) => ({
          nome: p.nome,
          email: p.email,
          telefone: p.telefone,
        })),
      }));

      // Tarefas do projeto
      const tasks = allTasks?.filter((t: any) => t.project_id === project.id) || [];
      const total_tarefas = tasks.length;
      const tarefas_concluidas = tasks.filter((t: any) => t.status === 'feito').length;

      return {
        ...project,
        equipe,
        productManager,
        sprints,
        links,
        entregaveis,
        sectorContacts,
        total_tarefas,
        tarefas_concluidas,
      } as Project;
    });
    
    return projectsWithRelations;
  } catch (error) {
    console.error('[PROJECTS SERVICE] Erro fatal:', error);
    throw error;
  }
}

// ===========================
// FUNÇÕES DE CRIAÇÃO
// ===========================

/**
 * Cria um novo projeto com todos os relacionamentos
 */
export async function createProject(project: Project): Promise<{ id: string } | null> {
  try {
    // 1. Autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[CREATE PROJECT] Erro de autenticação');
      throw new Error('Usuário não autenticado');
    }

    // 2. Criar projeto principal
    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .insert({
        nome: project.nome,
        descricao: project.descricao,
        status: project.status,
        prioridade: project.prioridade,
        progresso: project.progresso || 0,
        prazo: project.prazo,
        kanban_stage: project.kanban_stage,
        cor: project.cor,
        data_inicio: project.data_inicio,
        deadline: project.deadline,
        agregado: project.agregado,
        observacoes: project.observacoes,
        tarefas_concluidas: 0,
        total_tarefas: 0,
        privado: project.privado || false,
        user_id: user.id,
      })
      .select()
      .single();

    if (projectError || !newProject) {
      console.error('[CREATE PROJECT] Erro ao criar projeto:', projectError);
      throw projectError;
    }

    const projectId = newProject.id;

    // 3. Criar relacionamentos em paralelo
    const relationshipPromises: Promise<any>[] = [];

    // Membros da equipe
    if (project.equipe && project.equipe.length > 0) {
      const membersPromise = supabase
        .from('project_members')
        .insert(
          project.equipe.map((member) => ({
            project_id: projectId,
            profile_id: member.profile_id || member.id,
            nome: member.nome,
            avatar: member.avatar,
            cargo: member.cargo,
          }))
        );
      relationshipPromises.push(membersPromise);
    }

    // Links
    if (project.links && project.links.length > 0) {
      const linksPromise = supabase
        .from('project_links')
        .insert(
          project.links.map((link) => ({
            project_id: projectId,
            title: link.title,
            url: link.url,
          }))
        );
      relationshipPromises.push(linksPromise);
    }

    // Entregáveis
    if (project.entregaveis && project.entregaveis.length > 0) {
      const entregaveisPromise = supabase
        .from('project_entregaveis')
        .insert(
          project.entregaveis.map((entregavel) => ({
            project_id: projectId,
            nome: entregavel.nome,
          }))
        );
      relationshipPromises.push(entregaveisPromise);
    }

    // Product Manager
    if (project.productManager) {
      const pmPromise = supabase
        .from('project_product_manager')
        .insert({
          project_id: projectId,
          member_id: project.productManager,
        });
      relationshipPromises.push(pmPromise);
    }

    // Sprints
    if (project.sprints && project.sprints.length > 0) {
      const sprintsPromise = Promise.all(
        project.sprints.map(async (sprint, index) => {
          const payload = {
            project_id: projectId,
            name: sprint.name,
            start_date: formatDateForDB(sprint.startDate),
            end_date: formatDateForDB(sprint.endDate),
            members: sprint.members,
            status: sprint.status,
            sprint_order: index + 1,
          };
          console.log('🔵 ENVIANDO AO BANCO (CREATE - INSERT):', { start_date: payload.start_date, tipo: typeof payload.start_date, startDate_original: sprint.startDate });
          const { data: newSprint, error: sprintError } = await supabase
            .from('project_sprints')
            .insert(payload)
            .select()
            .single();

          if (sprintError) throw sprintError;

          // Tarefas da sprint
          if (sprint.tarefas && sprint.tarefas.length > 0 && newSprint) {
            await supabase
              .from('sprint_tasks')
              .insert(
                sprint.tarefas.map((task) => ({
                  sprint_id: newSprint.id,
                  titulo: task.titulo,
                  status: task.status,
                  responsavel: task.responsavel,
                }))
              );
          }
        })
      );
      relationshipPromises.push(sprintsPromise);
    }

    // Contatos de setores
    if (project.sectorContacts && project.sectorContacts.length > 0) {
      const sectorsPromise = Promise.all(
        project.sectorContacts.map(async (sector) => {
          const { data: newSector, error: sectorError } = await supabase
            .from('project_sector_contacts')
            .insert({
              project_id: projectId,
              sigla: sector.sigla,
              nome_setor: sector.nome_setor,
            })
            .select()
            .single();

          if (sectorError) throw sectorError;

          // Contatos do setor
          if (sector.contatos && sector.contatos.length > 0 && newSector) {
            await supabase
              .from('sector_contact_persons')
              .insert(
                sector.contatos.map((person) => ({
                  sector_contact_id: newSector.id,
                  nome: person.nome,
                  email: person.email,
                  telefone: person.telefone,
                }))
              );
          }
        })
      );
      relationshipPromises.push(sectorsPromise);
    }

    // Executar todos os relacionamentos em paralelo
    await Promise.all(relationshipPromises);

    // Invalidar cache
    await invalidateProjectCaches();

    return { id: projectId };
  } catch (error: any) {
    console.error('[CREATE PROJECT] Erro ao criar projeto:', error);
    throw error;
  }
}

// ===========================
// FUNÇÕES DE ATUALIZAÇÃO
// ===========================

export async function updateProject(projectId: string, project: Partial<Project>): Promise<void> {
  try {
    // ✅ SOLUÇÃO DEFINITIVA: Pegar usuário da sessão local (SÍNCRONO)
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      console.error('[UPDATE PROJECT] Usuário não autenticado');
      throw new Error('Usuário não autenticado');
    }
    
    const user = session.user;

    // Validação antecipada (fail-fast)
    if (!project.nome || project.nome.trim() === '') {
      console.error('[UPDATE PROJECT] Nome do projeto é obrigatório');
      throw new Error('Nome do projeto é obrigatório');
    }

    // ✅ FASE 1: Verificar permissões
    const permissions = await canUserManageProject(user.id, projectId);
    
    if (!permissions.canManage) {
      console.error('[UPDATE PROJECT] Sem permissão para editar');
      throw new Error('Sem permissão para editar este projeto');
    }

    // ✅ FASE 2: Atualizar dados principais do projeto
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        nome: project.nome,
        descricao: project.descricao,
        status: project.status,
        prioridade: project.prioridade,
        progresso: project.progresso,
        prazo: project.prazo,
        kanban_stage: project.kanban_stage,
        cor: project.cor,
        data_inicio: project.data_inicio,
        deadline: project.deadline,
        agregado: project.agregado,
        observacoes: project.observacoes,
        tarefas_concluidas: project.tarefas_concluidas,
        total_tarefas: project.total_tarefas,
        privado: project.privado,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('[UPDATE PROJECT] Erro ao atualizar dados principais:', updateError);
      throw updateError;
    }

    // ✅ FASE 3: Atualizar relacionamentos em paralelo (SEM TIMEOUT)
    const relationshipUpdates: Promise<any>[] = [];

    // Membros da equipe
    if (project.equipe !== undefined) {
      const validMembers = project.equipe.filter(member => {
        const hasValidId = !!(member.profile_id || member.id);
        if (!hasValidId) {
          console.warn('[UPDATE PROJECT] Membro sem ID válido ignorado:', member.nome);
        }
        return hasValidId;
      });

      const membersUpdate = async () => {
        try {
          const { error: deleteError } = await supabase
            .from('project_members')
            .delete()
            .eq('project_id', projectId);
          
          if (deleteError) {
            console.error('[UPDATE PROJECT] Erro ao deletar membros:', deleteError);
            throw deleteError;
          }
          
          if (validMembers.length > 0) {
            const membersToInsert = validMembers.map((member) => ({
              project_id: projectId,
              profile_id: member.profile_id || member.id,
              nome: member.nome || 'Sem nome',
              avatar: member.avatar || '',
              cargo: member.cargo || 'Membro'
            }));
            
            const { error: insertError } = await supabase
              .from('project_members')
              .insert(membersToInsert);
            
            if (insertError) {
              console.error('[UPDATE PROJECT] Erro ao inserir membros:', insertError);
              throw insertError;
            }
          }
        } catch (err: any) {
          console.error('[UPDATE PROJECT] ERRO ao atualizar membros:', err);
          throw new Error('Erro ao atualizar membros: ' + err.message);
        }
      };
      
      relationshipUpdates.push(membersUpdate());
    }

    // Links
    if (project.links !== undefined) {
      const linksUpdate = async () => {
        try {
          const { error: deleteError } = await supabase
            .from('project_links')
            .delete()
            .eq('project_id', projectId);
          
          if (deleteError) {
            console.error('[UPDATE PROJECT] Erro ao deletar links:', deleteError);
            throw deleteError;
          }
          
          if (project.links && project.links.length > 0) {
            const { error: insertError } = await supabase
              .from('project_links')
              .insert(
                project.links.map((link) => ({
                  project_id: projectId,
                  title: link.title,
                  url: link.url
                }))
              );
            
            if (insertError) {
              console.error('[UPDATE PROJECT] Erro ao inserir links:', insertError);
              throw insertError;
            }
          }
        } catch (err: any) {
          console.error('[UPDATE PROJECT] ERRO ao atualizar links:', err);
          throw new Error('Erro ao atualizar links: ' + err.message);
        }
      };
      
      relationshipUpdates.push(linksUpdate());
    }

    // Entregáveis
    if (project.entregaveis !== undefined) {
      const entregaveisUpdate = async () => {
        try {
          const { error: deleteError } = await supabase
            .from('project_entregaveis')
            .delete()
            .eq('project_id', projectId);
          
          if (deleteError) {
            console.error('[UPDATE PROJECT] Erro ao deletar entregáveis:', deleteError);
            throw deleteError;
          }
          
          if (project.entregaveis && project.entregaveis.length > 0) {
            const { error: insertError } = await supabase
              .from('project_entregaveis')
              .insert(
                project.entregaveis.map((entregavel) => ({
                  project_id: projectId,
                  nome: entregavel.nome
                }))
              );
            
            if (insertError) {
              console.error('[UPDATE PROJECT] Erro ao inserir entregáveis:', insertError);
              throw insertError;
            }
          }
        } catch (err: any) {
          console.error('[UPDATE PROJECT] ERRO ao atualizar entregáveis:', err);
          throw new Error('Erro ao atualizar entregáveis: ' + err.message);
        }
      };
      
      relationshipUpdates.push(entregaveisUpdate());
    }

    // Product Manager
    if (project.productManager !== undefined) {
      const pmUpdate = async () => {
        try {
          const { error: deleteError } = await supabase
            .from('project_product_manager')
            .delete()
            .eq('project_id', projectId);
          
          if (deleteError) {
            console.error('[UPDATE PROJECT] Erro ao deletar PM:', deleteError);
            throw deleteError;
          }
          
          if (project.productManager) {
            const { error: insertError } = await supabase
              .from('project_product_manager')
              .insert({
                project_id: projectId,
                member_id: project.productManager
              });
            
            if (insertError) {
              console.error('[UPDATE PROJECT] Erro ao inserir PM:', insertError);
              throw insertError;
            }
          }
        } catch (err: any) {
          console.error('[UPDATE PROJECT] ERRO ao atualizar PM:', err);
          throw new Error('Erro ao atualizar Product Manager: ' + err.message);
        }
      };
      
      relationshipUpdates.push(pmUpdate());
    }

    // Sprints
    if (project.sprints !== undefined) {
      const sprintsUpdate = async () => {
        try {
          // ✅ CORREÇÃO CRÍTICA: Preservar IDs das sprints existentes
          // Deletar e recriar sprints quebra o sprint_id das tarefas vinculadas
          
          // 1. Buscar sprints existentes do projeto
          const { data: existingSprints, error: fetchError } = await supabase
            .from('project_sprints')
            .select('id, name, sprint_order')
            .eq('project_id', projectId)
            .order('sprint_order', { ascending: true });

          if (fetchError) throw fetchError;

          const existingMap = new Map<string, string>(); // name -> id
          (existingSprints || []).forEach((s: any) => {
            existingMap.set(s.name, s.id);
          });

          const existingIds = new Set((existingSprints || []).map((s: any) => s.id));
          const newSprintIds = new Set<string>();

          if (project.sprints && project.sprints.length > 0) {
            for (let i = 0; i < project.sprints.length; i++) {
              const sprint = project.sprints[i];
              
              // Verificar se a sprint tem id próprio (vinda do banco)
              const sprintWithId = sprint as any;
              const existingId = sprintWithId.id || existingMap.get(sprint.name);

              if (existingId && existingIds.has(existingId)) {
                // ✅ Sprint já existe: apenas atualizar sem mudar o ID
                const updatePayload = {
                  name: sprint.name,
                  start_date: formatDateForDB(sprint.startDate),
                  end_date: formatDateForDB(sprint.endDate),
                  members: sprint.members,
                  status: sprint.status,
                  sprint_order: i + 1,
                };
                console.log('🔵 ENVIANDO AO BANCO (UPDATE):', { start_date: updatePayload.start_date, tipo: typeof updatePayload.start_date, startDate_original: sprint.startDate });
                const { error: updateError } = await supabase
                  .from('project_sprints')
                  .update(updatePayload)
                  .eq('id', existingId);

                if (updateError) throw updateError;
                newSprintIds.add(existingId);
              } else {
                // ✅ Sprint nova: inserir com novo ID
                const insertPayload = {
                  project_id: projectId,
                  name: sprint.name,
                  start_date: formatDateForDB(sprint.startDate),
                  end_date: formatDateForDB(sprint.endDate),
                  members: sprint.members,
                  status: sprint.status,
                  sprint_order: i + 1,
                };
                console.log('🔵 ENVIANDO AO BANCO (UPDATE - INSERT nova sprint):', { start_date: insertPayload.start_date, tipo: typeof insertPayload.start_date, startDate_original: sprint.startDate });
                const { data: newSprint, error: sprintError } = await supabase
                  .from('project_sprints')
                  .insert(insertPayload)
                  .select()
                  .single();

                if (sprintError) throw sprintError;
                newSprintIds.add(newSprint.id);

                if (sprint.tarefas && sprint.tarefas.length > 0 && newSprint) {
                  await supabase
                    .from('sprint_tasks')
                    .insert(
                      sprint.tarefas.map((task) => ({
                        sprint_id: newSprint.id,
                        titulo: task.titulo,
                        status: task.status,
                        responsavel: task.responsavel,
                      }))
                    );
                }
              }
            }
          }

          // ✅ Remover apenas sprints que foram excluídas pelo usuário
          // (não estão mais na lista nova)
          const sprintsToDelete = Array.from(existingIds).filter(
            (id) => !newSprintIds.has(id)
          );

          if (sprintsToDelete.length > 0) {
            // Desvincular tarefas antes de deletar a sprint
            await supabase
              .from('tasks')
              .update({ sprint_id: null })
              .in('sprint_id', sprintsToDelete);

            await supabase
              .from('project_sprints')
              .delete()
              .in('id', sprintsToDelete);
          }
        } catch (err: any) {
          console.error('[UPDATE PROJECT] ERRO ao atualizar sprints:', err);
          throw new Error('Erro ao atualizar sprints: ' + err.message);
        }
      };
      
      relationshipUpdates.push(sprintsUpdate());
    }

    // Contatos de setores
    if (project.sectorContacts !== undefined) {
      const sectorsUpdate = async () => {
        try {
          const { error: deleteError } = await supabase
            .from('project_sector_contacts')
            .delete()
            .eq('project_id', projectId);
          
          if (deleteError) {
            console.error('[UPDATE PROJECT] Erro ao deletar contatos:', deleteError);
            throw deleteError;
          }
          
          if (project.sectorContacts && project.sectorContacts.length > 0) {
            for (const sector of project.sectorContacts) {
              const { data: newSector, error: sectorError } = await supabase
                .from('project_sector_contacts')
                .insert({
                  project_id: projectId,
                  sigla: sector.sigla,
                  nome_setor: sector.nome_setor
                })
                .select()
                .single();

              if (sectorError) {
                console.error('[UPDATE PROJECT] Erro ao criar setor:', sectorError);
                throw sectorError;
              }

              if (sector.contatos && sector.contatos.length > 0 && newSector) {
                const { error: personsError } = await supabase
                  .from('sector_contact_persons')
                  .insert(
                    sector.contatos.map((person) => ({
                      sector_contact_id: newSector.id,
                      nome: person.nome,
                      email: person.email,
                      telefone: person.telefone
                    }))
                  );
                
                if (personsError) {
                  console.error('[UPDATE PROJECT] Erro ao criar contatos:', personsError);
                  throw personsError;
                }
              }
            }
          }
        } catch (err: any) {
          console.error('[UPDATE PROJECT] ERRO ao atualizar contatos:', err);
          throw new Error('Erro ao atualizar contatos de setores: ' + err.message);
        }
      };
      
      relationshipUpdates.push(sectorsUpdate());
    }

    // ✅ Executar TODAS as operações em PARALELO
    if (relationshipUpdates.length > 0) {
      await Promise.all(relationshipUpdates);
    }

    // ❌ REMOVIDO: Invalidação automática de cache (causava loop infinito)
    // O modal agora controla quando invalidar o cache
  } catch (error: any) {
    console.error('[UPDATE PROJECT] ERRO FATAL ao atualizar projeto:', error);
    console.error('[UPDATE PROJECT] Mensagem:', error.message);
    throw error;
  }
}

// ===========================
// FUNÇÕES DE EXCLUSÃO
// ===========================

/**
 * Exclui um projeto e todos os seus relacionamentos
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    // 1. Autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[DELETE PROJECT] Erro de autenticação');
      throw new Error('Usuário não autenticado');
    }

    // 2. Verificar permissões
    const permissions = await canUserManageProject(user.id, projectId);
    
    if (!permissions.canManage) {
      console.error('[DELETE PROJECT] Sem permissão para excluir');
      throw new Error(permissions.reason || 'Sem permissão para excluir este projeto');
    }

    // 3. Excluir projeto (CASCADE vai deletar relacionamentos automaticamente)
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (deleteError) {
      console.error('[DELETE PROJECT] Erro ao deletar projeto:', deleteError);
      throw deleteError;
    }

    // 4. Invalidar cache
    await invalidateProjectCaches();
  } catch (error: any) {
    console.error('[DELETE PROJECT] Erro ao excluir projeto:', error);
    throw error;
  }
}

// ===========================
// FUNÇÕES DE SINCRONIZAÇÃO
// ===========================

/**
 * Sincroniza os dados do perfil do usuário em todos os project_members
 * Atualiza nome, avatar e cargo em todos os projetos onde o usuário é membro
 */
export async function syncProfileToProjectMembers(
  userId: string,
  nome: string,
  avatarUrl: string | null,
  cargo: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('project_members')
      .update({
        nome: nome,
        avatar: avatarUrl || '',
        cargo: cargo,
      })
      .eq('profile_id', userId);

    if (error) {
      console.error('[SYNC] Erro ao sincronizar project_members:', error);
      throw error;
    }
  } catch (err) {
    console.error('[SYNC] Erro ao sincronizar perfil em project_members:', err);
    throw err;
  }
}

/**
 * Sincroniza os dados do perfil do usuário em todos os task_comments
 * Atualiza nome e avatar em todos os comentários do usuário
 */
export async function syncProfileToTaskComments(
  userId: string,
  nome: string,
  avatarUrl: string | null
): Promise<void> {
  try {
    const { error } = await supabase
      .from('task_comments')
      .update({
        autor_nome: nome,
        autor_avatar: avatarUrl || '',
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[SYNC] Erro ao sincronizar task_comments:', error);
      throw error;
    }
  } catch (err) {
    console.error('[SYNC] Erro ao sincronizar perfil em task_comments:', err);
    throw err;
  }
}
