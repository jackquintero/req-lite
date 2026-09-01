export interface QueryParamEntry {
  key: string;
  value: string;
}

export function appendQueryParams(url: string, params: QueryParamEntry[]): string {
  if (params.length === 0) return url;

  const [base, existingQuery = ''] = url.split('?');
  const searchParams = new URLSearchParams(existingQuery);
  for (const { key, value } of params) {
    searchParams.append(key, value);
  }

  const queryString = searchParams.toString();
  return queryString ? `${base}?${queryString}` : base;
}
