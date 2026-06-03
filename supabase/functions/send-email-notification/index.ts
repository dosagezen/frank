import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function buildEmailHtml(title: string, message: string, name: string, type: string): string {
  const colors: Record<string, string> = {
    overdue: "#EF4444", deadline: "#F59E0B", task: "#14B8A6",
    comment: "#0EA5E9", team: "#10B981", project: "#6366F1", daily_summary: "#8B5CF6", test: "#14B8A6",
  };
  const icons: Record<string, string> = {
    overdue: "⚠️", deadline: "⏰", task: "📋",
    comment: "💬", team: "👥", project: "📁", daily_summary: "📊", test: "✅",
  };
  const labels: Record<string, string> = {
    overdue: "Tarefa Atrasada", deadline: "Prazo Próximo", task: "Nova Tarefa",
    comment: "Novo Comentário", team: "Equipe", project: "Projeto", daily_summary: "Resumo Diário", test: "Teste de Notificação",
  };
  const bg = colors[type] || "#6B7280";
  const icon = icons[type] || "🔔";
  const label = labels[type] || "Notificação";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.07);"><tr><td style="background:${bg};padding:28px 32px;text-align:center;"><div style="font-size:32px;margin-bottom:8px;">${icon}</div><h1 style="color:#fff;font-size:20px;margin:0;">${label}</h1></td></tr><tr><td style="padding:32px;"><p style="color:#374151;font-size:15px;margin:0 0 8px;">Olá, <strong>${name}</strong></p><h2 style="color:#111827;font-size:18px;margin:0 0 16px;">${title}</h2><div style="background:#f9fafb;border-left:4px solid ${bg};border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px;"><p style="color:#4b5563;font-size:14px;margin:0;line-height:1.6;">${message}</p></div><p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">Você recebeu este e-mail porque suas notificações estão ativadas.<br>Para desativar, acesse seu perfil.</p></td></tr><tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;"><p style="color:#9ca3af;font-size:11px;margin:0;">TaskFlow Pro</p></td></tr></table></td></tr></table></body></html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verificar autenticação — aceita Bearer token do usuário OU anon key
    const authHeader = req.headers.get("Authorization") || "";
    const apikeyHeader = req.headers.get("apikey") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    let isAuthenticated = false;

    // 1. Verificar se é a anon key diretamente
    if (token === anonKey || apikeyHeader === anonKey) {
      isAuthenticated = true;
      console.log("[send-email-notification] Autenticado via anon key");
    }

    // 2. Verificar se é a service role key
    if (!isAuthenticated && token === serviceRoleKey) {
      isAuthenticated = true;
      console.log("[send-email-notification] Autenticado via service role key");
    }

    // 3. Verificar se é um JWT válido de usuário
    if (!isAuthenticated && token && token.includes(".")) {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (!authErr && user) {
          isAuthenticated = true;
          console.log("[send-email-notification] Autenticado via JWT do usuário:", user.id.substring(0, 8));
        }
      } catch {
        // continua para próxima verificação
      }
    }

    if (!isAuthenticated) {
      console.error("[send-email-notification] Falha na autenticação. Token:", token.substring(0, 20) + "...");
      return new Response(
        JSON.stringify({ error: "Não autorizado", hint: "Token inválido ou expirado. Faça login novamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { userId, notificationId, type, title, message, recipientEmail, recipientName } = body;

    console.log(`[send-email-notification] Iniciando envio para: ${recipientEmail}, tipo: ${type}`);

    if (!recipientEmail || !title || !message) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando: recipientEmail, title, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isTest = type === "test";

    if (!isTest && userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("notificacoes_email, notificacoes_tarefas, resumo_diario")
        .eq("id", userId)
        .maybeSingle();

      if (!profile || !profile.notificacoes_email) {
        return new Response(
          JSON.stringify({ success: false, reason: "email_disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (["task", "deadline", "overdue", "comment"].includes(type) && !profile.notificacoes_tarefas) {
        return new Response(
          JSON.stringify({ success: false, reason: "task_notifications_disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (type === "daily_summary" && !profile.resumo_diario) {
        return new Response(
          JSON.stringify({ success: false, reason: "daily_summary_disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (notificationId) {
        const { data: existing } = await supabase
          .from("email_notifications_log")
          .select("id")
          .eq("notification_id", notificationId)
          .limit(1);
        if (existing && existing.length > 0) {
          return new Response(
            JSON.stringify({ success: false, reason: "already_sent" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      console.error("[send-email-notification] RESEND_API_KEY não configurada");
      return new Response(
        JSON.stringify({
          success: false,
          reason: "resend_key_missing",
          error: "RESEND_API_KEY não está configurada nas variáveis de ambiente do Supabase.",
          hint: "Acesse o painel do Supabase > Edge Functions > Secrets e adicione RESEND_API_KEY."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-email-notification] RESEND_API_KEY encontrada (${resendKey.length} chars), começa com: ${resendKey.substring(0, 8)}...`);

    const html = buildEmailHtml(title, message, recipientName || "Usuário", type);
    const subject = isTest ? "✅ Teste de notificação — TaskFlow" : `[TaskFlow] ${title}`;
    const fromAddress = "TaskFlow <onboarding@resend.dev>";

    console.log(`[send-email-notification] Enviando de: ${fromAddress} para: ${recipientEmail}`);

    const resendPayload = {
      from: fromAddress,
      to: [recipientEmail],
      subject,
      html,
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendRes.json();
    console.log(`[send-email-notification] Status Resend: ${resendRes.status}`);
    console.log(`[send-email-notification] Resposta Resend:`, JSON.stringify(resendData));

    if (!resendRes.ok) {
      let errorMsg = resendData?.message || resendData?.name || "Erro desconhecido do Resend";
      let hint = "";

      if (resendRes.status === 401 || resendData?.message?.toLowerCase().includes("api key") || resendData?.message?.toLowerCase().includes("unauthorized")) {
        hint = "A RESEND_API_KEY está inválida ou expirada. Acesse resend.com/api-keys, copie a chave completa (começa com 're_') e atualize no Supabase em Settings > Edge Functions > Secrets.";
      } else if (resendData?.name === "validation_error" || resendData?.message?.includes("domain") || resendData?.message?.includes("sender")) {
        hint = "O remetente 'onboarding@resend.dev' só pode enviar para o e-mail da sua conta Resend. Para enviar para qualquer destinatário, verifique um domínio próprio em resend.com/domains.";
      } else if (resendData?.message?.includes("rate limit") || resendRes.status === 429) {
        hint = "Limite de envios atingido. Aguarde alguns minutos e tente novamente.";
      } else {
        hint = "Verifique se a RESEND_API_KEY está correta no Supabase (Settings > Edge Functions > Secrets).";
      }

      console.error(`[send-email-notification] Erro Resend:`, resendData);

      return new Response(
        JSON.stringify({
          success: false,
          reason: "resend_error",
          error: `Erro HTTP ${resendRes.status}: ${errorMsg}`,
          hint,
          details: resendData,
          statusCode: resendRes.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Registrar no log
    if (userId) {
      await supabase.from("email_notifications_log").insert({
        user_id: userId,
        notification_id: notificationId || null,
        email_type: type,
        subject,
        status: "sent",
      });
    }

    console.log(`[send-email-notification] ✅ E-mail enviado com sucesso! ID: ${resendData.id}`);

    return new Response(
      JSON.stringify({ success: true, method: "resend", id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[send-email-notification] Erro inesperado:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
        reason: "unexpected_error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
