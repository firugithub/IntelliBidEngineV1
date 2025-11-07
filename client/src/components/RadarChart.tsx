import { useState, useEffect } from "react";
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";

interface VendorData {
  name: string;
  data: {
    criterion: string;
    score: number;
  }[];
  color: string;
}

interface RadarChartProps {
  vendors: VendorData[];
}

export function RadarChart({ vendors }: RadarChartProps) {
  // Track which vendors are visible
  const [visibleVendors, setVisibleVendors] = useState<Set<string>>(
    new Set(vendors.map(v => v.name))
  );

  // Sync visible vendors when the vendors prop changes (e.g., after re-evaluation)
  // Reset to show all vendors when data refreshes for consistent, predictable UX
  useEffect(() => {
    setVisibleVendors(new Set(vendors.map(v => v.name)));
  }, [vendors]);

  const toggleVendor = (vendorName: string) => {
    setVisibleVendors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vendorName)) {
        // Don't allow hiding all vendors
        if (newSet.size > 1) {
          newSet.delete(vendorName);
        }
      } else {
        newSet.add(vendorName);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    // Guard against empty vendor list
    if (vendors.length === 0) return;
    
    if (visibleVendors.size === vendors.length) {
      // If all visible, show only first vendor
      setVisibleVendors(new Set([vendors[0].name]));
    } else {
      // Otherwise show all
      setVisibleVendors(new Set(vendors.map(v => v.name)));
    }
  };

  const criteria = vendors[0]?.data.map((d) => d.criterion) || [];
  
  const chartData = criteria.map((criterion) => {
    const dataPoint: any = { criterion };
    vendors.forEach((vendor) => {
      const score = vendor.data.find((d) => d.criterion === criterion)?.score || 0;
      dataPoint[vendor.name] = score;
    });
    return dataPoint;
  });

  // Filter to only show visible vendors
  const visibleVendorsList = vendors.filter(v => visibleVendors.has(v.name));

  return (
    <div className="space-y-4" data-testid="vendor-comparison-radar">
      {/* Vendor Toggle Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Compare:</span>
        {vendors.map((vendor) => {
          const isVisible = visibleVendors.has(vendor.name);
          return (
            <Button
              key={vendor.name}
              variant={isVisible ? "default" : "outline"}
              size="sm"
              onClick={() => toggleVendor(vendor.name)}
              className="gap-2"
              style={{
                ...(isVisible && {
                  backgroundColor: vendor.color,
                  borderColor: vendor.color,
                  color: 'white',
                }),
                ...(!isVisible && {
                  borderColor: vendor.color,
                  color: vendor.color,
                }),
              }}
              data-testid={`button-toggle-vendor-${vendor.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {vendor.name}
            </Button>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleAll}
          className="gap-2"
          data-testid="button-toggle-all-vendors"
        >
          {visibleVendors.size === vendors.length ? "Reset" : "Show All"}
        </Button>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={450}>
        <RechartsRadarChart data={chartData}>
          <PolarGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="criterion"
            tick={{ fontSize: 13, fill: "hsl(var(--foreground))" }}
            stroke="hsl(var(--border))"
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            stroke="hsl(var(--border))"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
          />
          <Legend 
            wrapperStyle={{
              paddingTop: "20px",
            }}
          />
          {visibleVendorsList.map((vendor) => (
            <Radar
              key={vendor.name}
              name={vendor.name}
              dataKey={vendor.name}
              stroke={vendor.color}
              fill={vendor.color}
              fillOpacity={0.25}
              strokeWidth={2}
            />
          ))}
        </RechartsRadarChart>
      </ResponsiveContainer>

      {/* Legend with scores */}
      <div className="flex flex-wrap gap-4 pt-2">
        {visibleVendorsList.map((vendor) => {
          const avgScore = Math.round(
            vendor.data.reduce((sum, d) => sum + d.score, 0) / vendor.data.length
          );
          return (
            <div key={vendor.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: vendor.color }}
              />
              <span className="text-sm font-medium">{vendor.name}</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {avgScore}% avg
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
