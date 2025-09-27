import { Welcome } from '../welcome/welcome'
import type { Route } from './+types/home'

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'My React Router App' },
		{ name: 'description', content: 'A modern React Router application' },
	]
}

export function loader({ context }: Route.LoaderArgs) {
	return { message: context.VALUE_FROM_EXPRESS }
}

export default function Home({ loaderData }: Route.ComponentProps) {
	return <Welcome message={loaderData.message} />
}
