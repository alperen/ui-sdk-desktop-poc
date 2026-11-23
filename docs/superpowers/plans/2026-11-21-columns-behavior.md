# Columns behavior implementation plan

Goal: Keep column navigation state in the UI SDK primitive.
Architecture: A ui-sdk columns primitive owns the open path and active column. Its column slots compose existing list controllers; createRovingFocus handles horizontal movement and direction. Native slot bindings handle scrolling when a selected child column mounts. React only renders generated createParts components. The primitive owns each list controller for the corresponding open path.

Constraints: Keep multi-selection, rename, menus, empty columns and keyboard behavior. No dependencies or fallback interaction paths.

- [x] Add the columns primitive and replace React maps, key handlers and effects with slot composition.
- [x] Keep existing browser regressions; add RTL, modifier/input isolation and independent column selection coverage.
- [x] Verify programmatic actions and click-scroll behavior, including empty columns and repeated ancestor navigation.

Review focus: column removal, focus staying in rename inputs, modifier keys, RTL direction, manual scrolling remaining stable on unrelated updates.

Regression tests cover right-to-left navigation, child-column removal, ancestor selection retention, folder IDs that collide with object keys, and changing the root folder.
