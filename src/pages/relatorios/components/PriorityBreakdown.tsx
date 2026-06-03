
import * as React from "react";

interface PriorityData {
  name: string;
  value: number;
  color: string;
  bgColor: string;
  icon: string;
}

interface PriorityBreakdownProps {
  data?: PriorityData[]; // make optional for safety
}

/**
 * Renders a breakdown of tasks by priority.
 * Includes a stacked bar visualisation and a list with percentages.
 */
export default function PriorityBreakdown({
  data = [], // fallback to an empty array
}: PriorityBreakdownProps) {
  // Defensive programming: ensure `data` is an array
  if (!Array.isArray(data)) {
    console.warn("[PriorityBreakdown] `data` prop should be an array.");
    data = [];
  }

  // Compute the total safely
  const total = data.reduce((sum, item) => sum + (item?.value ?? 0), 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      <h2
        className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1"
        style={{ fontFamily: "Poppins, sans-serif" }}
      >
        Tarefas por Prioridade
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Distribuição atual
      </p>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <i className="ri-flag-line text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhuma tarefa encontrada
          </p>
        </div>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="flex rounded-full h-3 overflow-hidden mb-5">
            {data
              .filter((d) => d.value > 0)
              .map((item, index) => (
                <div
                  key={index}
                  className="transition-all"
                  style={{
                    width: `${(item.value / total) * 100}%`,
                    backgroundColor: item.color,
                  }}
                ></div>
              ))}
          </div>

          <div className="space-y-3">
            {data.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.bgColor}`}
                  >
                    <i
                      className={`${item.icon} text-sm`}
                      style={{ color: item.color }}
                    ></i>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {item.value}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">
                    {total > 0 ? Math.round((item.value / total) * 100) : 0}%
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
