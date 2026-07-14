const STATUS_STYLES = {
  applied: "bg-slate-100 text-slate-700",
  shortlisted: "bg-blue-100 text-blue-700",
  interview: "bg-amber-100 text-amber-700",
  offer: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_LABELS = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
