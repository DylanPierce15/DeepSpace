/**
 * Sports integrations barrel — merges all sport-specific endpoint maps.
 */

import type { EndpointDefinition } from '../_types'
import { endpoints as f1 } from './f1'
import { endpoints as football } from './football'
import { endpoints as basketball } from './basketball'
import { endpoints as americanFootball } from './american-football'
import { endpoints as baseball } from './baseball'

export const endpoints: Record<string, EndpointDefinition> = {
  ...f1,
  ...football,
  ...basketball,
  ...americanFootball,
  ...baseball,
}
