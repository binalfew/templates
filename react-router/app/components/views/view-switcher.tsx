import { useSearchParams, Link } from "react-router";
import { Settings } from "lucide-react";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Button } from "~/components/ui/button";
import { useBasePrefix } from "~/hooks/use-base-prefix";

interface ViewOption {
  id: string;
  name: string;
  viewType: string;
  isDefault: boolean;
  isShared: boolean;
}

interface ViewSwitcherProps {
  availableViews: ViewOption[];
  activeViewId: string | null;
}

const viewTypeLabels: Record<string, string> = {
  TABLE: "Table",
  KANBAN: "Kanban",
  CALENDAR: "Calendar",
  GALLERY: "Gallery",
};

export function ViewSwitcher({ availableViews, activeViewId }: ViewSwitcherProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const base = useBasePrefix();

  function handleViewChange(viewId: string) {
    const params = new URLSearchParams(searchParams);
    if (viewId) {
      params.set("viewId", viewId);
    } else {
      params.delete("viewId");
    }
    setSearchParams(params);
  }

  if (availableViews.length === 0) {
    return (
      <Button variant="outline" size="default" className="w-full sm:w-auto" asChild>
        <Link to={`${base}/views`}>
          <Settings className="h-3.5 w-3.5" />
          Manage Views
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <NativeSelect
        value={activeViewId ?? ""}
        onChange={(e) => handleViewChange(e.target.value)}
        className="w-full sm:w-auto sm:min-w-[160px]"
      >
        <NativeSelectOption value="">Default View</NativeSelectOption>
        {availableViews.map((view) => (
          <NativeSelectOption key={view.id} value={view.id}>
            {view.name} ({viewTypeLabels[view.viewType]})
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <Button variant="outline" size="default" className="w-full sm:w-auto" asChild>
        <Link to={`${base}/views`}>
          <Settings className="h-3.5 w-3.5" />
          Manage Views
        </Link>
      </Button>
    </div>
  );
}
