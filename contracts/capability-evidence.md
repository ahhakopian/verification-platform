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

Explicitly authorized focus and Shift+F10 on a disposable verifier-owned fixture exposed no eligible UIA Menu/MenuItem. Native menu Invoke/Expand is unestablished; no coordinate fallback exists.

## Native cancellation

An owned Windows invocation process was observed alive, cancelled once and then absent. Caller Chrome was preserved. Live effectful cancellation is unestablished; cancellation after potential effects preserves uncertainty and never automatically repeats an action.
