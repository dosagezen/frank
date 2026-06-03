import { useState, useEffect } from 'react';
import {
  CalendarEvent,
  CalendarEventLink,
  fetchEventLinks,
} from '../../../services/calendarService';

interface EventDetailsModalProps {
  event: CalendarEvent;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (eventId: string) => void;
  onEdit?: (event: CalendarEvent) => void;
}

const typeLabels: Record<string, string> = {
  meeting: 'Reunião',
  presentation: 'Apresentação',
  review: 'Revisão',
  workshop: 'Workshop',
  training: 'Treinamento',
  brainstorm: 'Brainstorm',
  deadline: 'Prazo',
};

const typeIcons: Record<string, string> = {
  meeting: 'ri-team-line',
  presentation: 'ri-slideshow-line',
  review: 'ri-search-eye-line',
  workshop: 'ri-tools-line',
  training: 'ri-book-open-line',
  brainstorm: 'ri-lightbulb-line',
  deadline: 'ri-alarm-warning-line',
};

const typeColorMap: Record<
  string,
  { bg: string; text: string; border: string; light: string }
> = {
  meeting: {
    bg: 'bg-teal-500',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-500',
    light: 'bg-teal-50 dark:bg-teal-900/20',
  },
  presentation: {
    bg: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500',
    light: 'bg-amber-50 dark:bg-amber-900/20',
  },
  review: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500',
    light: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  workshop: {
    bg: 'bg-orange-500',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500',
    light: 'bg-orange-50 dark:bg-orange-900/20',
  },
  training: {
    bg: 'bg-cyan-500',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500',
    light: 'bg-cyan-50 dark:bg-cyan-900/20',
  },
  brainstorm: {
    bg: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500',
    light: 'bg-rose-50 dark:bg-rose-900/20',
  },
  deadline: {
    bg: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-500',
    light: 'bg-red-50 dark:bg-red-900/20',
  },
};

const durationLabels: Record<string, string> = {
  '15min': '15 minutos',
  '30min': '30 minutos',
  '45min': '45 minutos',
  '1h': '1 hora',
  '1h30': '1 hora e 30 min',
  '2h': '2 horas',
  '3h': '3 horas',
  '4h': '4 horas',
  'dia-todo': 'Dia todo',
};

const reminderLabels: Record<string, string> = {
  '0': 'Sem lembrete',
  '5': '5 minutos antes',
  '15': '15 minutos antes',
  '30': '30 minutos antes',
  '60': '1 hora antes',
  '1440': '1 dia antes',
};

const recurrenceLabels: Record<string, string> = {
  none: 'Não repete',
  daily: 'Diariamente',
  weekly: 'Semanalmente',
  monthly: 'Mensalmente',
};

