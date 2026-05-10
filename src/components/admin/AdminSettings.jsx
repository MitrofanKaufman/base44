import { CheckCircle, Shield } from 'lucide-react';

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Безопасность</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
              <CheckCircle className="w-4 h-4" />
              HMAC-SHA256
            </div>
            <p className="text-xs text-green-600 mt-1">Верификация включена</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
              <CheckCircle className="w-4 h-4" />
              Role-Based Access
            </div>
            <p className="text-xs text-blue-600 mt-1">Только администраторы</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        ℹ️ HMAC секрет хранится в переменных окружения. Полная документация в MARKETPLACE_CORE_README.md
      </div>
    </div>
  );
}