import { useAuth } from '@/lib/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm text-muted-foreground">Загрузка...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // AuthContext обработает перенаправление
  }

  return children;
}