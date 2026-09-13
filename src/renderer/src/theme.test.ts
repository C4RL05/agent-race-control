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
    expect(cardInk(YELLOW, 1, DARK)).toBe('light')
  })

  it('keeps the dark palette ink once the same yellow is washed down', () => {
    expect(cardInk(YELLOW, 0.5, DARK)).toBe('dark')
    expect(cardInk(YELLOW, 0.1, DARK)).toBe('dark')
  })

  // The mirror nobody had hit: dark ink on a full-wash blue card in light mode.
  it('flips a full-wash blue card to the dark palette ink on the light ground', () => {
    expect(cardInk(BLUE, 1, LIGHT)).toBe('dark')
  })

  it('leaves every colour on the live ink at the low washes', () => {
    for (const { hex } of DOT_COLORS) {
      expect(cardInk(hex, 0.1, DARK)).toBe('dark')
      expect(cardInk(hex, 0.1, LIGHT)).toBe('light')
    }
  })

  // Which of the eight are light enough at full wash to need the flip — the
  // list is the point, not the mechanism: it says exactly which cards change.
  it('flips five of the eight at full wash on the dark ground', () => {
    const flipped = DOT_COLORS.filter(({ hex }) => cardInk(hex, 1, DARK) === 'light')
    expect(flipped.map((c) => c.name)).toEqual(['green', 'pink', 'orange', 'cyan', 'yellow'])
  })

  it('falls back to the ground when a group has no colour yet', () => {
    expect(cardInk(undefined, 1, DARK)).toBe('dark')
    expect(cardInk(undefined, 1, LIGHT)).toBe('light')
    expect(cardInk('not-a-hex', 1, DARK)).toBe('dark')
  })
})
