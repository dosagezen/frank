import { useNavigate } from 'react-router-dom';

export default function Hero() {
  const navigate = useNavigate();

  return (
    <section id="hero" className="relative h-screen flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://static.readdy.ai/image/a38a5c3741c640eadeac44aae6e6e520/7188db111bf5b08212e607a1578e5b78.png')`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/50"></div>
      </div>

      <div className="relative z-10 w-full h-full flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 md:gap-5 lg:gap-6 max-w-5xl w-full text-center">
          <div className="bg-white/95 backdrop-blur-sm p-3 rounded-2xl shadow-2xl">
            <img
              src="https://static.readdy.ai/image/a38a5c3741c640eadeac44aae6e6e520/1fe965cd45beaa7952fde5325686f609.png" 
              alt="Logo"
              loading="lazy"
              className="h-12 mb-8"
            />
          </div>
          
          <div className="flex flex-col items-center gap-2 sm:gap-3 px-4 max-w-full flex-shrink-0">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-semibold text-white leading-tight" style={{ fontFamily: 'Inter, sans-serif', textShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
              Gerencie tarefas
            </h1>
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-normal text-white/90 leading-tight" style={{ fontFamily: 'Inter, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              de forma ágil e colaborativa
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 max-w-full px-4 flex-shrink-0">
            <button 
              onClick={() => navigate('/login')}
              className="px-6 sm:px-8 py-2.5 sm:py-3 md:py-3.5 bg-teal-600 text-white text-sm sm:text-base md:text-lg font-semibold rounded-lg hover:bg-teal-700 transition-all transform hover:scale-105 shadow-lg whitespace-nowrap cursor-pointer"
            >
              Começar Agora
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 md:gap-4 lg:gap-6 text-white w-full max-w-full px-4 flex-shrink-0 mt-4 sm:mt-6 md:mt-8 lg:mt-12">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-black/50 backdrop-blur-md px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-full w-full sm:w-auto justify-center shadow-lg">
              <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 flex items-center justify-center flex-shrink-0">
                <i className="ri-check-line text-base sm:text-lg md:text-xl text-teal-300" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}></i>
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Tarefas em dia</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 bg-black/50 backdrop-blur-md px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-full w-full sm:w-auto justify-center shadow-lg">
              <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 flex items-center justify-center flex-shrink-0">
                <i className="ri-team-line text-base sm:text-lg md:text-xl text-teal-300" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}></i>
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Colaboração em tempo real</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 bg-black/50 backdrop-blur-md px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-full w-full sm:w-auto justify-center shadow-lg">
              <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 flex items-center justify-center flex-shrink-0">
                <i className="ri-shield-check-line text-base sm:text-lg md:text-xl text-teal-300" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}></i>
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>100% Seguro</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
