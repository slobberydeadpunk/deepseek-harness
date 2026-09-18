/** Install an inherited profile resolution generation in one Harness-owned Worker. */

import { getEnvironmentData } from 'node:worker_threads'
import {
  installProfileResolution,
  type ProfileResolutionBehavior,
  type ProfileResolutionOptions,
} from './resolver.ts'
import type { ProfileResolutionGeneration } from '../profile.ts'

const registration = getEnvironmentData(
  '@deepseek-ai/dsh-app-boot/profile-resolution',
) as {
  generation: ProfileResolutionGeneration
  behavior: ProfileResolutionBehavior
  options?: ProfileResolutionOptions
} | undefined
if (registration !== undefined) {
  installProfileResolution(registration.generation, registration.behavior, registration.options ?? {})
}
