import { Variable } from "./VariableManager";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VariationPreviewProps {
  variables: Variable[];
  baseConfig: {
    industry: string;
    city: string;
    storyIdea?: string;
  };
}

export interface VariableCombination {
  [key: string]: string;
}

export const calculateCombinations = (variables: Variable[]): VariableCombination[] => {
  const validVariables = variables.filter((v) => v.values.length > 0);
  
  if (validVariables.length === 0) return [{}];

  const [first, ...rest] = validVariables;
  const restCombinations = calculateCombinations(rest);

  return first.values.flatMap((value) =>
    restCombinations.map((combo) => ({
      ...combo,
      [first.name]: value,
    }))
  );
};

const VariationPreview = ({ variables, baseConfig }: VariationPreviewProps) => {
  const combinations = calculateCombinations(variables);
  const validVariables = variables.filter((v) => v.values.length > 0);

  if (validVariables.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
        <p>Add variables with values to see variations preview.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Preview Variations</h3>
        <Badge variant="outline">{combinations.length} variations</Badge>
      </div>

      <ScrollArea className="h-[400px] rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              {validVariables.map((v) => (
                <TableHead key={v.name}>{v.label}</TableHead>
              ))}
              <TableHead>Industry</TableHead>
              <TableHead>City</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {combinations.map((combo, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                {validVariables.map((v) => (
                  <TableCell key={v.name}>
                    <Badge variant="secondary">{combo[v.name]}</Badge>
                  </TableCell>
                ))}
                <TableCell>{combo.industry_override || baseConfig.industry}</TableCell>
                <TableCell>{baseConfig.city}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {baseConfig.storyIdea && (
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-2">Base Story Idea:</p>
          <p className="text-sm text-muted-foreground">{baseConfig.storyIdea}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Variables will be substituted: {"{avatar_name}"}, {"{background}"}, etc.
          </p>
        </div>
      )}
    </div>
  );
};

export default VariationPreview;
