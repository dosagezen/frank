import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { ConhecimentoItem } from '../../mocks/conhecimento';
import NovoConhecimentoModal from './components/NovoConhecimentoModal';
import EditarConhecimentoModal from './components/EditarConhecimentoModal';
import { useToast } from '../../contexts/ToastContext';
import { useCachedData } from '../../hooks/useCachedData';
import {
  fetchConhecimentos,
  createConhecimento,
  updateConhecimento,
  incrementVisualizacao,
  deleteConhecimento,
} from '../../services/conhecimentoService';

const ITEMS_PER_PAGE = 15;

export default function ConhecimentoPage() {
  const { showToast } = useToast();
  const location = useLocation();
  const highlightRef = useRef<HTMLDivElement>(null);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ConhecimentoItem | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ConhecimentoItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [textSearch, setTextSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Usar useCachedData com TTL de 15 minutos
  const {
    data: rawConhecimentos,
    isLoading,
    isRevalidating,
    error,
    retry,
    invalidate,
  } = useCachedData<ConhecimentoItem[]>('conhecimento-list', fetchConhecimentos, {
    ttl: 15 * 60 * 1000, // 15 minutos
  });

  const conhecimentos: ConhecimentoItem[] = rawConhecimentos ?? [];

  // Captura o estado de navegação vindo da busca global
  useEffect(() => {
    const state = location.state as { searchQuery?: string; knowledgeId?: string } | null;
    if (state?.searchQuery) {
      setTextSearch(state.searchQuery);
      setCurrentPage(1);
    }
    if (state?.knowledgeId) {
      setHighlightedId(state.knowledgeId);
    }
    // Limpa o state da navegação para não persistir ao recarregar
    window.history.replaceState({}, '');
  }, [location.state]);

  // Mostrar erro se houver
  useEffect(() => {
    if (error) {
      showToast('Erro ao carregar a base de conhecimento. Tente novamente.', 'error');
    }
  }, [error, showToast]);

  // Scroll para o item destacado após carregar
  useEffect(() => {
    if (!isLoading && highlightedId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [isLoading, highlightedId]);

  const allTags = Array.from(new Set(conhecimentos.flatMap(c => c.tags ?? []))).sort();

  // Filtro combinado: tags + texto
  const filteredConhecimentos = conhecimentos.filter(c => {
    const matchesTags = selectedTags.length === 0 || selectedTags.some(tag => c.tags.includes(tag));
    const query = textSearch.trim().toLowerCase();
    const matchesText =
      query === '' ||
      c.titulo.toLowerCase().includes(query) ||
      c.descricao.toLowerCase().includes(query) ||
      c.tags.some(t => t.toLowerCase().includes(query));
    return matchesTags && matchesText;
  });

  // Se há item destacado, garante que ele apareça na página correta
  useEffect(() => {
    if (highlightedId && !isLoading && conhecimentos.length > 0) {
      const idx = filteredConhecimentos.findIndex(c => String(c.id) === highlightedId);
      if (idx !== -1) {
        const targetPage = Math.floor(idx / ITEMS_PER_PAGE) + 1;
        setCurrentPage(targetPage);
      }
    }
  }, [highlightedId, isLoading, conhecimentos.length, textSearch]);

  const totalPages = Math.ceil(filteredConhecimentos.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedConhecimentos = filteredConhecimentos.slice(startIndex, endIndex);

  const handleAddConhecimento = async (
    novoConhecimento: Omit<ConhecimentoItem, 'id' | 'visualizado' | 'visualizacoes'>
  ) => {
    try {
      await createConhecimento(novoConhecimento);
      // Invalidar cache para rebuscar dados
      invalidate();
      setCurrentPage(1);
      showToast('Conteúdo adicionado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao adicionar conhecimento:', err);
      showToast('Erro ao salvar o conteúdo. Tente novamente.', 'error');
    }
  };

  const handleEditConhecimento = async (updatedItem: ConhecimentoItem) => {
    try {
      await updateConhecimento(updatedItem);
      // Invalidar cache para rebuscar dados
      invalidate();
      setEditingItem(null);
      showToast('Conteúdo atualizado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao editar conhecimento:', err);
      showToast('Erro ao salvar as alterações. Tente novamente.', 'error');
    }
  };

  const handleDeleteConhecimento = (id: number) => {
    const item = conhecimentos.find(c => c.id === id);
    if (item) {
      setDeleteConfirmItem(item);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      setIsDeleting(true);
      await deleteConhecimento(deleteConfirmItem.id);
      // Invalidar cache para rebuscar dados
      invalidate();
      setDeleteConfirmItem(null);
      showToast('Conteúdo excluído com sucesso!', 'success');
      const remaining = filteredConhecimentos.length - 1;
      const newTotalPages = Math.ceil(remaining / ITEMS_PER_PAGE);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }
    } catch (err) {
      console.error('Erro ao excluir conhecimento:', err);
      showToast('Erro ao excluir o conteúdo. Tente novamente.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCardClick = async (conhecimento: ConhecimentoItem) => {
    try {
      await incrementVisualizacao(conhecimento.id, conhecimento.visualizacoes);
      // Invalidar cache para atualizar contadores
      invalidate();
    } catch {
      // silencioso
    }
    window.open(conhecimento.link, '_blank', 'noopener,noreferrer');
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setTextSearch('');
    setSelectedTags([]);
    setHighlightedId(null);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) goToPage(currentPage - 1);
  };
  const goToNextPage = () => {
    if (currentPage < totalPages) goToPage(currentPage + 1);
  };

  const hasActiveFilters = textSearch.trim() !== '' || selectedTags.length > 0;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Base de Conhecimento
            {isRevalidating && !isLoading && (
              <span className="text-xs font-normal text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-teal-600 dark:border-teal-400 border-t-transparent rounded-full animate-spin"></div>
                atualizando...
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>Centralize e compartilhe conhecimento da equipe</p>
        </div>
        <button onClick={() => setIsNewModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer">
          <i className="ri-add-line text-lg"></i>
          <span className="text-sm font-medium">Novo Artigo</span>
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm px-4 py-3">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-teal-600 mb-0.5">{conhecimentos.length}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total de Conteúdos</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-teal-600 mb-0.5">{conhecimentos.filter(c => c.visualizado).length}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Visualizados</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-teal-600 mb-0.5">{allTags.length}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Tags Diferentes</div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando base de conhecimento...</p>
        </div>
      ) : (
        <>
          {hasActiveFilters && (
            <div className="mb-6 flex items-center justify-between bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl px-5 py-3">
              <div className="flex items-center gap-3">
                <i className="ri-search-line text-teal-600 dark:text-teal-400 text-lg"></i>
                <div>
                  {textSearch && <span className="text-sm font-medium text-teal-800 dark:text-teal-200">Buscando por: <strong>&quot;{textSearch}&quot;</strong></span>}
                  {textSearch && selectedTags.length > 0 && <span className="text-teal-600 dark:text-teal-400 mx-2">·</span>}
                  {selectedTags.length > 0 && <span className="text-sm text-teal-700 dark:text-teal-300">{selectedTags.length} {selectedTags.length === 1 ? 'tag selecionada' : 'tags selecionadas'}</span>}
                  <span className="ml-3 text-sm text-teal-600 dark:text-teal-400">— {filteredConhecimentos.length} {filteredConhecimentos.length === 1 ? 'resultado' : 'resultados'}</span>
                </div>
              </div>
              <button onClick={clearAllFilters} className="flex items-center gap-1.5 text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-100 transition-colors whitespace-nowrap cursor-pointer">
                <i className="ri-close-line text-base"></i>Limpar busca
              </button>
            </div>
          )}

          {/* Filtros por Tags */}
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <button onClick={() => setIsTagsExpanded(!isTagsExpanded)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <i className="ri-filter-3-line text-teal-600 dark:text-teal-400 text-lg"></i>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filtrar por Tags</h3>
                {selectedTags.length > 0 && <span className="px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-bold rounded-full whitespace-nowrap">{selectedTags.length} {selectedTags.length === 1 ? 'selecionada' : 'selecionadas'}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">{isTagsExpanded ? 'Recolher' : 'Expandir'}</span>
                <i className={`ri-arrow-down-s-line text-xl text-gray-500 dark:text-gray-400 transition-transform duration-300 ${isTagsExpanded ? 'rotate-180' : ''}`}></i>
              </div>
            </button>
            <div className={`transition-all duration-300 ease-in-out ${isTagsExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
              <div className="px-6 pb-6 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <button key={tag} onClick={() => toggleTag(tag)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${selectedTags.includes(tag) ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                      {tag}
                    </button>
                  ))}
                </div>
                {selectedTags.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => {
                        setSelectedTags([]);
                        setCurrentPage(1);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors whitespace-nowrap"
                    >
                      <i className="ri-close-circle-line text-base"></i>
                      Limpar Filtros ({selectedTags.length})
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lista de Conteúdos */}
          <div className="space-y-6">
            {paginatedConhecimentos.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
                <i className="ri-inbox-line text-6xl text-gray-400 mb-4"></i>
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">{hasActiveFilters ? `Nenhum conteúdo encontrado para "${textSearch}"` : 'Nenhum conteúdo encontrado com os filtros selecionados'}</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium whitespace-nowrap"
                  >
                    Limpar busca e ver todos
                  </button>
                )}
              </div>
            ) : (
              paginatedConhecimentos.map((conhecimento, index) => {
                const isHighlighted = String(conhecimento.id) === highlightedId;
                return (
                  <div key={conhecimento.id} ref={isHighlighted ? highlightRef : null}>
                    <div
                      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden cursor-pointer ${
                        isHighlighted ? 'ring-2 ring-teal-500 ring-offset-2 dark:ring-offset-gray-900' : ''
                      }`}
                      onClick={() => handleCardClick(conhecimento)}
                    >
                      {isHighlighted && (
                        <div className="bg-teal-500 text-white text-xs font-semibold px-4 py-1.5 flex items-center gap-2">
                          <i className="ri-search-line"></i>
                          Resultado da sua busca
                        </div>
                      )}
                      <div className="flex gap-6 p-6">
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 w-80 h-48 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden group relative">
                          <img
                            src={
                              conhecimento.thumbnail ||
                              'https://readdy.ai/api/search-image?query=default%20placeholder%20image%20for%20knowledge%20base%20content%20with%20neutral%20background%20simple%20modern%20design&width=320&height=180&seq=default-thumbnail&orientation=landscape'
                            }
                            alt={conhecimento.titulo}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <i className="ri-external-link-line text-white text-4xl"></i>
                          </div>
                          {!conhecimento.visualizado && (
                            <div className="absolute top-3 left-3 bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                              NOVO
                            </div>
                          )}
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 flex flex-col">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 hover:text-teal-600 transition-colors">
                                {conhecimento.titulo}
                              </h3>
                              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                                <span className="flex items-center gap-1">
                                  <i className="ri-user-line"></i>
                                  {conhecimento.autor}
                                </span>
                                <span className="flex items-center gap-1">
                                  <i className="ri-calendar-line"></i>
                                  {conhecimento.dataPublicacao}
                                </span>
                                <span className="flex items-center gap-1">
                                  <i className="ri-eye-line"></i>
                                  {conhecimento.visualizacoes}{' '}
                                  {conhecimento.visualizacoes === 1 ? 'visualização' : 'visualizações'}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItem(conhecimento);
                                }}
                                className="w-10 h-10 flex items-center justify-center bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition-colors"
                                title="Editar"
                              >
                                <i className="ri-edit-line text-lg"></i>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteConhecimento(conhecimento.id);
                                }}
                                className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                title="Excluir"
                              >
                                <i className="ri-delete-bin-line text-lg"></i>
                              </button>
                            </div>
                          </div>

                          <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 flex-1">
                            {conhecimento.descricao}
                          </p>

                          <div className="flex flex-wrap gap-2 mb-3">
                            {conhecimento.tags.map(tag => (
                              <span
                                key={tag}
                                className="px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-medium rounded-full whitespace-nowrap"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400">
                            <i className="ri-link text-base"></i>
                            <span className="truncate">{conhecimento.link}</span>
                            <i className="ri-external-link-line"></i>
                          </div>
                        </div>
                      </div>
                    </div>

                    {index < paginatedConhecimentos.length - 1 && (
                      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent my-6"></div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Mostrando <span className="font-semibold text-gray-900 dark:text-white">{startIndex + 1}</span> a{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {Math.min(endIndex, filteredConhecimentos.length)}
                  </span>{' '}
                  de <span className="font-semibold text-gray-900 dark:text-white">{filteredConhecimentos.length}</span>{' '}
                  conteúdos
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors whitespace-nowrap ${
                      currentPage === 1
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-teal-50 text-teal-600 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400'
                    }`}
                  >
                    <i className="ri-arrow-left-s-line text-xl"></i>
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      const showPage = page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1);
                      const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                      const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;
                      if (showEllipsisBefore || showEllipsisAfter) {
                        return (
                          <span key={`ellipsis-${page}`} className="w-10 h-10 flex items-center justify-center text-gray-400">
                            ...
                          </span>
                        );
                      }
                      if (!showPage) return null;
                      return (
                        <button
                          key={page}
                          onClick={() => goToPage(page)}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg font-medium transition-all whitespace-nowrap ${
                            currentPage === page
                              ? 'bg-teal-600 text-white shadow-md'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors whitespace-nowrap ${
                      currentPage === totalPages
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-teal-50 text-teal-600 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400'
                    }`}
                  >
                    <i className="ri-arrow-right-s-line text-xl"></i>
                  </button>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Página <span className="font-semibold text-gray-900 dark:text-white">{currentPage}</span> de{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {isNewModalOpen && (
        <NovoConhecimentoModal
          onClose={() => setIsNewModalOpen(false)}
          onAdd={handleAddConhecimento}
          existingTags={allTags}
        />
      )}

      {editingItem && (
        <EditarConhecimentoModal
          conhecimento={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleEditConhecimento}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-5 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <i className="ri-delete-bin-line text-3xl text-red-600 dark:text-red-400"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Excluir Conteúdo</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">Tem certeza que deseja excluir este conteúdo?</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3 mb-6 break-words">
                {deleteConfirmItem.titulo}
              </p>
              <p className="text-xs text-red-500 dark:text-red-400 mb-6">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmItem(null)}
                  disabled={isDeleting}
                  className="flex-1 px-5 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 px-5 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
        </div>
      )}
    </>
  );
}
