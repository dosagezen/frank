import { supabase } from '../lib/supabaseClient';
import { safeFetchMany, safeFetchOne, getCurrentUser } from './supabaseHelpers';

export interface TeamMember {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  departamento: string;
  avatar_url: string | null;
  telefone: string | null;
  localizacao: string | null;
  bio: string | null;
  role: string;
  created_at: string;
  aniversario?: string | null;
  tarefas_ativas?: number;
  projetos?: string[];
  projetos_count?: number;
}

export interface MemberWithStats extends TeamMember {
  tarefas_ativas: number;
  projetos: { id: string; nome: string }[];
  projetos_count: number;
}

// Tipo para projetos retornados pela função fetchMemberProjects
export interface MemberProject {
  id: string;
  nome: string;
}

/**
 * Busca projetos de um membro específico
 * CORRIGIDO: Evita recursão RLS usando queries separadas ao invés de joins
 */
export async function fetchMemberProjects(memberId: string): Promise<MemberProject[]> {
  try {
    const projectsMap = new Map<string, { id: string; nome: string }>();

    // 1. Buscar projetos criados pelo membro (sem join)
    const ownedProjects = await safeFetchMany(() =>
      supabase
        .from('projects')
        .select('id, nome')
        .eq('user_id', memberId)
    );

    ownedProjects.forEach((project: any) => {
      projectsMap.set(project.id, { id: project.id, nome: project.nome });
    });

    // 2. Buscar IDs de projetos onde o membro participa
    const membershipData = await safeFetchMany(() =>
      supabase
        .from('project_members')
        .select('project_id')
        .eq('profile_id', memberId)
    );

    const memberProjectIds = membershipData.map((m: any) => m.project_id).filter(Boolean);

    // 3. Se houver projetos onde é membro, buscar os dados desses projetos
    if (memberProjectIds.length > 0) {
      const memberProjects = await safeFetchMany(() =>
        supabase
          .from('projects')
          .select('id, nome')
          .in('id', memberProjectIds)
      );

      memberProjects.forEach((project: any) => {
        projectsMap.set(project.id, { id: project.id, nome: project.nome });
      });
    }

    return Array.from(projectsMap.values());
  } catch (error) {
    console.error('❌ Erro ao buscar projetos do membro:', error);
    return [];
  }
}

/**
 * Busca emails dos membros via Edge Function (acesso seguro ao auth.users)
 */
async function fetchAuthEmailMap(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(
      'https://bomjvzfvsascqnxsspdb.supabase.co/functions/v1/get-team-emails',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) return {};

    const json = await response.json();
    return json.emailMap || {};
  } catch (error) {
    console.warn('Não foi possível buscar emails via Edge Function:', error);
    return {};
  }
}

/**
 * Busca todos os membros da equipe
 */
export async function fetchAllMembers(): Promise<TeamMember[]> {
  const profiles = await safeFetchMany(() =>
    supabase
      .from('profiles')
      .select('*')
      .order('nome', { ascending: true })
  );

  // Buscar mapa de emails via Edge Function
  const emailMap = await fetchAuthEmailMap();

  // Preencher emails ausentes com os dados do auth
  const profilesWithEmail = profiles.map((profile: any) => {
    if (!profile.email && emailMap[profile.id]) {
      return { ...profile, email: emailMap[profile.id] };
    }
    return profile;
  });

  return profilesWithEmail;
}

/**
 * Busca um membro específico com estatísticas
 */
