
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface StatusData {
  name: string;
  value: number;
  color: string;
}

interface TaskDistributionChartProps {
  data: StatusData[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: payload[0].payload.color }}
          ></span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {payload[0].name}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {payload[0].value} tarefa{payload[0].value !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  return null;
};

export default function TaskDistributionChart({
  data,
}: TaskDistributionChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      <h2
        className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1"
        style={{ fontFamily: 'Poppins, sans-serif' }}
      >
        Distribuição de Tarefas
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Por status atual
      </p>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <i className="ri-pie-chart-line text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhuma tarefa encontrada
          </p>
        </div>
      ) : (
        <>
          <div className="h-48 sm:h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p
                  className="text-2xl font-bold text-gray-900 dark:text-white"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {total}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Total
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {data
              .filter((d) => d.value > 0)
              .map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    ></span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {item.value}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      ({Math.round((item.value / total) * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
