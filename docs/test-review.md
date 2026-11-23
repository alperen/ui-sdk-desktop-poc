# Behavior-focused test review

Reviewed all eight project test files on 2026-11-21, plus the browser configuration and relevant rename/window state code.

## Findings

1. **Medium — fixed-row lasso can do nothing and still pass** (`tests/list.test.tsx:53`). The earlier Shift+ArrowDown already selected a/b and left c unselected, exactly the expected state after the lasso. Cancellation at line 69 also checks only final state, without proving the gesture changed selection before Escape. Start with only c selected, verify the held lasso selects a/b, then release or cancel and assert the corresponding final selection. Split the independent keyboard, drag, lasso, and modifier scenarios so a failure does not skip the remaining coverage. Small effort.

2. **Medium — several window activation/maximize tests assert markers rather than outcomes** (`tests/window.test.tsx:188-227`, `380-396`). A `data-active` or `data-maximized` change alone can satisfy these tests even if stacking, shortcut routing, or window geometry is broken for that trigger. After reopening/clicking a background window, exercise a control in an overlapping area or a shortcut scoped to its contents. For keyboard/title-bar maximize, compare the resulting rectangle with the workspace, then verify restore geometry. Existing pointer maximize geometry coverage is good, but does not prove these other triggers perform the same operation. Small effort.

3. **Medium — Stop-hook fake does not verify what validation runs** (`scripts/agent-stop.test.mjs:13`). The fake pnpm ignores arguments, so replacing the validation command with an unrelated successful command would still pass. Record invocation arguments and verify that dirty state runs the configured validation gate, while clean state and active retries do not invoke it. Keep output/error assertions. Small effort.

4. **Medium — rename coverage does not constrain folder-scoped uniqueness or open-window identity** (`tests/folder.test.tsx:69`, `tests/item.test.tsx:330`). Duplicate rejection is tested only at the root. Reject a sibling name inside Photos, allow the same name in another parent, and rename an already-open file/folder. Check its existing window title/content updates, children remain reachable, and reopening does not create another window. Removing the parent comparison from duplicate detection would currently escape the tested scenarios. Medium effort.

5. **Low — presentation mechanics make behavior tests brittle** (`tests/window.test.tsx:141-168`, `tests/desktop.test.tsx:411`, `tests/item.test.tsx:212`). Exact animation count, animation object identity, a 350ms timeline sample, opacity 0.75, and zero bubbled keyboard events constrain implementation choices. Test temporary visible attention and preserved position, preview motion/cancellation, and unchanged selection/focus while typing. Keep callback assertions where they are the public component contract, ARIA assertions for accessible selection, and geometry assertions for movement/resize: those are observable behavior. Small-to-medium effort.

## File inventory

| File | Severity | Assessment |
| --- | --- | --- |
| tests/desktop.test.tsx | Low | Strong real keyboard/pointer selection, cancellation, movement and boundary coverage; exact preview opacity overconstrains styling. |
| tests/folder.test.tsx | Medium | Good nested navigation, active-list shortcut routing and layout state; missing scoped rename and open-window rename scenarios. |
| tests/item.test.tsx | Low | Good typing, cancellation, blank-name and IME guard coverage; propagation assertion constrains event plumbing. |
| tests/list.test.tsx | Medium | Lasso starts in expected final state; one long test combines independent behaviors. |
| tests/view-layout-control.test.tsx | Low | No actionable finding: callback and controlled rerender assertions test its public contract. |
| tests/window-state.test.tsx | Low | No actionable finding: harness verifies public state behavior for batched closes and missing IDs. |
| tests/window.test.tsx | Medium | Strong resize/restore boundaries; marker-only checks leave trigger-specific gaps and animation tests constrain mechanics. |
| scripts/agent-stop.test.mjs | Medium | Fake process boundary is appropriate; invocation contract is unasserted. |

## Readability

Names generally express behavior clearly. The fixed-row test combines too many independently useful scenarios. The repeated Ctrl/Cmd+A desktop tests cover distinct focus contexts and should not be removed merely as duplication.

## Reliability

Real Chromium interaction, isolated renders, mock restoration, and condition-based assertions are strengths. No arbitrary synchronization sleeps found. Animation inspection assumes the animation is still running after the double-click returns; this is timing-sensitive, though no failure was observed.

One Chromium run reported `VITEST_BROWSER_CONNECTION_CLOSED` in the window tests. Subsequent runs passed. The cause was undetermined.

## Diagnostic value

Most assertions show actual accessible state or geometry. Split the list and Stop-hook scenarios for independent failure reports. The list lasso assertions currently cannot distinguish a working gesture from no gesture.

## Design

Public callback, controller/agent API, accessibility and geometry tests are valid behavior tests. Replace incidental CSS, animation-object and event-propagation assertions selectively; do not rewrite the entire suite or mock internal collaborators.

## Coverage

Main gaps are folder-scoped rename rules, renaming already-open entries, and outcome assertions for alternative window activation/maximize triggers. Synthetic IME guard tests do not prove actual OS IME behavior or Safari compatibility. Configuration runs Chromium only.
