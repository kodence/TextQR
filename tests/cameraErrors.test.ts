import { describe, expect, it } from 'vitest'
import { describeCameraError } from '../src/ui/cameraErrors'

function domError(name: string, message = '') {
  const e = new Error(message)
  e.name = name
  return e
}

describe('describeCameraError', () => {
  it('explains a denied permission', () => {
    expect(describeCameraError(domError('NotAllowedError'))).toMatch(/denied/i)
  })
  it('explains a missing camera', () => {
    expect(describeCameraError(domError('NotFoundError'))).toMatch(/no camera/i)
    expect(describeCameraError(domError('OverconstrainedError'))).toMatch(/no camera/i)
  })
  it('explains a busy camera', () => {
    expect(describeCameraError(domError('NotReadableError'))).toMatch(/in use/i)
  })
  it('falls back to the raw message for unknown errors', () => {
    expect(describeCameraError(domError('WeirdError', 'boom'))).toContain('boom')
    expect(describeCameraError('not an error')).toMatch(/could not start/i)
  })
})
