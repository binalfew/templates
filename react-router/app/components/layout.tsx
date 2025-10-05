import {
	ArrowRightStartOnRectangleIcon,
	ChevronDownIcon,
	Cog8ToothIcon,
	LightBulbIcon,
	PlusIcon,
	ShieldCheckIcon,
	UserIcon,
} from '@heroicons/react/16/solid'
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { Avatar } from '~/components/catalyst/avatar'
import {
	Dropdown,
	DropdownButton,
	DropdownDivider,
	DropdownItem,
	DropdownLabel,
	DropdownMenu,
} from '~/components/catalyst/dropdown'
import { Link } from '~/components/catalyst/link'
import {
	Navbar,
	NavbarDivider,
	NavbarItem,
	NavbarLabel,
	NavbarSection,
	NavbarSpacer,
} from '~/components/catalyst/navbar'
import {
	Sidebar,
	SidebarBody,
	SidebarHeader,
	SidebarItem,
	SidebarLabel,
	SidebarSection,
} from '~/components/catalyst/sidebar'
import { StackedLayout } from '~/components/catalyst/stacked-layout'
import type { Theme } from '~/lib/theme.server'
import { ThemeSwitch } from '~/routes/resources+/theme-switch'

const navItems = [
	{ label: 'Home', url: '/' },
	{ label: 'Events', url: '/events' },
	{ label: 'Orders', url: '/orders' },
	{ label: 'Broadcasts', url: '/broadcasts' },
	{ label: 'Settings', url: '/settings' },
]

function TeamDropdownMenu() {
	return (
		<DropdownMenu className="min-w-80 lg:min-w-64" anchor="bottom start">
			<DropdownItem>
				<Cog8ToothIcon />
				<DropdownLabel className="w-full">
					<Link to="/teams/1/settings" className="block w-full">
						Settings
					</Link>
				</DropdownLabel>
			</DropdownItem>
			<DropdownDivider />
			<DropdownItem>
				<Avatar
					slot="icon"
					initials="WC"
					className="bg-orange-500 text-white"
				/>
				<DropdownLabel className="w-full">
					<Link to="/teams/2" className="block w-full">
						Workcation
					</Link>
				</DropdownLabel>
			</DropdownItem>
			<DropdownDivider />
			<DropdownItem>
				<PlusIcon />
				<DropdownLabel className="w-full">
					<Link to="/teams/create" className="block w-full">
						New team&hellip;
					</Link>
				</DropdownLabel>
			</DropdownItem>
		</DropdownMenu>
	)
}

export default function Layout({
	children,
	theme,
}: {
	children: React.ReactNode
	theme: Theme | null
}) {
	return (
		<StackedLayout
			navbar={
				<Navbar>
					<Dropdown>
						<DropdownButton as={NavbarItem} className="max-lg:hidden">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="h-6 w-6"
							>
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
								<line x1="16" y1="2" x2="16" y2="6" />
								<line x1="8" y1="2" x2="8" y2="6" />
								<line x1="3" y1="10" x2="21" y2="10" />
							</svg>
							<NavbarLabel>Accreditation</NavbarLabel>
							<ChevronDownIcon />
						</DropdownButton>
						<TeamDropdownMenu />
					</Dropdown>
					<NavbarDivider className="max-lg:hidden" />
					<NavbarSection className="max-lg:hidden">
						{navItems.map(({ label, url }) => (
							<NavbarItem key={label} to={url}>
								{label}
							</NavbarItem>
						))}
					</NavbarSection>
					<NavbarSpacer />
					<NavbarSection>
						<ThemeSwitch userPreference={theme} />
						<NavbarItem to="/search" aria-label="Search">
							<MagnifyingGlassIcon />
						</NavbarItem>
						<Dropdown>
							<DropdownButton as={NavbarItem}>
								<UserIcon className="h-5 w-5" />
							</DropdownButton>
							<DropdownMenu className="min-w-64" anchor="bottom end">
								<DropdownItem>
									<UserIcon />
									<DropdownLabel className="w-full">
										<Link to="/my-profile" className="block w-full">
											My profile
										</Link>
									</DropdownLabel>
								</DropdownItem>
								<DropdownItem>
									<Cog8ToothIcon />
									<DropdownLabel className="w-full">
										<Link to="/settings" className="block w-full">
											Settings
										</Link>
									</DropdownLabel>
								</DropdownItem>
								<DropdownDivider />
								<DropdownItem>
									<ShieldCheckIcon />
									<DropdownLabel className="w-full">
										<Link to="/privacy-policy" className="block w-full">
											Privacy policy
										</Link>
									</DropdownLabel>
								</DropdownItem>
								<DropdownItem>
									<LightBulbIcon />
									<DropdownLabel className="w-full">
										<Link to="/share-feedback" className="block w-full">
											Share feedback
										</Link>
									</DropdownLabel>
								</DropdownItem>
								<DropdownDivider />
								<DropdownItem>
									<ArrowRightStartOnRectangleIcon />
									<DropdownLabel className="w-full">
										<Link to="/logout" className="block w-full">
											Sign out
										</Link>
									</DropdownLabel>
								</DropdownItem>
							</DropdownMenu>
						</Dropdown>
					</NavbarSection>
				</Navbar>
			}
			sidebar={
				<Sidebar>
					<SidebarHeader>
						<Dropdown>
							<DropdownButton as={SidebarItem} className="lg:mb-2.5">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="h-6 w-6"
								>
									<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
									<line x1="16" y1="2" x2="16" y2="6" />
									<line x1="8" y1="2" x2="8" y2="6" />
									<line x1="3" y1="10" x2="21" y2="10" />
								</svg>
								<SidebarLabel>Accreditation</SidebarLabel>
								<ChevronDownIcon />
							</DropdownButton>
							<TeamDropdownMenu />
						</Dropdown>
					</SidebarHeader>
					<SidebarBody>
						<SidebarSection>
							{navItems.map(({ label, url }) => (
								<SidebarItem key={label} to={url}>
									{label}
								</SidebarItem>
							))}
						</SidebarSection>
					</SidebarBody>
				</Sidebar>
			}
		>
			{children}
		</StackedLayout>
	)
}
