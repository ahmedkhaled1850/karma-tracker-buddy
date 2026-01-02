import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DailyNote {
  id?: string;
  noteDate: string;
  content: string;
  created_at?: string;
}

interface DailyNotesSectionProps {
  performanceId: string | null;
}

export const DailyNotesSection = ({ performanceId }: DailyNotesSectionProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");

  const { data: notes = [] } = useQuery({
    queryKey: ["dailyNotes", performanceId],
    queryFn: async () => {
      if (!performanceId) return [];
      const { data, error } = await supabase
        .from("daily_notes")
        .select("*")
        .eq("performance_id", performanceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data.map((n: any) => ({
        id: n.id,
        noteDate: n.note_date,
        content: n.content,
        created_at: n.created_at,
      }));
    },
    enabled: !!performanceId,
  });

  const addMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!performanceId) throw new Error("No performance record");
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from("daily_notes").insert({
        performance_id: performanceId,
        note_date: today,
        content,
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailyNotes"] });
      toast.success("Note added!");
      setNewNote("");
    },
    onError: (err) => toast.error("Failed to add note"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailyNotes"] });
      toast.success("Note deleted");
    },
  });

  const today = new Date().toISOString().split('T')[0];
  
  // Group notes by date
  const notesByDate = notes.reduce((acc: Record<string, DailyNote[]>, note: DailyNote) => {
    if (!acc[note.noteDate]) {
      acc[note.noteDate] = [];
    }
    acc[note.noteDate].push(note);
    return acc;
  }, {});

  const sortedDates = Object.keys(notesByDate).sort((a, b) => b.localeCompare(a));

  const addNote = () => {
    if (!newNote.trim()) {
      toast.error("Please enter a note");
      return;
    }
    if (!performanceId) {
        toast.error("Please save dashboard first");
        return;
    }
    addMutation.mutate(newNote.trim());
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (dateStr === today) return "Today";
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toISOString().split('T')[0]) return "Yesterday";
    
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (isoString?: string) => {
      if (!isoString) return "";
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    
    return parts.map((part, index) => {
        if (part.match(urlRegex)) {
            const isImage = /\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i.test(part);
            if (isImage) {
                return (
                    <div key={index} className="my-2">
                        <img 
                            src={part} 
                            alt="Note attachment" 
                            className="max-w-full h-auto max-h-60 rounded-md border border-border"
                            loading="lazy"
                        />
                    </div>
                );
            }
            return (
                <a 
                    key={index} 
                    href={part} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary hover:underline break-all font-medium"
                >
                    {part}
                </a>
            );
        }
        return <span key={index}>{part}</span>;
    });
  };

  return (
    <Card className="p-6 border-border">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Daily Notes</h3>
          <p className="text-xs text-muted-foreground">Record daily events, issues, or important information</p>
        </div>
      </div>

      {/* Add New Note */}
      <div className="mb-4">
        <Textarea
          placeholder="Write your note here... (Paste image links to preview)"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className="mb-2 min-h-[80px]"
        />
        <Button onClick={addNote} className="w-full" disabled={!performanceId || addMutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Add Note for Today
        </Button>
      </div>

      {/* Notes List */}
      {sortedDates.length > 0 ? (
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {sortedDates.map((date) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-2 sticky top-0 bg-card py-1 z-10">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{formatDate(date)}</span>
                <span className="text-xs text-muted-foreground">({notesByDate[date].length})</span>
              </div>
              {notesByDate[date].map((note) => (
                <div
                  key={note.id}
                  className="bg-muted/50 rounded-lg p-3 group relative border border-border/50"
                >
                  <div className="text-xs text-muted-foreground mb-1 font-mono">
                    {formatTime(note.created_at)}
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-wrap pr-6">
                    {renderContent(note.content)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(note.id!)}
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground text-sm py-4">
          No notes yet. Add your first note above.
        </p>
      )}
    </Card>
  );
};