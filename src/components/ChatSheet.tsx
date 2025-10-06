import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatExact from "@/pages/ChatExact";

export default function ChatSheet({
  open,
  onOpenChange,
  persistent = true,
}: { 
  open: boolean; 
  onOpenChange: (v: boolean) => void; 
  persistent?: boolean; 
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Smart stängningslogik: Tillåt X-knapp men blockera overlay i persistent mode
        if (!persistent) {
          onOpenChange(next);
          return;
        }
        
        // I persistent mode: Bara stäng explicit (via X-knapp)
        if (next === false) {
          onOpenChange(false);
        } else {
          onOpenChange(true);
        }
      }}
      modal={!persistent}
    >
      <SheetContent
        side="right"
        className="w-full sm:w-[680px] p-0 flex flex-col"
        forceMount
        onPointerDownOutside={(e) => {
          if (persistent) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (persistent) {
            e.preventDefault();
          }
        }}
      >
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle>LEX Chat</SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatExact embedded />
        </div>
      </SheetContent>
    </Sheet>
  );
}
