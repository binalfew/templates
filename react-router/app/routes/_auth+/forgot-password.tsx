import { getFormProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import * as E from '@react-email/components'
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
import { requireAnonymous } from '~/lib/auth.server'
import { validateCSRF } from '~/lib/csrf.server'
import { prisma } from '~/lib/db.server'
import { sendEmail } from '~/lib/email.server'
import { checkHoneypot } from '~/lib/honeypot.server'
import { useIsPending } from '~/lib/utils'
import { prepareVerification } from '~/lib/verification.server'
import type { Route } from './+types/forgot-password'
const ForgotPasswordSchema = z.object({
	email: z
		.string({ required_error: 'Email is required' })
		.email({ message: 'Email is invalid' })
		.min(3, { message: 'Email is too short' })
		.max(100, { message: 'Email is too long' })
		.transform(value => value.toLowerCase()),
})

export async function action({ request }: Route.ActionArgs) {
	await requireAnonymous(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	checkHoneypot(formData)

	const submission = await parseWithZod(formData, {
		schema: ForgotPasswordSchema.superRefine(async (data, ctx) => {
			const user = await prisma.user.findFirst({
				where: {
					email: data.email,
				},
			})

			if (!user) {
				ctx.addIssue({
					path: ['email'],
					code: z.ZodIssueCode.custom,
					message: 'No user found with that email',
				})
				return
			}
		}),
		async: true,
	})

	if (submission.status !== 'success') {
		return data(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { email } = submission.value
	const user = await prisma.user.findFirstOrThrow({
		where: { email },
		select: { email: true },
	})

	const { verifyUrl, redirectTo, otp } = await prepareVerification({
		period: 10 * 60,
		request,
		type: 'reset-password',
		target: email,
	})

	const response = await sendEmail({
		to: user.email,
		subject: `Accreditation Password Reset`,
		react: (
			<ForgotPasswordEmail onboardingUrl={verifyUrl.toString()} otp={otp} />
		),
	})

	if (response.status === 'success') {
		return redirect(redirectTo.toString())
	} else {
		return data(
			{ result: submission.reply({ formErrors: [response.error.message] }) },
			{ status: 500 },
		)
	}
}

function ForgotPasswordEmail({
	onboardingUrl,
	otp,
}: {
	onboardingUrl: string
	otp: string
}) {
	return (
		<E.Html lang="en" dir="ltr">
			<E.Container>
				<h1>
					<E.Text>Epic Notes Password Reset</E.Text>
				</h1>
				<p>
					<E.Text>
						Here's your verification code: <strong>{otp}</strong>
					</E.Text>
				</p>
				<p>
					<E.Text>Or click the link:</E.Text>
				</p>
				<E.Link href={onboardingUrl}>{onboardingUrl}</E.Link>
			</E.Container>
		</E.Html>
	)
}

export default function ForgotPasswordRoute({
	actionData,
}: Route.ComponentProps) {
	const isPending = useIsPending()
	const [form, fields] = useForm({
		id: 'forgot-password-form',
		constraint: getZodConstraint(ForgotPasswordSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ForgotPasswordSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-lg">
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-xl">Forgot Password</CardTitle>
							<CardDescription>
								No worries, we will send you reset instructions.
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
									<FormField meta={fields.email} type="email" label="Email" />

									<ErrorList errors={form.errors} id={form.errorId} />

									<StatusButton
										className="w-full"
										status={isPending ? 'pending' : (form.status ?? 'idle')}
										type="submit"
										disabled={isPending}
									>
										Recover Password
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
