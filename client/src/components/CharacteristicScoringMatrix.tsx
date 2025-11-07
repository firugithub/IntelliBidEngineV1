import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VendorCharacteristics {
  vendorName: string;
  characteristics: {
    compatibility: number;
    maintainability: number;
    performanceEfficiency: number;
    portability: number;
    reliability: number;
    security: number;
    usability: number;
  };
  grandTotal: number;
}

interface CharacteristicScoringMatrixProps {
  evaluations: {
    vendorName: string;
    overallScore: number;
    functionalFit: number;
    technicalFit: number;
    compliance: number;
    deliveryRisk: number;
    detailedScores?: {
      integration?: number;
      support?: number;
      scalability?: number;
      documentation?: number;
      compatibility?: number;
      maintainability?: number;
      performance?: number;
      portability?: number;
      reliability?: number;
      security?: number;
      usability?: number;
    };
    excelScores?: {
      characteristicScores?: {
        compatibility: number;
        maintainability: number;
        performanceEfficiency: number;
        portability: number;
        reliability: number;
        security: number;
        usability: number;
      };
    };
  }[];
}

export function CharacteristicScoringMatrix({ evaluations }: CharacteristicScoringMatrixProps) {
  // Calculate characteristic scores for each vendor
  const vendorCharacteristics: VendorCharacteristics[] = evaluations.map(evaluation => {
    const detailed = evaluation.detailedScores || {};
    const excelCharacteristics = evaluation.excelScores?.characteristicScores;
    
    // PRIORITY: Use NFR Excel scores if available, otherwise fall back to AI-derived scores
    const characteristics = {
      compatibility: excelCharacteristics?.compatibility ?? detailed.compatibility ?? evaluation.functionalFit,
      maintainability: excelCharacteristics?.maintainability ?? detailed.maintainability ?? (evaluation.technicalFit * 0.8 + (detailed.documentation ?? 75) * 0.2),
      performanceEfficiency: excelCharacteristics?.performanceEfficiency ?? detailed.performance ?? evaluation.technicalFit,
      portability: excelCharacteristics?.portability ?? detailed.portability ?? ((detailed.integration ?? 70) * 0.6 + evaluation.technicalFit * 0.4),
      reliability: excelCharacteristics?.reliability ?? detailed.reliability ?? (100 - evaluation.deliveryRisk),
      security: excelCharacteristics?.security ?? detailed.security ?? evaluation.compliance,
      usability: excelCharacteristics?.usability ?? detailed.usability ?? ((detailed.documentation ?? 75) * 0.5 + evaluation.functionalFit * 0.5),
    };

    // Calculate grand total as weighted average
    const weights = {
      compatibility: 0.15,
      maintainability: 0.12,
      performanceEfficiency: 0.18,
      portability: 0.10,
      reliability: 0.20,
      security: 0.15,
      usability: 0.10,
    };

    const grandTotal = 
      characteristics.compatibility * weights.compatibility +
      characteristics.maintainability * weights.maintainability +
      characteristics.performanceEfficiency * weights.performanceEfficiency +
      characteristics.portability * weights.portability +
      characteristics.reliability * weights.reliability +
      characteristics.security * weights.security +
      characteristics.usability * weights.usability;

    return {
      vendorName: evaluation.vendorName,
      characteristics,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400 font-semibold";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getGrandTotalColor = (score: number) => {
    if (score >= 85) return "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300";
    if (score >= 70) return "bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300";
    return "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300";
  };

  const characteristics = [
    { key: 'compatibility' as const, label: 'Compatibility' },
    { key: 'maintainability' as const, label: 'Maintainability' },
    { key: 'performanceEfficiency' as const, label: 'Performance Efficiency' },
    { key: 'portability' as const, label: 'Portability' },
    { key: 'reliability' as const, label: 'Reliability' },
    { key: 'security' as const, label: 'Security' },
    { key: 'usability' as const, label: 'Usability' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Non Functional Requirement Score</CardTitle>
        <CardDescription>
          NFR questionnaire scores across software quality characteristics (ISO/IEC 25010)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" data-testid="table-characteristic-scoring">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left p-3 font-semibold sticky left-0 bg-background z-10 min-w-[180px]">
                  <div className="text-base">Characteristic</div>
                </th>
                {vendorCharacteristics.map((vendor) => (
                  <th
                    key={vendor.vendorName}
                    className="text-center p-3 min-w-[140px]"
                    data-testid={`header-vendor-${vendor.vendorName}`}
                  >
                    <div className="font-semibold text-base">{vendor.vendorName}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Header row with 0.00 values */}
              <tr className="border-b bg-muted/30">
                <td className="p-3 font-medium sticky left-0 bg-muted/30 z-10"></td>
                {vendorCharacteristics.map((vendor) => (
                  <td
                    key={vendor.vendorName}
                    className="text-center p-3 text-muted-foreground"
                    data-testid={`cell-baseline-${vendor.vendorName}`}
                  >
                    0.00
                  </td>
                ))}
              </tr>

              {/* Characteristic rows */}
              {characteristics.map((char, charIndex) => (
                <tr
                  key={char.key}
                  className={`border-b hover-elevate transition-colors ${
                    charIndex % 2 === 0 ? 'bg-muted/20' : ''
                  }`}
                  data-testid={`row-characteristic-${char.key}`}
                >
                  <td className="p-3 font-medium sticky left-0 bg-background z-10">
                    {char.label}
                  </td>
                  {vendorCharacteristics.map((vendor) => {
                    const score = vendor.characteristics[char.key];
                    return (
                      <td
                        key={vendor.vendorName}
                        className={`text-center p-3 ${getScoreColor(score)}`}
                        data-testid={`cell-${char.key}-${vendor.vendorName}`}
                      >
                        {score.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Grand Total row */}
              <tr className="border-t-2 border-border font-bold">
                <td className="p-3 sticky left-0 bg-background z-10 text-base">
                  Grand Total
                </td>
                {vendorCharacteristics.map((vendor) => (
                  <td
                    key={vendor.vendorName}
                    className={`text-center p-3 ${getGrandTotalColor(vendor.grandTotal)}`}
                    data-testid={`cell-grandtotal-${vendor.vendorName}`}
                  >
                    <Badge
                      variant="secondary"
                      className={`${getGrandTotalColor(vendor.grandTotal)} font-bold text-base border-0`}
                    >
                      {vendor.grandTotal.toFixed(2)}
                    </Badge>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-green-500"></div>
            <span>Excellent (≥80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-yellow-500"></div>
            <span>Good (60-79%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-orange-500"></div>
            <span>Fair (40-59%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-red-500"></div>
            <span>Poor (&lt;40%)</span>
          </div>
        </div>

        {/* Weights explanation */}
        <div className="mt-3 p-3 bg-muted/50 rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>Weighting:</strong> Reliability (20%), Performance (18%), Compatibility (15%), Security (15%), 
            Maintainability (12%), Usability (10%), Portability (10%)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
