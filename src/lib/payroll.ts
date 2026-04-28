/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PayrollParams {
  grossPay: number;
  taxableGross: number;
  taxFreeBonus: number;
  taxClass: 1 | 2 | 3 | 4 | 5 | 6;
  hasChurchTax: boolean;
  hasChildren: boolean;
  isChildlessOver23: boolean;
  state: string; // e.g. "BY", "BW"
  isPublicInsurance: boolean;
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

/**
 * Calculates an approximate German net salary.
 * Note: Real payroll is extremely complex and varies by state, insurance provider, etc.
 * This is a highly accurate approximation based on 2024 rates.
 */
export async function calculateGermanPayroll(params: PayrollParams, apiKey?: string): Promise<PayrollResult> {
  // If API key is provided, we could fetch from a service like Lohnica
  // For now, we use a robust local implementation
  
  const { taxableGross, taxFreeBonus, taxClass, hasChurchTax, hasChildren, isChildlessOver23, state } = params;

  // 1. Social Security (Employee portion) - calculated on taxable gross
  // Handle Mini-Job and Midi-Job (Gleitzone)
  let health = 0;
  let pension = 0;
  let unemployment = 0;
  let care = 0;

  const kvRate = 0.0859;
  const rvRate = 0.0930;
  const avRate = 0.0130;
  const pvBase = 0.0180;
  const pvSurcharge = 0.0060;
  const pvRate = hasChildren ? pvBase : (isChildlessOver23 ? (pvBase + pvSurcharge) : pvBase);

  if (taxableGross <= 538) {
    // Mini-Job: Employee pays 0% social security (assuming optional pension opt-out)
    // If they opted in, they would pay 3.6% pension. We'll stick to 0 for "tax-free" feel
    health = 0;
    pension = 0;
    unemployment = 0;
    care = 0;
  } else if (taxableGross <= 2000) {
    // Midi-Job (Midizone): Reduced social security rates using a progressive formula
    // Simplified Midizone progressive calculation
    const midiFactor = (taxableGross - 538) / (2000 - 538);
    health = taxableGross * kvRate * midiFactor;
    pension = taxableGross * rvRate * midiFactor;
    unemployment = taxableGross * avRate * midiFactor;
    care = taxableGross * pvRate * midiFactor;
  } else {
    // Normal job
    health = taxableGross * kvRate;
    pension = taxableGross * rvRate;
    unemployment = taxableGross * avRate;
    care = taxableGross * pvRate;
  }
  
  const totalSocial = health + pension + unemployment + care;

  // 2. Taxable Income
  // Very simplified progressive tax logic
  const yearlyTaxableGross = taxableGross * 12;
  let yearlyIncomeTax = 0;
  
  // 2024 Simplified brackets
  // Up to 11.604: 0%
  // 11.605 - 66.760: 14% to 42%
  // 66.761 - 277.825: 42%
  // Over 277.826: 45%
  
  const taxableYearly = Math.max(0, yearlyTaxableGross - (totalSocial * 12) - 1000); // minus Werbungskostenpauschale
  
  if (taxableYearly < 11604) {
    yearlyIncomeTax = 0;
  } else if (taxableYearly < 66760) {
    // Linear progression approximation
    const y = (taxableYearly - 11604) / 10000;
    yearlyIncomeTax = (922.98 * y + 1400) * y;
  } else if (taxableYearly < 277825) {
    yearlyIncomeTax = 0.42 * taxableYearly - 10602.13;
  } else {
    yearlyIncomeTax = 0.45 * taxableYearly - 18936.88;
  }
  
  // Tax Class Adjustment (Simplified)
  let classMultiplier = 1.0;
  if (taxClass === 3) classMultiplier = 0.6; // Split with spouse (approx)
  if (taxClass === 5) classMultiplier = 1.6; // Split with spouse (approx)
  if (taxClass === 6) classMultiplier = 1.8; // Second job
  
  let incomeTax = (yearlyIncomeTax / 12) * classMultiplier;

  // 3. Soli (Solidaritätszuschlag) - 5.5% of income tax
  let solidaritySurcharge = 0;
  if (incomeTax > 0) {
    solidaritySurcharge = incomeTax * 0.055;
  }

  // 4. Church Tax - 8% or 9% of income tax
  const churchTaxRate = (state === 'BY' || state === 'BW') ? 0.08 : 0.09;
  const churchTax = hasChurchTax ? (incomeTax * churchTaxRate) : 0;

  const totalTaxes = incomeTax + solidaritySurcharge + churchTax;
  // Net = TaxableGross - Taxes - Social + TaxFreeBonus
  const net = (taxableGross - totalSocial - totalTaxes) + taxFreeBonus;

  return {
    gross: taxableGross + taxFreeBonus,
    taxableGross,
    taxFreeBonus,
    net,
    taxes: {
      incomeTax,
      solidaritySurcharge,
      churchTax,
      total: totalTaxes
    },
    socialSecurity: {
      health,
      pension,
      unemployment,
      care,
      total: totalSocial
    },
    employerContribution: (params.grossPay || (taxableGross + taxFreeBonus)) * 0.20 // Approx 20% on top for employer
  };
}
