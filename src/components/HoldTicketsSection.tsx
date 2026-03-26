import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Plus, Clock, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface HoldTicket {
  id?: string;
  ticketLink: string;
  reason: string;
  holdStart: string;
  holdHours: number;
  isCompleted: boolean;
  completedAt?: string;
  performanceId?: string;
}

interface HoldTicketsSectionProps {
  performanceId: string | null;
}

export const HoldTicketsSection = ({ performanceId }: HoldTicketsSectionProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newTicket, setNewTicket] = useState({
    ticketLink: "",
    reason: "",
    holdHours: 0,
  });

  // Fetch tickets
  const { data: tickets = [] } = useQuery({
    queryKey: ["holdTickets", user?.id, performanceId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Fetch all active tickets OR tickets belonging to current performance ID
      // We use a raw query string for the OR condition
      let query = supabase
        .from("hold_tickets")
        .select("*")
        .eq("user_id", user.id);

      if (performanceId) {
        // Fetch active tickets OR completed tickets for this month
        // Syntax for OR in Supabase: .or('id.eq.2,name.eq.China')
        query = query.or(`is_completed.eq.false,performance_id.eq.${performanceId}`);
      } else {
        // If no performance ID, just fetch active ones
        query = query.eq("is_completed", false);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching hold tickets:", error);
        return [];
      }

      return data.map((t: any) => ({
        id: t.id,
        ticketLink: t.ticket_link,
        reason: t.reason || "",
        holdStart: t.hold_start,
        holdHours: t.hold_hours,
        isCompleted: t.is_completed,
        completedAt: t.completed_at,
        performanceId: t.performance_id,
      }));
    },
    enabled: !!user?.id,
    refetchInterval: 5000, // Poll every 5s to keep in sync
  });

  // Mutations
  const addMutation = useMutation({
    mutationFn: async (ticket: Omit<HoldTicket, "id">) => {
      if (!performanceId) throw new Error("No performance record found");
      const { error } = await supabase.from("hold_tickets").insert({
        performance_id: performanceId,
        ticket_link: ticket.ticketLink,
        reason: ticket.reason,
        hold_start: ticket.holdStart,
        hold_hours: ticket.holdHours,
        is_completed: false,
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdTickets"] });
      toast.success("Hold ticket added!");
      setNewTicket({ ticketLink: "", reason: "", holdHours: 0 });
    },
    onError: (err) => toast.error("Failed to add ticket: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<any> }) => {
      const { error } = await supabase
        .from("hold_tickets")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdTickets"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hold_tickets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdTickets"] });
      toast.success("Ticket removed");
    },
  });

  // Force refresh for timer every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const activeTickets = tickets.filter(t => !t.isCompleted);
  const completedToday = tickets.filter(t => {
    if (!t.isCompleted || !t.completedAt) return false;
    // Show all completed tickets for this performance period (month)
    // If we want "completed today" specifically, we check date
    // User asked for "history", so showing all completed for the month is better
    // But the section is named "Completed Today" in the UI?
    // Let's stick to showing all completed for this month in the list
    return true; 
  });

  const addTicket = () => {
    if (!newTicket.ticketLink.trim()) {
      toast.error("Please enter a ticket link");
      return;
    }
    if (!performanceId) {
        toast.error("Please save the dashboard first to initialize the month.");
        return;
    }
    
    addMutation.mutate({
      ticketLink: newTicket.ticketLink,
      reason: newTicket.reason,
      holdStart: new Date().toISOString(),
      holdHours: newTicket.holdHours,
      isCompleted: false,
    });
  };

  const toggleComplete = (id: string, currentStatus: boolean) => {
    updateMutation.mutate({
      id,
      updates: {
        is_completed: !currentStatus,
        completed_at: !currentStatus ? new Date().toISOString() : null,
      },
    });
  };

  const getHoldDuration = (holdStart: string) => {
    if (!holdStart) return "0m";
    const start = new Date(holdStart);
    if (isNaN(start.getTime())) return "0m";

    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${remainingHours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const isOverdue = (ticket: HoldTicket) => {
    if (ticket.holdHours <= 0 || !ticket.holdStart) return false;
    const start = new Date(ticket.holdStart);
    if (isNaN(start.getTime())) return false;

    const now = new Date();
    const diffHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
    return diffHours > ticket.holdHours;
  };

  return (
    <Card className={`p-6 border-2 transition-colors duration-300 ${activeTickets.length > 0 ? 'border-destructive/50 bg-destructive/5' : 'border-dashed border-muted'}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${activeTickets.length > 0 ? 'bg-destructive/20 animate-pulse' : 'bg-muted'}`}>
            {activeTickets.length > 0 ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className={`text-lg font-bold ${activeTickets.length > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {activeTickets.length > 0 ? '⚠️ Hold Tickets - URGENT!' : 'Hold Tickets'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {activeTickets.length} active • {completedToday.length} completed
            </p>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Input
          placeholder="Ticket Link (Required)"
          value={newTicket.ticketLink}
          onChange={(e) => setNewTicket(prev => ({ ...prev, ticketLink: e.target.value }))}
          className="bg-background"
        />
        <Input
          placeholder="Reason (Optional)"
          value={newTicket.reason}
          onChange={(e) => setNewTicket(prev => ({ ...prev, reason: e.target.value }))}
          className="bg-background"
        />
        <Input
          type="number"
          placeholder="Expected hold hours"
          value={newTicket.holdHours || ""}
          onChange={(e) => setNewTicket(prev => ({ ...prev, holdHours: parseInt(e.target.value) || 0 }))}
          className="bg-background"
        />
        <Button 
          onClick={addTicket} 
          variant={activeTickets.length > 0 ? "destructive" : "default"}
          className="w-full shadow-sm"
          disabled={!performanceId || addMutation.isPending}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Hold
        </Button>
      </div>

      {/* Active Tickets List */}
      <div className="space-y-3">
        {activeTickets.map((ticket) => (
          <div
            key={ticket.id}
            className={`bg-background border rounded-lg p-4 transition-all hover:shadow-md ${
              isOverdue(ticket) ? 'border-destructive shadow-sm' : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Checkbox
                  checked={ticket.isCompleted}
                  onCheckedChange={() => toggleComplete(ticket.id!, ticket.isCompleted)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium truncate">{ticket.ticketLink}</span>
                    {isOverdue(ticket) && (
                      <Badge variant="destructive" className="animate-pulse">OVERDUE</Badge>
                    )}
                  </div>
                  {ticket.reason && (
                    <p className="text-sm text-muted-foreground mb-1">{ticket.reason}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getHoldDuration(ticket.holdStart)}
                    </span>
                    {ticket.holdHours > 0 && (
                      <span>Target: {ticket.holdHours}h</span>
                    )}
                  </div>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate(ticket.id!)}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-1"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        
        {activeTickets.length === 0 && completedToday.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-muted rounded-lg bg-muted/5">
            <p>No tickets currently on hold.</p>
          </div>
        )}
      </div>

      {/* Completed Section */}
      {completedToday.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
           <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
             <CheckCircle2 className="h-4 w-4 text-success" /> Completed (This Month)
           </h4>
           <div className="space-y-2 opacity-75 hover:opacity-100 transition-opacity">
             {completedToday.map(ticket => (
               <div key={ticket.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded border border-border">
                  <span className="truncate flex-1 mr-2 decoration-slice">{ticket.ticketLink}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">Done</Badge>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(ticket.id!)}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
               </div>
             ))}
           </div>
        </div>
      )}
    </Card>
  );
};