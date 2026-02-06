const CACHE_MAX_SIZE = 100;
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;
  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }
}
const lowerCaseCache = new LRUCache<string, string>(CACHE_MAX_SIZE);
function toLowerCached(name: string): string {
  let lower = lowerCaseCache.get(name);
  if (lower === undefined) {
    lower = name.toLowerCase();
    lowerCaseCache.set(name, lower);
  }
  return lower;
}
export function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = toLowerCached(name);
  for (const key of Object.keys(headers)) {
    if (toLowerCached(key) === lower) {
      return true;
    }
  }
  return false;
}
export function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const lower = toLowerCached(name);
  for (const key of Object.keys(headers)) {
    if (toLowerCached(key) === lower) {
      return headers[key];
    }
  }
  return undefined;
}
export function setHeaderIfAbsent(headers: Record<string, string>, name: string, value: string): boolean {
  if (hasHeader(headers, name)) {
    return false;
  }
  headers[name] = value;
  return true;
}
export function mergeHeaders(...sources: (Record<string, string> | undefined)[]): Record<string, string> {
  const result: Record<string, string> = {};
  const keyMap: Map<string, string> = new Map();
  for (const source of sources) {
    if (!source) continue;
    for (const key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const value = source[key];
      if (value === undefined) continue;
      const lower = toLowerCached(key);
      const existingKey = keyMap.get(lower);
      if (existingKey && existingKey !== key) {
        delete result[existingKey];
      }
      result[key] = value;
      keyMap.set(lower, key);
    }
  }
  return result;
}
