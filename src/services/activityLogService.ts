
import { supabase } from '../lib/supabaseClient';

export interface ActivityLog {
  id: string;
  project_id: string;
  user_id: string;
  action_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
  user_nome?: string;
  user_avatar?: string | null;
}

type FieldLabelMap = Record<string, string>;

const FIELD_LABELS: FieldLabelMap = {
  nome: 'Nome',
  descricao: 'Descrição',
  status: 'Status',
  prioridade: 'Prioridade',
  kanban_stage: 'Etapa do Kanban',
  cor: 'Cor',
  data_inicio: 'Data de Início',
  prazo: 'Data de Término',
  deadline: 'Deadline',
  agregado: 'Agregado',
  equipe: 'Equipe',
  productManager: 'Product Manager',
  sprints: 'Sprints',
  links: 'Links',
  entregaveis: 'Entregáveis',
  sectorContacts: 'Setores Demandantes',
};

const STATUS_LABELS: Record<string, string> = {
  'nao-iniciado': 'Não Iniciado',
  'em-andamento': 'Em Andamento',
  'parado': 'Parado',
  'concluido': 'Concluído',
};

const PRIORITY_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

const KANBAN_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  desafio: 'Desafio',
  persona: 'Persona',
  'proposta-valor': 'Proposta de Valor',
  validacao: 'Validação',
  mvp: 'MVP',
};

