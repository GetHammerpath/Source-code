import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Trash2 } from "lucide-react";

export interface Variable {
  id: string;
  name: string;
  label: string;
  values: string[];
}

interface VariableManagerProps {
  variables: Variable[];
  onChange: (variables: Variable[]) => void;
}

const PREDEFINED_VARIABLES = [
  { name: "avatar_name", label: "Avatar Name", suggestions: ["John", "Sarah", "Mike", "Emily", "David"] },
  { name: "avatar_age", label: "Avatar Age", suggestions: ["25", "35", "45", "55"] },
  { name: "avatar_gender", label: "Avatar Gender", suggestions: ["Male", "Female"] },
  { name: "background", label: "Background", suggestions: ["Office", "Warehouse", "Outdoor", "Kitchen", "Jobsite"] },
  { name: "tone", label: "Tone", suggestions: ["Professional", "Friendly", "Energetic", "Casual"] },
  { name: "industry_override", label: "Industry", suggestions: ["Roofing", "HVAC", "Plumbing", "Electrical", "Landscaping"] },
];

// Cross-browser compatible UUID generator
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const VariableManager = ({ variables, onChange }: VariableManagerProps) => {
  const [newValue, setNewValue] = useState<{ [key: string]: string }>({});

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
    setNewValue((prev) => ({ ...prev, [variableId]: "" }));
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

  const usedVariableNames = variables.map((v) => v.name);
  const availableVariables = PREDEFINED_VARIABLES.filter(
    (pv) => !usedVariableNames.includes(pv.name)
  );

  const calculateTotalVariations = () => {
    if (variables.length === 0) return 1;
    return variables.reduce((total, v) => total * Math.max(v.values.length, 1), 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Variables</Label>
        <Select
          onValueChange={(value) => {
            const predefined = PREDEFINED_VARIABLES.find((pv) => pv.name === value);
            if (predefined) addVariable(predefined.name, predefined.label);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Add variable..." />
          </SelectTrigger>
          <SelectContent>
            {availableVariables.map((pv) => (
              <SelectItem key={pv.name} value={pv.name}>
                {pv.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {variables.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <p>No variables added yet.</p>
          <p className="text-sm">Add variables to create video variations.</p>
        </div>
      )}

      <div className="space-y-4">
        {variables.map((variable) => {
          const predefined = PREDEFINED_VARIABLES.find((pv) => pv.name === variable.name);
          const unusedSuggestions = predefined?.suggestions.filter(
            (s) => !variable.values.includes(s)
          );

          return (
            <Card key={variable.id} className="border-border">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">{variable.label}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeVariable(variable.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="py-3 px-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {variable.values.map((value) => (
                    <Badge
                      key={value}
                      variant="secondary"
                      className="flex items-center gap-1 px-3 py-1"
                    >
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
                    <span className="text-sm text-muted-foreground">No values added</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder={`Add ${variable.label.toLowerCase()} value...`}
                    value={newValue[variable.id] || ""}
                    onChange={(e) =>
                      setNewValue((prev) => ({ ...prev, [variable.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addValue(variable.id);
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => addValue(variable.id)}
                    disabled={!newValue[variable.id]?.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {unusedSuggestions && unusedSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Suggestions:</span>
                    {unusedSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => addSuggestion(variable.id, suggestion)}
                        className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {variables.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">Total Variations:</span>
          <Badge variant="default" className="text-lg px-4 py-1">
            {calculateTotalVariations()} videos
          </Badge>
        </div>
      )}
    </div>
  );
};

export default VariableManager;
