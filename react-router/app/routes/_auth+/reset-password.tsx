import { getFormProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { data, Form, Link, redirect } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
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
import { StatusButton } from '~/components/ui/status-button'
import { resetUserPassword } from '~/lib/auth.server'
import { validateCSRF } from '~/lib/csrf.server'
import { checkHoneypot } from '~/lib/honeypot.server'
import { useIsPending } from '~/lib/utils'
import {
	requireResetPasswordEmail,
	verifySessionStorage,
} from '~/lib/verification.server'
import type { Route } from './+types/reset-password'
const ResetPasswordSchema = z
	.object({
		password: z.string({ required_error: 'Password is required' }),
		confirmPassword: z.string({
			required_error: 'Confirm password is required',
		}),
	})
	.refine(({ confirmPassword, password }) => password === confirmPassword, {
		message: 'The passwords did not match',
		path: ['confirmPassword'],
	})

export async function loader({ request }: Route.LoaderArgs) {
	const resetPasswordEmail = await requireResetPasswordEmail(request)

	return data({ resetPasswordEmail })
}

export async function action({ request }: Route.ActionArgs) {
	const resetPasswordEmail = await requireResetPasswordEmail(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	checkHoneypot(formData)
	const submission = parseWithZod(formData, {
		schema: ResetPasswordSchema,
	})

	if (submission.status !== 'success') {
		return data(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { password } = submission.value

	await resetUserPassword({ email: resetPasswordEmail, password })

	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)

	return redirect('/login', {
		headers: {
			'set-cookie': await verifySessionStorage.destroySession(verifySession),
		},
	})
}

export default function PasswordResetRoute({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'password-reset-form',
		constraint: getZodConstraint(ResetPasswordSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ResetPasswordSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-lg">
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-xl">Password Reset</CardTitle>
							<CardDescription>
								Hi, {loaderData.resetPasswordEmail}. No worries. It happens all
								the time.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Form
								className="grid gap-4"
								method="POST"
								{...getFormProps(form)}
							>
								<AuthenticityTokenInput />
								<HoneypotInputs />
								<div className="grid gap-4">
									<FormField
										meta={fields.password}
										type="password"
										label="Password"
									/>
									<FormField
										meta={fields.confirmPassword}
										type="password"
										label="Confirm Password"
									/>

									<ErrorList errors={form.errors} id={form.errorId} />

									<StatusButton
										className="w-full"
										status={isPending ? 'pending' : (form.status ?? 'idle')}
										type="submit"
										disabled={isPending}
									>
										Reset password
									</StatusButton>
								</div>
							</Form>
							<div className="mt-4 text-center text-sm">
								<Link to="/login" className="underline">
									Back to login
								</Link>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}
