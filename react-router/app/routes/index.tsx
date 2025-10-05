export function meta() {
  return [{ title: "Home" }, { name: "description", content: "Home" }];
}

export function loader({ context }: any) {
  return { message: context.VALUE_FROM_EXPRESS };
}

export default function Home({ loaderData }: any) {
  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-8">
        Welcome to React Router with shadcn/ui
      </h1>
    </div>
  );
}
