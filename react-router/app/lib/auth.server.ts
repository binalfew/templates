import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { addMinutes, isBefore } from 'date-fns'
import { redirect } from 'react-router'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { type Password, type User } from '~/generated/prisma/client'
import { AUTH_SETTINGS, sessionKey } from './constants'
import { prisma } from './db.server'
import { authSessionStorage } from './session.server'
import { combineResponses } from './utils'

const SESSION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30 // 30 days

export const getSessionExpirationDate = () =>
	new Date(Date.now() + SESSION_EXPIRATION_TIME)

export async function verifyUserPassword(
	where: Pick<User, 'username'> | Pick<User, 'id'>,
	password: Password['hash'],
) {
	const userWithPassword = await prisma.user.findUnique({
		where,
		select: {
			id: true,
			tenantId: true,
			userStatus: { select: { name: true } },
			failedLoginAttempts: true,
			lastFailedLoginAt: true,
			autoUnlockAt: true,
			lockCount: true,
			password: { select: { hash: true } },
		},
	})

	if (!userWithPassword || !userWithPassword.password) {
		return null
	}

	// Check if account is locked
	if (userWithPassword.userStatus?.name === 'LOCKED') {
		// If lock count is too high, require manual intervention
		if (userWithPassword.lockCount >= AUTH_SETTINGS.MAX_LOCK_COUNT) {
			throw new Error(
				'Account is permanently locked due to multiple security violations. Please contact an administrator.',
			)
		}

		if (
			userWithPassword.autoUnlockAt &&
			isBefore(new Date(), userWithPassword.autoUnlockAt)
		) {
			throw new Error('Account is locked. Please try again later.')
		} else if (
			userWithPassword.autoUnlockAt &&
			isBefore(userWithPassword.autoUnlockAt, new Date())
		) {
			// Auto-unlock the account if lockout duration has passed and lock count is below threshold
			await prisma.user.update({
				where: { id: userWithPassword.id },
				data: {
					userStatus: { update: { name: 'ACTIVE' } },
					failedLoginAttempts: 0,
					lockedAt: null,
					lockReason: null,
					autoUnlockAt: null,
				},
			})
		}
	}

	// Check if we should reset failed attempts due to time passed
	if (
		userWithPassword.lastFailedLoginAt &&
		isBefore(
			addMinutes(
				userWithPassword.lastFailedLoginAt,
				AUTH_SETTINGS.AUTO_RESET_AFTER,
			),
			new Date(),
		)
	) {
		await prisma.user.update({
			where: { id: userWithPassword.id },
			data: {
				failedLoginAttempts: 0,
				lastFailedLoginAt: null,
			},
		})
	}

	const isValid = await bcrypt.compare(password, userWithPassword.password.hash)

	if (!isValid) {
		// Increment failed attempts
		const failedAttempts = (userWithPassword.failedLoginAttempts || 0) + 1
		const updates = {
			failedLoginAttempts: failedAttempts,
			lastFailedLoginAt: new Date(),
			lockedAt: undefined as Date | undefined,
			lockReason: undefined as string | undefined,
			lockCount: undefined as number | undefined,
			autoUnlockAt: undefined as Date | null | undefined,
		}

		// Lock account if max attempts reached
		if (failedAttempts >= AUTH_SETTINGS.MAX_LOGIN_ATTEMPTS) {
			const finalLockCount = (userWithPassword.lockCount || 0) + 1
			updates.lockedAt = new Date()
			updates.lockReason = 'Too many failed login attempts'
			updates.lockCount = finalLockCount
			updates.autoUnlockAt =
				finalLockCount >= AUTH_SETTINGS.MAX_LOCK_COUNT
					? null // No auto-unlock for accounts locked too many times
					: addMinutes(new Date(), AUTH_SETTINGS.LOCKOUT_DURATION)
		}

		await prisma.user.update({
			where: { id: userWithPassword.id },
			data: {
				...updates,
				userStatus:
					failedAttempts >= AUTH_SETTINGS.MAX_LOGIN_ATTEMPTS
						? { update: { name: 'LOCKED' } }
						: undefined,
			},
		})

		if (failedAttempts >= AUTH_SETTINGS.MAX_LOGIN_ATTEMPTS) {
			const message =
				(updates.lockCount || 0) >= AUTH_SETTINGS.MAX_LOCK_COUNT
					? 'Account has been permanently locked due to multiple security violations. Please contact an administrator.'
					: `Account locked due to too many failed attempts. Please try again after ${AUTH_SETTINGS.LOCKOUT_DURATION} minutes.`
			throw new Error(message)
		}

		return null
	}

	// Reset failed attempts on successful login
	if (userWithPassword.failedLoginAttempts > 0) {
		await prisma.user.update({
			where: { id: userWithPassword.id },
			data: {
				failedLoginAttempts: 0,
				lastFailedLoginAt: null,
			},
		})
	}

	return { id: userWithPassword.id, tenantId: userWithPassword.tenantId }
}

export async function getPasswordHash(password: string) {
	const hash = await bcrypt.hash(password, 10)
	return hash
}

