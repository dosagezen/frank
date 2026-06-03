interface QuickActionsProps {
  onNewTask: () => void;
  onNewProject: () => void;
  onInviteMember: () => void;
  onScheduleMeeting: () => void;
}

export default function QuickActions({ onNewTask, onNewProject, onInviteMember, onScheduleMeeting }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-full">
      <button 
        onClick={onNewTask}
        className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 shadow-sm dark:shadow-teal-500/20 whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 text-center min-w-0 h-11"
      >
        <i className="ri-add-circle-line text-lg"></i>
        <span className="text-sm">Nova Tarefa</span>
      </button>
      
      <button 
        onClick={onNewProject}
        className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 shadow-sm dark:shadow-orange-500/20 whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 text-center min-w-0 h-11"
      >
        <i className="ri-folder-add-line text-lg"></i>
        <span className="text-sm">Novo Projeto</span>
      </button>
      
      <button 
        onClick={onScheduleMeeting}
        className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 shadow-sm dark:shadow-purple-500/20 whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 text-center min-w-0 h-11"
      >
        <i className="ri-calendar-event-line text-lg"></i>
        <span className="text-sm">Novo Evento</span>
      </button>
      
      <button 
        onClick={onInviteMember}
        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 shadow-sm dark:shadow-indigo-500/20 whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 text-center min-w-0 h-11"
      >
        <i className="ri-team-line text-lg"></i>
        <span className="text-sm">Convidar</span>
      </button>
    </div>
  );
}
