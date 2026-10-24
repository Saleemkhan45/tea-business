export const MAX_OPENING_PRODUCTS = 20
export type RegionalSettingsDraft = { price: string; threshold: string }
export type OpeningProductRow = { key: string; itemId: string; quantity: string; price?: string; threshold?: string }
export function regionalSettingsDraft(draft: RegionalSettingsDraft) {
  const price = draft.price.trim() ? Number(draft.price) : null
  const threshold = draft.threshold.trim() ? Number(draft.threshold) : null
  if (price !== null && (!Number.isSafeInteger(price) || price <= 0)) throw new Error('Region selling price must be a positive whole PKR amount.')
  if (threshold !== null && (!Number.isFinite(threshold) || threshold < 0 || !Number.isSafeInteger(Math.round(threshold * 1000)) || Math.abs(threshold - Math.round(threshold * 1000) / 1000) >= 1e-9)) throw new Error('Region low stock alert must be nonnegative kg with up to three decimals.')
  return { sellingPriceOverride: price, lowStockThresholdOverride: threshold }
}
export function newOpeningRow(): OpeningProductRow {
  return { key: crypto.randomUUID(), itemId: '', quantity: '0', price: '', threshold: '' }
}
export function openingStockDraft(rows: OpeningProductRow[]) {
  if (rows.length > MAX_OPENING_PRODUCTS) throw new Error('Add up to 20 different products.')
  const seen = new Set<string>()
  let totalGrams = 0
  const openingProducts = rows.map((row, index) => {
    if (!row.itemId) throw new Error(`Choose a tea product for row ${index + 1}.`)
    if (seen.has(row.itemId)) throw new Error('Choose each tea product only once.')
    seen.add(row.itemId)
    const quantityKg = Number(row.quantity), grams = Math.round(quantityKg * 1000)
    if (!row.quantity.trim() || !Number.isFinite(quantityKg) || quantityKg < 0 || !Number.isSafeInteger(grams) || Math.abs(quantityKg - grams / 1000) >= 1e-9) throw new Error(`Row ${index + 1}: enter a nonnegative quantity with up to three decimals.`)
    totalGrams += grams
    if (!Number.isSafeInteger(totalGrams)) throw new Error('Total opening quantity exceeds the safe limit.')
    const settings = regionalSettingsDraft({ price: row.price ?? '', threshold: row.threshold ?? '' })
    return { itemId: row.itemId, quantityKg,
      ...(settings.sellingPriceOverride !== null ? { sellingPriceOverride: settings.sellingPriceOverride } : {}),
      ...(settings.lowStockThresholdOverride !== null ? { lowStockThresholdOverride: settings.lowStockThresholdOverride } : {}),
    }
  })
  return { openingProducts, totalKg: totalGrams / 1000, productCount: seen.size }
}
