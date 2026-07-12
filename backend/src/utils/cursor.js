/** Cursor pagination builds an opaque, base64-encoded cursor from the last item's sort key,
 * allowing efficient pagination without skip(). See agent-comms/DECISIONS.md for design rationale. */

export function encodeCursor(item) {
  if (!item || !item.createdAt || !item._id) {
    return null;
  }
  const payload = {
    createdAt: item.createdAt.toISOString(),
    _id: item._id.toString(),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decodeCursor(cursor) {
  if (!cursor) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    return {
      createdAt: new Date(payload.createdAt),
      _id: payload._id,
    };
  } catch {
    return null;
  }
}
