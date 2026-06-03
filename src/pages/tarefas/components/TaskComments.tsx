import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { createNotification } from '../../../services/notificationsService';
import UserAvatar from '../../../components/base/UserAvatar';

interface Comment {
  id: string;
  task_id: string;
  user_id: string | null;
  autor_nome: string;
  autor_avatar: string | null;
  texto: string;
  data: string;
  parent_id: string | null;
  editado_em: string | null;
  replies?: Comment[];
}

interface AppUser {
  id: string;
  nome: string;
  avatar_url: string | null;
  cargo?: string;
}

interface TaskCommentsProps {
  taskId: string;
  taskTitle?: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHour < 24) return `há ${diffHour}h`;
  if (diffDay === 1) return 'ontem';
  if (diffDay < 7) return `há ${diffDay} dias`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function buildThreads(flat: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];
  flat.forEach((c) => map.set(c.id, { ...c, replies: [] }));
  map.forEach((c) => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(c);
    } else {
      roots.push(c);
    }
  });
  return roots;
}

/** Renderiza texto com menções @nome destacadas, usando a lista real de usuários */
function renderTextWithMentions(text: string, users: AppUser[]): React.ReactNode {
  // Monta lista de nomes ordenados do mais longo para o mais curto (evita match parcial)
  const sortedNames = users
    .map((u) => u.nome)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (sortedNames.length === 0) {
    return <span>{text}</span>;
  }

  // Cria regex que captura exatamente @NomeCompleto de cada usuário
  const escaped = sortedNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const mentionRegex = new RegExp(`(@(?:${escaped.join('|')}))`, 'g');

  const parts = text.split(mentionRegex);

  return parts.map((part, i) => {
    if (part.startsWith('@') && sortedNames.some((name) => part === `@${name}`)) {
      return (
        <span
          key={i}
          className="inline-flex items-center font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 rounded px-0.5"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** Extrai nomes mencionados do texto */
function extractMentions(text: string, users: AppUser[]): AppUser[] {
  const mentioned: AppUser[] = [];
  
  // Normaliza o texto para comparação (remove acentos, lowercase, trim)
  const normalizeText = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  console.log('🔍 [extractMentions] Iniciando detecção de menções');
  console.log('📝 [extractMentions] Texto do comentário:', text);
  console.log('👥 [extractMentions] Total de usuários disponíveis:', users.length);
  
  // Log detalhado dos usuários disponíveis
  users.forEach((u, index) => {
    console.log(`   ${index + 1}. ${u.nome} (ID: ${u.id.substring(0, 8)}..., Role: ${u.cargo || 'N/A'})`);
  });

  users.forEach((u) => {
    if (!u.nome || u.nome.trim().length === 0) {
      console.log('⚠️ [extractMentions] Usuário sem nome válido, pulando:', u.id);
      return;
    }
    
    // Normaliza o nome do usuário
    const normalizedUserName = normalizeText(u.nome);
    
    // Normaliza o texto do comentário
    const normalizedText = normalizeText(text);
    
    // Verifica se o texto contém @nome (normalizado)
    const normalizedMention = `@${normalizedUserName}`;
    
    // Também verifica a versão original (case-sensitive) para maior precisão
    const originalMention = `@${u.nome}`;
    
    // Verifica variações comuns (com espaços, pontuação, etc)
    const mentionPatterns = [
      normalizedMention,
      originalMention,
      `@${u.nome.toLowerCase()}`,
      `@${u.nome.toUpperCase()}`,
    ];
    
    let found = false;
    let matchedPattern = '';
    
    // Verifica se algum padrão está presente no texto
    for (const pattern of mentionPatterns) {
      if (normalizedText.includes(normalizeText(pattern)) || text.includes(pattern)) {
        found = true;
        matchedPattern = pattern;
        break;
      }
    }
    
    // Também verifica usando regex para capturar menções com espaços ou pontuação ao redor
    const regexPattern = new RegExp(`@\\s*${u.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regexPattern.test(text)) {
      found = true;
      matchedPattern = `@${u.nome} (regex match)`;
    }
    
    if (found) {
      mentioned.push(u);
      console.log(`✅ [extractMentions] Menção detectada: ${u.nome} (padrão: ${matchedPattern})`);
    }
  });
  
  console.log(`📊 [extractMentions] Total de menções detectadas: ${mentioned.length}`);
  if (mentioned.length > 0) {
    console.log('📋 [extractMentions] Usuários mencionados:', mentioned.map(u => `${u.nome} (${u.id.substring(0, 8)}...)`).join(', '));
  }
  
  return mentioned;
}

/* ------------------------------------------------------------------ */
/*  CommentItem                                                         */
/* ------------------------------------------------------------------ */
interface CommentItemProps {
  comment: Comment;
  currentUserId: string | null;
  isAdmin: boolean;
  onReply: (parentId: string, parentAutor: string) => void;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, newText: string) => Promise<void>;
  depth?: number;
  users: AppUser[];
}

function CommentItem({
  comment,
  currentUserId,
  isAdmin,
  onReply,
  onDelete,
  onEdit,
  depth = 0,
  users,
}: CommentItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.texto);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);

  // Mention state for edit mode
  const [editMentionActive, setEditMentionActive] = useState(false);
  const [editMentionQuery, setEditMentionQuery] = useState('');
  const [editMentionStart, setEditMentionStart] = useState(0);
  const [editDropdownPos, setEditDropdownPos] = useState({ top: 0, left: 0 });

  const canEdit = comment.user_id === currentUserId;
  const canDelete = isAdmin || comment.user_id === currentUserId;
  const maxDepth = 3;

  const startEditing = () => {
    setIsEditing(true);
    setEditText(comment.texto);
    setShowDeleteConfirm(false);
    setTimeout(() => {
      const ta = editTextareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    }, 50);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditText(comment.texto);
    setEditMentionActive(false);
  };

  const submitEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === comment.texto) {
      cancelEditing();
      return;
    }
    setEditSubmitting(true);
    try {
      await onEdit(comment.id, trimmed);
      setIsEditing(false);
      setEditMentionActive(false);
    } catch {
      // error handled in parent
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleEditTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length > 500) return;
    setEditText(val);

    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
      const isWordBoundary = charBefore === ' ' || charBefore === '\n' || atIndex === 0;
      const query = textBeforeCursor.slice(atIndex + 1);
      const wordCount = query.trim().split(/\s+/).length;
      const tooLong = wordCount > 3;

      if (isWordBoundary && !tooLong) {
        setEditMentionActive(true);
        setEditMentionStart(atIndex);
        setEditMentionQuery(query);

        const textarea = editTextareaRef.current;
        if (textarea) {
          const rect = textarea.getBoundingClientRect();
          const containerRect = editContainerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setEditDropdownPos({
              top: rect.top - containerRect.top,
              left: Math.min(atIndex * 7.5, rect.width - 240),
            });
          }
        }
        return;
      }
    }

    setEditMentionActive(false);
    setEditMentionQuery('');
  };

  const handleEditSelectMention = (selectedUser: AppUser) => {
    const before = editText.slice(0, editMentionStart);
    const after = editText.slice(editMentionStart + 1 + editMentionQuery.length);
    const newText = `${before}@${selectedUser.nome} ${after}`;
    if (newText.length <= 500) {
      setEditText(newText);
    }
    setEditMentionActive(false);
    setEditMentionQuery('');
    setTimeout(() => {
      const ta = editTextareaRef.current;
      if (ta) {
        const pos = before.length + 1 + selectedUser.nome.length + 1;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      }
    }, 10);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (editMentionActive && e.key === 'Escape') {
      e.preventDefault();
      setEditMentionActive(false);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submitEdit();
    }
  };

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-100 dark:border-gray-700 pl-4' : ''}`}>
      <div className="flex gap-3 group">
        <div className="flex-shrink-0 mt-0.5">
          <UserAvatar
            avatarUrl={comment.autor_avatar}
            nome={comment.autor_nome}
            size={depth > 0 ? 'xs' : 'sm'}
          />
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div ref={editContainerRef} className="relative">
              {editMentionActive && (
                <MentionDropdown
                  users={users}
                  query={editMentionQuery}
                  onSelect={handleEditSelectMention}
                  position={editDropdownPos}
                />
              )}
              <div className="border border-teal-300 dark:border-teal-600 rounded-xl overflow-hidden bg-white dark:bg-gray-700/60 ring-2 ring-teal-100 dark:ring-teal-900/30">
                <textarea
                  ref={editTextareaRef}
                  value={editText}
                  onChange={handleEditTextChange}
                  onKeyDown={handleEditKeyDown}
                  className="w-full px-4 py-3 text-sm text-gray-700 dark:text-gray-300 bg-transparent resize-none focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
                  rows={3}
                  maxLength={500}
                />
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{editText.length}/500</span>
                    <span className="text-xs text-gray-300 dark:text-gray-600 flex items-center gap-1">
                      <i className="ri-at-line text-xs"></i>
                      <span>para mencionar</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={editSubmitting}
                      className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 whitespace-nowrap"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={submitEdit}
                      disabled={!editText.trim() || editText.trim() === comment.texto || editSubmitting}
                      className="flex items-center gap-1.5 px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                    >
                      {editSubmitting ? (
                        <i className="ri-loader-4-line animate-spin text-xs"></i>
                      ) : (
                        <i className="ri-check-line text-xs"></i>
                      )}
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 px-1">
                Esc para cancelar · Ctrl+Enter para salvar
              </p>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 dark:bg-gray-700/60 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                      {comment.autor_nome}
                    </span>
                    {comment.editado_em && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 italic flex-shrink-0" title={`Editado em ${new Date(comment.editado_em).toLocaleString('pt-BR')}`}>
                        (editado)
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                    {formatRelativeTime(comment.data)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                  {renderTextWithMentions(comment.texto, users)}
                </p>
              </div>

              <div className="flex items-center gap-3 mt-1 px-1">
                {depth < maxDepth && (
                  <button
                    type="button"
                    onClick={() => onReply(comment.id, comment.autor_nome)}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <i className="ri-reply-line text-xs"></i>
                    Responder
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer flex items-center gap-1 opacity-0 group-hover:opacity-100"
                  >
                    <i className="ri-pencil-line text-xs"></i>
                    Editar
                  </button>
                )}
                {canDelete && (
                  <>
                    {showDeleteConfirm ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-500 dark:text-red-400">Excluir?</span>
                        <button
                          type="button"
                          onClick={() => onDelete(comment.id)}
                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 font-medium cursor-pointer"
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer flex items-center gap-1 opacity-0 group-hover:opacity-100"
                      >
                        <i className="ri-delete-bin-line text-xs"></i>
                        Excluir
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onReply={onReply}
              onDelete={onDelete}
              onEdit={onEdit}
              depth={depth + 1}
              users={users}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MentionDropdown                                                     */
/* ------------------------------------------------------------------ */
interface MentionDropdownProps {
  users: AppUser[];
  query: string;
  onSelect: (user: AppUser) => void;
  position: { top: number; left: number };
}

function MentionDropdown({ users, query, onSelect, position }: MentionDropdownProps) {
  const filtered = users
    .filter((u) => u.nome.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .slice(0, 8);

  if (filtered.length === 0) return null;

  return (
    <div
      className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl overflow-hidden"
      style={{
        bottom: `calc(100% - ${position.top}px + 8px)`,
        left: position.left,
        minWidth: 220,
        maxWidth: 280,
      }}
    >
      <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Mencionar usuário</span>
      </div>
      <ul className="py-1 max-h-48 overflow-y-auto">
        {filtered.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(user);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors cursor-pointer text-left"
            >
              <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                <UserAvatar avatarUrl={user.avatar_url} nome={user.nome} size="xs" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{user.nome}</p>
                {user.cargo && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user.cargo}</p>
                )}
              </div>
              <i className="ri-at-line text-xs text-teal-500 flex-shrink-0"></i>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TaskComments (main)                                                 */
/* ------------------------------------------------------------------ */
export default function TaskComments({ taskId, taskTitle }: TaskCommentsProps) {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; autor: string } | null>(null);

  // Mention state
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionStart, setMentionStart] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ---- Load users ---- */
  useEffect(() => {
    const loadUsers = async () => {
      try {
        console.log('🔄 [TaskComments] Carregando usuários para menção...');
        
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nome, avatar_url, cargo, role, email')
          .not('nome', 'is', null)
          .order('nome', { ascending: true });
        
        if (error) {
          console.error('❌ [TaskComments] Erro ao carregar usuários:', error);
          return;
        }
        
        // Filtra apenas usuários com nome válido
        const validUsers = (data || []).filter(u => u.nome && u.nome.trim().length > 0);
        
        console.log('✅ [TaskComments] Usuários carregados para menção:', validUsers.length);
        console.log('📋 [TaskComments] Detalhes dos usuários:');
        validUsers.forEach((u, index) => {
          console.log(`   ${index + 1}. ${u.nome} - Role: ${u.role || 'N/A'} - Email: ${u.email || 'N/A'} (ID: ${u.id.substring(0, 8)}...)`);
        });
        
        // Verifica se há admins na lista
        const admins = validUsers.filter(u => u.role === 'admin');
        console.log(`👑 [TaskComments] Admins encontrados: ${admins.length}`);
        if (admins.length > 0) {
          console.log('👑 [TaskComments] Lista de admins:', admins.map(a => a.nome).join(', '));
        }
        
        setAllUsers(validUsers);
      } catch (err) {
        console.error('❌ [TaskComments] Erro ao carregar usuários:', err);
      }
    };
    loadUsers();
  }, []);

  /* ---- Load comments ---- */
  const loadComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('data', { ascending: true });
      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Erro ao carregar comentários:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) loadComments();
  }, [taskId]);

  /* ---- Reply ---- */
  const handleReply = (parentId: string, parentAutor: string) => {
    setReplyTo({ id: parentId, autor: parentAutor });
    setText('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const cancelReply = () => {
    setReplyTo(null);
    setText('');
  };

  /* ---- Mention detection ---- */
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length > 500) return;
    setText(val);

    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
      const isWordBoundary = charBefore === ' ' || charBefore === '\n' || atIndex === 0;
      const query = textBeforeCursor.slice(atIndex + 1);

      // Fecha o dropdown se o query tiver mais de 3 palavras (nome muito longo, provavelmente não é menção)
      const wordCount = query.trim().split(/\s+/).length;
      const tooLong = wordCount > 3;

      if (isWordBoundary && !tooLong) {
        setMentionActive(true);
        setMentionStart(atIndex);
        setMentionQuery(query);

        const textarea = textareaRef.current;
        if (textarea) {
          const rect = textarea.getBoundingClientRect();
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setDropdownPos({
              top: rect.top - containerRect.top,
              left: Math.min(atIndex * 7.5, rect.width - 240),
            });
          }
        }
        return;
      }
    }

    setMentionActive(false);
    setMentionQuery('');
  }, []);

  const handleSelectMention = useCallback(
    (selectedUser: AppUser) => {
      const before = text.slice(0, mentionStart);
      // Remove tudo que foi digitado após o @ (query atual) e substitui pelo nome completo
      const after = text.slice(mentionStart + 1 + mentionQuery.length);
      const newText = `${before}@${selectedUser.nome} ${after}`;
      if (newText.length <= 500) {
        setText(newText);
      }
      setMentionActive(false);
      setMentionQuery('');
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          // Posiciona o cursor logo após o nome completo + espaço
          const pos = before.length + 1 + selectedUser.nome.length + 1;
          ta.focus();
          ta.setSelectionRange(pos, pos);
        }
      }, 10);
    },
    [text, mentionStart, mentionQuery],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionActive && e.key === 'Escape') {
      e.preventDefault();
      setMentionActive(false);
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /* ---- Send notifications to mentioned users ---- */
  const notifyMentionedUsers = async (commentText: string, authorName: string, isEdit?: boolean) => {
    if (!user) {
      console.log('⚠️ [notifyMentionedUsers] Usuário não autenticado, abortando');
      return;
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📢 [notifyMentionedUsers] INICIANDO PROCESSO DE NOTIFICAÇÃO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 [notifyMentionedUsers] Autor do comentário:', authorName, '(ID:', user.id.substring(0, 8) + '...)');
    console.log('💬 [notifyMentionedUsers] Texto do comentário:', commentText);
    console.log('✏️ [notifyMentionedUsers] É edição?', isEdit ? 'SIM' : 'NÃO');
    console.log('👥 [notifyMentionedUsers] Total de usuários disponíveis:', allUsers.length);
    
    const mentioned = extractMentions(commentText, allUsers);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [notifyMentionedUsers] RESULTADO DA DETECÇÃO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [notifyMentionedUsers] Usuários mencionados:', mentioned.length);
    
    if (mentioned.length === 0) {
      console.log('⚠️ [notifyMentionedUsers] Nenhuma menção detectada, finalizando');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }
    
    mentioned.forEach((u, index) => {
      console.log(`   ${index + 1}. ${u.nome} (ID: ${u.id.substring(0, 8)}..., Role: ${(u as any).role || 'N/A'})`);
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 [notifyMentionedUsers] ENVIANDO NOTIFICAÇÕES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const mentionedUser of mentioned) {
      // Não notificar o próprio autor
      if (mentionedUser.id === user.id) {
        console.log(`⏭️ [notifyMentionedUsers] Pulando notificação para o próprio autor: ${mentionedUser.nome}`);
        skipCount++;
        continue;
      }
      
      try {
        const editLabel = isEdit ? ' (editado)' : '';
        const notificationTitle = isEdit
          ? `${authorName} editou um comentário que menciona você`
          : `${authorName} mencionou você`;
        
        const notificationMessage = `Você foi mencionado em um comentário${editLabel}${taskTitle ? ` na tarefa "${taskTitle}"` : ''}: "${commentText.slice(
          0,
          80,
        )}${commentText.length > 80 ? '...' : ''}"`;
        
        console.log(`📨 [notifyMentionedUsers] Enviando notificação para: ${mentionedUser.nome} (ID: ${mentionedUser.id.substring(0, 8)}...)`);
        console.log(`   📋 Título: ${notificationTitle}`);
        console.log(`   💬 Mensagem: ${notificationMessage.substring(0, 100)}...`);
        
        await createNotification({
          userId: mentionedUser.id,
          type: 'comment',
          title: notificationTitle,
          message: notificationMessage,
          relatedType: 'comment',
          relatedId: taskId,
          actorId: user.id,
        });
        
        console.log(`✅ [notifyMentionedUsers] Notificação enviada com sucesso para: ${mentionedUser.nome}`);
        successCount++;
      } catch (err) {
        console.error(`❌ [notifyMentionedUsers] Erro ao notificar ${mentionedUser.nome}:`, err);
        errorCount++;
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [notifyMentionedUsers] RESUMO FINAL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Notificações enviadas com sucesso: ${successCount}`);
    console.log(`⏭️ Notificações puladas (próprio autor): ${skipCount}`);
    console.log(`❌ Erros ao enviar notificações: ${errorCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  /* ---- Notify parent comment author on thread reply ---- */
  const notifyThreadReply = async (parentId: string, replyText: string, authorName: string) => {
    if (!user) return;
    try {
      // Buscar o comentário pai para identificar o autor
      const parentComment = comments.find((c) => c.id === parentId);
      if (!parentComment || !parentComment.user_id) return;

      // Não notificar se o autor da resposta é o mesmo do comentário pai
      if (parentComment.user_id === user.id) return;

      // Verificar se o autor do comentário pai já foi notificado por menção (evitar duplicata)
      const mentionedUsers = extractMentions(replyText, allUsers);
      const alreadyMentioned = mentionedUsers.some((u) => u.id === parentComment.user_id);
      if (alreadyMentioned) return;

      await createNotification({
        userId: parentComment.user_id,
        type: 'comment',
        title: `${authorName} respondeu ao seu comentário`,
        message: `${authorName} respondeu ao seu comentário${taskTitle ? ` na tarefa "${taskTitle}"` : ''}: "${replyText.slice(0, 80)}${replyText.length > 80 ? '...' : ''}"`,
        relatedType: 'comment',
        relatedId: taskId,
        actorId: user.id,
      });
    } catch (err) {
      console.warn('Erro ao notificar resposta na thread:', err);
    }
  };

  /* ---- Submit ---- */
  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    try {
      setSubmitting(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('nome, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      const authorName = profile?.nome || user.email || 'Usuário';

      const payload: any = {
        task_id: taskId,
        user_id: user.id,
        autor_nome: authorName,
        autor_avatar: profile?.avatar_url || null,
        texto: trimmed,
        parent_id: replyTo?.id || null,
      };

      const { error } = await supabase.from('task_comments').insert([payload]);
      if (error) throw error;

      // Notificar usuários mencionados
      await notifyMentionedUsers(trimmed, authorName);

      // Notificar autor do comentário pai (resposta na thread)
      if (replyTo?.id) {
        await notifyThreadReply(replyTo.id, trimmed, authorName);
      }

      setText('');
      setReplyTo(null);
      setMentionActive(false);
      await loadComments();

      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Erro ao enviar comentário:', err);
      showToast('Erro ao enviar comentário. Tente novamente.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- Edit ---- */
  const handleEdit = async (commentId: string, newText: string) => {
    try {
      const { error } = await supabase
        .from('task_comments')
        .update({ texto: newText, editado_em: new Date().toISOString() })
        .eq('id', commentId);
      if (error) throw error;

      // Buscar nome do autor para notificação
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user!.id)
        .maybeSingle();
      const authorName = profile?.nome || user?.email || 'Usuário';

      // Notificar mencionados sobre a edição
      await notifyMentionedUsers(newText, authorName, true);

      showToast('Comentário editado com sucesso.', 'success');
      await loadComments();
    } catch (err) {
      console.error('Erro ao editar comentário:', err);
      showToast('Erro ao editar comentário. Tente novamente.', 'error');
      throw err;
    }
  };

  /* ---- Delete ---- */
  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase.from('task_comments').delete().eq('id', commentId);
      if (error) throw error;
      showToast('Comentário excluído.', 'success');
      await loadComments();
    } catch (err) {
      console.error('Erro ao excluir comentário:', err);
      showToast('Erro ao excluir comentário.', 'error');
    }
  };

  const threads = buildThreads(comments);
  const totalCount = comments.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <i className="ri-chat-3-line text-teal-600 dark:text-teal-400 text-base"></i>
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Comentários</span>
        {totalCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 text-xs font-semibold rounded-full">
            {totalCount}
          </span>
        )}
      </div>

      {/* List */}
      <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
            <i className="ri-loader-4-line animate-spin text-lg"></i>
            <span className="text-sm">Carregando comentários...</span>
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400 dark:text-gray-500">
            <i className="ri-chat-3-line text-3xl"></i>
            <p className="text-sm">Nenhum comentário ainda. Seja o primeiro!</p>
          </div>
        ) : (
          threads.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id || null}
              isAdmin={isAdmin}
              onReply={handleReply}
              onDelete={handleDelete}
              onEdit={handleEdit}
              users={allUsers}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div ref={containerRef} className="relative">
        {/* Mention dropdown */}
        {mentionActive && (
          <MentionDropdown users={allUsers} query={mentionQuery} onSelect={handleSelectMention} position={dropdownPos} />
        )}

        <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-white dark:bg-gray-700/40">
          {/* Reply indicator */}
          {replyTo && (
            <div className="flex items-center justify-between px-3 py-2 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-800">
              <div className="flex items-center gap-2 text-xs text-teal-700 dark:text-teal-400">
                <i className="ri-reply-line"></i>
                <span>
                  Respondendo a <strong>{replyTo.autor}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={cancelReply}
                className="w-5 h-5 flex items-center justify-center text-teal-500 hover:text-teal-700 dark:hover:text-teal-300 cursor-pointer"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={
              replyTo
                ? `Responder a ${replyTo.autor}... (use @ para mencionar)`
                : 'Escreva um comentário... use @ para mencionar alguém (Ctrl+Enter para enviar)'
            }
            className="w-full px-4 py-3 text-sm text-gray-700 dark:text-gray-300 bg-transparent resize-none focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
            rows={3}
            maxLength={500}
          />

          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 dark:text-gray-500">{text.length}/500</span>
              <span className="text-xs text-gray-300 dark:text-gray-600 flex items-center gap-1">
                <i className="ri-at-line text-xs"></i>
                <span>para mencionar</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className="flex items-center gap-2 px-4 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              {submitting ? (
                <i className="ri-loader-4-line animate-spin text-sm"></i>
              ) : (
                <i className="ri-send-plane-fill text-sm"></i>
              )}
              {replyTo ? 'Responder' : 'Comentar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
