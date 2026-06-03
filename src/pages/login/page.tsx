import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPendingScreen, setShowPendingScreen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { user, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  // Verificar se há mensagem de conta excluída
  useEffect(() => {
    const accountDeleted = localStorage.getItem('account_deleted_message');
    if (accountDeleted === 'true') {
      addToast('Sua conta foi removida pelo administrador', 'error');
      localStorage.removeItem('account_deleted_message');
    }
  }, [addToast]);

  useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from?.pathname || '/painel';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isForgotPassword) {
        const { error } = await resetPassword(email);
        if (error) {
          setMessage({ type: 'error', text: error.message });
        } else {
          setMessage({ type: 'success', text: 'Email de recuperação enviado! Verifique sua caixa de entrada.' });
          setEmail('');
        }
      } else if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('aguardando aprovação')) {
            setMessage({ type: 'error', text: 'Sua conta ainda está aguardando aprovação do administrador.' });
          } else if (error.message.includes('desativada')) {
            setMessage({ type: 'error', text: 'Sua conta foi desativada. Entre em contato com o administrador.' });
          } else {
            setMessage({ type: 'error', text: 'Email ou senha incorretos.' });
          }
        }
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          const msg = error.message?.toLowerCase() || '';
          if (msg.includes('rate limit') || msg.includes('email rate')) {
            setMessage({ type: 'error', text: 'Muitas tentativas de cadastro em pouco tempo. Aguarde alguns minutos e tente novamente.' });
          } else if (msg.includes('already registered') || msg.includes('user already exists') || msg.includes('already been registered')) {
            setMessage({ type: 'error', text: 'Este email já está cadastrado. Tente fazer login ou recuperar sua senha.' });
          } else if (msg.includes('invalid email') || msg.includes('email address')) {
            setMessage({ type: 'error', text: 'Email inválido. Verifique o endereço digitado.' });
          } else if (msg.includes('password') && msg.includes('short')) {
            setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
          } else if (msg.includes('network') || msg.includes('fetch')) {
            setMessage({ type: 'error', text: 'Erro de conexão. Verifique sua internet e tente novamente.' });
          } else {
            setMessage({ type: 'error', text: 'Ocorreu um erro ao criar a conta. Tente novamente em alguns instantes.' });
          }
        } else {
          setShowPendingScreen(true);
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ocorreu um erro. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  // Tela de aguardando aprovação
  if (showPendingScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://static.readdy.ai/image/a38a5c3741c640eadeac44aae6e6e520/7188db111bf5b08212e607a1578e5b78.png')`
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/50"></div>
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
              <i className="ri-time-line text-3xl text-amber-600"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Conta Criada com Sucesso!
            </h1>
            <p className="text-gray-600 mb-6">
              Sua conta foi criada e está aguardando aprovação do administrador. Você receberá um email assim que sua conta for aprovada e poderá acessar o sistema.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <i className="ri-information-line text-amber-600 text-lg mt-0.5"></i>
                <div className="text-left">
                  <p className="text-sm font-medium text-amber-900 mb-1">O que acontece agora?</p>
                  <ul className="text-xs text-amber-800 space-y-1">
                    <li>• O administrador foi notificado sobre sua solicitação</li>
                    <li>• Você receberá um email quando for aprovado</li>
                    <li>• Após aprovação, poderá fazer login normalmente</li>
                  </ul>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setShowPendingScreen(false);
                setIsLogin(true);
                setEmail('');
                setPassword('');
                setFullName('');
              }}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl whitespace-nowrap"
            >
              Voltar para o Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background igual à página inicial */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://static.readdy.ai/image/a38a5c3741c640eadeac44aae6e6e520/7188db111bf5b08212e607a1578e5b78.png')`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/50"></div>
      </div>

      <style>{`
        @keyframes cardEntrance {
          0% {
            opacity: 0;
            transform: translateY(32px) scale(0.96);
          }
          60% {
            opacity: 1;
            transform: translateY(-4px) scale(1.005);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes logoEntrance {
          0% {
            opacity: 0;
            transform: scale(0.5) rotate(-10deg);
          }
          70% {
            transform: scale(1.08) rotate(2deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes textFadeIn {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-card-entrance {
          animation: cardEntrance 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .animate-logo-entrance {
          animation: logoEntrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s forwards;
          opacity: 0;
        }
        .animate-text-fade-in {
          animation: textFadeIn 0.5s ease-out forwards;
          opacity: 0;
        }
        .animate-text-fade-in-d1 { animation-delay: 0.4s; }
        .animate-text-fade-in-d2 { animation-delay: 0.5s; }
        .animate-text-fade-in-d3 { animation-delay: 0.6s; }
      `}</style>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 animate-card-entrance">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-4 shadow-md border border-gray-100 animate-logo-entrance">
              <img
                src="https://static.readdy.ai/image/a38a5c3741c640eadeac44aae6e6e520/1fe965cd45beaa7952fde5325686f609.png"
                alt="Logo"
                loading="lazy"
                className="h-10 mb-8"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 animate-text-fade-in animate-text-fade-in-d1">
              {isForgotPassword ? 'Recuperar Senha' : isLogin ? 'Bem-vindo de volta' : 'Criar Conta'}
            </h1>
            <p className="text-gray-600 animate-text-fade-in animate-text-fade-in-d2">
              {isForgotPassword
                ? 'Digite seu email para recuperar sua senha'
                : isLogin
                ? 'Entre para acessar sua conta'
                : 'Preencha os dados para começar'}
            </p>
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <i className={`${message.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-lg`}></i>
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && !isForgotPassword && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="ri-user-line text-gray-400"></i>
                  </div>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder="Seu nome completo"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="ri-mail-line text-gray-400"></i>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="ri-lock-line text-gray-400"></i>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                  >
                    <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                  </button>
                </div>
              </div>
            )}

            {isLogin && !isForgotPassword && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium whitespace-nowrap"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin"></i>
                  Processando...
                </span>
              ) : isForgotPassword ? (
                'Enviar Email de Recuperação'
              ) : isLogin ? (
                'Entrar'
              ) : (
                'Criar Conta'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            {isForgotPassword ? (
              <button
                onClick={() => {
                  setIsForgotPassword(false);
                  setMessage(null);
                }}
                className="text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap"
              >
                <i className="ri-arrow-left-line mr-1"></i>
                Voltar para o login
              </button>
            ) : (
              <p className="text-sm text-gray-600">
                {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setMessage(null);
                  }}
                  className="text-teal-600 hover:text-teal-700 font-semibold whitespace-nowrap"
                >
                  {isLogin ? 'Criar conta' : 'Fazer login'}
                </button>
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-white/70 mt-6 animate-text-fade-in animate-text-fade-in-d3">
          Ao continuar, você concorda com nossos{' '}
          <a href="#" className="text-white/90 hover:text-white whitespace-nowrap">
            Termos de Serviço
          </a>{' '}
          e{' '}
          <a href="#" className="text-white/90 hover:text-white whitespace-nowrap">
            Política de Privacidade
          </a>
        </p>
      </div>
    </div>
  );
}
