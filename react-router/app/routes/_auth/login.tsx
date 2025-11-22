import { getFormProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { data, Form, Link, redirect, useSearchParams } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { z } from 'zod'
import { ErrorList } from '~/components/error-list'
import { FormField } from '~/components/field'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '~/components/ui/card'
import { Field, FieldDescription, FieldGroup } from '~/components/ui/field'
import { StatusButton } from '~/components/ui/status-button'
import { login, requireAnonymous } from '~/lib/auth.server'
import {
	rememberMeSessionKey,
	sessionKey,
	twoFAVerificationType,
	unverifiedSessionIdKey,
} from '~/lib/constants'
import { validateCSRF } from '~/lib/csrf.server'
import { checkHoneypot } from '~/lib/honeypot.server'
import { authSessionStorage } from '~/lib/session.server'
import { useIsPending } from '~/lib/utils'
import {
	getRedirectToUrl,
	shouldRequestTwoFA,
	verifySessionStorage,
} from '~/lib/verification.server'
import type { Route } from './+types/login'

export function meta({}: Route.MetaArgs) {
	return [{ title: 'Login' }, { name: 'description', content: 'Login' }]
}

export const LoginFormSchema = z.object({
	email: z
		.string({ required_error: 'Email is required' })
		.email({ message: 'Invalid email address' }),
	password: z.string({ required_error: 'Password is required' }),
	remember: z.boolean().optional(),
	redirectTo: z.string().optional(),
})

export async function loader({ request }: Route.LoaderArgs) {
	await requireAnonymous(request)
	return data({})
}

export async function action({ request }: Route.ActionArgs) {
	await requireAnonymous(request)
	const formData = await request.formData()

	await validateCSRF(formData, request.headers)
	checkHoneypot(formData)

	const submission = await parseWithZod(formData, {
		schema: intent =>
			LoginFormSchema.transform(async (data, ctx) => {
				if (intent !== null) return { ...data, session: null }

				try {
					const session = await login({
						email: data.email,
						password: data.password,
						request,
					})

					if (!session) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: 'Invalid email or password',
						})
						return z.NEVER
					}

					return { ...data, session }
				} catch (error) {
					// Handle lockout errors
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message:
							error instanceof Error
								? error.message
								: 'An error occurred during login',
					})
					return z.NEVER
				}
			}),
		async: true,
	})

	if (submission.status !== 'success' || !submission.value.session) {
		return data(
			{ result: submission.reply({ hideFields: ['password'] }) },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { session, remember, redirectTo } = submission.value

	if (await shouldRequestTwoFA({ request, userId: session.userId })) {
		const verifySession = await verifySessionStorage.getSession()
		verifySession.set(unverifiedSessionIdKey, session.id)
		verifySession.set(rememberMeSessionKey, remember)

		const redirectUrl = getRedirectToUrl({
			request,
			target: session.userId,
			type: twoFAVerificationType,
			redirectTo,
		})

		return redirect(redirectUrl.toString(), {
			headers: {
				'set-cookie': await verifySessionStorage.commitSession(verifySession),
			},
		})
	} else {
		const cookieSession = await authSessionStorage.getSession(
			request.headers.get('cookie'),
		)
		cookieSession.set(sessionKey, session.id)

		return redirect(safeRedirect(redirectTo), {
			headers: {
				'set-cookie': await authSessionStorage.commitSession(cookieSession, {
					expires: remember ? session.expiresAt : undefined,
				}),
			},
		})
	}
}

export default function LoginRoute({ actionData }: Route.ComponentProps) {
	const isPending = useIsPending()
	const [searchParams] = useSearchParams()
	const redirectTo = searchParams.get('redirectTo')

	const [form, fields] = useForm({
		id: 'login-form',
		constraint: getZodConstraint(LoginFormSchema),
		defaultValue: { redirectTo },
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: LoginFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Login to your account</CardTitle>
							<CardDescription>
								Enter your email below to login to your account
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Form method="POST" {...getFormProps(form)}>
								<AuthenticityTokenInput />
								<HoneypotInputs />
								<FormField meta={fields.redirectTo} type="hidden" />

								<FieldGroup>
									<FormField
										meta={fields.email}
										type="email"
										autoFocus
										label="Email"
										showRequired={false}
									/>

									<FormField
										meta={fields.password}
										type="password"
										label="Password"
										extras={
											<Link
												to="/forgot-password"
												className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
											>
												Forgot your password?
											</Link>
										}
										showRequired={false}
									/>

									<ErrorList errors={form.errors} id={form.errorId} />

									<div className="flex flex-col gap-3">
										<StatusButton
											className="w-full cursor-pointer"
											status={isPending ? 'pending' : (form.status ?? 'idle')}
											type="submit"
											disabled={isPending}
										>
											Log in
										</StatusButton>
									</div>

									<Field>
										<FieldDescription className="text-center">
											Don&apos;t have an account?{' '}
											<Link to="/signup">Sign up</Link>
										</FieldDescription>
									</Field>
								</FieldGroup>
							</Form>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}
