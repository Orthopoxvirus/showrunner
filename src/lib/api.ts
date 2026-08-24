// The persistence facade lives in backend.ts (bridge vs. standalone FSA);
// this re-export keeps the historical `import { api } from '../lib/api'` path.
export { api } from './backend'
