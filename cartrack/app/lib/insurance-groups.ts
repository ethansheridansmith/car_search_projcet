export const INSURANCE_GROUP_LOOKUP: Record<string, { min: number; max: number }> = {
  'BMW 1 Series': { min: 16, max: 22 },
  'BMW 3 Series': { min: 22, max: 32 },
  'BMW 5 Series': { min: 28, max: 40 },
  'BMW 2 Series': { min: 18, max: 28 },
  'Audi A3': { min: 14, max: 25 },
  'Audi A4': { min: 20, max: 30 },
  'Audi A1': { min: 10, max: 20 },
  'Audi A5': { min: 24, max: 35 },
  'Audi A6': { min: 26, max: 38 },
  'CUPRA Formentor': { min: 22, max: 28 },
  'CUPRA Leon': { min: 20, max: 26 },
  'CUPRA Born': { min: 18, max: 24 },
  'SEAT Leon': { min: 13, max: 22 },
  'SEAT Ibiza': { min: 8, max: 16 },
  'SEAT Ateca': { min: 14, max: 22 },
  'Mercedes A Class': { min: 18, max: 28 },
  'Mercedes C Class': { min: 24, max: 34 },
  'Mercedes E Class': { min: 28, max: 38 },
  'Mercedes GLA': { min: 20, max: 30 },
  'Skoda Octavia': { min: 12, max: 24 },
  'Skoda Fabia': { min: 7, max: 14 },
  'Skoda Superb': { min: 20, max: 30 },
  'Skoda Karoq': { min: 14, max: 22 },
  'Toyota C-HR': { min: 13, max: 20 },
  'Toyota Yaris': { min: 6, max: 14 },
  'Toyota Corolla': { min: 12, max: 22 },
  'Toyota RAV4': { min: 16, max: 26 },
  'Honda Civic': { min: 13, max: 21 },
  'Honda Jazz': { min: 8, max: 16 },
  'Honda CR-V': { min: 14, max: 24 },
  'Honda HR-V': { min: 12, max: 20 },
  'Volkswagen Golf': { min: 14, max: 24 },
  'Volkswagen Polo': { min: 8, max: 16 },
  'Volkswagen Passat': { min: 18, max: 28 },
  'Ford Focus': { min: 10, max: 20 },
  'Ford Fiesta': { min: 6, max: 14 },
  'Hyundai i30': { min: 10, max: 18 },
  'Hyundai Tucson': { min: 14, max: 22 },
  'Kia Ceed': { min: 10, max: 18 },
  'Kia Sportage': { min: 14, max: 24 },
  'Mazda CX-5': { min: 14, max: 22 },
  'Mazda 3': { min: 12, max: 20 },
  'Nissan Juke': { min: 10, max: 18 },
  'Nissan Qashqai': { min: 14, max: 22 },
  'Peugeot 308': { min: 10, max: 20 },
  'Peugeot 3008': { min: 14, max: 24 },
  'Renault Clio': { min: 7, max: 15 },
  'Renault Megane': { min: 10, max: 20 },
  'Volvo V40': { min: 16, max: 26 },
  'Volvo XC40': { min: 18, max: 28 },
}

/**
 * Returns the insurance group range for a given make and model.
 * Tries exact "Make Model" match first, then falls back to partial matching.
 */
export function getInsuranceGroupRange(
  make: string,
  model: string
): { min: number; max: number } | null {
  const key = `${make} ${model}`

  // Exact match
  if (INSURANCE_GROUP_LOOKUP[key]) {
    return INSURANCE_GROUP_LOOKUP[key]
  }

  // Partial match — find the first key that starts with "Make Model"
  const partialKey = Object.keys(INSURANCE_GROUP_LOOKUP).find((k) =>
    k.toLowerCase().startsWith(key.toLowerCase())
  )
  if (partialKey) {
    return INSURANCE_GROUP_LOOKUP[partialKey]
  }

  // Fallback: match by make only (return the broadest range across all matching keys)
  const makeKeys = Object.keys(INSURANCE_GROUP_LOOKUP).filter((k) =>
    k.toLowerCase().startsWith(make.toLowerCase())
  )
  if (makeKeys.length > 0) {
    const min = Math.min(...makeKeys.map((k) => INSURANCE_GROUP_LOOKUP[k].min))
    const max = Math.max(...makeKeys.map((k) => INSURANCE_GROUP_LOOKUP[k].max))
    return { min, max }
  }

  return null
}
