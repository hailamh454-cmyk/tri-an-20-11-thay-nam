/**
 * js/blackHoleSequence.js
 * Root forwarder to js/physics/blackHoleSupernova.js
 */

import { FORMULA_CATALOG } from './engine/formulaCatalog.js';

export * from './physics/blackHoleSupernova.js';
export { BlackHoleSupernova, default } from './physics/blackHoleSupernova.js';
export const PHYSICS_FORMULAS_85 = FORMULA_CATALOG.map(f => f.name);

