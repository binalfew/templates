import type { Column } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2 } from 'lucide-react'
import { useSearchParams } from 'react-router'

import { Button } from '~/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { cn } from '~/lib/utils'

interface DataTableColumnHeaderProps<TData, TValue>
	extends React.HTMLAttributes<HTMLDivElement> {
	column: Column<TData, TValue>
	title: string
	isLoading?: boolean
}

export function DataTableColumnHeader<TData, TValue>({
	column,
	title,
	className,
	isLoading = false,
}: DataTableColumnHeaderProps<TData, TValue>) {
	const [searchParams, setSearchParams] = useSearchParams()

	if (!column.getCanSort()) {
		return <div className={cn(className)}>{title}</div>
	}

	const handleSort = (direction: 'asc' | 'desc') => {
		const params = new URLSearchParams(searchParams)
		params.set('sortBy', column.id)
		params.set('sortOrder', direction)
		params.delete('page') // Reset to first page when sorting
		setSearchParams(params)
	}

	return (
		<div className={cn('flex items-center space-x-2', className)}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="data-[state=open]:bg-accent hover:bg-accent hover:text-accent-foreground -ml-3 h-8 transition-all duration-200"
						disabled={isLoading}
					>
						<span>{title}</span>
						{isLoading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : column.getIsSorted() === 'desc' ? (
							<ArrowDown className="h-4 w-4 transition-transform duration-200" />
						) : column.getIsSorted() === 'asc' ? (
							<ArrowUp className="h-4 w-4 transition-transform duration-200" />
						) : (
							<ChevronsUpDown className="h-4 w-4 opacity-50 transition-opacity duration-200 hover:opacity-100" />
						)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuItem onClick={() => handleSort('asc')}>
						<ArrowUp className="text-muted-foreground/70 h-3.5 w-3.5" />
						Asc
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => handleSort('desc')}>
						<ArrowDown className="text-muted-foreground/70 h-3.5 w-3.5" />
						Desc
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
