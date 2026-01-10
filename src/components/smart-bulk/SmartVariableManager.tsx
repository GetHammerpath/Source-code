import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Shuffle, Sparkles, Zap } from "lucide-react";

export interface Variable {
  id: string;
  name: string;
  label: string;
  values: string[];
}

interface SmartVariableManagerProps {
  variables: Variable[];
  onChange: (variables: Variable[]) => void;
  videoCount: number;
  onVideoCountChange: (count: number) => void;
  onGenerateCombinations: () => void;
  onAutoGenerateCombinations: (selectedVariableNames: string[]) => void;
  totalPossibleCombinations: number;
}

export const PREDEFINED_VARIABLES = [
  { name: "avatar_name", label: "Avatar Name", suggestions: ["John", "Sarah", "Mike", "Emily", "David"] },
  { name: "avatar_age", label: "Avatar Age", suggestions: ["25", "35", "45", "55"] },
  { name: "avatar_gender", label: "Avatar Gender", suggestions: ["Male", "Female"] },
  { name: "background", label: "Background", suggestions: ["Office", "Jobsite", "Outdoor", "Modern Home"] },
  { name: "city_override", label: "City", suggestions: ["Austin", "Dallas", "Houston", "Phoenix", "Denver"] },
  { name: "industry_override", label: "Industry", suggestions: ["Roofing", "HVAC", "Plumbing", "Electrical", "Landscaping"] },
];

