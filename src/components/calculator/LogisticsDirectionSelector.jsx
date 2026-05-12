import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronDown, MapPin, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTariffs, getAvailableDirections, checkFulfillmentCompatibility, clearTariffCache } from '@/lib/LogisticsService';

export default function LogisticsDirectionSelector({ 
  direction, 
  fulfillmentMode, 
  onDirectionChange, 
  onTariffsLoad,
  product = null,
  directoriesMap: externalDirectoriesMap = null,
}) {
  const [open, setOpen] = useState(false);
  const [availableDirections, setAvailableDirections] = useState([]);
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
      clearTariffCache(); // очищаем кеш при обновлении справочников
    }
  }, [dbDirectories, externalDirectoriesMap]);

  // Получаем доступные направления на основе справочников
  useEffect(() => {
    const dirs = getAvailableDirections(directoryMap, 'wildberries');
    setAvailableDirections(dirs);
  }, [directoryMap]);

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

  const currentDir = availableDirections.find(d => d.id === direction) || availableDirections[0];
  const compatibility = checkFulfillmentCompatibility(product, fulfillmentMode);

  return (
    <div className="relative w-full space-y-2">
      {!compatibility.available && (
        <div className="flex gap-2 p-2 bg-warning/10 border border-warning/30 rounded text-[10px] text-warning">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <div>{compatibility.restrictions[0]}</div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 h-[34px] rounded-lg border border-border bg-secondary/40 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all"
        disabled={!compatibility.available}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{currentDir?.name || 'Выберите направление'}</span>
        </div>
        <ChevronDown className={cn('w-3 h-3 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg">
          {availableDirections.map(dir => (
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
          ))}
        </div>
      )}

      {direction && currentDir && (
        <div className="mt-2 p-2 bg-secondary/30 rounded text-[10px] text-muted-foreground space-y-0.5">
          <p className="font-semibold text-foreground">{currentDir.name} • {fulfillmentMode}</p>
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
