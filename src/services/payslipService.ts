import { GoogleGenAI, Type } from "@google/genai";

export interface ParsedPayslip {
  period: string; // YYYY-MM
  grossAmount: number;
  netAmount: number;
  taxAmount: number;
  socialAmount: number;
  healthIns: number;
  pensionIns: number;
  unemploymentIns: number;
  nursingIns: number;
  hoursWorked: number;
  hourlyRate: number;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parsePayslipText(text: string): Promise<ParsedPayslip> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract the following details from this German payslip text (Lohnabrechnung). 
    Focus on these standard Datev/SAP segments:
    - Period: "Monat/Jahr", "Abrechnungs-Zeitraum" (format YYYY-MM)
    - Gross: "Gesamt-Brutto", "Steuer-Brutto", "Brutto-Bezüge"
    - Net: "Auszahlungsbetrag", "Nettolohn", "Netto-Verdienst"
    - Tax: Sum of "Lohnsteuer", "Solidaritätszuschlag", "Kirchensteuer"
    - Health: "KV-Beitrag" / Krankenversicherung
    - Pension: "RV-Beitrag" / Rentenversicherung
    - Unemployment: "AV-Beitrag" / Arbeitslosenversicherung
    - Nursing: "PV-Beitrag" / Pflegeversicherung
    - Hours: "Gesamtstunden", "Std-Zahl", "Monatsstunden"
    - Hourly Rate: "Satz", "Stundenlohn", "Basis-Lohn"

    RULES:
    1. STRICT: If a value ends with '-' or is in parentheses, return it as a POSITIVE float.
    2. Sum all tax components (LSt + KiSt + Soli) into taxAmount.
    3. Ensure socialAmount is exactly the sum of KV+RV+AV+PV.
    4. If no hourly info, return 160.0 for hours and calculate rate from Gross.
    5. Return 0 for missing fields.

    Return in JSON format.

    Text:
    ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          period: { type: Type.STRING, description: "Year and month as YYYY-MM" },
          grossAmount: { type: Type.NUMBER },
          netAmount: { type: Type.NUMBER },
          taxAmount: { type: Type.NUMBER },
          healthIns: { type: Type.NUMBER },
          pensionIns: { type: Type.NUMBER },
          unemploymentIns: { type: Type.NUMBER },
          nursingIns: { type: Type.NUMBER },
          socialAmount: { type: Type.NUMBER },
          hoursWorked: { type: Type.NUMBER },
          hourlyRate: { type: Type.NUMBER },
        },
        required: ["period", "grossAmount", "netAmount", "taxAmount", "socialAmount", "healthIns", "pensionIns", "unemploymentIns", "nursingIns", "hoursWorked", "hourlyRate"],
      },
    },
  });

  try {
    const result = response.text;
    if (!result) throw new Error("No text returned from Gemini");
    return JSON.parse(result) as ParsedPayslip;
  } catch (e) {
    console.error("Gemini parsing error:", e);
    throw new Error("Failed to parse payslip data. Please check the input text.");
  }
}
