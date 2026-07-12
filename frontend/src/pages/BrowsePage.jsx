import { useEffect, useState, useCallback } from "react";
import { ListingCard } from "../components/ListingCard.jsx";
import { getListings } from "../api/listings.js";

const LIMIT = 10;

export function BrowsePage() {
  const [filters, setFilters] = useState({ search: "", tags: "", location: "" });
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | loading-more | error
  const [error, setError] = useState(null);

  const buildParams = useCallback(
    (cursor) => {
      const params = { limit: LIMIT };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.location.trim()) params.location = filters.location.trim();
      if (filters.tags.trim()) {
        params.tags = filters.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
      if (cursor) params.cursor = cursor;
      return params;
    },
    [filters]
  );

  const runSearch = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const { items: newItems, nextCursor: cursor } = await getListings(buildParams());
      setItems(newItems);
      setNextCursor(cursor);
      setStatus("ready");
    } catch (err) {
      setError(err.response?.data?.error?.message ?? "Failed to load listings");
      setStatus("error");
    }
  }, [buildParams]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  async function loadMore() {
    setStatus("loading-more");
    try {
      const { items: moreItems, nextCursor: cursor } = await getListings(buildParams(nextCursor));
      setItems((prev) => [...prev, ...moreItems]);
      setNextCursor(cursor);
      setStatus("ready");
    } catch (err) {
      setError(err.response?.data?.error?.message ?? "Failed to load more listings");
      setStatus("error");
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    runSearch();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Browse listings</h1>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-3 sm:grid-cols-3">
        <input
          type="text"
          placeholder="Search title/description…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="rounded border border-gray-300 px-3 py-2 sm:col-span-1"
        />
        <input
          type="text"
          placeholder="Tags (comma-separated)"
          value={filters.tags}
          onChange={(e) => setFilters({ ...filters, tags: e.target.value })}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <input
          type="text"
          placeholder="Location"
          value={filters.location}
          onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-white sm:col-span-3"
        >
          Search
        </button>
      </form>

      <div className="mt-8 space-y-4">
        {status === "loading" && <p className="text-gray-500">Loading…</p>}
        {status === "error" && <p className="text-red-600">{error}</p>}
        {status !== "loading" && items.length === 0 && (
          <p className="text-gray-500">No listings match your search.</p>
        )}
        {items.map((listing) => (
          <ListingCard key={listing._id} listing={listing} />
        ))}
      </div>

      {nextCursor && (
        <button
          onClick={loadMore}
          disabled={status === "loading-more"}
          className="mt-6 w-full rounded border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          {status === "loading-more" ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
