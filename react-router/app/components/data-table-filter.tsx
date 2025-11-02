import { Search } from 'lucide-react'
import { useId } from 'react'
import { Form, useSearchParams, useSubmit } from 'react-router'
import { useDebounce, useIsPending } from '~/lib/utils'
import { DataTableFilterBadges } from './data-table-filter-badges'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from './ui/select'
import { StatusButton } from './ui/status-button'

export default function DataTableFilter({
	status,
	autoSubmit = false,
	handler,
	filters,
	searchPlaceholder = 'Search',
	showSearch = true,
	isLoading = false,
	showActiveFilters = true,
}: {
	status: 'idle' | 'pending' | 'success' | 'error'
	autoSubmit?: boolean
	handler: string
	filters?: Array<{
		name: string
		label: string
		type: 'select' | 'input'
		options?: Array<{ value: string; label: string }>
	}>
	searchPlaceholder?: string
	showSearch?: boolean
	isLoading?: boolean
	showActiveFilters?: boolean
}) {
	const id = useId()
	const [searchParams] = useSearchParams()
	const submit = useSubmit()
	const isSubmitting = useIsPending({
		formMethod: 'GET',
		formAction: handler,
	})

	const handleFormChange = useDebounce((form: HTMLFormElement) => {
		const formData = new FormData(form)
		const filteredData = new URLSearchParams()

		// First, preserve existing search params that aren't in the form
		for (const [key, value] of searchParams.entries()) {
			// Skip form fields - they'll be added from form data
			if (!formData.has(key)) {
				filteredData.append(key, value)
			}
		}

		// Then add form data (overriding any existing values)
		for (const [key, value] of formData.entries()) {
			if (typeof value === 'string' && value.trim() !== '' && value !== 'all') {
				filteredData.set(key, value)
			}
		}

		submit(filteredData, { method: 'GET', action: handler })
	}, 400)

	return (
		<div className="flex-1 space-y-4">
			{showActiveFilters && <DataTableFilterBadges filters={filters} />}

			<Form
				method="GET"
				action={handler}
				className="flex flex-col gap-4"
				onChange={e => autoSubmit && handleFormChange(e.currentTarget)}
				onSubmit={e => {
					e.preventDefault()
					handleFormChange(e.currentTarget)
				}}
			>
				{filters && (
					<div className="flex flex-wrap gap-2">
						{filters.map(filter => {
							const currentValue = searchParams.get(filter.name) || ''

							return (
								<div key={filter.name} className="min-w-[180px] flex-1">
									{filter.type === 'select' ? (
										<Select
											name={filter.name}
											value={currentValue || 'all'}
											onValueChange={value => {
												const params = new URLSearchParams(searchParams)
												if (value === 'all') {
													params.delete(filter.name)
												} else {
													params.set(filter.name, value)
												}
												params.delete('page')
												submit(params, { method: 'GET', action: handler })
											}}
											disabled={isLoading}
										>
											<SelectTrigger className="w-full">
												<SelectValue placeholder={filter.label} />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectLabel>{filter.label}</SelectLabel>
													{filter.options?.map(option => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
									) : (
										<Input
											type="text"
											name={filter.name}
											id={filter.name}
											placeholder={filter.label}
											value={currentValue}
											onChange={e => {
												const params = new URLSearchParams(searchParams)
												if (e.target.value) {
													params.set(filter.name, e.target.value)
												} else {
													params.delete(filter.name)
												}
												params.delete('page')
												submit(params, { method: 'GET', action: handler })
											}}
											className="w-full"
											disabled={isLoading}
										/>
									)}
								</div>
							)
						})}
					</div>
				)}

				<div className="flex items-center gap-2">
					{showSearch && (
						<div className="flex-1">
							<Label htmlFor={id} className="sr-only">
								Search
							</Label>
							<Input
								type="search"
								name="search"
								id={id}
								value={searchParams.get('search') ?? ''}
								onChange={e => {
									const params = new URLSearchParams(searchParams)
									if (e.target.value) {
										params.set('search', e.target.value)
									} else {
										params.delete('search')
									}
									params.delete('page')
									submit(params, { method: 'GET', action: handler })
								}}
								placeholder={searchPlaceholder}
								className="w-full"
								disabled={isLoading}
							/>
						</div>
					)}
					<StatusButton
						type="submit"
						status={isSubmitting ? 'pending' : status}
						className="flex cursor-pointer items-center justify-center"
						size="sm"
					>
						<Search className="h-4 w-4" />
						<span className="sr-only">Search</span>
					</StatusButton>
				</div>
			</Form>
		</div>
	)
}
