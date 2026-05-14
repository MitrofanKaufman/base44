import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronDown, MapPin, AlertCircle, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTariffs, getAvailableDirections, checkFulfillmentCompatibility, clearTariffCache } from '@/lib/LogisticsService';

const MODES = {
  DIRECTION: 'direction',
  PICKUP_POINT: 'pickup_point'
};

export default function LogisticsSelector({
  direction,
  pickupPoint,
  fulfillmentMode,
  onDirectionChange,
  onTariffsLoad,
  onPointChange,
  product = null,
  directoriesMap: externalDirectoriesMap = null,
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(MODES.DIRECTION);
  const [availableDirections, setAvailableDirections] = useState([]);
  const [pickupPoints, setPickupPoints] = useState([]);
  const [directoryMap, setDirectoryMap] = useState({});

  // Загружаем справочники из БД
  const { data: dbDirectories = [] } = useQuery({
    queryKey: ['logistics-directories'],
    queryFn: () => base44.entities.LogisticsDirectory.list('-synced_at', 100),
    refetchInterval: 3600000,
    enabled: !externalDirectoriesMap,
  });

  // Индексируем справочники по источнику
  useEffect(() => {
    if (externalDirectoriesMap) {
      setDirectoryMap(externalDirectoriesMap);
      clearTariffCache();
      return;
    }

    if (dbDirectories.length > 0) {
      const bySource = {};
      dbDirectories.forEach(dir => {
        if (!bySource[dir.source]) bySource[dir.source] = [];
        bySource[dir.source].push(dir);
      });
      setDirectoryMap(bySource);
      clearTariffCache();
    }
  }, [dbDirectories, externalDirectoriesMap]);

  // Получаем доступные направления на основе справочников
  useEffect(() => {
    const dirs = getAvailableDirections(directoryMap, 'wildberries');
    setAvailableDirections(dirs);
  }, [directoryMap]);

  // Парсим ПВЗ из справочников маркетплейса
  useEffect(() => {
    const extractPickupPoints = () => {
      const allPoints = [];
      
      Object.entries(directoryMap).forEach(([source, directories]) => {
        if (Array.isArray(directories)) {
          directories.forEach(dir => {
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

      setPickupPoints(uniquePoints.length > 0 ? uniquePoints : []);
    };

    extractPickupPoints();
  }, [directoryMap]);

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

  const handleSelectDirection = (dirId) => {
    const compatibility = checkFulfillmentCompatibility(product, fulfillmentMode);
    if (!compatibility.available) {
      alert(`Внимание: ${compatibility.restrictions[0]}`);
      return;
    }

    onDirectionChange(dirId);
    const tariffs = getTariffs(dirId, fulfillmentMode, directoryMap);
    onTariffsLoad(tariffs, dirId);
    setOpen(false);
  };

  const handleSelectPickupPoint = (pointId) => {
    const point = pickupPoints.find(p => p.id === pointId);
    if (onPointChange) {
      onPointChange(pointId, point);
    }
    
    // Также обновляем направление
    if (point?.directionId) {
      const compatibility = checkFulfillmentCompatibility(product, fulfillmentMode);
      if (!compatibility.available) {
        alert(`Внимание: ${compatibility.restrictions[0]}`);
        return;
      }

      onDirectionChange(point.directionId);
      const tariffs = getTariffs(point.directionId, fulfillmentMode, directoryMap);
      onTariffsLoad(tariffs, point.directionId);
    }
    
    setOpen(false);
  };

  const currentDir = availableDirections.find(d => d.id === direction) || availableDirections[0];
  const currentPoint = pickupPoints.find(p => p.id === pickupPoint);
  const compatibility = checkFulfillmentCompatibility(product, fulfillmentMode);
  
  // Группируем ПВЗ по городам
  const groupedPoints = pickupPoints.reduce((acc, point) => {
    if (!acc[point.city]) acc[point.city] = [];
    acc[point.city].push(point);
    return acc;
  }, {});

  return (
    <div className="relative w-full space-y-2">
      {!compatibility.available && (
        <div className="flex gap-2 p-2 bg-warning/10 border border-warning/30 rounded text-[10px] text-warning">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <div>{compatibility.restrictions[0]}</div>
        </div>
      )}

      {/* Переключатель режимов */}
      <div className="flex gap-1 bg-secondary/40 rounded-md p-1">
        <button
          onClick={() => setMode(MODES.DIRECTION)}
          className={cn(
            'flex-1 py-1 text-xs font-semibold rounded-md transition-all',
            mode === MODES.DIRECTION
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          По направлениям
        </button>
        <button
          onClick={() => setMode(MODES.PICKUP_POINT)}
          className={cn(
            'flex-1 py-1 text-xs font-semibold rounded-md transition-all',
            mode === MODES.PICKUP_POINT
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          По ПВЗ
        </button>
      </div>

      {/* Dropdown выбора */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 h-[34px] rounded-lg border border-border bg-secondary/40 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all"
        disabled={!compatibility.available}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {mode === MODES.DIRECTION ? (
            <span className="truncate">{currentDir?.name || 'Выберите направление'}</span>
          ) : (
            <div className="flex flex-col items-start min-w-0">
              <span className="truncate text-[10px]">{currentPoint?.name || 'Выберите ПВЗ'}</span>
              {currentPoint?.city && <span className="text-[9px] opacity-70">{currentPoint.city}</span>}
            </div>
          )}
        </div>
        <ChevronDown className={cn('w-3 h-3 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown контент */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {mode === MODES.DIRECTION ? (
            // Режим направлений
            availableDirections.map(dir => (
              <button
                key={dir.id}
                onClick={() => handleSelectDirection(dir.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-[11px] font-medium transition-colors border-b border-border/50 last:border-0 disabled:opacity-50',
                  direction === dir.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{dir.icon}</span>
                  <span>{dir.name}</span>
                </div>
              </button>
            ))
          ) : (
            // Режим ПВЗ
            pickupPoints.length === 0 ? (
              <div className="px-3 py-4 text-[11px] text-muted-foreground text-center">
                ПВЗ не найдены
              </div>
            ) : (
              Object.entries(groupedPoints).map(([city, cityPoints]) => (
                <div key={city}>
                  <div className="px-3 py-1.5 bg-secondary/30 text-[10px] font-bold sticky top-0 text-foreground">
                    {city}
                  </div>
                  {cityPoints.map(point => (
                    <button
                      key={point.id}
                      onClick={() => handleSelectPickupPoint(point.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-[11px] transition-colors border-b border-border/30 last:border-0',
                        pickupPoint === point.id
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
              ))
            )
          )}
        </div>
      )}

      {/* Информация о выбранном элементе и тарифах */}
      {direction && currentDir && (
        <div className="mt-2 p-2 bg-secondary/30 rounded text-[10px] text-muted-foreground space-y-0.5">
          <p className="font-semibold text-foreground">
            {mode === MODES.DIRECTION ? currentDir.name : currentPoint?.name || currentDir.name} • {fulfillmentMode}
          </p>
          {(() => {
            const tariffs = getTariffs(direction, fulfillmentMode, directoryMap);
            return (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="opacity-60">Базовый:</span> <strong>{tariffs.base}₽</strong>
                </div>
                <div>
                  <span className="opacity-60">За кг:</span> <strong>{tariffs.per_kg}₽</strong>
                </div>
                <div>
                  <span className="opacity-60">Хранение:</span> <strong>{tariffs.storage}₽/дн</strong>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}