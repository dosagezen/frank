import { useState } from 'react';
import { getInitials, getAvatarColor } from '../../services/teamService';

interface UserAvatarProps {
  avatarUrl?: string | null;
  nome: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-5 h-5 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-12 h-12 text-lg',
};

export default function UserAvatar({ 
  avatarUrl, 
  nome, 
  size = 'md',
  className = '' 
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  
  // Verificar se é uma URL válida e não é o avatar padrão genérico
  const isValidAvatar = avatarUrl && 
    avatarUrl.trim() !== '' && 
    !avatarUrl.includes('ui-avatars.com') && 
    !imageError;

  const initials = getInitials(nome);
  const avatarColor = getAvatarColor(nome);
  const sizeClass = sizeClasses[size];

  if (isValidAvatar) {
    return (
      <img
        src={avatarUrl}
        alt={nome}
        loading="lazy"
        onError={() => setImageError(true)}
        className={`${sizeClass} rounded-full object-cover ${className}`}
      />
    );
  }

  // Fallback para iniciais
  return (
    <div 
      className={`${sizeClass} ${avatarColor} rounded-full flex items-center justify-center text-white font-bold ${className}`}
    >
      {initials}
    </div>
  );
}