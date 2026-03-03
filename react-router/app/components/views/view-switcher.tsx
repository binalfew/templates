import { useSearchParams } from "react-router";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";

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
    return null;
  }

  return (
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
  );
}
