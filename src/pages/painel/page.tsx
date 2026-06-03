
import { useState, useEffect, lazy, Suspense } from 'react';
import StatsOverview from './components/StatsOverview';
import QuickActions from './components/QuickActions';
import TasksWidget from './components/TasksWidget';
import ProjectsWidget from './components/ProjectsWidget';
import DeadlinesWidget from './components/DeadlinesWidget';
import ActivityFeed from './components/ActivityFeed';
import TeamWidget from './components/TeamWidget';
import { useAuth } from '../../contexts/AuthContext';
import { checkUpcomingDeadlineNotifications } from '../../services/notificationsService';

// Lazy loading dos modais
const NewTaskModal = lazy(() => import('../tarefas/components/NewTaskModal'));
const NewProjectModal = lazy(() => import('../projetos/components/NewProjectModal'));
const NewMemberModal = lazy(() => import('../equipe/components/NewMemberModal'));
const NewMeetingModal = lazy(() => import('../calendario/components/NewMeetingModal'));

export default function Painel() {
  const { user } = useAuth();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      checkUpcomingDeadlineNotifications(user.id);
    }
  }, [user?.id]);

  return (
    <>
      {/* Page Header */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Painel de Controle
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 break-words" style={{ fontFamily: 'Inter, sans-serif' }}>
          Visão geral do seu workspace
        </p>
      </div>

      <StatsOverview />

      <div className="mb-6 max-w-full">
        <QuickActions
          onNewTask={() => setIsTaskModalOpen(true)}
          onNewProject={() => setIsProjectModalOpen(true)}
          onInviteMember={() => setIsMemberModalOpen(true)}
          onScheduleMeeting={() => setIsMeetingModalOpen(true)}
        />
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[63%_37%] gap-6 mb-6 max-w-full">
        <div className="min-w-0">
          <TasksWidget />
        </div>
        <div className="min-w-0">
          <DeadlinesWidget />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 max-w-full">
        <div className="min-w-0"><ProjectsWidget /></div>
        <div className="min-w-0"><TeamWidget /></div>
      </div>

      <div className="max-w-full">
        <ActivityFeed />
      </div>

      {/* Modais com lazy loading */}
      {isTaskModalOpen && (
        <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">Carregando...</div>}>
          <NewTaskModal
            isOpen={isTaskModalOpen}
            onClose={() => setIsTaskModalOpen(false)}
            onSubmit={() => setIsTaskModalOpen(false)}
          />
        </Suspense>
      )}

      {isProjectModalOpen && (
        <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">Carregando...</div>}>
          <NewProjectModal
            isOpen={isProjectModalOpen}
            onClose={() => setIsProjectModalOpen(false)}
            onSubmit={() => setIsProjectModalOpen(false)}
          />
        </Suspense>
      )}

      {isMemberModalOpen && (
        <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">Carregando...</div>}>
          <NewMemberModal
            isOpen={isMemberModalOpen}
            onClose={() => setIsMemberModalOpen(false)}
            onSubmit={() => setIsMemberModalOpen(false)}
          />
        </Suspense>
      )}

      {isMeetingModalOpen && (
        <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">Carregando...</div>}>
          <NewMeetingModal
            isOpen={isMeetingModalOpen}
            onClose={() => setIsMeetingModalOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}
