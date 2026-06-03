import { supabase } from '../lib/supabaseClient';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html },
    });

    if (error) {
      console.error('Erro ao enviar email:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Erro ao chamar função de email:', error);
    return { data: null, error };
  }
}

// Templates de email
export const emailTemplates = {
  newUserSignup: (userName: string, userEmail: string) => `
    <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
      <div style="background:#1a1a2e;padding:20px;text-align:center;">
        <h2 style="color:#2dd4bf;margin:0;">TaskFlow</h2>
      </div>
      <div style="padding:24px;background:#ffffff;">
        <h3 style="color:#1a1a2e;margin-top:0;">Novo usuário aguardando aprovação</h3>
        <p style="color:#4b5563;line-height:1.6;">
          Um novo usuário se cadastrou na plataforma e está aguardando aprovação:
        </p>
        <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:4px 0;color:#1a1a2e;"><strong>Nome:</strong> ${userName}</p>
          <p style="margin:4px 0;color:#1a1a2e;"><strong>Email:</strong> ${userEmail}</p>
        </div>
        <p style="color:#4b5563;line-height:1.6;">
          Acesse o painel administrativo para aprovar ou rejeitar este usuário.
        </p>
      </div>
      <div style="background:#f3f4f6;padding:16px;text-align:center;color:#6b7280;font-size:12px;">
        <p style="margin:0;">TaskFlow - Sistema de Gestão de Projetos</p>
      </div>
    </div>
  `,

  userApproved: (userName: string, loginUrl: string) => `
    <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
      <div style="background:#1a1a2e;padding:20px;text-align:center;">
        <h2 style="color:#2dd4bf;margin:0;">TaskFlow</h2>
      </div>
      <div style="padding:24px;background:#ffffff;">
        <h3 style="color:#1a1a2e;margin-top:0;">Sua conta foi aprovada! 🎉</h3>
        <p style="color:#4b5563;line-height:1.6;">
          Olá ${userName},
        </p>
        <p style="color:#4b5563;line-height:1.6;">
          Sua conta no TaskFlow foi aprovada pelo administrador. Agora você pode acessar todas as funcionalidades da plataforma!
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${loginUrl}" style="background:#2dd4bf;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">
            Acessar Plataforma
          </a>
        </div>
        <p style="color:#4b5563;line-height:1.6;">
          Bem-vindo à equipe!
        </p>
      </div>
      <div style="background:#f3f4f6;padding:16px;text-align:center;color:#6b7280;font-size:12px;">
        <p style="margin:0;">TaskFlow - Sistema de Gestão de Projetos</p>
      </div>
    </div>
  `,

  taskAssigned: (userName: string, taskTitle: string, projectName: string, dueDate?: string, taskUrl?: string) => `
    <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
      <div style="background:#1a1a2e;padding:20px;text-align:center;">
        <h2 style="color:#2dd4bf;margin:0;">TaskFlow</h2>
      </div>
      <div style="padding:24px;background:#ffffff;">
        <h3 style="color:#1a1a2e;margin-top:0;">Nova tarefa atribuída a você</h3>
        <p style="color:#4b5563;line-height:1.6;">
          Olá ${userName},
        </p>
        <p style="color:#4b5563;line-height:1.6;">
          Uma nova tarefa foi atribuída a você:
        </p>
        <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:4px 0;color:#1a1a2e;"><strong>Tarefa:</strong> ${taskTitle}</p>
          <p style="margin:4px 0;color:#1a1a2e;"><strong>Projeto:</strong> ${projectName}</p>
          ${dueDate ? `<p style="margin:4px 0;color:#1a1a2e;"><strong>Prazo:</strong> ${dueDate}</p>` : ''}
        </div>
        ${taskUrl ? `
        <div style="text-align:center;margin:24px 0;">
          <a href="${taskUrl}" style="background:#2dd4bf;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">
            Ver Tarefa
          </a>
        </div>
        ` : ''}
      </div>
      <div style="background:#f3f4f6;padding:16px;text-align:center;color:#6b7280;font-size:12px;">
        <p style="margin:0;">TaskFlow - Sistema de Gestão de Projetos</p>
      </div>
    </div>
  `,

  taskDeadlineReminder: (userName: string, taskTitle: string, projectName: string, dueDate: string, isToday: boolean, taskUrl?: string) => `
    <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
      <div style="background:#1a1a2e;padding:20px;text-align:center;">
        <h2 style="color:#2dd4bf;margin:0;">TaskFlow</h2>
      </div>
      <div style="padding:24px;background:#ffffff;">
        <h3 style="color:#dc2626;margin-top:0;">⏰ Lembrete de Prazo</h3>
        <p style="color:#4b5563;line-height:1.6;">
          Olá ${userName},
        </p>
        <p style="color:#4b5563;line-height:1.6;">
          ${isToday ? 'O prazo desta tarefa vence <strong>hoje</strong>!' : 'O prazo desta tarefa vence <strong>amanhã</strong>!'}
        </p>
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:4px 0;color:#1a1a2e;"><strong>Tarefa:</strong> ${taskTitle}</p>
          <p style="margin:4px 0;color:#1a1a2e;"><strong>Projeto:</strong> ${projectName}</p>
          <p style="margin:4px 0;color:#1a1a2e;"><strong>Prazo:</strong> ${dueDate}</p>
        </div>
        ${taskUrl ? `
        <div style="text-align:center;margin:24px 0;">
          <a href="${taskUrl}" style="background:#dc2626;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">
            Ver Tarefa
          </a>
        </div>
        ` : ''}
      </div>
      <div style="background:#f3f4f6;padding:16px;text-align:center;color:#6b7280;font-size:12px;">
        <p style="margin:0;">TaskFlow - Sistema de Gestão de Projetos</p>
      </div>
    </div>
  `,

  commentMention: (userName: string, mentionedBy: string, taskTitle: string, commentText: string, taskUrl?: string) => `
    <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
      <div style="background:#1a1a2e;padding:20px;text-align:center;">
        <h2 style="color:#2dd4bf;margin:0;">TaskFlow</h2>
      </div>
      <div style="padding:24px;background:#ffffff;">
        <h3 style="color:#1a1a2e;margin-top:0;">Você foi mencionado em um comentário</h3>
        <p style="color:#4b5563;line-height:1.6;">
          Olá ${userName},
        </p>
        <p style="color:#4b5563;line-height:1.6;">
          <strong>${mentionedBy}</strong> mencionou você em um comentário na tarefa <strong>${taskTitle}</strong>:
        </p>
        <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #2dd4bf;">
          <p style="margin:0;color:#1a1a2e;font-style:italic;">"${commentText}"</p>
        </div>
        ${taskUrl ? `
        <div style="text-align:center;margin:24px 0;">
          <a href="${taskUrl}" style="background:#2dd4bf;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">
            Ver Comentário
          </a>
        </div>
        ` : ''}
      </div>
      <div style="background:#f3f4f6;padding:16px;text-align:center;color:#6b7280;font-size:12px;">
        <p style="margin:0;">TaskFlow - Sistema de Gestão de Projetos</p>
      </div>
    </div>
  `,
};