
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import React from 'react';

interface WeeklyData {
  day: string;
  concluidas: number;
  criadas: number;
}

interface WeeklyProductivityChartProps {
  /** Array of weekly data. If not provided an empty array is used to avoid crashes. */
  data?: WeeklyData[];
}

/** Custom tooltip component with safe guards */
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700">
      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/** Main chart component */
export default function WeeklyProductivityChart({
  data = [],
}: WeeklyProductivityChartProps) {
  // Basic validation – ensure each entry has the required fields
  const safeData = React.useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      day: item.day ?? '',
      concluidas: typeof item.concluidas === 'number' ? item.concluidas : 0,
      criadas: typeof item.criadas === 'number' ? item.criadas : 0,
    }));
  }, [data]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2
            className="text-base sm:text-lg font-bold text-gray-900 dark:text-white"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Produtividade Semanal
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Tarefas concluídas vs criadas por dia
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Concluídas
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Criadas
            </span>
          </div>
        </div>
      </div>

      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={safeData} barGap={4} barCategoryGap="20%">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#9ca3af' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              allowDecimals={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Bar
              dataKey="concluidas"
              name="Concluídas"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
            >
              {safeData.map((_, index) => (
                <Cell key={`cell-c-${index}`} fill="#14b8a6" />
              ))}
            </Bar>
            <Bar
              dataKey="criadas"
              name="Criadas"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
            >
              {safeData.map((_, index) => (
                <Cell key={`cell-cr-${index}`} fill="#fbbf24" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
