"use client";

import React from "react";
import {
  getAdminUsers, createAdminUser, patchAdminUser, sendMagicLink, revokeUserSessions,
  getAuditLog,
  type AdminUser, type AuditLogEntry,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Shield, Users, ScrollText, Plus, X, Loader2, Mail, LogOut,
  CheckCircle2, XCircle, MoreHorizontal, ChevronDown,
} from "lucide-react";
import { formatDistanceToNow, format, parseISO } from "date-fns";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800",
  editor: "bg-blue-100 text-blue-800",
  viewer: "bg-slate-100 text-slate-600",
};

export default function AdminPage() {
  const { user: currentUser } = useAuth();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-[#0D5E6D]" />
        <h1 className="text-2xl font-bold text-slate-900">Admin Console</h1>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" /> Users</TabsTrigger>
          <TabsTrigger value="audit"><ScrollText className="h-4 w-4 mr-1.5" /> Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab currentUserId={currentUser?.id} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Users Tab
// ═══════════════════════════════════════════════════

function UsersTab({ currentUserId }: { currentUserId?: string }) {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [actionMsg, setActionMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setUsers(await getAdminUsers());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  async function handleCreate(data: { email: string; full_name: string; role: string }) {
    try {
      await createAdminUser(data);
      setShowCreate(false);
      setActionMsg({ type: "success", text: `User ${data.email} created. Magic link sent.` });
      refresh();
    } catch (err: any) {
      setActionMsg({ type: "error", text: err.message });
    }
  }

  async function handlePatch(id: string, body: Record<string, unknown>) {
    try {
      await patchAdminUser(id, body);
      setEditingId(null);
      setActionMsg({ type: "success", text: "User updated." });
      refresh();
    } catch (err: any) {
      setActionMsg({ type: "error", text: err.message });
    }
  }

  async function handleSendLink(id: string, email: string) {
    try {
      await sendMagicLink(id);
      setActionMsg({ type: "success", text: `Magic link sent to ${email}.` });
    } catch (err: any) {
      setActionMsg({ type: "error", text: err.message });
    }
  }

  async function handleRevokeSessions(id: string) {
    try {
      await revokeUserSessions(id);
      setActionMsg({ type: "success", text: "All sessions revoked." });
    } catch (err: any) {
      setActionMsg({ type: "error", text: err.message });
    }
  }

  if (loading) return <div className="flex items-center gap-2 py-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading users…</div>;

  return (
    <div className="space-y-4">
      {/* Action messages */}
      {actionMsg && (
        <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
          actionMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}>
          {actionMsg.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {actionMsg.text}
          <button onClick={() => setActionMsg(null)} className="ml-auto"><X className="h-3 w-3" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{users.length} user{users.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add User
        </Button>
      </div>

      {/* Create user form */}
      {showCreate && (
        <CreateUserForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
      )}

      {/* Users table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-slate-900">{u.full_name || "—"}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {editingId === u.id ? (
                    <RoleSelect
                      value={u.role}
                      onChange={(role) => handlePatch(u.id, { role })}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <Badge className={`${ROLE_COLORS[u.role]} border-0 cursor-pointer`} onClick={() => setEditingId(u.id)}>
                      {u.role}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {u.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 border-0">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {u.last_login_at
                    ? formatDistanceToNow(parseISO(u.last_login_at), { addSuffix: true })
                    : "Never"}
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {format(parseISO(u.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      title="Send magic link"
                      onClick={() => handleSendLink(u.id, u.email)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#0D5E6D]"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                    <button
                      title="Revoke sessions"
                      onClick={() => handleRevokeSessions(u.id)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                    {u.id !== currentUserId && (
                      <button
                        title={u.is_active ? "Deactivate" : "Activate"}
                        onClick={() => handlePatch(u.id, { is_active: !u.is_active })}
                        className={`rounded p-1.5 ${
                          u.is_active
                            ? "text-slate-400 hover:bg-red-50 hover:text-red-600"
                            : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                        }`}
                      >
                        {u.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Create User Form ───

function CreateUserForm({ onSubmit, onCancel }: {
  onSubmit: (data: { email: string; full_name: string; role: string }) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState("editor");

  return (
    <Card>
      <CardContent className="p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit({ email, full_name: fullName, role }); }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end"
        >
          <div className="space-y-1">
            <Label htmlFor="new-email" className="text-xs">Email</Label>
            <Input id="new-email" type="email" placeholder="user@venterraliving.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-name" className="text-xs">Full Name</Label>
            <Input id="new-name" placeholder="Jane Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-role" className="text-xs">Role</Label>
            <select
              id="new-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm"><Plus className="h-4 w-4 mr-1" /> Create</Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}><X className="h-4 w-4" /></Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Inline Role Selector ───

function RoleSelect({ value, onChange, onCancel }: {
  value: string;
  onChange: (role: string) => void;
  onCancel: () => void;
}) {
  return (
    <select
      defaultValue={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCancel}
      autoFocus
      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold"
    >
      <option value="viewer">viewer</option>
      <option value="editor">editor</option>
      <option value="admin">admin</option>
    </select>
  );
}

// ═══════════════════════════════════════════════════
// Audit Log Tab
// ═══════════════════════════════════════════════════

function AuditLogTab() {
  const [entries, setEntries] = React.useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    getAuditLog({ limit: 100 })
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center gap-2 py-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading audit log…</div>;
  if (entries.length === 0) return <p className="py-8 text-center text-slate-400">No audit entries yet.</p>;

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <React.Fragment key={e.id}>
              <TableRow className="cursor-pointer" onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                  {format(parseISO(e.created_at), "MMM d, HH:mm")}
                </TableCell>
                <TableCell className="text-sm">
                  {e.actor_name || e.actor_email || "System"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-mono">{e.action}</Badge>
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {e.entity_type}:{e.entity_id.slice(0, 8)}
                </TableCell>
                <TableCell className="text-right">
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedId === e.id ? "rotate-180" : ""}`} />
                </TableCell>
              </TableRow>
              {expandedId === e.id && (e.before_json || e.after_json) && (
                <TableRow>
                  <TableCell colSpan={5} className="bg-slate-50">
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      {e.before_json && (
                        <div>
                          <p className="mb-1 font-semibold text-slate-500">Before</p>
                          <pre className="whitespace-pre-wrap text-slate-600 bg-white p-2 rounded border">
                            {JSON.stringify(JSON.parse(e.before_json), null, 2)}
                          </pre>
                        </div>
                      )}
                      {e.after_json && (
                        <div>
                          <p className="mb-1 font-semibold text-slate-500">After</p>
                          <pre className="whitespace-pre-wrap text-slate-600 bg-white p-2 rounded border">
                            {JSON.stringify(JSON.parse(e.after_json), null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
