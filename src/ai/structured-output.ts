import { CMError } from "../common/core.js";
type Schema = Record<string, unknown>;
const object = (properties: Record<string, unknown>): Schema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const dictionary = () =>
  object({
    entries: {
      type: "array",
      items: object({
        key: { type: "string" },
        value_json: {
          type: "string",
          description: "A complete JSON-encoded value, not prose.",
        },
      }),
    },
  });
function nullable(schema: Schema): Schema {
  return { anyOf: [schema, { type: "null" }] };
}
function permitsNull(schema: Schema): boolean {
  return (
    schema.type === "null" ||
    (Array.isArray(schema.type) && schema.type.includes("null")) ||
    (Array.isArray(schema.enum) && schema.enum.includes(null)) ||
    (!schema.type && !schema.enum)
  );
}
/** Transport codec; original schemas stay unchanged and remain authoritative after decoding. */
export function transportSchema(original: object): Schema {
  const s = original as Schema;
  if (!s.type && !s.enum)
    return object({
      json_value: {
        type: "string",
        description: "A complete JSON-encoded value.",
      },
    });
  if (s.type === "object") {
    const properties = s.properties as Record<string, Schema> | undefined;
    if (!properties || !Object.keys(properties).length) return dictionary();
    const required = new Set((s.required as string[]) ?? []);
    const converted = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        required.has(key)
          ? transportSchema(value)
          : nullable(transportSchema(value)),
      ]),
    );
    converted.__omitted = {
      type: "array",
      items: { type: "string" },
      description:
        "Names of optional properties intentionally omitted; their placeholders are still null.",
    };
    if (s.additionalProperties !== false) converted.__extra = dictionary();
    return object(converted);
  }
  if (s.type === "array")
    return { type: "array", items: transportSchema((s.items ?? {}) as Schema) };
  const result: Schema = {};
  for (const key of [
    "type",
    "enum",
    "description",
    "minimum",
    "maximum",
    "minLength",
    "maxLength",
    "pattern",
  ])
    if (s[key] !== undefined) result[key] = s[key];
  return result;
}
const safeKey = (key: string) =>
  !["__proto__", "constructor", "prototype"].includes(key);
function decodeDictionary(value: unknown): Record<string, unknown> {
  const entries = (
    value as { entries?: Array<{ key: string; value_json: string }> }
  )?.entries;
  if (!Array.isArray(entries))
    throw new CMError("validation_error", "Malformed dictionary transport");
  const output: Record<string, unknown> = {};
  for (const { key, value_json } of entries) {
    if (!safeKey(key) || Object.hasOwn(output, key))
      throw new CMError(
        "validation_error",
        "Invalid or duplicate transport key",
      );
    output[key] = JSON.parse(value_json) as unknown;
  }
  return output;
}
export function decodeTransport(original: object, value: unknown): unknown {
  const s = original as Schema;
  if (value === null) return null;
  if (!s.type && !s.enum)
    return JSON.parse((value as { json_value: string }).json_value) as unknown;
  if (s.type === "object") {
    const properties = s.properties as Record<string, Schema> | undefined;
    if (!properties || !Object.keys(properties).length)
      return decodeDictionary(value);
    const raw = value as Record<string, unknown>,
      out: Record<string, unknown> = {};
    const required = new Set((s.required as string[]) ?? []);
    const omitted = raw.__omitted as string[];
    if (
      !Array.isArray(omitted) ||
      new Set(omitted).size !== omitted.length ||
      omitted.some((k) => required.has(k) || !Object.hasOwn(properties, k))
    )
      throw new CMError(
        "validation_error",
        "Invalid optional-field omission list",
      );
    for (const [key, property] of Object.entries(properties)) {
      if (omitted.includes(key)) continue;
      const v = raw[key];
      if (v === null && !required.has(key) && !permitsNull(property)) continue;
      out[key] = decodeTransport(property, v);
    }
    if (raw.__extra) {
      for (const [key, v] of Object.entries(decodeDictionary(raw.__extra))) {
        if (Object.hasOwn(out, key) || Object.hasOwn(properties, key))
          throw new CMError(
            "validation_error",
            "Transport extension overwrote a declared property",
          );
        out[key] = v;
      }
    }
    return out;
  }
  if (s.type === "array")
    return (value as unknown[]).map((v) =>
      decodeTransport((s.items ?? {}) as Schema, v),
    );
  return value;
}
/** Used by transport tests and fake SDKs; never converts fixtures into purported live output. */
export function encodeTransport(original: object, value: unknown): unknown {
  const s = original as Schema;
  if (!s.type && !s.enum) return { json_value: JSON.stringify(value) };
  if (value === null) return null;
  const dict = (v: Record<string, unknown>) => ({
    entries: Object.entries(v).map(([key, item]) => ({
      key,
      value_json: JSON.stringify(item),
    })),
  });
  if (s.type === "object") {
    const props = s.properties as Record<string, Schema> | undefined;
    const raw = value as Record<string, unknown>;
    if (!props || !Object.keys(props).length) return dict(raw);
    return {
      ...Object.fromEntries(
        Object.entries(props).map(([k, p]) => [
          k,
          raw[k] === undefined ? null : encodeTransport(p, raw[k]),
        ]),
      ),
      __omitted: Object.keys(props).filter((k) => !Object.hasOwn(raw, k)),
      ...(s.additionalProperties !== false
        ? {
            __extra: dict(
              Object.fromEntries(
                Object.entries(raw).filter(([k]) => !Object.hasOwn(props, k)),
              ),
            ),
          }
        : {}),
    };
  }
  if (s.type === "array")
    return (value as unknown[]).map((v) =>
      encodeTransport((s.items ?? {}) as Schema, v),
    );
  return value;
}
