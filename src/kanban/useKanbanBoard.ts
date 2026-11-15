import type { DescribeResponse, KanbanOptions } from "@jsudc/core";
import { useCallback, useMemo } from "react";
import { decodeFilterParam, PARAM } from "../data-view/urlState.js";
import { useUdcCollection, useUdcDescribe } from "../udc/hooks.js";
import { useUrlSearchParams } from "../url-state/UrlState.js";
import { boardFromFilter, boardSource } from "./model.js";

export const BOARD_PARAM = "board";
const MAX_BOARDS = 200;

export interface BoardChoice {
  id: string;
  label: string;
}

export interface KanbanBoardState {
  opts: KanbanOptions | undefined;
  boards: BoardChoice[];
  /**
   * `?board=` when it names a board, else the board an `eq` on
   * `ticket_board_field` in `?f=` names (a `row_link` drill-down), else the
   * first board; `null` while loading.
   */
  boardId: string | null;
  setBoard: (id: string) => void;
  isLoading: boolean;
}

/**
 * The board on screen and the boards to switch between. The board collection
 * is the `ref` of the card's board field; it is listed in its `order` field
 * when it has the bucket order's name, else by label. The toolbar switcher
 * and the renderer both call this; they share the query.
 */
export function useKanbanBoard(describe: DescribeResponse): KanbanBoardState {
  const opts = describe.view.kanban_options;
  const source = opts ? boardSource(describe.schema, opts) : null;
  const boardsDescribe = useUdcDescribe(source?.collection ?? "");
  const boardFields = boardsDescribe.data?.schema.fields;
  const sortField =
    opts && boardFields?.[opts.bucket_order_field] ? opts.bucket_order_field : source?.labelField;

  const list = useUdcCollection({
    collection: source?.collection ?? "",
    sort: sortField ? [{ field: sortField }] : [],
    mode: "pages",
    pageLimit: MAX_BOARDS,
    enabled: source !== null && boardsDescribe.isSuccess,
  });

  const boards = useMemo(
    () =>
      list.rows.map((r) => ({
        id: r.__meta.id,
        label: String(r[source?.labelField ?? "name"] ?? r.__meta.id),
      })),
    [list.rows, source?.labelField],
  );

  const [params, setParams] = useUrlSearchParams();
  const wanted = params.get(BOARD_PARAM);
  const fParam = params.get(PARAM.filter);
  // A drill-down (`?f=board eq X`, no `?board=`) lands on board X, not on the first one.
  const filtered = useMemo(
    () => (opts ? boardFromFilter(decodeFilterParam(fParam), opts.ticket_board_field) : null),
    [fParam, opts],
  );
  const known = (id: string | null) => (id ? boards.find((b) => b.id === id)?.id : undefined);
  // Without a board collection the URL alone names the board.
  const boardId = source
    ? (known(wanted) ?? known(filtered) ?? boards[0]?.id ?? null)
    : (wanted ?? filtered);

  const setBoard = useCallback(
    (id: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(BOARD_PARAM, id);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  return {
    opts,
    boards,
    boardId,
    setBoard,
    isLoading: source !== null && (boardsDescribe.isLoading || list.isLoading),
  };
}
