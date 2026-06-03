import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

type PageState = 'loading' | 'ready' | 'invalid' | 'success';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { session, isRecoveryMode, clearRecoveryMode, signOut } = useAuth();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20; // 20 × 500ms = 10s

    const check = async () => {
      attempts += 1;

      // 1. Se o AuthContext já sinalizou modo de recuperação com sessão
      if (isRecoveryMode && session) {
        setPageState('ready');
        return true;
      }

      // 2. Fallback: verificar diretamente se há sessão ativa no Supabase
      // (útil quando o PKCE já trocou o code mas o contexto ainda não atualizou)
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          setPageState('ready');
          return true;
        }
      } catch {
        // ignora erros de rede
      }

      if (attempts >= maxAttempts) {
        setPageState('invalid');
        return true;
      }

      return false;
    };

    // Verificação imediata
    check().then((done) => {
      if (!done) {
        const interval = setInterval(async () => {
          const finished = await check();
          if (finished) clearInterval(interval);
        }, 500);

        // Cleanup
        return () => clearInterval(interval);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecoveryMode, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        if (error.message.toLowerCase().includes('same password')) {
          setErrorMsg('A nova senha deve ser diferente da senha atual.');
        } else {
          setErrorMsg(error.message);
        }
        setSubmitting(false);
        return;
      }

      // Sucesso: limpar modo de recuperação, deslogar e ir para login
      clearRecoveryMode();
      await signOut();
      setPageState('success');
    } catch {
      setErrorMsg('Ocorreu um erro inesperado. Tente novamente.');
      setSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Estados de tela                                                      */
  /* ------------------------------------------------------------------ */

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Verificando link de recuperação...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-3xl text-red-500"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Link Inválido ou Expirado
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              O link de recuperação de senha é inválido ou já expirou. Solicite um novo link na tela de login.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap"
            >
              Voltar para o Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-checkbox-circle-line text-3xl text-green-500"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Senha Redefinida!
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              Sua senha foi alterada com sucesso. Faça login com a nova senha para continuar.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap"
            >
              Ir para o Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Formulário principal                                                 */
  /* ------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">

          {/* Logo + título */}
          <div className="text-center mb-8">
            <img
              src="https://static.readdy.ai/image/a38a5c3741c640eadeac44aae6e6e520/1fe965cd45beaa7952fde5325686f609.png"
              alt="Logo"
              loading="lazy"
              className="h-10 mb-8"
            />
            <h1 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Redefinir Senha
            </h1>
            <p className="text-gray-500 text-sm">
              Crie uma nova senha segura para sua conta
            </p>
          </div>

          {/* Erro */}
          {errorMsg && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <i className="ri-error-warning-line text-red-500 mt-0.5 flex-shrink-0"></i>
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Nova senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Nova Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="ri-lock-line text-gray-400 text-sm"></i>
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm transition-all"
                  placeholder="••••••••"
                  required
                  disabled={submitting}
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                >
                  <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Mínimo de 6 caracteres</p>
            </div>

            {/* Confirmar senha */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="ri-lock-2-line text-gray-400 text-sm"></i>
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm transition-all"
                  placeholder="••••••••"
                  required
                  disabled={submitting}
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Ocultar senha' : 'Visualizar senha'}
                >
                  <i className={showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                </button>
              </div>
            </div>

            {/* Indicador de correspondência */}
            {confirmPassword.length > 0 && (
              <div className={`flex items-center gap-1.5 text-xs ${password === confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                <i className={password === confirmPassword ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'}></i>
                {password === confirmPassword ? 'As senhas coincidem' : 'As senhas não coincidem'}
              </div>
            )}

            {/* Botão enviar */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-lg font-semibold transition-all shadow-md shadow-teal-600/20 text-sm cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin"></i>
                  Redefinindo...
                </span>
              ) : (
                'Redefinir Senha'
              )}
            </button>

            {/* Voltar */}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full text-gray-500 hover:text-gray-700 py-2 text-sm font-medium cursor-pointer whitespace-nowrap transition-colors"
            >
              <i className="ri-arrow-left-line mr-1"></i>
              Voltar para o Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
