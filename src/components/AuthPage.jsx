import { useState } from 'react';
import { BarChart3, Loader2, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const initialForm = {
  email: '',
  fullName: '',
  password: '',
  confirmPassword: '',
};

function getErrorMessage(error) {
  if (error?.status === 401) return 'Неверный email или пароль.';
  if (error?.status === 409) return 'Пользователь с таким email уже существует.';
  if (error?.status === 400) return error.message || 'Проверьте заполнение формы.';
  return error?.message || 'Не удалось выполнить запрос авторизации.';
}

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegisterMode = mode === 'register';

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const email = form.email.trim();
    const fullName = form.fullName.trim();
    const password = form.password;

    if (!email || !password || (isRegisterMode && !fullName)) {
      setError('Заполните обязательные поля.');
      return;
    }

    if (isRegisterMode && password.length < 8) {
      setError('Пароль должен быть не короче 8 символов.');
      return;
    }

    if (isRegisterMode && password !== form.confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (isRegisterMode) {
        await register({ email, fullName, password });
      } else {
        await login({ email, password });
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f2eb] px-4 py-8 text-[#201a15] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[1fr_420px]">
          <section className="hidden lg:block">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-lg bg-[#9a3412] text-white">
                <BarChart3 className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#9a3412]">unit.marketing</p>
                <h1 className="mt-2 max-w-2xl text-4xl font-semibold leading-tight">
                  Рабочее пространство аналитики маркетплейсов
                </h1>
              </div>
            </div>
            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
              {['JWT-сессия', 'Роли пользователей', 'Защищенный API'].map((item) => (
                <div key={item} className="rounded-lg border border-[#e4d7c9] bg-[#fffdf9] p-4 shadow-sm">
                  <ShieldCheck className="mb-3 size-5 text-[#9a3412]" />
                  <p className="text-sm font-semibold">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <Card className="rounded-lg border-[#e4d7c9] bg-[#fffdf9] shadow-lg">
            <CardHeader className="space-y-4">
              <div className="flex items-center gap-3 lg:hidden">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[#9a3412] text-white">
                  <BarChart3 className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#201a15]">unit.marketing</p>
                  <p className="text-xs text-[#8a7060]">Analytics Platform</p>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {isRegisterMode ? 'Создать аккаунт' : 'Войти в аккаунт'}
                </h2>
                <p className="mt-2 text-sm text-[#8a7060]">
                  {isRegisterMode
                    ? 'Первый зарегистрированный пользователь станет администратором.'
                    : 'Введите данные пользователя для доступа к приложению.'}
                </p>
              </div>

              <div className="grid grid-cols-2 rounded-md border border-[#e4d7c9] bg-[#f7f2eb] p-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={cn(
                    'rounded px-3 py-2 text-sm font-medium transition-colors',
                    !isRegisterMode ? 'bg-[#201a15] text-white shadow-sm' : 'text-[#6f6257] hover:text-[#201a15]'
                  )}
                >
                  Вход
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={cn(
                    'rounded px-3 py-2 text-sm font-medium transition-colors',
                    isRegisterMode ? 'bg-[#201a15] text-white shadow-sm' : 'text-[#6f6257] hover:text-[#201a15]'
                  )}
                >
                  Регистрация
                </button>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegisterMode && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Имя</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a7060]" />
                      <Input
                        id="fullName"
                        value={form.fullName}
                        onChange={(event) => updateField('fullName', event.target.value)}
                        className="h-11 bg-white pl-10"
                        autoComplete="name"
                        placeholder="Иван Иванов"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a7060]" />
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => updateField('email', event.target.value)}
                      className="h-11 bg-white pl-10"
                      autoComplete="email"
                      placeholder="user@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a7060]" />
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(event) => updateField('password', event.target.value)}
                      className="h-11 bg-white pl-10"
                      autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                      placeholder="********"
                    />
                  </div>
                </div>

                {isRegisterMode && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Повторите пароль</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a7060]" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={form.confirmPassword}
                        onChange={(event) => updateField('confirmPassword', event.target.value)}
                        className="h-11 bg-white pl-10"
                        autoComplete="new-password"
                        placeholder="********"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={isSubmitting} className="h-11 w-full rounded-md bg-[#9a3412] hover:bg-[#7c2d12]">
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {isRegisterMode ? 'Зарегистрироваться' : 'Войти'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
