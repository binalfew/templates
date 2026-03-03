import { Link } from "react-router";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

interface Column {
  key: string;
  label: string;
  className?: string;
}

interface ReferenceDataTableProps {
  items: Array<Record<string, any>>;
  columns: Column[];
  baseUrl: string;
  idField?: string;
}

export function ReferenceDataTable({
  items,
  columns,
  baseUrl,
  idField = "id",
}: ReferenceDataTableProps) {
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left font-medium text-muted-foreground ${col.className ?? ""}`}
              >
                {col.label}
              </th>
            ))}
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item[idField]} className="border-b last:border-0 hover:bg-muted/30">
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-2.5 ${col.className ?? ""}`}>
                  {col.key === "code" ? (
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {item[col.key]}
                    </span>
                  ) : (
                    <span className="text-foreground">{item[col.key] ?? "—"}</span>
                  )}
                </td>
              ))}
              <td className="px-4 py-2.5 text-center">
                <Badge variant={item.isActive ? "default" : "secondary"}>
                  {item.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                    <Link to={`${baseUrl}/${item[idField]}/edit`}>
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Edit</span>
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Link to={`${baseUrl}/${item[idField]}/delete`}>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete</span>
                    </Link>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
