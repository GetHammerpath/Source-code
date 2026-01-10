import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Shuffle, RotateCcw, Loader2 } from "lucide-react";
import { Variable } from "./SmartVariableManager";

export interface EditableCombination {
  id: string;
  values: { [variableName: string]: string };
}

interface EditableCombinationsTableProps {
  combinations: EditableCombination[];
  variables: Variable[];
  baseConfig: { industry: string; city: string; storyIdea?: string };
  onChange: (combinations: EditableCombination[]) => void;
  onRegenerate: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

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

export const EditableCombinationsTable = ({
  combinations,
  variables,
  baseConfig,
  onChange,
  onRegenerate,
  onSubmit,
  isSubmitting = false,
}: EditableCombinationsTableProps) => {
  const updateCell = (combinationId: string, variableName: string, value: string) => {
    onChange(
      combinations.map((combo) => {
        if (combo.id === combinationId) {
          return {
            ...combo,
            values: { ...combo.values, [variableName]: value },
          };
        }
        return combo;
      })
    );
  };

  const deleteRow = (combinationId: string) => {
    onChange(combinations.filter((combo) => combo.id !== combinationId));
  };

  const addRandomRow = () => {
    const newValues: { [key: string]: string } = {};
    variables.forEach((variable) => {
      if (variable.values.length > 0) {
        const randomIndex = Math.floor(Math.random() * variable.values.length);
        newValues[variable.name] = variable.values[randomIndex];
      }
    });

    const newCombination: EditableCombination = {
      id: generateId(),
      values: newValues,
    };
    onChange([...combinations, newCombination]);
  };

  const clearAll = () => {
    onChange([]);
  };

  // Preview how the story idea will look with substitutions
  const previewStoryIdea = (combo: EditableCombination) => {
    if (!baseConfig.storyIdea) return null;
    let preview = baseConfig.storyIdea;
    for (const [key, value] of Object.entries(combo.values)) {
      preview = preview.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
    return preview.length > 100 ? preview.substring(0, 100) + "..." : preview;
  };

  if (combinations.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">
            No combinations generated yet. Go to the Variables tab to generate combinations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Review & Edit Combinations</CardTitle>
              <CardDescription>
                {combinations.length} video{combinations.length !== 1 ? "s" : ""} will be generated
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addRandomRow}>
                <Plus className="h-4 w-4 mr-1" />
                Add Row
              </Button>
              <Button variant="outline" size="sm" onClick={onRegenerate}>
                <Shuffle className="h-4 w-4 mr-1" />
                Shuffle
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  {variables.map((variable) => (
                    <TableHead key={variable.id}>{variable.label}</TableHead>
                  ))}
                  {baseConfig.storyIdea && <TableHead>Preview</TableHead>}
                  <TableHead className="w-16">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinations.map((combo, index) => (
                  <TableRow key={combo.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    {variables.map((variable) => (
                      <TableCell key={variable.id}>
                        <Select
                          value={combo.values[variable.name] || ""}
                          onValueChange={(value) =>
                            updateCell(combo.id, variable.name, value)
                          }
                        >
                          <SelectTrigger className="h-8 w-full min-w-[100px]">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {variable.values.map((val) => (
                              <SelectItem key={val} value={val}>
                                {val}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    ))}
                    {baseConfig.storyIdea && (
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {previewStoryIdea(combo)}
                      </TableCell>
                    )}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteRow(combo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Base Config Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Industry:</span>{" "}
              <span className="font-medium">{baseConfig.industry || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">City:</span>{" "}
              <span className="font-medium">{baseConfig.city || "-"}</span>
            </div>
          </div>
          {baseConfig.storyIdea && (
            <div className="mt-3 pt-3 border-t">
              <span className="text-muted-foreground text-sm">Story Template:</span>
              <p className="text-sm mt-1">{baseConfig.storyIdea}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Button */}
      <Button
        onClick={onSubmit}
        disabled={combinations.length === 0 || isSubmitting}
        size="lg"
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Starting Generation...
          </>
        ) : (
          <>Generate {combinations.length} Videos</>
        )}
      </Button>
    </div>
  );
};
