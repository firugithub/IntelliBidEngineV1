import PDFDocument from 'pdfkit';
import type { IStorage } from '../storage';

interface EvaluationData {
  id: string;
  vendorName: string;
  overallScore: number;
  technicalFit: number;
  deliveryRisk: number;
  cost: string;
  compliance: number;
  status: string;
  aiRationale: string | null;
  roleInsights: any;
  detailedScores: any;
  sectionCompliance?: any[];
}

export async function generateEvaluationReportPdf(
  projectId: string,
  storage: IStorage
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const project = await storage.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const evaluations = await storage.getEvaluationsByProject(projectId);
      const proposals = await storage.getProposalsByProject(projectId);

      // Enrich evaluations with vendor info
      const enrichedEvaluations: EvaluationData[] = evaluations.map((evaluation) => {
        const proposal = proposals.find((p) => p.id === evaluation.proposalId);
        return {
          ...evaluation,
          vendorName: proposal?.vendorName || 'Unknown Vendor',
        };
      });

      // Sort by overall score descending
      enrichedEvaluations.sort((a, b) => b.overallScore - a.overallScore);

      const doc = new PDFDocument({ 
        size: 'A4', 
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Helper functions
      const addSection = (title: string, level = 1) => {
        doc.moveDown(1);
        if (level === 1) {
          doc.fontSize(16).fillColor('#0079F2').text(title, { underline: true });
        } else {
          doc.fontSize(14).fillColor('#333333').text(title, { underline: true });
        }
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#000000');
      };

      const addTable = (headers: string[], rows: string[][], colWidths?: number[]) => {
        const startX = doc.x;
        const startY = doc.y;
        const tableWidth = 495;
        const rowHeight = 25;
        
        // Auto-calculate column widths if not provided
        const widths = colWidths || headers.map(() => tableWidth / headers.length);

        // Draw header
        let currentX = startX;
        doc.fontSize(9).fillColor('#FFFFFF');
        headers.forEach((header, i) => {
          doc.rect(currentX, startY, widths[i], rowHeight).fillAndStroke('#0079F2', '#0079F2');
          doc.text(header, currentX + 5, startY + 8, { width: widths[i] - 10, align: 'left' });
          currentX += widths[i];
        });

        // Draw rows
        let currentY = startY + rowHeight;
        doc.fillColor('#000000');
        rows.forEach((row, rowIndex) => {
          currentX = startX;
          const fillColor = rowIndex % 2 === 0 ? '#F9F9F9' : '#FFFFFF';
          row.forEach((cell, colIndex) => {
            doc.rect(currentX, currentY, widths[colIndex], rowHeight).fillAndStroke(fillColor, '#CCCCCC');
            doc.fillColor('#000000').text(cell, currentX + 5, currentY + 8, { 
              width: widths[colIndex] - 10, 
              align: colIndex === 0 ? 'left' : 'center' 
            });
            currentX += widths[colIndex];
          });
          currentY += rowHeight;
        });

        doc.y = currentY + 10;
      };

      // Cover Page
      doc.fontSize(28).fillColor('#0079F2').text('RFT EVALUATION REPORT', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(18).fillColor('#333333').text(project.name, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(12).fillColor('#666666').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.fontSize(10).text(`Project ID: ${project.id}`, { align: 'center' });
      doc.moveDown(1);
      doc.text(`${enrichedEvaluations.length} Vendors Evaluated`, { align: 'center' });
      
      doc.addPage();

      // 1. EXECUTIVE SUMMARY
      addSection('1. EXECUTIVE SUMMARY');
      doc.text(`This report presents the evaluation results for ${enrichedEvaluations.length} vendor responses to the ${project.name} RFT.`);
      doc.moveDown(0.5);
      
      if (enrichedEvaluations.length > 0) {
        const winner = enrichedEvaluations[0];
        doc.text(`Recommended Vendor: ${winner.vendorName}`, { continued: false });
        doc.text(`Overall Score: ${winner.overallScore}%`);
        doc.text(`Status: ${winner.status.toUpperCase()}`);
        doc.moveDown(0.5);
        doc.text('Key Highlights:');
        doc.list([
          `Technical Fit: ${winner.technicalFit}%`,
          `Compliance: ${winner.compliance}%`,
          `Delivery Risk: ${winner.deliveryRisk}%`,
          `Cost: ${winner.cost}`
        ]);
      }

      // 2. BACKGROUND & CONTEXT
      addSection('2. BACKGROUND & CONTEXT');
      doc.text(`RFT Reference: ${project.id}`);
      doc.text(`Project Name: ${project.name}`);
      doc.text(`Description: ${project.description || 'N/A'}`);
      doc.text(`Evaluation Date: ${new Date().toLocaleDateString()}`);

      // 3. EVALUATION GOVERNANCE
      addSection('3. EVALUATION GOVERNANCE');
      doc.text('Evaluation Committee: AI-Powered Multi-Agent System');
      doc.moveDown(0.5);
      doc.text('Evaluation Methodology:');
      doc.list([
        'Technical Fit Assessment (40%)',
        'Delivery & PMO Risk Analysis (20%)',
        'Commercial Evaluation (25%)',
        'Compliance & Security Review (15%)'
      ]);
      doc.moveDown(0.5);
      doc.text('Six specialized AI agents evaluated each vendor across their domain of expertise:');
      doc.list([
        'Delivery Agent: Timeline, dependencies, resourcing',
        'Product Agent: Feature coverage, usability',
        'Architecture Agent: Scalability, integration patterns',
        'Engineering Agent: Technical implementation quality',
        'Procurement Agent: Commercial terms, licensing',
        'Cybersecurity Agent: Security controls, compliance'
      ]);

      doc.addPage();

      // 4. VENDOR OVERVIEW
      addSection('4. VENDOR OVERVIEW');
      const vendorRows = enrichedEvaluations.map(v => [
        v.vendorName,
        `${v.overallScore}%`,
        v.status.replace('-', ' ').toUpperCase(),
        v.cost
      ]);
      addTable(
        ['Vendor Name', 'Overall Score', 'Status', 'Estimated Cost'],
        vendorRows,
        [200, 100, 120, 75]
      );

      // 5. COMPLIANCE SCREENING
      addSection('5. COMPLIANCE SCREENING');
      const complianceRows = enrichedEvaluations.map(v => [
        v.vendorName,
        v.compliance >= 80 ? '✓' : v.compliance >= 60 ? '⚠' : '✗',
        v.compliance >= 70 ? '✓' : '⚠',
        v.compliance >= 75 ? '✓' : '⚠',
        `${v.compliance}%`
      ]);
      addTable(
        ['Vendor', 'Documents', 'Qualifications', 'Legal', 'Compliance Score'],
        complianceRows,
        [150, 80, 100, 80, 85]
      );

      doc.addPage();

      // 6. TECHNICAL EVALUATION
      addSection('6. TECHNICAL EVALUATION');
      doc.text('Detailed technical assessment across functional and non-functional requirements.');
      doc.moveDown(0.5);
      
      const techRows = enrichedEvaluations.map(v => [
        v.vendorName,
        `${v.technicalFit}%`,
        `${v.detailedScores?.integration || v.technicalFit}/100`,
        `${v.detailedScores?.scalability || v.technicalFit}/100`,
        `${v.detailedScores?.support || v.technicalFit}/100`
      ]);
      addTable(
        ['Vendor', 'Technical Fit', 'Integration', 'Scalability', 'Support'],
        techRows,
        [150, 90, 85, 85, 85]
      );

      // 7. NON-FUNCTIONAL & CYBERSECURITY
      addSection('7. NON-FUNCTIONAL & CYBERSECURITY EVALUATION');
      const nfrRows = enrichedEvaluations.map(v => [
        v.vendorName,
        `${v.compliance}%`,
        v.compliance >= 80 ? 'Strong' : v.compliance >= 60 ? 'Adequate' : 'Weak',
        v.compliance >= 75 ? 'ISO 27001' : 'Partial'
      ]);
      addTable(
        ['Vendor', 'Security Score', 'Data Protection', 'Certifications'],
        nfrRows,
        [150, 115, 115, 115]
      );

      doc.addPage();

      // 8. COMMERCIAL EVALUATION
      addSection('8. COMMERCIAL EVALUATION');
      const commercialRows = enrichedEvaluations.map(v => [
        v.vendorName,
        v.cost,
        v.overallScore >= 80 ? 'Flexible' : 'Standard',
        v.overallScore >= 75 ? 'Good' : 'Fair'
      ]);
      addTable(
        ['Vendor', 'Total Cost', 'Licensing', 'Payment Terms'],
        commercialRows,
        [150, 115, 115, 115]
      );

      // 9. DELIVERY & IMPLEMENTATION
      addSection('9. DELIVERY & IMPLEMENTATION EVALUATION');
      const deliveryRows = enrichedEvaluations.map(v => [
        v.vendorName,
        `${100 - v.deliveryRisk}%`,
        v.deliveryRisk < 30 ? 'Low' : v.deliveryRisk < 60 ? 'Medium' : 'High',
        v.deliveryRisk < 40 ? 'Agile' : 'Hybrid'
      ]);
      addTable(
        ['Vendor', 'Delivery Confidence', 'Risk Level', 'Methodology'],
        deliveryRows,
        [150, 115, 115, 115]
      );

      doc.addPage();

      // 10. OVERALL SCORING SUMMARY
      addSection('10. OVERALL SCORING SUMMARY');
      const summaryRows = enrichedEvaluations.map((v, idx) => [
        v.vendorName,
        `${v.technicalFit}%`,
        `${v.compliance}%`,
        `${100 - v.deliveryRisk}%`,
        `${v.overallScore}%`,
        idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`
      ]);
      addTable(
        ['Vendor', 'Technical', 'Compliance', 'Delivery', 'Overall', 'Rank'],
        summaryRows,
        [130, 70, 80, 70, 75, 70]
      );

      // 11. RISK & MITIGATION
      addSection('11. RISK & MITIGATION ASSESSMENT');
      enrichedEvaluations.forEach(vendor => {
        doc.fontSize(11).fillColor('#0079F2').text(`${vendor.vendorName}:`, { underline: true });
        doc.fontSize(10).fillColor('#000000');
        
        const riskLevel = vendor.deliveryRisk < 30 ? 'LOW' : vendor.deliveryRisk < 60 ? 'MEDIUM' : 'HIGH';
        const riskColor = vendor.deliveryRisk < 30 ? '#28A745' : vendor.deliveryRisk < 60 ? '#FFC107' : '#DC3545';
        
        doc.fillColor(riskColor).text(`Risk Level: ${riskLevel}`, { continued: false });
        doc.fillColor('#000000');
        
        if (vendor.deliveryRisk >= 60) {
          doc.text('Mitigation: Enhanced governance, phased delivery, dedicated PMO oversight');
        } else if (vendor.deliveryRisk >= 30) {
          doc.text('Mitigation: Regular milestone reviews, escalation protocols');
        } else {
          doc.text('Mitigation: Standard project governance framework');
        }
        doc.moveDown(0.5);
      });

      doc.addPage();

      // 12. RECOMMENDATION
      addSection('12. RECOMMENDATION');
      if (enrichedEvaluations.length > 0) {
        const recommended = enrichedEvaluations[0];
        doc.fontSize(12).fillColor('#0079F2').text(`Recommended Vendor: ${recommended.vendorName}`, { underline: true });
        doc.fontSize(10).fillColor('#000000').moveDown(0.5);
        
        doc.text('Justification:');
        doc.list([
          `Highest overall score: ${recommended.overallScore}%`,
          `Strong technical fit: ${recommended.technicalFit}%`,
          `Excellent compliance: ${recommended.compliance}%`,
          `Manageable delivery risk: ${recommended.deliveryRisk}%`,
          `Competitive pricing: ${recommended.cost}`
        ]);
        
        doc.moveDown(0.5);
        if (recommended.aiRationale) {
          doc.text('AI-Generated Rationale:', { underline: true });
          doc.text(recommended.aiRationale);
        }
      }

      // 13. CONCLUSION & APPROVALS
      addSection('13. CONCLUSION & APPROVALS');
      doc.text(`The evaluation committee has completed a comprehensive assessment of ${enrichedEvaluations.length} vendor responses.`);
      doc.moveDown(0.5);
      doc.text(`Based on technical merit, commercial viability, compliance adherence, and delivery confidence, this report recommends proceeding with ${enrichedEvaluations[0]?.vendorName || 'the top-ranked vendor'} for contract negotiations.`);
      doc.moveDown(2);
      
      doc.text('Approval Signatures:');
      doc.moveDown(1);
      ['Evaluation Committee Chair', 'Procurement Lead', 'Technical Director', 'Finance Approval'].forEach(role => {
        doc.text(`${role}: ___________________________  Date: ___________`);
        doc.moveDown(0.5);
      });

      // Footer on each page
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#666666');
        doc.text(
          `Page ${i + 1} of ${range.count} | ${project.name} | Confidential`,
          50,
          doc.page.height - 30,
          { align: 'center' }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
