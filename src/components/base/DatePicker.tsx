
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  min?: string;
  name?: string;
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

const DROPDOWN_WIDTH = 300;
const DROPDOWN_HEIGHT = 340;

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Selecione uma data',
  className = '',
  required,
  min,
  name,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (value) return parseInt(value.split('-')[0], 10);
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return parseInt(value.split('-')[1], 10) - 1;
    return new Date().getMonth();
  });
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync view when value changes externally
  useEffect(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [value]);

  // Calcular posição do dropdown baseado no trigger
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    let left: number;

    // Vertical
    if (spaceBelow < DROPDOWN_HEIGHT && spaceAbove > DROPDOWN_HEIGHT) {
      top = rect.top + window.scrollY - DROPDOWN_HEIGHT - 4;
    } else {
      top = rect.bottom + window.scrollY + 4;
    }

    // Horizontal
    left = rect.left + window.scrollX;
    if (left + DROPDOWN_WIDTH > window.innerWidth - 8) {
      left = rect.right + window.scrollX - DROPDOWN_WIDTH;
    }
    if (left < 8) left = 8;

    setDropdownStyle({
      position: 'absolute',
      top,
      left,
      width: DROPDOWN_WIDTH,
      zIndex: 99999,
    });
  }, []);

  // Abrir e calcular posição
  const handleToggle = useCallback(() => {
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen((prev) => !prev);
  }, [isOpen, calculatePosition]);

  // Recalcular ao rolar ou redimensionar
  useEffect(() => {
    if (!isOpen) return;
    const update = () => calculatePosition();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen, calculatePosition]);

  // Fechar ao clicar fora
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handlePrevMonth = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setViewMonth((prev) => {
      if (prev === 0) { setViewYear((y) => y - 1); return 11; }
      return prev - 1;
    });
  }, []);

  const handleNextMonth = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setViewMonth((prev) => {
      if (prev === 11) { setViewYear((y) => y + 1); return 0; }
      return prev + 1;
    });
  }, []);

  const handleSelectDay = useCallback(
    (day: number) => {
      const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
      console.log('🔵 DATEPICKER SAÍDA:', { valorRetornado: dateStr, tipo: typeof dateStr });
      onChange(dateStr);
      setIsOpen(false);
    },
    [viewYear, viewMonth, onChange],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
    },
    [onChange],
  );

  const handleGoToToday = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      onChange(dateStr);
      setIsOpen(false);
    },
    [onChange],
  );

  // Build calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(
    viewMonth === 0 ? viewYear - 1 : viewYear,
    viewMonth === 0 ? 11 : viewMonth - 1,
  );

  const cells: Array<{ day: number; currentMonth: boolean; dateStr: string }> = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day: d, currentMonth: false, dateStr: `${y}-${pad(m + 1)}-${pad(d)}` });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, dateStr: `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}` });
  }

  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day: d, currentMonth: false, dateStr: `${y}-${pad(m + 1)}-${pad(d)}` });
  }

  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  })();

  const isDisabled = (dateStr: string) => {
    if (!min) return false;
    return dateStr < min;
  };

  const dropdown = isOpen ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl p-3"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Month/Year navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <i className="ri-arrow-left-s-line text-lg text-gray-600 dark:text-gray-300"></i>
        </button>
        <span className="text-sm font-semibold text-gray-900 dark:text-white select-none">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <i className="ri-arrow-right-s-line text-lg text-gray-600 dark:text-gray-300"></i>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-center text-[11px] font-semibold text-gray-400 dark:text-gray-500 py-1 select-none"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((cell, idx) => {
          const isSelected = cell.dateStr === value;
          const isToday = cell.dateStr === todayStr;
          const disabled = isDisabled(cell.dateStr);

          return (
            <button
              key={idx}
              type="button"
              disabled={disabled || !cell.currentMonth}
              onClick={() => {
                if (cell.currentMonth && !disabled) handleSelectDay(cell.day);
              }}
              className={`
                w-full aspect-square flex items-center justify-center text-xs rounded-lg transition-all cursor-pointer relative
                ${!cell.currentMonth ? 'text-gray-300 dark:text-gray-600 cursor-default' : ''}
                ${cell.currentMonth && !isSelected && !disabled ? 'text-gray-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-400' : ''}
                ${isSelected ? 'bg-teal-600 text-white font-bold shadow-sm hover:bg-teal-700' : ''}
                ${isToday && !isSelected && cell.currentMonth ? 'font-bold ring-1 ring-teal-500 dark:ring-teal-400' : ''}
                ${disabled && cell.currentMonth ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : ''}
              `}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={handleGoToToday}
          className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 cursor-pointer px-2 py-1 rounded-md hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors whitespace-nowrap"
        >
          Hoje
        </button>
        {value && (
          <button
            type="button"
            onClick={(e) => { handleClear(e); setIsOpen(false); }}
            className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      {/* Hidden native input for form validation */}
      {required && (
        <input
          type="text"
          name={name}
          value={value}
          required={required}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={`w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent text-sm cursor-pointer flex items-center justify-between transition-colors hover:bg-gray-50 dark:hover:bg-gray-600/50 ${className}`}
      >
        <div className="flex items-center gap-2">
          <i className="ri-calendar-line text-gray-400 dark:text-gray-500"></i>
          <span className={value ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
            {value ? formatDateBR(value) : placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {value && (
            <span
              onClick={handleClear}
              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Limpar"
            >
              <i className="ri-close-line text-xs text-gray-400 dark:text-gray-500"></i>
            </span>
          )}
          <i className={`ri-arrow-${isOpen ? 'up' : 'down'}-s-line text-gray-400 dark:text-gray-500 transition-transform`}></i>
        </div>
      </button>

      {/* Dropdown via portal — renderizado no body, fora de qualquer overflow */}
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}
