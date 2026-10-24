import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from 'react'

type TableProps = TableHTMLAttributes<HTMLTableElement> & { children: ReactNode }
type TableSectionProps = HTMLAttributes<HTMLTableSectionElement> & { children: ReactNode }

export function Table({ children, className = '', ...props }: TableProps) {
  return <div className="table-wrap"><table className={className} {...props}>{children}</table></div>
}

export function TableHead({ children, ...props }: TableSectionProps) {
  return <thead {...props}>{children}</thead>
}

export function TableBody({ children, ...props }: TableSectionProps) {
  return <tbody {...props}>{children}</tbody>
}
