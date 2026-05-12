import { useState, useEffect } from 'react';
import { ChevronDown, MapPin, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PickupPointSelector({ 
  selectedPoint, 
  onPointChange,
  fulfillmentMode: _fulfillmentMode = 'FBO',
  directoriesMap = {}
}) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);

  // Парсим ПВЗ из справочников маркетплейса
  useEffect(() => {
    const extractPickupPoints = () => {
      const allPoints = [];
      
      // Обрабатываем справочники по источникам (Wildberries, Yandex, Ozon)
      Object.entries(directoriesMap).forEach(([source, directories]) => {
        if (Array.isArray(directories)) {
          directories.forEach(dir => {
            // Извлекаем данные из direction_name и raw_data
            const point = {
              id: `${source}_${dir.direction_id}`,
              directionId: dir.direction_id,
              name: dir.direction_name || 'Неизвестный пункт',
              city: extractCity(dir.raw_data?.city || dir.raw_data?.address || dir.direction_name),
              address: extractAddress(dir.raw_data),
              type: determineType(dir.direction_name, dir.raw_data),
              source: source
            };
            allPoints.push(point);
          });
        }
      });

      // Удаляем дубликаты по ID направления
      const uniquePoints = Array.from(
        new Map(allPoints.map(p => [p.id, p])).values()
      );

      setPoints(uniquePoints.length > 0 ? uniquePoints : []);
      setLoading(false);
    };

    extractPickupPoints();
  }, [directoriesMap]);

  const extractCity = (dirName) => {
    if (!dirName) return 'Неизвестный регион';
    if (dirName.includes('Москв')) return 'Москва';
    if (dirName.includes('Санкт') || dirName.includes('СПб')) return 'Санкт-Петербург';
    if (dirName.includes('Екатеринбург')) return 'Екатеринбург';
    if (dirName.includes('Новосибирск')) return 'Новосибирск';
    return dirName.split(',')[0] || dirName;
  };

  const extractAddress = (rawData) => {
    if (!rawData) return 'Адрес не указан';
    if (typeof rawData === 'string') return rawData;
    if (rawData.address) return rawData.address;
    if (rawData.location) return rawData.location;
    return 'Адрес не указан';
  };

  const determineType = (dirName, rawData) => {
    if (rawData?.type === 'pvz' || rawData?.type === 'warehouse') return rawData.type;
    const nameStr = (dirName || '').toLowerCase();
    if (nameStr.includes('склад') || nameStr.includes('warehouse')) return 'warehouse';
    if (nameStr.includes('пвз') || nameStr.includes('pickup')) return 'pvz';
    return 'warehouse';
  };

  const current = points.find(p => p.id === selectedPoint) || points[0];
  const grouped = points.reduce((acc, point) => {
    if (!acc[point.city]) acc[point.city] = [];
    acc[point.city].push(point);
    return acc;
  }, {});

  const handleSelect = (pointId) => {
    const point = points.find(p => p.id === pointId);
    onPointChange(pointId, point);
    setOpen(false);
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center px-3 py-2 h-[34px] rounded-lg border border-border bg-secondary/40 text-[11px] text-muted-foreground gap-2">
        <Loader className="w-3 h-3 animate-spin" />
        Загрузка ПВЗ...
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="w-full px-3 py-2 h-[34px] rounded-lg border border-border bg-secondary/40 text-[11px] text-muted-foreground flex items-center">
        ПВЗ не найдены
      </div>
    );
  }

  return (
    <div className="relative w-full space-y-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 h-[34px] rounded-lg border border-border bg-secondary/40 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all"
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <div className="flex flex-col items-start min-w-0">
            <span className="truncate text-[10px]">{current?.name || 'Выберите ПВЗ'}</span>
            {current?.city && <span className="text-[9px] opacity-70">{current.city}</span>}
          </div>
        </div>
        <ChevronDown className={cn('w-3 h-3 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {Object.entries(grouped).map(([city, cityPoints]) => (
            <div key={city}>
              <div className="px-3 py-1.5 bg-secondary/30 text-[10px] font-bold sticky top-0 text-foreground">
                {city}
              </div>
              {cityPoints.map(point => (
                <button
                  key={point.id}
                  onClick={() => handleSelect(point.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-[11px] transition-colors border-b border-border/30 last:border-0',
                    selectedPoint === point.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  )}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {point.type === 'pvz' ? '📦' : '🏭'}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{point.name}</div>
                      <div className="text-[9px] opacity-70 truncate">{point.address}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {current && (
        <div className="p-2 bg-secondary/20 rounded text-[10px] text-muted-foreground">
          <p className="font-semibold text-foreground">{current.name}</p>
          <p className="opacity-70">{current.address}</p>
        </div>
      )}
    </div>
  );
}
