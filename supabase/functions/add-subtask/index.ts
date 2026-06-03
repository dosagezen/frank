import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Configuração do servidor incompleta');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado: header de autenticação ausente');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      throw new Error('Não autorizado: token inválido');
    }

    const { data: authData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !authData?.user) {
      console.error('Erro de autenticação:', userError);
      throw new Error('Usuário não autenticado');
    }

    const user = authData.user;

    // Ler body
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error('Body da requisição inválido');
    }

    const { task_id, titulo, due_date, responsavel_id, sort_order } = body;

    if (!task_id) {
      throw new Error('task_id é obrigatório');
    }
    if (!titulo || !titulo.trim()) {
      throw new Error('titulo é obrigatório');
    }

    // Buscar tarefa
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, user_id, responsavel_id, project_id')
      .eq('id', task_id)
      .maybeSingle();

    if (taskError) {
      console.error('Erro ao buscar tarefa:', taskError);
      throw new Error('Erro ao buscar tarefa: ' + taskError.message);
    }

    if (!task) {
      throw new Error('Tarefa não encontrada');
    }

    // Verificar perfil do usuário
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);
    }

    const isAdmin = profile?.role === 'admin';

    // Se for admin ou criador ou responsável, já tem permissão
    if (isAdmin || task.user_id === user.id || task.responsavel_id === user.id) {
      // Permissão garantida
    } else if (task.project_id) {
      // Verificar se é membro ou dono do projeto
      const { data: memberData } = await supabaseAdmin
        .from('project_members')
        .select('profile_id')
        .eq('project_id', task.project_id)
        .eq('profile_id', user.id)
        .maybeSingle();

      const { data: projectData } = await supabaseAdmin
        .from('projects')
        .select('user_id')
        .eq('id', task.project_id)
        .maybeSingle();

      const isMember = !!memberData;
      const isOwner = projectData?.user_id === user.id;

      if (!isMember && !isOwner) {
        throw new Error('Você não tem permissão para adicionar subtarefas nesta tarefa');
      }
    }
    // Tarefa avulsa (sem projeto): qualquer usuário autenticado pode adicionar

    // Inserir subtarefa
    const { data: subtask, error: insertError } = await supabaseAdmin
      .from('task_subtasks')
      .insert({
        task_id,
        titulo: titulo.trim(),
        concluida: false,
        due_date: due_date || null,
        responsavel_id: responsavel_id || null,
        sort_order: sort_order ?? 1,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir subtarefa:', insertError);
      throw new Error('Erro ao criar subtarefa: ' + insertError.message);
    }

    if (!subtask) {
      throw new Error('Subtarefa não foi criada');
    }

    return new Response(JSON.stringify({ success: true, data: subtask }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro na função add-subtask:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erro interno ao adicionar subtarefa',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
