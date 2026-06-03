
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ProjectProgress {
  id: string;
  name: string;
  completed: number;
  total: number;
  percentage: number;
  color: string;
}

interface ProjectsProgressChartProps {
  data: ProjectProgress[];
}

/**
 * Custom tooltip for the bar chart.
 * Handles missing or malformed payload gracefully.
 */
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          {item.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {item.completed}/{item.total} tarefas concluídas
        </p>
        <p className="text-xs font-bold text-teal-600 dark:text-teal-400 mt-1">
          {item.percentage}% completo
        </p>
      </div>
    );
  }
  return null;
};

export default function ProjectsProgressChart({
  data,
}: ProjectsProgressChartProps) {
  // Guard against malformed input
  if (!Array.isArray(data)) {
    console.error("ProjectsProgressChart: `data` prop must be an array.");
    data = [];
  }

  const chartData = data.map((p) => ({
    ...p,
    name: p.name.length > 18 ? p.name.substring(0, 18) + "..." : p.name,
    fullName: p.name,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2
            className="text-base sm:text-lg font-bold text-gray-900 dark:text-white"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            Progresso dos Projetos
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Percentual de conclusão por projeto
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <i className="ri-folder-chart-line text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhum projeto ativo
          </p>
        </div>
      ) : (
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" barCategoryGap="20%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                width={140}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Bar dataKey="percentage" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || "#14b8a6"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
