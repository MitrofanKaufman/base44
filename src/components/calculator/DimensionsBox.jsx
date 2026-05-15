import { calcVolumeliters, isKgt } from '@/lib/unitEconomics';
import { getPalletDimensions } from '@/lib/LogisticsService';

const PALLET_DIMENSIONS = getPalletDimensions();
const PALLET_USABLE_HEIGHT_CM = PALLET_DIMENSIONS.max_loaded_height_cm - PALLET_DIMENSIONS.height_cm;

function BoxSVG({ l = 30, w = 20, h = 15 }) {
  const max = Math.max(l, w, h, 1);
  const W = w / max * 62 + 22;
  const H = h / max * 44 + 14;
  const D = l / max * 38 + 12;
  const ox = 28,oy = 92;

  const f = [[ox, oy], [ox + W, oy], [ox + W, oy - H], [ox, oy - H]];
  const t = [[ox, oy - H], [ox + W, oy - H], [ox + W - D * 0.6, oy - H - D * 0.38], [ox - D * 0.6, oy - H - D * 0.38]];
  const r = [[ox + W, oy], [ox + W - D * 0.6, oy - D * 0.38], [ox + W - D * 0.6, oy - H - D * 0.38], [ox + W, oy - H]];
  const poly = (pts) => pts.map((p) => p.join(',')).join(' ');

  const minX = ox - D * 0.6 - 2;
  const minY = oy - H - D * 0.38 - 14;
  const maxX = ox + W + 24;
  const maxY = oy + 14;

  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="bF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff4eb" /><stop offset="100%" stopColor="#fde8d0" /></linearGradient>
        <linearGradient id="bT" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde8d0" /><stop offset="100%" stopColor="#f9d4b0" /></linearGradient>
        <linearGradient id="bR" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#f5d0a9" /><stop offset="100%" stopColor="#e8b882" /></linearGradient>
      </defs>
      <polygon points={poly(f)} fill="url(#bF)" stroke="#d4926a" strokeWidth="1" strokeLinejoin="round" />
      <polygon points={poly(t)} fill="url(#bT)" stroke="#d4926a" strokeWidth="1" strokeLinejoin="round" />
      <polygon points={poly(r)} fill="url(#bR)" stroke="#d4926a" strokeWidth="1" strokeLinejoin="round" />
      <line x1={ox} y1={oy} x2={ox - D * 0.6} y2={oy - D * 0.38} stroke="#d4926a" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={ox - D * 0.6} y1={oy - D * 0.38} x2={ox - D * 0.6} y2={oy - H - D * 0.38} stroke="#d4926a" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={ox - D * 0.6} y1={oy - H - D * 0.38} x2={ox} y2={oy - H} stroke="#d4926a" strokeWidth="0.6" strokeDasharray="2,2" />
      {/* Labels */}
      <text x={ox + W / 2} y={oy + 11} textAnchor="middle" fontSize="8" fill="#9a3412" fontWeight="700">{w} см</text>
      <text x={ox + W + 4} y={oy - H / 2 + 3} fontSize="8" fill="#9a3412" fontWeight="700">{h} см</text>
      <text x={ox + W - D * 0.3} y={oy - H - D * 0.38 - 3} textAnchor="middle" fontSize="8" fill="#9a3412" fontWeight="700">{l} см</text>
    </svg>);

}

