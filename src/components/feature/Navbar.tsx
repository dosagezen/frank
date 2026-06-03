import { useState, useEffect } from 'react';

interface NavbarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export default function Navbar({ activeSection, setActiveSection }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(sectionId);
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 overflow-hidden max-w-full ${
      isScrolled ? 'bg-white shadow-md' : 'bg-gray-900/20 backdrop-blur-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 overflow-hidden">
        <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer min-w-0 overflow-hidden" onClick={() => scrollToSection('hero')}>
            <img
              src="https://static.readdy.ai/image/a38a5c3741c640eadeac44aae6e6e520/1fe965cd45beaa7952fde5325686f609.png" 
              alt="Logo"
              loading="lazy"
              className="h-8"
            />
            <span className={`text-xl sm:text-2xl font-bold ${isScrolled ? 'text-gray-900' : 'text-white'} transition-colors truncate`} style={{ fontFamily: 'Poppins, sans-serif' }}>Frank</span>
          </div>

          <div className="hidden md:flex items-center gap-4 lg:gap-8 overflow-x-auto flex-shrink-0">
            <button 
              onClick={() => scrollToSection('features')}
              className={`text-sm font-medium ${isScrolled ? 'text-gray-700 hover:text-teal-600' : 'text-white hover:text-teal-300'} transition-colors whitespace-nowrap cursor-pointer`}
            >
              Recursos
            </button>
            <button 
              onClick={() => scrollToSection('taskboard')}
              className={`text-sm font-medium ${isScrolled ? 'text-gray-700 hover:text-teal-600' : 'text-white hover:text-teal-300'} transition-colors whitespace-nowrap cursor-pointer`}
            >
              Quadro de Tarefas
            </button>
            <button 
              onClick={() => scrollToSection('progress')}
              className={`text-sm font-medium ${isScrolled ? 'text-gray-700 hover:text-teal-600' : 'text-white hover:text-teal-300'} transition-colors whitespace-nowrap cursor-pointer`}
            >
              Progresso
            </button>
            <button 
              onClick={() => scrollToSection('dashboard')}
              className={`text-sm font-medium ${isScrolled ? 'text-gray-700 hover:text-teal-600' : 'text-white hover:text-teal-300'} transition-colors whitespace-nowrap cursor-pointer`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => scrollToSection('integrations')}
              className={`text-sm font-medium ${isScrolled ? 'text-gray-700 hover:text-teal-600' : 'text-white hover:text-teal-300'} transition-colors whitespace-nowrap cursor-pointer`}
            >
              Integrações
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <button className={`hidden md:block text-sm font-medium ${isScrolled ? 'text-gray-700 hover:text-teal-600' : 'text-white hover:text-teal-300'} transition-colors whitespace-nowrap cursor-pointer`}>
              Entrar
            </button>
            <button className="px-4 sm:px-6 py-2 sm:py-2.5 bg-teal-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer">
              Começar Grátis
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
