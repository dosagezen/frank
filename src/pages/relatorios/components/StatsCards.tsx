
import { useEffect, useRef } from 'react';

interface StatCard {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: string;
  color: string;
  bgColor: string;
  iconColor: string;
}

interface StatsCardsProps {
  stats: {
    tarefasConcluidas: number;
    totalTarefas: number;
    projetosAtivos: number;
    taxaConclusao: number;
    membrosAtivos: number;
    tarefasAtrasadas: number;
  };
}

/**
 * StatsCards – renders a set of statistic cards with a simple entrance animation.
 *
 * The component now:
 *  - Removes stray markup tags that caused a syntax error.
 *  - Safely initialises the ref array to avoid undefined entries.
 *  - Wraps the animation logic in a try/catch to prevent a failure from breaking the UI.
 */
export default function StatsCards({ stats }: StatsCardsProps) {
  // Initialise the ref as an empty array that will grow with the cards.
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    try {
      // Guard against the case where the ref array hasn't been populated yet.
      if (!cardsRef.current?.length) return;

      cardsRef.current.forEach((card, i) => {
        if (!card) return;

        // Initial hidden state
        card.style.opacity = '0';
        card.style.transform = 'translateY(16px)';

        // Staggered reveal
        setTimeout(() => {
          card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, i * 100);
      });
    } catch (error) {
      // Log the error but keep the component functional.
      console.error('StatsCards animation error:', error);
    }
  }, []);

  const cards: StatCard[] = [
    {
      label: 'Tarefas Concluídas',
      value: stats.tarefasConcluidas.toString(),
      change:
        stats.totalTarefas > 0
          ? `${Math.round((stats.tarefasConcluidas / stats.totalTarefas) * 100)}% do total`
          : '0%',
      trend: 'up',
      icon: 'ri-checkbox-circle-line',
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Projetos Ativos',
      value: stats.projetosAtivos.toString(),
      change: 'Em andamento',
      trend: 'up',
      icon: 'ri-folder-chart-line',
      color: 'from-teal-500 to-teal-600',
      bgColor: 'bg-teal-50 dark:bg-teal-950/30',
      iconColor: 'text-teal-600 dark:text-teal-400',
    },
    {
      label: 'Taxa de Conclusão',
      value: `${stats.taxaConclusao}%`,
      change: stats.taxaConclusao >= 50 ? 'Bom desempenho' : 'Precisa melhorar',
      trend: stats.taxaConclusao >= 50 ? 'up' : 'down',
      icon: 'ri-line-chart-line',
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Tarefas Atrasadas',
      value: stats.tarefasAtrasadas.toString(),
      change: stats.tarefasAtrasadas === 0 ? 'Nenhuma atrasada' : 'Atenção necessária',
      trend: stats.tarefasAtrasadas === 0 ? 'up' : 'down',
      icon: 'ri-alarm-warning-line',
      color: 'from-rose-500 to-rose-600',
      bgColor: 'bg-rose-50 dark:bg-rose-950/30',
      iconColor: 'text-rose-600 dark:text-rose-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {cards.map((card, index) => (
        <div
          key={index}
          ref={(el) => { cardsRef.current[index] = el; }}
          className="bg-white dark:bg-gray-800 rounded-xl px-3 py-3 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all group"
        >
          <div className="flex items-start justify-between mb-1.5">
            <div
              className={`w-9 h-9 ${card.bgColor} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}
            >
              <i className={`${card.icon} text-base ${card.iconColor}`}></i>
            </div>
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                card.trend === 'up'
                  ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400'
              }`}
            >
              <i className={`ri-arrow-${card.trend === 'up' ? 'up' : 'down'}-s-line mr-0.5`}></i>
              {card.change}
            </span>
          </div>
          <h3
            className="text-xl font-bold text-gray-900 dark:text-white mb-0.5"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {card.value}
          </h3>
          <p
            className="text-xs text-gray-500 dark:text-gray-400"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {card.label}
          </p>
        </div>
      ))}
    </div>
  );
}
