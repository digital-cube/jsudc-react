import { ArrowLeftToLine, ArrowRightToLine, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { useI18n } from "../i18n/i18n";
import { cn } from "../lib/utils";
import { useUiKit } from "../ui-kit/context";
import type { SchemaAction } from "./fieldForm";

/**
 * The kebab on a column header: add a column before or after this one, edit
 * it, delete it. The trigger shows on header hover, on focus and while open.
 */
export function ColumnHeaderMenu({
  field,
  label,
  onAction,
  className,
}: {
  field: string;
  label: string;
  onAction: (a: SchemaAction) => void;
  className?: string;
}) {
  const {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } = useUiKit();
  const { t } = useI18n();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        data-testid={`col-menu-${field}`}
        aria-label={t("APP", "COL_MENU", { label })}
        className={cn(
          "udc:grid udc:size-6 udc:shrink-0 udc:place-items-center udc:rounded-md udc:text-muted-foreground udc:outline-none udc:transition-[opacity,background-color,color]",
          "udc:opacity-0 udc:group-hover/th:opacity-100 udc:focus-visible:opacity-100 udc:data-[state=open]:opacity-100",
          "udc:hover:bg-border/70 udc:hover:text-foreground udc:focus-visible:ring-2 udc:focus-visible:ring-ring udc:data-[state=open]:bg-border/70 udc:data-[state=open]:text-foreground",
          className,
        )}
      >
        <EllipsisVertical className="udc:size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent data-testid="col-menu" align="end">
        <DropdownMenuLabel className="udc:truncate">{label}</DropdownMenuLabel>
        <DropdownMenuItem
          data-testid="col-menu-add-before"
          onSelect={() => onAction({ kind: "add", position: { where: "before", anchor: field } })}
        >
          <ArrowLeftToLine />
          {t("APP", "COL_ADD_BEFORE")}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="col-menu-add-after"
          onSelect={() => onAction({ kind: "add", position: { where: "after", anchor: field } })}
        >
          <ArrowRightToLine />
          {t("APP", "COL_ADD_AFTER")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="col-menu-edit"
          onSelect={() => onAction({ kind: "edit", field })}
        >
          <Pencil />
          {t("APP", "COL_EDIT")}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="col-menu-delete"
          tone="danger"
          onSelect={() => onAction({ kind: "delete", field })}
        >
          <Trash2 />
          {t("APP", "COL_DELETE")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
