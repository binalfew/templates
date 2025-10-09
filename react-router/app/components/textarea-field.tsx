import { type FieldMetadata, getTextareaProps } from '@conform-to/react'
import { type ComponentProps } from 'react'
import { Textarea } from '~/components/ui/textarea'

export const TextareaField = ({
	meta,
	...props
}: {
	meta: FieldMetadata<string | null>
} & ComponentProps<typeof Textarea>) => {
	return <Textarea {...getTextareaProps(meta)} {...props} />
}
