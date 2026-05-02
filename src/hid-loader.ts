import fs from 'fs'
import os from 'os'
import path from 'path'
import { createRequire } from 'module'

let _hid: typeof import('node-hid')

export function getHID(): typeof import('node-hid') {
  if (_hid) return _hid

  const _require = createRequire(__filename)

  try {
    const sea = _require('node:sea')

    if (sea.isSea && sea.isSea()) {
      // Extract embedded .node to tmp
      const asset = sea.getRawAsset('HID_hidraw.node')
      const outPath = path.join(os.tmpdir(), 'HID_hidraw.node')

      if (!fs.existsSync(outPath)) {
        fs.writeFileSync(outPath, new Uint8Array(asset))
      }

      // Load the raw C++ binding directly
      const binding = _require(outPath)

      // Manually construct the same exports shape as node-hid
      // so the rest of the code works unchanged
      _hid = {
        HID: binding.HID,
        HIDAsync: binding.HIDAsync,
        devices: (...args: any[]) => binding.devices(...args),
        devicesAsync: (...args: any[]) => binding.devicesAsync(...args),
        setDriverType: () => {},
        getHidapiVersion: () => binding.hidapiVersion,
      } as unknown as typeof import('node-hid')

      console.log('[HID] Loaded via SEA asset')
    } else {
      throw new Error('not-sea')
    }
  } catch (e: any) {
    if (e?.message !== 'not-sea') {
      console.warn('[HID] SEA load failed:', e?.message)
    }
    _hid = _require('node-hid')
    console.log('[HID] Loaded from node_modules')
  }

  return _hid
}