function PalletSVG({ l = 120, w = 80, h = 165 }) {
  const max = Math.max(l, w, h, 1);
  const BW = w / max * 60 + 28,BD = l / max * 36 + 14,BH = 10;
  const CW = BW * 0.9,CH = h / max * 50 + 14,CD = BD * 0.9;
  const ox = 26,oy = 115;
  const cOx = ox + (BW - CW) / 2,cOy = oy - BH;
  const pF = [[ox, oy], [ox + BW, oy], [ox + BW, oy - BH], [ox, oy - BH]];
  const pT = [[ox, oy - BH], [ox + BW, oy - BH], [ox + BW - BD * 0.55, oy - BH - BD * 0.3], [ox - BD * 0.55, oy - BH - BD * 0.3]];
  const pR = [[ox + BW, oy], [ox + BW - BD * 0.55, oy - BD * 0.3], [ox + BW - BD * 0.55, oy - BH - BD * 0.3], [ox + BW, oy - BH]];
  const cF = [[cOx, cOy], [cOx + CW, cOy], [cOx + CW, cOy - CH], [cOx, cOy - CH]];
  const cT = [[cOx, cOy - CH], [cOx + CW, cOy - CH], [cOx + CW - CD * 0.55, cOy - CH - CD * 0.3], [cOx - CD * 0.55, cOy - CH - CD * 0.3]];
  const cR = [[cOx + CW, cOy], [cOx + CW - CD * 0.55, cOy - CD * 0.3], [cOx + CW - CD * 0.55, cOy - CH - CD * 0.3], [cOx + CW, cOy - CH]];
  const poly = (pts) => pts.map((p) => p.join(',')).join(' ');
  const minX = ox - BD * 0.55 - 2,minY = cOy - CH - CD * 0.3 - 12,maxX = ox + BW + 22,maxY = oy + 12;
  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="pF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e8c97a" /><stop offset="100%" stopColor="#d4a843" /></linearGradient>
        <linearGradient id="cF2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff4eb" /><stop offset="100%" stopColor="#fde8d0" /></linearGradient>
      </defs>
      <polygon points={poly(pF)} fill="url(#pF)" stroke="#b8922a" strokeWidth="0.9" />
      <polygon points={poly(pT)} fill="#f0d877" stroke="#b8922a" strokeWidth="0.9" />
      <polygon points={poly(pR)} fill="#c8a040" stroke="#b8922a" strokeWidth="0.9" />
      <polygon points={poly(cF)} fill="url(#cF2)" stroke="#d4926a" strokeWidth="1" />
      <polygon points={poly(cT)} fill="#fde8d0" stroke="#d4926a" strokeWidth="1" />
      <polygon points={poly(cR)} fill="#f5d0a9" stroke="#d4926a" strokeWidth="1" />
      <text x={ox + BW / 2} y={oy + 10} textAnchor="middle" fontSize="8" fill="#9a3412" fontWeight="700">{w} см</text>
      <text x={ox + BW + 4} y={cOy - CH / 2} fontSize="8" fill="#9a3412" fontWeight="700">{h} см</text>
      <text x={cOx + CW - CD * 0.27} y={cOy - CH - CD * 0.15 - 3} textAnchor="middle" fontSize="8" fill="#9a3412" fontWeight="700">{l} см</text>
    </svg>);

}

export default function DimensionsBox({ l, w, h, weight, onChange: _onChange, mode = 'box', boxCount = 0 }) {
  const isPallet = mode === 'pallet';
  const vol = calcVolumeliters(l, w, h);
  const kgt = !isPallet && isKgt(weight, vol);
  const palletBoxCount = Number.isFinite(Number(boxCount)) && Number(boxCount) > 0
    ? Math.floor(Number(boxCount))
    : 0;

  return (
    <div className="bg-card rounded-[18px] border border-border shadow-warm-sm flex flex-col h-full" style={{ padding: '8px 10px', gap: 6 }}>
      {/* SVG takes remaining space */}
      <div className="flex items-center justify-center bg-gradient-to-b from-secondary/20 to-accent/20 rounded-xl" style={{ width: '100%', height: '100px' }}>
        {mode === 'box' ?
        <BoxSVG l={l || 30} w={w || 20} h={h || 15} /> :
        <PalletSVG
          l={PALLET_DIMENSIONS.length_cm}
          w={PALLET_DIMENSIONS.width_cm}
          h={PALLET_USABLE_HEIGHT_CM}
        />
        }
      </div>

      {/* 2×2 input grid */}













      

      {((!isPallet && vol != null) || isPallet) &&
      <div className="flex items-center justify-between flex-shrink-0" style={{ paddingTop: 3, borderTop: '1px solid hsl(var(--border))' }}>
          {!isPallet ? (
            <span className="text-[9px] text-muted-foreground">Объём: <strong className="text-foreground">{vol.toFixed(1)} л</strong></span>
          ) : (
            <span className="text-[9px] text-muted-foreground">Коробок: <strong className="text-foreground">{palletBoxCount ? `${palletBoxCount} шт` : '—'}</strong></span>
          )}
          <div className="flex gap-1">
            {kgt && <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.5 rounded text-[8px] font-bold">КГТ</span>}
            {mode === 'pallet' && <span className="bg-violet-50 text-violet-700 border border-violet-200 px-1 py-0.5 rounded text-[8px] font-bold">Паллет</span>}
          </div>
        </div>
      }
    </div>);

}
