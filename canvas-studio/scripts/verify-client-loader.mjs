import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const artifact = new URL('../lib/client.js', import.meta.url)
const registrations = []
const window = {
  __ModuleLoader__: {
    load(registration) {
      registrations.push(registration)
    },
  },
}

runInNewContext(readFileSync(artifact, 'utf8'), { window }, {
  filename: artifact.pathname,
})

if (registrations.length !== 1) {
  throw new Error(`canvas-studio client registered ${String(registrations.length)} Loader modules`)
}
const [registration] = registrations
if (registration?.id !== 'canvas-studio' || typeof registration.factory !== 'function') {
  throw new Error('canvas-studio client did not register the expected Loader module')
}

process.stdout.write('verify-canvas-studio-loader: canvas-studio registered one client module\n')