import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import NewMemberModal from "./components/NewMemberModal";
import MemberProfileModal from "./components/MemberProfileModal";
import UserAvatar from "../../components/base/UserAvatar";
import { useCachedData } from "../../hooks/useCachedData";
import { fetchAllMembersWithStats } from "../../services/teamService";
import PageLoading from "../../components/PageLoading";
import PageError from "../../components/PageError";
import { CACHE_KEYS } from "../../services/localCache";

export default function EquipePage() {
  const { isAdmin } = useAuth();
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const { data: members, isLoading: loading, error, retry } = useCachedData(
    CACHE_KEYS.EQUIPE_MEMBERS,
    fetchAllMembersWithStats,
    {
      ttl: 15 * 60 * 1000, // 15 minutos
      staleWhileRevalidate: true,
    }
  );

  const filteredMembers = members?.filter((member) => {
    if (!member) return false;
    const name = member.nome || member.full_name || "";
    const email = member.email || "";
    const searchLower = searchTerm.toLowerCase();
    return (
      name.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower)
    );
  }) ?? [];

  return (
    <>
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            Equipe
          </h1>
          <p
            className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 break-words"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Gerencie os membros da sua equipe
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsNewMemberModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-user-add-line text-lg"></i>
            <span className="text-sm font-medium">Adicionar Membro</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-5">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <PageLoading message="Carregando membros da equipe..." />
        </div>
      )}
      {error && !loading && (
        <PageError
          message="Erro ao carregar membros da equipe"
          error={error}
          onRetry={retry}
        />
      )}

      {!loading && !error && (
        <>
          {filteredMembers.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
              <i className="ri-user-line text-5xl text-gray-400 mb-4"></i>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Nenhum membro encontrado
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm
                  ? "Tente ajustar os filtros de busca"
                  : "Adicione o primeiro membro da equipe"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
              {filteredMembers.map((member) => {
                const displayName = member.nome || member.full_name || "Sem nome";
                const displayEmail = member.email || "";
                return (
                  <div
                    key={member.id}
                    onClick={() => setSelectedMemberId(member.id)}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group flex flex-col"
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        avatarUrl={member.avatar_url}
                        nome={displayName}
                        size="xl"
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                            {displayName}
                          </h3>
                          <i className="ri-arrow-right-s-line text-gray-400 group-hover:text-teal-500 transition-colors flex-shrink-0 text-sm"></i>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {displayEmail}
                        </p>
                        {member.aniversario && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                            <i className="ri-cake-2-line text-teal-500"></i>
                            {member.aniversario}
                          </p>
                        )}
                        {(member.cargo || member.role) && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                            <i className="ri-briefcase-line text-teal-500"></i>
                            <span className="truncate">
                              {member.cargo ||
                                (member.role === "admin"
                                  ? "Administrador"
                                  : "Membro")}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex-1">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-base font-semibold text-gray-900 dark:text-white">
                            {member.projectCount ||
                              member.projetos_count ||
                              0}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Projetos
                          </div>
                        </div>
                        <div>
                          <div className="text-base font-semibold text-gray-900 dark:text-white">
                            {member.taskCount ||
                              member.tarefas_ativas ||
                              0}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Tarefas
                          </div>
                        </div>
                        <div>
                          <div className="text-base font-semibold text-gray-900 dark:text-white">
                            {member.completedTasks || 0}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Concluídas
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                      <p className="text-xs text-teal-600 dark:text-teal-400 text-center font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <i className="ri-user-search-line"></i>Ver perfil completo
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <NewMemberModal
        isOpen={isNewMemberModalOpen}
        onClose={() => setIsNewMemberModalOpen(false)}
        onSuccess={retry}
      />
      <MemberProfileModal
        memberId={selectedMemberId}
        isOpen={!!selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
      />
    </>
  );
}
