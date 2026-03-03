import { Form, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface DeleteFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: { id: string; label: string; name: string } | null;
  dataCount: number;
}

export function DeleteFieldDialog({
  open,
  onOpenChange,
  field,
  dataCount,
}: DeleteFieldDialogProps) {
  const navigation = useNavigation();
  const isDeleting =
    navigation.state === "submitting" && navigation.formData?.get("_action") === "delete";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Field</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the field &ldquo;{field?.label}&rdquo; ({field?.name})?
          </DialogDescription>
        </DialogHeader>

        {dataCount > 0 && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Warning: {dataCount} record{dataCount !== 1 ? "s" : ""} contain data for this field.
            Deleting will not remove the data from those records, but it will no longer be displayed
            or validated.
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Form method="post">
            <input type="hidden" name="_action" value="delete" />
            <input type="hidden" name="fieldId" value={field?.id ?? ""} />
            {dataCount > 0 && <input type="hidden" name="force" value="true" />}
            <Button type="submit" variant="destructive" disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
