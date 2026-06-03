import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import UserAvatar from '../../../components/base/UserAvatar';

interface TeamTabProps {
  project: any;
}

interface MemberProfile {
  profile_id: string;
  nome: string;
  cargo: string;
  email: string;
  departamento: string;
  avatar_url: string | null;
  telefone: string | null;
  bio: string | null;
  isCreator: boolean;
  isPM: boolean;
}

interface MemberTaskStats {
  total: number;
  concluidas: number;
  emAndamento: number;
  pendentes: number;
  alta: number;
  media: number;
  baixa: number;
}

interface MemberWithStats extends MemberProfile {
  taskStats: MemberTaskStats;
  sprintCount: number;
}

export default function TeamTab({ project }: TeamTabProps) {
  const [members, setMembers] = useState<MemberWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [productManagerId, setProductManagerId] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (project?.id) {
      loadTeamData();
    }
  }, [project?.id]);

  const loadTeamData = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    // Timeout de segurança: 15 segundos
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && isLoadingRef.current) {
        isLoadingRef.current = false;
        setLoading(false);
        setError('Tempo limite excedido. Verifique sua conexão e tente novamente.');
      }
    }, 15000);

    try {
      // Buscar membros, PM, perfis, tarefas e sprints em paralelo
      const [membersRes, pmRes] = await Promise.all([
        supabase
          .from('project_members')
          .select('profile_id, nome, avatar, cargo')
          .eq('project_id', project.id),
        supabase
          .from('project_product_manager')
          .select('member_id')
          .eq('project_id', project.id)
          .maybeSingle(),
      ]);

      clearTimeout(timeoutId);
      if (!isMountedRef.current) return;

      if (membersRes.error) throw membersRes.error;

      const membersData = membersRes.data || [];
      const pmId = pmRes.data?.member_id || null;
      setProductManagerId(pmId);

      const profileIds = membersData.map((m: any) => m.profile_id).filter(Boolean);
      if (project.user_id && !profileIds.includes(project.user_id)) {
        profileIds.push(project.user_id);
      }

      if (profileIds.length === 0) {
        setMembers([]);
        setLoading(false);
        isLoadingRef.current = false;
        return;
      }

      // Buscar perfis, tarefas e sprints em paralelo
      const [profilesRes, tasksRes, sprintsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, nome, cargo, email, departamento, avatar_url, telefone, bio')
          .in('id', profileIds),
        supabase
          .from('tasks')
          .select('id, status, priority, responsavel_id, sprint_id')
          .eq('project_id', project.id),
        supabase
          .from('project_sprints')
          .select('id, members')
          .eq('project_id', project.id),
      ]);

      if (!isMountedRef.current) return;

      if (profilesRes.error) throw profilesRes.error;

      const profilesMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
      const tasksData = tasksRes.data || [];
      const sprintsData = sprintsRes.data || [];

      const allMemberIds = new Set<string>();
      membersData.forEach((m: any) => { if (m.profile_id) allMemberIds.add(m.profile_id); });
      if (project.user_id) allMemberIds.add(project.user_id);

      const enrichedMembers: MemberWithStats[] = Array.from(allMemberIds).map((pid) => {
        const profile = profilesMap.get(pid);
        const memberRow = membersData.find((m: any) => m.profile_id === pid);

        const memberTasks = tasksData.filter((t: any) => t.responsavel_id === pid);
        const concluidas = memberTasks.filter((t: any) =>
          ['feito', 'concluida', 'concluido', 'done'].includes(t.status)
        ).length;
        const emAndamento = memberTasks.filter((t: any) =>
          ['em-andamento', 'fazendo', 'doing'].includes(t.status)
        ).length;
        const pendentes = memberTasks.filter((t: any) =>
          ['fazer', 'pendente', 'todo'].includes(t.status)
        ).length;
        const alta = memberTasks.filter((t: any) => t.priority === 'alta').length;
        const media = memberTasks.filter((t: any) => t.priority === 'media').length;
        const baixa = memberTasks.filter((t: any) => t.priority === 'baixa').length;

        const sprintCount = sprintsData.filter((s: any) =>
          (s.members || []).includes(pid)
        ).length;

        return {
          profile_id: pid,
          nome: profile?.nome || memberRow?.nome || 'Sem nome',
          cargo: profile?.cargo || memberRow?.cargo || '',
          email: profile?.email || '',
          departamento: profile?.departamento || '',
          avatar_url: profile?.avatar_url || memberRow?.avatar || null,
          telefone: profile?.telefone || null,
          bio: profile?.bio || null,
          isCreator: pid === project.user_id,
          isPM: pid === pmId,
          taskStats: { total: memberTasks.length, concluidas, emAndamento, pendentes, alta, media, baixa },
          sprintCount,
        };
      });

      enrichedMembers.sort((a, b) => {
        if (a.isPM && !b.isPM) return -1;
        if (!a.isPM && b.isPM) return 1;
        if (a.isCreator && !b.isCreator) return -1;
        if (!a.isCreator && b.isCreator) return 1;
        return a.nome.localeCompare(b.nome);
      });

      if (isMountedRef.current) {
        setMembers(enrichedMembers);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (!isMountedRef.current) return;
      console.error('Erro ao carregar equipe:', err);
      setError('Erro ao carregar dados da equipe. Tente novamente.');
    } finally {
      if (isMountedRef.current) setLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Estatísticas globais da equipe
  const globalStats = useMemo(() => {
    const totalTasks = members.reduce((acc, m) => acc + m.taskStats.total, 0);
    const totalConcluidas = members.reduce((acc, m) => acc + m.taskStats.concluidas, 0);
    const totalEmAndamento = members.reduce((acc, m) => acc + m.taskStats.emAndamento, 0);
    const totalPendentes = members.reduce((acc, m) => acc + m.taskStats.pendentes, 0);
    const progressPercent = totalTasks > 0 ? Math.round((totalConcluidas / totalTasks) * 100) : 0;
    return { totalTasks, totalConcluidas, totalEmAndamento, totalPendentes, progressPercent };
  }, [members]);

  const getProgressColor = (stats: MemberTaskStats) => {
    if (stats.total === 0) return 0;
    return Math.round((stats.concluidas / stats.total) * 100);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-3 border-teal-200 dark:border-teal-800 border-t-teal-600 dark:border-t-teal-400 rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando equipe...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 flex items-center justify-center bg-red-100 dark:bg-red-900/20 rounded-full">
          <i className="ri-error-warning-line text-2xl text-red-500"></i>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={loadTeamData}
          className="px-4 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500 dark:text-gray-400">
        <div className="w-16 h-16 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full">
          <i className="ri-team-line text-3xl"></i>
        </div>
        <p className="text-sm font-medium">Nenhum membro na equipe</p>
        <p className="text-xs">Adicione membros ao projeto para visualizar aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Resumo Global */}
      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 border border-gray-200/60 dark:border-gray-600/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-lg">
              <i className="ri-team-line text-base text-teal-600 dark:text-teal-400"></i>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Equipe do Projeto
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {members.length} {members.length === 1 ? 'membro' : 'membros'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {members.slice(0, 5).map((m) => (
              <UserAvatar
                key={m.profile_id}
                avatarUrl={m.avatar_url}
                nome={m.nome}
                size="xs"
                className="-ml-1 first:ml-0 ring-2 ring-white dark:ring-gray-800"
              />
            ))}
            {members.length > 5 && (
              <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300 -ml-1 ring-2 ring-white dark:ring-gray-800">
                +{members.length - 5}
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div className="text-center p-2 bg-white dark:bg-gray-800/60 rounded-lg">
            <p className="text-lg font-bold text-gray-900 dark:text-white">{globalStats.totalTasks}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tarefas</p>
          </div>
          <div className="text-center p-2 bg-white dark:bg-gray-800/60 rounded-lg">
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{globalStats.totalConcluidas}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Concluídas</p>
          </div>
          <div className="text-center p-2 bg-white dark:bg-gray-800/60 rounded-lg">
            <p className="text-lg font-bold text-teal-600 dark:text-teal-400">{globalStats.totalEmAndamento}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Em Andamento</p>
          </div>
          <div className="text-center p-2 bg-white dark:bg-gray-800/60 rounded-lg">
            <p className="text-lg font-bold text-gray-600 dark:text-gray-300">{globalStats.totalPendentes}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pendentes</p>
          </div>
        </div>

        {/* Barra de progresso global */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-teal-500 dark:bg-teal-400 transition-all duration-500"
              style={{ width: `${globalStats.progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 whitespace-nowrap">
            {globalStats.progressPercent}%
          </span>
        </div>
      </div>

      {/* Lista de Membros */}
      <div className="space-y-3">
        {members.map((member) => {
          const isExpanded = expandedMember === member.profile_id;
          const progress = getProgressColor(member.taskStats);

          return (
            <div
              key={member.profile_id}
              className={`rounded-xl border transition-all duration-200 ${
                isExpanded
                  ? 'border-teal-300 dark:border-teal-600 bg-white dark:bg-gray-800 shadow-sm'
                  : 'border-gray-200/60 dark:border-gray-600/40 bg-gray-50 dark:bg-gray-700/40 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              {/* Header do membro */}
              <button
                onClick={() => setExpandedMember(isExpanded ? null : member.profile_id)}
                className="w-full flex items-center gap-3 p-3.5 cursor-pointer text-left"
              >
                <UserAvatar
                  avatarUrl={member.avatar_url}
                  nome={member.nome}
                  size="lg"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {member.nome}
                    </h4>
                    {member.isPM && (
                      <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                        PM
                      </span>
                    )}
                    {member.isCreator && (
                      <span className="px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                        Criador
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {member.cargo || 'Membro'}
                    {member.departamento ? ` · ${member.departamento}` : ''}
                  </p>
                </div>

                {/* Mini stats */}
                <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-gray-600 dark:text-gray-400">{member.taskStats.concluidas}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                    <span className="text-gray-600 dark:text-gray-400">{member.taskStats.emAndamento}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    <span className="text-gray-600 dark:text-gray-400">{member.taskStats.pendentes}</span>
                  </div>
                </div>

                {/* Mini progress bar */}
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0 w-20">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-teal-500 dark:bg-teal-400 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 w-7 text-right">
                    {progress}%
                  </span>
                </div>

                <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                  <i className="ri-arrow-down-s-line text-gray-400 dark:text-gray-500"></i>
                </div>
              </button>

              {/* Conteúdo expandido */}
              {isExpanded && (
                <div className="px-3.5 pb-3.5 pt-0 space-y-3 border-t border-gray-100 dark:border-gray-700/50 mt-0">
                  {/* Info do membro */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3">
                    {member.email && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className="ri-mail-line text-sm text-gray-400 dark:text-gray-500"></i>
                        </div>
                        <span className="truncate">{member.email}</span>
                      </div>
                    )}
                    {member.telefone && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className="ri-phone-line text-sm text-gray-400 dark:text-gray-500"></i>
                        </div>
                        <span>{member.telefone}</span>
                      </div>
                    )}
                    {member.departamento && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className="ri-building-line text-sm text-gray-400 dark:text-gray-500"></i>
                        </div>
                        <span>{member.departamento}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className="ri-stack-line text-sm text-gray-400 dark:text-gray-500"></i>
                      </div>
                      <span>{member.sprintCount} {member.sprintCount === 1 ? 'sprint' : 'sprints'}</span>
                    </div>
                  </div>

                  {member.bio && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2.5 italic">
                      {member.bio}
                    </p>
                  )}

                  {/* Estatísticas de tarefas detalhadas */}
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">
                      Tarefas neste projeto
                    </h5>

                    {member.taskStats.total === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
                        Nenhuma tarefa atribuída
                      </p>
                    ) : (
                      <>
                        {/* Barra de progresso */}
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 overflow-hidden flex">
                            {member.taskStats.concluidas > 0 && (
                              <div
                                className="h-full bg-green-500 dark:bg-green-400 transition-all"
                                style={{ width: `${(member.taskStats.concluidas / member.taskStats.total) * 100}%` }}
                              />
                            )}
                            {member.taskStats.emAndamento > 0 && (
                              <div
                                className="h-full bg-teal-500 dark:bg-teal-400 transition-all"
                                style={{ width: `${(member.taskStats.emAndamento / member.taskStats.total) * 100}%` }}
                              />
                            )}
                          </div>
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {progress}%
                          </span>
                        </div>

                        {/* Grid de stats */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800/50 rounded-md">
                            <div className="w-6 h-6 flex items-center justify-center bg-green-100 dark:bg-green-900/30 rounded">
                              <i className="ri-checkbox-circle-fill text-xs text-green-600 dark:text-green-400"></i>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">{member.taskStats.concluidas}</p>
                              <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase">Concluídas</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800/50 rounded-md">
                            <div className="w-6 h-6 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded">
                              <i className="ri-time-line text-xs text-teal-600 dark:text-teal-400"></i>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">{member.taskStats.emAndamento}</p>
                              <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase">Andamento</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800/50 rounded-md">
                            <div className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-600/50 rounded">
                              <i className="ri-checkbox-blank-circle-line text-xs text-gray-500 dark:text-gray-400"></i>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">{member.taskStats.pendentes}</p>
                              <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase">Pendentes</p>
                            </div>
                          </div>
                        </div>

                        {/* Prioridades */}
                        {(member.taskStats.alta > 0 || member.taskStats.media > 0 || member.taskStats.baixa > 0) && (
                          <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-gray-200/60 dark:border-gray-600/30">
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Prioridade:</span>
                            {member.taskStats.alta > 0 && (
                              <div className="flex items-center gap-1">
                                <i className="ri-arrow-up-line text-xs text-red-500"></i>
                                <span className="text-[10px] font-medium text-red-600 dark:text-red-400">{member.taskStats.alta} alta</span>
                              </div>
                            )}
                            {member.taskStats.media > 0 && (
                              <div className="flex items-center gap-1">
                                <i className="ri-arrow-right-line text-xs text-amber-500"></i>
                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">{member.taskStats.media} média</span>
                              </div>
                            )}
                            {member.taskStats.baixa > 0 && (
                              <div className="flex items-center gap-1">
                                <i className="ri-arrow-down-line text-xs text-green-500"></i>
                                <span className="text-[10px] font-medium text-green-600 dark:text-green-400">{member.taskStats.baixa} baixa</span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
