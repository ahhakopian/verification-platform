# Bounded capability evidence summary

This release summary preserves the bounded Slice 4 dispositions. Development evidence is retained in canonical source, excluded from published assets because it contains caller runtime observations. These observations establish only the documented environment-specific scope, never a universal support promise.

## Target lifecycle

Ready browser-level observation saw owned page/worker creation, target changes and cleanup destruction. Observation starts only after discovery is enabled; finite buffers expose loss and session disconnect. Target identity must be discovered afresh. Initial Target.setDiscoverTargets callbacks describe existing targets and do not prove new creation; only post-readiness effects qualify. Observer/debugger attachment can affect lifecycle.

## Network

A finite page-session interval observed a controlled request, response, consumed body and loadingFinished without loss. Available request/session/frame and initiator fields are records, not sufficient extension attribution. Worker/frame coverage beyond the selected source remains unestablished. URL matching cannot prove extension identity or absence.

## Worker interruption

An exactly identified assigned dedicated worker rejected Target.closeTarget as unsupported. Interruption is unavailable in the established environment; no wake or reacquisition experiment followed. Forced stop is never proof of natural idle suspension.

## Permission

Exact-origin notifications permission snapshot was observed only at the tested insecure owned origin; other origins and permission names remain unestablished. Browser-wide or effective worker permission coverage and permission prompt/action behavior remain unestablished.

## Native menu

The generic `nativeMenuPath` was live-validated on the existing headed Chrome for Testing 154.0.8037.92 runtime using the built-in context-menu path `Отправить на устройство` → `Управление устройствами`. The assigned page target and fresh source geometry were bound to the exact DOM element; target-scoped CDP right-click opened a real Chrome native menu. UIA found the exact parent, observed it collapsed and expanded it, then uniquely associated the separately rooted submenu with the expanded parent and source window. The exact visible, enabled leaf was revalidated with InvokePattern and invoked through UIA.

The browser remained usable without foreground activation: the validated right-click path did not call bring-to-front, SetForegroundWindow or OS SendInput. A browser-level CDP before/after target observation correlated the invocation with one new Chrome page at `accounts.google.com/v3/signin/challenge/recaptcha`, whose continuation destination was `https://myaccount.google.com/device-activity?utm_source=chrome`. The correlation matched within the same native-menu lifecycle.

One earlier post-listing lookup returned `UIA element not found`. A focused diagnostic lookup kept the submenu HWND and RuntimeId stable, found the exact leaf and succeeded; the final full path also succeeded without a behavioral workaround. This does not establish arbitrary native desktop menus, all Chrome menu paths, other browser versions or other platforms. See [native menu contract](native-menu.md).

Focused native-menu tests, the full platform suite and Windows mocked/core/parser regressions pass. These complement the bounded live proof; they do not broaden its established scope.

## Native cancellation

An owned Windows invocation process was observed alive, cancelled once and then absent. Caller Chrome was preserved. Live effectful cancellation is unestablished; cancellation after potential effects preserves uncertainty and never automatically repeats an action.
