/**
 * The class of a library root outside a data view: the default UI kit puts it on every
 * portalled element (dialogs, popovers, menus, selects, tooltips, toasts), and a host puts
 * it on an element of its own that holds library components outside `<UdcDataView>`.
 * `@jsudc/react/styles.scoped.css` declares its tokens and resets only on `.udc-data-view`
 * and this class.
 */
export const UDC_SCOPE_CLASS = "udc-scope";
