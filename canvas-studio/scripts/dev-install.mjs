import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * One-stop dev install: build the package, then wire it into a desktop
 * profile (dependency + `dsh.profile.bundles` row + pnpm link). Idempotent —
 * safe to re-run after every clone/pull.
 *
 * Usage:
 *   node scripts/dev-install.mjs [profile] [--remove] [--skip-build]
 *
 * Why not `dsh plugin add`: the CLI forwards pnpm v10 while desktop profiles
 * use the pnpm v11 store (handoff §4.8), so this script performs the two
 * documented steps directly — edit the profile manifest, then run
 * `corepack pnpm@11.7.0 install` inside the profile directory.
 */

const PLUGIN_NAME = 'canvas-studio'
const BASE_BUNDLE = '@deepseek-ai/dsh-base'
const WEB_BUNDLE = '@deepseek-ai/dsh-web-app'
/** Desktop profiles are maintained by the shell's pnpm v11 (store v11). */
const PNPM_SPEC = 'pnpm@11.7.0'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(root, '..')
const args = process.argv.slice(2)
const remove = args.includes('--remove')
const skipBuild = args.includes('--skip-build')
const profile = args.find((arg) => !arg.startsWith('--')) ?? 'desktop'

const dshHome = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
  ? resolve(process.env.DSH_HOME)
  : join(homedir(), '.dsh')
const profileDir = join(dshHome, 'profiles', profile)
const manifestPath = join(profileDir, 'package.json')

function fail(message) {
  process.stderr.write(`dev-install: ${message}\n`)
  process.exit(1)
}

function run(command, commandArgs, cwd) {
  execFileSync(command, commandArgs, { cwd, stdio: 'inherit' })
}

if (!skipBuild) {
  process.stdout.write(`dev-install: building ${PLUGIN_NAME}...\n`)
  run('corepack', ['yarn', 'workspace', PLUGIN_NAME, 'build'], repoRoot)
}

if (!existsSync(manifestPath)) {
  const known = existsSync(join(dshHome, 'profiles'))
    ? readdirSyncSafe(join(dshHome, 'profiles')).join(', ') || '(none)'
    : '(no profiles directory)'
  fail(`profile "${profile}" not found at ${profileDir} (known profiles: ${known})`)
}

let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch (cause) {
  fail(`profile manifest is not valid JSON: ${manifestPath} (${cause.message})`)
}
if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
  fail(`profile manifest is not an object: ${manifestPath}`)
}
manifest.dsh ??= {}
manifest.dsh.profile ??= {}
const bundles = manifest.dsh.profile.bundles
if (!Array.isArray(bundles) || bundles.some((entry) => typeof entry !== 'string')) {
  fail(`dsh.profile.bundles must be a string array in ${manifestPath}`)
}

if (remove) {
  manifest.dsh.profile.bundles = bundles.filter((entry) => entry !== PLUGIN_NAME)
  if (manifest.dependencies !== null && typeof manifest.dependencies === 'object') {
    delete manifest.dependencies[PLUGIN_NAME]
  }
  process.stdout.write(`dev-install: removing ${PLUGIN_NAME} from profile ${profile}\n`)
} else {
  if (!bundles.includes(PLUGIN_NAME)) {
    // Bundle order matters (rows load in sequence): keep the plugin right
    // after the web app when present, otherwise append.
    const webIndex = bundles.indexOf(WEB_BUNDLE)
    if (webIndex === -1 && !bundles.includes(BASE_BUNDLE)) {
      process.stdout.write(`dev-install: warning - profile ${profile} has no ${BASE_BUNDLE} row\n`)
    }
    bundles.splice(webIndex === -1 ? bundles.length : webIndex + 1, 0, PLUGIN_NAME)
  }
  manifest.dependencies ??= {}
  manifest.dependencies[PLUGIN_NAME] = `link:${root}`
  process.stdout.write(`dev-install: linking ${PLUGIN_NAME} into profile ${profile}\n`)
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
run('corepack', [PNPM_SPEC, 'install'], profileDir)
process.stdout.write(`dev-install: done (${remove ? 'removed' : 'installed'}; restart the app to load ${remove ? 'without' : 'with'} ${PLUGIN_NAME})\n`)

function readdirSyncSafe(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}
