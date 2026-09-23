/**
 * Serialise a value for embedding inside an inline `<script>` element.
 *
 * `JSON.stringify` leaves `<` alone, and inside a script element the sequence
 * `</script>` ends the element no matter what JSON surrounds it. `<` is the
 * same character to a JSON parser and inert to the HTML parser, so the parsed value
 * is identical and the tag cannot be closed early.
 *
 * Use this for every `<script>` body built from data — JSON-LD, inline config, the
 * accessibility bootstrap — instead of calling `JSON.stringify` at the sink. Three
 * sinks each doing it by hand is how the third one forgets (#1241).
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
