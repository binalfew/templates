import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table'
import React from 'react'
import { useSearchParams } from 'react-router'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '~/components/ui/table'
import { DataTablePagination } from './data-table-pagination'
import { DataTableSkeleton } from './data-table-skeleton'
import { Checkbox } from './ui/checkbox'

declare module '@tanstack/react-table' {
	interface ColumnMeta<TData extends unknown, TValue> {
		className?: string
	}
}

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	page: number
	pageSize: number
	totalCount: number
	selectable?: boolean
	defaultSort?: {
		id: string
		desc: boolean
	}
	isLoading?: boolean
}

export function DataTable<TData, TValue>({
	columns,
	data,
	page,
	pageSize,
	totalCount,
	selectable = false,
	defaultSort,
	isLoading = false,
}: DataTableProps<TData, TValue>) {
	const [rowSelection, setRowSelection] = React.useState({})
	const [searchParams] = useSearchParams()

	const sortBy = searchParams.get('sortBy')
	const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | null

	const selectColumn: ColumnDef<TData, TValue> = {
		id: 'select',
		header: ({ table }) => (
			<Checkbox
				checked={
					table.getIsAllPageRowsSelected() ||
					(table.getIsSomePageRowsSelected() && 'indeterminate')
				}
				onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
				aria-label="Select all"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={value => row.toggleSelected(!!value)}
				aria-label="Select row"
			/>
		),
		enableSorting: false,
		enableHiding: false,
		meta: {
			className: 'w-[40px]',
		},
	}

	const table = useReactTable({
		data,
		columns: selectable ? [selectColumn, ...columns] : columns,
		initialState: {
			sorting: sortBy
				? [
						{
							id: sortBy,
							desc: sortOrder === 'desc',
						},
					]
				: defaultSort
					? [defaultSort]
					: [],
		},
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onRowSelectionChange: setRowSelection,
		manualPagination: true,
		manualSorting: true,
		state: {
			rowSelection,
			pagination: {
				pageIndex: page - 1,
				pageSize,
			},
			sorting: sortBy
				? [
						{
							id: sortBy,
							desc: sortOrder === 'desc',
						},
					]
				: defaultSort
					? [defaultSort]
					: [],
		},
	})

	if (isLoading) {
		return (
			<div className="flex flex-col gap-4">
				<DataTableSkeleton
					columns={columns.length}
					rows={pageSize}
					selectable={selectable}
				/>
				<DataTablePagination
					currentPage={page}
					pageSize={pageSize}
					totalCount={totalCount}
				/>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map(headerGroup => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map(header => {
									return (
										<TableHead
											key={header.id}
											className={header.column.columnDef.meta?.className}
										>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
										</TableHead>
									)
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map(row => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && 'selected'}
									className="hover:bg-muted/50 transition-colors duration-150"
								>
									{row.getVisibleCells().map(cell => (
										<TableCell
											key={cell.id}
											className={cell.column.columnDef.meta?.className}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<DataTablePagination
				currentPage={page}
				pageSize={pageSize}
				totalCount={totalCount}
			/>
		</div>
	)
}
