"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/v1/admin/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.items ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading users…</p>;

  return (
    <div>
      <h1>Admin — Users</h1>
      {users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <ul>
          {users.map((u: any) => (
            <li key={u.id}>{u.email} — {u.role} — {u.is_active ? "Active" : "Inactive"}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
