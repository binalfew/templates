import {
	data,
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteLoaderData,
} from 'react-router'

import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import { HoneypotProvider } from 'remix-utils/honeypot/react'
import { Toaster } from 'sonner'
import type { Route } from './+types/root'
import './app.css'
import AppLayout from './components/layout'
import { useToast } from './components/toaster'
import { getUser, getUserId, logout } from './lib/auth.server'
import { ClientHintCheck, getHints } from './lib/client-hints'
import { csrf } from './lib/csrf.server'
import { getEnv } from './lib/env.server'
import { pipeHeaders } from './lib/headers.server'
import { honeypot } from './lib/honeypot.server'
import { useNonce } from './lib/nonce-provider'
import { getTheme } from './lib/theme.server'
import { makeTimings, time } from './lib/timing.server'
import { getToast } from './lib/toast.server'
import { useOptionalUser } from './lib/user'
import { combineHeaders, getDomainUrl } from './lib/utils'
import { useOptionalTheme, useTheme } from './routes/resources/theme-switch'

export const meta: Route.MetaFunction = ({ data }) => {
	return [
		{ title: data ? 'Admin' : 'Error | Admin' },
		{ name: 'description', content: `Admin` },
	]
}

export const headers: Route.HeadersFunction = pipeHeaders

export async function loader({ request }: Route.LoaderArgs) {
	const timings = makeTimings('root loader')
	const userId = await time(() => getUserId(request), {
		timings,
		type: 'getUserId',
		desc: 'getUserId in root',
	})
	const user = userId ? await getUser(userId) : null

	if (userId && !user) {
		console.info('something weird happened')
		// something weird happened... The user is authenticated but we can't find
		// them in the database. Maybe they were deleted? Let's log them out.
		throw await logout({ request, redirectTo: '/' })
	}

	const { toast, headers: toastHeaders } = await getToast(request)
	const [csrfToken, csrfCookieHeader] = await csrf.commitToken(request)
	const honeyProps = await honeypot.getInputProps()

	return data(
		{
			user,
			requestInfo: {
				hints: getHints(request),
				origin: getDomainUrl(request),
				path: new URL(request.url).pathname,
				userPrefs: {
					theme: getTheme(request),
				},
			},
			ENV: getEnv(),
			toast,
			honeyProps,
			csrfToken,
		},
		{
			headers: combineHeaders(
				{ 'Server-Timing': timings.toString() },
				csrfCookieHeader ? { 'set-cookie': csrfCookieHeader } : null,
				toastHeaders,
			),
		},
	)
}

export function Layout({ children }: { children: React.ReactNode }) {
	const data = useRouteLoaderData('root')
	const nonce = useNonce()
	const theme = useOptionalTheme()

	return (
		<html lang="en" className={`${theme}`}>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<ClientHintCheck nonce={nonce} />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<script
					nonce={nonce}
					dangerouslySetInnerHTML={{
						__html: `window.ENV = ${JSON.stringify(data?.ENV)}`,
					}}
				/>
				<ScrollRestoration nonce={nonce} />
				<Scripts nonce={nonce} />
			</body>
		</html>
	)
}

export default function App({ loaderData }: Route.ComponentProps) {
	const user = useOptionalUser()
	const theme = useTheme()
	useToast(loaderData.toast)

	return (
		<AuthenticityTokenProvider token={loaderData.csrfToken}>
			<HoneypotProvider {...loaderData.honeyProps}>
				{!user ? (
					<div className="min-h-screen">
						<Outlet />
						<Toaster position="top-center" theme={theme} />
					</div>
				) : (
					<AppLayout
						theme={loaderData.requestInfo.userPrefs.theme}
						user={loaderData.user}
					>
						<Outlet />
						<Toaster position="top-center" theme={theme} />
					</AppLayout>
				)}
			</HoneypotProvider>
		</AuthenticityTokenProvider>
	)
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = 'Oops!'
	let details = 'An unexpected error occurred.'
	let stack: string | undefined

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? '404' : 'Error'
		details =
			error.status === 404
				? 'The requested page could not be found.'
				: error.statusText || details
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message
		stack = error.stack
	}

	return (
		<main className="container mx-auto p-4 pt-16">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full overflow-x-auto p-4">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	)
}
