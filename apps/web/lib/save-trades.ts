/**
 * Stub file for save-trades module
 *
 * This is a placeholder for v1 functionality.
 * The actual implementation would save trade data to the database.
 */

export interface TradeData {
  // Allow any structure since this is a stub
  [key: string]: any;
}

export async function saveAptTrades(lawdCd: string, trades: TradeData[]): Promise<{ saved: number }> {
  console.warn('[save-trades] Stub function called - no data saved');
  return { saved: 0 };
}

export async function saveTrades(trades: TradeData[]): Promise<{ saved: number }> {
  console.warn('[save-trades] Stub function called - no data saved');
  return { saved: 0 };
}

export default saveTrades;
