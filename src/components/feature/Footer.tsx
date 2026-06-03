export default function Footer() {
  const footerLinks = {
    produto: ['Recursos', 'Integrações', 'Preços', 'Atualizações', 'Roadmap'],
    empresa: ['Sobre Nós', 'Blog', 'Carreiras', 'Imprensa', 'Parceiros'],
    recursos: ['Documentação', 'API', 'Tutoriais', 'Webinars', 'Comunidade'],
    suporte: ['Central de Ajuda', 'Contato', 'Status', 'Segurança', 'Privacidade']
  };

  return (
    <footer className="bg-gradient-to-br from-teal-600 to-teal-700 text-white overflow-hidden max-w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 sm:gap-12 mb-8 sm:mb-12">
          <div className="lg:col-span-2 min-w-0 overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="https://static.readdy.ai/image/a38a5c3741c640eadeac44aae6e6e520/1fe965cd45beaa7952fde5325686f609.png" 
                alt="Logo"
                loading="lazy"
                className="h-8"
              />
              <span className="text-xl sm:text-2xl font-bold truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>Frank</span>
            </div>
            <p className="text-white/80 mb-4 sm:mb-6 text-sm leading-relaxed break-words" style={{ fontFamily: 'Inter, sans-serif' }}>
              A solução completa para gerenciamento de tarefas colaborativas. Organize, colabore e entregue projetos com eficiência.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors cursor-pointer flex-shrink-0">
                <i className="ri-twitter-x-line text-xl"></i>
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors cursor-pointer flex-shrink-0">
                <i className="ri-linkedin-line text-xl"></i>
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors cursor-pointer flex-shrink-0">
                <i className="ri-github-line text-xl"></i>
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors cursor-pointer flex-shrink-0">
                <i className="ri-youtube-line text-xl"></i>
              </a>
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category} className="min-w-0 overflow-hidden">
              <h4 className="text-sm font-bold uppercase mb-4 tracking-wider break-words" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link, index) => (
                  <li key={index}>
                    <a href="#" className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer break-words" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 sm:pt-8 border-t border-white/20 overflow-hidden">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 min-w-0">
            <p className="text-sm text-white/70 text-center md:text-left break-words" style={{ fontFamily: 'Inter, sans-serif' }}>
              © 2025 Frank. Todos os direitos reservados.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              <a href="#" className="text-sm text-white/70 hover:text-white transition-colors cursor-pointer whitespace-nowrap">
                Termos de Uso
              </a>
              <a href="#" className="text-sm text-white/70 hover:text-white transition-colors cursor-pointer whitespace-nowrap">
                Política de Privacidade
              </a>
              <a href="https://readdy.ai/?origin=logo" target="_blank" rel="noopener noreferrer" className="text-sm text-white/70 hover:text-white transition-colors cursor-pointer whitespace-nowrap">
                Powered by Readdy
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
