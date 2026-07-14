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
    <main className="page-container">
      <h1 className="text-3xl font-bold text-stone-900">Browse listings</h1>
      <p className="mt-1 text-stone-500">Search and filter open positions.</p>

      <form onSubmit={handleSubmit} className="card mt-6 grid gap-3 p-4 sm:grid-cols-3">
        <input
          type="text"
          placeholder="Search title/description…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="input-field"
        />
        <input
          type="text"
          placeholder="Tags (comma-separated)"
          value={filters.tags}
          onChange={(e) => setFilters({ ...filters, tags: e.target.value })}
          className="input-field"
        />
        <input
          type="text"
          placeholder="Location"
          value={filters.location}
          onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          className="input-field"
        />
        <button type="submit" className="btn-primary sm:col-span-3">
          Search
        </button>
      </form>

      <div className="mt-8 space-y-4">
        {status === "loading" && <p className="text-stone-500">Loading…</p>}
        {status === "error" && <p className="text-red-600">{error}</p>}
        {status !== "loading" && items.length === 0 && (
          <p className="text-stone-500">No listings match your search.</p>
        )}
        {items.map((listing) => (
          <ListingCard key={listing._id} listing={listing} />
        ))}
      </div>

      {nextCursor && (
        <button
          onClick={loadMore}
          disabled={status === "loading-more"}
          className="btn-secondary mt-6 w-full"
        >
          {status === "loading-more" ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
