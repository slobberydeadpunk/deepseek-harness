import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'
import { testProfileResolution } from './profiles/headless/tests/profile-resolution.ts'

/**
 * Keyless source-launch and profile-resolution checks through the production
 * tsx ESM-only entry. The Node compatibility matrix runs this file without a
 * build; source tool execution with native/generated dependencies belongs to
 * the build-backed source-tool suite. When built CLI artifacts are required,
 * this file also checks that configured plugins and tool consumers stay on
 * one source module plane.
 */

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const dshSourceBin = join(repoRoot, 'apps/cli/src/bin.ts')
const headlessProfilePatch = join(
  repoRoot,
  'apps/cli/tests/profiles/headless/tests/fixtures/headless-profile.patch.yml',
)
const requireBuiltArtifacts = process.env.DSH_REQUIRE_BUILT_CLI_SMOKE === '1'

describe('dsh SOURCE launcher (node --import tsx/esm)', () => {
  testProfileResolution('src')

  it('launches the source CLI without building', async () => {
    const rootPackage = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8')) as {
      readonly scripts?: Record<string, string>
    }
    expect(rootPackage.scripts?.dsh).toBe('node --import tsx/esm apps/cli/src/bin.ts')
  })

  it('boots the source entry and requires a profile', async () => {
    const result = await execa(process.execPath, ['--import', 'tsx/esm', dshSourceBin], {
      cwd: repoRoot,
      input: '',
      timeout: 25_000,
      killSignal: 'SIGKILL',
      reject: false,
    })
    if (result.timedOut) {
      throw new Error(`dsh source launch did not exit within 25s. stdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
    }
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('--profile <name> is required')
    expect(result.stdout).toBe('')
  }, 30_000)

  it.runIf(requireBuiltArtifacts)('keeps configured plugins and tool consumers on one source module plane', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-source-profile-'))
    try {
      const result = await execa(process.execPath, [
        '--import',
        'tsx/esm',
        dshSourceBin,
        '--profile',
        'headless',
        '--patch',
        headlessProfilePatch,
        '--json',
        'prove the tool path',
      ], {
        cwd: repoRoot,
        env: {
          ...process.env,
          DEEPSEEK_API_KEY: 'dsh-source-launch-smoke',
          DSH_HOME: home,
          DSH_TELEMETRY_DISABLED: '1',
        },
        input: '',
        timeout: 60_000,
        killSignal: 'SIGKILL',
        reject: false,
      })
      if (result.timedOut) {
        throw new Error(`dsh source profile did not exit within 60s. stdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
      }
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('CLI_TOOL_ROUND_TRIP')
      expect(result.stderr).not.toContain("Cannot read properties of undefined (reading 'prepare')")
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  }, 70_000)
})
