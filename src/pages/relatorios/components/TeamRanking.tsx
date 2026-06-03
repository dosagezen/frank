import React from 'react';
import UserAvatar from '../../../components/base/UserAvatar';

interface TeamMember {
  id: string;
  nome: string;
  avatar: string;
  cargo: string;
  totalTarefas: number;
  concluidas: number;
  percentual: number;
}

interface TeamRankingProps {
  members: TeamMember[];
}

/**
 * TeamRanking component – displays a ranking list of team members.
 * Includes robust handling for empty data and defensive checks for
 * optional values.
 */
export default function TeamRanking({ members }: TeamRankingProps) {
  /**
   * Returns the icon class and colour for the top‑3 positions.
   * If the index is > 2, `null` is returned and a numeric badge is shown instead.
   */
  const getMedalIcon = (index: number): { icon: string; color: string } | null => {
    if (index === 0) return { icon: 'ri-trophy-fill', color: 'text-amber-500' };
    if (index === 1) return { icon: 'ri-medal-fill', color: 'text-gray-400' };
    if (index === 2) return { icon: 'ri-medal-fill', color: 'text-amber-700' };
    return null;
  };

  /**
   * Determines the colour of the progress bar based on completion percentage.
   */
  const getBarColor = (percentual: number) => {
    if (percentual >= 80) return 'bg-emerald-500';
    if (percentual >= 50) return 'bg-teal-500';
    if (percentual >= 30) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  // Defensive guard – avoid rendering when `members` is undefined/null.
  if (!Array.isArray(members)) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Dados de membros inválidos.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2
            className="text-base sm:text-lg font-bold text-gray-900 dark:text-white"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Ranking da Equipe
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Por taxa de conclusão de tarefas
          </p>
        </div>
        <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
          <i className="ri-trophy-line text-lg text-amber-600 dark:text-amber-400"></i>
        </div>
      </div>

      {/* Empty state */}
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <i className="ri-team-line text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum membro com tarefas</p>
        </div>
      ) : (
        /* Members list */
        <div className="space-y-3">
          {members.map((member, index) => {
            const medal = getMedalIcon(index);
            return (
              <div
                key={member.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                  index === 0
                    ? 'bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30'
                    : ''
                }`}
              >
                {/* Position / Medal */}
                <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                  {medal ? (
                    <i className={`${medal.icon} text-lg ${medal.color}`}></i>
                  ) : (
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500">
                      #{index + 1}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <UserAvatar
                  avatarUrl={member.avatar}
                  nome={member.nome}
                  size="md"
                />

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4
                      className="text-sm font-semibold text-gray-900 dark:text-white truncate"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      {member.nome}
                    </h4>
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400 ml-2 flex-shrink-0">
                      {member.percentual}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`${getBarColor(member.percentual)} h-1.5 rounded-full transition-all`}
                        style={{ width: `${member.percentual}%` }}
                      ></div>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                      {member.concluidas}/{member.totalTarefas}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
