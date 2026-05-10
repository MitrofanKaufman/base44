import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ErrorRateChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Процент ошибок</CardTitle>
          <CardDescription>Доля обработанных событий с ошибками (%)</CardDescription>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center text-muted-foreground">
          Нет данных для отображения
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Процент ошибок</CardTitle>
        <CardDescription>Доля обработанных событий с ошибками (%)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              formatter={(value) => `${value.toFixed(2)}%`}
              labelFormatter={(label) => `Дата: ${label}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="errorRate" 
              stroke="hsl(var(--destructive))" 
              name="Процент ошибок"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--destructive))', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}