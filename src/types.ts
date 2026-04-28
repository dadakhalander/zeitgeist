/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Bundesland = 
  | 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE' | 'MV' 
  | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH';

export const BUNDESLAND_NAMES: Record<Bundesland, string> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen'
};

export enum LogType {
  WORK = 'work',
  SICK = 'sick',
  VACATION = 'vacation',
  HOLIDAY = 'holiday'
}

export interface TimeLog {
  id: string;
  userId: string;
  date: string; // ISO format
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  breakMinutes: number;
  type: LogType;
  project?: string;
  comment?: string;
  isComplianceViolation: boolean;
  violationDetails?: string[];
  createdAt: any; // Firestore Timestamp or number
  updatedAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  state: Bundesland;
  hourlyRate: number;
  weeklyContractHours: number;
  vacationDaysPerYear: number;
  role: 'admin' | 'employee';
  taxClass?: 1 | 2 | 3 | 4 | 5 | 6;
  hasChurchTax?: boolean;
  hasChildren?: boolean;
  isChildlessOver23?: boolean;
}

export interface PayrollResult {
  gross: number;
  taxableGross: number;
  taxFreeBonus: number;
  net: number;
  taxes: {
    incomeTax: number;
    solidaritySurcharge: number;
    churchTax: number;
    total: number;
  };
  socialSecurity: {
    health: number;
    pension: number;
    unemployment: number;
    care: number;
    total: number;
  };
  employerContribution: number;
}

export interface AppSettings {
  minWage: number;
  overtimeLimitDaily: number; // 10h
  standardWorkDay: number; // 8h
  restPeriodMin: number; // 11h
}

export interface ScheduledShift {
  id: string;
  userId: string;
  date: string; // ISO
  startTime: string;
  endTime: string;
  notes?: string;
  sector?: string;
  createdAt: any;
}
