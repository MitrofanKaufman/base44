import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function UserNotRegisteredError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full space-y-6">
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800">Пользователь не зарегистрирован</AlertTitle>
          <AlertDescription className="text-orange-700">
            Ваш аккаунт не найден в системе. Пожалуйста, свяжитесь с администратором для регистрации.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-3">
          <Button className="w-full">
            Связаться с поддержкой
          </Button>
          <Button variant="outline" className="w-full">
            Выйти
          </Button>
        </div>
      </div>
    </div>
  );
}