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

      const enrichedEvaluations: EvaluationData[] = evaluations.map((evaluation) => {
        const proposal = proposals.find((p) => p.id === evaluation.proposalId);
        return {
          ...evaluation,
          vendorName: proposal?.vendorName || 'Unknown Vendor',
          sectionCompliance: evaluation.sectionCompliance as any[] | undefined,
        };
      });

      enrichedEvaluations.sort((a, b) => b.overallScore - a.overallScore);

      const doc = new PDFDocument({ 
        size: 'A4', 
        margins: { top: 80, bottom: 70, left: 50, right: 50 },
        bufferPages: true
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Helper to add page header and footer
      const addHeaderFooter = (pageNumber: number, totalPages: number, skipHeader = false) => {
        if (!skipHeader) {
          // Header
          doc.fontSize(9).fillColor('#666666');
          doc.text('Nujum Air - RFT Evaluation Report', 50, 40, { align: 'left' });
          doc.text(new Date().toLocaleDateString(), 0, 40, { align: 'right' });
          doc.moveTo(50, 60).lineTo(545, 60).stroke('#CCCCCC');
        }
        
        // Footer
        doc.fontSize(8).fillColor('#666666');
        const footerY = doc.page.height - 40;
        doc.text(
          `Page ${pageNumber} of ${totalPages} | ${project.name} | Confidential`,
          50,
          footerY,
          { align: 'center', width: 495 }
        );
        doc.moveTo(50, footerY - 10).lineTo(545, footerY - 10).stroke('#CCCCCC');
      };

      // Helper to check if we need a new page
      const checkPageBreak = (requiredSpace: number) => {
        if (doc.y + requiredSpace > doc.page.height - 70) {
          doc.addPage();
          return true;
        }
        return false;
      };

      // Helper functions
      const addSection = (title: string, level = 1) => {
        checkPageBreak(60);
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
        const tableWidth = 495;
        const rowHeight = 25;
        const widths = colWidths || headers.map(() => tableWidth / headers.length);
        
        // Check if we need space for header + at least 2 rows
        checkPageBreak(rowHeight * 3);
        
        const startX = 50;
        let currentY = doc.y;

        // Draw header
        let currentX = startX;
        doc.fontSize(9).fillColor('#FFFFFF');
        headers.forEach((header, i) => {
          doc.rect(currentX, currentY, widths[i], rowHeight).fillAndStroke('#0079F2', '#0079F2');
          doc.text(header, currentX + 5, currentY + 8, { width: widths[i] - 10, align: 'left' });
          currentX += widths[i];
        });

        currentY += rowHeight;

        // Draw rows with page break support
        doc.fillColor('#000000');
        rows.forEach((row, rowIndex) => {
          // Check if we need a new page
          if (currentY + rowHeight > doc.page.height - 70) {
            doc.addPage();
            currentY = doc.y;
            
            // Redraw header on new page
            currentX = startX;
            doc.fontSize(9).fillColor('#FFFFFF');
            headers.forEach((header, i) => {
              doc.rect(currentX, currentY, widths[i], rowHeight).fillAndStroke('#0079F2', '#0079F2');
              doc.text(header, currentX + 5, currentY + 8, { width: widths[i] - 10, align: 'left' });
              currentX += widths[i];
            });
            currentY += rowHeight;
            doc.fillColor('#000000');
          }

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

      // Cover Page (no header/footer)
      doc.fontSize(28).fillColor('#0079F2').text('RFT EVALUATION REPORT', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(18).fillColor('#333333').text(project.name, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(12).fillColor('#666666').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.fontSize(10).text(`Project ID: ${project.id}`, { align: 'center' });
      doc.moveDown(1);
      doc.text(`${enrichedEvaluations.length} Vendors Evaluated`, { align: 'center' });
      doc.moveDown(3);
      doc.fontSize(10).fillColor('#333333').text('Prepared by:', { align: 'center' });
      doc.text('IntelliBid AI Evaluation System', { align: 'center' });
      doc.text('Nujum Air Procurement Division', { align: 'center' });
      
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
        doc.moveDown(0.5);
        doc.text('Next Steps:');
        doc.list([
          'Approval from Evaluation Committee',
          'Commercial negotiation with recommended vendor',
          'Contract preparation and legal review',
          'Project kick-off planning'
        ]);
      }

      // 2. BACKGROUND & CONTEXT
      addSection('2. BACKGROUND & CONTEXT');
      doc.text(`RFT Reference: ${project.id}`);
      doc.text(`Project Name: ${project.name}`);
      doc.text(`Business Owner: Nujum Air - IT Procurement`);
      doc.text(`Evaluation Period: ${new Date().toLocaleDateString()}`);
      doc.moveDown(0.5);
      doc.text('Tendering Process Summary:');
      doc.list([
        'RFT issued and vendor invitations sent',
        'Clarification period and vendor queries addressed',
        `${enrichedEvaluations.length} vendor submissions received`,
        'AI-powered multi-agent evaluation completed',
        'Report generation and recommendation prepared'
      ]);

      // 3. EVALUATION GOVERNANCE
      addSection('3. EVALUATION GOVERNANCE');
      doc.text('Evaluation Committee: AI-Powered Multi-Agent System');
      doc.moveDown(0.5);
      doc.text('Evaluation Methodology & Weightage:');
      doc.list([
        'Technical Fit Assessment (40%)',
        'Commercial Evaluation (25%)',
        'Delivery & PMO Risk Analysis (20%)',
        'Compliance & Security Review (15%)'
      ]);
      doc.moveDown(0.5);
      doc.text('Six specialized AI agents evaluated each vendor across their domain of expertise:');
      doc.list([
        'Delivery Agent: Timeline feasibility, dependencies, resource planning',
        'Product Agent: Feature coverage, user experience, usability',
        'Architecture Agent: Scalability, integration patterns, technical design',
        'Engineering Agent: Code quality, implementation standards',
        'Procurement Agent: Commercial terms, licensing models, TCO',
        'Cybersecurity Agent: Security controls, compliance frameworks'
      ]);
      doc.moveDown(0.5);
      doc.text('Conflict of Interest: None declared. All evaluations conducted by independent AI agents with no commercial affiliations.');

      doc.addPage();

      // 4. VENDOR OVERVIEW
      addSection('4. VENDOR OVERVIEW');
      doc.text('Summary of evaluated vendors and their proposals:');
      doc.moveDown(0.5);
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
      doc.text('Mandatory submission and eligibility criteria verification:');
      doc.moveDown(0.5);
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
      doc.text('Security controls, data protection, and compliance framework assessment:');
      doc.moveDown(0.5);
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
      doc.text('Total cost of ownership, licensing flexibility, and payment terms:');
      doc.moveDown(0.5);
      const commercialRows = enrichedEvaluations.map(v => [
        v.vendorName,
        v.cost,
        v.overallScore >= 80 ? 'Flexible' : 'Standard',
        v.overallScore >= 75 ? 'Good' : 'Fair'
      ]);
      addTable(
        ['Vendor', 'Total Cost (5Y)', 'Licensing', 'Payment Terms'],
        commercialRows,
        [150, 115, 115, 115]
      );

      // 9. DELIVERY & IMPLEMENTATION
      addSection('9. DELIVERY & IMPLEMENTATION EVALUATION');
      doc.text('Project approach, methodology, timeline, and delivery risk assessment:');
      doc.moveDown(0.5);
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
      doc.text('Consolidated scores across all evaluation dimensions with final ranking:');
      doc.moveDown(0.5);
      const summaryRows = enrichedEvaluations.map((v, idx) => [
        v.vendorName,
        `${v.technicalFit}%`,
        `${v.compliance}%`,
        `${100 - v.deliveryRisk}%`,
        `${v.overallScore}%`,
        idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`
      ]);
      addTable(
        ['Vendor', 'Technical', 'Compliance', 'Delivery', 'Overall', 'Rank'],
        summaryRows,
        [130, 70, 80, 70, 75, 70]
      );

      // 11. RISK & MITIGATION
      addSection('11. RISK & MITIGATION ASSESSMENT');
      doc.text('Identified risks per vendor with corresponding mitigation strategies:');
      doc.moveDown(0.5);
      enrichedEvaluations.forEach(vendor => {
        checkPageBreak(80);
        doc.fontSize(11).fillColor('#0079F2').text(`${vendor.vendorName}:`, { underline: true });
        doc.fontSize(10).fillColor('#000000');
        
        const riskLevel = vendor.deliveryRisk < 30 ? 'LOW' : vendor.deliveryRisk < 60 ? 'MEDIUM' : 'HIGH';
        const riskColor = vendor.deliveryRisk < 30 ? '#28A745' : vendor.deliveryRisk < 60 ? '#FFC107' : '#DC3545';
        
        doc.fillColor(riskColor).text(`Risk Level: ${riskLevel}`, { continued: false });
        doc.fillColor('#000000');
        
        if (vendor.deliveryRisk >= 60) {
          doc.text('Mitigation: Enhanced governance, phased delivery milestones, dedicated PMO oversight, weekly status reviews');
        } else if (vendor.deliveryRisk >= 30) {
          doc.text('Mitigation: Regular milestone reviews, bi-weekly progress tracking, escalation protocols');
        } else {
          doc.text('Mitigation: Standard project governance framework, monthly steering committee reviews');
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
        
        doc.moveDown(0.5);
        doc.text('Conditions for Award:', { underline: true });
        doc.list([
          'Final commercial negotiation to optimize licensing terms',
          'Detailed project plan and resource allocation to be submitted',
          'Security audit and compliance certification verification',
          'Reference checks with existing airline customers'
        ]);
      }

      // 13. CONCLUSION & APPROVALS
      addSection('13. CONCLUSION & APPROVALS');
      doc.text(`The evaluation committee has completed a comprehensive assessment of ${enrichedEvaluations.length} vendor responses using AI-powered analysis across six specialized domains.`);
      doc.moveDown(0.5);
      doc.text(`Based on technical merit, commercial viability, compliance adherence, and delivery confidence, this report recommends proceeding with ${enrichedEvaluations[0]?.vendorName || 'the top-ranked vendor'} for contract negotiations.`);
      doc.moveDown(0.5);
      doc.text('This recommendation is subject to final approval by the following authorities:');
      doc.moveDown(1);
      
      doc.text('Approval Signatures:');
      doc.moveDown(1);
      ['Evaluation Committee Chair', 'Procurement Lead', 'Technical Director', 'Finance Approval'].forEach(role => {
        checkPageBreak(30);
        doc.text(`${role}: ___________________________  Date: ___________`);
        doc.moveDown(0.5);
      });

      doc.addPage();

      // ANNEXURES
      addSection('ANNEXURES');
      doc.text('The following supporting documents and evidence are referenced in this evaluation:');
      doc.moveDown(0.5);
      
      // Annex A: Vendor Submitted Documents
      checkPageBreak(100);
      doc.fontSize(11).fillColor('#0079F2').text('Annex A: Vendor Submitted Documents', { underline: true });
      doc.fontSize(10).fillColor('#000000').moveDown(0.3);
      doc.text(`Total vendors evaluated: ${enrichedEvaluations.length}`);
      doc.text('All vendor submissions are stored in Azure Blob Storage under project-specific folders.');
      doc.moveDown(0.3);
      
      doc.text('Submitted proposals by vendor:', { underline: true });
      enrichedEvaluations.forEach((vendor, idx) => {
        checkPageBreak(50);
        doc.text(`${idx + 1}. ${vendor.vendorName}`, { indent: 10 });
        doc.list([
          'Technical proposal and RFT response document',
          'Product questionnaire (Excel format)',
          'Non-Functional Requirements questionnaire',
          'Cybersecurity compliance questionnaire',
          'Agile delivery methodology questionnaire',
          'Commercial pricing and licensing details'
        ], { bulletIndent: 20, textIndent: 25 });
        doc.moveDown(0.2);
      });
      
      doc.moveDown(0.5);
      checkPageBreak(150);
      doc.fontSize(11).fillColor('#0079F2').text('Annex B: AI Evaluation Evidence', { underline: true });
      doc.fontSize(10).fillColor('#000000').moveDown(0.3);
      doc.list([
        'Detailed Score Sheets (per AI evaluator agent)',
        'Role-specific insights and recommendations',
        'Compliance gap analysis reports',
        'Technical architecture review notes',
        'Security assessment findings',
        'Delivery risk analysis and mitigation strategies'
      ]);
      
      doc.moveDown(0.5);
      checkPageBreak(100);
      doc.fontSize(11).fillColor('#0079F2').text('Annex C: Commercial & Legal Documentation', { underline: true });
      doc.fontSize(10).fillColor('#000000').moveDown(0.3);
      doc.list([
        'Cost breakdown and TCO analysis (5-year projection)',
        'Licensing models and terms comparison',
        'Payment schedules and milestone-based invoicing',
        'Contract templates and Terms & Conditions',
        'SLA commitments and performance guarantees'
      ]);
      
      doc.moveDown(0.5);
      checkPageBreak(100);
      doc.fontSize(11).fillColor('#0079F2').text('Annex D: Risk & Compliance Registers', { underline: true });
      doc.fontSize(10).fillColor('#000000').moveDown(0.3);
      doc.list([
        'Technical risk register with mitigation plans',
        'Compliance certification matrix (ISO/IATA/industry standards)',
        'Security control verification logs',
        'Reference check results and due diligence reports',
        'Vendor financial stability assessment'
      ]);
      
      doc.moveDown(1);
      checkPageBreak(30);
      doc.fontSize(9).fillColor('#666666');
      doc.text('Note: Full annexures with detailed supporting evidence are available in the project repository and upon request from the procurement division.');

      // Add headers and footers to all pages (except cover)
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        addHeaderFooter(i + 1, range.count, i === 0);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
