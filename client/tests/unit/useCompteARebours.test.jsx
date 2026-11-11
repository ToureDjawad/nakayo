import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCompteARebours } from '../../src/lib/useCompteARebours.js'

describe('useCompteARebours()', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('décompte seconde par seconde jusqu’à zéro', () => {
    const { result } = renderHook(() => useCompteARebours())
    expect(result.current[0]).toBe(0)

    act(() => result.current[1](3))
    expect(result.current[0]).toBe(3)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current[0]).toBe(2)
    act(() => vi.advanceTimersByTime(1000))
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current[0]).toBe(0)
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current[0]).toBe(0)
  })
})
