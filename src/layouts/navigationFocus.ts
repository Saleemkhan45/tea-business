export function trapNavigationTab(event: KeyboardEvent, items: HTMLElement[], active: Element | null) {
  if (event.key !== 'Tab' || !items.length) return
  const first = items[0], last = items.at(-1)
  if (event.shiftKey && active === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus() }
}
