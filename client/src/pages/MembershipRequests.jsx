import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Search,
  Filter,
  Check,
  X,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import { membershipRequestApi } from "../services";

const STATUS_STYLES = {
  pending: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    icon: Clock,
  },
  approved: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle,
  },
  rejected: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    icon: XCircle,
  },
  cancelled: {
    bg: "bg-slate-50 dark:bg-slate-900/20",
    text: "text-slate-700 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-800",
    icon: XCircle,
  },
import { membershipRequestApi } from "../services";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import {
  Users,
  Clock,
  Check,
  X,
  Loader2,
  FileText,
  Calendar,
  Building2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

const STATUS_STYLES = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  approved: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  cancelled: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
};

const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const MembershipRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedRequests, setSelectedRequests] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);

  // Get organization ID from user data or localStorage
  const organizationId = localStorage.getItem("selectedOrganizationId");

  useEffect(() => {
    if (organizationId) {
      fetchRequests();
    } else {
      setError("No organization selected");
      setLoading(false);
    }
  }, [organizationId, statusFilter, sortBy, sortOrder, page]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery || undefined,
        page,
        limit: 10,
        sortBy,
        sortOrder,
      };
      const response = await membershipRequestApi.getOrganizationRequests(
        organizationId,
        params
      );
      setRequests(response.data.requests || []);
      setPagination(response.data.pagination || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch requests");
      const { data } = await membershipRequestApi.getUserRequests();
      if (data.success) {
        setRequests(data.requests || []);
      } else {
        toast.error(data.message || "Failed to fetch requests");
      }
    } catch (err) {
      console.error("Error fetching requests:", err);
      toast.error(err.response?.data?.message || "Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchRequests();
  };

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const handleSelectRequest = (requestId) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequests(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedRequests.size === requests.length) {
      setSelectedRequests(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedRequests(new Set(requests.map((r) => r._id)));
      setShowBulkActions(true);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      setProcessingAction(requestId);
      await membershipRequestApi.approveRequest(requestId);
      toast.success("Membership request approved successfully");
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve request");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleReject = async (requestId) => {
    try {
      setProcessingAction(requestId);
      await membershipRequestApi.rejectRequest(requestId);
      toast.success("Membership request rejected successfully");
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject request");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequests.size === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to approve ${selectedRequests.size} request(s)?`
      )
    ) {
      return;
    }

    try {
      setProcessingAction("bulk-approve");
      const requestIds = Array.from(selectedRequests);
      await membershipRequestApi.bulkApproveRequests(requestIds);
      toast.success(`${requestIds.length} request(s) approved successfully`);
      setSelectedRequests(new Set());
      setShowBulkActions(false);
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve requests");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleBulkReject = async () => {
    if (selectedRequests.size === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to reject ${selectedRequests.size} request(s)?`
      )
    ) {
      return;
    }

    try {
      setProcessingAction("bulk-reject");
      const requestIds = Array.from(selectedRequests);
      await membershipRequestApi.bulkRejectRequests(requestIds);
      toast.success(`${requestIds.length} request(s) rejected successfully`);
      setSelectedRequests(new Set());
      setShowBulkActions(false);
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject requests");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleViewProfile = (userId) => {
    navigate(`/profile/${userId}`);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!organizationId) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-gray-100">
              No Organization Selected
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
              Please select an organization to view membership requests.
            </p>
            <button
              onClick={() => navigate("/organizations")}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Go to Organizations
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-gray-100">
            Membership Requests
          </h1>
          <p className="mt-2 text-slate-600 dark:text-gray-400">
            Manage and review organization join requests
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 p-4 mb-6 shadow-sm">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Search
              </button>
            </div>
          </form>
        </div>

        {/* Bulk Actions Bar */}
        {showBulkActions && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {selectedRequests.size} request(s) selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkApprove}
                disabled={processingAction === "bulk-approve"}
                className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4 mr-2" />
                Approve Selected
              </button>
              <button
                onClick={handleBulkReject}
                disabled={processingAction === "bulk-reject"}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-4 w-4 mr-2" />
                Reject Selected
              </button>
              <button
                onClick={() => {
                  setSelectedRequests(new Set());
                  setShowBulkActions(false);
                }}
                className="px-4 py-2 text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600 dark:text-gray-400">Loading requests...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-gray-100">
              Error Loading Requests
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">{error}</p>
            <button
              onClick={fetchRequests}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && requests.length === 0 && (
          <div className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-gray-100">
              No Membership Requests
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
              {statusFilter === "all"
                ? "There are no membership requests for this organization."
                : `There are no ${statusFilter} membership requests.`}
            </p>
          </div>
        )}

        {/* Requests Table */}
        {!loading && !error && requests.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-gray-700">
                <thead className="bg-slate-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedRequests.size === requests.length && requests.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-gray-300"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        Applicant
                        {sortBy === "name" &&
                          (sortOrder === "asc" ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-gray-300"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {sortBy === "status" &&
                          (sortOrder === "asc" ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-gray-300"
                      onClick={() => handleSort("createdAt")}
                    >
                      <div className="flex items-center gap-1">
                        Request Date
                        {sortBy === "createdAt" &&
                          (sortOrder === "asc" ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-slate-200 dark:divide-gray-700">
                  {requests.map((request) => {
                    const StatusIcon = STATUS_STYLES[request.status]?.icon || Clock;
                    const statusStyle = STATUS_STYLES[request.status] || STATUS_STYLES.pending;
                    const isSelected = selectedRequests.has(request._id);
                    const isProcessing = processingAction === request._id;

                    return (
                      <tr
                        key={request._id}
                        className={`hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors ${
                          isSelected ? "bg-blue-50 dark:bg-blue-900/10" : ""
                        }`}
                      >
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectRequest(request._id)}
                            className="rounded border-slate-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {request.user?.profilePic ? (
                                <img
                                  className="h-10 w-10 rounded-full object-cover"
                                  src={request.user.profilePic}
                                  alt=""
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-gray-600 flex items-center justify-center">
                                  <User className="h-5 w-5 text-slate-500 dark:text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-slate-900 dark:text-gray-100">
                                {request.user?.name || "Unknown"}
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                {request.user?.isAccountVerified && (
                                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                                )}
                                <button
                                  onClick={() => handleViewProfile(request.user?._id)}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  View Profile
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-slate-600 dark:text-gray-400">
                            {request.user?.email || "N/A"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-slate-600 dark:text-gray-400">
                            {formatDate(request.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-slate-600 dark:text-gray-400 max-w-xs truncate">
                            {request.message || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {request.status === "pending" && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApprove(request._id)}
                                disabled={isProcessing}
                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(request._id)}
                                disabled={isProcessing}
                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Reject
                              </button>
                            </div>
                          )}
                          {request.status !== "pending" && (
                            <span className="text-xs text-slate-400 dark:text-gray-500">
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="bg-slate-50 dark:bg-gray-700 px-4 py-3 border-t border-slate-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-gray-400">
                  Showing {((page - 1) * pagination.limit) + 1} to{" "}
                    {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-slate-300 dark:border-gray-600 rounded hover:bg-slate-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-slate-600 dark:text-gray-400">
                    Page {page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="px-3 py-1 text-sm border border-slate-300 dark:border-gray-600 rounded hover:bg-slate-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
  const filterRequests = () => {
    if (statusFilter === "all") {
      setFilteredRequests(requests);
    } else {
      setFilteredRequests(
        requests.filter((req) => req.status === statusFilter)
      );
    }
  };

  const handleCancel = async (requestId) => {
    try {
      setActionLoading((prev) => ({ ...prev, [requestId]: true }));
      const { data } = await membershipRequestApi.cancelRequest(requestId);
      if (data.success) {
        toast.success("Request cancelled successfully");
        await fetchRequests();
      } else {
        toast.error(data.message || "Failed to cancel request");
      }
    } catch (err) {
      console.error("Error cancelling request:", err);
      toast.error(err.response?.data?.message || "Failed to cancel request");
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleViewOrganization = (organizationSlug) => {
    navigate(`/organization/${organizationSlug}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-600/20">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                My Membership Requests
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {filteredRequests.length}{" "}
                {filteredRequests.length === 1 ? "request" : "requests"}
              </p>
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Requests</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-16 w-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No {statusFilter === "all" ? "" : STATUS_LABELS[statusFilter]} requests
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              {statusFilter === "all"
                ? "You haven't submitted any membership requests yet"
                : `No ${STATUS_LABELS[statusFilter].toLowerCase()} requests found`}
            </p>
            {statusFilter === "all" && (
              <button
                onClick={() => navigate("/browse-organizations")}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse Organizations
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => (
              <div
                key={request._id}
                className="group relative flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all"
              >
                {/* Organization Logo */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white font-bold text-lg">
                  {request.organization?.logo ? (
                    <img
                      src={request.organization.logo}
                      alt={request.organization.name}
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    request.organization?.name?.charAt(0)?.toUpperCase() || "O"
                  )}
                </div>

                {/* Request Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                      {request.organization?.name || "Unknown Organization"}
                    </h3>
                    <button
                      onClick={() =>
                        handleViewOrganization(request.organization?.slug)
                      }
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                      title="View organization"
                    >
                      <ExternalLink className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>

                  {request.message && (
                    <div className="flex items-start gap-2 mb-2">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-600 dark:text-slate-300 italic">
                        "{request.message}"
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Requested {formatDate(request.createdAt)}</span>
                    </div>
                    {request.reviewedAt && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Reviewed {formatDate(request.reviewedAt)}</span>
                      </div>
                    )}
                  </div>

                  {request.reviewNotes && (
                    <div className="mt-2 p-2 rounded bg-slate-50 dark:bg-slate-800">
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-medium">Admin note:</span>{" "}
                        {request.reviewNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider shrink-0 ${STATUS_STYLES[request.status]}`}
                >
                  {request.status === "pending" && <Clock className="h-3 w-3" />}
                  {request.status === "approved" && <Check className="h-3 w-3" />}
                  {request.status === "rejected" && <X className="h-3 w-3" />}
                  {request.status === "cancelled" && <X className="h-3 w-3" />}
                  {STATUS_LABELS[request.status]}
                </span>

                {/* Actions */}
                {request.status === "pending" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCancel(request._id)}
                      disabled={actionLoading[request._id]}
                      className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      {actionLoading[request._id] ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          Cancel
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MembershipRequests;
