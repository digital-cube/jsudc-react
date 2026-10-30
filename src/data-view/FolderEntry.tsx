import type { Row } from "@jsudc/core";
import { CornerLeftUp, File, Folder } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils.js";
import { type FolderNav, isFolderRow } from "../renderers/types.js";

/**
 * The label of a row of a folder listing: a folder (and `..`) as a link that
 * opens it, a file as a link to its preview when there is one, else plain.
 */
export function FolderEntry({
  row,
  nav,
  children,
  className,
}: {
  row: Row;
  nav: FolderNav;
  children: ReactNode;
  className?: string;
}) {
  const dir = isFolderRow(row, nav);
  const up = dir && row[nav.options.label_field] === "..";
  const Icon = up ? CornerLeftUp : dir ? Folder : File;
  const path = String(row[nav.options.path_field] ?? "");
  const onClick = dir ? () => nav.open(path) : nav.openFile ? () => nav.openFile?.(row) : undefined;
  const icon = (
    <Icon
      aria-hidden
      className={cn(
        "udc:size-4 udc:shrink-0",
        dir ? "udc:text-sem-info" : "udc:text-muted-foreground",
      )}
    />
  );
  if (!onClick) {
    return (
      <span className={cn("udc:flex udc:min-w-0 udc:items-center udc:gap-2", className)}>
        {icon}
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      data-testid={dir ? "folder-link" : "file-link"}
      data-path={path}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "udc:flex udc:min-w-0 udc:items-center udc:gap-2 udc:rounded-sm udc:text-left udc:focus-visible:outline-none udc:focus-visible:ring-2 udc:focus-visible:ring-ring",
        dir
          ? "udc:font-medium udc:text-sem-info udc:underline-offset-2 udc:hover:underline"
          : "udc:hover:text-foreground udc:hover:underline udc:underline-offset-2",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}
