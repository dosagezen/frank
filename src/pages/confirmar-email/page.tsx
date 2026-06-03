import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function ConfirmarEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirmarEmail = async () => {
      // Verificar se há um token de confirmação na URL
      const token = searchParams.get('token');
      const type = searchParams.get('type');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Se houver erro na URL
      if (error) {
        setStatus('error');
        if (error === 'access_denied' && errorDescription?.includes('expired')) {
          setMessage('O link de confirmação expirou. Por favor, solicite um novo email de confirmação.');
        } else {
          setMessage(errorDescription || 'Erro ao confirmar email. Tente novamente.');
        }
        return;
      }

      // Se houver token, processar confirmação
      if (token && type === 'signup') {
        try {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup',
          });

          if (error) {
            setStatus('error');
            setMessage('Erro ao confirmar email. O link pode ter expirado.');
          } else {
            // ✅ PONTO 1: Verificar status após confirmação (caminho com token)
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('status')
                .eq('id', session.user.id)
                .maybeSingle();

              if (profile?.status === 'pendente') {
                // Fazer logout imediato
                await supabase.auth.signOut();
                setStatus('success');
                setMessage('Email confirmado com sucesso! Sua conta está aguardando aprovação do administrador. Você será notificado quando o acesso for liberado.');
                return;
              }

              // Só redireciona se status === 'ativo'
              setStatus('success');
              setMessage('Email confirmado com sucesso! Redirecionando...');
              setTimeout(() => {
                navigate('/painel');
              }, 2000);
            }
          }
        } catch (err) {
          setStatus('error');
          setMessage('Erro ao processar confirmação. Tente novamente.');
        }
      } else {
        // ✅ PONTO 1: Verificar status após confirmação (caminho sem token)
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('status')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile?.status === 'pendente') {
            // Fazer logout imediato
            await supabase.auth.signOut();
            setStatus('success');
            setMessage('Email confirmado com sucesso! Sua conta está aguardando aprovação do administrador. Você será notificado quando o acesso for liberado.');
            return;
          }

          // Só redireciona se status === 'ativo'
          setStatus('success');
          setMessage('Email confirmado com sucesso! Redirecionando...');
          setTimeout(() => {
            navigate('/painel');
          }, 2000);
        } else {
          setStatus('error');
          setMessage('Link de confirmação inválido ou expirado.');
        }
      }
    };

    confirmarEmail();
  }, [searchParams, navigate]);

  const handleReenviarEmail = () => {
    navigate('/login');
    // Aqui você pode adicionar lógica para reenviar o email
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <img
              src="https://static.readdy.ai/image/a38a5c3741c640eadeac44aae6e6e520/1fe965cd45beaa7952fde5325686f609.png" 
              alt="Logo"
              loading="lazy"
              className="h-10 mb-8"
            />
          </div>

          {/* Status Loading */}
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Confirmando seu email...
              </h2>
              <p className="text-gray-600">
                Aguarde enquanto verificamos sua conta
              </p>
            </>
          )}

          {/* Status Success */}
          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-check-line text-4xl text-green-600"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Email confirmado!
              </h2>
              <p className="text-gray-600 mb-6">
                {message}
              </p>
              {!message.includes('aguardando aprovação') && (
                <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              )}
            </>
          )}

          {/* Status Error */}
          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-close-line text-4xl text-red-600"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Erro na confirmação
              </h2>
              <p className="text-gray-600 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleReenviarEmail}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-lg font-semibold transition-all shadow-lg shadow-teal-600/30 cursor-pointer whitespace-nowrap"
                >
                  Voltar para o login
                </button>
                <p className="text-sm text-gray-500">
                  Precisa de ajuda? Entre em contato com o suporte
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}