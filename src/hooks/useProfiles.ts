import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCachedData } from './useCachedData';
import { supabase } from '../lib/supabaseClient';

interface Profile {
  id: string;
  nome: string;
  avatar_url: string | null;
  email?: string;
}

/**
 * Hook compartilhado para buscar profiles com cache de 15 minutos
 * Evita queries redundantes ao Supabase
 */
export function useProfiles() {
  const { user } = useAuth();

  const fetchProfiles = useCallback(async (): Promise<Profile[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nome, avatar_url, email')
      .order('nome', { ascending: true });

    if (error) {
      console.error('Erro ao buscar profiles:', error);
      return [];
    }

    return data || [];
  }, []);

  return useCachedData<Profile[]>(
    'profiles_list',
    fetchProfiles,
    { 
      ttl: 15 * 60 * 1000, // 15 minutos
      enabled: !!user 
    }
  );
}