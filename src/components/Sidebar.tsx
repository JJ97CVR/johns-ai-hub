import { useEffect, useState } from 'react';
import { Home, Database, Users, BarChart3, Activity, MessageSquare, Settings, ClipboardCheck, TrendingUp } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from '@/integrations/supabase/client';

const Sidebar = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (roles && roles.length > 0) {
        const userRoles = roles.map(r => r.role);
        setIsAdmin(userRoles.includes('admin') || userRoles.includes('owner'));
      }
    } catch (error) {
      console.error('Failed to check admin status:', error);
    }
  };

  const navItems = [
    {
      title: "Hem",
      href: "/",
      icon: Home,
      adminOnly: false,
    },
    {
      title: "Chat",
      href: "/chat",
      icon: MessageSquare,
      adminOnly: false,
    },
    {
      title: "Databas",
      href: "/database",
      icon: Database,
      adminOnly: false,
    },
    {
      title: "Personal",
      href: "/personal",
      icon: Users,
      adminOnly: false,
    },
    {
      title: "Rapporter",
      href: "/rapporter",
      icon: BarChart3,
      adminOnly: false,
    },
    {
      title: "System",
      href: "/system",
      icon: Activity,
      adminOnly: false,
    },
    {
      title: "Metrics",
      href: "/admin/metrics",
      icon: TrendingUp,
      adminOnly: true,
    },
    {
      title: "Review",
      href: "/admin/review",
      icon: ClipboardCheck,
      adminOnly: true,
    },
  ];

  // Filter nav items based on admin status
  const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="fixed left-0 top-[73px] h-[calc(100vh-73px)] w-64 border-r bg-card">
      <nav className="flex flex-col gap-1 pt-8 px-4 pb-4">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t bg-card p-4">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )
          }
        >
          <Settings className="h-5 w-5" />
          <span>Inställningar</span>
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
