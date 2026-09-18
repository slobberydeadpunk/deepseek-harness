/** Worker bootstrap installs only the generation inherited from its parent. */

import { beforeEach, expect, it, vi } from 'vitest'
import type { ProfileResolutionGeneration } from '../src/profile.ts'

const harness = vi.hoisted(() => ({
  data: undefined as {
    generation: ProfileResolutionGeneration
    behavior: 'enforce' | 'verify'
    options?: { sourceRoot?: string }
  } | undefined,
  install: vi.fn(),
}))

vi.mock('node:worker_threads', () => ({
  getEnvironmentData: () => harness.data,
}))

vi.mock('../src/profile-resolution/resolver.ts', () => ({
  installProfileResolution: harness.install,
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

it('installs the inherited generation, behavior, and source routing', async () => {
  const generation: ProfileResolutionGeneration = {
    profilesDir: '/profiles',
    profileDir: '/profiles/test',
    localPackageNames: [],
    entries: [],
  }
  const options = { sourceRoot: '/workspace' }
  harness.data = { generation, behavior: 'verify', options }
  await import('../src/profile-resolution/worker-bootstrap.ts')
  expect(harness.install).toHaveBeenCalledWith(generation, 'verify', options)
})

it('defaults source routing for generation data published without it', async () => {
  const generation: ProfileResolutionGeneration = {
    profilesDir: '/profiles',
    profileDir: '/profiles/test',
    localPackageNames: [],
    entries: [],
  }
  harness.data = { generation, behavior: 'enforce' }
  await import('../src/profile-resolution/worker-bootstrap.ts')
  expect(harness.install).toHaveBeenCalledWith(generation, 'enforce', {})
})
