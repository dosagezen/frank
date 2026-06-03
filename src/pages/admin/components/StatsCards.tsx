import React from 'react';

interface UserProfile {
  id: string;
  role: string;
}

interface StatsCardsProps {
  users: UserProfile[];
}

export default function StatsCards({ users }: StatsCardsProps) {
  // Guard against undefined or null `users`
  if (!Array.isArray(users)) {
    console.error('StatsCards: `users` prop must be an array.');
    return null;
  }

  const totalUsers = users.length;
  const admins = users.filter((u) => u.role === 'admin').length;
  const members = users.filter((u) => u.role === 'member').length;

  const stats = [
    {
      label: 'Total de Usuários',
      value: totalUsers,
      icon: 'ri-group-line',
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
    },
    {
      label: 'Administradores',
      value: admins,
      icon: 'ri-shield-star-line',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      label: 'Membros',
      value: members,
      icon: 'ri-user-star-line',
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-3"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${stat.bg}`}>
              <i className={`${stat.icon} text-base ${stat.color}`}></i>
            </div>
          </div>
          <p
            className="text-xl font-bold text-gray-900 dark:text-white mb-0.5"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {stat.value}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
