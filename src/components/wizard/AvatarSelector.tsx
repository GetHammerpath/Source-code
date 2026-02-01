import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface AvatarOption {
  id: string;
  name: string;
}

const AUTO_CAST = [
  { id: "__auto_professional__", name: "Auto-Cast: Professional" },
  { id: "__auto_casual__", name: "Auto-Cast: Casual" },
];

interface AvatarSelectorProps {
  value: string;
  onChange: (id: string, name: string) => void;
  avatars: AvatarOption[];
  invalid?: boolean;
  className?: string;
}

export function AvatarSelector({ value, onChange, avatars, invalid, className }: AvatarSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const displayValue =
    AUTO_CAST.find((a) => a.id === value)?.name ||
    avatars.find((a) => a.id === value)?.name ||
    value ||
    "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-9 text-xs min-w-0",
            invalid && "border-red-500",
            className
          )}
        >
          <span className={cn("flex-1 min-w-0 text-left overflow-hidden text-ellipsis whitespace-nowrap", !displayValue && "text-muted-foreground")} title={displayValue || undefined}>
            {displayValue || "Select..."}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No avatar found.</CommandEmpty>
            <CommandGroup heading="Auto-Cast">
              {AUTO_CAST.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  onSelect={() => {
                    onChange(opt.id, opt.name);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt.id ? "opacity-100" : "opacity-0")} />
                  {opt.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Your Avatars">
              {avatars.map((a) => (
                <CommandItem
                  key={a.id}
                  value={a.id}
                  onSelect={() => {
                    onChange(a.id, a.name);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === a.id ? "opacity-100" : "opacity-0")} />
                  {a.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
