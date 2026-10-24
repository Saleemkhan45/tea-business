import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RegionalConfigurationFields } from './components/RegionalConfigurationFields'

describe('regional configuration fields', () => {
  it('distinguishes no product, missing defaults, inherited values and overrides', () => {
    const base = { draft: { price: '', threshold: '' }, onChange: vi.fn() }
    expect(renderToStaticMarkup(<RegionalConfigurationFields {...base} selected={false} />)).toContain('No product selected')
    expect(renderToStaticMarkup(<RegionalConfigurationFields {...base} selected />)).toContain('Catalog default: Not configured')
    const inherited = renderToStaticMarkup(<RegionalConfigurationFields {...base} selected catalogPrice={800} catalogThreshold={0} />)
    expect(inherited).toContain('Inherited from catalog: 800 PKR/kg')
    expect(inherited).toContain('Inherited from catalog: 0 kg')
    expect(inherited).not.toContain('readOnly')
    expect(renderToStaticMarkup(<RegionalConfigurationFields {...base} selected draft={{ price: '850', threshold: '50' }} />)).toContain('Overridden for this region')
  })
  it('resets the two overrides to inheritance without changing catalog values', () => {
    const change = vi.fn()
    const tree = RegionalConfigurationFields({ draft: { price: '850', threshold: '50' }, selected: true, catalogPrice: 800, catalogThreshold: 100, onChange: change })
    const reset = tree.props.children[2]
    reset.props.onClick()
    expect(change).toHaveBeenCalledWith({ price: '', threshold: '' })
  })
})
