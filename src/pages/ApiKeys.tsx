import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound, Plus, Copy, Trash2 } from "lucide-react";

const SAMPLE_KEY = {
  id: "sample",
  name: "Production API Key",
  maskedKey: "kie_••••••••••••••••••••••••abc1",
  created: "Jan 24, 2026",
};

const ApiKeys = () => {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
        <p className="text-sm text-slate-600 mt-1">Manage API keys for programmatic access.</p>

        <Card className="mt-8 rounded-lg border border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Your API Keys
              </CardTitle>
              <CardDescription>
                Create and manage API keys to integrate with external tools and workflows.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" disabled className="opacity-60">
              <Plus className="h-4 w-4 mr-2" />
              Create key
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500 mb-4">Sample key (for demo). Full create/revoke coming soon.</p>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div>
                <p className="font-medium text-slate-900">{SAMPLE_KEY.name}</p>
                <p className="font-mono text-sm text-slate-600 mt-1">{SAMPLE_KEY.maskedKey}</p>
                <p className="text-xs text-slate-500 mt-1">Created {SAMPLE_KEY.created}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" disabled className="opacity-60" title="Copy">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" disabled className="opacity-60 text-red-600" title="Revoke">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ApiKeys;
