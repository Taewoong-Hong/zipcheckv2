/**
 * Stub file for search-trades module
 *
 * This is a placeholder for v1 functionality.
 * The actual implementation would search trade data with fuzzy matching.
 */

export interface SearchOptions {
  apt?: string;
  jibun?: string;
  fuzzy?: boolean;
  threshold?: number;
  sort?: 'similarity' | 'latest' | 'price';
  limit?: number;
}

export interface TradeItem {
  id?: string;
  lawd_cd: string;
  deal_ymd: string;
  apartment: string;
  dong: string;
  jibun: string;
  exclusive_area: number;
  floor: number;
  deal_amount: number;
  build_year: number;
}

export interface SearchResult {
  items: TradeItem[];
  grouped: Record<string, TradeItem[]>;
}

export function searchTrades(
  data: TradeItem[],
  options: SearchOptions
): SearchResult {
  // Simple stub implementation - just returns filtered data
  let items = [...data];

  if (options.apt) {
    items = items.filter(item =>
      item.apartment?.toLowerCase().includes(options.apt!.toLowerCase())
    );
  }

  if (options.jibun) {
    items = items.filter(item =>
      item.jibun?.includes(options.jibun!)
    );
  }

  if (options.limit) {
    items = items.slice(0, options.limit);
  }

  // Group by apartment name
  const grouped: Record<string, TradeItem[]> = {};
  items.forEach(item => {
    const key = item.apartment || 'unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  return { items, grouped };
}

export default searchTrades;
