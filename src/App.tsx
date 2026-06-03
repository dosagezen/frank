import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { UserProfileProvider } from './contexts/UserProfileContext';
import { ToastProvider } from './contexts/ToastContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { AppRoutes } from './router';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/base/ToastContainer';
import { startRealtimeSync, stopRealtimeSync } from './services/realtimeSyncService';

function RealtimeSyncInit() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    startRealtimeSync();
    return () => {
      stopRealtimeSync();
    };
  }, [user]);
  
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={__BASE_PATH__}>
        <AuthProvider>
          <ThemeProvider>
            <UserProfileProvider>
              <ToastProvider>
                <SidebarProvider>
                  <RealtimeSyncInit />
                  <AppRoutes />
                  <ToastContainer />
                </SidebarProvider>
              </ToastProvider>
            </UserProfileProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
