import { supabase } from '../lib/supabaseClient';

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  type: string;
  event_date: string;
  event_time: string;
  duration: string | null;
  location: string | null;
  description: string | null;
  attendees: string | null;
  reminder: string | null;
  color: string;
  recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrence_end_date: string | null;
  recurrence_parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventLink {
  id: string;
  event_id: string;
  name: string;
  url: string;
  created_at: string;
}

const typeColorMap: Record<string, string> = {
  meeting: 'bg-teal-500',
  presentation: 'bg-amber-500',
  review: 'bg-emerald-500',
  workshop: 'bg-orange-500',
  training: 'bg-cyan-500',
  brainstorm: 'bg-rose-500',
  deadline: 'bg-red-500',
};

export function getColorForType(type: string): string {
  return typeColorMap[type] || 'bg-teal-500';
}

/**
 * Converte uma string "YYYY-MM-DD" em um objeto Date sem conversão de fuso horário.
 * Usar new Date("YYYY-MM-DD") interpreta como UTC e pode causar deslocamento de 1 dia.
 */
function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formata um objeto Date para "YYYY-MM-DD" usando valores locais (sem UTC).
 */
function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Gera instâncias virtuais de um evento recorrente dentro de um intervalo de datas
 */
export function generateRecurrenceInstances(
  parentEvent: CalendarEvent,
  startDate: string,
  endDate: string
): CalendarEvent[] {
  if (parentEvent.recurrence_type === 'none') {
    return [parentEvent];
  }

  const instances: CalendarEvent[] = [];
  const start = parseDateLocal(startDate);
  const end = parseDateLocal(endDate);
  const recurrenceEnd = parentEvent.recurrence_end_date
    ? parseDateLocal(parentEvent.recurrence_end_date)
    : null;

  let currentDate = parseDateLocal(parentEvent.event_date);

  // Limite de segurança: máximo 365 instâncias
  let count = 0;
  const maxInstances = 365;

  while (currentDate <= end && count < maxInstances) {
    // Verifica se a data atual está dentro do range solicitado
    if (currentDate >= start && currentDate <= end) {
      // Verifica se não ultrapassou a data de término da recorrência
      if (!recurrenceEnd || currentDate <= recurrenceEnd) {
        const instanceDate = formatDateLocal(currentDate);

        instances.push({
          ...parentEvent,
          id: `${parentEvent.id}_recur_${instanceDate}`,
          event_date: instanceDate,
          recurrence_parent_id: parentEvent.id,
        });
      }
    }

    // Avança para a próxima ocorrência
    switch (parentEvent.recurrence_type) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }

    count++;
  }

  return instances;
}

export async function fetchEvents(userId: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });

  if (error) {
    console.error('Erro ao buscar eventos:', error);
    return [];
  }
  return data ?? [];
}

export async function fetchEventsForMonth(
  userId: string,
  year: number,
  month: number
): Promise<CalendarEvent[]> {
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(
    lastDay
  ).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });

  if (error) {
    console.error('Erro ao buscar eventos do mês:', error);
    return [];
  }
  return data ?? [];
}

export async function fetchEventsForRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });

  if (error) {
    console.error('Erro ao buscar eventos do intervalo:', error);
    return [];
  }
  return data ?? [];
}

export async function createEvent(
  userId: string,
  eventData: {
    title: string;
    type: string;
    event_date: string;
    event_time: string;
    duration?: string;
    location?: string;
    description?: string;
    attendees?: string;
    reminder?: string;
    recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly';
    recurrence_end_date?: string;
  },
  links?: { name: string; url: string }[]
): Promise<CalendarEvent | null> {
  const color = getColorForType(eventData.type);

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      user_id: userId,
      title: eventData.title,
      type: eventData.type,
      event_date: eventData.event_date,
      event_time: eventData.event_time,
      duration: eventData.duration ?? null,
      location: eventData.location ?? null,
      description: eventData.description ?? null,
      attendees: eventData.attendees ?? null,
      reminder: eventData.reminder ?? '15',
      recurrence_type: eventData.recurrence_type ?? 'none',
      recurrence_end_date: eventData.recurrence_end_date ?? null,
      recurrence_parent_id: null,
      color,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Erro ao criar evento:', error);
    return null;
  }

  if (data && links && links.length > 0) {
    const linksToInsert = links.map((link) => ({
      event_id: data.id,
      name: link.name,
      url: link.url,
    }));

    const { error: linksError } = await supabase
      .from('calendar_event_links')
      .insert(linksToInsert);

    if (linksError) {
      console.error('Erro ao salvar links:', linksError);
    }
  }

  return data ?? null;
}

export async function deleteEvent(eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', eventId);

  if (error) {
    console.error('Erro ao excluir evento:', error);
    return false;
  }
  return true;
}

export async function updateEvent(
  eventId: string,
  eventData: Partial<{
    title: string;
    type: string;
    event_date: string;
    event_time: string;
    duration: string;
    location: string;
    description: string;
    attendees: string;
    reminder: string;
    recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly';
    recurrence_end_date: string;
  }>
): Promise<CalendarEvent | null> {
  const updatePayload: Record<string, unknown> = {
    ...eventData,
    updated_at: new Date().toISOString(),
  };

  if (eventData.type) {
    updatePayload.color = getColorForType(eventData.type);
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .update(updatePayload)
    .eq('id', eventId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Erro ao atualizar evento:', error);
    return null;
  }

  return data ?? null;
}

export async function fetchEventLinks(eventId: string): Promise<CalendarEventLink[]> {
  const { data, error } = await supabase
    .from('calendar_event_links')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar links do evento:', error);
    return [];
  }
  return data ?? [];
}
