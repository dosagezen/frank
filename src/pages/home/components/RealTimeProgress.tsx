
import { useState, useEffect } from 'react';

export default function RealTimeProgress() {
  const [progress, setProgress] = useState({
    overall: 68,
    frontend: 75,
    backend: 62,
    design: 80,
    testing: 45
  });

  const [activeUsers, setActiveUsers] = useState([
    { name: 'Maria Silva', avatar: 'MS', status: 'online', task: 'Implementando autenticação' },
    { name: 'João Santos', avatar: 'JS', status: 'online', task: 'Criando página de relatórios' },
    { name: 'Ana Oliveira', avatar: 'AO', status: 'away', task: 'Desenvolvendo API' },
    { name: 'Carlos Mendes', avatar: 'CM', status: 'online', task: 'Design do dashboard' }
  ]);

  const [recentActivities, setRecentActivities] = useState([
    { user: 'Maria Silva', action: 'completou a tarefa', task: 'Configurar ambiente', time: '2 min atrás', icon: 'ri-check-line', color: 'text-green-600' },
    { user: 'João Santos', action: 'comentou em', task: 'Design do header', time: '5 min atrás', icon: 'ri-chat-3-line', color: 'text-blue-600' },
    { user: 'Ana Oliveira', action: 'moveu para Em Progresso', task: 'API de notificações', time: '8 min atrás', icon: 'ri-arrow-right-line', color: 'text-purple-600' },
    { user: 'Carlos Mendes', action: 'anexou arquivo em', task: 'Mockups finais', time: '12 min atrás', icon: 'ri-attachment-line', color: 'text-orange-600' },
    { user: 'Lucia Ferreira', action: 'criou nova tarefa', task: 'Testes de integração', time: '15 min atrás', icon: 'ri-add-circle-line', color: 'text-teal-600' }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => ({
        overall: Math.min(100, prev.overall + Math.random() * 2),
        frontend: Math.min(100, prev.frontend + Math.random() * 2),
        backend: Math.min(100, prev.backend + Math.random() * 2),
        design: Math.min(100, prev.design + Math.random() * 2),
        testing: Math.min(100, prev.testing + Math.random() * 2)
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const ProgressBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>{label}</span>
        <span className="text-sm font-bold text-gray-900">{Math.round(value)}%</span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-500 ease-out rounded-full`}
          style={{ width: `${value}%` }}
        ></div>
      </div>
    </div>
  );

  return (
    <section id="progress" className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Progresso em Tempo Real
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
            Acompanhe o andamento de todos os projetos e tarefas instantaneamente. Veja quem está trabalhando em quê e receba atualizações em tempo real sobre o progresso da equipe.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Progresso do Projeto
              </h3>
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Ao vivo</span>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold text-gray-900">Progresso Geral</span>
                <span className="text-3xl font-bold text-teal-600">{Math.round(progress.overall)}%</span>
              </div>
              <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-teal-500 to-teal-600 transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progress.overall}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-4">
              <ProgressBar label="Frontend Development" value={progress.frontend} color="bg-blue-500" />
              <ProgressBar label="Backend Development" value={progress.backend} color="bg-purple-500" />
              <ProgressBar label="Design & UI/UX" value={progress.design} color="bg-pink-500" />
              <ProgressBar label="Testing & QA" value={progress.testing} color="bg-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
            <h3 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Equipe Ativa
            </h3>

            <div className="space-y-4 mb-8">
              {activeUsers.map((user, index) => (
                <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                      {user.avatar}
                    </div>
                    <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      user.status === 'online' ? 'bg-green-500' : 'bg-yellow-500'
                    }`}></div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {user.name}
                    </h4>
                    <p className="text-xs text-gray-600">{user.task}</p>
                  </div>
                  <i className="ri-more-2-fill text-xl text-gray-400 cursor-pointer hover:text-gray-600"></i>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Total de membros ativos</span>
                <span className="text-2xl font-bold text-teal-600">{activeUsers.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Atividades Recentes
          </h3>

          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors">
                <div className={`w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 ${activity.color}`}>
                  <i className={`${activity.icon} text-xl`}></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <strong className="font-semibold">{activity.user}</strong> {activity.action}{' '}
                    <strong className="font-semibold text-teal-600">{activity.task}</strong>
                  </p>
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
