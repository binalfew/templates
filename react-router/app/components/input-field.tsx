import { type FieldMetadata, getInputProps } from '@conform-to/react'
import { type ComponentProps } from 'react'
import { Input } from '~/components/ui/input'

export const InputField = ({
	meta,
	type,
	...props
}: {
	meta: FieldMetadata<string>
	type: Parameters<typeof getInputProps>[1]['type']
} & ComponentProps<typeof Input>) => {
	return (
		<Input
			{...getInputProps(meta, { type, ariaAttributes: true })}
			{...props}
		/>
	)
}
