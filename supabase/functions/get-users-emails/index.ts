import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseServiceKey) {
      console.error('[get-users-emails] ❌ SUPABASE_SERVICE_ROLE_KEY não configurada!');
      return new Response(JSON.stringify({ code: 500, message: 'Service role key not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Criar cliente admin com service role (ignora RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verificar token do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[get-users-emails] ❌ Missing Authorization header');
      return new Response(JSON.stringify({ code: 401, message: 'Missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    console.log('[get-users-emails] 🔵 Token recebido, comprimento:', token.length);

    // Verificar usuário usando o admin client (mais confiável que anon key)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('[get-users-emails] ❌ Token inválido:', userError?.message);
      return new Response(JSON.stringify({ code: 401, message: 'Invalid or expired token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    console.log('[get-users-emails] ✅ Usuário autenticado:', user.email, '| ID:', user.id);

    // Verificar role usando admin client (bypassa RLS, sem risco de bloqueio)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    console.log('[get-users-emails] 🔍 Profile encontrado:', JSON.stringify(profile), '| Erro:', profileError?.message ?? 'nenhum');

    if (profileError) {
      console.error('[get-users-emails] ❌ Erro ao buscar profile:', profileError.message);
      return new Response(JSON.stringify({ code: 500, message: 'Error fetching profile' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!profile || profile.role !== 'admin') {
      console.error('[get-users-emails] ❌ Usuário não é admin. Role:', profile?.role ?? 'NULL');
      return new Response(JSON.stringify({ code: 403, message: 'Forbidden: admin only' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    console.log('[get-users-emails] ✅ Usuário é admin. Buscando todos os usuários...');

    // Buscar TODOS os usuários com paginação
    let allUsers: { id: string; email: string | null }[] = [];
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

      if (error) {
        console.error('[get-users-emails] ❌ Erro ao listar usuários (página', page, '):', error.message);
        throw error;
      }

      const pageUsers = data.users ?? [];
      console.log(`[get-users-emails] 📄 Página ${page}: ${pageUsers.length} usuários`);

      pageUsers.forEach((u) => {
        console.log(`[get-users-emails] 👤 ID: ${u.id} | email: ${u.email ?? 'NULL'}`);
      });

      allUsers = allUsers.concat(
        pageUsers.map((u) => ({ id: u.id, email: u.email ?? null }))
      );

      if (pageUsers.length < perPage) break;
      page++;
    }

    console.log('[get-users-emails] ✅ Total:', allUsers.length, '| Com email:', allUsers.filter(u => u.email).length);

    return new Response(JSON.stringify({ users: allUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[get-users-emails] ❌ Erro inesperado:', String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
