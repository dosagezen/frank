
import { useState } from 'react';

export default function TaskBoard() {
  const [activeView, setActiveView] = useState<'kanban' | 'list' | 'calendar'>('kanban');

  const tasks = {
    fazer: [
      { id: 1, title: 'Implementar autenticação de usuários', priority: 'high', assignee: 'Maria Silva', dueDate: '2025-02-15', tags: ['Backend', 'Segurança'] },
      { id: 2, title: 'Criar página de relatórios', priority: 'medium', assignee: 'João Santos', dueDate: '2025-02-18', tags: ['Frontend', 'UI'] },
      { id: 3, title: 'Otimizar queries do banco de dados', priority: 'low', assignee: 'Pedro Costa', dueDate: '2025-02-20', tags: ['Backend', 'Performance'] }
    ],
    fazendo: [
      { id: 4, title: 'Desenvolver API de notificações', priority: 'high', assignee: 'Ana Oliveira', dueDate: '2025-02-12', tags: ['Backend', 'API'] },
      { id: 5, title: 'Design do dashboard principal', priority: 'medium', assignee: 'Carlos Mendes', dueDate: '2025-02-14', tags: ['Design', 'UI/UX'] }
    ],
    aguardando: [
      { id: 6, title: 'Testes de integração do módulo de tarefas', priority: 'high', assignee: 'Lucia Ferreira', dueDate: '2025-02-10', tags: ['QA', 'Testes'] }
    ],
    parado: [
      { id: 9, title: 'Migração de dados legados', priority: 'medium', assignee: 'Paulo Souza', dueDate: '2025-02-22', tags: ['Backend', 'Dados'] }
    ],
    feito: [
      { id: 7, title: 'Configurar ambiente de desenvolvimento', priority: 'high', assignee: 'Roberto Lima', dueDate: '2025-02-05', tags: ['DevOps', 'Setup'] },
      { id: 8, title: 'Documentação da API', priority: 'medium', assignee: 'Fernanda Rocha', dueDate: '2025-02-08', tags: ['Documentação'] }
    ]
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  return (
    <section id="taskboard" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Quadro de Tarefas Interativo
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
            Visualize e gerencie todas as tarefas da sua equipe em um único lugar. Arraste, solte e organize com facilidade usando nosso quadro Kanban intuitivo.
          </p>

          <div className="inline-flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView('kanban')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeView === 'kanban' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-layout-grid-line mr-2"></i>Kanban
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeView === 'list' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-list-check mr-2"></i>Lista
            </button>
            <button
              onClick={() => setActiveView('calendar')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeView === 'calendar' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-calendar-line mr-2"></i>Calendário
            </button>
          </div>
        </div>

        {activeView === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { key: 'fazer', title: 'Fazer', color: 'bg-gray-100', count: tasks.fazer.length },
              { key: 'fazendo', title: 'Fazendo', color: 'bg-blue-100', count: tasks.fazendo.length },
              { key: 'aguardando', title: 'Aguardando', color: 'bg-yellow-100', count: tasks.aguardando.length },
              { key: 'parado', title: 'Parado', color: 'bg-orange-100', count: tasks.parado.length },
              { key: 'feito', title: 'Feito', color: 'bg-green-100', count: tasks.feito.length }
            ].map((column) => (
              <div key={column.key} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {column.title}
                  </h3>
                  <span className={`${column.color} px-3 py-1 rounded-full text-sm font-semibold`}>
                    {column.count}
                  </span>
                </div>

                <div className="space-y-3">
                  {tasks[column.key as keyof typeof tasks].map((task) => (
                    <div 
                      key={task.id}
                      className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all cursor-move border border-gray-100"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-900 flex-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                          {task.title}
                        </h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ml-2 ${getPriorityColor(task.priority)}`}>
                          {getPriorityLabel(task.priority)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {task.tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <i className="ri-user-line"></i>
                          <span>{task.assignee}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <i className="ri-calendar-line"></i>
                          <span>{new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="w-full mt-3 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors whitespace-nowrap cursor-pointer">
                  <i className="ri-add-line mr-1"></i>Adicionar Tarefa
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
