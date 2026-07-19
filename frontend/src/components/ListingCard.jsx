import { Link } from "react-router-dom";

export function ListingCard({ listing }) {
  return (
    <Link
      to={`/listings/${listing._id}`}
      className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-stone-900">{listing.title}</h2>
        <span className="shrink-0 text-sm text-stone-500">{listing.location}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-stone-600">{listing.description}</p>
      {listing.openings != null && (
        <p className="mt-2 text-xs font-medium text-stone-500">
          {Math.max(listing.openings - listing.filledCount, 0)} of {listing.openings} openings left
        </p>
      )}
      {listing.tags?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {listing.tags.map((tag) => (
            <li key={tag} className="tag-pill">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
