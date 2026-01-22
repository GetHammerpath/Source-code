import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  email_verified: boolean;
  role: string;
  status: string;
  created_at: string;
  last_login: string | null;
  credit_balance: number;
  studio_access_status: string | null;
  stripe_customer_id: string | null;
}

const AdminUsers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, roleFilter, statusFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, email_verified, created_at, last_login, stripe_customer_id")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all related data in parallel
      const usersWithData = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Get role
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id)
            .single();

          // Get status from user_limits
          const { data: limitsData } = await supabase
            .from("user_limits")
            .select("status")
            .eq("user_id", profile.id)
            .single();

          // Get credit balance
          const { data: balanceData } = await supabase
            .from("credit_balance")
            .select("credits")
            .eq("user_id", profile.id)
            .single();

          // Get subscription status
          const { data: subscriptionData } = await supabase
            .from("subscriptions")
            .select("status")
            .eq("user_id", profile.id)
            .eq("plan", "studio_access")
            .single();

          return {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            email_verified: profile.email_verified || false,
            role: roleData?.role || "contributor",
            status: limitsData?.status || "active",
            created_at: profile.created_at,
            last_login: profile.last_login,
            credit_balance: balanceData?.credits || 0,
            studio_access_status: subscriptionData?.status || null,
            stripe_customer_id: profile.stripe_customer_id,
          };
        })
      );

      setUsers(usersWithData);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          (user.full_name?.toLowerCase().includes(query) ?? false)
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((user) => user.status === statusFilter);
    }

    setFilteredUsers(filtered);
    setCurrentPage(1); // Reset to first page on filter change
  };

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <AdminPageHeader
          title="Users"
          subtitle="Manage users, roles, and account access"
        />

        {/* Filters */}
        <Card className="rounded-[10px] border">
          <CardContent className="pt-4">
            <div className="grid md:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by email or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-sm rounded-[8px]"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="rounded-[8px] h-9 text-sm">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="contributor">Contributor</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="rounded-[8px] h-9 text-sm">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="rounded-[10px] border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Users ({filteredUsers.length})</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Showing {paginatedUsers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : paginatedUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No users found
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Verified</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Last Login</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Studio Access</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.email}</TableCell>
                            <TableCell>{user.full_name || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={user.status === "active" ? "default" : "destructive"}
                              >
                                {user.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.email_verified ? (
                                <Badge variant="outline" className="text-green-600">
                                  Verified
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Unverified
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(user.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {user.last_login
                                ? format(new Date(user.last_login), "MMM d, yyyy")
                                : "Never"}
                            </TableCell>
                            <TableCell className="font-medium">
                              {user.credit_balance.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {user.studio_access_status ? (
                                <Badge
                                  variant={
                                    user.studio_access_status === "active" ? "default" : "secondary"
                                  }
                                  className="capitalize"
                                >
                                  {user.studio_access_status}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">None</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/admin/users/${user.id}`)}
                                className="h-7 px-2 text-xs"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="h-8 text-xs"
                        >
                          <ChevronLeft className="h-3 w-3" />
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="h-8 text-xs"
                        >
                          Next
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
    </AdminLayout>
  );
};

export default AdminUsers;
