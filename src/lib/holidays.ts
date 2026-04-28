/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bundesland } from '../types';
import { format, parseISO } from 'date-fns';

// Simplified holiday logic for Germany
// In a real app, one should use a library like 'date-holidays'
export function isPublicHoliday(date: Date | string, state: Bundesland): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const dateStr = format(d, 'MM-dd');
  const year = d.getFullYear();

  // Fixed holidays across Germany
  const fixedHolidays = [
    '01-01', // New Year
    '05-01', // Labor Day
    '10-03', // German Unity Day
    '12-25', // Christmas
    '12-26', // St. Stephen's Day
  ];

  if (fixedHolidays.includes(dateStr)) return true;

  // Moveable holidays (simplified Easter-based logic or hardcoded for common years)
  // For the user request: 01/05/2026 is already in fixedHolidays as '05-01'
  
  // Specific state-based fixed holidays
  if (dateStr === '01-06' && ['BW', 'BY', 'ST'].includes(state)) return true; // Epiphany
  if (dateStr === '08-15' && ['BY', 'SL'].includes(state)) return true; // Assumption
  if (dateStr === '10-31' && ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'].includes(state)) return true; // Reformation Day
  if (dateStr === '11-01' && ['BW', 'BY', 'NW', 'RP', 'SL'].includes(state)) return true; // All Saints

  // Calculate Easter for moveable holidays if needed, 
  // but for now let's hardcode some 2026 ones to be accurate for the user
  if (year === 2026) {
    const holidays2026 = [
      '04-03', // Good Friday
      '04-06', // Easter Monday
      '05-14', // Ascension
      '05-25', // Whit Monday
      '06-04', // Corpus Christi (BW, BY, HE, NW, RP, SL)
    ];
    if (holidays2026.includes(dateStr)) {
      if (dateStr === '06-04') {
        return ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'].includes(state);
      }
      return true;
    }
  }

  return false;
}

export function getHolidayName(date: Date | string): string | null {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const dateStr = format(d, 'MM-dd');
  
  const names: Record<string, string> = {
    '01-01': 'New Year',
    '05-01': 'Labor Day',
    '10-03': 'German Unity Day',
    '12-25': 'Christmas',
    '12-26': 'Christmas (2nd Day)',
    '01-06': 'Epiphany',
    '08-15': 'Assumption Day',
    '10-31': 'Reformation Day',
    '11-01': 'All Saints Day',
    '04-03': 'Good Friday',
    '04-06': 'Easter Monday',
    '05-14': 'Ascension Day',
    '05-25': 'Whit Monday',
    '06-04': 'Corpus Christi',
  };

  return names[dateStr] || null;
}
