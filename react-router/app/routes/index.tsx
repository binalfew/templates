import type { Route } from './+types/home'

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'Home' },
		{ name: 'description', content: 'Home' },
	]
}

export function loader({ context }: Route.LoaderArgs) {
	return { message: context.VALUE_FROM_EXPRESS }
}

export default function Home({ loaderData }: Route.ComponentProps) {
	return <div>Home</div>
}
