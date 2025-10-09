import { hash } from 'bcryptjs'
import { PrismaClient } from '../app/generated/prisma/client'

const prisma = new PrismaClient()

async function main() {
	console.log('🌱 Starting seeding...')

	// Create default permissions first
	console.log('Creating default permissions...')
	const permissions = [
		{ action: 'read', entity: 'user', access: 'own' },
		{ action: 'update', entity: 'user', access: 'own' },
		{ action: 'read', entity: 'user', access: 'all' },
		{ action: 'create', entity: 'user', access: 'all' },
		{ action: 'update', entity: 'user', access: 'all' },
		{ action: 'delete', entity: 'user', access: 'all' },
		{ action: 'read', entity: 'role', access: 'all' },
		{ action: 'create', entity: 'role', access: 'all' },
		{ action: 'update', entity: 'role', access: 'all' },
		{ action: 'delete', entity: 'role', access: 'all' },
		{ action: 'read', entity: 'permission', access: 'all' },
		{ action: 'create', entity: 'permission', access: 'all' },
		{ action: 'update', entity: 'permission', access: 'all' },
		{ action: 'delete', entity: 'permission', access: 'all' },
	]

	for (const perm of permissions) {
		await prisma.permission.upsert({
			where: {
				action_entity_access: {
					action: perm.action,
					entity: perm.entity,
					access: perm.access,
				},
			},
			update: {},
			create: {
				action: perm.action,
				entity: perm.entity,
				access: perm.access,
				description: `${perm.action} ${perm.entity} (${perm.access})`,
			},
		})
	}

	// Create default roles with permissions
	console.log('Creating default roles...')
	const userRole = await prisma.role.upsert({
		where: { name: 'user' },
		update: {},
		create: {
			name: 'user',
			description: 'Default user role with basic permissions',
		},
	})

	const adminRole = await prisma.role.upsert({
		where: { name: 'admin' },
		update: {},
		create: {
			name: 'admin',
			description: 'Administrator role with full permissions',
		},
	})

	// Connect permissions to roles
	console.log('Assigning permissions to roles...')

	// User role gets basic permissions (own user data)
	const userPermissions = await prisma.permission.findMany({
		where: {
			OR: [
				{ action: 'read', entity: 'user', access: 'own' },
				{ action: 'update', entity: 'user', access: 'own' },
			],
		},
	})

	await prisma.role.update({
		where: { id: userRole.id },
		data: {
			permissions: {
				connect: userPermissions.map(p => ({ id: p.id })),
			},
		},
	})

	// Admin role gets all permissions
	const allPermissions = await prisma.permission.findMany()
	await prisma.role.update({
		where: { id: adminRole.id },
		data: {
			permissions: {
				connect: allPermissions.map(p => ({ id: p.id })),
			},
		},
	})

	// Create default user statuses
	console.log('Creating default user statuses...')
	await prisma.userStatus.upsert({
		where: { code: 'ACTIVE' },
		update: {},
		create: {
			name: 'Active',
			code: 'ACTIVE',
			description: 'Active user status',
			isActive: true,
			order: 1,
		},
	})

	await prisma.userStatus.upsert({
		where: { code: 'INACTIVE' },
		update: {},
		create: {
			name: 'Inactive',
			code: 'INACTIVE',
			description: 'Inactive user status',
			isActive: false,
			order: 2,
		},
	})

	await prisma.userStatus.upsert({
		where: { code: 'PENDING' },
		update: {},
		create: {
			name: 'Pending',
			code: 'PENDING',
			description: 'Pending verification user status',
			isActive: false,
			order: 3,
		},
	})

	// Create admin user
	console.log('Creating admin user...')
	const adminPassword = await hash('admin123', 10)
	const activeStatus = await prisma.userStatus.findUnique({
		where: { code: 'ACTIVE' },
	})

	await prisma.user.upsert({
		where: { email: 'admin@example.com' },
		update: {},
		create: {
			email: 'admin@example.com',
			firstName: 'Admin',
			lastName: 'User',
			userStatusId: activeStatus?.id,
			roles: {
				connect: [{ id: adminRole.id }],
			},
			password: {
				create: {
					hash: adminPassword,
				},
			},
		},
	})

	// Create regular user
	console.log('Creating regular user...')
	const userPassword = await hash('user123', 10)

	await prisma.user.upsert({
		where: { email: 'user@example.com' },
		update: {},
		create: {
			email: 'user@example.com',
			firstName: 'Regular',
			lastName: 'User',
			userStatusId: activeStatus?.id,
			roles: {
				connect: [{ id: userRole.id }],
			},
			password: {
				create: {
					hash: userPassword,
				},
			},
		},
	})

	console.log('✅ Seeding completed!')
	console.log('🔑 Users created:')
	console.log('   Admin: admin@example.com / admin123')
	console.log('   User:  user@example.com / user123')
}

main()
	.catch(e => {
		console.error('❌ Error during seeding:', e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
