import { Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function AdminCollectionRunnerDocs() {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-base mb-2">Что такое Прогон сбора?</h3>
            <p className="text-sm text-muted-foreground">
              Управляемый pipeline для полного цикла сбора, нормализации и обработки данных маркетплейса. 
              Включает валидацию, сбор с маркетплейса, нормализацию, сохранение, расчет unit economics и отчеты об ошибках.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-base mb-3">Режимы сбора</h3>
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="font-mono bg-secondary/50 px-2 py-1 rounded min-w-20">product</span>
            <span className="text-muted-foreground">Сбор данных по отдельным товарам (Article/nmId)</span>
          </div>
          <div className="flex gap-2">
            <span className="font-mono bg-secondary/50 px-2 py-1 rounded min-w-20">seller</span>
            <span className="text-muted-foreground">Сбор данных по продавцам (Seller ID)</span>
          </div>
          <div className="flex gap-2">
            <span className="font-mono bg-secondary/50 px-2 py-1 rounded min-w-20">full</span>
            <span className="text-muted-foreground">Полный сбор товаров и продавцов одновременно</span>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-base mb-3">Этапы Pipeline</h3>
        <div className="space-y-2 text-xs">
          {[
            { name: 'validate-input', desc: 'Валидация входных параметров' },
            { name: 'collect-marketplace-data', desc: 'Сбор данных с маркетплейса (real/mock)' },
            { name: 'normalize-events', desc: 'Нормализация в стандартный формат' },
            { name: 'save-raw-frames', desc: 'Сохранение RawMarketplaceFrame' },
            { name: 'save-events', desc: 'Сохранение MarketplaceEvent' },
            { name: 'update-snapshots', desc: 'Обновление ProductSnapshot/SellerSnapshot' },
            { name: 'calculate-unit-economics', desc: 'Расчет маржинальности и прибыльности' },
            { name: 'verify-results', desc: 'Проверка целостности данных' },
            { name: 'build-report', desc: 'Построение финального отчета' }
          ].map((stage, i) => (
            <div key={stage.name} className="flex gap-2 pb-2 border-b border-border/50 last:border-0">
              <span className="text-muted-foreground min-w-6">{i + 1}.</span>
              <div>
                <div className="font-mono font-bold text-foreground">{stage.name}</div>
                <div className="text-muted-foreground">{stage.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-base mb-3">Real vs Mock vs Fallback</h3>
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="font-bold text-blue-900 mb-1">Real (реальный сбор)</div>
            <div className="text-blue-800">Живое подключение к API маркетплейса. Требует валидный ключ доступа. Используется при <code className="bg-white px-1 rounded">dryRun=false</code>.</div>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded">
            <div className="font-bold text-amber-900 mb-1">Mock (тестовые данные)</div>
            <div className="text-amber-800">Генерируются тестовые данные. Быстро работает без подключения к маркетплейсу. <strong>В отчете явно указывается "mock"</strong>. Используется при <code className="bg-white px-1 rounded">dryRun=true</code>.</div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="font-bold text-slate-900 mb-1">Fallback (кеш)</div>
            <div className="text-slate-800">Используется при отсутствии подключения Real. Данные могут быть устаревшими. <strong>Отмечается в отчете</strong>.</div>
          </div>
        </div>
        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
          <strong>⚠ Важно:</strong> Всегда проверяйте <code className="bg-white px-1 rounded">sourceMode</code> в отчете перед использованием данных в production!
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-base mb-3">Рекомендуемый workflow</h3>
        <div className="space-y-2 text-sm">
          <div className="flex gap-3">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold text-xs">1</span>
            <div>
              <div className="font-bold">Включите Dry Run</div>
              <div className="text-muted-foreground">Используйте mock данные для тестирования конфигурации</div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold text-xs">2</span>
            <div>
              <div className="font-bold">Запустите с малым набором</div>
              <div className="text-muted-foreground">Начните с 1-5 товаров, проверьте результаты</div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold text-xs">3</span>
            <div>
              <div className="font-bold">Проверьте отчет</div>
              <div className="text-muted-foreground">Убедитесь в корректности счетчиков и отсутствии ошибок</div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold text-xs">4</span>
            <div>
              <div className="font-bold">Отключите Dry Run</div>
              <div className="text-muted-foreground">Запустите реальный сбор с полным набором товаров</div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold text-xs">5</span>
            <div>
              <div className="font-bold">Обработайте ошибки</div>
              <div className="text-muted-foreground">Нажимайте "Повторить ошибки" для retryable ошибок</div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-base mb-3">Создаваемые сущности</h3>
        <div className="space-y-2 text-sm">
          {[
            { entity: 'RawMarketplaceFrame', desc: 'Исходные данные с маркетплейса' },
            { entity: 'MarketplaceEvent', desc: 'Нормализованные события' },
            { entity: 'ProductSnapshot', desc: 'Снимки состояния товаров' },
            { entity: 'SellerSnapshot', desc: 'Снимки состояния продавцов' },
            { entity: 'UnitEconomicsSnapshot', desc: 'Метрики маржинальности (если includeUnitEconomics=true)' },
            { entity: 'DeadLetter', desc: 'Ошибки с подробной информацией' }
          ].map(item => (
            <div key={item.entity} className="flex gap-2 pb-2 border-b border-border/50 last:border-0">
              <span className="font-mono font-bold text-primary flex-shrink-0 min-w-40">{item.entity}</span>
              <span className="text-muted-foreground">{item.desc}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-base mb-3">Обработка ошибок</h3>
        <div className="space-y-2 text-sm">
          <div className="p-3 bg-secondary/50 rounded">
            <div className="font-bold mb-1">Просмотр ошибок</div>
            <div className="text-muted-foreground">Таблица "Ошибки" показывает все DeadLetter текущего прогона в реальном времени</div>
          </div>
          <div className="p-3 bg-secondary/50 rounded">
            <div className="font-bold mb-1">Retryable флаг</div>
            <div className="text-muted-foreground">✓ = ошибку можно повторить (нажимайте "Повторить ошибки"), ✗ = невозможно повторить</div>
          </div>
          <div className="p-3 bg-secondary/50 rounded">
            <div className="font-bold mb-1">Детали ошибки</div>
            <div className="text-muted-foreground">Смотрите stage, reason, message, sourceEventId для диагностики</div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-base mb-3">Параметры конфигурации</h3>
        <div className="space-y-2 text-xs font-mono">
          <div className="p-2 bg-secondary/30 rounded">
            <div className="font-bold">concurrencyLimit (по умолчанию 5)</div>
            <div className="text-muted-foreground">Макс одновременных запросов. Увеличивайте с осторожностью</div>
          </div>
          <div className="p-2 bg-secondary/30 rounded">
            <div className="font-bold">timeoutMs (по умолчанию 30000)</div>
            <div className="text-muted-foreground">Максимальное время ожидания одного запроса в миллисекундах</div>
          </div>
          <div className="p-2 bg-secondary/30 rounded">
            <div className="font-bold">forceRefresh</div>
            <div className="text-muted-foreground">Игнорирует кеш и пересчитывает все значения</div>
          </div>
        </div>
      </Card>
    </div>
  );
}