
export default function Features() {
  const features = [
    {
      icon: 'ri-task-line',
      title: 'Criação Rápida de Tarefas',
      description: 'Crie tarefas em segundos com templates personalizados, campos customizáveis e anexos. Organize por prioridade, categoria e deadline para máxima eficiência.'
    },
    {
      icon: 'ri-user-add-line',
      title: 'Atribuição Inteligente',
      description: 'Atribua tarefas automaticamente baseado em disponibilidade, habilidades e carga de trabalho. Sistema inteligente sugere os melhores membros para cada tarefa.'
    },
    {
      icon: 'ri-eye-line',
      title: 'Acompanhamento Visual',
      description: 'Visualize o status de todas as tarefas em tempo real com quadros Kanban, listas e calendários. Filtros avançados para encontrar qualquer informação rapidamente.'
    },
    {
      icon: 'ri-notification-3-line',
      title: 'Notificações Inteligentes',
      description: 'Receba alertas personalizados sobre atualizações importantes, prazos próximos e menções. Configure notificações por email, push ou dentro da plataforma.'
    },
    {
      icon: 'ri-bar-chart-box-line',
      title: 'Relatórios Detalhados',
      description: 'Gere relatórios completos sobre produtividade, tempo gasto e performance da equipe. Exporte dados em múltiplos formatos para análise externa.'
    },
    {
      icon: 'ri-team-line',
      title: 'Colaboração em Tempo Real',
      description: 'Trabalhe simultaneamente com sua equipe, veja atualizações instantâneas e comunique-se através de comentários e menções diretas nas tarefas.'
    }
  ];

  return (
    <section id="features" className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Recursos Poderosos
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
            Tudo que você precisa para gerenciar tarefas de forma eficiente e colaborativa. Frank oferece ferramentas completas para equipes de todos os tamanhos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="bg-white p-8 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-teal-200 group cursor-pointer"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <i className={`${feature.icon} text-3xl text-white`}></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
