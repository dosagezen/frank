import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

// Exportar DEFAULT_AVATAR
export const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff&size=200';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  nome?: string;
  avatar_url?: string;
  role: 'admin' | 'member';
  cargo?: string;
  telefone?: string;
  departamento?: string;
  localizacao?: string;
  bio?: string;
  created_at: string;
}

interface UserProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfileField: (fields: Partial<UserProfile>) => void;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile({
          ...data,
          avatar_url: data.avatar_url || null
        });
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultProfile = async () => {
    if (!user?.id || !user?.email) return;

    try {
      const defaultProfile = {
        id: user.id,
        email: user.email,
        nome: user.email.split('@')[0],
        full_name: user.email.split('@')[0],
        role: 'member' as const,
        created_at: new Date().toISOString(),
      };

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(defaultProfile)
        .select()
        .maybeSingle();

      if (insertError) {
        console.error('Erro ao criar perfil:', insertError);
        
        // Se o erro for de permissão ou perfil já existe, tentar buscar novamente
        if (insertError.code === '23505' || insertError.code === '42501') {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          
          if (existingProfile) {
            setProfile(existingProfile);
          }
        }
      } else if (newProfile) {
        setProfile(newProfile);
      }
    } catch (err) {
      console.error('Erro inesperado ao criar perfil:', err);
    }
  };

  const refreshProfile = async () => {
    if (!user?.id) return;
    setFetchAttempted(false);
    await fetchProfile(user.id);
  };

  const updateProfileField = (fields: Partial<UserProfile>) => {
    if (!profile) return;
    
    setProfile({
      ...profile,
      ...fields,
    });
  };

  useEffect(() => {
    // Verificar se user existe antes de tentar acessar user.id
    if (!user?.id) {
      setLoading(false);
      setProfile(null);
      return;
    }

    // Reset fetch attempted quando o usuário mudar
    setFetchAttempted(false);
    fetchProfile(user.id);
  }, [user?.id]);

  return (
    <UserProfileContext.Provider value={{ profile, loading, refreshProfile, updateProfileField }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}
