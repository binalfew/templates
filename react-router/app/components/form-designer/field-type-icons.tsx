import {
  Type,
  AlignLeft,
  Hash,
  ToggleLeft,
  Calendar,
  Clock,
  List,
  ListChecks,
  Mail,
  Link2,
  Phone,
  FileUp,
  Image,
  ArrowUpRight,
  FunctionSquare,
  Braces,
  type LucideIcon,
} from "lucide-react";

const fieldTypeIconMap: Record<string, LucideIcon> = {
  TEXT: Type,
  LONG_TEXT: AlignLeft,
  NUMBER: Hash,
  BOOLEAN: ToggleLeft,
  DATE: Calendar,
  DATETIME: Clock,
  ENUM: List,
  MULTI_ENUM: ListChecks,
  EMAIL: Mail,
  URL: Link2,
  PHONE: Phone,
  FILE: FileUp,
  IMAGE: Image,
  REFERENCE: ArrowUpRight,
  FORMULA: FunctionSquare,
  JSON: Braces,
};

export function getFieldTypeIcon(dataType: string): LucideIcon {
  return fieldTypeIconMap[dataType] ?? Type;
}

export interface FieldCategory {
  label: string;
  types: string[];
}

export const fieldCategories: FieldCategory[] = [
  { label: "Text", types: ["TEXT", "LONG_TEXT", "EMAIL", "URL", "PHONE"] },
  { label: "Number & Logic", types: ["NUMBER", "BOOLEAN", "FORMULA"] },
  { label: "Date & Time", types: ["DATE", "DATETIME"] },
  { label: "Selection", types: ["ENUM", "MULTI_ENUM"] },
  { label: "Media & Files", types: ["FILE", "IMAGE"] },
  { label: "Advanced", types: ["REFERENCE", "JSON"] },
];

export function getFieldTypeLabel(dataType: string): string {
  const labels: Record<string, string> = {
    TEXT: "Text",
    LONG_TEXT: "Long Text",
    NUMBER: "Number",
    BOOLEAN: "Boolean",
    DATE: "Date",
    DATETIME: "Date & Time",
    ENUM: "Dropdown",
    MULTI_ENUM: "Multi Select",
    EMAIL: "Email",
    URL: "URL",
    PHONE: "Phone",
    FILE: "File Upload",
    IMAGE: "Image",
    REFERENCE: "Reference",
    FORMULA: "Formula",
    JSON: "JSON",
  };
  return labels[dataType] ?? dataType;
}
