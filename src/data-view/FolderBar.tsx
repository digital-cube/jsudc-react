import { ChevronRight, FolderOpen } from "lucide-react";
import { useI18n } from "../i18n/i18n.js";
import { folderCrumbs } from "./folder.js";

/** Where the folder listing is: the root, then each folder down to the open one; each opens on click. */
export function FolderBar({
  folder,
  onOpen,
}: {
  folder: string | null;
  onOpen: (path: string) => void;
}) {
  const { t } = useI18n();
  const crumbs = folderCrumbs(folder);
  const btn =
    "udc:rounded udc:px-1.5 udc:py-0.5 udc:hover:bg-hover udc:hover:text-foreground udc:focus-visible:outline-none udc:focus-visible:ring-2 udc:focus-visible:ring-ring";
  return (
    <nav
      aria-label={t("APP", "FOLDER_PATH")}
      data-testid="folder-bar"
      data-folder={folder ?? ""}
      className="udc:flex udc:flex-wrap udc:items-center udc:gap-0.5 udc:border-b udc:border-border udc:bg-muted/30 udc:px-3 udc:py-1.5 udc:text-[13px] udc:text-muted-foreground"
    >
      <FolderOpen className="udc:mr-1 udc:size-4 udc:text-sem-info" aria-hidden />
      <button
        type="button"
        data-testid="crumb-root"
        className={crumbs.length === 0 ? `${btn} udc:font-medium udc:text-foreground` : btn}
        onClick={() => onOpen("")}
      >
        {t("APP", "FOLDER_ROOT")}
      </button>
      {crumbs.map((c, i) => (
        <span key={c.path} className="udc:flex udc:items-center udc:gap-0.5">
          <ChevronRight className="udc:size-3.5 udc:opacity-60" aria-hidden />
          <button
            type="button"
            data-testid={`crumb-${c.path}`}
            className={i === crumbs.length - 1 ? `${btn} udc:font-medium udc:text-foreground` : btn}
            onClick={() => onOpen(c.path)}
          >
            {c.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
