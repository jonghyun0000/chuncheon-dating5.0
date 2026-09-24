type Chunk = { type: 'chunk'; isEntry: boolean; code: string; imports: string[] };
type Bundle = Record<string, Chunk | { type: 'asset' }>;
export const INITIAL_JS_BUDGET: number;
export function checkInitialJsBudget(bundle: Bundle, limit?: number): { gzipBytes: number; files: string[] };
