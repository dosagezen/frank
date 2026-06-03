
import { Outlet } from 'react-router-dom';
import Sidebar from '../pages/painel/components/Sidebar';
import Header from '../pages/painel/components/Header';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex max-w-[1280px] mx-auto px-4 xl:px-6">
        {/* Sidebar fixa */}
        <div className="sticky top-0 h-screen flex-shrink-0">
          <Sidebar />
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 flex flex-col min-w-0 ml-4 xl:ml-6">
          <div className="sticky top-0 z-30">
            <Header />
          </div>
          <main className="flex-1 py-6 max-w-full overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
