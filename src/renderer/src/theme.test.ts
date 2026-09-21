import { describe, expect, it } from 'vitest'
import { DOT_COLORS, cardInk, mixSrgb, palettes, relativeLuminance } from './theme'

const DARK = palettes.dark.chrome.bgSubtle // #000000
const LIGHT = palettes.light.chrome.bgSubtle // #f6f8fa
const YELLOW = '#fcf305'
const BLUE = '#0000d4'

describe('mixSrgb', () => {
  it('mixes each channel the way color-mix(in srgb) does', () => {
    // Half of yellow's #05 blue channel is 2.5, and Math.round takes it up —
    // the direction Chromium serialises a half-step in too.
    expect(mixSrgb(YELLOW, DARK, 0.5)).toBe('#7e7a03')
    expect(mixSrgb(YELLOW, LIGHT, 0.5)).toBe('#f9f680')
  })

  it('is the colour itself at 100% and the ground at 0%', () => {
    expect(mixSrgb(YELLOW, DARK, 1)).toBe(YELLOW)
    expect(mixSrgb(YELLOW, LIGHT, 0)).toBe(LIGHT)
  })
})

describe('relativeLuminance', () => {
  it('lands on the WCAG endpoints', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
  })

  it('reads yellow as the lightest entry in the palette', () => {
    const lightest = [...DOT_COLORS].sort(
      (a, b) => relativeLuminance(b.hex) - relativeLuminance(a.hex)
    )[0]
    expect(lightest.name).toBe('yellow')
  })
})

describe('cardInk', () => {
  // The bug this exists for: at 100% the card IS the palette entry, and white
  // ink on yellow is 1.01:1.
  it('flips a full-wash yellow card to the light palette ink on the dark ground', () => {
    expect(cardInk(YELLOW, 1, DARK, 'dark')).toBe('light')
  })

  it('keeps the dark palette ink once the same yellow is washed down', () => {
    expect(cardInk(YELLOW, 0.5, DARK, 'dark')).toBe('dark')
    expect(cardInk(YELLOW, 0.1, DARK, 'dark')).toBe('dark')
  })

  // The mirror nobody had hit: dark ink on a full-wash blue card in light mode.
  it('flips a full-wash blue card to the dark palette ink on the light ground', () => {
    expect(cardInk(BLUE, 1, LIGHT, 'light')).toBe('dark')
  })

  it('leaves every colour on the live ink at the low washes', () => {
    for (const { hex } of DOT_COLORS) {
      expect(cardInk(hex, 0.1, DARK, 'dark')).toBe('dark')
      expect(cardInk(hex, 0.1, LIGHT, 'light')).toBe('light')
    }
  })

  // Which of the eight are so light at full wash that white ink has vanished on
  // them — the list is the point, not the mechanism: it says exactly which
  // cards change, and the four that were flipped by "whichever has more
  // contrast" and are not flipped by "unless it has vanished" are the reason
  // the floor exists.
  it('flips yellow and only yellow at full wash on the dark ground', () => {
    const flipped = DOT_COLORS.filter(({ hex }) => cardInk(hex, 1, DARK, 'dark') === 'light')
    expect(flipped.map((c) => c.name)).toEqual(['yellow'])
  })

  // White reads on all four at 2.2:1 and up; black would read better, and
  // flipping them anyway was the bug.
  it('keeps white ink on the cards where it is merely low, not gone', () => {
    for (const name of ['green', 'pink', 'orange', 'cyan']) {
      const hex = DOT_COLORS.find((c) => c.name === name)!.hex
      expect(cardInk(hex, 1, DARK, 'dark')).toBe('dark')
    }
  })

  it('flips the two lightest-ink cases and only those on the light ground', () => {
    const flipped = DOT_COLORS.filter(({ hex }) => cardInk(hex, 1, LIGHT, 'light') === 'dark')
    expect(flipped.map((c) => c.name)).toEqual(['blue', 'purple'])
  })

  it('falls back to the ground when a group has no colour yet', () => {
    expect(cardInk(undefined, 1, DARK, 'dark')).toBe('dark')
    expect(cardInk(undefined, 1, LIGHT, 'light')).toBe('light')
    expect(cardInk('not-a-hex', 1, DARK, 'dark')).toBe('dark')
  })
})
