import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

export default function ExecutionTimeChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Время выполнения</CardTitle>
          <CardDescription>Длительность выполнения прогонов по датам</CardDescription>
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
        <CardTitle>Время выполнения</CardTitle>
        <CardDescription>Длительность выполнения прогонов по датам</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis label={{ value: 'мс', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              formatter={(value) => formatDuration(value)}
              labelFormatter={(label) => `Дата: ${label}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="avgDuration" 
              stroke="hsl(var(--primary))" 
              name="Среднее время"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="maxDuration" 
              stroke="hsl(var(--warning))" 
              name="Максимальное время"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--warning))', r: 4 }}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}