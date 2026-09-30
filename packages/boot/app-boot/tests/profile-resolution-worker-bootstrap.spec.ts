/** Worker bootstrap installs only the resolution inherited from its parent. */

import { beforeEach, expect, it, vi } from 'vitest'
import type { RuntimeResolution } from '../src/profile.ts'

const harness = vi.hoisted(() => ({
  data: undefined as {
    resolution: RuntimeResolution
    options?: { sourceRoot?: string }
  } | undefined,
  install: vi.fn(),
}))

vi.mock('node:worker_threads', () => ({
  getEnvironmentData: () => harness.data,
}))

vi.mock('../src/profile-resolution/resolver.ts', () => ({
  installRuntimeInterception: harness.install,
}))

beforeEach(() => {
  harness.data = undefined
  harness.install.mockReset()
  vi.resetModules()
})

it('does nothing without inherited profile resolution data', async () => {
  await import('../src/profile-resolution/worker-bootstrap.ts')
  expect(harness.install).not.toHaveBeenCalled()
})

it('installs the inherited resolution', async () => {
  const resolution: RuntimeResolution = {
    profilesDir: '/profiles',
    profileDir: '/profiles/test',
    localPackageNames: [],
    linkedRoots: [],
    entries: [],
  }
  harness.data = { resolution }
  await import('../src/profile-resolution/worker-bootstrap.ts')
  expect(harness.install).toHaveBeenCalledWith(resolution, {})
})

it('installs inherited source routing with the resolution', async () => {
  const resolution: RuntimeResolution = {
    profilesDir: '/profiles',
    profileDir: '/profiles/test',
    localPackageNames: [],
    linkedRoots: [],
    entries: [],
  }
  const options = { sourceRoot: '/workspace' }
  harness.data = { resolution, options }
  await import('../src/profile-resolution/worker-bootstrap.ts')
  expect(harness.install).toHaveBeenCalledWith(resolution, options)
})
