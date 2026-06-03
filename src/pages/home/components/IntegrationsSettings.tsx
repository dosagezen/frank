
import { useState } from 'react';

export default function IntegrationsSettings() {
  const [integrations, setIntegrations] = useState([
    { id: 1, name: 'Slack', description: 'Receba notificações e atualizações direto no Slack', icon: 'ri-slack-line', color: 'from-purple-500 to-purple-600', connected: true },
    { id: 2, name: 'Google Calendar', description: 'Sincronize prazos e eventos automaticamente', icon: 'ri-calendar-line', color: 'from-blue-500 to-blue-600', connected: true },
    { id: 3, name: 'GitHub', description: 'Conecte repositórios e acompanhe commits', icon: 'ri-github-line', color: 'from-gray-700 to-gray-800', connected: false },
    { id: 4, name: 'Trello', description: 'Importe quadros e sincronize tarefas', icon: 'ri-trello-line', color: 'from-blue-400 to-blue-500', connected: false },
    { id: 5, name: 'Jira', description: 'Integração completa com projetos Jira', icon: 'ri-bug-line', color: 'from-blue-600 to-blue-700', connected: false },
    { id: 6, name: 'Dropbox', description: 'Anexe e compartilhe arquivos facilmente', icon: 'ri-dropbox-line', color: 'from-blue-500 to-blue-600', connected: true }
  ]);

  const settings = [
    { id: 1, category: 'Notificações', icon: 'ri-notification-3-line', items: ['Email', 'Push', 'Desktop'] },
    { id: 2, category: 'Privacidade', icon: 'ri-shield-check-line', items: ['Visibilidade', 'Permissões', 'Compartilhamento'] },
    { id: 3, category: 'Equipe', icon: 'ri-team-line', items: ['Membros', 'Funções', 'Convites'] },
    { id: 4, category: 'Aparência', icon: 'ri-palette-line', items: ['Tema', 'Layout', 'Idioma'] }
  ];

  const toggleIntegration = (id: number) => {
    setIntegrations(integrations.map(i => 
      i.id === id ? { ...i, connected: !i.connected } : i
    ));
  };

  return (
    <section id="integrations" className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Integrações e Configurações
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
            Conecte Frank com suas ferramentas favoritas e personalize cada aspecto da plataforma. Integre-se perfeitamente ao seu fluxo de trabalho existente.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Integrações Disponíveis
                </h3>
                <button className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer">
                  <i className="ri-add-line mr-2"></i>Adicionar Nova
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrations.map((integration) => (
                  <div 
                    key={integration.id}
                    className="p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${integration.color} rounded-lg flex items-center justify-center`}>
                        <i className={`${integration.icon} text-2xl text-white`}></i>
                      </div>
                      <button
                        onClick={() => toggleIntegration(integration.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          integration.connected 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {integration.connected ? 'Conectado' : 'Conectar'}
                      </button>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {integration.name}
                    </h4>
                    <p className="text-sm text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {integration.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Configurações Rápidas
              </h3>
              <div className="space-y-4">
                {settings.map((setting) => (
                  <div 
                    key={setting.id}
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                        <i className={`${setting.icon} text-lg text-teal-600`}></i>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {setting.category}
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-11">
                      {setting.items.map((item, idx) => (
                        <span key={idx} className="px-2 py-1 bg-white text-xs font-medium text-gray-600 rounded border border-gray-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                API & Webhooks
              </h3>
              <p className="text-sm text-gray-600 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                Crie integrações personalizadas usando nossa API REST completa e webhooks em tempo real.
              </p>
              <button className="w-full px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap cursor-pointer">
                <i className="ri-code-line mr-2"></i>Ver Documentação
              </button>
            </div>

            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-lg p-6 text-white">
              <i className="ri-customer-service-2-line text-3xl mb-3"></i>
              <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Precisa de Ajuda?
              </h3>
              <p className="text-sm text-white/90 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                Nossa equipe está pronta para ajudar você a configurar integrações e otimizar seu fluxo de trabalho.
              </p>
              <button className="px-4 py-2 bg-white text-teal-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer">
                Falar com Suporte
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl shadow-2xl p-12 text-center text-white">
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Pronto para Transformar seu Gerenciamento de Tarefas?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
            Junte-se a milhares de equipes que já estão usando Frank para colaborar melhor e entregar projetos mais rápido.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="px-8 py-4 bg-white text-teal-600 text-lg font-semibold rounded-lg hover:bg-gray-50 transition-all transform hover:scale-105 shadow-lg whitespace-nowrap cursor-pointer">
              Começar Gratuitamente
            </button>
            <button className="px-8 py-4 bg-teal-800 text-white text-lg font-semibold rounded-lg hover:bg-teal-900 transition-all border-2 border-white/30 whitespace-nowrap cursor-pointer">
              Agendar Demo
            </button>
          </div>
          <p className="text-sm text-white/70 mt-6">Sem cartão de crédito • Configuração em 2 minutos • Cancele quando quiser</p>
        </div>
      </div>
    </section>
  );
}
