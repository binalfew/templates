import * as React from 'react'
import { useSearchParams } from 'react-router'
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
} from '~/components/ui/pagination'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select'
import { Icon } from './ui/icon'

export function setSearchParamsString(
	searchParams: URLSearchParams,
	changes: Record<string, string | number | undefined>,
) {
	const newSearchParams = new URLSearchParams(searchParams)
	for (const [key, value] of Object.entries(changes)) {
		if (value === undefined) {
			newSearchParams.delete(key)
			continue
		}
		newSearchParams.set(key, String(value))
	}
	return newSearchParams.toString()
}

type DataTablePaginationProps = {
	currentPage: number // 1-based
	pageSize: number | 'All'
	totalCount: number
}

const PAGE_SIZE_OPTIONS = [2, 5, 10, 20, 50, 100, 'All'] as const

export const DataTablePagination: React.FC<DataTablePaginationProps> = ({
	currentPage,
	pageSize,
	totalCount,
}) => {
	const [searchParams] = useSearchParams()
	const totalPages =
		pageSize === 'All'
			? 1
			: Math.max(1, Math.ceil(totalCount / Number(pageSize)))

	const pageNumbers = new Set<number>()
	pageNumbers.add(1)
	const startPage = Math.max(2, currentPage - 2)
	const endPage = Math.min(currentPage + 2, totalPages - 1)
	for (let i = startPage; i <= endPage; i++) {
		pageNumbers.add(i)
	}
	if (totalPages > 1) pageNumbers.add(totalPages)
	const pagesArray = Array.from(pageNumbers).sort((a, b) => a - b)

	const startItem =
		pageSize === 'All' ? 1 : (currentPage - 1) * Number(pageSize) + 1
	const endItem =
		pageSize === 'All'
			? totalCount
			: Math.min(currentPage * Number(pageSize), totalCount)

	return (
		<Pagination className="mt-2 items-center justify-between">
			<div className="text-muted-foreground text-sm">
				Showing {startItem} to {endItem} of {totalCount}
			</div>
			<PaginationContent>
				<PaginationItem>
					<Select
						value={String(pageSize)}
						onValueChange={value => {
							window.scrollTo({ top: 0, behavior: 'smooth' })
							location.search = setSearchParamsString(searchParams, {
								page: 1,
								pageSize: value,
							})
						}}
					>
						<SelectTrigger className="w-[100px]" aria-label="Select page size">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PAGE_SIZE_OPTIONS.map(opt => (
								<SelectItem key={opt} value={String(opt)}>
									{opt}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink
						to={{
							search: setSearchParamsString(searchParams, {
								page: 1,
							}),
						}}
						isActive={currentPage === 1}
						isDisabled={currentPage === 1}
						aria-label="Go to first page"
					>
						<Icon name="double-arrow-left" />
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink
						to={{
							search: setSearchParamsString(searchParams, {
								page: currentPage - 1,
							}),
						}}
						isDisabled={currentPage === 1}
						aria-label="Go to previous page"
					>
						<Icon name="chevron-left" />
					</PaginationLink>
				</PaginationItem>
				{pagesArray.map((page, i, array) => (
					<React.Fragment key={page}>
						{i > 0 && page - array[i - 1] > 1 && (
							<PaginationItem>
								<PaginationEllipsis aria-hidden="true" />
							</PaginationItem>
						)}
						<PaginationItem>
							<PaginationLink
								to={{
									search: setSearchParamsString(searchParams, {
										page,
									}),
								}}
								isActive={currentPage === page}
								aria-label={`Go to page ${page}`}
								aria-current={currentPage === page ? 'page' : undefined}
							>
								{page}
							</PaginationLink>
						</PaginationItem>
					</React.Fragment>
				))}
				<PaginationItem>
					<PaginationLink
						to={{
							search: setSearchParamsString(searchParams, {
								page: currentPage + 1,
							}),
						}}
						isDisabled={currentPage === totalPages}
						aria-label="Go to next page"
					>
						<Icon name="chevron-right" />
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink
						to={{
							search: setSearchParamsString(searchParams, {
								page: totalPages,
							}),
						}}
						isActive={currentPage === totalPages}
						isDisabled={currentPage === totalPages}
						aria-label="Go to last page"
					>
						<Icon name="double-arrow-right" />
					</PaginationLink>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	)
}
