// The published declarations as a host sees them: every subpath through the package's own
// `exports` (a self-reference to dist/, so run it after `npm run build`), compiled once under
// moduleResolution NodeNext and once under Bundler (smoke/tsconfig.*.json). An import the
// declarations cannot resolve turns its types into `any`; the @ts-expect-error lines fail then.
import { createRendererRegistry, UdcDataView, UdcProvider } from "@jsudc/react";
import { RENDERERS } from "@jsudc/react/all";
import { cardsRenderer } from "@jsudc/react/cards";
import { useDataViewState } from "@jsudc/react/headless";
import { UdcReactRouterUrlState } from "@jsudc/react/react-router";
import { tableRenderer } from "@jsudc/react/table";
import { defaultUiKit, Toaster } from "@jsudc/react/ui";

const registry = createRendererRegistry(tableRenderer, cardsRenderer);

// @ts-expect-error a number is not a renderer registry
export const notRegistry: typeof registry = 42;
// @ts-expect-error a number is not a renderer definition
createRendererRegistry(7);
// @ts-expect-error useDataViewState takes arguments of its own type, not a symbol
useDataViewState(Symbol());

export const used = [
  RENDERERS,
  UdcDataView,
  UdcProvider,
  UdcReactRouterUrlState,
  defaultUiKit,
  Toaster,
];