// Cross-browser compatible UUID generator
const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const SmartVariableManager = ({
  variables,
  onChange,
  videoCount,
  onVideoCountChange,
  onGenerateCombinations,
  onAutoGenerateCombinations,
  totalPossibleCombinations,
}: SmartVariableManagerProps) => {
  const [newValue, setNewValue] = useState<{ [key: string]: string }>({});
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [selectedAutoVars, setSelectedAutoVars] = useState<string[]>(
    PREDEFINED_VARIABLES.map((v) => v.name)
  );

  const addVariable = (name: string, label: string) => {
    if (variables.some((v) => v.name === name)) return;

    const newVariable: Variable = {
      id: generateId(),
      name,
      label,
      values: [],
    };
    onChange([...variables, newVariable]);
  };

  const removeVariable = (id: string) => {
    onChange(variables.filter((v) => v.id !== id));
  };

  const addValue = (variableId: string) => {
    const value = newValue[variableId]?.trim();
    if (!value) return;

    onChange(
      variables.map((v) => {
        if (v.id === variableId && !v.values.includes(value)) {
          return { ...v, values: [...v.values, value] };
        }
        return v;
      })
    );
    setNewValue({ ...newValue, [variableId]: "" });
  };

  const removeValue = (variableId: string, value: string) => {
    onChange(
      variables.map((v) => {
        if (v.id === variableId) {
          return { ...v, values: v.values.filter((val) => val !== value) };
        }
        return v;
      })
    );
  };

  const addSuggestion = (variableId: string, suggestion: string) => {
    onChange(
      variables.map((v) => {
        if (v.id === variableId && !v.values.includes(suggestion)) {
          return { ...v, values: [...v.values, suggestion] };
        }
        return v;
      })
    );
  };

  const toggleAutoVar = (varName: string) => {
    setSelectedAutoVars((prev) =>
      prev.includes(varName)
        ? prev.filter((v) => v !== varName)
        : [...prev, varName]
    );
  };

  const totalAutoCombinations = useMemo(() => {
    if (selectedAutoVars.length === 0) return 0;
    return selectedAutoVars.reduce((acc, varName) => {
      const predefined = PREDEFINED_VARIABLES.find((v) => v.name === varName);
      return acc * (predefined?.suggestions.length || 1);
    }, 1);
  }, [selectedAutoVars]);

  const availableVariables = PREDEFINED_VARIABLES.filter(
    (pv) => !variables.some((v) => v.name === pv.name)
  );

  const maxVideos = autoGenerate 
    ? Math.min(totalAutoCombinations, 100)
    : Math.min(totalPossibleCombinations, 100);
  const effectiveVideoCount = Math.min(videoCount, maxVideos);

  const handleAutoGenerate = () => {
    onAutoGenerateCombinations(selectedAutoVars);
  };

  return (
    <div className="space-y-6">
      {/* Generation Mode Toggle */}
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Auto Generate Mode</CardTitle>
            </div>
            <Switch checked={autoGenerate} onCheckedChange={setAutoGenerate} />
          </div>
          <CardDescription>
            {autoGenerate
              ? "Automatically create random combinations using all predefined values"
              : "Manually select variables and add custom values"}
          </CardDescription>
        </CardHeader>
      </Card>

      {autoGenerate ? (
        /* Auto Generate Section */
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Variables to Include</CardTitle>
              <CardDescription>
                Check variables you want to include in auto-generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PREDEFINED_VARIABLES.map((variable) => (
                  <div
                    key={variable.name}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={variable.name}
                      checked={selectedAutoVars.includes(variable.name)}
                      onCheckedChange={() => toggleAutoVar(variable.name)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={variable.name} className="cursor-pointer font-medium">
                        {variable.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {variable.suggestions.length} options
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Auto Generate Combinations
              </CardTitle>
              <CardDescription>
                {totalAutoCombinations > 0
                  ? `${totalAutoCombinations.toLocaleString()} possible combinations from selected variables`
                  : "Select at least one variable"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>How many videos do you want to generate?</Label>
                <Input
                  type="number"
                  min={1}
                  max={maxVideos}
                  value={effectiveVideoCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    onVideoCountChange(Math.min(Math.max(1, value), maxVideos));
                  }}
                  disabled={totalAutoCombinations === 0}
                />
                {totalAutoCombinations > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Max: {Math.min(maxVideos, 100)} videos
                  </p>
                )}
              </div>

              <Button
                onClick={handleAutoGenerate}
                disabled={selectedAutoVars.length === 0 || effectiveVideoCount < 1}
                className="w-full"
              >
                <Zap className="h-4 w-4 mr-2" />
                Auto Generate {effectiveVideoCount} Combinations
              </Button>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Manual Mode */
        <>
          {/* Add Variable Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Variable</CardTitle>
              <CardDescription>Select variables to create variations</CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                onValueChange={(value) => {
                  const variable = PREDEFINED_VARIABLES.find((v) => v.name === value);
                  if (variable) {
                    addVariable(variable.name, variable.label);
                  }
                }}
                value=""
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a variable to add..." />
                </SelectTrigger>
                <SelectContent>
                  {availableVariables.map((v) => (
                    <SelectItem key={v.name} value={v.name}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Variable Cards */}
          {variables.map((variable) => {
            const predefined = PREDEFINED_VARIABLES.find((pv) => pv.name === variable.name);
            const unusedSuggestions = predefined?.suggestions.filter(
              (s) => !variable.values.includes(s)
            );

            return (
              <Card key={variable.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{variable.label}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariable(variable.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription className="text-xs">Variable: {`{${variable.name}}`}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Current Values */}
                  <div className="flex flex-wrap gap-2">
                    {variable.values.map((value) => (
                      <Badge key={value} variant="secondary" className="gap-1 pr-1">
                        {value}
                        <button
                          onClick={() => removeValue(variable.id, value)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {variable.values.length === 0 && (
                      <span className="text-sm text-muted-foreground">No values added yet</span>
                    )}
                  </div>

                  {/* Add Value Input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom value..."
                      value={newValue[variable.id] || ""}
                      onChange={(e) =>
                        setNewValue({ ...newValue, [variable.id]: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addValue(variable.id);
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => addValue(variable.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Suggestions */}
                  {unusedSuggestions && unusedSuggestions.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Suggestions:</Label>
                      <div className="flex flex-wrap gap-1">
                        {unusedSuggestions.map((suggestion) => (
                          <Button
                            key={suggestion}
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => addSuggestion(variable.id, suggestion)}
                          >
                            + {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Video Count Section */}
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Combinations
              </CardTitle>
              <CardDescription>
                {totalPossibleCombinations > 0
                  ? `${totalPossibleCombinations} possible combinations available`
                  : "Add variables with values to generate combinations"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>How many videos do you want to generate?</Label>
                <Input
                  type="number"
                  min={1}
                  max={maxVideos}
                  value={effectiveVideoCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    onVideoCountChange(Math.min(Math.max(1, value), maxVideos));
                  }}
                  disabled={totalPossibleCombinations === 0}
                />
                {totalPossibleCombinations > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Max: {maxVideos} videos
                  </p>
                )}
              </div>

              <Button
                onClick={onGenerateCombinations}
                disabled={totalPossibleCombinations === 0 || effectiveVideoCount < 1}
                className="w-full"
              >
                <Shuffle className="h-4 w-4 mr-2" />
                Generate {effectiveVideoCount} Random Combinations
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
