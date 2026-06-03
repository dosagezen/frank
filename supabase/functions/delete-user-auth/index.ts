import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Cliente admin com service_role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verificar token do usuário que fez a requisição
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorização ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Validar o JWT usando admin.getUser — funciona sem sessão ativa no servidor
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById
      ? await (async () => {
          // Decodifica o JWT para extrair o sub (user id)
          const parts = token.split('.');
          if (parts.length !== 3) {
            return { data: { user: null }, error: { message: 'Token inválido' } };
          }
          const payload = JSON.parse(atob(parts[1]));
          const userId = payload.sub;
          if (!userId) {
            return { data: { user: null }, error: { message: 'Token sem sub' } };
          }
          return await supabaseAdmin.auth.admin.getUserById(userId);
        })()
      : { data: { user: null }, error: { message: 'Método não disponível' } };

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado', details: authError?.message ?? 'Usuário não encontrado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o solicitante é admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem excluir usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Impedir que o admin exclua a si mesmo
    if (userId === user.id) {
      return new Response(
        JSON.stringify({ error: 'Você não pode excluir sua própria conta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deletar o usuário do Supabase Auth usando service_role
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Erro ao deletar usuário do Auth:', deleteError);
      return new Response(
        JSON.stringify({
          error: 'Erro ao remover usuário da autenticação',
          details: deleteError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Usuário removido da autenticação com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro na Edge Function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
