import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Usa service role para bypassar RLS no INSERT e SELECT
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Valida o token do usuário que está fazendo a requisição
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { userId, type, title, message, relatedType, relatedId, actorId } = body;

    if (!userId || !type || !title || !message) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando: userId, type, title, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[create-notification] Inserindo notificação para userId: ${userId}`);
    console.log(`[create-notification] Tipo: ${type}, Título: ${title}`);
    console.log(`[create-notification] Actor: ${actorId}, RelatedType: ${relatedType}`);

    // Insere com service role — bypassa RLS completamente
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: userId,
        type,
        title,
        message,
        related_type: relatedType || null,
        related_id: relatedId || null,
        actor_id: actorId || null,
        read: false,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      console.error("[create-notification] Erro ao inserir:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!inserted) {
      console.warn("[create-notification] INSERT não retornou dados");
      return new Response(
        JSON.stringify({ success: false, error: "Notificação não foi criada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[create-notification] ✅ Notificação criada com sucesso! ID: ${inserted.id}`);

    // Disparar e-mail se o destinatário tiver notificações por e-mail ativas
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("nome, email, notificacoes_email, notificacoes_tarefas")
        .eq("id", userId)
        .maybeSingle();

      if (profile?.notificacoes_email && profile?.email) {
        const shouldSendEmail =
          !["task", "deadline", "overdue", "comment"].includes(type) ||
          profile.notificacoes_tarefas;

        if (shouldSendEmail) {
          // Dispara e-mail de forma assíncrona (não bloqueia a resposta)
          const emailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email-notification`;
          fetch(emailUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
            },
            body: JSON.stringify({
              userId,
              notificationId: inserted.id,
              type,
              title,
              message,
              recipientEmail: profile.email,
              recipientName: profile.nome || "Usuário",
            }),
          }).catch((e) => console.warn("[create-notification] Erro ao disparar e-mail:", e));
        }
      }
    } catch (emailErr) {
      console.warn("[create-notification] Erro ao verificar e-mail:", emailErr);
    }

    return new Response(
      JSON.stringify({ success: true, id: inserted.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[create-notification] Exceção:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
