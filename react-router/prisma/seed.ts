import { PrismaClient } from '../app/generated/prisma/client'

const prisma = new PrismaClient()

async function main() {
	console.log('🌱 Starting seeding...')

	// Truncate existing data
	console.log('Clearing existing data...')
	await prisma.$transaction([
		prisma.user.deleteMany(),
	])


	console.log('✅ Seeding completed!')
}

main()
	.catch(e => {
		console.error('❌ Error during seeding:', e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
