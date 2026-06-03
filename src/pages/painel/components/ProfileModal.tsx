import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useUserProfile, DEFAULT_AVATAR } from '../../../contexts/UserProfileContext';
import { supabase } from '../../../lib/supabaseClient';
import { fetchEmailLog, formatTimeAgo } from '../../../services/notificationsService';
import { syncProfileToProjectMembers, syncProfileToTaskComments } from '../../../services/projectsService';
import { useToast } from '../../../contexts/ToastContext';
import UserAvatar from '../../../components/base/UserAvatar';

// Função para aplicar máscara de telefone
const applyPhoneMask = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const limited = digits.slice(0, 11);
  
  if (limited.length === 0) return '';
  if (limited.length <= 2) return `(${limited}`;
  if (limited.length <= 7) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}.${limited.slice(7)}`;
};

// Extrair apenas dígitos
const extractDigits = (value: string): string => {
  return value.replace(/\D/g, '');
};

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState('perfil');
  const { theme, setTheme } = useTheme();
  const { user, signOut, isAdmin } = useAuth();
  const { profile, refreshProfile, updateProfileField } = useUserProfile();
  const navigate = useNavigate();
  const [profileImage, setProfileImage] = useState(DEFAULT_AVATAR);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showRemovePhotoModal, setShowRemovePhotoModal] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const { showToast } = useToast();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState('');
  const [deleteInputCode, setDeleteInputCode] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const [emailLogs, setEmailLogs] = useState<Array<{ id: string; email_type: string; subject: string; sent_at: string; status: string }>>([]);
  const [isLoadingEmailLogs, setIsLoadingEmailLogs] = useState(false);
  const [showEmailHistory, setShowEmailHistory] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<'success' | 'error' | null>(null);
  const [testEmailError, setTestEmailError] = useState<{ error?: string; hint?: string } | null>(null);

  // Gerar código aleatório único (3 números + 4 letras maiúsculas)
  const generateDeleteCode = useCallback((): string => {
    const numbers = Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('');
    const letters = Array.from({ length: 4 }, () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      return chars[Math.floor(Math.random() * chars.length)];
    }).join('');
    // Embaralhar a combinação
    const combined = (numbers + letters).split('');
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    return combined.join('');
  }, []);

  const handleOpenDeleteAccountModal = () => {
    const newCode = generateDeleteCode();
    setDeleteConfirmCode(newCode);
    setDeleteInputCode('');
    setCodeCopied(false);
    setShowDeleteAccountModal(true);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(deleteConfirmCode);
      setCodeCopied(true);
      showToast('Código copiado!', 'success');
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      showToast('Erro ao copiar código.', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteInputCode !== deleteConfirmCode) return;

    setIsDeletingAccount(true);

    try {
      // Remover avatar do storage se existir
      if (profile?.avatar_url && profile.avatar_url.includes('/avatars/')) {
        const pathMatch = profile.avatar_url.split('/avatars/').pop();
        if (pathMatch) {
          await supabase.storage.from('avatars').remove([decodeURIComponent(pathMatch)]);
        }
      }

      // Remover dados relacionados do usuário
      await supabase.from('task_comments').delete().eq('user_id', user.id);
      await supabase.from('project_members').delete().eq('user_id', user.id);
      await supabase.from('notifications').delete().eq('user_id', user.id);
      await supabase.from('calendar_events').delete().eq('user_id', user.id);
      await supabase.from('files').delete().eq('uploaded_by', user.id);
      await supabase.from('email_notifications_log').delete().eq('user_id', user.id);
      await supabase.from('project_activity_log').delete().eq('user_id', user.id);

      // Remover perfil
      await supabase.from('profiles').delete().eq('id', user.id);

      // Fazer logout
      await signOut();

      showToast('Conta excluída com sucesso.', 'success');
      setShowDeleteAccountModal(false);
      handleCloseModal();
      navigate('/login');
    } catch (err) {
      console.error('Erro ao excluir conta:', err);
      showToast('Erro ao excluir conta. Tente novamente.', 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const [formData, setFormData] = useState({
    nome: '',
    email: user?.email || '',
    cargo: '',
    telefone: '',
    departamento: '',
    localizacao: '',
    bio: '',
    notificacoes_email: true,
    notificacoes_push: true,
    notificacoes_tarefas: true,
    resumo_diario: false,
    idioma: 'pt-BR',
    fuso_horario: 'America/Sao_Paulo',
    aniversario: '',
    email_notificacao: '',
  });

  const [privacySettings, setPrivacySettings] = useState({
    perfil_publico: true,
    mostrar_email: false,
    mostrar_telefone: false,
    permitir_mensagens: true,
    compartilhar_atividade: true,
    autenticacao_dois_fatores: false,
    sessoes_ativas: true,
    historico_login: true,
  });

  // Carregar perfil real do Supabase - CORRIGIDO
  useEffect(() => {
    if (!isOpen || !user) {
      return;
    }

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const loadProfile = async () => {
      setIsLoading(true);

      // Timeout de segurança - força o fim do loading após 3 segundos
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('Timeout ao carregar perfil, usando dados padrão');
          setFormData((prev) => ({
            ...prev,
            nome:
              profile?.nome ||
              user.user_metadata?.nome ||
              user.user_metadata?.name ||
              user.email?.split('@')[0] ||
              'Usuário',
            email: user.email || '',
          }));
          setProfileImage(profile?.avatar_url || DEFAULT_AVATAR);
          setIsLoading(false);
        }
      }, 3000);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (!isMounted) return;

        clearTimeout(timeoutId);

        if (error) {
          console.error('Erro ao carregar perfil:', error);
          setFormData((prev) => ({
            ...prev,
            nome:
              profile?.nome ||
              user.user_metadata?.nome ||
              user.user_metadata?.name ||
              user.email?.split('@')[0] ||
              'Usuário',
            email: user.email || '',
          }));
          setProfileImage(profile?.avatar_url || DEFAULT_AVATAR);
        } else if (data) {
          setFormData({
            nome:
              data.nome ||
              user.user_metadata?.nome ||
              user.email?.split('@')[0] ||
              'Usuário',
            email: user.email || '',
            cargo: data.cargo || '',
            telefone: data.telefone || '',
            departamento: data.departamento || '',
            localizacao: data.localizacao || '',
            bio: data.bio || '',
            notificacoes_email: data.notificacoes_email ?? true,
            notificacoes_push: data.notificacoes_push ?? true,
            notificacoes_tarefas: data.notificacoes_tarefas ?? true,
            resumo_diario: data.resumo_diario ?? false,
            idioma: data.idioma || 'pt-BR',
            fuso_horario: data.fuso_horario || 'America/Sao_Paulo',
            aniversario: data.aniversario || '',
            email_notificacao: data.email_notificacao || '',
          });
          setPrivacySettings((prev) => ({
            ...prev,
            perfil_publico: data.perfil_publico ?? true,
            mostrar_email: data.mostrar_email ?? false,
            mostrar_telefone: data.mostrar_telefone ?? false,
            permitir_mensagens: data.permitir_mensagens ?? true,
            compartilhar_atividade: data.compartilhar_atividade ?? true,
          }));
          setProfileImage(data.avatar_url || DEFAULT_AVATAR);
        } else {
          setFormData((prev) => ({
            ...prev,
            nome:
              profile?.nome ||
              user.user_metadata?.nome ||
              user.user_metadata?.name ||
              user.email?.split('@')[0] ||
              'Usuário',
            email: user.email || '',
          }));
          setProfileImage(profile?.avatar_url || DEFAULT_AVATAR);
        }
      } catch (err) {
        if (!isMounted) return;
        
        clearTimeout(timeoutId);
        console.error('Erro inesperado:', err);
        setFormData((prev) => ({
          ...prev,
          nome:
            profile?.nome ||
            user.user_metadata?.nome ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Usuário',
          email: user.email || '',
        }));
        setProfileImage(profile?.avatar_url || DEFAULT_AVATAR);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isOpen, user?.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      showToast('Por favor, selecione apenas arquivos de imagem', 'warning');
      return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('A imagem deve ter no máximo 5MB', 'warning');
      return;
    }

    try {
      // Preview imediato
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload para Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar_${Date.now()}.${fileExt}`;

      // Fazer upload para o bucket 'avatars'
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type 
        });

      if (uploadError) {
        console.error('Erro ao fazer upload do avatar:', uploadError);
        
        if (uploadError.message.includes('not found')) {
          console.log('Tentando criar bucket avatars...');
          // Tentar fazer upload novamente (o sistema pode criar automaticamente)
          const { error: retryError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { 
              upsert: true,
              contentType: file.type 
            });
          
          if (retryError) {
            showToast('Erro ao salvar imagem. Verifique as permissões do Storage.', 'error');
            return;
          }
        } else {
          showToast('Erro ao salvar imagem. Tente novamente.', 'error');
          return;
        }
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Atualizar avatar_url no perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Erro ao atualizar avatar no banco:', updateError);
        showToast('Erro ao salvar foto no perfil. Tente novamente.', 'error');
        return;
      }

      // Atualizar estado local
      setProfileImage(publicUrl);
      
      // Atualizar contexto global imediatamente para replicar em todo o app
      updateProfileField({ avatar_url: publicUrl });
      
      // Forçar refresh do perfil para garantir sincronização
      await refreshProfile();

      // 🔥 SINCRONIZAR avatar em project_members e task_comments
      try {
        await syncProfileToProjectMembers(
          user.id,
          formData.nome,
          publicUrl,
          formData.cargo
        );
        await syncProfileToTaskComments(user.id, formData.nome, publicUrl);
        console.log('✅ Avatar sincronizado em todos os locais');
      } catch (syncError) {
        console.error('⚠️ Erro ao sincronizar avatar:', syncError);
        // Não bloquear o fluxo se a sincronização falhar
      }

      showToast('Foto atualizada com sucesso!', 'success');
    } catch (err) {
      console.error('Erro inesperado ao fazer upload:', err);
      showToast('Erro inesperado ao salvar imagem. Tente novamente.', 'error');
    }
  };

  const handleRemovePhoto = async () => {
    if (!user) return;
    setRemovingPhoto(true);

    try {
      // Tentar remover arquivo do storage
      if (profile?.avatar_url && profile.avatar_url.includes('/avatars/')) {
        const pathMatch = profile.avatar_url.split('/avatars/').pop();
        if (pathMatch) {
          await supabase.storage.from('avatars').remove([decodeURIComponent(pathMatch)]);
        }
      }

      // Atualizar avatar_url para null no banco
      const { error } = await supabase
        .from('profiles')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Erro ao remover foto:', error);
        return;
      }

      // Atualizar estado local
      setProfileImage(DEFAULT_AVATAR);

      // Atualizar contexto global
      updateProfileField({ avatar_url: null });

      // Forçar refresh do perfil
      await refreshProfile();

      // 🔥 SINCRONIZAR remoção do avatar em project_members e task_comments
      try {
        await syncProfileToProjectMembers(
          user.id,
          formData.nome,
          null,
          formData.cargo
        );
        await syncProfileToTaskComments(user.id, formData.nome, null);
        console.log('✅ Remoção de avatar sincronizada em todos os locais');
      } catch (syncError) {
        console.error('⚠️ Erro ao sincronizar remoção de avatar:', syncError);
        // Não bloquear o fluxo se a sincronização falhar
      }

      setShowRemovePhotoModal(false);
    } catch (err) {
      console.error('Erro inesperado ao remover foto:', err);
    } finally {
      setRemovingPhoto(false);
    }
  };

  const validatePassword = (password: string): boolean => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return minLength && hasUpperCase && hasNumber && hasSpecialChar;
  };

  // Alteração de senha REAL via Supabase
  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess(false);
    setPasswordLoading(true);

    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setPasswordError('Por favor, preencha todos os campos');
      setPasswordLoading(false);
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setPasswordError('A nova senha deve ser diferente da senha atual');
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('As senhas não coincidem');
      setPasswordLoading(false);
      return;
    }

    if (!validatePassword(passwordData.newPassword)) {
      setPasswordError('A senha não atende aos requisitos de segurança');
      setPasswordLoading(false);
      return;
    }

    try {
      // Verificar senha atual fazendo login novamente
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: passwordData.currentPassword,
      });

      if (signInError) {
        setPasswordError('Senha atual incorreta');
        setPasswordLoading(false);
        return;
      }

      // Atualizar senha via Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message || 'Erro ao alterar senha');
        setPasswordLoading(false);
        return;
      }

      setPasswordSuccess(true);
      showToast('Senha alterada com sucesso!', 'success');
      setTimeout(() => {
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setPasswordSuccess(false);
        setShowChangePasswordModal(false);
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      }, 2000);
    } catch (err) {
      setPasswordError('Erro inesperado ao alterar senha');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handle2FAToggle = () => {
    setShow2FAModal(true);
    setVerificationCode('');
    setCodeError('');
  };

  const handleActivate2FA = () => {
    setCodeError('');
    if (verificationCode.trim() === '') {
      setCodeError('Por favor, digite o código de verificação');
      return;
    }
    if (verificationCode !== '123456') {
      setCodeError('Código inválido. Tente novamente.');
      return;
    }
    setTwoFactorEnabled(true);
    setTimeout(() => {
      setShow2FAModal(false);
      setVerificationCode('');
    }, 1500);
  };

  const handleDeactivate2FA = () => {
    setTwoFactorEnabled(false);
    setShow2FAModal(false);
  };

  // Salvar perfil REAL no Supabase
  const handleSave = async () => {
    if (!user) {
      setSaveError('Usuário não autenticado');
      return;
    }

    // Validação básica
    if (!formData.nome || formData.nome.trim() === '') {
      setSaveError('O nome é obrigatório');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      // Preparar dados para atualização
      const updateData = {
        nome: formData.nome.trim(),
        cargo: formData.cargo.trim(),
        telefone: formData.telefone.trim(),
        departamento: formData.departamento,
        localizacao: formData.localizacao.trim(),
        bio: formData.bio.trim(),
        notificacoes_email: formData.notificacoes_email,
        notificacoes_push: formData.notificacoes_push,
        notificacoes_tarefas: formData.notificacoes_tarefas,
        resumo_diario: formData.resumo_diario,
        idioma: formData.idioma,
        fuso_horario: formData.fuso_horario,
        aniversario: formData.aniversario.trim(),
        email_notificacao: formData.notificacoes_email ? formData.email_notificacao.trim() : '',
        updated_at: new Date().toISOString(),
      };

      console.log('🔄 Salvando perfil...', { userId: user.id, updateData });

      // Verificar se o perfil existe
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (checkError) {
        console.error('❌ Erro ao verificar perfil:', checkError);
        setSaveError('Erro ao verificar perfil. Tente novamente.');
        setIsSaving(false);
        return;
      }

      let profileError;

      if (existingProfile) {
        // Perfil existe - fazer UPDATE
        console.log('✏️ Atualizando perfil existente...');
        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id);
        profileError = error;
      } else {
        // Perfil não existe - fazer INSERT
        console.log('➕ Criando novo perfil...');
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            ...updateData,
            role: 'member',
            created_at: new Date().toISOString(),
          });
        profileError = error;
      }

      if (profileError) {
        console.error('❌ Erro ao salvar perfil no banco:', profileError);
        
        // Mensagens de erro mais específicas
        if (profileError.code === '23505') {
          setSaveError('Já existe um perfil com estes dados.');
        } else if (profileError.code === '42501') {
          setSaveError('Você não tem permissão para atualizar este perfil.');
        } else if (profileError.message) {
          setSaveError(`Erro: ${profileError.message}`);
        } else {
          setSaveError('Erro ao salvar perfil. Tente novamente.');
        }
        
        setIsSaving(false);
        return;
      }

      console.log('✅ Perfil salvo no banco com sucesso');

      // Atualizar user_metadata no Supabase Auth (não crítico)
      try {
        await supabase.auth.updateUser({
          data: {
            nome: formData.nome,
            cargo: formData.cargo,
            telefone: formData.telefone,
            departamento: formData.departamento,
            localizacao: formData.localizacao,
            bio: formData.bio,
          },
        });
        console.log('✅ Metadados do usuário atualizados');
      } catch (metaError) {
        console.warn('⚠️ Erro ao atualizar metadados (não crítico):', metaError);
      }

      // Atualizar contexto global do perfil
      try {
        await refreshProfile();
        console.log('✅ Contexto do perfil atualizado');
      } catch (refreshError) {
        console.warn('⚠️ Erro ao atualizar contexto (não crítico):', refreshError);
      }

      // 🔥 SINCRONIZAR dados do perfil em project_members e task_comments
      try {
        await syncProfileToProjectMembers(
          user.id,
          formData.nome,
          profile?.avatar_url || null,
          formData.cargo
        );
        await syncProfileToTaskComments(
          user.id,
          formData.nome,
          profile?.avatar_url || null
        );
        console.log('✅ Perfil sincronizado em todos os locais');
      } catch (syncError) {
        console.warn('⚠️ Erro ao sincronizar perfil (não crítico):', syncError);
        // Não bloquear o fluxo se a sincronização falhar
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('❌ Erro inesperado ao salvar:', err);
      setSaveError('Erro inesperado ao salvar. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Salvar configurações de privacidade
  const handleSavePrivacy = async () => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({
          perfil_publico: privacySettings.perfil_publico,
          mostrar_email: privacySettings.mostrar_email,
          mostrar_telefone: privacySettings.mostrar_telefone,
          permitir_mensagens: privacySettings.permitir_mensagens,
          compartilhar_atividade: privacySettings.compartilhar_atividade,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      setShowPrivacyModal(false);
    } catch (err) {
      console.error('Erro ao salvar privacidade:', err);
    }
  };

  const handleCloseModal = () => {
    setSaveError('');
    setSaveSuccess(false);
    onClose();
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCloseModal();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handlePrivacyChange = (field: string, value: boolean) => {
    setPrivacySettings({ ...privacySettings, [field]: value });
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setShowLogoutModal(false);
      handleCloseModal();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // Carregar histórico de e-mails quando abrir a aba de configurações
  useEffect(() => {
    if (activeTab === 'configuracoes' && user?.id && showEmailHistory) {
      setIsLoadingEmailLogs(true);
      fetchEmailLog(user.id).then(logs => {
        setEmailLogs(logs);
        setIsLoadingEmailLogs(false);
      });
    }
  }, [activeTab, user?.id, showEmailHistory]);

  const handleSendTestEmail = async () => {
    if (!user) return;
    setIsSendingTestEmail(true);
    setTestEmailResult(null);
    setTestEmailError(null);

    const destinatario = (formData.email_notificacao || '').trim() || formData.email;
    if (!destinatario) {
      setTestEmailResult('error');
      setTestEmailError({ error: 'Nenhum e-mail de destino configurado.' });
      setIsSendingTestEmail(false);
      return;
    }

    const { sendEmailNotification } = await import('../../../services/notificationsService');
    const result = await sendEmailNotification({
      userId: user.id,
      type: 'test',
      title: '✅ Teste de notificação',
      message: `Olá! Este é um e-mail de teste enviado pelo TaskFlow para confirmar que as notificações estão funcionando corretamente para o endereço ${destinatario}.`,
      recipientEmail: destinatario,
      recipientName: formData.nome || 'Usuário',
    });

    if (result.success) {
      setTestEmailResult('success');
      setTestEmailError(null);
    } else {
      setTestEmailResult('error');
      setTestEmailError({ error: result.error, hint: result.hint });
    }

    setIsSendingTestEmail(false);
    setTimeout(() => {
      setTestEmailResult(null);
      setTestEmailError(null);
    }, 12000);
  };

  // Não renderizar nada se o modal não estiver aberto
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            handleCloseModal();
          }
        }}
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h2
              className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate pr-2"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Meu Perfil
            </h2>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCloseModal();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all cursor-pointer flex-shrink-0"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Carregando perfil...
                </p>
              </div>
            ) : (
              <>
                {/* Feedback de sucesso/erro */}
                {saveSuccess && (
                  <div className="mb-4 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
                    <i className="ri-checkbox-circle-line text-green-600 dark:text-green-400 text-xl"></i>
                    <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                      Perfil salvo com sucesso!
                    </p>
                  </div>
                )}
                {saveError && (
                  <div className="mb-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
                    <i className="ri-error-warning-line text-red-600 dark:text-red-400 text-xl"></i>
                    <p className="text-sm text-red-800 dark:text-red-300">
                      {saveError}
                    </p>
                  </div>
                )}

                {/* Profile Header */}
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-gray-100 dark:border-gray-700">
                      <UserAvatar
                        avatarUrl={profileImage}
                        nome={formData.nome}
                        size="xl"
                        className="w-full h-full"
                      />
                    </div>
                    <input
                      type="file"
                      id="profile-upload"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1">
                      <button
                        onClick={() =>
                          document.getElementById('profile-upload')?.click()
                        }
                        className="w-7 h-7 sm:w-8 sm:h-8 bg-teal-600 rounded-full flex items-center justify-center text-white hover:bg-teal-700 transition-colors shadow-md cursor-pointer"
                        title="Alterar foto"
                      >
                        <i className="ri-camera-line text-xs sm:text-sm"></i>
                      </button>
                      {profileImage && profileImage !== DEFAULT_AVATAR && (
                        <button
                          onClick={() => setShowRemovePhotoModal(true)}
                          className="w-7 h-7 sm:w-8 sm:h-8 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-md cursor-pointer"
                          title="Remover foto"
                        >
                          <i className="ri-delete-bin-line text-xs sm:text-sm"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 text-center sm:text-left min-w-0 w-full sm:w-auto">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                      <h3
                        className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        {formData.nome}
                      </h3>
                      {isAdmin && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0">
                          <i className="ri-shield-star-fill text-[10px]"></i>
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-2 truncate">
                      {formData.cargo}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 truncate">
                      {formData.email}
                    </p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 sm:gap-2 mb-6 sm:mb-8 border-b border-gray-200 dark:border-gray-700 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                  <button
                    onClick={() => setActiveTab('perfil')}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap cursor-pointer flex-shrink-0 ${
                      activeTab === 'perfil'
                        ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <i className="ri-user-line mr-1 sm:mr-2"></i>
                    Perfil
                  </button>
                  <button
                    onClick={() => setActiveTab('configuracoes')}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap cursor-pointer flex-shrink-0 ${
                      activeTab === 'configuracoes'
                        ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <i className="ri-settings-3-line mr-1 sm:mr-2"></i>
                    Configurações
                  </button>
                  <button
                    onClick={() => setActiveTab('seguranca')}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap cursor-pointer flex-shrink-0 ${
                      activeTab === 'seguranca'
                        ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <i className="ri-shield-line mr-1 sm:mr-2"></i>
                    Segurança
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'perfil' && (
                  <div className="space-y-4 sm:space-y-6">

                    {/* Linha 1: Nome e Aniversário */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="min-w-0">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Nome e Sobrenome
                        </label>
                        <input
                          type="text"
                          value={formData.nome}
                          onChange={(e) =>
                            setFormData({ ...formData, nome: e.target.value })
                          }
                          placeholder="Ex: João Silva"
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm sm:text-base min-w-0"
                        />
                      </div>

                      <div className="min-w-0">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Aniversário
                        </label>
                        <input
                          type="text"
                          value={formData.aniversario}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
                            let formatted = raw;
                            if (raw.length > 2) {
                              formatted = `${raw.slice(0, 2)}/${raw.slice(2)}`;
                            }
                            setFormData({ ...formData, aniversario: formatted });
                          }}
                          onKeyDown={(e) => {
                            const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
                            if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
                            if (!/\d/.test(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          placeholder="Ex: 15/07"
                          maxLength={5}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm sm:text-base min-w-0"
                        />
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Formato: dd/mm
                        </p>
                      </div>
                    </div>

                    {/* Linha 2: Cargo e Telefone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="min-w-0">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Cargo/ Função
                        </label>
                        <input
                          type="text"
                          value={formData.cargo}
                          onChange={(e) =>
                            setFormData({ ...formData, cargo: e.target.value })
                          }
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm sm:text-base min-w-0"
                        />
                      </div>

                      <div className="min-w-0">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Telefone
                        </label>
                        <input
                          type="tel"
                          value={applyPhoneMask(formData.telefone)}
                          onChange={(e) => {
                            const rawInput = e.target.value;
                            const currentDigits = extractDigits(formData.telefone);
                            const newDigits = extractDigits(rawInput);
                            
                            // Detectar se o usuário digitou caractere não numérico
                            const lastChar = rawInput.slice(-1);
                            const isDeleting = newDigits.length < currentDigits.length;
                            
                            if (!isDeleting && lastChar && !/\d/.test(lastChar) && !['(', ')', ' ', '.', '-'].includes(lastChar)) {
                              showToast('Digite apenas números no campo de telefone.', 'warning');
                              return;
                            }
                            
                            setFormData({
                              ...formData,
                              telefone: newDigits.slice(0, 11),
                            });
                          }}
                          onKeyDown={(e) => {
                            const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
                            if (allowedKeys.includes(e.key)) return;
                            if (e.ctrlKey || e.metaKey) return;
                            if (!/\d/.test(e.key)) {
                              e.preventDefault();
                              showToast('Digite apenas números no campo de telefone.', 'warning');
                            }
                          }}
                          placeholder="(81) 98888.8888"
                          maxLength={16}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm sm:text-base min-w-0"
                        />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Biografia
                      </label>
                      <textarea
                        value={formData.bio}
                        onChange={(e) => {
                          if (e.target.value.length <= 500) {
                            setFormData({ ...formData, bio: e.target.value });
                          }
                        }}
                        rows={4}
                        maxLength={500}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent resize-none text-sm sm:text-base min-w-0"
                        placeholder="Conte um pouco sobre você..."
                      />
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
                        {formData.bio.length}/500
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'configuracoes' && (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Aparência */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
                      <h3
                        className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        Aparência
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Personalize o visual do seu perfil
                      </p>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Tema
                          </label>
                          <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <button
                              onClick={() => setTheme('light')}
                              className={`p-3 sm:p-4 border-2 rounded-lg transition-all cursor-pointer ${
                                theme === 'light'
                                  ? 'border-teal-600 bg-teal-50 dark:bg-teal-900/20'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                              }`}
                            >
                              <i
                                className={`ri-sun-line text-2xl sm:text-3xl mb-2 ${
                                  theme === 'light'
                                    ? 'text-teal-600'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              ></i>
                              <p
                                className={`text-xs sm:text-sm font-medium ${
                                  theme === 'light'
                                    ? 'text-teal-600'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                Claro
                              </p>
                            </button>
                            <button
                              onClick={() => setTheme('dark')}
                              className={`p-3 sm:p-4 border-2 rounded-lg transition-all cursor-pointer ${
                                theme === 'dark'
                                  ? 'border-teal-600 bg-teal-900/20'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                              }`}
                            >
                              <i
                                className={`ri-moon-line text-2xl sm:text-3xl mb-2 ${
                                  theme === 'dark'
                                    ? 'text-teal-400'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              ></i>
                              <p
                                className={`text-xs sm:text-sm font-medium ${
                                  theme === 'dark'
                                    ? 'text-teal-400'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                Escuro
                              </p>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notificações por E-mail */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
                      <div className="flex items-center gap-2 mb-1">
                        <i className="ri-mail-send-line text-lg text-teal-600 dark:text-teal-400"></i>
                        <h3
                          className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white"
                          style={{ fontFamily: 'Poppins, sans-serif' }}
                        >
                          Notificações por E-mail
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Receba alertas importantes diretamente no seu e-mail ({formData.email})
                      </p>
                      <div className="space-y-4">
                        {/* Toggle principal */}
                        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-600/50 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                              <i className="ri-mail-line text-base text-teal-600 dark:text-teal-400"></i>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Ativar e-mails
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Controle geral de envio de e-mails
                              </p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={formData.notificacoes_email}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  notificacoes_email: e.target.checked,
                                })
                              }
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                          </label>
                        </div>

                        {/* Campo de e-mail para notificações — aparece só quando o toggle está ativo */}
                        {formData.notificacoes_email && (
                          <div className="px-1 pb-1 animate-fade-in">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                              E-mail para receber notificações
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <i className="ri-mail-send-line text-sm text-teal-500 dark:text-teal-400"></i>
                              </div>
                              <input
                                type="email"
                                value={formData.email_notificacao}
                                onChange={(e) =>
                                  setFormData({ ...formData, email_notificacao: e.target.value })
                                }
                                placeholder={formData.email || 'seu@email.com'}
                                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm"
                              />
                            </div>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5 flex items-start gap-1">
                              <i className="ri-information-line text-xs mt-0.5 flex-shrink-0"></i>
                              Pode ser diferente do seu e-mail de login. Todos os e-mails de notificação serão enviados exclusivamente para este endereço.
                            </p>

                            {/* Botão de teste */}
                            <div className="mt-3">
                              <button
                                onClick={handleSendTestEmail}
                                disabled={isSendingTestEmail}
                                className="flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                {isSendingTestEmail ? (
                                  <>
                                    <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                                    Enviando...
                                  </>
                                ) : (
                                  <>
                                    <i className="ri-send-plane-line text-sm"></i>
                                    Testar envio de e-mail
                                  </>
                                )}
                              </button>

                              {testEmailResult === 'success' && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                                  <i className="ri-checkbox-circle-line text-sm flex-shrink-0"></i>
                                  E-mail de teste enviado! Verifique sua caixa de entrada (e o spam).
                                </div>
                              )}
                              {testEmailResult === 'error' && (
                                <div className="mt-2 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 space-y-1.5">
                                  <div className="flex items-start gap-2 text-red-700 dark:text-red-400 font-medium">
                                    <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5"></i>
                                    <span>Falha ao enviar o e-mail de teste.</span>
                                  </div>
                                  {testEmailError?.error && (
                                    <p className="text-red-600 dark:text-red-400 pl-5">
                                      <strong>Motivo:</strong> {testEmailError.error}
                                    </p>
                                  )}
                                  {testEmailError?.hint && (
                                    <p className="text-red-500 dark:text-red-400/80 pl-5 leading-relaxed">
                                      <strong>Como resolver:</strong> {testEmailError.hint}
                                    </p>
                                  )}
                                  {!testEmailError?.hint && (
                                    <p className="text-red-500 dark:text-red-400/80 pl-5">
                                      Verifique se a chave RESEND_API_KEY está correta no Supabase e se o e-mail de destino é válido.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Sub-opções (desabilitadas se o toggle principal estiver off) */}
                        <div className={`space-y-3 pl-2 ${!formData.notificacoes_email ? 'opacity-40 pointer-events-none' : ''}`}>
                          {/* Tarefas */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 flex items-center justify-center rounded-md bg-amber-50 dark:bg-amber-900/20">
                                <i className="ri-task-line text-sm text-amber-600 dark:text-amber-400"></i>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  Tarefas e Prazos
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Atribuições, prazos próximos, atrasos e comentários
                                </p>
                              </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={formData.notificacoes_tarefas}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    notificacoes_tarefas: e.target.checked,
                                  })
                                }
                              />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                            </label>
                          </div>

                          {/* Push */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 flex items-center justify-center rounded-md bg-sky-50 dark:bg-sky-900/20">
                                <i className="ri-notification-3-line text-sm text-sky-600 dark:text-sky-400"></i>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  Notificações Push
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Alertas no navegador em tempo real
                                </p>
                              </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={formData.notificacoes_push}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    notificacoes_push: e.target.checked,
                                  })
                                }
                              />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                            </label>
                          </div>

                          {/* Resumo Diário */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-900/20">
                                <i className="ri-calendar-check-line text-sm text-emerald-600 dark:text-emerald-400"></i>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  Resumo Diário
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Receba um resumo das atividades do dia por e-mail
                                </p>
                              </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={formData.resumo_diario}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    resumo_diario: e.target.checked,
                                  })
                                }
                              />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                            </label>
                          </div>
                        </div>

                        {/* Info box sobre tipos de e-mail */}
                        <div className="p-3 sm:p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg mt-3">
                          <div className="flex gap-2 sm:gap-3">
                            <i className="ri-information-line text-teal-600 dark:text-teal-400 text-xl flex-shrink-0"></i>
                            <div>
                              <p className="text-xs sm:text-sm font-medium text-teal-900 dark:text-teal-300 mb-1">
                                Quando você receberá e-mails:
                              </p>
                              <ul className="text-xs text-teal-800 dark:text-teal-400 space-y-1">
                                <li>• Tarefas atrasadas ou com prazo próximo</li>
                                <li>• Novas tarefas atribuídas a você</li>
                                <li>• Comentários nas suas tarefas</li>
                                <li>• Novos membros nos seus projetos</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Histórico de e-mails */}
                        <div className="mt-2">
                          <button
                            onClick={() => setShowEmailHistory(!showEmailHistory)}
                            className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium cursor-pointer transition-colors"
                          >
                            <i className={`ri-arrow-${showEmailHistory ? 'up' : 'down'}-s-line text-base`}></i>
                            {showEmailHistory ? 'Ocultar histórico' : 'Ver histórico de e-mails'}
                          </button>

                          {showEmailHistory && (
                            <div className="mt-3 space-y-2">
                              {isLoadingEmailLogs ? (
                                <div className="flex items-center justify-center py-4">
                                  <i className="ri-loader-4-line animate-spin text-xl text-teal-500"></i>
                                </div>
                              ) : emailLogs.length === 0 ? (
                                <div className="text-center py-4">
                                  <div className="w-10 h-10 flex items-center justify-center mx-auto mb-2 rounded-full bg-gray-100 dark:bg-gray-700">
                                    <i className="ri-mail-line text-lg text-gray-400 dark:text-gray-500"></i>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Nenhum e-mail enviado ainda
                                  </p>
                                </div>
                              ) : (
                                emailLogs.map((log) => {
                                  const typeIcons: Record<string, string> = {
                                    overdue: 'ri-error-warning-line',
                                    deadline: 'ri-alarm-warning-line',
                                    task: 'ri-task-line',
                                    comment: 'ri-chat-3-line',
                                    team: 'ri-team-line',
                                    daily_summary: 'ri-bar-chart-line',
                                  };
                                  const typeColors: Record<string, string> = {
                                    overdue: 'text-red-500',
                                    deadline: 'text-amber-500',
                                    task: 'text-teal-500',
                                    comment: 'text-sky-500',
                                    team: 'text-emerald-500',
                                    daily_summary: 'text-indigo-500',
                                  };
                                  return (
                                    <div
                                      key={log.id}
                                      className="flex items-center gap-3 p-2.5 bg-white dark:bg-gray-600/30 rounded-lg border border-gray-100 dark:border-gray-600"
                                    >
                                      <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                                        <i className={`${typeIcons[log.email_type] || 'ri-mail-line'} text-base ${typeColors[log.email_type] || 'text-gray-500'}`}></i>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                          {log.subject.replace('[TaskFlow] ', '')}
                                        </p>
                                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                          {formatTimeAgo(log.sent_at)}
                                        </p>
                                      </div>
                                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                                        log.status === 'sent'
                                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                      }`}>
                                        {log.status === 'sent' ? 'Enviado' : 'Pendente'}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Preferências */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
                      <h3
                        className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        Preferências
                      </h3>
                      <div className="space-y-4">
                        <div className="min-w-0">
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Idioma
                          </label>
                          <select
                            value={formData.idioma}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                idioma: e.target.value,
                              })
                            }
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm sm:text-base min-w-0"
                          >
                            <option value="pt-BR">Português (Brasil)</option>
                            <option value="en-US">English (US)</option>
                            <option value="es-ES">Español</option>
                          </select>
                        </div>
                        <div className="min-w-0">
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Fuso Horário
                          </label>
                          <select
                            value={formData.fuso_horario}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                fuso_horario: e.target.value,
                              })
                            }
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm sm:text-base min-w-0"
                          >
                            <option value="America/Sao_Paulo">
                              Brasília (GMT-3)
                            </option>
                            <option value="America/New_York">
                              New York (GMT-5)
                            </option>
                            <option value="Europe/London">
                              London (GMT+0)
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Conta */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
                      <h3
                        className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        Conta
                      </h3>
                      <div className="space-y-3">
                        <button
                          onClick={() => setShowPrivacyModal(true)}
                          className="w-full text-left px-4 py-3 bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 rounded-lg transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <i className="ri-shield-check-line text-lg text-gray-700 dark:text-gray-300"></i>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                Privacidade e Segurança
                              </span>
                            </div>
                            <i className="ri-arrow-right-s-line text-gray-400 dark:text-gray-500"></i>
                          </div>
                        </button>

                        {/* Botão Excluir Conta */}
                        <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-600">
                          <button
                            onClick={handleOpenDeleteAccountModal}
                            className="w-full text-left px-4 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <i className="ri-delete-bin-7-line text-lg text-red-600 dark:text-red-400"></i>
                                <div>
                                  <span className="text-sm font-medium text-red-600 dark:text-red-400 block">
                                    Excluir Conta
                                  </span>
                                  <span className="text-[11px] text-red-500/70 dark:text-red-400/60">
                                    Esta ação é permanente e irreversível
                                  </span>
                                </div>
                              </div>
                              <i className="ri-arrow-right-s-line text-red-400 dark:text-red-500"></i>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'seguranca' && (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Alterar Senha */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
                      <div className="flex items-center gap-2 mb-1">
                        <i className="ri-lock-password-line text-lg text-teal-600 dark:text-teal-400"></i>
                        <h3
                          className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white"
                          style={{ fontFamily: 'Poppins, sans-serif' }}
                        >
                          Alterar Senha
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                        Atualize sua senha regularmente para manter sua conta segura
                      </p>

                      {passwordSuccess && (
                        <div className="mb-4 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
                          <i className="ri-checkbox-circle-line text-green-600 dark:text-green-400 text-xl"></i>
                          <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                            Senha alterada com sucesso!
                          </p>
                        </div>
                      )}
                      {passwordError && (
                        <div className="mb-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
                          <i className="ri-error-warning-line text-red-600 dark:text-red-400 text-xl"></i>
                          <p className="text-sm text-red-800 dark:text-red-300">
                            {passwordError}
                          </p>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="min-w-0">
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Senha Atual
                          </label>
                          <div className="relative">
                            <input
                              type={showCurrentPassword ? 'text' : 'password'}
                              value={passwordData.currentPassword}
                              onChange={(e) =>
                                setPasswordData({ ...passwordData, currentPassword: e.target.value })
                              }
                              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm min-w-0"
                              placeholder="Digite sua senha atual"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors"
                            >
                              <i className={`${showCurrentPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                            </button>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nova Senha
                          </label>
                          <div className="relative">
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={passwordData.newPassword}
                              onChange={(e) =>
                                setPasswordData({ ...passwordData, newPassword: e.target.value })
                              }
                              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm min-w-0"
                              placeholder="Digite sua nova senha"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors"
                            >
                              <i className={`${showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                            </button>
                          </div>

                          {/* Barra de força da senha */}
                          {passwordData.newPassword.length > 0 && (
                            <div className="mt-2">
                              <div className="flex gap-1.5 mb-1">
                                {[1, 2, 3, 4].map((level) => {
                                  const strength = [
                                    passwordData.newPassword.length >= 8,
                                    /[A-Z]/.test(passwordData.newPassword),
                                    /[0-9]/.test(passwordData.newPassword),
                                    /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword),
                                  ].filter(Boolean).length;
                                  const colors = ['bg-red-400', 'bg-amber-400', 'bg-amber-400', 'bg-green-400'];
                                  return (
                                    <div
                                      key={level}
                                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                        level <= strength ? colors[strength - 1] : 'bg-gray-200 dark:bg-gray-600'
                                      }`}
                                    />
                                  );
                                })}
                              </div>
                              <p className={`text-[11px] font-medium ${
                                (() => {
                                  const s = [
                                    passwordData.newPassword.length >= 8,
                                    /[A-Z]/.test(passwordData.newPassword),
                                    /[0-9]/.test(passwordData.newPassword),
                                    /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword),
                                  ].filter(Boolean).length;
                                  if (s <= 1) return 'text-red-500 dark:text-red-400';
                                  if (s <= 2) return 'text-amber-500 dark:text-amber-400';
                                  if (s === 3) return 'text-amber-500 dark:text-amber-400';
                                  return 'text-green-500 dark:text-green-400';
                                })()
                              }`}>
                                {(() => {
                                  const s = [
                                    passwordData.newPassword.length >= 8,
                                    /[A-Z]/.test(passwordData.newPassword),
                                    /[0-9]/.test(passwordData.newPassword),
                                    /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword),
                                  ].filter(Boolean).length;
                                  if (s <= 1) return 'Fraca';
                                  if (s === 2) return 'Razoável';
                                  if (s === 3) return 'Boa';
                                  return 'Forte';
                                })()}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Confirmar Nova Senha
                          </label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={passwordData.confirmPassword}
                              onChange={(e) =>
                                setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                              }
                              className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-11 border rounded-lg focus:ring-2 focus:border-transparent text-sm min-w-0 ${
                                passwordData.confirmPassword.length > 0 && passwordData.newPassword !== passwordData.confirmPassword
                                  ? 'border-red-300 dark:border-red-600 bg-red-50/50 dark:bg-red-900/10 focus:ring-red-400'
                                  : passwordData.confirmPassword.length > 0 && passwordData.newPassword === passwordData.confirmPassword
                                    ? 'border-green-300 dark:border-green-600 bg-green-50/50 dark:bg-green-900/10 focus:ring-green-400'
                                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-teal-500'
                              } text-gray-900 dark:text-white`}
                              placeholder="Confirme sua nova senha"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors"
                            >
                              <i className={`${showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                            </button>
                          </div>
                          {passwordData.confirmPassword.length > 0 && passwordData.newPassword !== passwordData.confirmPassword && (
                            <p className="text-[11px] text-red-500 dark:text-red-400 mt-1.5 flex items-center gap-1">
                              <i className="ri-error-warning-line text-xs"></i>
                              As senhas não coincidem
                            </p>
                          )}
                          {passwordData.confirmPassword.length > 0 && passwordData.newPassword === passwordData.confirmPassword && passwordData.newPassword.length > 0 && (
                            <p className="text-[11px] text-green-500 dark:text-green-400 mt-1.5 flex items-center gap-1">
                              <i className="ri-checkbox-circle-line text-xs"></i>
                              As senhas coincidem
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Requisitos de senha */}
                      <div className="mt-5 p-3 sm:p-4 bg-white dark:bg-gray-600/30 border border-gray-200 dark:border-gray-600 rounded-lg">
                        <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white mb-2.5">
                          Requisitos de Senha
                        </h4>
                        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
                          <li className={`flex items-center gap-2 transition-colors ${
                            passwordData.newPassword.length >= 8
                              ? 'text-green-600 dark:text-green-400'
                              : ''
                          }`}>
                            <i className={`${
                            passwordData.newPassword.length >= 8
                              ? 'ri-checkbox-circle-fill text-green-500'
                              : 'ri-checkbox-blank-circle-line'
                          } text-sm`}></i>
                            Mínimo de 8 caracteres
                          </li>
                          <li className={`flex items-center gap-2 transition-colors ${
                            /[A-Z]/.test(passwordData.newPassword)
                              ? 'text-green-600 dark:text-green-400'
                              : ''
                          }`}>
                            <i className={`${
                            /[A-Z]/.test(passwordData.newPassword)
                              ? 'ri-checkbox-circle-fill text-green-500'
                              : 'ri-checkbox-blank-circle-line'
                          } text-sm`}></i>
                            Pelo menos uma letra maiúscula
                          </li>
                          <li className={`flex items-center gap-2 transition-colors ${
                            /[0-9]/.test(passwordData.newPassword)
                              ? 'text-green-600 dark:text-green-400'
                              : ''
                          }`}>
                            <i className={`${
                            /[0-9]/.test(passwordData.newPassword)
                              ? 'ri-checkbox-circle-fill text-green-500'
                              : 'ri-checkbox-blank-circle-line'
                          } text-sm`}></i>
                            Pelo menos um número
                          </li>
                          <li className={`flex items-center gap-2 transition-colors ${
                            /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword)
                              ? 'text-green-600 dark:text-green-400'
                              : ''
                          }`}>
                            <i className={`${
                            /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword)
                              ? 'ri-checkbox-circle-fill text-green-500'
                              : 'ri-checkbox-blank-circle-line'
                          } text-sm`}></i>
                            Pelo menos um caractere especial
                          </li>
                        </ul>
                      </div>

                      {/* Botão de alterar senha */}
                      <div className="mt-5">
                        <button
                          onClick={handleChangePassword}
                          disabled={
                            passwordLoading ||
                            !passwordData.currentPassword ||
                            !passwordData.newPassword ||
                            !passwordData.confirmPassword ||
                            passwordData.newPassword !== passwordData.confirmPassword ||
                            !validatePassword(passwordData.newPassword)
                          }
                          className="w-full sm:w-auto px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {passwordLoading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Alterando...
                            </>
                          ) : (
                            <>
                              <i className="ri-lock-password-line text-sm"></i>
                              Alterar Senha
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Autenticação de Dois Fatores */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
                      <div className="flex items-center gap-2 mb-1">
                        <i className="ri-shield-check-line text-lg text-teal-600 dark:text-teal-400"></i>
                        <h3
                          className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white"
                          style={{ fontFamily: 'Poppins, sans-serif' }}
                        >
                          Autenticação de Dois Fatores
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Adicione uma camada extra de segurança à sua conta
                      </p>
                      <div className="flex items-center justify-between p-3 sm:p-4 bg-white dark:bg-gray-600/30 border border-gray-200 dark:border-gray-600 rounded-lg">
                        <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                          <div className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 ${
                            twoFactorEnabled
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : 'bg-gray-100 dark:bg-gray-600'
                          }`}>
                            <i className={`ri-shield-keyhole-line text-base ${
                            twoFactorEnabled
                              ? 'text-green-600'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {twoFactorEnabled ? '2FA Ativada' : '2FA Desativada'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {twoFactorEnabled
                                ? 'Sua conta está protegida com verificação em duas etapas'
                                : 'Ative para proteger sua conta com verificação em duas etapas'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handle2FAToggle}
                          className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer flex-shrink-0 ${
                            twoFactorEnabled
                              ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800'
                              : 'bg-teal-600 text-white hover:bg-teal-700'
                          }`}
                        >
                          {twoFactorEnabled ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </div>

                    {/* Dica de segurança */}
                    <div className="p-3 sm:p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg">
                      <div className="flex gap-2 sm:gap-3">
                        <i className="ri-lightbulb-line text-teal-600 dark:text-teal-400 text-xl flex-shrink-0"></i>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-teal-900 dark:text-teal-300 mb-1">
                            Dicas de Segurança
                          </h4>
                          <ul className="text-xs text-teal-800 dark:text-teal-400 space-y-1">
                            <li>• Nunca compartilhe sua senha com outras pessoas</li>
                            <li>• Use senhas diferentes para cada serviço</li>
                            <li>• Altere sua senha periodicamente (a cada 3 meses)</li>
                            <li>• Ative a autenticação de dois fatores sempre que possível</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!isLoading && (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
              <button
                onClick={handleCloseModal}
                className="w-full sm:flex-1 px-4 sm:px-6 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full sm:flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Alterar Senha */}
      {showChangePasswordModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-2 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowChangePasswordModal(false);
              setPasswordError('');
              setPasswordSuccess(false);
              setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
              setShowCurrentPassword(false);
              setShowNewPassword(false);
              setShowConfirmPassword(false);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/20">
                  <i className="ri-lock-password-line text-xl text-teal-600 dark:text-teal-400"></i>
                </div>
                <h3
                  className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Alterar Senha
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setPasswordError('');
                  setPasswordSuccess(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setShowCurrentPassword(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl sm:text-2xl"></i>
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {passwordSuccess && (
                <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <i className="ri-checkbox-circle-line text-green-600 dark:text-green-400 text-xl"></i>
                    <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                      Senha alterada com sucesso!
                    </p>
                  </div>
                </div>
              )}
              {passwordError && (
                <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <i className="ri-error-warning-line text-red-600 dark:text-red-400 text-xl"></i>
                    <p className="text-sm text-red-800 dark:text-red-300">
                      {passwordError}
                    </p>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Senha Atual
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, currentPassword: e.target.value })
                    }
                    className="w-full px-4 py-3 pr-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Digite sua senha atual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors"
                  >
                    <i className={`${showCurrentPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    className="w-full px-4 py-3 pr-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Digite sua nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors"
                  >
                    <i className={`${showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                  </button>
                </div>
                {/* Barra de força no modal */}
                {passwordData.newPassword.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1.5 mb-1">
                      {[1, 2, 3, 4].map((level) => {
                        const strength = [
                          passwordData.newPassword.length >= 8,
                          /[A-Z]/.test(passwordData.newPassword),
                          /[0-9]/.test(passwordData.newPassword),
                          /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword),
                        ].filter(Boolean).length;
                        const colors = ['bg-red-400', 'bg-amber-400', 'bg-amber-400', 'bg-green-400'];
                        return (
                          <div
                            key={level}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                              level <= strength ? colors[strength - 1] : 'bg-gray-200 dark:bg-gray-600'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                    className={`w-full px-4 py-3 pr-11 border rounded-lg focus:ring-2 focus:border-transparent text-sm ${
                      passwordData.confirmPassword.length > 0 && passwordData.newPassword !== passwordData.confirmPassword
                        ? 'border-red-300 dark:border-red-600 bg-red-50/50 dark:bg-red-900/10 focus:ring-red-400'
                        : passwordData.confirmPassword.length > 0 && passwordData.newPassword === passwordData.confirmPassword
                          ? 'border-green-300 dark:border-green-600 bg-green-50/50 dark:bg-green-900/10 focus:ring-green-400'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-teal-500'
                    } text-gray-900 dark:text-white`}
                    placeholder="Confirme sua nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors"
                  >
                    <i className={`${showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                  </button>
                </div>
                {passwordData.confirmPassword.length > 0 && passwordData.newPassword !== passwordData.confirmPassword && (
                  <p className="text-[11px] text-red-500 dark:text-red-400 mt-1.5 flex items-center gap-1">
                    <i className="ri-error-warning-line text-xs"></i>
                    As senhas não coincidem
                  </p>
                )}
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Requisitos de Senha:
                </h4>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <li className={`flex items-center gap-2 transition-colors ${
                    passwordData.newPassword.length >= 8
                      ? 'text-green-600 dark:text-green-400'
                      : ''
                  }`}>
                    <i className={`${
                      passwordData.newPassword.length >= 8
                        ? 'ri-checkbox-circle-fill text-green-500'
                        : 'ri-checkbox-blank-circle-line'
                    } text-sm`}></i>
                    Mínimo de 8 caracteres
                  </li>
                  <li className={`flex items-center gap-2 transition-colors ${
                    /[A-Z]/.test(passwordData.newPassword)
                      ? 'text-green-600 dark:text-green-400'
                      : ''
                  }`}>
                    <i className={`${
                      /[A-Z]/.test(passwordData.newPassword)
                        ? 'ri-checkbox-circle-fill text-green-500'
                        : 'ri-checkbox-blank-circle-line'
                    } text-sm`}></i>
                    Pelo menos uma letra maiúscula
                  </li>
                  <li className={`flex items-center gap-2 transition-colors ${
                    /[0-9]/.test(passwordData.newPassword)
                      ? 'text-green-600 dark:text-green-400'
                      : ''
                  }`}>
                    <i className={`${
                      /[0-9]/.test(passwordData.newPassword)
                        ? 'ri-checkbox-circle-fill text-green-500'
                        : 'ri-checkbox-blank-circle-line'
                    } text-sm`}></i>
                    Pelo menos um número
                  </li>
                  <li className={`flex items-center gap-2 transition-colors ${
                    /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword)
                      ? 'text-green-600 dark:text-green-400'
                      : ''
                  }`}>
                    <i className={`${
                      /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword)
                        ? 'ri-checkbox-circle-fill text-green-500'
                        : 'ri-checkbox-blank-circle-line'
                    } text-sm`}></i>
                    Pelo menos um caractere especial
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setPasswordError('');
                  setPasswordSuccess(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setShowCurrentPassword(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="w-full sm:flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                disabled={
                  passwordLoading ||
                  !passwordData.currentPassword ||
                  !passwordData.newPassword ||
                  !passwordData.confirmPassword ||
                  passwordData.newPassword !== passwordData.confirmPassword ||
                  !validatePassword(passwordData.newPassword)
                }
                className="w-full sm:flex-1 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {passwordLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Alterando...
                  </>
                ) : (
                  'Alterar Senha'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Autenticação de Dois Fatores */}
      {show2FAModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-2 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShow2FAModal(false);
              setVerificationCode('');
              setCodeError('');
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/20">
                  <i className="ri-shield-check-line text-xl text-teal-600 dark:text-teal-400"></i>
                </div>
                <h3
                  className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {twoFactorEnabled ? 'Desativar 2FA' : 'Ativar 2FA'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShow2FAModal(false);
                  setVerificationCode('');
                  setCodeError('');
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl sm:text-2xl"></i>
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {twoFactorEnabled ? (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    Tem certeza que deseja desativar a autenticação de dois
                    fatores? Isso tornará sua conta menos segura.
                  </p>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex gap-3">
                      <i className="ri-alert-line text-red-600 dark:text-red-400 text-xl flex-shrink-0 mt-0.5"></i>
                      <div>
                        <h4 className="text-sm font-bold text-red-900 dark:text-red-300 mb-2">
                          Atenção
                        </h4>
                        <ul className="text-xs text-red-800 dark:text-red-400 space-y-1.5">
                          <li className="flex items-start gap-1.5">
                            <i className="ri-close-circle-fill text-red-500 text-sm flex-shrink-0 mt-0.5"></i>
                            Todos os seus dados serão permanentemente apagados
                          </li>
                          <li className="flex items-start gap-1.5">
                            <i className="ri-close-circle-fill text-red-500 text-sm flex-shrink-0 mt-0.5"></i>
                            Projetos, tarefas e arquivos serão removidos
                          </li>
                          <li className="flex items-start gap-1.5">
                            <i className="ri-close-circle-fill text-red-500 text-sm flex-shrink-0 mt-0.5"></i>
                            Não será possível recuperar a conta após a exclusão
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                    A autenticação de dois fatores adiciona uma camada extra de
                    segurança à sua conta. Digite o código de verificação para
                    ativar.
                  </p>
                  {codeError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <i className="ri-error-warning-line text-red-600 dark:text-red-400 text-xl"></i>
                        <p className="text-sm text-red-800 dark:text-red-300">
                          {codeError}
                        </p>
                      </div>
                    </div>
                  )}
                  {verificationCode === '123456' && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <i className="ri-checkbox-circle-line text-green-600 dark:text-green-400 text-xl"></i>
                        <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                          2FA ativada com sucesso!
                        </p>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Código de Verificação
                    </label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      maxLength={6}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm text-center tracking-widest font-mono text-lg"
                      placeholder="000000"
                    />
                  </div>
                  <div className="p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg">
                    <div className="flex gap-3">
                      <i className="ri-information-line text-teal-600 dark:text-teal-400 text-xl flex-shrink-0"></i>
                      <div>
                        <h4 className="text-sm font-medium text-teal-900 dark:text-teal-300 mb-1">
                          Código de Teste
                        </h4>
                        <p className="text-xs text-teal-800 dark:text-teal-400">
                          Para demonstração, use o código:{' '}
                          <strong>123456</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <button
                onClick={() => {
                  setShow2FAModal(false);
                  setVerificationCode('');
                  setCodeError('');
                }}
                className="w-full sm:flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={twoFactorEnabled ? handleDeactivate2FA : handleActivate2FA}
                className={`w-full sm:flex-1 px-4 py-3 rounded-lg transition-colors font-medium text-sm whitespace-nowrap cursor-pointer ${
                  twoFactorEnabled
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-teal-600 text-white hover:bg-teal-700'
                }`}
              >
                {twoFactorEnabled ? 'Desativar 2FA' : 'Ativar 2FA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Privacidade e Segurança */}
      {showPrivacyModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-2 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPrivacyModal(false);
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h3
                className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Privacidade e Segurança
              </h3>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl sm:text-2xl"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <i className="ri-eye-line text-teal-600 dark:text-teal-400"></i>
                  Visibilidade do Perfil
                </h4>
                <div className="space-y-4">
                  {[
                    {
                      key: 'perfil_publico',
                      label: 'Perfil Público',
                      desc: 'Permitir que outros usuários vejam seu perfil',
                    },
                    {
                      key: 'mostrar_email',
                      label: 'Mostrar Email',
                      desc: 'Exibir seu email no perfil público',
                    },
                    {
                      key: 'mostrar_telefone',
                      label: 'Mostrar Telefone',
                      desc: 'Exibir seu telefone no perfil público',
                    },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={(privacySettings as Record<string, boolean>)[item.key]}
                          onChange={(e) => handlePrivacyChange(item.key, e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <i className="ri-message-3-line text-teal-600 dark:text-teal-400"></i>
                  Comunicação
                </h4>
                <div className="space-y-4">
                  {[
                    {
                      key: 'permitir_mensagens',
                      label: 'Permitir Mensagens',
                      desc: 'Outros usuários podem enviar mensagens',
                    },
                    {
                      key: 'compartilhar_atividade',
                      label: 'Compartilhar Atividade',
                      desc: 'Mostrar suas atividades recentes',
                    },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={(privacySettings as Record<string, boolean>)[item.key]}
                          onChange={(e) => handlePrivacyChange(item.key, e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg">
                <div className="flex gap-3">
                  <i className="ri-information-line text-teal-600 dark:text-teal-400 text-xl flex-shrink-0"></i>
                  <div>
                    <h4 className="text-sm font-medium text-teal-900 dark:text-teal-300 mb-1">
                      Sobre suas informações
                    </h4>
                    <p className="text-xs text-teal-800 dark:text-teal-400">
                      Suas configurações de privacidade controlam como suas
                      informações são compartilhadas com outros usuários da
                      plataforma. Você pode alterar essas configurações a
                      qualquer momento.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="w-full sm:flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePrivacy}
                className="w-full sm:flex-1 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Remover Foto */}
      {showRemovePhotoModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-2 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRemovePhotoModal(false);
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                  <i className="ri-image-edit-line text-xl text-red-600 dark:text-red-400"></i>
                </div>
                <h3
                  className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Remover Foto
                </h3>
              </div>
              <button
                onClick={() => setShowRemovePhotoModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl sm:text-2xl"></i>
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <div className="flex flex-col items-center gap-4 mb-4">
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-gray-100 dark:border-gray-700">
                  <UserAvatar
                    avatarUrl={profileImage}
                    nome={formData.nome}
                    size="xl"
                    className="w-full h-full"
                  />
                </div>
              </div>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 text-center">
                Tem certeza que deseja remover sua foto de perfil? A imagem padrão será utilizada no lugar.
              </p>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex gap-3">
                  <i className="ri-information-line text-amber-600 dark:text-amber-400 text-xl flex-shrink-0"></i>
                  <div>
                    <h4 className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-1">
                      Atenção
                    </h4>
                    <p className="text-xs text-amber-800 dark:text-amber-400">
                      Esta ação não pode ser desfeita. Você poderá enviar uma nova foto a qualquer momento.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <button
                onClick={() => setShowRemovePhotoModal(false)}
                className="w-full sm:flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleRemovePhoto}
                disabled={removingPhoto}
                className="w-full sm:flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {removingPhoto ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Removendo...
                  </>
                ) : (
                  'Sim, Remover'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Excluir Conta */}
      {showDeleteAccountModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-2 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteAccountModal(false);
              setDeleteInputCode('');
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                  <i className="ri-error-warning-fill text-xl text-red-600 dark:text-red-400"></i>
                </div>
                <h3
                  className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Excluir Conta
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteInputCode('');
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl sm:text-2xl"></i>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 space-y-4">
              {/* Aviso principal */}
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex gap-3">
                  <i className="ri-alarm-warning-fill text-red-600 dark:text-red-400 text-xl flex-shrink-0 mt-0.5"></i>
                  <div>
                    <h4 className="text-sm font-bold text-red-900 dark:text-red-300 mb-2">
                      Atenção! Esta ação é irreversível.
                    </h4>
                    <ul className="text-xs text-red-800 dark:text-red-400 space-y-1.5">
                      <li className="flex items-start gap-1.5">
                        <i className="ri-close-circle-fill text-red-500 text-sm flex-shrink-0 mt-0.5"></i>
                        Todos os seus dados serão permanentemente apagados
                      </li>
                      <li className="flex items-start gap-1.5">
                        <i className="ri-close-circle-fill text-red-500 text-sm flex-shrink-0 mt-0.5"></i>
                        Projetos, tarefas e arquivos serão removidos
                      </li>
                      <li className="flex items-start gap-1.5">
                        <i className="ri-close-circle-fill text-red-500 text-sm flex-shrink-0 mt-0.5"></i>
                        Não será possível recuperar a conta após a exclusão
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Código de confirmação */}
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  Para confirmar a exclusão, copie e cole o código abaixo no campo de verificação:
                </p>

                {/* Exibição do código */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <span className="font-mono text-base font-bold tracking-[0.25em] text-gray-900 dark:text-white select-all">
                      {deleteConfirmCode}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                      codeCopied
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                    title="Copiar código"
                  >
                    <i className={`${codeCopied ? 'ri-check-line' : 'ri-file-copy-line'} text-lg`}></i>
                  </button>
                </div>

                {/* Campo de entrada */}
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Digite o código de verificação
                </label>
                <input
                  type="text"
                  value={deleteInputCode}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
                    setDeleteInputCode(val);
                  }}
                  maxLength={7}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent text-sm font-mono tracking-[0.2em] text-center uppercase ${
                    deleteInputCode.length === 7 && deleteInputCode !== deleteConfirmCode
                      ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 focus:ring-red-300 dark:focus:ring-red-800'
                      : deleteInputCode === deleteConfirmCode && deleteInputCode.length === 7
                        ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 focus:ring-green-300 dark:focus:ring-green-800'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-teal-500'
                  }`}
                  placeholder="DIGITE O CÓDIGO"
                />
                {deleteInputCode.length === 7 && deleteInputCode !== deleteConfirmCode && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1">
                    <i className="ri-error-warning-line text-sm"></i>
                    Código incorreto. Verifique e tente novamente.
                  </p>
                )}
                {deleteInputCode === deleteConfirmCode && deleteInputCode.length === 7 && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 flex items-center gap-1">
                    <i className="ri-checkbox-circle-line text-sm"></i>
                    Código verificado com sucesso.
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteInputCode('');
                }}
                className="w-full sm:flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInputCode !== deleteConfirmCode || deleteInputCode.length !== 7 || isDeletingAccount}
                className="w-full sm:flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-600 flex items-center justify-center gap-2"
              >
                {isDeletingAccount ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Excluindo...
                  </>
                ) : (
                  <>
                    <i className="ri-delete-bin-7-line text-sm"></i>
                    Excluir Conta Definitivamente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