function formatValue(
  field: string,
  value: string | null | undefined
): string {
  if (!value) return '(vazio)';
  if (field === 'status') return STATUS_LABELS[value] || value;
  if (field === 'prioridade') return PRIORITY_LABELS[value] || value;
  if (field === 'kanban_stage') return KANBAN_LABELS[value] || value;
  if (
    field === 'data_inicio' ||
    field === 'prazo' ||
    field === 'deadline'
  ) {
    try {
      return new Date(value).toLocaleDateString('pt-BR');
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Registra a criação de um projeto
 */
export async function logProjectCreated(
  projectId: string,
  projectName: string
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    await supabase.from('project_activity_log').insert({
      project_id: projectId,
      user_id: user.id,
      action_type: 'created',
      description: `Criou o projeto "${projectName}"`,
      metadata: { project_name: projectName },
    });
  } catch (err) {
    console.error('[ACTIVITY LOG] Erro ao registrar criação:', err);
  }
}

/**
 * Compara projeto antigo com novo e registra todas as alterações
 */
export async function logProjectChanges(
  projectId: string,
  oldProject: Record<string, any>,
  newProject: Record<string, any>,
  profilesMap?: Map<string, string>
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    const logs: Array<{
      project_id: string;
      user_id: string;
      action_type: string;
      field_name: string;
      old_value: string | null;
      new_value: string | null;
      description: string;
      metadata: Record<string, any>;
    }> = [];

    // Campos simples para comparar
    const simpleFields = [
      'nome',
      'descricao',
      'status',
      'prioridade',
      'kanban_stage',
      'cor',
      'data_inicio',
      'prazo',
      'deadline',
      'agregado',
    ];

    for (const field of simpleFields) {
      const oldVal = oldProject[field] ?? '';
      const newVal = newProject[field] ?? '';
      if (oldVal !== newVal) {
        const label = FIELD_LABELS[field] || field;
        const oldFormatted = formatValue(field, oldVal);
        const newFormatted = formatValue(field, newVal);
        logs.push({
          project_id: projectId,
          user_id: user.id,
          action_type: 'updated',
          field_name: field,
          old_value: oldVal || null,
          new_value: newVal || null,
          description: `Alterou ${label} de "${oldFormatted}" para "${newFormatted}"`,
          metadata: { field, old: oldVal, new: newVal },
        });
      }
    }

    // Comparar equipe (membros)
    const oldMemberIds = (oldProject.equipe || [])
      .map((m: any) => m.profile_id || m.id)
      .filter(Boolean)
      .sort();
    const newMemberIds = (newProject.equipe || [])
      .map((m: any) => m.profile_id || m.id)
      .filter(Boolean)
      .sort();

    if (JSON.stringify(oldMemberIds) !== JSON.stringify(newMemberIds)) {
      const added = newMemberIds.filter((id: string) => !oldMemberIds.includes(id));
      const removed = oldMemberIds.filter((id: string) => !newMemberIds.includes(id));

      if (added.length > 0) {
        const names = added.map((id: string) => profilesMap?.get(id) || id).join(', ');
        logs.push({
          project_id: projectId,
          user_id: user.id,
          action_type: 'member_added',
          field_name: 'equipe',
          old_value: null,
          new_value: names,
          description: `Adicionou ${added.length === 1 ? 'o membro' : 'os membros'} ${names} à equipe`,
          metadata: { added_ids: added },
        });
      }

      if (removed.length > 0) {
        const names = removed.map((id: string) => profilesMap?.get(id) || id).join(', ');
        logs.push({
          project_id: projectId,
          user_id: user.id,
          action_type: 'member_removed',
          field_name: 'equipe',
          old_value: names,
          new_value: null,
          description: `Removeu ${removed.length === 1 ? 'o membro' : 'os membros'} ${names} da equipe`,
          metadata: { removed_ids: removed },
        });
      }
    }

    // Comparar Product Manager
    const oldPM = oldProject.productManager ?? '';
    const newPM = newProject.productManager ?? '';
    if (oldPM !== newPM) {
      const oldName = oldPM ? profilesMap?.get(oldPM) || 'anterior' : '(nenhum)';
      const newName = newPM ? profilesMap?.get(newPM) || 'novo' : '(nenhum)';
      logs.push({
        project_id: projectId,
        user_id: user.id,
        action_type: 'updated',
        field_name: 'productManager',
        old_value: oldPM || null,
        new_value: newPM || null,
        description: `Alterou Product Manager de "${oldName}" para "${newName}"`,
        metadata: { old_pm: oldPM, new_pm: newPM },
      });
    }

    // Comparar sprints
    const oldSprintNames = (oldProject.sprints || [])
      .map((s: any) => s.name)
      .sort();
    const newSprintNames = (newProject.sprints || [])
      .map((s: any) => s.name)
      .sort();

    if (JSON.stringify(oldSprintNames) !== JSON.stringify(newSprintNames)) {
      const addedSprints = newSprintNames.filter((n: string) => !oldSprintNames.includes(n));
      const removedSprints = oldSprintNames.filter((n: string) => !newSprintNames.includes(n));

      if (addedSprints.length > 0) {
        logs.push({
          project_id: projectId,
          user_id: user.id,
          action_type: 'sprint_added',
          field_name: 'sprints',
          old_value: null,
          new_value: addedSprints.join(', '),
          description: `Adicionou ${addedSprints.length === 1 ? 'a sprint' : 'as sprints'}: ${addedSprints.join(', ')}`,
          metadata: { added: addedSprints },
        });
      }

      if (removedSprints.length > 0) {
        logs.push({
          project_id: projectId,
          user_id: user.id,
          action_type: 'sprint_removed',
          field_name: 'sprints',
          old_value: removedSprints.join(', '),
          new_value: null,
          description: `Removeu ${removedSprints.length === 1 ? 'a sprint' : 'as sprints'}: ${removedSprints.join(', ')}`,
          metadata: { removed: removedSprints },
        });
      }
    }

    // Comparar entregáveis
    const oldEnt = (oldProject.entregaveis || [])
      .map((e: any) => e.nome || e)
      .sort();
    const newEnt = (newProject.entregaveis || [])
      .map((e: any) => e.nome || e)
      .sort();

    if (JSON.stringify(oldEnt) !== JSON.stringify(newEnt)) {
      const addedEnt = newEnt.filter((n: string) => !oldEnt.includes(n));
      const removedEnt = oldEnt.filter((n: string) => !newEnt.includes(n));

      if (addedEnt.length > 0) {
        logs.push({
          project_id: projectId,
          user_id: user.id,
          action_type: 'entregavel_added',
          field_name: 'entregaveis',
          old_value: null,
          new_value: addedEnt.join(', '),
          description: `Adicionou ${addedEnt.length === 1 ? 'o entregável' : 'os entregáveis'}: ${addedEnt.join(', ')}`,
          metadata: { added: addedEnt },
        });
      }

      if (removedEnt.length > 0) {
        logs.push({
          project_id: projectId,
          user_id: user.id,
          action_type: 'entregavel_removed',
          field_name: 'entregaveis',
          old_value: removedEnt.join(', '),
          new_value: null,
          description: `Removeu ${removedEnt.length === 1 ? 'o entregável' : 'os entregáveis'}: ${removedEnt.join(', ')}`,
          metadata: { removed: removedEnt },
        });
      }
    }

    // Comparar links
    const oldLinks = (oldProject.links || [])
      .map((l: any) => l.title)
      .sort();
    const newLinks = (newProject.links || [])
      .map((l: any) => l.title)
      .sort();

    if (JSON.stringify(oldLinks) !== JSON.stringify(newLinks)) {
      const addedLinks = newLinks.filter((n: string) => !oldLinks.includes(n));
      const removedLinks = oldLinks.filter((n: string) => !newLinks.includes(n));

      if (addedLinks.length > 0) {
        logs.push({
          project_id: projectId,
          user_id: user.id,
          action_type: 'link_added',
          field_name: 'links',
          old_value: null,
          new_value: addedLinks.join(', '),
          description: `Adicionou ${addedLinks.length === 1 ? 'o link' : 'os links'}: ${addedLinks.join(', ')}`,
          metadata: { added: addedLinks },
        });
      }

      if (removedLinks.length > 0) {
        logs.push({
          project_id: projectId,
          user_id: user.id,
          action_type: 'link_removed',
          field_name: 'links',
          old_value: removedLinks.join(', '),
          new_value: null,
          description: `Removeu ${removedLinks.length === 1 ? 'o link' : 'os links'}: ${removedLinks.join(', ')}`,
          metadata: { removed: removedLinks },
        });
      }
    }

    // Inserir todos os logs de uma vez
    if (logs.length > 0) {
      const { error } = await supabase.from('project_activity_log').insert(logs);
      if (error) {
        console.error('[ACTIVITY LOG] Erro ao inserir logs:', error);
      } else {
        console.log(`[ACTIVITY LOG] ✅ ${logs.length} alterações registradas`);
      }
    }
  } catch (err) {
    console.error('[ACTIVITY LOG] Erro ao registrar alterações:', err);
  }
}

/**
 * Busca o histórico de atividades de um projeto
 */
export async function fetchProjectActivityLog(
  projectId: string
): Promise<ActivityLog[]> {
  try {
    const { data: logs, error } = await supabase
      .from('project_activity_log')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[ACTIVITY LOG] Erro ao buscar logs:', error);
      return [];
    }

    if (!logs || logs.length === 0) return [];

    // Buscar perfis dos usuários que fizeram as alterações
    const userIds = [...new Set(logs.map((l) => l.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nome, avatar_url')
      .in('id', userIds);

    const profilesMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    );

    return logs.map((log) => {
      const profile = profilesMap.get(log.user_id);
      return {
        ...log,
        user_nome: profile?.nome || 'Usuário',
        user_avatar: profile?.avatar_url || null,
      };
    });
  } catch (err) {
    console.error('[ACTIVITY LOG] Erro ao buscar histórico:', err);
    return [];
  }
}
