import { Link } from "react-router-dom";

export function ListingCard({ listing }) {
  return (
    <Link
      to={`/listings/${listing._id}`}
      className="block rounded border border-gray-200 p-4 hover:border-gray-400"
    >
      <h2 className="text-lg font-semibold">{listing.title}</h2>
      <p className="mt-1 text-sm text-gray-500">{listing.location}</p>
      <p className="mt-2 line-clamp-2 text-sm text-gray-700">{listing.description}</p>
      {listing.tags?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {listing.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
