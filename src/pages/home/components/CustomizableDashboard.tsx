
import { useState } from 'react';

export default function CustomizableDashboard() {
  const [widgets, setWidgets] = useState([
    { id: 1, title: 'Tarefas Pendentes', value: '24', icon: 'ri-task-line', color: 'from-blue-500 to-blue-600', active: true },
    { id: 2, title: 'Em Progresso', value: '12', icon: 'ri-loader-line', color: 'from-purple-500 to-purple-600', active: true },
    { id: 3, title: 'Concluídas Hoje', value: '8', icon: 'ri-check-double-line', color: 'from-green-500 to-green-600', active: true },
    { id: 4, title: 'Membros Ativos', value: '15', icon: 'ri-team-line', color: 'from-orange-500 to-orange-600', active: true },
    { id: 5, title: 'Prazos Próximos', value: '5', icon: 'ri-alarm-warning-line', color: 'from-red-500 to-red-600', active: false },
    { id: 6, title: 'Comentários', value: '32', icon: 'ri-chat-3-line', color: 'from-teal-500 to-teal-600', active: false }
  ]);

  const [selectedTheme, setSelectedTheme] = useState('light');

  const themes = [
    { id: 'light', name: 'Claro', bg: 'bg-white', preview: 'bg-gradient-to-br from-gray-50 to-gray-100' },
    { id: 'dark', name: 'Escuro', bg: 'bg-gray-900', preview: 'bg-gradient-to-br from-gray-800 to-gray-900' },
    { id: 'teal', name: 'Teal', bg: 'bg-teal-50', preview: 'bg-gradient-to-br from-teal-50 to-teal-100' },
    { id: 'purple', name: 'Roxo', bg: 'bg-purple-50', preview: 'bg-gradient-to-br from-purple-50 to-purple-100' }
  ];

  const toggleWidget = (id: number) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, active: !w.active } : w));
  };

  return (
    <section id="dashboard" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Dashboard Personalizável
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
            Crie seu espaço de trabalho ideal. Personalize widgets, escolha temas e organize informações da forma que funciona melhor para você e sua equipe.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Seu Dashboard
                </h3>
                <button className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors border border-gray-300 whitespace-nowrap cursor-pointer">
                  <i className="ri-settings-3-line mr-2"></i>Configurar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {widgets.filter(w => w.active).map((widget) => (
                  <div 
                    key={widget.id}
                    className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${widget.color} rounded-lg flex items-center justify-center`}>
                        <i className={`${widget.icon} text-2xl text-white`}></i>
                      </div>
                      <button 
                        onClick={() => toggleWidget(widget.id)}
                        className="text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <i className="ri-more-2-fill text-xl"></i>
                      </button>
                    </div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {widget.title}
                    </h4>
                    <p className="text-3xl font-bold text-gray-900">{widget.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-6 bg-white rounded-xl border-2 border-dashed border-gray-300 hover:border-teal-400 transition-colors cursor-pointer">
                <div className="text-center">
                  <i className="ri-add-circle-line text-4xl text-gray-400 mb-2"></i>
                  <p className="text-sm font-medium text-gray-600">Adicionar Widget</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Widgets Disponíveis
              </h3>
              <div className="space-y-3">
                {widgets.map((widget) => (
                  <div 
                    key={widget.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 bg-gradient-to-br ${widget.color} rounded-lg flex items-center justify-center`}>
                        <i className={`${widget.icon} text-sm text-white`}></i>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{widget.title}</span>
                    </div>
                    <button
                      onClick={() => toggleWidget(widget.id)}
                      className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${
                        widget.active ? 'bg-teal-600' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                        widget.active ? 'translate-x-5' : 'translate-x-1'
                      }`}></div>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Temas
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedTheme === theme.id 
                        ? 'border-teal-600 bg-teal-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-full h-16 ${theme.preview} rounded-lg mb-2`}></div>
                    <p className="text-sm font-medium text-gray-700">{theme.name}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-lg p-6 text-white">
              <i className="ri-lightbulb-line text-3xl mb-3"></i>
              <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Dica Pro
              </h3>
              <p className="text-sm text-white/90" style={{ fontFamily: 'Inter, sans-serif' }}>
                Arraste e solte widgets para reorganizar seu dashboard. Crie visualizações personalizadas para diferentes projetos!
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
