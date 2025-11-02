import { Skeleton } from './ui/skeleton'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from './ui/table'

interface DataTableSkeletonProps {
	columns: number
	rows?: number
	selectable?: boolean
}

export function DataTableSkeleton({
	columns,
	rows = 5,
	selectable = false,
}: DataTableSkeletonProps) {
	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						{selectable && (
							<TableHead className="w-[40px]">
								<Skeleton className="h-4 w-4" />
							</TableHead>
						)}
						{Array.from({ length: columns }).map((_, index) => (
							<TableHead key={index}>
								<Skeleton className="h-4 w-20" />
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{Array.from({ length: rows }).map((_, rowIndex) => (
						<TableRow key={rowIndex}>
							{selectable && (
								<TableCell>
									<Skeleton className="h-4 w-4" />
								</TableCell>
							)}
							{Array.from({ length: columns }).map((_, colIndex) => (
								<TableCell key={colIndex}>
									<Skeleton className="h-4 w-full" />
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	)
}
