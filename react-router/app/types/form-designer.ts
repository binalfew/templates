export interface FormDefinition {
  settings?: FormSettings;
  pages: FormPage[];
}

export interface FormSettings {
  displayMode: "wizard" | "single-page" | "accordion";
  showProgressBar: boolean;
  submitButtonText: string;
  successMessage?: string;
  redirectUrl?: string;
  enableAnalytics?: boolean;
  enablePrefill?: boolean;
  abTestVariant?: string;
}

export interface FormPage {
  id: string;
  title: string;
  description?: string;
  order: number;
  visibleIf?: VisibilityCondition;
  sections: FormSection[];
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  columns: 1 | 2 | 3 | 4;
  collapsible: boolean;
  defaultCollapsed?: boolean;
  order: number;
  visibleIf?: VisibilityCondition;
  fields: FormFieldPlacement[];
}

export interface FormFieldPlacement {
  id: string;
  fieldDefinitionId: string;
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  rowSpan?: number;
  order: number;
  visibleIf?: VisibilityCondition;
}

export type VisibilityCondition = SimpleCondition | CompoundCondition;

export interface SimpleCondition {
  type: "simple";
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface CompoundCondition {
  type: "compound";
  operator: "and" | "or";
  conditions: VisibilityCondition[];
}

export type ConditionOperator =
  | "eq"
  | "neq"
  | "empty"
  | "notEmpty"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "in"
  | "notIn";
