const collator = new Intl.Collator(undefined, {
  usage: "search",
  sensitivity: "base",
});

export function findTypeaheadMatch<T>(
  candidates: T[],
  text: string,
  label: (value: T) => string,
) {
  const query = text.normalize("NFC");
  function prefix(search: string) {
    return candidates.find(
      (value) =>
        collator.compare(
          label(value).normalize("NFC").slice(0, search.length),
          search,
        ) === 0,
    );
  }

  const fullMatch = prefix(query);
  if (fullMatch !== undefined) return fullMatch;
  if (
    query.length < 2 ||
    ![...query].every((character) => character === query[0])
  )
    return;

  return prefix(query[0]);
}