export async function signup({
	email,
	username,
	password,
	firstName,
	lastName,
	request,
}: {
	email: User['email']
	username: User['username']
	firstName: User['firstName']
	lastName: User['lastName']
	password: string
	request: Request
}) {
	const hashedPassword = await getPasswordHash(password)

	const metadata = {
		fingerprint: generateFingerprint(request),
	}

	const session = await prisma.session.create({
		select: { id: true, expiresAt: true },
		data: {
			expiresAt: getSessionExpirationDate(),
			metadata,
			user: {
				create: {
					email: email.toLowerCase(),
					username: username.toLowerCase(),
					firstName,
					lastName,
					roles: {
						connect: [{ name: 'user' }],
					},
					password: {
						create: {
							hash: hashedPassword,
						},
					},
				},
			},
		},
	})

	return session
}

export async function login({
	username,
	password,
	request,
}: {
	username: User['username']
	password: string
	request: Request
}) {
	const user = await verifyUserPassword({ username }, password)
	if (!user) return null

	const metadata = {
		fingerprint: generateFingerprint(request),
	}

	const session = await prisma.session.create({
		select: { id: true, userId: true, expiresAt: true },
		data: {
			userId: user.id,
			expiresAt: getSessionExpirationDate(),
			metadata,
		},
	})

	return session
}

export async function logout(
	{
		request,
		redirectTo = '/',
	}: {
		request: Request
		redirectTo?: string
	},
	responseInit?: ResponseInit,
) {
	const cookieSession = await authSessionStorage.getSession(
		request.headers.get('cookie'),
	)

	const sessionId = cookieSession.get(sessionKey)
	void prisma.session.delete({ where: { id: sessionId } }).catch(() => {})

	throw redirect(
		safeRedirect(redirectTo),
		combineResponses(responseInit, {
			headers: {
				'set-cookie': await authSessionStorage.destroySession(cookieSession),
			},
		}),
	)
}

function generateFingerprint(request: Request): string {
	// Start with universally supported headers
	const components = [
		request.headers.get('user-agent') || '',
		request.headers.get('accept-language') || '',
	]

	// Add modern headers only if available
	const modernHeaders = ['sec-ch-ua', 'sec-ch-ua-platform']
	modernHeaders.forEach(header => {
		const value = request.headers.get(header)
		if (value) components.push(value)
	})

	return crypto
		.createHmac('sha256', process.env.SESSION_SECRET)
		.update(components.filter(Boolean).join('|'))
		.digest('hex')
}

export async function getUserId(request: Request) {
	const cookieSession = await authSessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const sessionId = cookieSession.get(sessionKey)
	if (!sessionId) return null

	const session = await prisma.session.findUnique({
		select: { userId: true, metadata: true },
		where: { id: sessionId },
	})

	if (!session) {
		throw await logout({ request })
	}

	const currentFingerprint = generateFingerprint(request)
	const sessionMetadata = session.metadata as { fingerprint: string } | null

	if (
		sessionMetadata?.fingerprint &&
		currentFingerprint !== sessionMetadata.fingerprint
	) {
		throw await logout({ request })
	}

	return session.userId
}

export async function requireUserId(
	request: Request,
	{ redirectTo }: { redirectTo?: string | null } = {},
) {
	const userId = await getUserId(request)
	if (!userId) {
		const requestUrl = new URL(request.url)
		redirectTo =
			redirectTo === null
				? null
				: (redirectTo ?? `${requestUrl.pathname}${requestUrl.search}`)
		const loginParams = redirectTo ? new URLSearchParams({ redirectTo }) : null
		const loginRedirect = ['/login', loginParams?.toString()]
			.filter(Boolean)
			.join('?')
		throw redirect(loginRedirect)
	}

	return userId
}

export async function getUser(userId: string) {
	return await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			username: true,
			firstName: true,
			lastName: true,
			tenantId: true,
			roles: {
				select: {
					name: true,
					permissions: {
						select: {
							entity: true,
							action: true,
							access: true,
						},
					},
				},
			},
			password: false, // intentionally omit password
			sessions: true,
		},
	})
}

export async function requireAnonymous(request: Request) {
	const userId = await getUserId(request)

	if (userId) {
		throw redirect('/')
	}
}

export async function resetUserPassword({
	email,
	password,
}: {
	email: User['email']
	password: string
}) {
	const hashedPassword = await bcrypt.hash(password, 10)

	// First check if the user has a password entry
	const user = await prisma.user.findUnique({
		where: { email },
		include: { password: true },
	})

	if (!user) {
		throw new Error(`User with email ${email} not found`)
	}

	// If the user has an existing password, update it
	if (user.password) {
		return prisma.user.update({
			select: { id: true },
			where: { email },
			data: {
				password: {
					update: {
						hash: hashedPassword,
						lastChanged: new Date(),
					},
				},
			},
		})
	}
	// If the user doesn't have a password entry yet, create one
	else {
		return prisma.user.update({
			select: { id: true },
			where: { email },
			data: {
				password: {
					create: {
						hash: hashedPassword,
					},
				},
			},
		})
	}
}
