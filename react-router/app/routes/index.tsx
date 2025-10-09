import { redirect } from 'react-router'
import { getUserId } from '~/lib/auth.server'
import type { Route } from './+types/index'

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'Application' },
		{
			name: 'description',
			content: 'Application',
		},
	]
}

export async function loader({ request }: Route.LoaderArgs) {
	const userId = await getUserId(request)

	// If user is logged in, redirect to dashboard
	if (userId) {
		throw redirect('/home')
	}

	return { message: 'Welcome to my app' }
}

export default function Home({ loaderData }: Route.ComponentProps) {
	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
			This is your landing page
		</div>
	)
}
