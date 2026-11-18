# Hall layout schema (version 1)

Persisted format for the Shadi Maxing hall designer. Defined in `client/src/features/hall-designer/types/layout.ts` (types) and `types/layoutSchema.ts` (zod validation).

## Top level

| Field            | Type            | Notes                          |
| ---------------- | --------------- | ------------------------------ |
| `schema_version` | `1` (literal)   | Must be exactly `1`            |
| `hall`           | `Hall`          | See below                      |
| `objects`        | `HallObject[]`  | Order is significant for tables |

Only these three keys are persisted. UI state (selection, tool, viewport, hover, snap, grid) is never stored. Unknown keys are stripped on load.

## Conventions

- **Units:** metres only, never pixels. Origin is the top-left of the hall; x grows right, y grows down.
- **Center convention:** for every object, `x`,`y` is the object's **center**. NOTE: this differs from the original spec's sample JSON, which used top-left.
- **Rotation:** degrees, clockwise, about the object's center. The editor normalizes to `[0, 360)`; the schema accepts any finite number.
- **Local axes:** rect-like objects use `width` (local x) and `height` (local y).
- **IDs:** `` `${type}_${crypto.randomUUID().slice(0, 8)}` `` (e.g. `table_1a2b3c4d`). Objects are identified by id, never by array index. Ids must be non-empty strings.
- **Table labels:** "T1", "T2", ... are derived at render time from the order of tables in `objects[]`. They are never stored.
- **Capacity:** integer, 1 to 30 inclusive.
- **Opening thickness:** entrance/exit have a fixed visual thickness of 0.3 m. It is not stored; only `width` is.
- **Numbers:** all numbers must be finite. `width`, `height`, `radius` must be > 0 (the editor additionally enforces a minimum of 0.3 m).
- **Walls:** not supported in this step. `type: "wall"` is rejected.

## Hall

| Field    | Type     | Notes                |
| -------- | -------- | -------------------- |
| `id`     | string   | Non-empty            |
| `name`   | string   |                      |
| `width`  | number   | Metres, > 0          |
| `height` | number   | Metres, > 0          |
| `unit`   | `"m"`    | Literal              |

## Objects

Common fields for every object: `id` (string), `type`, `x` (m, center), `y` (m, center), `rotation` (degrees).

| `type`            | `shape`                     | Extra fields                  | Default size / capacity |
| ----------------- | --------------------------- | ----------------------------- | ----------------------- |
| `table`           | `round`                     | `radius`, `capacity`          | radius 1.2, cap 8       |
| `table`           | `rectangular`               | `width`, `height`, `capacity` | 2.4 x 1.2, cap 8        |
| `table`           | `square`                    | `width`, `height`, `capacity` | 1.5 x 1.5, cap 4        |
| `stage`           | n/a                         | `width`, `height`             | 12 x 4                  |
| `dance_floor`     | n/a                         | `width`, `height`             | 6 x 6                   |
| `restricted_area` | n/a                         | `width`, `height`             | 4 x 4                   |
| `service_area`    | n/a                         | `width`, `height`             | 4 x 3                   |
| `entrance`        | n/a                         | `width`                       | 3                       |
| `exit`            | n/a                         | `width`                       | 3                       |

Tables are discriminated on `type` first, then on `shape`.

## Example

```json
{
  "schema_version": 1,
  "hall": { "id": "hall-1", "name": "Main Wedding Hall", "width": 40, "height": 25, "unit": "m" },
  "objects": [
    { "id": "table_1a2b3c4d", "type": "table", "shape": "round", "x": 10.5, "y": 8, "rotation": 0, "radius": 1.2, "capacity": 8 },
    { "id": "entrance_5e6f7a8b", "type": "entrance", "x": 20, "y": 24.85, "rotation": 0, "width": 3 }
  ]
}
```

## Storage

Saved to `localStorage` under the key `shadi-maxing:layout:v1`.

## Changelog

- **v1** (current): initial schema for object tools. Center-based coordinates, metres, clockwise degrees. No walls.