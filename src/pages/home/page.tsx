import { useEffect } from 'react';
import Hero from './components/Hero';
import Features from './components/Features';
import TaskBoard from './components/TaskBoard';
import RealTimeProgress from './components/RealTimeProgress';
import CustomizableDashboard from './components/CustomizableDashboard';
import IntegrationsSettings from './components/IntegrationsSettings';
import Footer from '../../components/feature/Footer';

export default function Home() {
  useEffect(() => {
    console.log('🏠 [HOME] Página Home montada com sucesso!');
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Hero />
      <Features />
      <TaskBoard />
      <RealTimeProgress />
      <CustomizableDashboard />
      <IntegrationsSettings />
      <Footer />
    </div>
  );
}
