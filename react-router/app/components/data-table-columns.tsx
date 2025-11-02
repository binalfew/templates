import type { Column, ColumnDef, Row } from '@tanstack/react-table'
import { format } from 'date-fns'
import { MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router'
import { DataTableColumnHeader } from './data-table-column-header'
import { Button } from './ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from './ui/dropdown-menu'

// Action definition
interface Action<TData> {
	label: string
	icon?: React.ComponentType<{ className?: string }>
	onClick?: (data: TData) => void
	to?: string | ((data: TData) => string)
}

// Column definition
interface ColumnConfig<TData> {
	label: string
	sortable?: boolean
	type: 'text' | 'actions' | 'date'
	field?: string
	display?: 'dropdown' | 'icons'
	actions?: Action<TData>[]
	format?: string
}

// Helper functions
export function text<TData>(
	field: keyof TData,
	label: string,
	sortable = true,
): ColumnConfig<TData> {
	return {
		type: 'text',
		field: field as string,
		label,
		sortable,
	}
}

export function date<TData>(
	field: keyof TData,
	label: string,
	format = 'PPpp',
	sortable = true,
): ColumnConfig<TData> {
	return {
		type: 'date',
		field: field as string,
		label,
		format,
		sortable,
	}
}

export function actions<TData>(
	label: string,
	actions: Action<TData>[],
	display: 'dropdown' | 'icons' = 'dropdown',
): ColumnConfig<TData> {
	return {
		type: 'actions',
		label,
		display,
		actions,
	}
}

// Column registry
const columnRegistry = {
	text: function <TData>(config: ColumnConfig<TData>) {
		return {
			accessorKey: config.field,
			header: ({ column }: { column: Column<unknown> }) => (
				<DataTableColumnHeader column={column} title={config.label} />
			),
			enableSorting: config.sortable ?? true,
		}
	},

	date: function <TData>(config: ColumnConfig<TData>) {
		return {
			accessorKey: config.field,
			header: ({ column }: { column: Column<unknown> }) => (
				<DataTableColumnHeader column={column} title={config.label} />
			),
			cell: ({ row }: { row: Row<TData> }) => {
				const value = row.getValue(config.field as string)
				if (!value) return null
				return format(new Date(value as string), config.format || 'PPpp')
			},
			enableSorting: config.sortable ?? true,
		}
	},

	actions: function <TData>(config: ColumnConfig<TData>) {
		return {
			id: 'actions',
			header: ({ column }: { column: Column<unknown> }) => (
				<div className="text-right">
					<DataTableColumnHeader column={column} title={config.label} />
				</div>
			),
			cell: ({ row }: { row: Row<TData> }) => {
				const data = row.original

				if (config.display === 'icons') {
					return (
						<div className="flex items-center justify-end gap-2">
							{config.actions?.map(action => {
								const Icon = action.icon
								const commonProps = {
									key: action.label,
									variant: 'ghost' as const,
									size: 'sm' as const,
									className: 'h-8 w-8 p-0',
									title: action.label,
								}

								if (action.to) {
									const to =
										typeof action.to === 'function'
											? action.to(data)
											: action.to
									return (
										<Button asChild {...commonProps}>
											<Link to={to}>
												{Icon ? (
													<Icon className="h-4 w-4" />
												) : (
													<span className="sr-only">{action.label}</span>
												)}
											</Link>
										</Button>
									)
								}

								return (
									<Button
										{...commonProps}
										onClick={() => action.onClick?.(data)}
									>
										{Icon ? (
											<Icon className="h-4 w-4" />
										) : (
											<span className="sr-only">{action.label}</span>
										)}
									</Button>
								)
							})}
						</div>
					)
				}

				return (
					<div className="flex justify-end">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" className="h-8 w-8 cursor-pointer p-0">
									<span className="sr-only">Open menu</span>
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{config.actions?.map(action => {
									const Icon = action.icon
									const commonProps = {
										key: action.label,
										className: 'cursor-pointer',
									}

									if (action.to) {
										const to =
											typeof action.to === 'function'
												? action.to(data)
												: action.to
										return (
											<DropdownMenuItem asChild {...commonProps}>
												<Link to={to} className="flex items-center">
													{Icon && <Icon className="mr-2 h-4 w-4" />}
													{action.label}
												</Link>
											</DropdownMenuItem>
										)
									}

									return (
										<DropdownMenuItem
											{...commonProps}
											onClick={() => action.onClick?.(data)}
										>
											{Icon && <Icon className="mr-2 h-4 w-4" />}
											{action.label}
										</DropdownMenuItem>
									)
								})}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				)
			},
			enableSorting: false,
		}
	},
}

export function createColumns<TData>(
	configs: ColumnConfig<TData>[],
): ColumnDef<TData>[] {
	return configs.map(config => {
		switch (config.type) {
			case 'text':
				return columnRegistry.text<TData>(config) as ColumnDef<TData>
			case 'date':
				return columnRegistry.date<TData>(config) as ColumnDef<TData>
			case 'actions':
				return columnRegistry.actions<TData>(config) as ColumnDef<TData>
			default:
				throw new Error(`Unknown column type: ${(config as any).type}`)
		}
	})
}
