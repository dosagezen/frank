import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  CalendarEvent,
  CalendarEventLink,
  updateEvent,
  fetchEventLinks,
} from '../../../services/calendarService';
import { supabase } from '../../../lib/supabaseClient';
import DatePicker from '../../../components/base/DatePicker';

interface EditEventModalProps {
  event: CalendarEvent;
  isOpen: boolean;
  onClose: () => void;
  onEventUpdated?: () => void;
}

interface UsefulLink {
  id: string;
  name: string;
  url: string;
  isNew?: boolean;
}

type RecurrenceEditScope = 'this' | 'future' | 'all';

export default function EditEventModal({
  event,
  isOpen,
  onClose,
  onEventUpdated,
}: EditEventModalProps) {
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    type: 'meeting',
    date: '',
    time: '',
    duration: '',
    location: '',
    description: '',
    attendees: '',
    reminder: '15',
    recurrenceType: 'none',
    recurrenceEndDate: '',
  });

  const [usefulLinks, setUsefulLinks] = useState<UsefulLink[]>([]);
  const [deletedLinkIds, setDeletedLinkIds] = useState<string[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [newLink, setNewLink] = useState({ name: '', url: '' });
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState({ name: '', url: '' });
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ show: false, message: '', type: 'success' });

  /* --------------------------------------------------------------------- */
  /* Load event data into form                                              */
  /* --------------------------------------------------------------------- */
  useEffect(() => {
    if (isOpen && event) {
      setFormData({
        title: event.title || '',
        type: event.type || 'meeting',
        date: event.event_date || '',
        time: event.event_time ? event.event_time.slice(0, 5) : '',
        duration: event.duration || '',
        location: event.location || '',
        description: event.description || '',
        attendees: event.attendees || '',
        reminder: event.reminder || '15',
        recurrenceType: event.recurrence_type || 'none',
        recurrenceEndDate: event.recurrence_end_date || '',
      });
      setDeletedLinkIds([]);
      setShowLinkForm(false);
      setNewLink({ name: '', url: '' });
      setEditingLinkId(null);
      setShowRecurrenceDialog(false);
      setPendingFormData(null);
      loadExistingLinks();
    }
  }, [isOpen, event]);

  const loadExistingLinks = async () => {
    if (!event?.id) return;
    setLoadingLinks(true);
    try {
      const links = await fetchEventLinks(event.id);
      setUsefulLinks(
        links.map((l: CalendarEventLink) => ({
          id: l.id,
          name: l.name,
          url: l.url,
          isNew: false,
        })),
      );
    } catch (err) {
      console.error('Erro ao carregar links:', err);
    } finally {
      setLoadingLinks(false);
    }
  };

  /* --------------------------------------------------------------------- */
  /* Modal lifecycle & accessibility                                        */
  /* --------------------------------------------------------------------- */
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showRecurrenceDialog) {
          setShowRecurrenceDialog(false);
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
  }, [isOpen, showRecurrenceDialog, onClose]);

  if (!isOpen) return null;

  /* --------------------------------------------------------------------- */
  /* Toast helpers                                                          */
  /* --------------------------------------------------------------------- */
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  /* --------------------------------------------------------------------- */
  /* Form handling                                                          */
  /* --------------------------------------------------------------------- */
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getRecurrenceSummary = () => {
    if (formData.recurrenceType === 'none') return null;
    
    const typeLabels: Record<string, string> = {
      daily: 'diariamente',
      weekly: 'semanalmente',
      monthly: 'mensalmente',
    };
    
    const label = typeLabels[formData.recurrenceType] || '';
    
    if (formData.recurrenceEndDate) {
      const endDate = new Date(formData.recurrenceEndDate);
      const formatted = endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      return `Repete ${label} até ${formatted}`;
    }
    
    return `Repete ${label} (sem data de término)`;
  };

  const isRecurringEvent = () => {
    return event.recurrence_type && event.recurrence_type !== 'none';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !event?.id) return;

    const formPayload = {
      title: formData.title,
      type: formData.type,
      event_date: formData.date,
      event_time: formData.time,
      duration: formData.duration || undefined,
      location: formData.location || undefined,
      description: formData.description || undefined,
      attendees: formData.attendees || undefined,
      reminder: formData.reminder,
      recurrence_type: formData.recurrenceType,
      recurrence_end_date: formData.recurrenceEndDate || undefined,
    };

    // Se é um evento recorrente, mostrar diálogo de confirmação
    if (isRecurringEvent()) {
      setPendingFormData(formPayload);
      setShowRecurrenceDialog(true);
      return;
    }

    // Se não é recorrente, salvar diretamente
    setPendingFormData(formPayload);
    await saveEvent('all', formPayload);
  };

  const saveEvent = async (scope: RecurrenceEditScope, directPayload?: any) => {
    const payload = directPayload || pendingFormData;
    if (!user || !event?.id || !payload) return;

    setSaving(true);
    setShowRecurrenceDialog(false);

    try {
      let result;

      if (scope === 'this') {
        // Criar exceção: criar novo evento sem recorrência para esta data específica
        // e marcar o evento pai para pular esta data
        const { data: newEvent, error: createError } = await supabase
          .from('calendar_events')
          .insert({
            user_id: user.id,
            title: payload.title,
            type: payload.type,
            event_date: payload.event_date,
            event_time: payload.event_time,
            duration: payload.duration,
            location: payload.location,
            description: payload.description,
            attendees: payload.attendees,
            reminder: payload.reminder,
            recurrence_type: 'none',
            recurrence_parent_id: event.recurrence_parent_id || event.id,
          })
          .select()
          .single();

        if (createError) throw createError;
        result = newEvent;
      } else if (scope === 'future') {
        // Dividir série: terminar a série atual na data anterior e criar nova série
        const currentDate = new Date(event.event_date);
        const previousDay = new Date(currentDate);
        previousDay.setDate(previousDay.getDate() - 1);

        // Atualizar evento pai para terminar antes desta data
        await supabase
          .from('calendar_events')
          .update({
            recurrence_end_date: previousDay.toISOString().split('T')[0],
          })
          .eq('id', event.recurrence_parent_id || event.id);

        // Criar nova série começando desta data
        const { data: newSeries, error: createError } = await supabase
          .from('calendar_events')
          .insert({
            user_id: user.id,
            title: payload.title,
            type: payload.type,
            event_date: payload.event_date,
            event_time: payload.event_time,
            duration: payload.duration,
            location: payload.location,
            description: payload.description,
            attendees: payload.attendees,
            reminder: payload.reminder,
            recurrence_type: payload.recurrence_type,
            recurrence_end_date: payload.recurrence_end_date,
          })
          .select()
          .single();

        if (createError) throw createError;
        result = newSeries;
      } else {
        // Atualizar todos os eventos da série
        result = await updateEvent(
          event.recurrence_parent_id || event.id,
          payload
        );
      }

      if (result) {
        // Gerenciar links apenas se for edição do evento principal ou de todos
        if (scope === 'all') {
          // Delete removed links
          if (deletedLinkIds.length > 0) {
            await supabase
              .from('calendar_event_links')
              .delete()
              .in('id', deletedLinkIds);
          }

          // Update existing links
          const existingLinks = usefulLinks.filter((l) => !l.isNew);
          for (const link of existingLinks) {
            await supabase
              .from('calendar_event_links')
              .update({ name: link.name, url: link.url })
              .eq('id', link.id);
          }

          // Insert new links
          const newLinks = usefulLinks.filter((l) => l.isNew);
          if (newLinks.length > 0) {
            await supabase.from('calendar_event_links').insert(
              newLinks.map((l) => ({
                event_id: event.id,
                name: l.name,
                url: l.url,
              })),
            );
          }
        }

        showToast('Evento atualizado com sucesso!', 'success');
        onEventUpdated?.();
        setTimeout(() => onClose(), 600);
      } else {
        showToast('Erro ao atualizar evento. Tente novamente.', 'error');
      }
    } catch (err) {
      console.error('updateEvent error:', err);
      showToast('Erro ao atualizar evento. Tente novamente.', 'error');
    } finally {
      setSaving(false);
      setPendingFormData(null);
    }
  };

  /* --------------------------------------------------------------------- */
  /* Link management                                                        */
  /* --------------------------------------------------------------------- */
  const handleAddLink = () => {
    if (newLink.name.trim() && newLink.url.trim()) {
      setUsefulLinks([
        ...usefulLinks,
        {
          id: `new-${Date.now()}`,
          name: newLink.name,
          url: newLink.url,
          isNew: true,
        },
      ]);
      setNewLink({ name: '', url: '' });
      setShowLinkForm(false);
    }
  };

  const handleCancelAddLink = () => {
    setNewLink({ name: '', url: '' });
    setShowLinkForm(false);
  };

  const handleStartEdit = (link: UsefulLink) => {
    setEditingLinkId(link.id);
    setEditingLink({ name: link.name, url: link.url });
  };

  const handleSaveEdit = (id: string) => {
    if (editingLink.name.trim() && editingLink.url.trim()) {
      setUsefulLinks(
        usefulLinks.map((link) =>
          link.id === id
            ? { ...link, name: editingLink.name, url: editingLink.url }
            : link,
        ),
      );
      setEditingLinkId(null);
      setEditingLink({ name: '', url: '' });
    }
  };

  const handleCancelEdit = () => {
    setEditingLinkId(null);
    setEditingLink({ name: '', url: '' });
  };

  const handleDeleteLink = (id: string) => {
    const link = usefulLinks.find((l) => l.id === id);
    if (link && !link.isNew) {
      setDeletedLinkIds((prev) => [...prev, id]);
    }
    setUsefulLinks(usefulLinks.filter((l) => l.id !== id));
  };

  /* --------------------------------------------------------------------- */
  /* Select arrow style                                                     */
  /* --------------------------------------------------------------------- */
  const selectArrowStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
    backgroundPosition: 'right 12px center',
  };

  /* --------------------------------------------------------------------- */
  /* Render                                                                 */
  /* --------------------------------------------------------------------- */
  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Toast */}
        {toast.show && (
          <div
            className={`fixed top-6 right-6 z-[60] px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 transition-all ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            <i
              className={`${
                toast.type === 'success'
                  ? 'ri-check-line'
                  : 'ri-error-warning-line'
              }`}
            ></i>
            {toast.message}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
                <i className="ri-edit-line text-xl text-teal-600 dark:text-teal-400"></i>
              </div>
              <h2
                className="text-xl font-bold text-gray-900 dark:text-white"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Editar Evento
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl text-gray-500 dark:text-gray-400"></i>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-5">
              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Título do Evento *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Ex: Reunião de Sprint Planning"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm"
                  required
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Evento *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                  style={selectArrowStyle}
                  required
                >
                  <option value="meeting">Reunião</option>
                  <option value="presentation">Apresentação</option>
                  <option value="review">Revisão</option>
                  <option value="workshop">Workshop</option>
                  <option value="training">Treinamento</option>
                  <option value="brainstorm">Brainstorm</option>
                  <option value="deadline">Prazo</option>
                </select>
              </div>

              {/* Data e Hora */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Data *
                  </label>
                  <DatePicker
                    value={formData.date}
                    onChange={(val) => setFormData({ ...formData, date: val })}
                    placeholder="Selecione a data"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Horário *
                  </label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm cursor-pointer"
                    required
                  />
                </div>
              </div>

              {/* Duração */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Duração
                </label>
                <select
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  className="w-full px-4 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                  style={selectArrowStyle}
                >
                  <option value="">Selecione a duração</option>
                  <option value="15min">15 minutos</option>
                  <option value="30min">30 minutos</option>
                  <option value="45min">45 minutos</option>
                  <option value="1h">1 hora</option>
                  <option value="1h30">1 hora e 30 minutos</option>
                  <option value="2h">2 horas</option>
                  <option value="3h">3 horas</option>
                  <option value="4h">4 horas</option>
                  <option value="dia-todo">Dia todo</option>
                </select>
              </div>

              {/* Recorrência */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30">
                <div className="flex items-center gap-2 mb-3">
                  <i className="ri-repeat-line text-teal-600 dark:text-teal-400"></i>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Recorrência
                  </label>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <select
                      name="recurrenceType"
                      value={formData.recurrenceType}
                      onChange={handleChange}
                      className="w-full px-4 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                      style={selectArrowStyle}
                    >
                      <option value="none">Não repete</option>
                      <option value="daily">Diário</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>

                  {formData.recurrenceType !== 'none' && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                          Termina em (opcional)
                        </label>
                        <DatePicker
                          value={formData.recurrenceEndDate}
                          onChange={(val) => setFormData({ ...formData, recurrenceEndDate: val })}
                          min={formData.date}
                          placeholder="Sem data de término"
                        />
                      </div>

                      <div className="flex items-start gap-2 p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg">
                        <i className="ri-information-line text-teal-600 dark:text-teal-400 text-sm mt-0.5"></i>
                        <p className="text-xs text-teal-700 dark:text-teal-300">
                          {getRecurrenceSummary()}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Local */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Local / Link
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Ex: Sala de reuniões 3 ou https://meet.google.com/..."
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm"
                />
              </div>

              {/* Participantes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Participantes
                </label>
                <input
                  type="text"
                  name="attendees"
                  value={formData.attendees}
                  onChange={handleChange}
                  placeholder="Ex: Maria Silva, João Santos, Ana Oliveira"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Separe os nomes por vírgula
                </p>
              </div>

              {/* Links Úteis */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Links Úteis
                  </label>
                  {!showLinkForm && (
                    <button
                      type="button"
                      onClick={() => setShowLinkForm(true)}
                      className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 text-sm font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <i className="ri-add-line"></i>Adicionar Link
                    </button>
                  )}
                </div>

                {loadingLinks ? (
                  <div className="flex items-center justify-center py-4">
                    <i className="ri-loader-4-line animate-spin text-teal-600 text-lg mr-2"></i>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Carregando links...
                    </span>
                  </div>
                ) : (
                  <>
                    {usefulLinks.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {usefulLinks.map((link) => (
                          <div
                            key={link.id}
                            className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700/50"
                          >
                            {editingLinkId === link.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editingLink.name}
                                  onChange={(e) =>
                                    setEditingLink({
                                      ...editingLink,
                                      name: e.target.value,
                                    })
                                  }
                                  placeholder="Nome do Link"
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm"
                                />
                                <input
                                  type="url"
                                  value={editingLink.url}
                                  onChange={(e) =>
                                    setEditingLink({
                                      ...editingLink,
                                      url: e.target.value,
                                    })
                                  }
                                  placeholder="https://..."
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(link.id)}
                                    className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    <i className="ri-check-line mr-1"></i>Salvar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    <i className="ri-close-line mr-1"></i>Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                    {link.name}
                                  </div>
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 text-xs truncate block cursor-pointer"
                                  >
                                    {link.url}
                                  </a>
                                </div>
                                <div className="flex items-center gap-1 ml-3">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(link)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                                    title="Editar"
                                  >
                                    <i className="ri-edit-line text-gray-600 dark:text-gray-400"></i>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLink(link.id)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                                    title="Excluir"
                                  >
                                    <i className="ri-delete-bin-line text-red-600 dark:text-red-400"></i>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {showLinkForm && (
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-700/50">
                        <input
                          type="text"
                          value={newLink.name}
                          onChange={(e) =>
                            setNewLink({ ...newLink, name: e.target.value })
                          }
                          placeholder="Nome do Link"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm"
                        />
                        <input
                          type="url"
                          value={newLink.url}
                          onChange={(e) =>
                            setNewLink({ ...newLink, url: e.target.value })
                          }
                          placeholder="https://..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleAddLink}
                            className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-add-line mr-1"></i>Adicionar
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelAddLink}
                            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-close-line mr-1"></i>Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Lembrete */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Lembrete
                </label>
                <select
                  name="reminder"
                  value={formData.reminder}
                  onChange={handleChange}
                  className="w-full px-4 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm appearance-none bg-no-repeat bg-right cursor-pointer"
                  style={selectArrowStyle}
                >
                  <option value="0">Sem lembrete</option>
                  <option value="5">5 minutos antes</option>
                  <option value="15">15 minutos antes</option>
                  <option value="30">30 minutos antes</option>
                  <option value="60">1 hora antes</option>
                  <option value="1440">1 dia antes</option>
                </select>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição / Agenda
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Adicione detalhes sobre a reunião, agenda, objetivos..."
                  rows={4}
                  maxLength={500}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm resize-none"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
                  {formData.description.length}/500
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <i className="ri-save-line"></i>
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Recurrence Edit Dialog */}
      {showRecurrenceDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                  <i className="ri-repeat-line text-2xl text-amber-600 dark:text-amber-400"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Editar Evento Recorrente
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Este é um evento recorrente
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
                Deseja aplicar as alterações em:
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => saveEvent('this')}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-left hover:border-teal-500 dark:hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center group-hover:bg-teal-100 dark:group-hover:bg-teal-900/30 transition-colors">
                      <i className="ri-calendar-line text-gray-600 dark:text-gray-300 group-hover:text-teal-600 dark:group-hover:text-teal-400"></i>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        Apenas este evento
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Altera somente esta ocorrência
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => saveEvent('future')}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-left hover:border-teal-500 dark:hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center group-hover:bg-teal-100 dark:group-hover:bg-teal-900/30 transition-colors">
                      <i className="ri-calendar-2-line text-gray-600 dark:text-gray-300 group-hover:text-teal-600 dark:group-hover:text-teal-400"></i>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        Este e futuros eventos
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Altera esta e todas as próximas ocorrências
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => saveEvent('all')}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-left hover:border-teal-500 dark:hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center group-hover:bg-teal-100 dark:group-hover:bg-teal-900/30 transition-colors">
                      <i className="ri-calendar-check-line text-gray-600 dark:text-gray-300 group-hover:text-teal-600 dark:group-hover:text-teal-400"></i>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        Todos os eventos
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Altera todas as ocorrências da série
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowRecurrenceDialog(false);
                  setPendingFormData(null);
                }}
                className="w-full mt-4 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
