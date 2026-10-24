import type { BusinessData } from '../domain/types'

export interface BusinessRepository {
  getSnapshot(): BusinessData
  saveSnapshot(snapshot: BusinessData): void
  reset(): BusinessData
}
