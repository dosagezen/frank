# PRD - Frank (Product Requirements Document)

**Versão:** 1.0  
**Data:** 03/06/2026  
**Status:** Em produção (fases 1-6 concluídas)  
**Plataforma:** Web SPA (Single Page Application)  
**Idioma:** Português (pt-BR)  
**Fuso horário base:** Brasília (UTC-3)  

---

## 1. Sumário Executivo

Frank é uma plataforma completa de **gerenciamento de projetos, tarefas e colaboração em equipe**, construída como uma SPA moderna com React, TypeScript, TailwindCSS e Supabase. O produto oferece um ecossistema integrado que inclui: gestão de projetos com sprints e metodologia Kanban, controle de tarefas com subtarefas e comentários, calendário multi-view com integração Gantt, base de conhecimento compartilhada, gerenciamento de equipe, relatórios analíticos, notificações em tempo real e um sistema de autenticação com aprovação de usuários.

---

## 2. Introdução

### 2.1 Visão do Produto
Frank nasceu da necessidade de centralizar o trabalho colaborativo em uma única plataforma intuitiva. Ao invés de usar múltiplas ferramentas desconectadas (Trello para Kanban, Excel para projetos, Slack para notificações, Google Calendar para eventos), Frank consolida tudo em um ambiente unificado com experiência fluida e dados em tempo real.

### 2.2 Proposta de Valor
- **Centralização:** Projetos, tarefas, eventos, equipe e conhecimento em um só lugar
- **Colaboração real:** Notificações em tempo real, comentários com menções, atribuição de tarefas
- **Visibilidade:** Dashboards personalizados, relatórios de produtividade, gráficos de burndown
- **Controle:** Permissões granulares, projetos públicos/privados, aprovação de novos usuários
- **Performance:** Cache inteligente, sincronização em tempo real, lazy loading de páginas

### 2.3 Contexto do Mercado
Dirigido a equipes brasileiras de pequeno e médio porte (5-100 membros), startups, agências de marketing e desenvolvimento de software, departamentos corporativos e times de produto. O mercado-alvo é empresas que precisam de uma solução mais robusta que planilhas, mas não querem a complexidade de plataformas enterprise.

---

## 3. Objetivo

### 3.1 Objetivos de Negócio
| # | Objetivo | Status |
|---|---------|--------|
| 1 | Reduzir o tempo de gestão de projetos em 40% | Em medição |
| 2 | Eliminar a necessidade de múltiplas ferramentas | Concluído |
| 3 | Aumentar a transparência entre equipe com dashboards visuais | Concluído |
| 4 | Reduzir atrasos de projetos com alertas automáticos de prazo | Concluído |
| 5 | Proporcionar onboarding de novos membros em menos de 5 minutos | Concluído |

### 3.2 Metas de Produto
- **UX:** Tempo de carregamento inicial < 2 segundos (com cache)
- **Disponibilidade:** Sistema operacional 24/7 com sincronização em tempo real
- **Escalabilidade:** Suportar até 100 usuários ativos simultâneos por workspace
- **Usabilidade:** Novo usuário deve criar primeiro projeto em < 3 minutos após login
- **Acessibilidade:** Interface responsiva (desktop/mobile) com dark mode completo

---

## 4. Público-Alvo

### 4.1 Personas Principais

#### Persona 1: Product Manager / Gerente de Projeto
- **Nome:** Ana, 34 anos
- **Dor:** Dificuldade em acompanhar múltiplos projetos e sprints
- **Necessidade:** Visão consolidada de todos os projetos, relatórios de produtividade, controle de prazos
- **Funcionalidades usadas:** Projetos, Sprints, Gantt, Relatórios, Painel

#### Persona 2: Desenvolvedor / Executor de Tarefas
- **Nome:** Bruno, 28 anos
- **Dor:** Perde tarefas atribuídas, não sabe prioridade de trabalho
- **Necessidade:** Lista clara de tarefas, notificações de prazo, subtarefas
- **Funcionalidades usadas:** Tarefas, Calendário, Notificações, Subtarefas

#### Persona 3: Administrador / CEO
- **Nome:** Carlos, 42 anos
- **Dor:** Falta de controle sobre quem acessa o sistema, necessidade de aprovar novos usuários
- **Necessidade:** Gerenciamento de usuários, relatórios de equipe, controle de acesso
- **Funcionalidades usadas:** Admin, Equipe, Relatórios, Notificações

#### Persona 4: Membro de Equipe (Viewer)
- **Nome:** Diana, 25 anos
- **Dor:** Precisa acompanhar projetos sem poder editar
- **Necessidade:** Visibilidade de projetos, calendário compartilhado, base de conhecimento
- **Funcionalidades usadas:** Projetos (visualização), Calendário, Conhecimento, Equipe

