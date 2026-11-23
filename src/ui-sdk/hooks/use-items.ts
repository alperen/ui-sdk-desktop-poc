import { useState } from "react";
import type { FileEntry } from "../models/file-entry";

const initialEntries: FileEntry[] = [
  { id: "document", name: "Document", kind: "file", parentId: null },
  { id: "photos", name: "Photos", kind: "directory", parentId: null },
  { id: "beach", name: "Beach.jpg", kind: "file", parentId: "photos" },
  { id: "mountains", name: "Mountains.jpg", kind: "file", parentId: "photos" },
  { id: "sunset", name: "Sunset.jpg", kind: "file", parentId: "photos" },
  { id: "trips", name: "Trips", kind: "directory", parentId: "photos" },
  { id: "itinerary", name: "Itinerary.txt", kind: "file", parentId: "trips" },
  { id: "trips-2026", name: "2026", kind: "directory", parentId: "trips" },
  { id: "turkey", name: "Turkey", kind: "directory", parentId: "trips-2026" },
  { id: "greece", name: "Greece", kind: "directory", parentId: "trips-2026" },
  { id: "istanbul", name: "Istanbul", kind: "directory", parentId: "turkey" },
  { id: "unsorted", name: "Unsorted", kind: "directory", parentId: "turkey" },
  { id: "day-1", name: "Day 1", kind: "directory", parentId: "istanbul" },
  { id: "day-2", name: "Day 2", kind: "directory", parentId: "istanbul" },
  { id: "galata", name: "Galata.jpg", kind: "file", parentId: "day-1" },
  { id: "ferry", name: "Ferry.jpg", kind: "file", parentId: "day-1" },
  {
    id: "route",
    name: "Walking route.txt",
    kind: "file",
    parentId: "istanbul",
  },
  { id: "notes.txt", name: "notes.txt", kind: "file", parentId: null },
];

export function useItems(initialItems = initialEntries) {
  const [items, setItems] = useState(initialItems);

  return { items, setItems };
}
