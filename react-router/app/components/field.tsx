import type { FieldMetadata } from '@conform-to/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { CheckboxField } from '~/components/checkbox-field'
import { InputField } from '~/components/input-field'
import { TextareaField } from '~/components/textarea-field'
import { Field, FieldLabel } from './ui/field'

export const FieldError = ({ children }: { children: React.ReactNode }) => {
	return <div className="text-sm text-red-600">{children}</div>
}

type BaseFormFieldProps = {
	label?: string
	className?: string
	helpText?: string
	maxLength?: number
	children?: React.ReactNode
	extras?: React.ReactNode
	showRequired?: boolean
}

type InputFormFieldProps = BaseFormFieldProps & {
	variant?: 'input'
	meta: FieldMetadata<string>
	type?:
		| 'text'
		| 'hidden'
		| 'number'
		| 'search'
		| 'password'
		| 'date'
		| 'time'
		| 'color'
		| 'radio'
		| 'tel'
		| 'url'
		| 'email'
		| 'datetime-local'
		| 'file'
		| 'month'
		| 'range'
		| 'week'
	placeholder?: string
	autoFocus?: boolean
}

type CheckboxFormFieldProps = BaseFormFieldProps & {
	variant: 'checkbox'
	meta: FieldMetadata<boolean>
}

type TextareaFormFieldProps = BaseFormFieldProps & {
	variant: 'textarea'
	meta: FieldMetadata<string | null>
	placeholder?: string
}

type SecurityFormFieldProps = BaseFormFieldProps & {
	variant: 'csrf' | 'honeypot'
}

export type FormFieldProps =
	| InputFormFieldProps
	| CheckboxFormFieldProps
	| TextareaFormFieldProps
	| SecurityFormFieldProps

function isRequired(meta: FieldMetadata) {
	return meta.required || meta.min === 1
}

export function FormField(props: FormFieldProps) {
	const { variant = 'input' } = props

	if (variant === 'csrf') return <AuthenticityTokenInput />
	if (variant === 'honeypot') return <HoneypotInputs />

	// Handle checkbox fields
	if (variant === 'checkbox') {
		const {
			label,
			meta,
			className,
			helpText,
			children,
			extras,
			showRequired = true,
		} = props as CheckboxFormFieldProps

		return (
			<Field>
				<div className="flex items-center space-x-2">
					<CheckboxField meta={meta} />
					{label && (
						<FieldLabel htmlFor={meta.id} className="text-sm font-semibold">
							{label}
							{showRequired && isRequired(meta) && (
								<span className="text-destructive ml-1">*</span>
							)}
						</FieldLabel>
					)}
					{extras}
				</div>
				{meta.errors && <FieldError>{meta.errors}</FieldError>}
				{helpText && (
					<p className="text-muted-foreground mt-1 text-xs">{helpText}</p>
				)}
				{children}
			</Field>
		)
	}

	if (variant === 'textarea') {
		const {
			label,
			meta,
			placeholder,
			className,
			helpText,
			maxLength,
			children,
			extras,
			showRequired = true,
		} = props as TextareaFormFieldProps
		return (
			<Field>
				{label &&
					(extras ? (
						<div className="flex items-center">
							<FieldLabel htmlFor={meta.name} className="text-sm font-semibold">
								{label}
								{showRequired && isRequired(meta) && (
									<span className="text-destructive ml-1">*</span>
								)}
							</FieldLabel>
							{extras}
						</div>
					) : (
						<FieldLabel htmlFor={meta.name} className="text-sm font-semibold">
							{label}
							{showRequired && isRequired(meta) && (
								<span className="text-destructive ml-1">*</span>
							)}
						</FieldLabel>
					))}
				<TextareaField
					meta={meta}
					autoComplete="off"
					className={className}
					placeholder={placeholder}
				/>
				{meta.errors && <FieldError>{meta.errors}</FieldError>}
				{(helpText || maxLength) && (
					<div className="mt-2 flex items-center justify-between">
						{helpText && (
							<p className="text-muted-foreground text-xs">{helpText}</p>
						)}
						{maxLength && (
							<p className="text-muted-foreground text-xs">
								Max {maxLength} characters
							</p>
						)}
					</div>
				)}
				{children}
			</Field>
		)
	}

	const {
		label,
		meta,
		type = 'text',
		placeholder,
		className,
		autoFocus,
		helpText,
		maxLength,
		children,
		extras,
		showRequired = true,
	} = props as InputFormFieldProps

	return (
		<Field>
			{label &&
				(extras ? (
					<div className="flex items-center">
						<FieldLabel htmlFor={meta.name} className="text-sm font-semibold">
							{label}
							{showRequired && isRequired(meta) && (
								<span className="text-destructive ml-1">*</span>
							)}
						</FieldLabel>
						{extras}
					</div>
				) : (
					<FieldLabel htmlFor={meta.name} className="text-sm font-semibold">
						{label}
						{showRequired && isRequired(meta) && (
							<span className="text-destructive ml-1">*</span>
						)}
					</FieldLabel>
				))}
			<InputField
				meta={meta}
				type={type}
				autoComplete="off"
				autoFocus={autoFocus}
				className={className}
				placeholder={placeholder}
			/>
			{meta.errors && <FieldError>{meta.errors}</FieldError>}
			{(helpText || maxLength) && (
				<div className="mt-2 flex items-center justify-between">
					{helpText && (
						<p className="text-muted-foreground text-xs">{helpText}</p>
					)}
					{maxLength && (
						<p className="text-muted-foreground text-xs">
							Max {maxLength} characters
						</p>
					)}
				</div>
			)}
			{children}
		</Field>
	)
}
