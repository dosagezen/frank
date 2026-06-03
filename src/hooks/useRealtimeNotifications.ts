
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface RealtimeNotificationPayload {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  related_type: string | null;
  related_id: string | null;
  actor_id: string | null;
  created_at: string;
}

interface UseRealtimeNotificationsOptions {
  userId: string | undefined;
  onInsert?: (notification: RealtimeNotificationPayload) => void;
  onUpdate?: (notification: RealtimeNotificationPayload) => void;
  onDelete?: (old: { id: string }) => void;
}

/**
 * Hook que escuta mudanças em tempo real na tabela `notifications`
 * filtradas pelo user_id do usuário logado.
 */
export function useRealtimeNotifications({
  userId,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeNotificationsOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Refs estáveis para os callbacks
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  useEffect(() => {
    onInsertRef.current = onInsert;
  }, [onInsert]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onDeleteRef.current = onDelete;
  }, [onDelete]);

  useEffect(() => {
    if (!userId) return;

    // Limpa canal anterior se existir
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`notifications-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<RealtimeNotificationPayload>) => {
          if (payload.new && 'id' in payload.new) {
            onInsertRef.current?.(payload.new as RealtimeNotificationPayload);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<RealtimeNotificationPayload>) => {
          if (payload.new && 'id' in payload.new) {
            onUpdateRef.current?.(payload.new as RealtimeNotificationPayload);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        (payload: RealtimePostgresChangesPayload<RealtimeNotificationPayload>) => {
          if (payload.old && 'id' in payload.old) {
            onDeleteRef.current?.({ id: (payload.old as any).id });
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('🔔 [Realtime] Notificações em tempo real ativas');
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ [Realtime] Erro no canal de notificações');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);
}
