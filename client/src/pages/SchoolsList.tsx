import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SearchInput } from "../components/ui/search-input";
import { RichDropdown } from "../components/ui/rich-dropdown";
import type { DropdownOption } from "../components/ui/rich-dropdown";
import {
  Building2,
  Plus,
  Filter,
  MoreVertical,
  Eye,
  Upload,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Modal } from "../components/ui/modal";
import { PageHeader } from "../components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useNavigate } from "react-router-dom";
import { SchoolForm } from "../components/SchoolForm";
import { resolveDistrictName, resolveProvinceName } from "../lib/rwanda-locations";
import { ImigongoPattern } from "../components/ui/ImigongoPattern";

interface School {
  id: string;
  code: string;
  name: string;
  type: string;
  province: string;
  district: string;
  priorityLevel: string;
  kmzStatus: string;
  overallScore?: number;
}

export default function SchoolsList() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSchools, setTotalSchools] = useState(0);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const [filters, setFilters] = useState({
    province: "",
    district: "",
    priority: "",
    type: "",
  });

  const schoolTypeOptions: DropdownOption[] = [
    { label: "TSS", value: "TSS" },
    { label: "TVET", value: "TVET" },
    { label: "POLYTECHNIC", value: "POLYTECHNIC" },
  ];

  const priorityOptions: DropdownOption[] = [
    { label: "Critical", value: "critical" },
    { label: "High", value: "high" },
    { label: "Medium", value: "medium" },
    { label: "Low", value: "low" },
  ];

  const navigate = useNavigate();

  useEffect(() => {
    fetchSchools(searchTerm, page);
  }, [page, filters]);

  const fetchSchools = async (search = "", pageNum = 1) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        page: pageNum.toString(),
        limit: "50",
      });
      if (filters.province) query.append("province", filters.province);
      if (filters.district) query.append("district", filters.district);
      if (filters.priority) query.append("priority", filters.priority);
      if (filters.type) query.append("type", filters.type);

      const response = await api.get(`/schools?${query.toString()}`);
      setSchools(response.data.data);
      if (response.data.meta) {
        setTotalPages(response.data.meta.totalPages);
        setTotalSchools(response.data.meta.total);
      }
    } catch (err) {
      console.error("Failed to load schools", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSchools(searchTerm, 1);
  };

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSchoolFormSuccess = () => {
    fetchSchools(searchTerm, page);
  };

  return (
    <div className="relative space-y-8 pb-10 min-h-screen">
      {/* Background Pattern */}
      <ImigongoPattern 
        className="fixed inset-0 text-primary pointer-events-none mask-[linear-gradient(to_bottom_right,black_0%,transparent_40%,transparent_60%,black_100%)]" 
        opacity={0.04}
      />

      <div className="relative z-10 space-y-8">
        <PageHeader
        title="Schools Directory"
        description="Manage and monitor all national TVET institutions"
        icon={Building2}
        actions={
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="h-10 rounded-full font-normal text-sm tracking-wider px-6 transition-all hover:scale-95 active:scale-95 bg-linear-to-r from-primary to-primary/80"
          >
            <Plus className="w-4 h-4 mr-2" /> Add New School
          </Button>
        }
      />

      <Card className="border-none bg-linear-to-br from-card/90 to-card/40 backdrop-blur-xl overflow-hidden rounded-4xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.05)] transition-all duration-500">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row items-center justify-between p-6 gap-6 bg-card/40">
            <SearchInput
              placeholder="Search institutions by name, code or district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onSearch={() =>
                handleSearch({ preventDefault: () => {} } as React.FormEvent)
              }
              onClear={() => {
                setSearchTerm("");
                setPage(1);
                fetchSchools("", 1);
              }}
              isLoading={loading}
              containerClassName="max-w-[500px]"
            />

            <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
              <Button
                variant="outline"
                onClick={() => setIsFilterModalOpen(true)}
                className="rounded-full h-11 px-6 gap-2 w-full md:w-auto font-black uppercase tracking-widest text-[10px] border-border/10 hover:bg-accent/10"
              >
                <Filter className="w-3.5 h-3.5" /> Advanced Filters
              </Button>
            </div>
          </div>

          <div className="p-0">
            <Table wrapperClassName="max-h-[600px] border-none rounded-none bg-transparent backdrop-blur-none shadow-none">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/10">
                  <TableHead>Institution / Code</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  {/* <TableHead className="text-center">Score</TableHead> */}
                  <TableHead>Status</TableHead>
                  <TableHead>GIS/3D Data</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="px-6 py-20 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center justify-center gap-4">
                          <div className="relative w-12 h-12">
                            <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                          </div>
                          <span className="font-bold animate-pulse">
                            Syncing institution data...
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : schools.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="px-6 py-20 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center justify-center opacity-40">
                          <Building2 className="w-16 h-16 mb-4" />
                          <p className="text-lg font-bold">
                            No results found matching your search
                          </p>
                          <p className="text-sm">
                            Try adjusting your filters or search terms
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    schools.map((school, i) => (
                      <motion.tr
                        key={school.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="group border-b border-gray-200 dark:border-gray-800 last:border-0 hover:bg-muted/30 transition-all duration-200"
                      >
                        <TableCell
                          onClick={() =>
                            navigate(`/schools/${school.id}/decision`)
                          }
                          className="cursor-pointer"
                        >
                          <div className="font-normal text-foreground text-sm leading-tight group-hover:text-primary transition-colors">
                            {school.name}
                          </div>
                          <div className="text-[10px] font-normal uppercase text-muted-foreground/60 tracking-widest">
                            {school.code}
                          </div>
                        </TableCell>
                        <TableCell
                          onClick={() =>
                            navigate(`/schools/${school.id}/decision`)
                          }
                          className="cursor-pointer"
                        >
                          <div className="font-medium text-foreground/80 leading-tight">
                            {resolveDistrictName(school.district)}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-medium">
                            {resolveProvinceName(school.province)}
                          </div>
                        </TableCell>
                        <TableCell className="text-[10px] font-black uppercase tracking-wider text-foreground/60 opacity-60">
                          {school.type}
                        </TableCell>
                        {/* <TableCell className="text-center">
                          <div className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-muted/50 font-black text-[10px] tracking-wider text-foreground/80 group-hover:bg-primary group-hover:text-white transition-all">
                            {school.overallScore || "--"}
                          </div>
                        </TableCell> */}
                        <TableCell>
                          <Badge
                            variant={
                              school.priorityLevel === "critical"
                                ? "destructive"
                                : school.priorityLevel === "high"
                                  ? "warning"
                                  : school.priorityLevel === "low"
                                    ? "success"
                                    : "default"
                            }
                            className="rounded-full px-2 py-0 text-[8px] font-black uppercase tracking-widest border-border/10"
                          >
                            {school.priorityLevel || "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              school.kmzStatus === "completed"
                                ? "success"
                                : school.kmzStatus === "processing"
                                  ? "warning"
                                  : "outline"
                            }
                            className="rounded-full px-2 py-0 text-[8px] font-black uppercase tracking-widest border-border/10"
                          >
                            {school.kmzStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full hover:bg-primary/10 hover:text-primary"
                              onClick={() =>
                                navigate(`/schools/${school.id}/decision`)
                              }
                              title="View Detail & 3D"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full hover:bg-primary/10 hover:text-primary"
                              onClick={() =>
                                navigate(`/schools/${school.id}/kmz`)
                              }
                              title="Upload KMZ"
                            >
                              <Upload className="w-4 h-4" />
                            </Button>
                            {/* <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full hover:bg-amber-500/10 hover:text-amber-600"
                              onClick={() =>
                                navigate(`/schools/${school.id}/decision`)
                              }
                              title="Decision Dashboard"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button> */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>

          <div className="p-6 border-t border-border/10 flex items-center justify-between text-xs font-bold bg-card/40">
            <div className="text-muted-foreground text-sm font-light flex items-center gap-2">
              Displaying{" "}
              <span className="text-foreground tracking-normal px-2 py-0.5 bg-muted/50 rounded-md">
                {schools.length}
              </span>{" "}
              of {totalSchools} total
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-4 border-border/10 text-sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <div className="flex items-center px-2 text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-4 border-border/10 text-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* ADD SCHOOL MODAL */}
      <SchoolForm
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleSchoolFormSuccess}
        mode="create"
      />

      {/* FILTER MODAL */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Advanced Filters"
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Type
              </label>
              <RichDropdown
                options={[
                  { label: "All Types", value: "" },
                  ...schoolTypeOptions,
                ]}
                value={filters.type}
                onChange={(val) =>
                  setFilters((prev) => ({ ...prev, type: val }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Priority
              </label>
              <RichDropdown
                options={[
                  { label: "All Priorities", value: "" },
                  ...priorityOptions,
                ]}
                value={filters.priority}
                onChange={(val) =>
                  setFilters((prev) => ({ ...prev, priority: val }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Province
              </label>
              <Input
                name="province"
                placeholder="e.g. Kigali"
                value={filters.province}
                onChange={handleFilterChange}
                className="rounded-xl border-border/10 bg-background/50"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFilters({
                  province: "",
                  district: "",
                  priority: "",
                  type: "",
                });
                setPage(1);
                setIsFilterModalOpen(false);
              }}
              className="rounded-xl font-bold border-border/10"
            >
              Clear Filters
            </Button>
            <Button
              type="button"
              onClick={() => {
                setPage(1);
                setIsFilterModalOpen(false);
              }}
              className="rounded-xl font-bold bg-primary hover:bg-primary/90"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
