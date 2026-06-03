import type { RouteObject } from "react-router-dom";
import { lazy, Suspense } from "react";
import PageLoading from "../components/PageLoading";
import ProtectedRoute from "../components/ProtectedRoute";
import AppLayout from "../components/AppLayout";

// Função para retry automático quando chunks dinâmicos falham (após deploy)
function lazyWithRetry(importFn: () => Promise<any>) {
  return lazy(() =>
    importFn().catch((error) => {
      // Verificar se já tentou reload para evitar loop infinito
      const hasReloaded = sessionStorage.getItem('chunk-reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk-reload', 'true');
        window.location.reload();
        return { default: () => null }; // nunca renderiza, o reload acontece antes
      }
      sessionStorage.removeItem('chunk-reload');
      throw error; // se já recarregou e ainda falha, mostra o erro
    })
  );
}

// Lazy loading de todas as páginas com retry automático
const Home = lazyWithRetry(() => import("../pages/home/page"));
const Login = lazyWithRetry(() => import("../pages/login/page"));
const Painel = lazyWithRetry(() => import("../pages/painel/page"));
const Projetos = lazyWithRetry(() => import("../pages/projetos/page"));
const Tarefas = lazyWithRetry(() => import("../pages/tarefas/page"));
const Equipe = lazyWithRetry(() => import("../pages/equipe/page"));
const Calendario = lazyWithRetry(() => import("../pages/calendario/page"));
const Relatorios = lazyWithRetry(() => import("../pages/relatorios/page"));
const Conhecimento = lazyWithRetry(() => import("../pages/conhecimento/page"));
const Arquivos = lazyWithRetry(() => import("../pages/arquivos/page"));
const ConfirmarEmail = lazyWithRetry(() => import("../pages/confirmar-email/page"));
const Admin = lazyWithRetry(() => import("../pages/admin/page"));
const ResetPassword = lazyWithRetry(() => import("../pages/reset-password/page"));
const Notificacoes = lazyWithRetry(() => import("../pages/notificacoes/page"));
const NotFound = lazyWithRetry(() => import("../pages/NotFound"));

// -----------------------------------------------------------------------------
// Rotas públicas
// -----------------------------------------------------------------------------
const routes: RouteObject[] = [
  {
    path: "/",
    element: (
      <Suspense fallback={<PageLoading />}>
        <Home />
      </Suspense>
    ),
  },
  {
    path: "/login",
    element: (
      <Suspense fallback={<PageLoading />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: "/confirmar-email",
    element: (
      <Suspense fallback={<PageLoading />}>
        <ConfirmarEmail />
      </Suspense>
    ),
  },
  {
    path: "/reset-password",
    element: (
      <Suspense fallback={<PageLoading />}>
        <ResetPassword />
      </Suspense>
    ),
  },

  // -------------------------------------------------------------------------
  // Rotas protegidas — compartilham Sidebar + Header via AppLayout
  // -------------------------------------------------------------------------
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "painel",
        element: (
          <Suspense fallback={<PageLoading />}>
            <Painel />
          </Suspense>
        ),
      },
      {
        path: "projetos",
        element: (
          <Suspense fallback={<PageLoading />}>
            <Projetos />
          </Suspense>
        ),
      },
      {
        path: "tarefas",
        element: (
          <Suspense fallback={<PageLoading />}>
            <Tarefas />
          </Suspense>
        ),
      },
      {
        path: "equipe",
        element: (
          <Suspense fallback={<PageLoading />}>
            <Equipe />
          </Suspense>
        ),
      },
      {
        path: "calendario",
        element: (
          <Suspense fallback={<PageLoading />}>
            <Calendario />
          </Suspense>
        ),
      },
      {
        path: "conhecimento",
        element: (
          <Suspense fallback={<PageLoading />}>
            <Conhecimento />
          </Suspense>
        ),
      },
      {
        path: "arquivos",
        element: (
          <Suspense fallback={<PageLoading />}>
            <Arquivos />
          </Suspense>
        ),
      },
      {
        path: "relatorios",
        element: (
          <Suspense fallback={<PageLoading />}>
            <Relatorios />
          </Suspense>
        ),
      },
      {
        path: "notificacoes",
        element: (
          <Suspense fallback={<PageLoading />}>
            <Notificacoes />
          </Suspense>
        ),
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Rota admin (adminOnly)
  // -------------------------------------------------------------------------
  {
    element: (
      <ProtectedRoute adminOnly>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "admin",
        element: (
          <Suspense fallback={<PageLoading />}>
            <Admin />
          </Suspense>
        ),
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 404
  // -------------------------------------------------------------------------
  {
    path: "*",
    element: (
      <Suspense fallback={<PageLoading />}>
        <NotFound />
      </Suspense>
    ),
  },
];

export default routes;
