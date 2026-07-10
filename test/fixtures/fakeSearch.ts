/**
 * Deterministic stand-in for the researcher's live web-search. Each distinct query returns
 * exactly one NEW unique url; repeat queries return [] (no new results). This lets tests
 * control productive vs. duplicate searches and prove the executor's dedupe branch works.
 */
export interface FakeSearch {
  searchQuery: (q: string) => Promise<Array<{ url: string; text: string }>>;
  readonly calls: number;
  readonly seen: Set<string>;
}

export function makeFakeSearch(): FakeSearch {
  let calls = 0;
  const seen = new Set<string>();

  const searchQuery = async (q: string): Promise<Array<{ url: string; text: string }>> => {
    calls++;
    if (seen.has(q)) return [];
    seen.add(q);
    const url = `https://example.com/${calls}`;
    return [{ url, text: `Result text for ${q}` }];
  };

  return {
    searchQuery,
    get calls() {
      return calls;
    },
    seen,
  };
}
