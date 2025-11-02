import { Filter, RotateCcw, X } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

interface FilterBadge {
	key: string
	label: string
	value: string
	displayValue: string
}

interface DataTableFilterBadgesProps {
	filters?: Array<{
		name: string
		label: string
		options?: Array<{ value: string; label: string }>
	}>
	onRemoveFilter?: (key: string) => void
	onClearAll?: () => void
}

export function DataTableFilterBadges({
	filters = [],
	onRemoveFilter,
	onClearAll,
}: DataTableFilterBadgesProps) {
	const [searchParams, setSearchParams] = useSearchParams()

	// Get active filters from URL params
	const activeFilters: FilterBadge[] = []

	// Check search
	const search = searchParams.get('search')
	if (search) {
		activeFilters.push({
			key: 'search',
			label: 'Search',
			value: search,
			displayValue: `"${search}"`,
		})
	}

	// Check other filters
	filters.forEach(filter => {
		const value = searchParams.get(filter.name)
		if (value && value !== 'all') {
			// Find the display label for the value
			const option = filter.options?.find(opt => opt.value === value)
			activeFilters.push({
				key: filter.name,
				label: filter.label,
				value,
				displayValue: option?.label || value,
			})
		}
	})

	if (activeFilters.length === 0) {
		return null
	}

	const handleRemoveFilter = (key: string) => {
		if (onRemoveFilter) {
			onRemoveFilter(key)
		} else {
			const params = new URLSearchParams(searchParams)
			params.delete(key)
			params.delete('page') // Reset to first page
			setSearchParams(params)
		}
	}

	const handleClearAll = () => {
		if (onClearAll) {
			onClearAll()
		} else {
			const params = new URLSearchParams()
			// Keep only non-filter params if needed
			setSearchParams(params)
		}
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="flex items-center gap-2">
				<Filter className="text-muted-foreground h-4 w-4" />
				<span className="text-sm font-medium">Active filters:</span>
				<Badge variant="outline" className="text-xs">
					{activeFilters.length}
				</Badge>
			</div>

			<div className="flex flex-wrap gap-2">
				{activeFilters.map(filter => (
					<Badge
						key={filter.key}
						variant="secondary"
						className="group flex items-center gap-1 px-3 py-1 transition-all duration-200 hover:scale-105 hover:shadow-sm"
					>
						<span className="text-xs font-medium">
							{filter.label}: {filter.displayValue}
						</span>
						<Button
							variant="ghost"
							size="sm"
							className="hover:bg-destructive hover:text-destructive-foreground h-4 w-4 p-0 opacity-0 transition-opacity group-hover:opacity-100"
							onClick={() => handleRemoveFilter(filter.key)}
						>
							<X className="h-3 w-3" />
						</Button>
					</Badge>
				))}
			</div>

			{activeFilters.length > 1 && (
				<Button
					variant="ghost"
					size="sm"
					onClick={handleClearAll}
					className="text-muted-foreground hover:text-foreground text-xs transition-colors"
				>
					<RotateCcw className="mr-1 h-3 w-3" />
					Clear all
				</Button>
			)}
		</div>
	)
}
