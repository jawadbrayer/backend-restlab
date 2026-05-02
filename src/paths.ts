import path from 'path'
import os from 'os'
import fs from 'fs'

const dataDir = process.env.RESTLAB_DATA_DIR || path.join(os.homedir(), '.restlab')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

export function getUserDataPath(): string {
  return dataDir
}