function formatTime(time: string) {
  return time?.slice(0, 5) || '';
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatFullDate(dateStr: string) {
  const date = new Date(dateStr + 'T12:00:00');
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  const formatted = date.toLocaleDateString('pt-BR', options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default function EventDetailsModal({
  event,
  isOpen,
  onClose,
  onDelete,
  onEdit,
}: EventDetailsModalProps) {
  const [links, setLinks] = useState<CalendarEventLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const colors = typeColorMap[event.type] || typeColorMap.meeting;
  const typeIcon = typeIcons[event.type] || 'ri-calendar-event-line';

  // Check if this is a recurring event
  const isRecurring = !!(event.recurrence_parent_id || (event.recurrence_type && event.recurrence_type !== 'none'));
  const recurrenceType = event.recurrence_type || 'none';

  // ---------- Keyboard & body scroll handling ----------
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, showDeleteConfirm]);

  // ---------- Load links when modal opens ----------
  useEffect(() => {
    if (isOpen && event?.id) {
      loadLinks();
    }
  }, [isOpen, event?.id]);

  const loadLinks = async () => {
    setLoadingLinks(true);
    try {
      const data = await fetchEventLinks(event.id);
      setLinks(data);
    } catch (err) {
      console.error('Erro ao carregar links:', err);
    } finally {
      setLoadingLinks(false);
    }
  };

  // ---------- Delete handling ----------
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(event.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.error('Erro ao excluir evento:', err);
      setDeleting(false);
    }
  };

  // ---------- Helpers ----------
  const attendeesList = event.attendees
    ? event.attendees.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  const isEventPast = () => {
    const now = new Date();
    const eventDateTime = new Date(
      `${event.event_date}T${event.event_time || '00:00:00'}`,
    );
    return eventDateTime < now;
  };

  const isPast = isEventPast();

  if (!isOpen) return null;

  return (
    <>
      {/* Main modal */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div
            className={`relative px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0`}
          >
            <div className={`absolute top-0 left-0 right-0 h-1 ${colors.bg}`}></div>

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div
                  className={`w-11 h-11 flex items-center justify-center rounded-xl ${colors.light} flex-shrink-0`}
                >
                  <i className={`${typeIcon} text-xl ${colors.text}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <h2
                    className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1.5 break-words leading-tight"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {event.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.light} ${colors.text}`}
                    >
                      <i className={`${typeIcon} text-[10px]`}></i>
                      {typeLabels[event.type] || event.type}
                    </span>
                    {isRecurring && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400">
                        <i className="ri-repeat-line text-[10px]"></i>
                        Recorrente
                      </span>
                    )}
                    {isPast && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        <i className="ri-time-line text-[10px]"></i>
                        Encerrado
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all cursor-pointer flex-shrink-0"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="space-y-5">
              {/* Date & Time card */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-700 rounded-lg shadow-sm flex-shrink-0">
                      <i className="ri-calendar-line text-lg text-gray-600 dark:text-gray-300"></i>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                        Data
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatFullDate(event.event_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-700 rounded-lg shadow-sm flex-shrink-0">
                      <i className="ri-time-line text-lg text-gray-600 dark:text-gray-300"></i>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                        Horário
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatTime(event.event_time)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recurrence Info */}
              {isRecurring && (
                <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-lg flex-shrink-0">
                      <i className="ri-repeat-line text-lg text-teal-600 dark:text-teal-400"></i>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-1">
                        Evento Recorrente
                      </h4>
                      <p className="text-xs text-teal-700 dark:text-teal-300">
                        {recurrenceLabels[recurrenceType]}
                        {event.recurrence_end_date && (
                          <> até {formatDate(event.recurrence_end_date)}</>
                        )}
                        {!event.recurrence_end_date && recurrenceType !== 'none' && (
                          <> • Sem data de término</>
                        )}
                      </p>
                      {event.recurrence_parent_id && (
                        <p className="text-xs text-teal-600 dark:text-teal-400 mt-1 flex items-center gap-1">
                          <i className="ri-information-line"></i>
                          Esta é uma ocorrência de uma série recorrente
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {event.duration && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <i className="ri-timer-line"></i>
                      Duração
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {durationLabels[event.duration] || event.duration}
                    </p>
                  </div>
                )}

                {event.location && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <i className="ri-map-pin-line"></i>
                      Local / Link
                    </p>
                    {event.location.startsWith('http') ? (
                      <a
                        href={event.location}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-sm font-semibold ${colors.text} hover:underline truncate block cursor-pointer`}
                      >
                        {event.location}
                      </a>
                    ) : (
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {event.location}
                      </p>
                    )}
                  </div>
                )}

                {event.reminder && event.reminder !== '0' && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <i className="ri-notification-line"></i>
                      Lembrete
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {reminderLabels[event.reminder] || event.reminder}
                    </p>
                  </div>
                )}
              </div>

              {/* Description */}
              {event.description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <i className={`ri-file-text-line ${colors.text}`}></i>
                    Descrição / Agenda
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {event.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Attendees */}
              {attendeesList.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <i className={`ri-group-line ${colors.text}`}></i>
                    Participantes ({attendeesList.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {attendeesList.map((name, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <div
                          className={`w-7 h-7 flex items-center justify-center rounded-full ${colors.light} flex-shrink-0`}
                        >
                          <span
                            className={`text-xs font-bold ${colors.text}`}
                          >
                            {name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                          {name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Useful Links */}
              {loadingLinks ? (
                <div className="flex items-center justify-center py-4">
                  <i className="ri-loader-4-line animate-spin text-teal-600 text-lg mr-2"></i>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Carregando links...
                  </span>
                </div>
              ) : links.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <i className={`ri-link ${colors.text}`}></i>
                    Links Úteis ({links.length})
                  </h3>
                  <div className="space-y-2">
                    {links.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-all cursor-pointer group"
                      >
                        <div
                          className={`w-9 h-9 flex items-center justify-center ${colors.light} rounded-lg group-hover:scale-105 transition-transform flex-shrink-0`}
                        >
                          <i
                            className={`ri-external-link-line text-base ${colors.text}`}
                          ></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {link.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {link.url}
                          </p>
                        </div>
                        <i className="ri-arrow-right-up-line text-gray-400 group-hover:text-teal-500 transition-colors flex-shrink-0"></i>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Metadata */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                  <span className="flex items-center gap-1">
                    <i className="ri-time-line"></i>
                    Criado em{' '}
                    {new Date(event.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} às{' '}
                    {new Date(event.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {event.updated_at && event.updated_at !== event.created_at && (
                    <span className="flex items-center gap-1">
                      <i className="ri-edit-line"></i>
                      Atualizado em{' '}
                      {new Date(event.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 p-4 sm:px-6 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium text-sm whitespace-nowrap cursor-pointer flex items-center gap-2"
            >
              <i className="ri-delete-bin-line"></i>
              Excluir
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
              >
                Fechar
              </button>
              {onEdit && (
                <button
                  onClick={() => onEdit(event)}
                  className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all font-medium text-sm whitespace-nowrap cursor-pointer flex items-center gap-2"
                >
                  <i className="ri-edit-line"></i>
                  Editar
                </button>
              )}
              {event.location &&
                event.location.startsWith('http') &&
                !isPast && (
                  <a
                    href={event.location}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-5 py-2.5 ${colors.bg} text-white rounded-lg hover:opacity-90 transition-all font-medium text-sm whitespace-nowrap cursor-pointer flex items-center gap-2`}
                  >
                    <i className="ri-video-chat-line"></i>
                    Entrar na Reunião
                  </a>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) {
              setShowDeleteConfirm(false);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 flex items-center justify-center bg-red-100 dark:bg-red-900/30 rounded-full flex-shrink-0">
                <i className="ri-alert-line text-2xl text-red-600 dark:text-red-400"></i>
              </div>
              <div>
                <h3
                  className="text-lg font-bold text-gray-900 dark:text-white"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Excluir Evento?
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Esta ação não pode ser desfeita
                </p>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                Tem certeza que deseja excluir o evento{' '}
                <strong>"{event.title}"</strong> agendado para{' '}
                <strong>{formatDate(event.event_date)}</strong> às{' '}
                <strong>{formatTime(event.event_time)}</strong>?
              </p>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Excluindo...
                  </>
                ) : (
                  'Excluir Evento'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
