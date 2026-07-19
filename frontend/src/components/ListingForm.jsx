import { useState } from "react";

const emptyForm = { title: "", description: "", location: "", tags: "", openings: "" };

export function ListingForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(
    initial
      ? { ...initial, tags: (initial.tags ?? []).join(", "), openings: initial.openings ?? "" }
      : emptyForm
  );
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        title: form.title,
        description: form.description,
        location: form.location,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        // Blank means unlimited — omit the field entirely rather than sending an empty string
        // or 0 (the backend schema requires a positive integer when the field is present at all).
        ...(form.openings !== "" ? { openings: Number(form.openings) } : {}),
      });
    } catch (err) {
      setError(err.response?.data?.error?.message ?? "Failed to save listing");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3 p-4">
      <div>
        <label className="block text-sm font-medium text-stone-700">Title</label>
        <input
          type="text"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="input-field mt-1"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Description</label>
        <textarea
          required
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input-field mt-1"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-stone-700">Location</label>
          <input
            type="text"
            required
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="input-field mt-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700">Tags (comma-separated)</label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="input-field mt-1"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">
          Openings <span className="font-normal text-stone-500">(leave blank for unlimited)</span>
        </label>
        <input
          type="number"
          min="1"
          step="1"
          value={form.openings}
          onChange={(e) => setForm({ ...form, openings: e.target.value })}
          className="input-field mt-1"
          placeholder="Unlimited"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
