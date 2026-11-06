/// <reference lib="webworker" />
import structure from '@/data/kisii-structure.json'
import { generateDataset, type KisiiStructure } from '@/data/generate'

/** Builds the demo dataset off the main thread so the page stays responsive while it loads. */
self.onmessage = (e: MessageEvent<{ ackTimeoutSeconds: number }>) => {
  const data = generateDataset(structure as KisiiStructure, { ackTimeoutSeconds: e.data.ackTimeoutSeconds })
  ;(self as unknown as Worker).postMessage(data)
}
