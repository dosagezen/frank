
import React from 'react';

interface RecentActivity {
  id: string;
  userName: string;
  action: string;
  target: string;
  timeAgo: string;
  icon: string;
  iconColor: string;
  iconBg: string;
}

interface RecentActivityListProps {
  activities?: RecentActivity[]; // made optional for safety
}

/**
 * RecentActivityList – displays a vertical timeline of recent actions.
 *
 * The component is defensive:
 *  • If `activities` is undefined or not an array we treat it as an empty list.
 *  • Each activity must have a unique `id`; otherwise we fallback to the array index.
 *  • All dynamic class names are safely concatenated.
 */
export default function RecentActivityList({
  activities = [], // default to empty array
}: RecentActivityListProps) {
  // Guard against non‑array values that could be passed at runtime
  const safeActivities = Array.isArray(activities) ? activities : [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2
            className="text-base sm:text-lg font-bold text-gray-900 dark:text-white"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Atividade Recente
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Últimas ações da equipe
          </p>
        </div>
        <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/30">
          <i className="ri-pulse-line text-lg text-teal-600 dark:text-teal-400"></i>
        </div>
      </div>

      {safeActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <i className="ri-history-line text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhuma atividade recente
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {safeActivities.map((activity, index) => (
            <div
              key={activity.id || index}
              className="flex gap-3 relative"
            >
              {/* Timeline line */}
              {index < safeActivities.length - 1 && (
                <div className="absolute left-[17px] top-10 bottom-0 w-px bg-gray-200 dark:bg-gray-700"></div>
              )}

              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${activity.iconBg} z-10`}
              >
                <i className={`${activity.icon} text-sm ${activity.iconColor}`}></i>
              </div>

              <div className="flex-1 pb-4 min-w-0">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {activity.userName}
                  </span>{' '}
                  {activity.action}{' '}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {activity.target}
                  </span>
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {activity.timeAgo}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
