import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "./StatusBadge";
import { Building2, MapPin, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface RequestCardProps {
  id: string;
  clientCompanyName: string;
  companyType: string;
  cityCommunity: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
}

const RequestCard = ({
  id,
  clientCompanyName,
  companyType,
  cityCommunity,
  status,
  createdAt,
}: RequestCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="hover:shadow-elegant transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">{clientCompanyName}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span className="capitalize">{companyType.replace("_", " ")}</span>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{cityCommunity}</span>
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {new Date(createdAt).toLocaleDateString()}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/request/${id}`)}
        >
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
};

export default RequestCard;