export async function fetchMemberWithStats(memberId: string): Promise<MemberWithStats | null> {
  try {
    // Buscar dados do membro
    const member = await safeFetchOne(() =>
      supabase
        .from('profiles')
        .select('*')
        .eq('id', memberId)
        .maybeSingle()
    );

    if (!member) return null;

    // Buscar contagem de tarefas ativas (com tratamento de erro)
    const { count: tarefasCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('responsavel_id', memberId)
      .neq('status', 'concluida');

    // Buscar projetos do membro
    const projetos = await fetchMemberProjects(memberId);

    return {
      ...member,
      tarefas_ativas: tarefasCount || 0,
      projetos,
      projetos_count: projetos.length
    };
  } catch (error) {
    console.error('Erro ao buscar membro com estatísticas:', error);
    return null;
  }
}

/**
 * Busca todos os membros com estatísticas
 * OTIMIZADO: Reduz queries usando batch operations
 */
export async function fetchAllMembersWithStats(): Promise<MemberWithStats[]> {
  try {
    const members = await fetchAllMembers();

    if (members.length === 0) return [];

    const memberIds = members.map(m => m.id);

    // Buscar contagem de tarefas para todos os membros de uma vez
    const tasksCountPromises = memberIds.map(async (memberId) => {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('responsavel_id', memberId)
        .neq('status', 'concluida');

      return { memberId, count: count || 0 };
    });

    const tasksCounts = await Promise.all(tasksCountPromises);
    const tasksCountMap = new Map(tasksCounts.map(tc => [tc.memberId, tc.count]));

    // Buscar tarefas concluídas para todos os membros
    const completedTasksPromises = memberIds.map(async (memberId) => {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('responsavel_id', memberId)
        .eq('status', 'concluida');

      return { memberId, count: count || 0 };
    });

    const completedTasksCounts = await Promise.all(completedTasksPromises);
    const completedTasksMap = new Map(completedTasksCounts.map(tc => [tc.memberId, tc.count]));

    // Buscar projetos para todos os membros em paralelo
    const projectsPromises = memberIds.map(async (memberId) => {
      const projetos = await fetchMemberProjects(memberId);
      return { memberId, projetos };
    });

    const projectsResults = await Promise.all(projectsPromises);
    const projectsMap = new Map(projectsResults.map(pr => [pr.memberId, pr.projetos]));

    // Montar resultado final
    const membersWithStats: MemberWithStats[] = members.map((member) => {
      const projetos = projectsMap.get(member.id) || [];
      return {
        ...member,
        tarefas_ativas: tasksCountMap.get(member.id) || 0,
        completedTasks: completedTasksMap.get(member.id) || 0,
        projetos,
        projetos_count: projetos.length
      };
    });

    return membersWithStats;
  } catch (error) {
    console.error('Erro ao buscar membros com estatísticas:', error);
    return [];
  }
}

/**
 * Convida/adiciona um novo membro à equipe
 */
export async function inviteMember(memberData: {
  email: string;
  nome: string;
  cargo: string;
  departamento?: string;
  telefone?: string;
}): Promise<{ success: boolean; message: string; member?: TeamMember }> {
  try {
    // Verificar se o email já existe
    const existingUser = await safeFetchOne(() =>
      supabase
        .from('profiles')
        .select('email')
        .eq('email', memberData.email)
        .maybeSingle()
    );

    if (existingUser) {
      return {
        success: false,
        message: 'Este email já está cadastrado no sistema.'
      };
    }

    // Criar perfil diretamente na tabela profiles com status pendente
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert([
        {
          email: memberData.email,
          nome: memberData.nome,
          cargo: memberData.cargo,
          departamento: memberData.departamento || '',
          telefone: memberData.telefone || '',
          role: 'member',
          status: 'pendente',
        }
      ])
      .select()
      .maybeSingle();

    if (insertError) {
      console.error('Erro ao criar perfil:', insertError);
      throw new Error(insertError.message || 'Erro ao criar perfil do membro');
    }

    return {
      success: true,
      message: 'Membro adicionado com sucesso! Ele poderá criar sua conta com este email.',
      member: newProfile ?? undefined
    };
  } catch (error: any) {
    console.error('Erro ao convidar membro:', error);
    return {
      success: false,
      message: error.message || 'Erro ao adicionar membro. Tente novamente.'
    };
  }
}

/**
 * Atualiza informações de um membro
 */
export async function updateMember(
  memberId: string,
  updates: Partial<TeamMember>
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', memberId);

    if (error) throw error;

    return {
      success: true,
      message: 'Membro atualizado com sucesso!'
    };
  } catch (error: any) {
    console.error('Erro ao atualizar membro:', error);
    return {
      success: false,
      message: error.message || 'Erro ao atualizar membro.'
    };
  }
}

/**
 * Remove um membro da equipe
 */
export async function removeMember(memberId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', memberId);

    if (error) throw error;

    return {
      success: true,
      message: 'Membro removido com sucesso!'
    };
  } catch (error: any) {
    console.error('Erro ao remover membro:', error);
    return {
      success: false,
      message: error.message || 'Erro ao remover membro.'
    };
  }
}

/**
 * Gera iniciais do nome para avatar
 */
export function getInitials(nome: string): string {
  if (!nome || typeof nome !== 'string') return '?';
  
  const parts = nome.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Gera cor de avatar baseada no nome
 */
export function getAvatarColor(nome: string): string {
  // Validação: retorna cor padrão se nome for inválido
  if (!nome || typeof nome !== 'string' || nome.trim() === '') {
    return 'bg-gray-500';
  }

  const colors = [
    'bg-teal-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-green-500',
    'bg-indigo-500',
    'bg-red-500'
  ];
  
  const index = nome.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}
