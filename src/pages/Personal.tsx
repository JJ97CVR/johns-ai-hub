import { Users } from "lucide-react";

const Personal = () => {
  return (
    <div className="p-4 sm:p-6 md:p-8 pt-[90px]">
      <div className="mb-6 flex items-center gap-3 max-w-7xl mx-auto">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-personal)]">
          <Users className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Personalregister</h1>
          <p className="text-sm text-muted-foreground">Hantera och sök personal</p>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-6 sm:p-8 text-center max-w-7xl mx-auto">
        <p className="text-muted-foreground">Personalregister kommer snart...</p>
      </div>
    </div>
  );
};

export default Personal;
