import { Database } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const WelcomeSection = () => {
  const [userName, setUserName] = useState<string>('');
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        // Extract first name from email (before @)
        const name = user.email.split('@')[0];
        const formatted = name.charAt(0).toUpperCase() + name.slice(1);
        setUserName(formatted);
      }
    });
  }, []);

  return (
    <div className="text-center animate-fade-in">
      <h1 className="mb-3 text-3xl font-bold text-foreground">
        Välkommen tillbaka{userName ? `, ${userName}` : ''}
      </h1>
      <p className="mb-12 text-muted-foreground">
        Här kan du ställa frågor om allt hos LEX Automotive - lager, produktinformation, personal och mycket mer
      </p>

      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10">
        <Database className="h-10 w-10 text-primary" />
      </div>

      <h2 className="mb-3 text-2xl font-bold text-foreground">
        Hur kan jag hjälpa dig?
      </h2>
      <p className="text-muted-foreground">
        Ställ frågor om databasen, personal eller systemet
      </p>
    </div>
  );
};

export default WelcomeSection;
