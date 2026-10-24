import { regionsMockData } from '../data/mockData'
import type { RegionRecord } from '../types/regions'

export function getRegions(): RegionRecord[] {
  return regionsMockData
}
