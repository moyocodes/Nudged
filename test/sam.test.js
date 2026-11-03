import { describe, expect, it } from 'vitest'
import { interpret, readBoxes } from '../server/sam.js'

const done = (text) => [{ type: 'response.output_text.done', text }, { type: 'response.completed' }]

describe('SAM answers', () => {
  it('turns each match into a position on the photo', () => {
    const events = done('<0f>0<|box;x1=100;y1=50;x2=199;y2=99;w=1000;h=500|><|mask;x=0;y=0;data=1,1,~!|>,1<|box;x1=0;y1=0;x2=499;y2=249;w=1000;h=500|>')
    expect(readBoxes(events)).toEqual([
      { left: 0.1, top: 0.1, width: 0.1, height: 0.1 },
      { left: 0, top: 0, width: 0.5, height: 0.5 },
    ])
    expect(interpret(events).found).toBe(true)
  })

  it('has no boxes when nothing matched', () => {
    expect(interpret(done(''))).toEqual({ found: false })
  })
})
