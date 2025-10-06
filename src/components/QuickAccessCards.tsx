import { Database, Users, BarChart3, Activity, MessageSquare, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const quickAccessItems = [
  {
    title: "LexBot",
    description: "Chatta med AI-assistenten",
    icon: MessageSquare,
    gradient: "bg-gradient-to-br from-purple-500 to-blue-500",
    label: "AI Chat",
    path: "/lexbot",
  },
  {
    title: "LEX Assistant",
    description: "Din dokumentassistent",
    icon: FileText,
    gradient: "bg-gradient-to-br from-emerald-500 to-teal-500",
    label: "Documents",
    path: "/lex-assistant",
  },
  {
    title: "Databasöversikt",
    description: "Snabb åtkomst till alla databastabeller",
    icon: Database,
    gradient: "bg-[image:var(--gradient-database)]",
    label: "Database",
    path: "/database",
  },
  {
    title: "Personalregister",
    description: "Hantera och sök personal",
    icon: Users,
    gradient: "bg-[image:var(--gradient-personal)]",
    label: "Personal",
    path: "/personal",
  },
  {
    title: "Rapporter",
    description: "Generera och exportera rapporter",
    icon: BarChart3,
    gradient: "bg-[image:var(--gradient-analytics)]",
    label: "Analytics",
    path: "/rapporter",
  },
];

const QuickAccessCards = () => {
  const navigate = useNavigate();

  return (
    <div className="mt-16">
      <h3 className="mb-6 text-xl font-bold text-foreground">Snabbåtkomst</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {quickAccessItems.map((item) => (
          <button
            key={item.title}
            onClick={() => navigate(item.path)}
            className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all hover:scale-[1.02] hover:shadow-[var(--shadow-hover)]"
          >
            <div className={`absolute inset-0 ${item.gradient} opacity-100`} />
            <div className="relative z-10">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-white/80">
                {item.label}
              </div>
              <item.icon className="mb-4 h-8 w-8 text-white" />
              <h4 className="mb-2 text-lg font-bold text-white">{item.title}</h4>
              <p className="text-sm text-white/90">{item.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickAccessCards;
