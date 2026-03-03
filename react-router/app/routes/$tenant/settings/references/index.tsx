import { Link, useLoaderData } from "react-router";
import { Globe, User, Languages, Banknote, FileText } from "lucide-react";

export const handle = { breadcrumb: "References" };

import { requireUser } from "~/lib/session.server";
import { getReferenceDataCounts } from "~/services/reference-data.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const counts = await getReferenceDataCounts();
  return { counts };
}

const referenceTypes = [
  {
    key: "countries",
    title: "Countries",
    description: "ISO 3166-1 country codes, names, phone codes, and flags",
    icon: Globe,
    path: "countries",
  },
  {
    key: "titles",
    title: "Titles",
    description: "Honorific titles and prefixes (Mr., Mrs., Dr., H.E., etc.)",
    icon: User,
    path: "titles",
  },
  {
    key: "languages",
    title: "Languages",
    description: "ISO 639-1 language codes and native names",
    icon: Languages,
    path: "languages",
  },
  {
    key: "currencies",
    title: "Currencies",
    description: "ISO 4217 currency codes, symbols, and decimal digits",
    icon: Banknote,
    path: "currencies",
  },
  {
    key: "documentTypes",
    title: "Document Types",
    description: "Identity, travel, and accreditation document categories",
    icon: FileText,
    path: "document-types",
  },
] as const;

export default function ReferenceDataHubPage() {
  const { counts } = useLoaderData<typeof loader>();
  const basePrefix = useBasePrefix();
  const basePath = `${basePrefix}/settings/references`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">References</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage standardized lookup tables used across the platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {referenceTypes.map((type) => {
          const Icon = type.icon;
          const count = counts[type.key];
          return (
            <Link key={type.key} to={`${basePath}/${type.path}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{type.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {count} {count === 1 ? "record" : "records"}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
