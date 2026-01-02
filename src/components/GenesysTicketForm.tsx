import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface GenesysTicket {
  id?: string;
  ticketLink: string;
  ratingScore: number;
  customerPhone: string;
  ticketDate: string;
}

interface GenesysTicketFormProps {
  tickets: GenesysTicket[];
  onTicketsChange: (tickets: GenesysTicket[]) => void;
}

export const GenesysTicketForm = ({ tickets, onTicketsChange }: GenesysTicketFormProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState<GenesysTicket>({
    ticketLink: "",
    ratingScore: 7,
    customerPhone: "",
    ticketDate: new Date().toISOString().split('T')[0],
  });

  const updateTicketInline = (id: string, field: keyof GenesysTicket, value: string | number) => {
    onTicketsChange(
      tickets.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const addTicket = () => {
    if (!newTicket.ticketLink || !newTicket.customerPhone || !newTicket.ratingScore) {
      toast.error("Please fill in all fields");
      return;
    }
    
    if (newTicket.ratingScore < 1 || newTicket.ratingScore > 10) {
      toast.error("Rating score must be between 1 and 10");
      return;
    }
    
    onTicketsChange([...tickets, { ...newTicket, id: crypto.randomUUID() }]);
    setNewTicket({
      ticketLink: "",
      ratingScore: 7,
      customerPhone: "",
      ticketDate: new Date().toISOString().split('T')[0],
    });
    setDialogOpen(false);
    toast.success("Genesys ticket added successfully!");
  };

  const removeTicket = (id: string) => {
    onTicketsChange(tickets.filter(t => t.id !== id));
    toast.success("Ticket removed");
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add Genesys Ticket
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Genesys Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Ticket Date</label>
              <Input
                type="date"
                value={newTicket.ticketDate}
                onChange={(e) => setNewTicket({ ...newTicket, ticketDate: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Genesys Ticket Link</label>
              <Input
                type="url"
                placeholder="https://..."
                value={newTicket.ticketLink}
                onChange={(e) => setNewTicket({ ...newTicket, ticketLink: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Rating Score (1-10)</label>
              <Input
                type="number"
                min="1"
                max="10"
                placeholder="7-9 = Good, Others = Bad"
                value={newTicket.ratingScore}
                onChange={(e) => setNewTicket({ ...newTicket, ratingScore: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Scores 7-9 are considered Good (CSAT), others are Bad (DSAT)
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Customer Phone</label>
              <Input
                type="tel"
                placeholder="Phone number from survey"
                value={newTicket.customerPhone}
                onChange={(e) => setNewTicket({ ...newTicket, customerPhone: e.target.value })}
              />
            </div>
            
            <Button onClick={addTicket} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add Genesys Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Display Tickets Grouped by Date */}
      {tickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Genesys Tickets Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(
              tickets.reduce((acc, ticket) => {
                const date = ticket.ticketDate;
                if (!acc[date]) {
                  acc[date] = { good: 0, bad: 0, tickets: [] };
                }
                const isGood = ticket.ratingScore >= 7 && ticket.ratingScore <= 9;
                if (isGood) acc[date].good++;
                else acc[date].bad++;
                acc[date].tickets.push(ticket);
                return acc;
              }, {} as Record<string, { good: number; bad: number; tickets: typeof tickets }>)
            )
              .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
              .map(([date, data]) => (
                <Accordion key={date} type="single" collapsible className="mb-2">
                  <AccordionItem value={date}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-medium">
                          {new Date(date).toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </span>
                        <div className="flex gap-4 text-sm">
                          <span className="text-green-600 font-medium">
                            Good: {data.good}
                          </span>
                          <span className="text-red-600 font-medium">
                            Bad: {data.bad}
                          </span>
                          <span className="text-muted-foreground">
                            Total: {data.tickets.length}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {data.tickets.map((ticket) => {
                          const isGood = ticket.ratingScore >= 7 && ticket.ratingScore <= 9;
                          return (
                            <div key={ticket.id} className="p-4 border rounded-lg bg-muted/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-medium px-2 py-1 rounded ${
                                    isGood ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                  }`}>
                                    Score: {ticket.ratingScore} ({isGood ? "CSAT" : "DSAT"})
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeTicket(ticket.id!)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Genesys Link</label>
                                  <Input
                                    value={ticket.ticketLink}
                                    onChange={(e) => updateTicketInline(ticket.id!, "ticketLink", e.target.value)}
                                    placeholder="https://..."
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Rating Score</label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={ticket.ratingScore}
                                    onChange={(e) => updateTicketInline(ticket.id!, "ratingScore", parseInt(e.target.value) || 1)}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Customer Phone</label>
                                  <Input
                                    value={ticket.customerPhone}
                                    onChange={(e) => updateTicketInline(ticket.id!, "customerPhone", e.target.value)}
                                    placeholder="+1234567890"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ))
            }
          </CardContent>
        </Card>
      )}
    </>
  );
};
