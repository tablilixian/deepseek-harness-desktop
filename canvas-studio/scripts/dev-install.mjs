import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * Install the built bundle into a profile through the dsh CLI.
 * Usage: node scripts/dev-install.mjs [profile] [--remove]
 * The dsh binary resolves from the dsh installation on PATH; the desktop
 * product ships it inside the Electron bundle (`desktopPnpm`), where the
 * desktop terminal's `dsh plugin` equivalent applies.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const remove = args.includes('--remove')
const profile = args.find((arg) => !arg.startsWith('--')) ?? 'desktop'

const verb = remove ? 'remove' : 'add'
const spec = remove ? 'canvas-studio' : resolve(root)

execFileSync('dsh', ['plugin', '--profile', profile, verb, spec], {
  stdio: 'inherit',
})
process.stdout.write(`canvas-studio: ${verb} ${spec} → profile ${profile}\n`)