import type { FileEntry } from "../../models/file-entry";

export function FileIcon({ kind }: { kind: FileEntry["kind"] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      width="100%"
      height="100%"
    >
      {kind === "directory" ? (
        <>
          <path
            d="M5 15a3 3 0 0 1 3-3h10l5 5h17a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z"
            fill="currentColor"
            fillOpacity="0.12"
          />
          <path d="M5 23h38" />
        </>
      ) : (
        <>
          <path
            d="M12 5h16l10 10v25a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"
            fill="var(--surface)"
          />
          <path d="M28 5v10h10M17 24h13M17 30h13M17 36h8" />
        </>
      )}
    </svg>
  );
}
