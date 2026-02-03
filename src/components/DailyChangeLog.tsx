import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Clock, TrendingUp, TrendingDown, Pencil, Trash2, Trash } from "lucide-react";
import { useEffect, useState } from "react";
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

export const DailyChangeLog = ({ performanceId }: DailyChangeLogProps) => {
  const [changes, setChanges] = useState<Record<string, DailyChange[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [editingChange, setEditingChange] = useState<DailyChange | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
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

    // Group by date
    const grouped = (data || []).reduce((acc, change) => {
      const date = change.change_date;
      if (!acc[date]) {
        acc[date] = [];
      }
      
      // Map genesys_good to good, genesys_bad to bad for combined display
      let fieldName = change.field_name;
      if (fieldName === 'genesys_good') {
        fieldName = 'good';
      } else if (fieldName === 'genesys_bad') {
        fieldName = 'bad';
      }
      
      acc[date].push({ 
        ...change, 
        field_name: fieldName,
        change_time: change.change_time 
      });
      return acc;
    }, {} as Record<string, DailyChange[]>);

    setChanges(grouped);
    setIsLoading(false);
  };

  const getFieldLabel = (fieldName: string) => {
    const labels: Record<string, string> = {
      good: "Good",
      bad: "DSAT",
      karma_bad: "Karma Bad",
      fcr: "FCR",
      good_phone: "Phone Good",
      good_chat: "Chat Good",
      good_email: "Email Good",
    };
    return labels[fieldName] || fieldName;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':');
    return `${hours}:${minutes}`;
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
      const { error } = await supabase
        .from("daily_changes")
        .delete()
        .eq("id", changeId);

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

  if (!performanceId) {
    return null;
  }

  return (
    <Card className="p-6 border-border">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Daily Change Log</h3>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading changes...</p>
      ) : Object.keys(changes).length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes recorded yet</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(changes).map(([date, dateChanges]) => (
            <div key={date} className="border-l-2 border-primary pl-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">
                  {formatDate(date)}
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive hover:text-destructive">
                      <Trash className="h-3 w-3 mr-1" />
                      <span className="text-xs">Delete Day</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all logs for {formatDate(date)}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {dateChanges.length} log entries for this day. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteDay(date)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="space-y-1">
                {dateChanges.map((change) => {
                  const isDSAT = change.field_name === "bad" || change.field_name === "genesys_bad";
                  const time = formatTime(change.change_time);
                  return (
                    <div
                      key={change.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground group"
                    >
                      {change.change_amount > 0 ? (
                        <TrendingUp className={`h-4 w-4 ${isDSAT ? "text-destructive" : "text-success"}`} />
                      ) : (
                        <TrendingDown className={`h-4 w-4 ${isDSAT ? "text-success" : "text-destructive"}`} />
                      )}
                      {time && (
                        <span className="text-xs text-muted-foreground font-mono">{time}</span>
                      )}
                      <span className="flex-1">
                        {getFieldLabel(change.field_name)}:{" "}
                        <span
                          className={
                            isDSAT 
                              ? (change.change_amount > 0 ? "text-destructive" : "text-success")
                              : (change.change_amount > 0 ? "text-success" : "text-destructive")
                          }
                        >
                          {change.change_amount > 0 ? "+" : ""}
                          {change.change_amount}
                        </span>
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => openEditDialog(change)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this log entry?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this log entry. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteChange(change.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
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
              <Select
                value={editForm.field_name}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, field_name: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action type" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Change Amount</label>
              <Input
                type="number"
                value={editForm.change_amount}
                onChange={(e) => setEditForm(prev => ({ ...prev, change_amount: parseInt(e.target.value, 10) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">Use positive for additions, negative for removals</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Time</label>
              <Input
                type="time"
                value={editForm.change_time}
                onChange={(e) => setEditForm(prev => ({ ...prev, change_time: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateChange}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};