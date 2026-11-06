import structure from '@/data/kisii-structure.json'
import { generateDataset, type KisiiStructure } from '@/data/generate'
import { createLookup } from '@/core/hierarchy'
import { computeClaims, type Principal } from '@/core/permissions'
import type { User } from '@/types'

export const NOW = new Date('2026-11-06T09:00:00Z')
export const dataset = generateDataset(structure as KisiiStructure, { now: NOW })
export const lookup = createLookup(dataset)
export const user = (uid: string) => dataset.users.find((u) => u.uid === uid)!
export function principal(u: User | string, now = NOW): Principal {
  const usr = typeof u === 'string' ? user(u) : u
  return {
    uid: usr.uid,
    isActive: usr.isActive,
    claims: computeClaims(usr, dataset.leadershipPositions.filter((p) => p.userId === usr.uid), now),
  }
}
export const bscs = dataset.courses.find((c) => c.code === 'BSCS')!
export const comp210 = dataset.units.find((u) => u.code === 'COMP 210')!
