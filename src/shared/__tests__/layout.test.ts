import { describe, expect, it } from 'vitest'
import { gridRows, paneposition } from '../layout'

describe('gridRows', () => {
  it('splits launcher counts into 2-column rows', () => {
    expect(gridRows(1)).toEqual([1])
    expect(gridRows(2)).toEqual([2])
    expect(gridRows(4)).toEqual([2, 2])
    expect(gridRows(6)).toEqual([2, 2, 2])
    expect(gridRows(8)).toEqual([2, 2, 2, 2])
  })

  it('puts full rows first for odd live counts', () => {
    expect(gridRows(3)).toEqual([2, 1])
    expect(gridRows(5)).toEqual([2, 2, 1])
    expect(gridRows(7)).toEqual([2, 2, 2, 1])
  })

  it('keeps 2-column rows past 8 panes', () => {
    expect(gridRows(9)).toEqual([2, 2, 2, 2, 1])
    expect(gridRows(10)).toEqual([2, 2, 2, 2, 2])
  })

  it('handles empty', () => {
    expect(gridRows(0)).toEqual([])
  })

  it('fills rows to explicit column widths', () => {
    expect(gridRows(4, 3)).toEqual([3, 1])
    expect(gridRows(6, 3)).toEqual([3, 3])
    expect(gridRows(8, 4)).toEqual([4, 4])
    expect(gridRows(5, 1)).toEqual([1, 1, 1, 1, 1])
    expect(gridRows(2, 4)).toEqual([2])
    expect(gridRows(4, null)).toEqual([2, 2])
  })
})

describe('paneposition', () => {
  it('maps indexes across rows', () => {
    expect(paneposition(5, 0)).toEqual({ row: 0, col: 0 })
    expect(paneposition(5, 2)).toEqual({ row: 1, col: 0 })
    expect(paneposition(5, 3)).toEqual({ row: 1, col: 1 })
    expect(paneposition(5, 4)).toEqual({ row: 2, col: 0 })
  })
})
