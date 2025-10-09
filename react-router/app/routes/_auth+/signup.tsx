import { getFormProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import * as E from '@react-email/components'
import { data, Form, Link, redirect, useSearchParams } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { FormField } from '~/components/field'
import { InputField } from '~/components/input-field'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '~/components/ui/card'
import { Field, FieldDescription, FieldGroup } from '~/components/ui/field'
import { StatusButton } from '~/components/ui/status-button'
import { requireAnonymous } from '~/lib/auth.server'
import { validateCSRF } from '~/lib/csrf.server'
import { prisma } from '~/lib/db.server'
import { sendEmail } from '~/lib/email.server'
import { checkHoneypot } from '~/lib/honeypot.server'
import { useIsPending } from '~/lib/utils'
import { prepareVerification } from '~/lib/verification.server'
import type { Route } from './+types/signup'

export function meta({}: Route.MetaArgs) {
	return [{ title: 'Sign Up' }, { name: 'description', content: 'Sign Up' }]
}

const SignupSchema = z.object({
	email: z
		.string({ required_error: 'Email is required' })
		.email({ message: 'Email is invalid' })
		.min(3, { message: 'Email is too short' })
		.max(100, { message: 'Email is too long' })
		.transform(value => value.toLowerCase()),
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
		schema: SignupSchema.superRefine(async (data, ctx) => {
			const existingUser = await prisma.user.findUnique({
				where: { email: data.email },
				select: { id: true },
			})

			if (existingUser) {
				ctx.addIssue({
					path: ['email'],
					code: z.ZodIssueCode.custom,
					message: 'A user already exists with this email',
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

	const { verifyUrl, redirectTo, otp } = await prepareVerification({
		period: 10 * 60,
		request,
		type: 'onboarding',
		target: email,
	})

	const response = await sendEmail({
		to: email,
		subject: `Welcome to Accreditation!`,
		react: <SignupEmail onboardingUrl={verifyUrl.toString()} otp={otp} />,
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

export function SignupEmail({
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
					<E.Text>Welcome to Accreditation!</E.Text>
				</h1>
				<p>
					<E.Text>
						Here's your verification code: <strong>{otp}</strong>
					</E.Text>
				</p>
				<p>
					<E.Text>Or click the link to get started:</E.Text>
				</p>
				<E.Link href={onboardingUrl}>{onboardingUrl}</E.Link>
			</E.Container>
		</E.Html>
	)
}

export default function SignupRoute({ actionData }: Route.ComponentProps) {
	const isPending = useIsPending()
	const [searchParams] = useSearchParams()
	const redirectTo = searchParams.get('redirectTo')

	const [form, fields] = useForm({
		id: 'signup-form',
		constraint: getZodConstraint(SignupSchema),
		defaultValue: { redirectTo },
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: SignupSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Sign up for your account</CardTitle>
							<CardDescription>
								Let's get you started on your journey to becoming accredited
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Form method="POST" {...getFormProps(form)}>
								<AuthenticityTokenInput />
								<HoneypotInputs />
								<InputField meta={fields.redirectTo} type="hidden" />

								<FieldGroup>
									<FormField
										meta={fields.email}
										type="email"
										autoFocus
										label="Email"
									/>
									<Field>
										<StatusButton
											className="w-full cursor-pointer"
											status={isPending ? 'pending' : (form.status ?? 'idle')}
											type="submit"
											disabled={isPending}
										>
											Sign Up
										</StatusButton>
										<FieldDescription className="text-center">
											Already have an account? <Link to="/login">Sign in</Link>
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
