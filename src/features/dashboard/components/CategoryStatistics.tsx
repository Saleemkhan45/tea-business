import { useState, type CSSProperties } from 'react'
import { Building2, ChartNoAxesCombined, ShoppingBag, Truck } from 'lucide-react'
import { Panel } from '../../../components/shared'
import type { CategoryStatistic } from '../types/dashboard'

type CategoryStatisticsProps = { categories: CategoryStatistic[] }
const categoryIcons = [ShoppingBag, Building2, Truck]

function getTooltipPosition(start: number, percent: number) {
  const angle = ((start + percent / 2) / 100) * Math.PI * 2 - Math.PI / 2
  const radius = 66
  return {
    '--tooltip-x': `${((80 + Math.cos(angle) * radius) / 160) * 100}%`,
    '--tooltip-y': `${((80 + Math.sin(angle) * radius) / 160) * 100}%`,
  } as CSSProperties
}

export function CategoryStatistics({ categories }: CategoryStatisticsProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const visibleCategories = categories
  const totalOrders = visibleCategories.reduce((sum, category) => sum + category.orders, 0)
  const activeCategory = activeIndex === null ? null : visibleCategories[activeIndex] ?? null
  const chartLabel = visibleCategories.map(category => `${category.label} ${category.percent}%`).join(', ')
  let segmentStart = 0

  return <Panel className="category-statistics-panel">
    <div className="panel-heading">
      <div className="panel-title-row"><span className="panel-title-icon"><ChartNoAxesCombined size={16} /></span><h2>Tea Type Breakdown</h2></div>
      <span>Selected period and region</span>
    </div>
    {categories.length === 0 && <p role="status">No sales recorded for this period.</p>}<div className="category-donut-wrap" onMouseLeave={() => setActiveIndex(null)}>
      <div className="category-donut">
        <svg viewBox="0 0 160 160" role="group" aria-label={`Tea type share: ${chartLabel}`}>
          <circle className="category-donut-track" cx="80" cy="80" r="56" pathLength="100" />
          {visibleCategories.map((category, index) => {
            const start = segmentStart
            segmentStart += category.percent
            return <circle
              className={`category-donut-segment${activeIndex === index ? ' is-active' : ''}`}
              cx="80"
              cy="80"
              fill="none"
              key={category.label}
              onBlur={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
              pathLength="100"
              r="56"
              role="img"
              aria-label={`${category.label}: ${category.percent}%, ${category.orders.toLocaleString()} orders`}
              stroke={category.color}
              strokeDasharray={`${category.percent} ${100 - category.percent}`}
              strokeDashoffset={-start}
              tabIndex={0}
            />
          })}
        </svg>
        <div className="category-donut-inner" aria-live="polite">
          {activeCategory ? <><span>{activeCategory.label}</span><strong>{activeCategory.percent}%</strong></> : <><strong>{totalOrders.toLocaleString()}</strong><span>Total orders</span></>}
        </div>
        {activeCategory && <div className="category-chart-tooltip" style={getTooltipPosition(visibleCategories.slice(0, activeIndex ?? 0).reduce((sum, item) => sum + item.percent, 0), activeCategory.percent)}>
          <span style={{ background: activeCategory.color }} />
          <strong>{activeCategory.label}</strong>
          <b>{activeCategory.percent}%</b>
        </div>}
      </div>
    </div>
    <ul className="category-stat-list" aria-label="Category order totals">
      {visibleCategories.map((category, index) => {
        const CategoryIcon = categoryIcons[index] ?? ShoppingBag
        return <li key={category.label} className={`category-stat-row${activeIndex === index ? ' is-active' : ''}`}>
          <button type="button" onBlur={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onMouseEnter={() => setActiveIndex(index)}>
            <span className={`category-stat-icon ${category.tone}`} style={{ '--segment-color': category.color } as CSSProperties}><CategoryIcon size={15} /></span>
            <span className="category-stat-copy"><strong>{category.label}</strong><small>{category.percent}% of total</small></span>
            <span className="category-stat-value"><strong>{category.orders.toLocaleString()}</strong><small>orders</small></span>
          </button>
        </li>
      })}
    </ul>
  </Panel>
}



