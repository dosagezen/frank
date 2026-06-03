/**
 * Converte uma string de data no formato YYYY-MM-DD para um objeto Date
 * usando meio-dia (12:00:00) para evitar problemas de timezone.
 * 
 * Quando uma data como "2026-04-01" é convertida diretamente com new Date(),
 * o JavaScript interpreta como UTC meia-noite (00:00:00 UTC), que no fuso
 * horário de Brasília (UTC-3) vira 21:00:00 do dia anterior (31/03).
 * 
 * Ao adicionar 'T12:00:00', forçamos a interpretação como meio-dia local,
 * garantindo que a data exibida seja a correta.
 * 
 * @param dateStr - String de data no formato YYYY-MM-DD
 * @returns Objeto Date ou null se a string for inválida
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  return new Date(dateStr + 'T12:00:00');
}

/**
 * Formata uma string de data YYYY-MM-DD para o formato brasileiro dd/mm/aaaa
 * 
 * @param dateStr - String de data no formato YYYY-MM-DD
 * @param options - Opções de formatação do toLocaleDateString
 * @returns String formatada ou string vazia se a data for inválida
 */
export function formatDateBR(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseDate(dateStr);
  if (!date) return '';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    ...options,
  };
  
  return date.toLocaleDateString('pt-BR', defaultOptions);
}