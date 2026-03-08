import { Button } from "@/components/ui/button";
import { Plus, Minus, Download, NotebookText, Eye, EyeOff } from "lucide-react";

interface QuickActionsBarProps {
  onAddGood: () => void;
  onAddBad: () => void;
  onExport: () => void;
  onOpenNotes: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
}

export const QuickActionsBar = ({
  onAddGood,
  onAddBad,
  onExport,
  onOpenNotes,
  focusMode,
  onToggleFocus,
}: QuickActionsBarProps) => {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Button
        size="sm"
        className="h-8 px-3 rounded-lg bg-success/15 text-success hover:bg-success/25 border border-success/20 text-xs font-medium"
        variant="ghost"
        onClick={onAddGood}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Good
      </Button>
      <Button
        size="sm"
        className="h-8 px-3 rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/20 text-xs font-medium"
        variant="ghost"
        onClick={onAddBad}
      >
        <Minus className="h-3.5 w-3.5 mr-1" />
        Bad
      </Button>
      <div className="w-px h-5 bg-border mx-0.5" />
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-lg hover:bg-accent"
        onClick={onOpenNotes}
        title="Notes"
      >
        <NotebookText className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-lg hover:bg-accent"
        onClick={onExport}
        title="Export CSV"
      >
        <Download className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className={`h-8 w-8 rounded-lg ${focusMode ? "bg-primary/15 text-primary" : "hover:bg-accent"}`}
        onClick={onToggleFocus}
        title={focusMode ? "Exit Focus Mode" : "Focus Mode"}
      >
        {focusMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
};
