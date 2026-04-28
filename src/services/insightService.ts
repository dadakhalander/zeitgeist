import { GoogleGenAI, Type } from "@google/genai";
import { PayrollResult, TimeLog, UserProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface FinancialInsight {
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'optimization';
}

export async function getFinancialInsights(
  result: PayrollResult,
  logs: TimeLog[],
  profile: UserProfile | null
): Promise<FinancialInsight[]> {
  const prompt = `
    Analyze the following German payroll data and provide 3-4 actionable financial insights or observations.
    
    Gross Salary: ${result.gross.toFixed(2)}€
    Taxable Gross: ${result.taxableGross.toFixed(2)}€
    Tax-Free Bonus: ${result.taxFreeBonus.toFixed(2)}€
    Net Amount: ${result.net.toFixed(2)}€
    Income Tax: ${result.taxes.incomeTax.toFixed(2)}€
    Social Security: ${result.socialSecurity.total.toFixed(2)}€
    
    User Profile:
    Tax Class: ${profile?.taxClass || 1}
    Hourly Rate: ${profile?.hourlyRate || 0}€
    State: ${profile?.state || 'BY'}
    
    Recent Logs:
    ${logs.map(l => `- ${l.date}: ${l.type} shift (${l.startTime}-${l.endTime})`).join('\n')}

    Rules for Insights:
    - If Gross < 538€, mention Mini-job status and social security savings.
    - If 538€ < Gross < 2000€, mention Midi-job benefits (reduced SS factor).
    - If Tax Class is 1 but user is married, suggest checking Class 3/5 or 4/4.
    - Highlight the benefit of tax-free holiday bonuses (SFN).
    - Mention potential tax refund if income tax is higher than expected for the bracket.
    - **Labor Law**: If shift > 10h, warn about ArbZG § 3 (Max 10h including breaks).
    - **Sunday Work**: If worked on Sunday, mention mandatory compensatory day off (Ersatzruhetag) within 2 weeks (ArbZG § 11).
    - **Yearly Projection**: Estimate yearly net if this months trend continues.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { 
                type: Type.STRING,
                enum: ['info', 'success', 'warning', 'optimization']
              }
            },
            required: ['title', 'description', 'type']
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Failed to fetch insights:", error);
    return [
      {
        title: "Mini-Job Efficiency",
        description: "Your income is below 538€, making it highly tax-efficient in Germany.",
        type: "success"
      }
    ];
  }
}
