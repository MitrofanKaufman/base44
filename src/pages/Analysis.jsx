import { BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import ABCAnalysisPanel from '@/components/analysis/ABCAnalysisPanel';
import CompetitorComparisonPanel from '@/components/analysis/CompetitorComparisonPanel';

export default function Analysis() {
  const [activeTab, setActiveTab] = useState('abc');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Анализ товаров</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">ABC-анализ и управление ассортиментом</p>
          
          {/* Tabs */}
          <div className="flex gap-2 border-b border-border/40">
            <button
              onClick={() => setActiveTab('abc')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'abc'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              ABC-анализ
            </button>
            <button
              onClick={() => setActiveTab('competitors')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'competitors'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Сравнение с конкурентами
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto p-4">
        {activeTab === 'abc' && <ABCAnalysisPanel />}
        {activeTab === 'competitors' && <CompetitorComparisonPanel />}
      </div>
    </div>
  );
}