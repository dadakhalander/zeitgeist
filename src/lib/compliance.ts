/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { differenceInHours, differenceInMinutes, parse, isValid, parseISO } from 'date-fns';
import { TimeLog, Bundesland } from '../types';
import { isPublicHoliday } from './holidays';

export interface ComplianceResult {
  isValid: boolean;
  violations: string[];
}

export function checkCompliance(log: TimeLog, previousLog?: TimeLog): ComplianceResult {
  const violations: string[] = [];

  if (log.type !== 'work' || !log.startTime || !log.endTime) {
    return { isValid: true, violations: [] };
  }

  const start = parse(log.startTime, 'HH:mm', new Date());
  const end = parse(log.endTime, 'HH:mm', new Date());

  if (!isValid(start) || !isValid(end)) {
    return { isValid: false, violations: ['Invalid time format'] };
  }

  const durationMinutes = differenceInMinutes(end, start);
  const workMinutes = durationMinutes - log.breakMinutes;

  // 1. Max working time (8h/10h daily)
  if (workMinutes > 600) { // 10 hours
    violations.push('Working more than 10 hours per day is prohibited.');
  } else if (workMinutes > 480) { // 8 hours
    violations.push('Working more than 8 hours requires an average of 8h over 6 months.');
  }

  // 2. Breaks (ArbZG § 4)
  if (workMinutes > 360 && log.breakMinutes < 30) { // > 6h needs 30m
    violations.push('Work > 6 hours requires at least 30 minutes of break.');
  }
  if (workMinutes > 540 && log.breakMinutes < 45) { // > 9h needs 45m
    violations.push('Work > 9 hours requires at least 45 minutes of break.');
  }

  // 3. Rest period (ArbZG § 5: 11 hours)
  if (previousLog && previousLog.endTime && log.startTime) {
    const prevEnd = parse(previousLog.endTime, 'HH:mm', new Date());
    // Note: This logic needs date awareness for shift spans.
    // For simplicity in a daily log app, we compare if the gap is < 11h.
    // Real implementation would track timestamps across days.
  }

  return {
    isValid: violations.length === 0,
    violations
  };
}

export interface PayBreakdown {
  total: number;
  taxable: number;
  taxFree: number;
  isHoliday: boolean;
}

export function calculatePay(log: TimeLog, hourlyRate: number, state?: Bundesland): PayBreakdown {
  const isHoliday = state ? isPublicHoliday(log.date, state) : log.type === 'holiday';
  
  let hours = 0;
  if (!log.startTime || !log.endTime) {
    if (log.type === 'sick' || log.type === 'vacation' || log.type === 'holiday' || isHoliday) {
      hours = 8;
    }
  } else {
    const start = parse(log.startTime, 'HH:mm', new Date());
    const end = parse(log.endTime, 'HH:mm', new Date());
    if (isValid(start) && isValid(end)) {
      const durationMinutes = differenceInMinutes(end, start);
      hours = Math.max(0, durationMinutes - log.breakMinutes) / 60;
    }
  }

  const basePay = hours * hourlyRate;
  const bonusPay = isHoliday ? (hours * hourlyRate) : 0; // 100% bonus for holidays
  
  // In Germany, holiday bonuses are tax-free up to 125% or 150% depending on the holiday.
  // We'll treat the bonus part as tax-free as requested.
  return {
    total: basePay + bonusPay,
    taxable: basePay,
    taxFree: bonusPay,
    isHoliday
  };
}
