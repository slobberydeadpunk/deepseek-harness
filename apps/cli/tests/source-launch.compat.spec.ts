import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

/**
 * Keyless smoke for SOURCE `dsh` execution: run `apps/cli/src/bin.ts`
 * with the exact production runtime vector (`node --import tsx/esm`, the
 * vector the root `dsh` script invokes directly) and assert the
 * required-config diagnostic. The Node compatibility matrix runs this file,
 * so a Node release changing module hooks or TypeScript handling breaks this
 * gate instead of every developer's `pnpm dsh`. Its Node 22 artifact-backed
 * leg also boots the public source command through one real tool round trip;
 * the built-bin suite separately covers the published `lib/` entry.
 */

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const dshSourceBin = join(repoRoot, 'apps/cli/src/bin.ts')
const headlessProfilePatch = join(
  repoRoot,
  'apps/cli/tests/profiles/headless/tests/fixtures/headless-profile.patch.yml',
)
const requireBuiltArtifacts = process.env.DSH_REQUIRE_BUILT_CLI_SMOKE === '1'

describe('dsh SOURCE launcher (node --import tsx/esm)', () => {
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
