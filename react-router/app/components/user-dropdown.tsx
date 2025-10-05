import { LogOut, Settings, User } from 'lucide-react'
import { useRef } from 'react'
import { Form } from 'react-router'
import { useUser } from '~/lib/user'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from './ui/dropdown-menu'

export function UserDropdown() {
	const user = useUser()
	const formRef = useRef<HTMLFormElement>(null)
	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="bg-background hover:bg-accent hover:text-accent-foreground flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border transition-colors">
				<User className="h-4 w-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel>
					{user.firstName} {user.lastName}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem className="cursor-pointer">
					<User className="mr-2 h-4 w-4" />
					<span>Profile</span>
				</DropdownMenuItem>
				<DropdownMenuItem className="cursor-pointer">
					<Settings className="mr-2 h-4 w-4" />
					<span>Account</span>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<Form action="/logout" method="POST" ref={formRef}>
					<DropdownMenuItem asChild className="cursor-pointer">
						<button type="submit" className="w-full">
							<LogOut className="mr-2 h-4 w-4" />
							<span>Logout</span>
						</button>
					</DropdownMenuItem>
				</Form>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
