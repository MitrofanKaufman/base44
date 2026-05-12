import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { calculate } from '@/lib/unitEconomics';
import { buildCalculatorViewModel } from '@/lib/calculatorViewModel';

const MODES = [
  { id: 'price', label: 'Цена продажи (₽)', min: 0, max: 'auto' },
  { id: 'advertising', label: 'Бюджет на рекламу (₽)', min: 0, max: 'auto' },
];

export default function InteractiveProfitChart({ form, result }) {
  const [selectedMode, setSelectedMode] = useState('price');
  const mode = MODES.find(m => m.id === selectedMode);

  const chartData = useMemo(() => {
    if (!form || !result) return [];

    const baseValue = selectedMode === 'price' ? form.price : form.cac;
    const range = selectedMode === 'price' ? 100 : 500;
    const steps = 20;

    const data = [];
    for (let i = 0; i <= steps; i++) {
      const value = Math.max(0, baseValue - range / 2 + (range / steps) * i);
      
      const testForm = selectedMode === 'price'
        ? { ...form, price: value }
        : { ...form, cac: value };
      
      const testResult = calculate(testForm);
      const testView = buildCalculatorViewModel(testForm, testResult);
      const monthlyPlan = Number(form.monthly_plan) > 0 ? Number(form.monthly_plan) : 0;
      const profit = (testResult.contribution || 0) * monthlyPlan - testView.monthly.fixedMonthlyTotal;

      data.push({
        value: Math.round(value),
        profit: Math.round(profit),
        isCurrentValue: Math.abs(value - baseValue) < 1
      });
    }

    return data;
  }, [form, selectedMode]);

  const currentProfit = useMemo(() => {
    const monthlyPlan = Number(form?.monthly_plan) > 0 ? Number(form.monthly_plan) : 0;
    const view = buildCalculatorViewModel(form, result);
    return Math.round(((result?.contribution || 0) * monthlyPlan) - view.monthly.fixedMonthlyTotal);
  }, [form, result]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card className="col-span-1">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Влияние на прибыль</p>
          <div className="flex gap-2">
            {MODES.map(m => (
              <Button
                key={m.id}
                size="sm"
                variant={selectedMode === m.id ? 'default' : 'outline'}
                onClick={() => setSelectedMode(m.id)}
                className="text-xs"
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 15, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="value"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '11px' }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '11px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value) => `${value.toLocaleString('ru-RU')} ₽`}
                labelFormatter={(label) => `${mode.label.split('(')[1].replace(')', '')}: ${label}`}
              />
              <ReferenceLine
                y={currentProfit}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                label={{
                  value: `Текущая: ${currentProfit.toLocaleString('ru-RU')} ₽`,
                  position: 'insideTopRight',
                  offset: -10,
                  fill: 'hsl(var(--primary))',
                  fontSize: '11px',
                  fontWeight: 600
                }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="text-xs text-muted-foreground space-y-1 bg-secondary/30 p-2 rounded">
          <p>💰 <strong>Текущая прибыль:</strong> {currentProfit.toLocaleString('ru-RU')} ₽/мес</p>
          <p className="text-[11px]">График показывает, как изменение {mode.label.toLowerCase()} влияет на прибыль</p>
        </div>
      </CardContent>
    </Card>
  );
}
