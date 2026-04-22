"use client";

import React from "react";
import {
  createCommunity,
  deleteCommunity,
  getCommunities,
  patchCommunity,
  type Community,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

type CommunityFormState = {
  name: string;
  external_key: string;
  region: string;
  manager_name: string;
  unit_count: string;
  ga4_property_id: string;
  full_url: string;
  encasa_short_name: string;
  encasa_property_code: string;
  city: string;
  state: string;
};

const EMPTY_FORM: CommunityFormState = {
  name: "",
  external_key: "",
  region: "",
  manager_name: "",
  unit_count: "",
  ga4_property_id: "",
  full_url: "",
  encasa_short_name: "",
  encasa_property_code: "",
  city: "",
  state: "",
};

function toFormState(community?: Community | null): CommunityFormState {
  if (!community) return EMPTY_FORM;
  return {
    name: community.name ?? "",
    external_key: community.external_key ?? "",
    region: community.region ?? "",
    manager_name: community.manager_name ?? "",
    unit_count: community.unit_count != null ? String(community.unit_count) : "",
    ga4_property_id: community.ga4_property_id ?? "",
    full_url: community.full_url ?? "",
    encasa_short_name: community.encasa_short_name ?? "",
    encasa_property_code: community.encasa_property_code ?? "",
    city: community.city ?? "",
    state: community.state ?? "",
  };
}

function buildPayload(form: CommunityFormState) {
  return {
    name: form.name.trim(),
    external_key: form.external_key.trim() || undefined,
    region: form.region.trim() || undefined,
    manager_name: form.manager_name.trim() || undefined,
    unit_count: form.unit_count.trim() ? Number(form.unit_count) : undefined,
    ga4_property_id: form.ga4_property_id.trim() || undefined,
    full_url: form.full_url.trim() || undefined,
    encasa_short_name: form.encasa_short_name.trim() || undefined,
    encasa_property_code: form.encasa_property_code.trim() || undefined,
    city: form.city.trim() || undefined,
    state: form.state.trim() || undefined,
  };
}

function CommunityForm({
  title,
  form,
  onChange,
  onSubmit,
  onCancel,
  busy,
  submitLabel,
}: {
  title: string;
  form: CommunityFormState;
  onChange: (next: CommunityFormState) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  const setField = (field: keyof CommunityFormState, value: string) => {
    onChange({ ...form, [field]: value });
  };

  const fields: Array<{ key: keyof CommunityFormState; label: string; type?: string }> = [
    { key: "name", label: "Community Name" },
    { key: "external_key", label: "External Key" },
    { key: "region", label: "Region" },
    { key: "manager_name", label: "Manager Name" },
    { key: "unit_count", label: "Unit Count", type: "number" },
    { key: "ga4_property_id", label: "GA4 Property ID" },
    { key: "full_url", label: "Full URL", type: "url" },
    { key: "encasa_short_name", label: "Encasa Short Name" },
    { key: "encasa_property_code", label: "Encasa Property Code" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key}>
            <Label htmlFor={field.key} className="mb-2 block text-sm text-slate-700">
              {field.label}
            </Label>
            <Input
              id={field.key}
              type={field.type ?? "text"}
              value={form[field.key]}
              onChange={(event) => setField(field.key, event.target.value)}
              placeholder={field.label}
            />
          </div>
        ))}
        <div className="md:col-span-2 flex gap-3 pt-2">
          <Button onClick={onSubmit} disabled={busy || !form.name.trim()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {submitLabel}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommunitiesPage() {
  const [communities, setCommunities] = React.useState<Community[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [createForm, setCreateForm] = React.useState<CommunityFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = React.useState<CommunityFormState>(EMPTY_FORM);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setCommunities(await getCommunities());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load communities");
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createCommunity(buildPayload(createForm));
      setCreateForm(EMPTY_FORM);
      setSuccess("Community created.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create community");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await patchCommunity(editingId, buildPayload(editForm));
      setEditingId(null);
      setEditForm(EMPTY_FORM);
      setSuccess("Community updated.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update community");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    setSuccess(null);
    try {
      await deleteCommunity(id);
      if (editingId === id) {
        setEditingId(null);
        setEditForm(EMPTY_FORM);
      }
      setSuccess("Community deleted.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete community");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-[#15284B]" />
          <div>
            <h1 className="text-3xl font-bold text-[#15284B]">Communities</h1>
            <p className="mt-2 text-slate-600">Create, edit, and retire communities through the same governed API the Pond already exposes.</p>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex items-start gap-3 p-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              <p className="text-sm text-green-700">{success}</p>
            </CardContent>
          </Card>
        )}

        <CommunityForm
          title="Add Community"
          form={createForm}
          onChange={setCreateForm}
          onSubmit={handleCreate}
          busy={saving}
          submitLabel="Create Community"
        />

        {editingId && (
          <CommunityForm
            title="Edit Community"
            form={editForm}
            onChange={setEditForm}
            onSubmit={handleEditSave}
            onCancel={() => {
              setEditingId(null);
              setEditForm(EMPTY_FORM);
            }}
            busy={saving}
            submitLabel="Save Changes"
          />
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Active Communities</CardTitle>
            <Badge className="border-0 bg-slate-100 text-slate-700">{communities.length} active</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading communities…
              </div>
            ) : communities.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">No active communities found.</p>
            ) : (
              <div className="space-y-3">
                {communities.map((community) => (
                  <div key={community.id} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{community.name}</p>
                        <Badge className="border-0 bg-emerald-100 text-emerald-700">{community.status}</Badge>
                      </div>
                      <div className="text-sm text-slate-600">
                        {[community.region, community.city, community.state].filter(Boolean).join(" • ") || "Region pending"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {[
                          community.external_key ? `Key: ${community.external_key}` : null,
                          community.manager_name ? `Manager: ${community.manager_name}` : null,
                          community.unit_count != null ? `${community.unit_count} units` : null,
                        ].filter(Boolean).join(" • ")}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId(community.id);
                          setEditForm(toFormState(community));
                          setError(null);
                          setSuccess(null);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={deletingId === community.id}
                        onClick={() => handleDelete(community.id)}
                      >
                        {deletingId === community.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
