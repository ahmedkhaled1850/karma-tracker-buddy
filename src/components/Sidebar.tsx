import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Settings, LogOut, ChevronLeft, ChevronRight, Calendar, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  collapsed?: boolean;
  toggleCollapsed?: () => void;
}

export function Sidebar({ collapsed = false, toggleCollapsed }: SidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();

  const links = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "Work Schedule", href: "/work-schedule", icon: Calendar },
  ];

  const SidebarContent = () => (
    <>
      <div className={cn("p-4 border-b flex items-center", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent whitespace-nowrap">
            Big Brother
          </h1>
        )}
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleCollapsed} 
            className={cn("hidden md:flex", collapsed && "h-8 w-8")}
        >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-2 space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.href;
          
          const LinkButton = (
            <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start mb-1",
                  isActive && "bg-secondary font-medium",
                  collapsed ? "px-2 justify-center" : "gap-3"
                )}
            >
                <Icon className={cn("h-5 w-5", collapsed ? "" : "")} />
                {!collapsed && <span>{link.name}</span>}
            </Button>
          );

          return (
            <div key={link.href}>
                {collapsed ? (
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Link to={link.href}>{LinkButton}</Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                {link.name}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    <Link to={link.href}>{LinkButton}</Link>
                )}
            </div>
          );
        })}

        {/* Quick Actions */}
        <div className="pt-2 border-t border-border mt-2 space-y-2">
          {/* Add Good Rating */}
          <div>
            {collapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/"
                      onClick={() => {
                        try { localStorage.setItem("ktb_quick_rating", "good"); } catch {}
                      }}
                    >
                      <Button variant="ghost" className="w-full px-2 justify-center">
                        <Plus className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Add Good Rating</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Link
                to="/"
                onClick={() => {
                  try { localStorage.setItem("ktb_quick_rating", "good"); } catch {}
                }}
              >
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <Plus className="h-5 w-5" />
                  <span>Add Good Rating</span>
                </Button>
              </Link>
            )}
          </div>

          {/* Add Bad Rating */}
          <div>
            {collapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/"
                      onClick={() => {
                        try { localStorage.setItem("ktb_quick_rating", "bad"); } catch {}
                      }}
                    >
                      <Button variant="ghost" className="w-full px-2 justify-center">
                        <Minus className="h-5 w-5 text-destructive" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Add Bad Rating</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Link
                to="/"
                onClick={() => {
                  try { localStorage.setItem("ktb_quick_rating", "bad"); } catch {}
                }}
              >
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <Minus className="h-5 w-5 text-destructive" />
                  <span>Add Bad Rating</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t">
        {collapsed ? (
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="w-full" onClick={signOut}>
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Sign Out</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        ) : (
            <Button variant="outline" className="w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="h-5 w-5" />
            Sign Out
            </Button>
        )}
      </div>
    </>
  );

  return (
    <div 
        className={cn(
            "hidden md:flex h-screen flex-col border-r bg-card fixed left-0 top-0 z-50 transition-all duration-300",
            collapsed ? "w-16" : "w-64"
        )}
    >
        <SidebarContent />
    </div>
  );
}
