
import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TrendData {
  date: string;
  concluidas: number;
  criadas: number;
}

interface PerformanceTrendChartProps {
  data: TrendData[];
}

/**
 * Custom tooltip for the chart.
 * Includes a safety guard in case Recharts provides unexpected data.
 */
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) => {
  // Guard against malformed payloads
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700">
      <p className="text-xs font-semibold text-gray-900 dark:text-white mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry?.color ?? '#000' }}
          ></span>
          <span className="text-gray-600 dark:text-gray-400">{entry?.name}:</span>
          <span className="font-semibold text-gray-900 dark:text-white">{entry?.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function PerformanceTrendChart({ data }: PerformanceTrendChartProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2
            className="text-base sm:text-lg font-bold text-gray-900 dark:text-white"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Evolução de Performance
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Últimas 4 semanas</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Concluídas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Criadas</span>
          </div>
        </div>
      </div>

      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorConcluidas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCriadas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb7185" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              allowDecimals={false}
            />
            {/* Pass the component reference, not an element, as Recharts expects a render function */}
            <Tooltip content={CustomTooltip} />

            <Area
              type="monotone"
              dataKey="concluidas"
              name="Concluídas"
              stroke="#14b8a6"
              strokeWidth={2.5}
              fill="url(#colorConcluidas)"
              dot={{ r: 4, fill: '#14b8a6', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, fill: '#14b8a6', strokeWidth: 2, stroke: '#fff' }}
            />
            <Area
              type="monotone"
              dataKey="criadas"
              name="Criadas"
              stroke="#fb7185"
              strokeWidth={2}
              fill="url(#colorCriadas)"
              dot={{ r: 3, fill: '#fb7185', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 5, fill: '#fb7185', strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
