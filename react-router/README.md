# React Router Full-Stack Template

A modern, production-ready template for building full-stack React applications
using React Router v7.

## 🚀 Features

- **Server-side rendering** with React Router v7
- **Hot Module Replacement (HMR)** for fast development
- **TypeScript** by default with full type safety
- **TailwindCSS** for modern styling with dark/light theme support
- **Prisma** database ORM with PostgreSQL support
- **Authentication system** with session management
- **UI component library** (shadcn/ui) with pre-built components
- **Form validation** with Conform and Zod
- **Security features** including CSRF protection and honeypot
- **Toast notifications** with Sonner
- **Docker support** for easy deployment
- **Production-ready** configuration

## 📦 What's Included

### Core Technologies

- React Router v7 with SSR
- TypeScript
- TailwindCSS v4
- Prisma ORM
- Express.js server

### UI & Styling

- shadcn/ui component library
- Dark/light theme switching
- Responsive design
- Modern CSS with TailwindCSS

### Authentication & Security

- Session-based authentication
- CSRF protection
- Honeypot spam protection
- Secure password hashing

### Development Experience

- Hot reloading
- TypeScript strict mode
- ESLint and Prettier
- Path mapping with TypeScript

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- PostgreSQL database (or Docker)

### Installation

1. **Create a new project using this template:**

```bash
npx create-react-router@latest my-app --template react-router-fullstack-template
```

2. **Navigate to your project:**

```bash
cd my-app
```

3. **Install dependencies:**

```bash
npm install
```

4. **Set up environment variables:**

```bash
cp .env.example .env
```

Edit `.env` and configure your database connection:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/myapp"
SESSION_SECRET="your-super-secret-session-key"
```

5. **Set up the database:**

```bash
# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Seed the database (optional)
npm run db:seed
```

6. **Start the development server:**

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## 📁 Project Structure

```
my-app/
├── app/                    # Application code
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # shadcn/ui components
│   │   └── header.tsx     # Navigation header
│   ├── lib/               # Utility functions and server code
│   │   ├── auth.server.ts # Authentication logic
│   │   ├── db.server.ts   # Database connection
│   │   └── utils.ts       # Shared utilities
│   ├── routes/            # Route components
│   │   ├── home.tsx       # Home page
│   │   └── resources/    # Resource routes
│   ├── root.tsx           # Root layout component
│   └── app.css            # Global styles
├── prisma/                # Database schema and migrations
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Database seeding
├── server/                # Server-side code
│   └── app.ts             # Express app configuration
├── public/                # Static assets
└── config/                # Configuration files
    ├── svgs/              # SVG icons
    └── sly/               # Icon configuration
```

## 🎨 Customization

### Adding New Routes

Create new route files in the `app/routes/` directory:

```tsx
// app/routes/about.tsx
import type { Route } from './+types/about'

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'About Us' },
		{ name: 'description', content: 'Learn more about our company' },
	]
}

export default function About() {
	return (
		<div className="container mx-auto p-4">
			<h1 className="text-3xl font-bold">About Us</h1>
			<p>Welcome to our about page!</p>
		</div>
	)
}
```

### Adding UI Components

Use shadcn/ui to add new components:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add form
```

### Database Schema

Edit `prisma/schema.prisma` to define your database models:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## 🚀 Deployment

### Docker Deployment

Build and run using Docker:

```bash
docker build -t my-app .
docker run -p 3000:3000 my-app
```

### Manual Deployment

1. Build the application:

```bash
npm run build
```

2. Deploy the `build/` directory and `server.js` to your hosting platform.

## 📚 Learn More

- [React Router Documentation](https://reactrouter.com/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

This template is open source and available under the [MIT License](LICENSE).
