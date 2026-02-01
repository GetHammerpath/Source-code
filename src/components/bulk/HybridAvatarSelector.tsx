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
  seed_image_url?: string;
}

const AUTO_CAST_OPTIONS = [
  { id: "__auto_professional__", name: "Auto-Cast: Professional" },
  { id: "__auto_casual__", name: "Auto-Cast: Casual" },
];

interface HybridAvatarSelectorProps {
  value: string;
  onChange: (value: string, displayName: string, isNewGeneration?: boolean) => void;
  avatars: AvatarOption[];
  placeholder?: string;
  className?: string;
  invalid?: boolean;
}

export function HybridAvatarSelector({
  value,
  onChange,
  avatars,
  placeholder = "Select or type...",
  className,
  invalid,
}: HybridAvatarSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const displayValue = React.useMemo(() => {
    if (!value) return "";
    const auto = AUTO_CAST_OPTIONS.find((a) => a.id === value);
    if (auto) return auto.name;
    const avatar = avatars.find((a) => a.id === value);
    if (avatar) return avatar.name;
    return value;
  }, [value, avatars]);

  const handleSelect = (id: string, name: string, isNew = false) => {
    onChange(id, name, isNew);
    setOpen(false);
    setInputValue("");
  };

  const handleCustomSubmit = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      handleSelect(trimmed, trimmed, true);
    }
  };

  const allOptions = [
    ...AUTO_CAST_OPTIONS,
    ...avatars.map((a) => ({ id: a.id, name: a.name })),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-9 min-h-9",
            invalid && "border-red-500 bg-red-50 dark:bg-red-950/20",
            className
          )}
        >
          <span className={cn(!displayValue && "text-muted-foreground")}>
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type new..."
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={(e) => {
              if (e.key === "Enter" && inputValue.trim()) {
                e.preventDefault();
                handleCustomSubmit();
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue.trim() ? (
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm"
                  onClick={() => handleCustomSubmit()}
                >
                  Use &quot;{inputValue.trim()}&quot; (new generation)
                </button>
              ) : (
                "No results."
              )}
            </CommandEmpty>
            <CommandGroup heading="Auto-Cast">
              {AUTO_CAST_OPTIONS.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  onSelect={() => handleSelect(opt.id, opt.name)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Your Avatars">
              {avatars.map((avatar) => (
                <CommandItem
                  key={avatar.id}
                  value={avatar.id}
                  onSelect={() => handleSelect(avatar.id, avatar.name)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === avatar.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {avatar.name}
                </CommandItem>
              ))}
              {avatars.length === 0 && (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No avatars yet. Create one first.
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
