import type { BusinessData } from '../domain/types'
import type { BusinessRepository } from './business.repository'

function cloneSnapshot(snapshot: BusinessData): BusinessData {
  return structuredClone(snapshot)
}

export class InMemoryBusinessRepository implements BusinessRepository {
  private readonly seed: BusinessData
  private snapshot: BusinessData

  constructor(seed: BusinessData) {
    this.seed = cloneSnapshot(seed)
    this.snapshot = cloneSnapshot(seed)
  }

  getSnapshot(): BusinessData {
    return cloneSnapshot(this.snapshot)
  }

  saveSnapshot(snapshot: BusinessData): void {
    this.snapshot = cloneSnapshot(snapshot)
  }

  reset(): BusinessData {
    this.snapshot = cloneSnapshot(this.seed)
    return this.getSnapshot()
  }
}
