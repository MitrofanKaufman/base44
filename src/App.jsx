import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AuthPage from '@/components/AuthPage';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard.jsx';
import Clients from '@/pages/Clients.jsx';
import Projects from '@/pages/Projects.jsx';
import Products from '@/pages/Products.jsx';
import Calculations from '@/pages/Calculations.jsx';
import Calculator from '@/pages/Calculator.jsx';
import Admin from '@/pages/Admin.jsx';
import Analytics from '@/pages/Analytics.jsx';
import Analysis from '@/pages/Analysis.jsx';
import Settings from '@/pages/Settings.jsx';

const AuthenticatedApp = () => {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <span className="text-sm text-muted-foreground">Загрузка...</span>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  if (location.pathname === '/login' || location.pathname === '/register') {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/products" element={<Products />} />
        <Route path="/calculations" element={<Calculations />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