### 4.2 Segmentos de Mercado
- **Startups tech brasileiras** (5-30 pessoas)
- **Agências de marketing e design** (10-50 pessoas)
- **Times de produto em empresas maiores** (5-20 pessoas)
- **Consultorias de desenvolvimento** (5-50 pessoas)
- **Departamentos de TI** (10-100 pessoas)

---

## 5. Stack Tecnológica

### 5.1 Frontend

| Tecnologia | Versão | Proposta |
|------------|--------|----------|
| **React** | 19.1.0 | Framework UI declarativo com hooks |
| **TypeScript** | 5.8.3 | Tipagem estática, DX superior, menos bugs |
| **TailwindCSS** | 3.4.17 | Utility-first CSS, design system rápido |
| **Vite** | 7.0.3 | Build tool ultrarrápido, HMR instantâneo |
| **React Router DOM** | 7.6.3 | Roteamento SPA com lazy loading |
| **i18next** | 25.4.1 | Internacionalização (pt-BR padrão) |
| **Recharts** | 3.2.0 | Gráficos e visualizações de dados |
| **@dnd-kit** | 6.3.1+ | Drag & drop para calendário e Kanban |
| **Lucide React** | 0.539.0 | Biblioteca de ícones (limite de 20KB) |
| **Remix Icon** | 4.0.0 | Ícones via CDN (ícones principais da UI) |
| **Google Fonts** | - | Poppins (titulos) + Inter (corpo) |

### 5.2 Backend / BaaS

| Tecnologia | Versão | Proposta |
|------------|--------|----------|
| **Supabase** | 2.57.4 | BaaS completo: Auth, DB, Realtime, Storage |
| **Supabase JS Client** | 2.57.4 | Cliente singleton para queries e auth |
| **Deno Edge Functions** | 1.168.0 | Serverless functions na Supabase |
| **Resend API** | - | Envio de emails transacionais via Edge Function |
| **Firebase** | 12.0.0 | Integração auxiliar (cloud storage) |

### 5.3 Banco de Dados

| Banco | Uso |
|-------|-----|
| **PostgreSQL** (via Supabase) | Dados principais: projetos, tarefas, usuários, eventos, notificações |
| **IndexedDB** | Cache local do frontend (TTL configurável) |
| **LocalStorage** | Tokens de auth, flags de estado, cooldown de notificações |
| **SessionStorage** | Flags de reload de chunks (deploy sem cache) |

### 5.4 Infraestrutura

| Camada | Tecnologia |
|--------|-----------|
| **Hosting** | Readdy.ai (deploy automático) |
| **CDN** | Readdy.ai CDN |
| **Edge Functions** | Supabase Functions (Deno) |
| **Storage** | Supabase Storage (arquivos de projeto) |
| **Auth** | Supabase Auth (JWT + PKCE) |
| **Realtime** | Supabase Realtime (WebSocket) |
| **Email** | Resend.com (via Edge Function) |

---

## 6. Arquitetura do Sistema

