import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pencil, Trash2, Trash, Filter, BarChart3, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DailyChange {
  id: string;
  change_date: string;
  change_time: string | null;
  field_name: string;
  change_amount: number;
  created_at: string;
}

interface DailyChangeLogProps {
  performanceId: string | null;
}

const FIELD_OPTIONS = [
  { value: "good", label: "Good" },
  { value: "bad", label: "DSAT" },
  { value: "karma_bad", label: "Karma Bad" },
  { value: "fcr", label: "FCR" },
  { value: "good_phone", label: "Phone Good" },
  { value: "good_chat", label: "Chat Good" },
  { value: "good_email", label: "Email Good" },
];

const FIELD_COLORS: Record<string, string> = {
  good: "bg-success/15 text-success border-success/30",
  bad: "bg-destructive/15 text-destructive border-destructive/30",
  karma_bad: "bg-warning/15 text-warning border-warning/30",
  fcr: "bg-primary/15 text-primary border-primary/30",
  good_phone: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  good_chat: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  good_email: "bg-violet-500/15 text-violet-500 border-violet-500/30",
};

export const DailyChangeLog = ({ performanceId }: DailyChangeLogProps) => {
  const [changes, setChanges] = useState<Record<string, DailyChange[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [editingChange, setEditingChange] = useState<DailyChange | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [filterField, setFilterField] = useState<string>("all");
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [editForm, setEditForm] = useState({
    field_name: "",
    change_amount: 0,
    change_time: "",
  });

  useEffect(() => {
    if (!performanceId) return;
    loadChanges();
  }, [performanceId]);

  const loadChanges = async () => {
    if (!performanceId) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from("daily_changes")
      .select("*")
      .eq("performance_id", performanceId)
      .order("change_date", { ascending: false })
      .order("change_time", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Error loading daily changes:", error);
      setIsLoading(false);
      return;
    }

    const grouped = (data || []).reduce((acc, change) => {
      const date = change.change_date;
      if (!acc[date]) acc[date] = [];
      
      let fieldName = change.field_name;
      if (fieldName === 'genesys_good') fieldName = 'good';
      else if (fieldName === 'genesys_bad') fieldName = 'bad';
      
      acc[date].push({ ...change, field_name: fieldName, change_time: change.change_time });
      return acc;
    }, {} as Record<string, DailyChange[]>);

    setChanges(grouped);
    setIsLoading(false);
  };

  // Summary stats
  const stats = useMemo(() => {
    const allChanges = Object.values(changes).flat();
    const totalPositive = allChanges.filter(c => {
      const isDSAT = c.field_name === "bad";
      return isDSAT ? c.change_amount < 0 : c.change_amount > 0;
    }).length;
    const totalNegative = allChanges.length - totalPositive;
    const totalDays = Object.keys(changes).length;
    return { total: allChanges.length, totalPositive, totalNegative, totalDays };
  }, [changes]);

  // Filter changes
  const filteredChanges = useMemo(() => {
    if (filterField === "all") return changes;
    const filtered: Record<string, DailyChange[]> = {};
    Object.entries(changes).forEach(([date, dateChanges]) => {
      const matching = dateChanges.filter(c => c.field_name === filterField);
      if (matching.length > 0) filtered[date] = matching;
    });
    return filtered;
  }, [changes, filterField]);

  const getFieldLabel = (fieldName: string) => {
    const labels: Record<string, string> = {
      good: "Good", bad: "DSAT", karma_bad: "Karma Bad",
      fcr: "FCR", good_phone: "Phone", good_chat: "Chat", good_email: "Email",
    };
    return labels[fieldName] || fieldName;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateStr === today.toISOString().split('T')[0]) return "Today";
    if (dateStr === yesterday.toISOString().split('T')[0]) return "Yesterday";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':');
    return `${hours}:${minutes}`;
  };

  const toggleDay = (date: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  const getDaySummary = (dateChanges: DailyChange[]) => {
    const summary: Record<string, number> = {};
    dateChanges.forEach(c => {
      summary[c.field_name] = (summary[c.field_name] || 0) + c.change_amount;
    });
    return summary;
  };

  const openEditDialog = (change: DailyChange) => {
    setEditingChange(change);
    setEditForm({
      field_name: change.field_name,
      change_amount: change.change_amount,
      change_time: change.change_time ? change.change_time.substring(0, 5) : "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateChange = async () => {
    if (!editingChange) return;
    try {
      const { error } = await supabase
        .from("daily_changes")
        .update({
          field_name: editForm.field_name,
          change_amount: editForm.change_amount,
          change_time: editForm.change_time ? `${editForm.change_time}:00` : null,
        })
        .eq("id", editingChange.id);
      if (error) throw error;
      toast.success("Log entry updated");
      setEditDialogOpen(false);
      setEditingChange(null);
      loadChanges();
    } catch (error: any) {
      toast.error("Failed to update: " + error.message);
    }
  };

  const handleDeleteChange = async (changeId: string) => {
    try {
      const { error } = await supabase.from("daily_changes").delete().eq("id", changeId);
      if (error) throw error;
      toast.success("Log entry deleted");
      loadChanges();
    } catch (error: any) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  const handleDeleteDay = async (date: string) => {
    if (!performanceId) return;
    try {
      const { error } = await supabase
        .from("daily_changes")
        .delete()
        .eq("performance_id", performanceId)
        .eq("change_date", date);
      if (error) throw error;
      toast.success(`All logs for ${formatDate(date)} deleted`);
      loadChanges();
    } catch (error: any) {
      toast.error("Failed to delete day: " + error.message);
    }
  };

  if (!performanceId) return null;

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold font-mono text-foreground">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Logs</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold font-mono text-success">{stats.totalPositive}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Positive</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold font-mono text-destructive">{stats.totalNegative}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Negative</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold font-mono text-primary">{stats.totalDays}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Days</p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={filterField} onValueChange={setFilterField}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {FIELD_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Timeline */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Loading changes...</p>
        </Card>
      ) : Object.keys(filteredChanges).length === 0 ? (
        <Card className="p-8 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No changes recorded yet</p>
        </Card>
      ) : (
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-2">
            {Object.entries(filteredChanges).map(([date, dateChanges]) => {
              const isCollapsed = collapsedDays.has(date);
              const daySummary = getDaySummary(dateChanges);
              
              return (
                <Card key={date} className="overflow-hidden">
                  {/* Day Header */}
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleDay(date)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Calendar className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-semibold text-foreground">{formatDate(date)}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {dateChanges.length}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Mini summary badges */}
                      <div className="hidden sm:flex items-center gap-1">
                        {Object.entries(daySummary).slice(0, 3).map(([field, amount]) => (
                          <span
                            key={field}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${FIELD_COLORS[field] || "bg-muted text-muted-foreground border-border"}`}
                          >
                            {getFieldLabel(field)} {amount > 0 ? "+" : ""}{amount}
                          </span>
                        ))}
                      </div>
                      {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Day Content */}
                  {!isCollapsed && (
                    <div className="border-t border-border">
                      {/* Mobile summary */}
                      <div className="flex sm:hidden flex-wrap gap-1 px-3 pt-2">
                        {Object.entries(daySummary).map(([field, amount]) => (
                          <span
                            key={field}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${FIELD_COLORS[field] || "bg-muted text-muted-foreground border-border"}`}
                          >
                            {getFieldLabel(field)} {amount > 0 ? "+" : ""}{amount}
                          </span>
                        ))}
                      </div>

                      <div className="p-2 space-y-0.5">
                        {dateChanges.map((change) => {
                          const isDSAT = change.field_name === "bad" || change.field_name === "genesys_bad";
                          const time = formatTime(change.change_time);
                          const isPositiveEffect = isDSAT ? change.change_amount < 0 : change.change_amount > 0;

                          return (
                            <div
                              key={change.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group"
                            >
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPositiveEffect ? "bg-success" : "bg-destructive"}`} />
                              
                              {time && (
                                <span className="text-[11px] text-muted-foreground font-mono w-10 shrink-0">{time}</span>
                              )}
                              
                              <span className={`text-[11px] px-1.5 py-0.5 rounded border shrink-0 ${FIELD_COLORS[change.field_name] || "bg-muted text-muted-foreground border-border"}`}>
                                {getFieldLabel(change.field_name)}
                              </span>
                              
                              <span className={`text-sm font-semibold font-mono flex-1 ${isPositiveEffect ? "text-success" : "text-destructive"}`}>
                                {change.change_amount > 0 ? "+" : ""}{change.change_amount}
                              </span>

                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditDialog(change)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete this log entry?</AlertDialogTitle>
                                      <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteChange(change.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Delete Day */}
                      <div className="border-t border-border px-3 py-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive w-full">
                              <Trash className="h-3 w-3 mr-1" />
                              Delete All ({dateChanges.length})
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete all logs for {formatDate(date)}?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete {dateChanges.length} entries.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteDay(date)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete All</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Log Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action Type</label>
              <Select value={editForm.field_name} onValueChange={(value) => setEditForm(prev => ({ ...prev, field_name: value }))}>
                <SelectTrigger><SelectValue placeholder="Select action type" /></SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Change Amount</label>
              <Input type="number" value={editForm.change_amount} onChange={(e) => setEditForm(prev => ({ ...prev, change_amount: parseInt(e.target.value, 10) || 0 }))} />
              <p className="text-xs text-muted-foreground">Positive for additions, negative for removals</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Time</label>
              <Input type="time" value={editForm.change_time} onChange={(e) => setEditForm(prev => ({ ...prev, change_time: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateChange}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