### 6.1 Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (SPA)                       │
│  React 19 + TypeScript + Tailwind + Vite + React Router  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │  Pages  │ │Contexts │ │ Services│ │  Hooks  │         │
│  │(lazy)   │ │(Auth,   │ │(Supabase│ │(useCache│         │
│  │         │ │ Toast,  │ │ Helpers)│ │, Realtime│         │
│  │         │ │ Sidebar)│ │         │ │         │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
├─────────────────────────────────────────────────────────┤
│                      DATA LAYER                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │LocalCache│ │ Supabase│ │ Realtime│ │  Mock   │         │
│  │(IndexedDB│ │  Client │ │  Sync   │ │  Data   │         │
│  │ + TTL)  │ │ (Singleton)│ (Channels)│         │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
├─────────────────────────────────────────────────────────┤
│                      BACKEND (Supabase)                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │PostgreSQL│ │ Auth    │ │ Storage │ │ Realtime│         │
│  │(RLS)    │ │ (JWT)   │ │(Files)  │ │(Postgres │         │
│  │         │ │         │ │         │ │ Changes) │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
│  ┌─────────────────────────────────────────────────┐         │
│  │         EDGE FUNCTIONS (Deno)                  │         │
│  │  • send-email-notification (Resend)             │         │
│  │  • create-notification (RLS bypass)           │         │
│  │  • get-team-emails (auth.users seguro)          │         │
│  │  • confirm-user-email (auto-aprovação)          │         │
│  │  • delete-user-auth (limpeza completa)            │         │
│  │  • add-subtask (RPC otimizado)                    │         │
│  │  • send-email (template genérico)                 │         │
│  └─────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Fluxo de Dados Principal

1. **Usuário acessa** → AppLayout carrega com Sidebar + Header
2. **AuthContext** verifica sessão JWT via Supabase (PKCE flow)
3. **useCachedData** busca dados do IndexedDB (cache) primeiro, revalida em background
4. **Serviços** consultam Supabase via JOINs otimizados (uma query por página)
5. **RealtimeSync** escuta mudanças no banco e invalida cache automaticamente
6. **Edge Functions** executam operações sensíveis (email, RLS bypass)

---

## 7. Estrutura de Páginas

### 7.1 Páginas Públicas (sem autenticação)

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/` | `HomePage` | Landing page com hero, features, footer |
| `/login` | `LoginPage` | Login, cadastro, recuperação de senha |
| `/confirmar-email` | `ConfirmarEmailPage` | Confirmação de email pós-cadastro |
| `/reset-password` | `ResetPasswordPage` | Redefinição de senha (PKCE flow) |

### 7.2 Páginas Protegidas (AppLayout + Sidebar)

| Rota | Componente | Descrição | Cache Key |
|------|-----------|-----------|-----------|
| `/painel` | `PainelPage` | Dashboard com widgets e quick actions | Multi |
| `/projetos` | `ProjetosPage` | Lista/grid de projetos com filtros | `projects_list` |
| `/tarefas` | `TarefasPage` | Lista/Kanban de tarefas com filtros | `tasks_list` |
| `/equipe` | `EquipePage` | Cards de membros com estatísticas | `equipe-members` |
| `/calendario` | `CalendarioPage` | Calendário (mês/semana/dia) + Gantt | `calendario-*` |
| `/conhecimento` | `ConhecimentoPage` | Base de conhecimento com tags | `conhecimento-list` |
| `/arquivos` | `ArquivosPage` | Gerenciamento de arquivos | - |
| `/relatorios` | `RelatoriosPage` | Dashboards e gráficos analíticos | `relatorios-*` |
| `/notificacoes` | `NotificacoesPage` | Central de notificações | `notificacoes-list` |

### 7.3 Página Admin (AppLayout + adminOnly)

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/admin` | `AdminPage` | Gerenciamento de usuários, roles, aprovação |

### 7.4 Página 404

| Rota | Componente |
|------|-----------|
| `*` | `NotFoundPage` |

---

## 8. Funcionalidades Principais

### 8.1 Módulo de Projetos

#### 8.1.1 CRUD de Projetos
- **Criar:** Nome, descrição, status, prioridade, cor, data de início, deadline, agregado, privacidade
- **Editar:** Todos os campos com permissão granular (criador, admin, membro)
- **Excluir:** Apenas criador ou admin, com cascade de relacionamentos
- **Visualização:** Grid 3 colunas (desktop) / List (alternável) com progresso de tarefas

#### 8.1.2 Relacionamentos do Projeto
- **Equipe:** Membros com avatar, nome, cargo (via `project_members`)
- **Product Manager:** Designação única via `project_product_manager`
- **Sprints:** Múltiplas sprints com nome, data de início, data de término, membros, status
- **Links:** URLs com título (via `project_links`)
- **Entregáveis:** Lista de entregáveis (via `project_entregaveis`)
- **Contatos de Setor:** Sigla, nome do setor, múltiplos contatos com nome/email/telefone (via `project_sector_contacts` + `sector_contact_persons`)
- **Histórico de Atividades:** Log automático de todas as alterações (via `project_activity_log`)

#### 8.1.3 Etapas do Kanban (kanban_stage)
- Backlog → Desafio → Persona → Proposta de Valor → Validação → MVP
- Cada projeto pode estar em apenas uma etapa
- Etapa visível como badge no card do projeto

#### 8.1.4 Sprints
- **CRUD completo** dentro do projeto
- **Datas:** start_date e end_date (YYYY-MM-DD)
- **Membros:** Array de IDs de perfis
- **Status:** ativo, concluído, parado
- **Tarefas:** Vinculação via sprint_id na tabela tasks
- **Ordenação:** sprint_order para reordenação visual

#### 8.1.5 Permissões
- **Criador:** Pode tudo
- **Admin:** Pode tudo em todos os projetos
- **Membro:** Pode editar projetos públicos onde é membro
- **Projeto Privado:** Apenas criador e admin podem gerenciar
- **Viewer:** Pode visualizar (se membro), não editar

### 8.2 Módulo de Tarefas

#### 8.2.1 CRUD de Tarefas
- **Campos:** Título, descrição, status, prioridade, prazo (due_date), categoria, tags, responsável, projeto, sprint, tempo estimado, recorrência, observações, progresso (%)
- **Recorrência:** Sem recorrência, Diário, Semanal, Quinzenal, Mensal, Bimestral, Trimestral, Anual
- **Links:** Múltiplos links anexos à tarefa

#### 8.2.2 Status da Tarefa
- **Fazer** → **Fazendo** → **Aguardando** → **Parado** → **Feito**
- Mudança inline via dropdown no card
- Toggle rápido de concluído via checkbox

#### 8.2.3 Subtarefas
- CRUD completo via tabela `task_subtasks`
- Progresso visual com barra de porcentagem
- Conclusão individual

#### 8.2.4 Comentários
- Thread de comentários com avatar, nome, timestamp
- Menções automáticas com @nome
- Notificação ao responsável quando comentado

#### 8.2.5 Permissões de Tarefa
- **Criador:** Pode tudo
- **Responsável:** Pode editar status, prioridade, prazo, progresso
- **Membro do projeto:** Pode editar
- **Outros:** Apenas visualização (badge "Somente visualização")

### 8.3 Módulo de Calendário

#### 8.3.1 Views
- **Mês:** Grade 7xN com células clicáveis, hover preview, drag-drop
- **Semana:** Timeline vertical com slots de hora
- **Dia:** Agenda detalhada do dia
- **Gantt:** Timeline horizontal com projetos e sprints

#### 8.3.2 Fontes de Dados
- **Eventos manuais:** Reunião, Apresentação, Revisão, Workshop, Treinamento, Brainstorm, Deadline
- **Tarefas:** Sincronizadas automaticamente (due_date)
- **Projetos:** Deadlines e datas de início
- **Sprints:** Datas de término

#### 8.3.3 Recorrência
- Tipos: Nenhuma, Diário, Semanal, Mensal
- Data de término opcional
- Edição de série ou ocorrência única
- Exclusão individual ou de toda a série

#### 8.3.4 Drag & Drop
- Arrastar eventos entre dias para remarcar
- Atualização otimista (UI responde imediatamente, sync em background)

### 8.4 Módulo de Equipe

#### 8.4.1 Perfil do Membro
- Nome, email, cargo, departamento, telefone, localização, bio, avatar, aniversário
- Estatísticas: tarefas ativas, projetos, concluídas

#### 8.4.2 Gerenciamento (Admin)
- **Adicionar:** Convite por email (cria perfil com status "pendente")
- **Editar:** Todos os campos do perfil
- **Remover:** Deleta perfil e sincroniza em todas as tabelas (project_members, task_comments)
- **Mudar Role:** Admin ↔ Membro
- **Mudar Status:** Ativo / Pendente / Inativo
- **Sincronização:** Avatar/nome/cargo replicados em project_members e task_comments

#### 8.4.3 Auto-sync
- Quando um usuário atualiza seu perfil, todos os `project_members` e `task_comments` são atualizados automaticamente

### 8.5 Módulo de Notificações

#### 8.5.1 Notificações Automáticas
Geradas a cada 5 minutos (cooldown) com detecção de duplicatas:
- **Tarefas com prazo próximo** (hoje + 3 dias)
- **Tarefas atrasadas**
- **Sprints com prazo próximo**
- **Sprints atrasadas**
- **Projetos com deadline próximo**
- **Projetos atrasados**
- **Tarefas recém-atribuídas** (últimas 24h)
- **Eventos do calendário** (próximas 24h)
- **Check pró-ativo de prazos** (a cada 10 minutos)

#### 8.5.2 Notificações de Ação
- **Status alterado:** Notifica o responsável quando alguém muda o status
- **Reatribuição:** Notifica antigo e novo responsável
- **Alteração de campos:** Detecta mudança em qualquer campo (título, descrição, prioridade, prazo, categoria, tags, tempo estimado, recorrência, observações, progresso)
- **Novo anexo:** Notifica quando arquivo é adicionado à tarefa

#### 8.5.3 Canais
- **In-app:** Toast notifications, badge na sidebar, página dedicada
- **Email:** Via Resend.com (Edge Function), templates HTML responsivos
- **Tempo real:** Canal Realtime do Supabase para notificações instantâneas

#### 8.5.4 Controle de Envio
- Deduplicação via localStorage (chave única por notificação + data)
- Cooldown de 5 minutos entre gerações automáticas
- Verificação no banco antes de inserir (evita duplicatas)

### 8.6 Módulo de Relatórios

#### 8.6.1 Dashboards
- **Stats Cards:** Tarefas concluídas, total, projetos ativos, taxa de conclusão, membros ativos, tarefas atrasadas
- **Produtividade Semanal:** Gráfico de barras (tarefas concluídas vs criadas por dia)
- **Tendência de Performance:** Gráfico de linha (4 semanas)
- **Distribuição de Status:** Gráfico de pizza/donut
- **Progresso de Projetos:** Gráfico de barras horizontais
- **Burndown de Sprint:** Gráfico de linha por sprint
- **Breakdown de Prioridade:** Cards com cores por prioridade
- **Ranking de Equipe:** Tabela com percentual de conclusão
- **Atividade Recente:** Lista com ícones e timestamps

#### 8.6.2 Filtros
- Período: 7 dias, 30 dias, 90 dias
- Projeto: Todos ou projeto específico (dropdown com cores)
- Atualização manual com botão de refresh

### 8.7 Módulo de Base de Conhecimento

#### 8.7.1 CRUD de Artigos
- **Campos:** Título, descrição, link externo, thumbnail, autor, data de publicação, tags
- **Visualização:** Cards com thumbnail, estatísticas de visualização, badge "NOVO"
- **Paginação:** 15 itens por página com navegação completa
- **Filtros:** Busca por texto + filtros por tags (múltiplas)
- **Contador:** Visualizações incrementadas ao clicar

#### 8.7.2 Destaque por Busca
- Navegação direta para artigo específico via busca global
- Card destacado com ring e banner "Resultado da sua busca"

### 8.8 Módulo de Arquivos

#### 8.8.1 Gerenciamento
- Upload de arquivos vinculados a projetos e tarefas
- Filtros por tipo (PDF, imagens, documentos, planilhas)
- Download direto do Supabase Storage
- Ícones por tipo de arquivo

### 8.9 Módulo Admin

#### 8.9.1 Gerenciamento de Usuários
- **Tabela completa:** Nome, email, cargo, role, status, data de criação
- **Ações:** Alterar role, alterar status, deletar
- **Filtros:** Todos, Admins, Membros, Pendentes (com badge de contagem)
- **Busca:** Por nome, email, cargo

#### 8.9.2 Fluxo de Aprovação
1. Novo usuário se cadastra → status "pendente"
2. Notificação automática para todos os admins
3. Admin aprova → status "ativo", email de boas-vindas via Resend
4. Auto-confirmação de email via Edge Function
5. Usuário pendente tenta logar → mensagem clara de aprovação

#### 8.9.3 Deleção Completa
- Remove perfil, comentários, notificações, arquivos, eventos, membros de projetos, tarefas, subtarefas
- Chama Edge Function para deletar do Supabase Auth

### 8.10 Painel de Controle (Dashboard)

#### 8.10.1 Widgets
- **Stats Overview:** Cards com contadores principais
- **Quick Actions:** Botões para criar tarefa, projeto, convidar membro, agendar reunião
- **Tasks Widget:** Lista das tarefas mais recentes
- **Deadlines Widget:** Próximos prazos de tarefas e projetos
- **Projects Widget:** Projetos mais recentes
- **Team Widget:** Membros ativos
- **Activity Feed:** Feed de atividade com ícones

#### 8.10.2 Modais Quick-Add
- NewTaskModal, NewProjectModal, NewMemberModal, NewMeetingModal
- Todos com lazy loading para otimizar bundle

---

## 9. Modelo de Dados

### 9.1 Tabelas Principais

| # | Tabela | Propósito | RLS |
|---|--------|-----------|-----|
| 1 | `profiles` | Perfis de usuários (nome, email, cargo, role, status) | Sim |
| 2 | `projects` | Projetos principais | Sim |
| 3 | `project_members` | Relação projeto-membro | Sim |
| 4 | `project_product_manager` | PM designado por projeto | Sim |
| 5 | `project_sprints` | Sprints dos projetos | Sim |
| 6 | `sprint_tasks` | Tarefas dentro de sprints | Sim |
| 7 | `tasks` | Tarefas principais | Sim |
| 8 | `task_subtasks` | Subtarefas | Sim |
| 9 | `task_comments` | Comentários em tarefas | Sim |
| 10 | `calendar_events` | Eventos do calendário | Sim |
| 11 | `calendar_event_links` | Links de eventos | Sim |
| 12 | `notifications` | Notificações in-app | Sim |
| 13 | `email_notifications_log` | Log de emails enviados | Sim |
| 14 | `knowledge_base` | Base de conhecimento | Sim |
| 15 | `files` | Metadados de arquivos | Sim |
| 16 | `project_links` | Links de projetos | Sim |
| 17 | `project_entregaveis` | Entregáveis de projetos | Sim |
| 18 | `project_sector_contacts` | Setores demandantes | Sim |
| 19 | `sector_contact_persons` | Contatos de setores | Sim |
| 20 | `project_stop_logs` | Logs de projetos parados | Sim |
| 21 | `project_activity_log` | Log de atividades | Sim |

### 9.2 Schema de Projetos (exemplo)

```sql
-- projects
id: uuid (PK)
nome: text
descricao: text
status: text
prioridade: text
progresso: int
prazo: date
deadline: date
data_inicio: date
kanban_stage: text
cor: text
agregado: text
observacoes: text
privado: boolean
user_id: uuid (FK → auth.users)
created_at: timestamp
updated_at: timestamp

-- project_sprints
id: uuid (PK)
project_id: uuid (FK)
name: text
start_date: date
end_date: date
members: text[]
status: text
sprint_order: int

-- tasks
id: uuid (PK)
title: text
description: text
status: text
priority: text
due_date: date
categoria: text
tags: text[]
responsavel_id: uuid (FK → profiles)
user_id: uuid (FK → auth.users)
project_id: uuid (FK → projects)
sprint_id: uuid (FK → project_sprints)
tempo_estimado: text
recurrence_type: text
recurrence_end_date: date
observacoes: text
progress: int
links: jsonb
position: int
created_at: timestamp
updated_at: timestamp
```

### 9.3 Políticas RLS (Row Level Security)

- **Usuários autenticados** podem ler dados de projetos públicos e projetos onde são membros
- **Criadores** podem editar/deletar seus próprios projetos
- **Admins** têm acesso total
- **Notificações:** Usuários só veem suas próprias notificações (filter por user_id)
- **Tasks:** Responsável e criador têm permissões especiais

---

## 10. Serviços e Integrações

### 10.1 Edge Functions (Supabase)

| Função | Arquivo | Propósito | Auth |
|--------|---------|-----------|------|
| `send-email-notification` | `send-email-notification/index.ts` | Envia emails via Resend API | Service Role |
| `create-notification` | `create-notification/index.ts` | Cria notificação com RLS bypass | Service Role |
| `get-team-emails` | `get-team-emails/index.ts` | Busca emails de auth.users | JWT required |
| `get-users-emails` | `get-users-emails/index.ts` | Busca emails para admin | JWT required |
| `confirm-user-email` | `confirm-user-email/index.ts` | Confirma email automaticamente | JWT required |
| `delete-user-auth` | `delete-user-auth/index.ts` | Deleta usuário do Auth | JWT required |
| `add-subtask` | `add-subtask/index.ts` | RPC para adicionar subtarefa | JWT required |
| `send-email` | `send-email/index.ts` | Email genérico | JWT required |

### 10.2 Serviços Frontend

| Serviço | Arquivo | Responsabilidade |
|---------|---------|-------------------|
| `projectsService` | `src/services/projectsService.ts` | CRUD de projetos, sprints, permissões |
| `tasksService` | `src/services/tasksService.ts` | Busca de tarefas com JOINs otimizados |
| `teamService` | `src/services/teamService.ts` | CRUD de membros, estatísticas |
| `notificationsService` | `src/services/notificationsService.ts` | Notificações, email, deduplicação |
| `calendarService` | `src/services/calendarService.ts` | CRUD de eventos, recorrência |
| `calendarIntegrationService` | `src/services/calendarIntegrationService.ts` | Agrega tarefas, projetos, sprints no calendário |
| `conhecimentoService` | `src/services/conhecimentoService.ts` | CRUD da base de conhecimento |
| `emailService` | `src/services/emailService.ts` | Templates de email |
| `activityLogService` | `src/services/activityLogService.ts` | Log automático de alterações |
| `realtimeSyncService` | `src/services/realtimeSyncService.ts` | Invalidação de cache via Realtime |
| `globalSearchService` | `src/services/globalSearchService.ts` | Busca global em todas as tabelas |
| `supabaseHelpers` | `src/services/supabaseHelpers.ts` | Cache em memória, batch fetch, safe queries |
| `localCache` | `src/services/localCache.ts` | IndexedDB com TTL, SWR pattern |

---

## 11. Autenticação e Autorização

### 11.1 Fluxo de Autenticação

1. **Cadastro:** Email + senha + nome completo
2. **Confirmação:** Email de confirmação automático (via Edge Function)
3. **Status:** Perfil criado com `status: 'pendente'`
4. **Aprovação:** Admin recebe notificação e aprova
5. **Login:** JWT com refresh automático, verificação de status
6. **Logout:** Limpa cache, sessão, estado local

### 11.2 Roles (Papéis)

| Role | Permissões |
|------|-----------|
| `admin` | Acesso total. Páginas admin, gerenciamento de usuários, todos os projetos |
| `member` | Cria/editar projetos, tarefas, eventos, conhecimento. Sem acesso admin |

### 11.3 Status de Conta

| Status | Comportamento |
|--------|---------------|
| `ativo` | Acesso normal ao sistema |
| `pendente` | Bloqueado no login. Mensagem: "Aguardando aprovação" |
| `inativo` | Bloqueado no login. Mensagem: "Conta desativada" |

### 11.4 Segurança

- **PKCE Flow:** Para recuperação de senha e confirmação de email
- **JWT Refresh:** Automático a cada 5 minutos via interval
- **Token Cleanup:** Limpa tokens expirados do localStorage na inicialização
- **RLS:** Todas as tabelas protegidas com Row Level Security
- **Service Role:** Usado apenas em Edge Functions (nunca no frontend)
- **Session Check:** Verifica se perfil ainda existe (proteção contra deleção)

---

## 12. Performance e Otimizações

### 12.1 Estratégia de Cache

#### 12.1.1 IndexedDB (Frontend)
- **TTL padrão:** 5 minutos (configurável por query)
- **SWR (Stale-While-Revalidate):** Retorna cache imediatamente, atualiza em background
- **Invalidação:** Automática via Realtime + manual via `invalidate()`
- **Pattern matching:** Invalidação por prefixo (ex: `calendario-*`)

#### 12.1.2 Memória (In-Memory)
- **TTL:** 5 minutos
- **Uso:** Cache de queries frequentes (profiles, team members)
- **Limpeza:** Automática por pattern ou total

#### 12.1.3 Cache Keys
```
projects_list, projects_teams, projects_pms, projects_tasks
tasks_list, tarefas-project-options
profiles_list, team_members, equipe-members
painel-stats, painel-tasks, painel-projects, painel-deadlines, painel-activity, painel-team
admin-users
notificacoes-list
calendario-month-YYYY-MM, calendario-week-YYYY-MM-DD, calendario-day-YYYY-MM-DD
relatorios-PERIOD-PROJECT-USERID
conhecimento-list
```

### 12.2 Otimizações de Query

- **JOINs únicos:** Projetos carregam membros, PM, sprints, links, entregáveis, setores em uma única query
- **Batch fetch:** Reduz N+1 com busca em lote por IDs
- **safeFetchMany/safeFetchOne:** Wrappers com fallback para array vazio/null
- **Head count:** Usa `{ count: 'exact', head: true }` para contagens rápidas

### 12.3 Otimizações de UI

- **Lazy loading:** Todas as páginas carregadas dinamicamente via `lazyWithRetry`
- **Chunk retry:** Detecta chunks desatualizados após deploy e recarrega página
- **Suspense:** Fallback `PageLoading` durante carregamento de chunks
- **Optimistic updates:** UI atualiza imediatamente antes da resposta do servidor (status, drag-drop)

### 12.4 Realtime Sync
- **Escuta:** `projects`, `tasks`, `project_members`, `profiles`, `calendar_events`
- **Ação:** Invalida chaves de cache correspondentes automaticamente
- **Canal único:** `cache-invalidation` com múltiplos listeners

### 12.5 Timezone Handling
- **Salvamento:** `formatDateForDB()` adiciona `T12:00:00` para evitar deslocamento UTC
- **Exibição:** `parseDate()` usa `new Date(dateStr + 'T12:00:00')` para garantir data correta
- **Funções helper:** `parseDate()` e `formatDateBR()` centralizadas em `dateHelpers.ts`

---

## 13. UX/UI Design

### 13.1 Design System

| Token | Uso |
|-------|-----|
| **Primary:** Teal (`#14b8a6` / `teal-500`) | CTAs, botões principais, progresso, badges |
| **Secondary:** Cyan (`#06b6d4`) | Gradientes, hover states |
| **Success:** Emerald (`#10b981`) | Concluído, checkboxes, progresso 100% |
| **Warning:** Amber (`#f59e0b`) | Aguardando, prazos próximos |
| **Danger:** Red (`#ef4444`) | Atrasado, excluir, parado, erro |
| **Info:** Sky (`#0ea5e9`) | Tarefas no calendário, subtarefas |
| **Text:** Gray scale (`gray-900` → `gray-100`) | Hierarquia de leitura |
| **Background:** White / Gray-50 | Cards, sections |
| **Dark Mode:** Gray-900 base, Gray-800 cards, Gray-700 borders | Toggle automático via class |

### 13.2 Tipografia
- **Títulos:** Poppins (400-800)
- **Corpo:** Inter (300-800)
- **Tamanhos:** 10px (labels) → 32px (H1)

### 13.3 Componentes Base
- **UserAvatar:** Fallback com iniciais e cor gerada por nome
- **Toast:** Container global com auto-dismiss
- **PageLoading:** Spinner com mensagem customizada
- **PageError:** Retry com botão de recarregar
- **DatePicker:** Seleção de data com timezone-safe parsing

### 13.4 Responsividade
- **Mobile-first:** Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Navigation:** Sidebar colapsável, hamburger menu em mobile
- **Grids:** `grid-cols-1` → `md:grid-cols-2` → `lg:grid-cols-3`
- **Tables:** Scroll horizontal, cards em mobile
- **Modais:** Full-screen em mobile, centered em desktop

### 13.5 Dark Mode
- **Trigger:** Classe `dark` no elemento raiz
- **Implementação:** `dark:bg-gray-800`, `dark:text-white`, `dark:border-gray-700`
- **Ícones:** Remix Icon (todos suportam dark mode via classes)

### 13.6 Acessibilidade
- **Ícones:** Todos com `aria-label` ou `title`
- **Cores:** Contraste mínimo WCAG AA garantido
- **Focus:** `focus:ring-2 focus:ring-teal-500` em todos os inputs
- **Botões:** `whitespace-nowrap` para evitar quebra de texto

---

## 14. Roadmap / Fases de Desenvolvimento

### Fase 1 — Fundação (Concluído)
- Setup do projeto (React + Vite + Tailwind + TypeScript)
- Configuração Supabase (Auth, DB, RLS)
- Sistema de autenticação (login, cadastro, recuperação)
- Landing page (Home)
- Layout base com Sidebar e Header

### Fase 2 — Core (Concluído)
- CRUD de Projetos (com relacionamentos)
- CRUD de Tarefas (com subtarefas e comentários)
- Kanban view (status pipeline)
- Dashboard/Painel com widgets
- Sistema de notificações básico

### Fase 3 — Colaboração (Concluído)
- Gerenciamento de Equipe (perfis, roles)
- Calendário (mês, semana, dia)
- Base de Conhecimento
- Notificações em tempo real (Realtime)
- Sistema de aprovação de usuários

### Fase 4 — Análise (Concluído)
- Relatórios e dashboards
- Gráficos de produtividade
- Burndown de sprint
- Ranking de equipe
- Filtros por período e projeto

### Fase 5 — Otimização (Concluído)
- Sistema de cache (IndexedDB + SWR)
- Lazy loading de todas as páginas
- Realtime sync para invalidação automática
- Edge Functions para emails e notificações
- Otimização de queries (JOINs, batch)

### Fase 6 — Polish (Concluído)
- Dark mode completo
- Responsividade mobile
- Drag & drop no calendário
- Gantt view
- Recorrência de eventos e tarefas
- Sistema de busca global
- Timezone-safe dates

### Fase 7 — Escalabilidade (Futuro)
- [ ] WebSocket para colaboração em tempo real (tarefas)
- [ ] Sistema de tags e categorias avançado
- [ ] Integração com GitHub/GitLab
- [ ] Integração com Slack
- [ ] Exportação de relatórios (PDF, Excel)
- [ ] API REST pública
- [ ] Mobile app (React Native)
- [ ] Sistema de assinaturas (Stripe)
- [ ] Multi-workspace (tenancy)
- [ ] Autenticação SSO (Google, Microsoft)

### Fase 8 — Enterprise (Futuro)
- [ ] SAML SSO
- [ ] Audit logs completo
- [ ] RBAC granular (permissões customizadas)
- [ ] SLA monitoring
- [ ] Backup automático
- [ ] On-premise deployment

---

## 15. Métricas de Sucesso (KPIs)

| KPI | Alvo | Métrica Atual |
|-----|------|---------------|
| Tempo de carregamento (cache) | < 2s | ~1.5s |
| Tempo de carregamento (primeiro) | < 3s | ~2.5s |
| Cache hit rate | > 80% | ~85% |
| Notificações entregues | > 95% | ~99% |
| Emails enviados | > 90% | ~95% |
| Uptime do sistema | > 99% | 99.9% |
| Tarefas criadas/mês | 100+ | Em crescimento |
| Projetos ativos | 20+ | Em crescimento |
| NPS (satisfação) | > 50 | Não medido |
| Churn de usuários | < 5%/mês | Não medido |

---

## 16. Anexos

### 16.1 Estados de Tarefa

| Status | Cor | Label |
|--------|-----|-------|
| `fazer` | Gray | Fazer |
| `fazendo` | Blue | Fazendo |
| `aguardando` | Yellow | Aguardando |
| `parado` | Orange | Parado |
| `feito` | Green | Feito |

### 16.2 Prioridades

| Prioridade | Cor | Label |
|------------|-----|-------|
| `baixa` | Green | Baixa |
| `media` | Amber | Média |
| `alta` | Red | Alta |

### 16.3 Etapas Kanban

| Etapa | Label | Cor |
|-------|-------|-----|
| `backlog` | Backlog | Gray |
| `desafio` | Desafio | Amber |
| `persona` | Persona | Indigo |
| `proposta-valor` | Proposta de Valor | Teal |
| `validacao` | Validação | Orange |
| `mvp` | MVP | Green |

### 16.4 Tipos de Evento

| Tipo | Cor | Label |
|------|-----|-------|
| `meeting` | Teal | Reunião |
| `presentation` | Amber | Apresentação |
| `review` | Emerald | Revisão |
| `workshop` | Orange | Workshop |
| `training` | Cyan | Treinamento |
| `brainstorm` | Rose | Brainstorm |
| `deadline` | Red | Deadline |

### 16.5 Tabela de Permissões

| Ação | Admin | Criador | Membro | Viewer |
|------|-------|---------|--------|--------|
| Criar projeto | Sim | Sim | Sim | Não |
| Editar projeto | Sim | Sim | Sim* | Não |
| Excluir projeto | Sim | Sim | Não | Não |
| Criar tarefa | Sim | Sim | Sim | Não |
| Editar tarefa | Sim | Sim | Sim* | Não |
| Excluir tarefa | Sim | Sim | Sim* | Não |
| Ver projeto | Sim | Sim | Sim | Sim |
| Ver tarefa | Sim | Sim | Sim | Sim |
| Gerenciar usuários | Sim | Não | Não | Não |
| Acessar admin | Sim | Não | Não | Não |

\* Se membro do projeto público

---

**Documento criado por:** Readdy AI Assistant  
**Baseado em:** Análise completa do código-fonte do projeto Frank  
**Data da análise:** 03 de junho de 2026