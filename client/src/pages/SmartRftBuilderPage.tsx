import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Wand2, CheckCircle2, Loader2, Download, Lightbulb, Edit, FileDown, FileCheck2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Step = 1 | 2 | 3 | 4;
type BusinessCaseMethod = "generate" | "upload";
type GenerationMode = "ai_generation" | "template_merge" | "agent_driven";
type RftGenerationMode = "ai_driven" | "agent_driven";

export default function SmartRftBuilderPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [businessCaseMethod, setBusinessCaseMethod] = useState<BusinessCaseMethod>("generate");
  const [rftGenerationMode, setRftGenerationMode] = useState<RftGenerationMode>("ai_driven");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [businessCaseName, setBusinessCaseName] = useState("");
  const [businessCaseDescription, setBusinessCaseDescription] = useState("");
  const [selectedPortfolio, setSelectedPortfolio] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [generationMode, setGenerationMode] = useState<GenerationMode>("ai_generation");
  const [businessCaseId, setBusinessCaseId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [generatedDraftId, setGeneratedDraftId] = useState("");
  const [generatedRftId, setGeneratedRftId] = useState("");
  const [generatedRft, setGeneratedRft] = useState<any>(null);
  const [isSeedingTemplates, setIsSeedingTemplates] = useState(false);
  const hasSeededTemplatesRef = useRef(false);
  
  // Fields for AI generation
  const [projectObjective, setProjectObjective] = useState("");
  const [projectScope, setProjectScope] = useState("");
  const [timeline, setTimeline] = useState("");
  const [budget, setBudget] = useState("");
  const [functionalRequirements, setFunctionalRequirements] = useState("");
  const [nonFunctionalRequirements, setNonFunctionalRequirements] = useState("");
  const [keyRequirements, setKeyRequirements] = useState(""); // Deprecated, kept for backward compatibility
  const [successCriteria, setSuccessCriteria] = useState("");
  
  // Agent generation progress (used for showing real-time agent activity)
  const [agentGenerationProgress, setAgentGenerationProgress] = useState<string[]>([]);
  
  // RFT Document Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedSections, setEditedSections] = useState<any[]>([]);
  
  // Validate business case exists when on Step 2 or 3
  useEffect(() => {
    if ((currentStep === 2 || currentStep === 3) && !businessCaseId) {
      console.warn("No business case ID found, redirecting to Step 1");
      setCurrentStep(1);
      toast({
        variant: "destructive",
        title: "Missing Business Case",
        description: "Please create or upload a business case first.",
      });
    }
  }, [currentStep, businessCaseId, toast]);

  // Fetch portfolios
  const { data: portfolios = [] } = useQuery<any[]>({
    queryKey: ["/api/portfolios"],
  });

  // Fetch active RFT templates (AI generation)
  const { data: templates = [], isLoading: templatesLoading } = useQuery<any[]>({
    queryKey: ["/api/rft-templates/active"],
  });

  // Fetch organization templates (template merge)
  const { data: orgTemplates = [], isLoading: orgTemplatesLoading } = useQuery<any[]>({
    queryKey: ["/api/templates"],
  });

  // Auto-seed templates if empty
  useEffect(() => {
    const seedTemplates = async () => {
      if (templates && templates.length === 0 && !hasSeededTemplatesRef.current && !isSeedingTemplates) {
        hasSeededTemplatesRef.current = true;
        setIsSeedingTemplates(true);
        try {
          await apiRequest("POST", "/api/seed-rft-templates");
          await queryClient.refetchQueries({ queryKey: ["/api/rft-templates/active"] });
          toast({
            title: "Templates Loaded",
            description: "RFT templates are now available for selection.",
          });
        } catch (error) {
          console.error("Failed to seed RFT templates:", error);
          hasSeededTemplatesRef.current = false;
        } finally {
          setIsSeedingTemplates(false);
        }
      }
    };
    seedTemplates();
  }, [templates, isSeedingTemplates, toast]);

  // Generate business case with AI
  const generateBusinessCaseMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/business-cases/generate", {
        portfolioId: selectedPortfolio,
        name: businessCaseName,
        description: businessCaseDescription,
        projectObjective,
        projectScope,
        timeline,
        budget,
        functionalRequirements,
        nonFunctionalRequirements,
        keyRequirements, // Deprecated, kept for backward compatibility
        successCriteria,
      });
    },
    onSuccess: (data: any) => {
      setBusinessCaseId(data.id);
      toast({
        title: "Business Case Generated",
        description: "AI has generated your lean business case document.",
      });
      setCurrentStep(2);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Failed to generate business case. Please try again.",
      });
    },
  });

  // Upload business case
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/business-cases/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: (data) => {
      setBusinessCaseId(data.id);
      toast({
        title: "Business Case Uploaded",
        description: "Successfully uploaded your business case document.",
      });
      setCurrentStep(2);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload business case. Please try again.",
      });
    },
  });

  // Create project
  const createProjectMutation = useMutation({
    mutationFn: async () => {
      console.log("Creating project with:", { portfolioId: selectedPortfolio, name: businessCaseName, businessCaseId });
      return apiRequest("POST", "/api/projects", {
        portfolioId: selectedPortfolio,
        name: businessCaseName,
        status: "draft",
        businessCaseId,
      });
    },
    onSuccess: (data: any) => {
      console.log("Project created successfully:", data);
      if (!data || !data.id) {
        console.error("Invalid project data received:", data);
        toast({
          variant: "destructive",
          title: "Project Creation Error",
          description: "Project was created but invalid data was returned.",
        });
        return;
      }
      setProjectId(data.id);
      toast({
        title: "Project Created",
        description: "Project created successfully. Ready to generate RFT.",
      });
      setCurrentStep(3);
    },
    onError: (error: any) => {
      console.error("Error creating project:", error);
      toast({
        variant: "destructive",
        title: "Project Creation Failed",
        description: "Failed to create project. Please try again.",
      });
    },
  });

  // Generate RFT Draft (NEW - replaces old generateRftMutation)
  const generateDraftMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/rft/drafts", {
        businessCaseId,
        projectId,
        templateId: selectedTemplate || undefined,
        generationMode,
      });
    },
    onSuccess: (data: any) => {
      setGeneratedDraftId(data.id);
      
      // Invalidate all RFT-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/rft/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      
      // Show success toast
      toast({
        title: "Draft Created Successfully!",
        description: `Draft ID: ${data.id.slice(0, 8)}... - Redirecting to collaborative review workspace.`,
      });
      
      // Redirect to RFT Draft Review page
      setTimeout(() => {
        setLocation("/rft-draft-review");
      }, 500); // Small delay to allow toast to display
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Draft Creation Failed",
        description: error.message || "Failed to create RFT draft. Please try again.",
      });
    },
  });

  // Publish RFT
  const publishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/generated-rfts/${generatedRftId}/publish`, {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "RFT Published!",
        description: `Created ${data.requirementsCreated} requirements. Ready for vendor submissions.`,
      });
      
      // Invalidate all RFT-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
    },
  });

  // Generate vendor responses (for quick testing)
  const generateVendorResponsesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/mock-data/generate-responses", {
        rftId: generatedRftId,
      });
    },
    onSuccess: async (data: any) => {
      toast({
        title: "Vendor Responses Generated!",
        description: `Generated responses for ${data.vendorsCreated || 3} vendors. Downloading ZIP file...`,
      });
      
      // Automatically download vendor responses as ZIP
      try {
        const response = await fetch(`/api/mock-data/download-responses/${generatedRftId}`);
        if (!response.ok) {
          throw new Error("Failed to download vendor responses");
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Extract filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : `VendorResponses_${new Date().toISOString().split('T')[0]}.zip`;
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Download Complete!",
          description: `Vendor responses downloaded as ${filename}`,
        });
      } catch (error) {
        console.error("Download error:", error);
        toast({
          variant: "destructive",
          title: "Download Failed",
          description: "Vendor responses were generated but download failed. Please try the Download All button.",
        });
      }
      
      // Invalidate all RFT-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Failed to generate vendor responses. Please try again.",
      });
    },
  });

  // Update RFT Document
  const updateRftMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/generated-rfts/${generatedRftId}`, {
        sections: { sections: editedSections },
      });
    },
    onSuccess: (data: any) => {
      setGeneratedRft(data);
      setIsEditDialogOpen(false);
      toast({
        title: "RFT Updated!",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to save changes. Please try again.",
      });
    },
  });

  // Agent-Driven RFT Generation (6 specialized agents)
  const generateWithAgentsMutation = useMutation({
    mutationFn: async () => {
      // Update progress as agents work
      setAgentGenerationProgress(["Initializing 6 specialized AI agents..."]);
      
      return apiRequest("POST", "/api/rft/generate-with-agents", {
        businessCaseId,
        templateId: selectedTemplate,
        projectId: projectId || undefined,
      });
    },
    onSuccess: (data: any) => {
      setAgentGenerationProgress([]);
      setGeneratedRftId(data.rftId);
      
      toast({
        title: "RFT Generated Successfully!",
        description: `Generated by ${data.sections?.length || 6} specialized agents. Redirecting to review workspace...`,
      });
      
      // Automatically download the generated ZIP file containing all documents
      if (data.uploadedFiles && data.uploadedFiles.length > 0) {
        toast({
          title: "Files Ready!",
          description: `All ${data.filesGenerated || 6} files have been uploaded to Azure Blob Storage.`,
        });
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      
      // Redirect to RFT Draft Review page (same as AI-driven mode)
      setTimeout(() => {
        setLocation("/rft-draft-review");
      }, 1000); // Small delay to allow toasts to display
    },
    onError: (error: any) => {
      setAgentGenerationProgress([]);
      toast({
        variant: "destructive",
        title: "Agent Generation Failed",
        description: error.message || "Failed to generate RFT with agents. Please try again.",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFillSampleData = () => {
    // Array of diverse aviation use case samples
    const sampleUseCases = [
      {
        name: "Crew Management & Rostering System",
        objective: "Modernize crew scheduling and fatigue management with AI-powered optimization that ensures regulatory compliance while maximizing crew satisfaction and operational efficiency.",
        scope: "Cloud-based crew management platform with mobile apps for pilots and cabin crew, automated rostering engine, duty time tracking, fatigue risk management, qualifications management, and integration with existing HR and payroll systems.",
        timeline: "14 months - Requirements & design (3 months), development & testing (8 months), deployment & training (3 months)",
        budget: "$3.8M (Development: $2.2M, Cloud infrastructure: $600K, Integration: $500K, Training & change management: $300K, Contingency: $200K)",
        functionalRequirements: "Automated crew pairing and rostering with AI optimization, real-time duty time monitoring, fatigue risk assessment algorithms, mobile apps with offline sync, qualification expiry alerts, bid management for crew preferences, regulatory compliance (CAA, EASA, FAA), integration with flight operations system",
        nonFunctionalRequirements: "99.5% system availability, <3 second response time for crew lookups, support 2,500+ concurrent users, mobile apps with offline mode, SOC 2 Type II compliance, GDPR compliance for crew data",
        criteria: "95% crew satisfaction score, 30% reduction in rostering time, zero regulatory violations, 99.5% system availability, <3 second response time for crew lookups, full deployment across 2,500+ crew members within 6 months",
        businessCase: "Nujum Air currently manages crew rostering through a legacy desktop application that requires manual intervention for 70% of pairing decisions, leading to inefficiencies and crew dissatisfaction. The system serves multiple stakeholder groups including Crew Scheduling Managers who create monthly rosters, Flight Operations Officers who handle last-minute schedule changes, Pilots and Cabin Crew who bid for preferred routes and track duty hours, HR Managers who manage qualifications and training records, and Regulatory Compliance Officers who ensure adherence to CAA, EASA, and FAA duty time regulations. The proposed solution will interface with existing enterprise systems including the HR & Payroll System (SAP HCM) for crew master data and payroll integration, Flight Operations System (Sabre AirCentre) for flight schedules and aircraft assignments, Training Management System for qualification tracking and expiry monitoring, and Regulatory Reporting Portal for automated submission of crew duty reports. The system will provide multiple channels for stakeholder interaction: a Web Portal for scheduling managers and operations officers to create and modify rosters, Native Mobile Apps (iOS/Android) for crew members to view schedules, submit preferences, and track duty hours with offline sync capability, REST APIs for real-time integration with flight operations and HR systems, and Automated Notifications via email and push notifications for schedule changes and qualification expiries. Critical data assets managed by the system include Crew Master Data (profiles, certifications, home bases, seniority), Duty Time Records for regulatory compliance and fatigue management, Flight Schedules and aircraft rotation plans, Qualification Records with expiry tracking, Crew Preference Bids for monthly schedule allocation, and Regulatory Reports for CAA/EASA/FAA submission. Current challenges include 8-hour average time to create monthly rosters, 30% crew dissatisfaction with current bidding process, 15 regulatory compliance violations annually, and inability to optimize crew utilization across the network. The new AI-powered system will reduce rostering time by 70%, improve crew satisfaction through transparent bidding, ensure zero compliance violations through automated checks, and optimize crew productivity while respecting work-life balance preferences."
      },
      {
        name: "Aircraft Maintenance & MRO Platform",
        objective: "Transform maintenance operations through predictive analytics and digital workflow automation, reducing aircraft downtime while ensuring airworthiness compliance and extending component life.",
        scope: "Comprehensive CAMO/CAME platform with mobile technician apps, predictive maintenance engine, parts inventory management, work order tracking, and integration with OEM maintenance programs and regulatory authorities.",
        timeline: "20 months - Platform development (12 months), data migration & integration (4 months), pilot deployment (2 months), full rollout (2 months)",
        budget: "$5.5M (Platform development: $3.2M, IoT sensors & hardware: $800K, Data migration: $600K, Integration: $500K, Contingency: $400K)",
        functionalRequirements: "Predictive maintenance analytics using machine learning, mobile technician apps with AR-guided repairs, real-time parts tracking with RFID, work order management with digital sign-offs, automated regulatory reporting (EASA Part-M, FAA Part 121), integration with flight data monitoring, document management for AMM/CMM/IPC",
        nonFunctionalRequirements: "99.9% system uptime, <2s response time for work order queries, support 500+ concurrent technician users, offline mode for mobile apps, ISO 27001 compliance, data retention for 10+ years per aviation regulations",
        criteria: "20% reduction in unscheduled maintenance, 15% improvement in aircraft availability, 25% reduction in parts carrying costs, 100% on-time regulatory submissions, 99.9% system uptime, ROI achieved within 18 months",
        businessCase: "Nujum Air operates a mixed fleet of 45 aircraft and currently manages maintenance through disparate paper-based systems and legacy software that lacks predictive capabilities, resulting in reactive maintenance practices and high unscheduled downtime. Key stakeholders include Maintenance Planning Managers who schedule routine and non-routine maintenance activities, Licensed Aircraft Engineers who perform inspections and certify airworthiness, Line Maintenance Technicians who conduct daily checks and minor repairs on the ramp, Component Shop Supervisors who manage engine, avionics, and landing gear overhauls, Quality Assurance Inspectors who verify compliance with airworthiness standards, Parts Inventory Managers who ensure availability of critical spares, and Airworthiness Compliance Officers who maintain CAMO/CAME certifications and submit regulatory reports to EASA and CAA. The platform will integrate with multiple enterprise systems including the ERP System (SAP S/4HANA) for procurement, inventory, and financial accounting, Flight Data Monitoring System (Teledyne ACMS) for real-time aircraft health data and exceedance alerts, OEM Portability Programs (Boeing MyBoeingFleet, Airbus Skywise) for access to service bulletins and maintenance recommendations, Regulatory Authority Portals (EASA, CAA) for electronic submission of continuing airworthiness reports, and Supply Chain Management System for parts procurement and vendor management. The system will deliver services through multiple channels: a Web Application for maintenance planning, work order creation, and management reporting, Native Mobile Apps (iOS/Android) with offline capability for technicians performing inspections on the ramp and in hangars, AR-Enabled Tablets for guided maintenance procedures with 3D overlays, RFID Scanners and IoT Sensors for real-time parts tracking and usage monitoring, and REST APIs for seamless integration with flight operations and engineering systems. Critical data assets include Aircraft Maintenance Records spanning 10 years of maintenance history, Work Orders and defect reports with digital sign-offs, Parts Inventory Database tracking 15,000+ line items across warehouses, Component Life Tracking for time-limited parts and life-limited components, Airworthiness Directives and service bulletins from manufacturers, Predictive Maintenance Models using machine learning on flight data, and Regulatory Compliance Reports for EASA Part-M and FAA Part 121 audits. Current operational challenges include 18% unscheduled maintenance rate causing flight delays and cancellations, average aircraft availability of only 82% below industry benchmark of 90%, parts inventory carrying costs of $12M annually with 25% excess stock, manual regulatory reporting requiring 120 hours monthly, and inability to predict component failures before they cause AOG situations. The new platform will leverage IoT sensors and machine learning to shift from reactive to predictive maintenance, reducing unscheduled maintenance by 40%, improving aircraft availability to 95%, optimizing parts inventory to reduce carrying costs by $3M annually, automating regulatory submissions for 100% on-time compliance, and achieving ROI within 18 months through reduced downtime and operational efficiency."
      },
      {
        name: "Ancillary Revenue Optimization Engine",
        objective: "Maximize ancillary revenue through intelligent seat selection, meal pre-ordering, baggage upsells, and lounge access offerings powered by personalized recommendations and dynamic pricing.",
        scope: "Revenue management platform with web and mobile booking flows, recommendation engine, payment processing, inventory management, and analytics dashboard for revenue tracking across all touchpoints.",
        timeline: "12 months - MVP (5 months), A/B testing & optimization (3 months), full deployment (2 months), post-launch optimization (2 months)",
        budget: "$2.8M (Development: $1.6M, Payment gateway & PCI compliance: $400K, ML models & personalization: $350K, Integration: $300K, Contingency: $150K)",
        functionalRequirements: "Personalized seat recommendations using passenger profiles, dynamic pricing engine for ancillaries, meal pre-ordering with dietary preferences, baggage upsell during booking and check-in, lounge access sales, multi-currency support, integration with PSS and revenue accounting",
        nonFunctionalRequirements: "PCI-DSS Level 1 compliance, <500ms recommendation response time, 99.95% payment processing uptime, support 10K concurrent booking sessions, GDPR compliance, multi-currency transaction support",
        criteria: "$12M incremental ancillary revenue in year 1, 35% conversion rate on seat selection, 28% take-rate on meal pre-orders, 4.5+ customer satisfaction score, <500ms recommendation response time, 99.95% payment processing uptime",
        businessCase: "Nujum Air currently generates only $18 per passenger in ancillary revenue compared to the industry average of $35, representing a significant untapped revenue opportunity of $25M annually across 1.5M passengers. The platform will serve diverse stakeholder groups including Revenue Management Analysts who set dynamic pricing strategies for ancillary products, E-Commerce Managers who optimize conversion rates across digital channels, Passengers who personalize their travel experience through ancillary purchases, Airport Customer Service Agents who assist with last-minute upgrades and ancillary sales at check-in counters, Catering Managers who forecast meal quantities based on pre-order data, and Finance Controllers who track ancillary revenue performance against targets and analyze profitability by route and customer segment. The system will integrate with core airline systems including the Passenger Service System (Amadeus Altea) for booking records, seat maps, and passenger profiles, Revenue Accounting System for ancillary revenue recognition and reporting, Payment Gateway (Stripe/Adyen) for secure multi-currency payment processing with PCI-DSS compliance, Customer Data Platform for unified passenger profiles and preference tracking, Loyalty Program System for earning and redemption of points on ancillary purchases, Catering Management System for meal inventory and forecasting based on pre-orders, and Business Intelligence Platform for revenue analytics and performance dashboards. The platform will deliver ancillary offerings through multiple customer touchpoints: Responsive Web Booking Interface with personalized product recommendations during the booking flow, Native Mobile Apps (iOS/Android) for managing bookings and purchasing ancillaries post-booking, Airport Kiosks for last-minute seat upgrades and baggage additions during self-service check-in, Customer Service Portal for agents to assist with ancillary sales during phone bookings, and REST APIs for integration with third-party booking channels and travel agencies. Critical data assets managed include Passenger Purchase History tracking ancillary buying patterns and preferences, Product Inventory for seats, meals, lounge access, and other ancillaries with real-time availability, Dynamic Pricing Models using machine learning to optimize conversion and revenue, Customer Preference Profiles capturing dietary restrictions, seat preferences, and willingness to pay, Revenue Analytics Data for performance tracking by route, time, and customer segment, and Payment Transaction Records with full PCI-DSS compliant storage and tokenization. Current challenges include low ancillary revenue of only $18 per passenger versus $35 industry benchmark, lack of personalization in ancillary offerings leading to poor conversion rates, manual pricing that doesn't respond to demand or competitive dynamics, fragmented customer experience with inconsistent offerings across web, mobile, and airport channels, and no predictive analytics to forecast demand or optimize inventory. The new AI-powered platform will increase ancillary revenue to $30 per passenger through personalized recommendations and dynamic pricing, achieving $12M incremental revenue in year 1 and $18M by year 3, while improving customer satisfaction through tailored offerings that enhance the travel experience rather than creating friction."
      },
      {
        name: "Cargo Operations & Tracking System",
        objective: "Digitize end-to-end cargo operations with real-time shipment tracking, automated documentation, and capacity optimization to increase cargo revenue and improve customer experience.",
        scope: "Cloud cargo management system with customer portal, mobile apps for warehouse staff, automated AWB generation, capacity planning tools, and integration with customs systems and cargo partners.",
        timeline: "16 months - Core platform (8 months), integrations & customs (4 months), pilot operations (2 months), full rollout (2 months)",
        budget: "$4.1M (Platform development: $2.3M, Hardware & sensors: $700K, Integration: $600K, Regulatory compliance: $300K, Contingency: $200K)",
        functionalRequirements: "Real-time shipment tracking with GPS/RFID, automated air waybill generation, dangerous goods compliance checks, capacity planning and load optimization, customer self-service portal, mobile warehouse management, e-freight/e-AWB support, customs integration (IATA Cargo-XML), temperature monitoring for pharma cargo",
        nonFunctionalRequirements: "99% on-time shipment tracking accuracy, <30 minute turnaround for dangerous goods approval, 99.8% system availability, support 1000+ concurrent shipment updates, IATA compliance, customs data encryption",
        criteria: "25% increase in cargo revenue, 40% reduction in documentation processing time, 99% on-time shipment tracking accuracy, 95% e-freight adoption rate, <30 minute turnaround for dangerous goods approval, zero customs compliance violations",
        businessCase: "Nujum Air Cargo handles 35,000 tons annually but operates with manual paper-based processes and siloed systems that lack real-time visibility, causing delays, documentation errors, and poor customer experience. The system serves multiple stakeholder groups including Cargo Sales Managers who negotiate rates and manage corporate accounts, Warehouse Operations Supervisors who oversee acceptance, storage, and loading of cargo shipments, Dangerous Goods Specialists who verify compliance with IATA DGR regulations for hazmat shipments, Customer Service Representatives who provide shipment status updates and handle queries, Customs Brokers who prepare and submit customs declarations, and Finance Teams who manage cargo billing, revenue recognition, and accounts receivable. The platform will integrate with airline and external systems including the Passenger Service System (Amadeus Altea) for cargo space allocation on passenger flights, Revenue Accounting System for cargo billing and yield management, Customs Systems (Single Window platforms, ASYCUDA) for automated electronic customs clearance using IATA Cargo-XML standards, Partner Airlines Systems for interline cargo bookings and transfers, Dangerous Goods Database (IATA DGR) for automated compliance checking, and Temperature Monitoring Systems for pharmaceutical and perishable cargo requiring cold chain integrity. The solution will provide services through multiple channels: a Customer Self-Service Portal for booking, tracking, and documentation download 24/7, Mobile Apps for warehouse staff to scan shipments, update status, and capture proof of delivery with GPS location, Web Application for cargo operations teams to manage capacity, build up cargo, and handle special cargo requirements, Partner API for freight forwarders and logistics partners to integrate bookings and tracking, and Automated Notifications via email and SMS for milestone updates like booking confirmation, acceptance, departure, arrival, and ready for collection. Critical data assets include Air Waybill Master Data with shipper, consignee, and commodity details, Shipment Tracking Events with GPS coordinates and milestone timestamps for full supply chain visibility, Dangerous Goods Declarations with IATA classification, UNDG numbers, and handling instructions, Capacity Planning Data for belly cargo and freighter aircraft across the network, Customs Documentation including commercial invoices, packing lists, and certificates of origin, Temperature Logs for pharmaceutical shipments requiring 2-8°C cold chain compliance, and Revenue Analytics tracking yield per kilo, load factors, and profitability by route and customer. Current operational challenges include 45-minute average time to process air waybill documentation manually, 20% of shipments delayed due to documentation errors or incomplete customs information, lack of real-time visibility causing 500+ daily customer inquiries for shipment status, 15% dangerous goods rejection rate due to incomplete or incorrect DGR declarations, and inability to optimize cargo load planning leading to 25% unused belly cargo capacity on passenger flights. The new digital platform will automate air waybill generation reducing processing time to under 5 minutes, provide real-time shipment tracking with GPS accuracy within 100 meters, achieve 95% straight-through processing for customs clearance using e-freight XML standards, reduce dangerous goods rejections to under 2% through automated compliance verification, and optimize cargo loading to improve belly cargo utilization to 85%, collectively increasing cargo revenue by $8M annually while enhancing customer satisfaction through transparency and faster turnaround times."
      },
      {
        name: "Digital Passenger Services Hub",
        objective: "Create unified digital platform for all passenger touchpoints from booking to post-flight, delivering seamless omnichannel experience that drives loyalty and reduces operational costs.",
        scope: "Integrated platform with responsive web, native mobile apps (iOS/Android), airport kiosks, chatbot, and backend services covering booking, check-in, boarding, in-flight services, and disruption management.",
        timeline: "18 months - Platform foundation (6 months), passenger services modules (8 months), testing & optimization (2 months), deployment (2 months)",
        budget: "$5.2M (Development: $3.1M, Infrastructure & APIs: $900K, Kiosk hardware: $500K, AI/ML for chatbot: $400K, Contingency: $300K)",
        functionalRequirements: "Responsive web booking with real-time availability, native mobile apps with Apple Wallet/Google Pay integration, self-service check-in kiosks, AI-powered chatbot for customer service, digital boarding passes with offline mode, real-time flight status push notifications, disruption management & rebooking, baggage tracking, in-flight entertainment booking, special assistance requests, multi-language support (10+ languages)",
        nonFunctionalRequirements: "<2 second page load time, 99.99% uptime during peak hours, support 200K concurrent users, mobile apps with offline capabilities, WCAG 2.1 AA accessibility compliance, PCI-DSS for payments, multi-language support for 10+ languages",
        criteria: "70% digital check-in adoption, 4.6+ app store rating, 50% reduction in call center volume, 90% self-service kiosk usage, 35% reduction in passenger processing costs, 200K monthly active app users, <2 second page load time",
        businessCase: "Nujum Air serves 1.5 million passengers annually but has a fragmented digital experience with only 35% digital check-in adoption, leading to airport congestion, long queues, high customer service costs, and passenger dissatisfaction. The unified platform will serve diverse stakeholders including Passengers who seek seamless booking, check-in, and flight management experiences across devices, Digital Product Managers who optimize conversion funnels and customer engagement metrics, Airport Operations Teams who manage passenger flow and reduce congestion at check-in counters, Customer Service Agents who handle complex queries while routine requests are automated through self-service, Accessibility Coordinators who ensure compliance with disability access requirements under WCAG 2.1 AA standards, and Marketing Teams who deliver personalized communications and promotional offers through integrated channels. The system will integrate with core airline and airport systems including the Passenger Service System (Amadeus Altea) for real-time flight availability, seat selection, and booking management, Departure Control System for check-in, boarding pass generation, and baggage tag printing, Payment Gateway (Stripe) for PCI-DSS compliant multi-currency payment processing, Loyalty Program System for tier status display, mileage accrual, and redemption bookings, Airport Baggage Handling System for real-time bag tracking with RFID tags, Flight Information Display System for live flight status updates and gate changes, and CRM System (Salesforce) for unified customer profiles and communication preferences. The platform delivers passenger services through omnichannel touchpoints: Responsive Web Application optimized for desktop and mobile browsers with sub-2 second page load times, Native Mobile Apps (iOS/Android) with offline mode for viewing boarding passes and flight details without connectivity, Apple Wallet and Google Pay integration for seamless boarding pass access, AI-Powered Chatbot available 24/7 in 10 languages for flight status, rebooking, and general inquiries, Self-Service Kiosks at airports for check-in, seat selection, baggage tag printing, and boarding pass issuance, and Push Notifications for proactive alerts on flight delays, gate changes, boarding calls, and baggage carousel information. Critical data assets managed include Passenger Profiles with contact details, travel preferences, special meal requirements, and accessibility needs, Booking Records with PNR, flight itineraries, ancillary purchases, and payment history, Digital Boarding Passes with QR codes compatible with airport scanners and mobile wallets, Flight Status Data updated in real-time from operational systems showing delays, cancellations, and gate assignments, Baggage Tracking Information linked to RFID tags providing location updates throughout the journey, Disruption Management Data for automatic rebooking options and compensation eligibility during irregular operations, and Customer Interaction History tracking all touchpoints including web, app, chatbot, call center, and email for personalized service. Current pain points include only 35% digital check-in adoption forcing most passengers to queue at airport counters, resulting in 45-minute average wait times during peak hours, fragmented mobile app with 3.2 star rating and poor offline functionality, customer service handling 12,000 monthly calls for routine queries that could be self-served, no real-time baggage tracking causing anxiety and 800 monthly lost bag inquiries, inconsistent user experience across booking channels (web, mobile, call center, airport) leading to confusion and errors, and lack of proactive communication during disruptions requiring passengers to seek information rather than receiving push updates. The new digital platform will increase digital check-in adoption to 70% reducing airport counter volume by 50%, improve app store rating to 4.6+ stars through enhanced usability and offline capabilities, reduce call center volume by 50% through AI chatbot handling routine queries 24/7, achieve 90% self-service kiosk adoption at airports for remaining counter transactions, cut passenger processing costs by 35% through automation and self-service, and grow to 200,000 monthly active app users representing 45% of monthly passengers, while delivering a seamless omnichannel experience that enhances satisfaction, loyalty, and Net Promoter Score."
      },
      {
        name: "Network Planning & Revenue Management Suite",
        objective: "Optimize route profitability through advanced analytics, demand forecasting, and dynamic pricing while improving load factors and overall network performance.",
        scope: "Integrated platform with route profitability analysis, demand forecasting models, fare optimization engine, competitive intelligence, and scenario planning tools for network expansion decisions.",
        timeline: "15 months - Analytics foundation (5 months), forecasting models (4 months), pricing optimization (4 months), deployment & training (2 months)",
        budget: "$4.6M (Platform development: $2.7M, Data warehouse & ML infrastructure: $800K, External data feeds: $400K, Training & change management: $400K, Contingency: $300K)",
        functionalRequirements: "Route profitability analysis with contribution margin tracking, machine learning demand forecasting (12-month horizon), dynamic pricing and fare optimization, competitive fare tracking and analysis, capacity allocation by cabin class, overbooking optimization, scenario planning for new routes, integration with PSS and revenue accounting, IATA market data integration",
        nonFunctionalRequirements: "<5 minute pricing decision response time, 90% forecast accuracy (MAPE), 99.7% system availability, support 50+ concurrent pricing analysts, real-time data processing for 200+ routes, SOC 2 compliance",
        criteria: "5% improvement in network RASK, 3-point load factor improvement, 8% reduction in spoilage costs, 90% forecast accuracy (MAPE), revenue optimization deployed on 100% of routes, <5 minute pricing decision response time, ROI within 12 months",
        businessCase: "Nujum Air operates 200+ routes across the Middle East, Europe, and Asia but relies on spreadsheet-based revenue management and manual fare adjustments that cannot respond quickly to competitive dynamics or demand fluctuations, resulting in suboptimal load factors, revenue leakage, and missed network expansion opportunities. The platform will serve key stakeholders including Revenue Management Analysts who set fares and manage inventory across booking classes, Network Planning Managers who evaluate route profitability and recommend schedule changes or new route launches, Pricing Strategists who monitor competitor fares and adjust pricing strategies in real-time, Finance Analysts who forecast revenue and analyze contribution margins by route and aircraft type, Commercial Directors who make strategic decisions on network expansion, frequency changes, and aircraft redeployment, and Executive Leadership who oversee overall network performance and profitability targets measured by RASK (Revenue per Available Seat Kilometer). The suite will integrate with airline and market data systems including the Passenger Service System (Amadeus Altea) for real-time booking data, seat inventory, and passenger mix by fare class, Revenue Accounting System for ticket sales, refunds, and contribution margin analysis, Competitive Pricing Intelligence Platforms (ATPCO, PROS) for real-time competitor fare tracking across markets, IATA Market Data Services for origin-destination traffic statistics and market share analysis, Flight Operations System for schedule data, aircraft rotations, and historical on-time performance, and Business Intelligence Data Warehouse for consolidated reporting across revenue, cost, and operational metrics. The platform will deliver analytics and decision support through multiple channels: a Web-Based Analytics Dashboard for route profitability visualization, demand trends, and KPI monitoring with drill-down capabilities, Pricing Recommendation Engine providing automated fare adjustment suggestions based on competitive position and demand forecasting, Scenario Planning Tools allowing what-if analysis for new route launches, frequency changes, or aircraft swaps, Mobile Apps for revenue managers to monitor performance and approve pricing changes remotely, REST APIs for integration with existing revenue systems and external data providers, and Automated Alerts via email and push notifications for significant demand deviations, competitive fare changes, or inventory imbalances requiring immediate action. Critical data assets include Historical Booking Data spanning 5 years with booking curves, fare classes, and point-of-sale by market, Demand Forecasting Models using machine learning on seasonality, events, holidays, and competitor actions with 12-month horizon, Competitive Fare Matrix tracking real-time pricing across 50+ airlines for overlapping routes, Route Profitability Database with contribution margin, CASK (Cost per Available Seat Kilometer), and break-even load factors, Capacity Allocation Rules by booking class (J, C, Y, M, etc.) optimized for revenue and overbooking limits, Scenario Analysis Data for evaluating network changes including new routes, schedule adjustments, fleet redeployment, and code-share partnerships, and Market Intelligence Reports incorporating macroeconomic indicators, tourism trends, and competitive movements. Current revenue management challenges include manual fare adjustments requiring 4 hours daily per analyst covering only 30% of routes proactively, forecast accuracy of only 75% MAPE (Mean Absolute Percentage Error) leading to inventory imbalances and spoilage, average load factor of 77% below industry benchmark of 82%, inability to respond to competitive fare changes within acceptable time windows (currently 12-24 hours vs. required 2-4 hours), network RASK underperforming regional competitors by 8%, and lack of data-driven tools for evaluating new route opportunities resulting in failed launches that drain profitability. The new AI-powered suite will increase forecast accuracy to 90% MAPE through machine learning incorporating 50+ variables including events, holidays, competitor actions, and macroeconomic factors, improve network load factor from 77% to 80% through optimized overbooking and inventory management, increase network RASK by 5% through dynamic pricing and competitive positioning, reduce spoilage costs by 8% through demand-responsive inventory allocation, enable 100% route coverage with pricing optimization deployed across all 200+ routes, and achieve pricing decision response times under 5 minutes allowing real-time competitive responses, collectively delivering $18M incremental annual revenue and ROI within 12 months while positioning Nujum Air for strategic network growth."
      },
      {
        name: "Flight Operations & Safety Management",
        objective: "Enhance flight safety and operational efficiency through real-time flight monitoring, safety reporting, risk assessment, and compliance management with regulatory authorities.",
        scope: "Safety management system (SMS) with flight data monitoring, incident reporting portal, risk assessment workflows, audit management, and regulatory compliance tracking for IOSA, IS-BAO standards.",
        timeline: "14 months - Core SMS platform (6 months), flight data monitoring (4 months), compliance modules (2 months), training & rollout (2 months)",
        budget: "$3.5M (Development: $2.0M, Flight data hardware: $600K, Integration: $450K, Training & certification: $300K, Contingency: $150K)",
        functionalRequirements: "Automated flight data monitoring (FDM) with threshold exceedance alerts, voluntary safety reporting system, risk assessment matrix and workflows, audit and inspection management, regulatory compliance tracking (IOSA, IS-BAO, FAA/EASA), incident investigation case management, safety performance indicators dashboard, crew fatigue monitoring, integration with QAR/ACARS data",
        nonFunctionalRequirements: "<24 hour turnaround for critical FDM events, 99.9% system availability, IOSA audit compliance, ISO 27001 security compliance, data retention for 7+ years, support 5000+ crew users",
        criteria: "Zero major safety incidents, 100% safety report follow-up within SLA, 40% increase in voluntary safety reports, IOSA compliance maintained, 95% crew participation in safety culture survey, <24 hour turnaround for critical FDM events, full deployment across fleet within 6 months",
        businessCase: "Nujum Air maintains an excellent safety record but currently manages safety through fragmented systems with manual flight data analysis, paper-based incident reporting, and spreadsheet compliance tracking that cannot scale with fleet growth or meet evolving regulatory expectations under EASA and CAA oversight. The comprehensive Safety Management System (SMS) will serve critical stakeholders including Flight Operations Managers who oversee daily operations and ensure adherence to SOPs, Safety Officers who investigate incidents, conduct risk assessments, and manage the voluntary reporting program, Flight Data Analysts who monitor QAR and ACARS data for threshold exceedances and adverse trends, Regulatory Compliance Officers who maintain IOSA registration and manage CAA/EASA audits, Pilots and Cabin Crew who submit safety reports and participate in safety culture initiatives, Maintenance Engineers who investigate technical defects and failure patterns, and Quality Assurance Inspectors who conduct audits, safety surveys, and management reviews. The SMS will integrate with operational and regulatory systems including the Flight Data Monitoring System (Teledyne ACMS) for automated download and analysis of Quick Access Recorder (QAR) data from all flights, ACARS Messaging System for real-time in-flight event notifications such as engine exceedances or fuel imbalances, Crew Management System for fatigue monitoring, duty time analysis, and correlation of crew pairing with safety events, Aircraft Maintenance System for defect tracking and reliability analysis linked to safety occurrences, Training Management System for recurrent training requirements triggered by safety findings, and Regulatory Authority Portals (EASA, CAA) for electronic submission of mandatory safety reports including ASRs (Air Safety Reports) and MORs (Mandatory Occurrence Reports). The platform will provide safety services through multiple channels: a Web Application for safety officers, analysts, and management to investigate events, conduct risk assessments, and generate safety reports, Mobile Apps for crew to submit confidential safety reports using the voluntary reporting system with guaranteed anonymity and non-punitive culture, Flight Data Monitoring Dashboard with automated threshold exceedance detection, trending analysis, and alerts for unstable approaches, hard landings, overspeed events, and other safety parameters, Risk Assessment Portal using a 5x5 severity-likelihood matrix for evaluating hazards and prioritizing mitigations, Audit Management Module for planning, executing, and tracking corrective actions from internal audits and external IOSA inspections, and Automated Notifications via email for critical FDM events requiring immediate investigation within 24-hour SLA. Critical data assets include Flight Data Records from QAR systems capturing 1,000+ parameters per flight for post-flight analysis and trend monitoring, Safety Report Database with confidential voluntary reports, mandatory occurrence reports, and investigation findings, Risk Register tracking identified hazards, assessed risk levels, and mitigation status across operations, maintenance, and ground handling, Incident Investigation Files with root cause analysis, contributing factors, and corrective actions using SHELL model and Swiss Cheese framework, Regulatory Compliance Records for IOSA registration, CAA audit findings, corrective action plans, and closure evidence, Safety Performance Indicators measuring leading indicators (FDM events per 1000 flight hours, voluntary report rate) and lagging indicators (incidents, accidents, regulatory findings), and Audit Documentation for internal safety audits, management reviews, and third-party assessments spanning 7 years per regulatory retention requirements. Current safety management challenges include manual flight data analysis requiring 3 days per event investigation delaying corrective actions, low voluntary reporting rate of only 15 reports per month indicating potential safety culture gaps and underreporting of hazards, reactive risk management focused on incident investigation rather than proactive hazard identification, fragmented systems requiring duplicate data entry and manual consolidation for IOSA audits consuming 200 hours annually, inability to identify adverse trends across fleet operations due to lack of automated analytics and visualization tools, and compliance burden of manual regulatory reporting with 48-hour deadlines that strain resources. The new SMS platform will automate flight data monitoring to achieve <24 hour turnaround for all critical events through real-time threshold exceedance alerts and analyst workflows, increase voluntary safety reports by 40% through mobile app convenience and reinforced non-punitive safety culture, enable proactive risk management through automated hazard identification from FDM trends and predictive analytics on safety indicators, achieve 100% safety report follow-up within SLA through case management workflows and automated reminders, maintain IOSA compliance and pass all audits through centralized documentation and audit trail capabilities, and deploy across entire fleet of 45 aircraft and 5000+ crew members within 6 months, collectively enhancing safety outcomes through data-driven insights while reducing compliance burden by 60% and positioning Nujum Air as a safety leader in the region."
      },
      {
        name: "Ground Services & Turnaround Optimization",
        objective: "Reduce aircraft turnaround time and improve on-time performance through real-time coordination of ground handling, catering, cleaning, fueling, and ramp operations.",
        scope: "Mobile-first platform for ground handlers, dispatchers, and operations with real-time task assignment, progress tracking, delay prediction, and resource optimization across all ground service providers.",
        timeline: "12 months - Platform development (6 months), hardware integration (2 months), pilot airports (2 months), network rollout (2 months)",
        budget: "$2.9M (Development: $1.7M, Mobile devices & wearables: $400K, IoT sensors: $350K, Integration: $300K, Contingency: $150K)",
        functionalRequirements: "Real-time task management for turnaround operations, automated push-back coordination, fueling progress tracking with API integration, catering and cleaning status updates, delay prediction using machine learning, resource allocation optimization, geo-fenced mobile apps for ramp staff, integration with flight operations and aircraft tracking, messaging between ground crews and operations center",
        nonFunctionalRequirements: "<30 second delay alert notification, 99.5% system availability, support 1000+ concurrent ground staff users, mobile offline mode for ramp operations, GPS accuracy within 5 meters, real-time sync <2 seconds",
        criteria: "5 minute average turnaround time reduction, 12-point on-time performance improvement, 30% reduction in ground delay minutes, 99% task completion tracking accuracy, <30 second delay alert notification, deployment at 15+ airports, positive ROI within 9 months",
        businessCase: "Nujum Air operates 280 daily flights across 15 airports but experiences average turnaround times of 45 minutes for narrow-body aircraft, 12 points below industry on-time performance at 76%, and annual ground delay costs of $8M due to manual coordination across fragmented ground service providers for fueling, catering, cleaning, ramp handling, and push-back operations. The mobile-first platform will serve diverse operational stakeholders including Ground Operations Coordinators who oversee turnaround sequencing and resolve delays across multiple service providers, Ramp Supervisors who assign tasks to baggage handlers, aircraft marshallers, and tow tractor operators, Catering Supervisors who coordinate meal cart loading and galley servicing aligned with departure schedules, Fueling Coordinators who monitor fuel delivery progress and ensure safe fueling operations with deadman switch compliance, Cleaning Crews who deep clean cabins during short turnarounds under tight time constraints, Push-Back Coordinators who liaise with ATC and cockpit crew for taxi clearances, and Airport Operations Managers who monitor network-wide performance and resource utilization across terminals. The platform will integrate with airline and airport operational systems including the Flight Operations System (Sabre AirCentre) for real-time flight schedules, arrival/departure times, and aircraft registrations, Aircraft Tracking System (FlightAware, ADS-B) for accurate on-block and off-block time recording, Fuel Management System for fuel order generation, delivery tracking, and uplift confirmation, Departure Control System for passenger boarding status, final load sheet, and pushback release, Ground Service Provider Systems (Swissport, Menzies APIs) for resource allocation, task completion, and billing integration, and Airport Collaborative Decision Making (A-CDM) Platform for slot management and TOBT (Target Off-Block Time) updates. The solution will deliver turnaround coordination through purpose-built channels: Mobile Apps with geo-fencing for ground staff to receive task assignments based on location, update progress in real-time, capture completion photos, and escalate delays instantly, Wearable Devices (smartwatches) for hands-free task notifications and one-tap status updates during fueling, baggage loading, and other ramp operations, Web Dashboard for operations center to monitor all active turnarounds, identify bottlenecks, and reallocate resources dynamically, IoT Sensors on fuel trucks, catering vehicles, and GPU/ASU equipment for automated progress tracking without manual input, Automated Delay Prediction Engine using machine learning on historical patterns, weather, passenger load, and resource availability to forecast late arrivals 15 minutes in advance, and Push Notifications with <30 second delivery for critical alerts such as delayed catering truck, fuel shortage, or pushback tractor unavailability. Critical data assets include Turnaround Task Libraries defining standard sequences for aircraft types (A320, B737, B787) with time allocations for each phase, Real-Time Task Status tracking completion, delays, and handoffs across 15+ concurrent tasks per turnaround, Historical Performance Data measuring actual vs. scheduled turnaround times, delay codes, and root cause analysis for continuous improvement, Resource Allocation Data tracking availability and utilization of ground support equipment (GSE), vehicles, and personnel across shifts, Delay Prediction Models using machine learning on 12 months of historical turnaround data, weather, passenger loads, and disruption patterns, Geofence Boundaries for aircraft parking stands ensuring task assignments route to nearest available staff, and Communication Logs capturing all coordination messages between ramp, operations, catering, fueling, and flight crew for audit trail and dispute resolution. Current ground operations challenges include average narrow-body turnaround time of 45 minutes vs. 35-minute target due to lack of visibility and coordination gaps, on-time performance of only 76% with 30% of delays attributed to ground handling inefficiencies, manual radio-based communication causing task assignment delays averaging 4 minutes per handoff, inability to predict delays in advance requiring reactive firefighting rather than proactive mitigation, fragmented systems across ground service providers preventing end-to-end visibility of turnaround status, and annual ground delay costs of $8M including passenger compensation, crew duty overruns, and aircraft repositioning. The new platform will reduce average turnaround time by 5 minutes to 40 minutes through real-time coordination and automated workflows, improve on-time performance from 76% to 88% (12-point improvement) through predictive delay alerts and resource optimization, reduce ground delay minutes by 30% saving $2.4M annually, achieve 99% task completion tracking accuracy through mobile apps and IoT sensors eliminating manual radio logs, deliver delay alert notifications within 30 seconds enabling proactive interventions, deploy across all 15 airports in the Nujum Air network covering 280 daily flights, and achieve positive ROI within 9 months through delay reduction, operational efficiency, and improved passenger satisfaction measured by Net Promoter Score increases of 8 points."
      }
    ];
    
    // Randomly select a use case
    const randomCase = sampleUseCases[Math.floor(Math.random() * sampleUseCases.length)];
    
    setBusinessCaseName(randomCase.name);
    setBusinessCaseDescription(randomCase.businessCase || "");
    setProjectObjective(randomCase.objective);
    setProjectScope(randomCase.scope);
    setTimeline(randomCase.timeline);
    setBudget(randomCase.budget);
    setFunctionalRequirements(randomCase.functionalRequirements);
    setNonFunctionalRequirements(randomCase.nonFunctionalRequirements);
    setSuccessCriteria(randomCase.criteria);
    
    toast({
      title: "Sample Data Loaded",
      description: `Loaded: ${randomCase.name}`,
    });
  };

  const handleGenerateBusinessCase = () => {
    if (!businessCaseName || !selectedPortfolio || !projectObjective) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in required fields: name, portfolio, and project objective.",
      });
      return;
    }

    generateBusinessCaseMutation.mutate();
  };

  const handleUpload = () => {
    if (!selectedFile || !businessCaseName || !selectedPortfolio) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all required fields.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("document", selectedFile);
    formData.append("portfolioId", selectedPortfolio);
    formData.append("name", businessCaseName);
    if (businessCaseDescription) {
      formData.append("description", businessCaseDescription);
    }

    uploadMutation.mutate(formData);
  };

  const handleSelectTemplate = () => {
    console.log("Select template button clicked", { selectedTemplate, businessCaseId, generationMode });
    
    // Template is required only for template_merge mode
    if (generationMode === "template_merge" && !selectedTemplate) {
      toast({
        variant: "destructive",
        title: "Template Required",
        description: "Please select an organization template for template merge mode.",
      });
      return;
    }
    
    // Business case is required for all modes
    if (!businessCaseId) {
      toast({
        variant: "destructive",
        title: "Missing Business Case",
        description: "Business case ID is missing. Please go back and create/upload a business case.",
      });
      return;
    }
    
    createProjectMutation.mutate();
  };

  const handleOpenEditDialog = () => {
    if (generatedRft?.sections?.sections) {
      setEditedSections([...generatedRft.sections.sections]);
      setIsEditDialogOpen(true);
    }
  };

  const handleSectionChange = (index: number, field: "title" | "content", value: string) => {
    const updated = [...editedSections];
    updated[index] = { ...updated[index], [field]: value };
    setEditedSections(updated);
  };

  const handleSaveEdits = () => {
    updateRftMutation.mutate();
  };

  const handleGenerate = () => {
    console.log("Generate button clicked", { businessCaseId, selectedTemplate, projectId, generationMode, rftGenerationMode });
    
    // Validate business case and project for all modes
    if (!businessCaseId) {
      toast({
        variant: "destructive",
        title: "Missing Business Case",
        description: "Business case ID is missing. Please upload your business case first.",
      });
      return;
    }
    
    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Missing Project",
        description: "Project ID is missing. Please try selecting the template again.",
      });
      return;
    }
    
    // Template is optional for AI generation
    if (generationMode === "template_merge" && !selectedTemplate) {
      toast({
        variant: "destructive",
        title: "Missing Template",
        description: "Please select an organization template for template merge mode.",
      });
      return;
    }
    
    // Route to appropriate generation endpoint based on rftGenerationMode
    if (rftGenerationMode === "agent_driven") {
      generateWithAgentsMutation.mutate();
    } else {
      generateDraftMutation.mutate();
    }
  };

  const handlePublish = () => {
    publishMutation.mutate();
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 className="w-6 h-6" />
          <h1 className="text-3xl font-bold">Smart RFT Builder</h1>
        </div>
        <p className="text-muted-foreground">
          AI-powered RFT generation from your business case documents
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                currentStep >= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
              data-testid={`step-indicator-${step}`}
            >
              {currentStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
            </div>
            {step < 3 && (
              <div
                className={`w-24 h-1 mx-2 ${
                  currentStep > step ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Create Business Case */}
      {currentStep === 1 && (
        <Card data-testid="step-upload">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Step 1: Create Business Case
            </CardTitle>
            <CardDescription>
              Generate a lean business case from your idea or upload an existing document
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* RFT Generation Mode Selector */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
              <Label className="text-base font-semibold">How will your RFT be generated?</Label>
              <RadioGroup 
                value={rftGenerationMode} 
                onValueChange={(v) => setRftGenerationMode(v as RftGenerationMode)}
                className="grid grid-cols-2 gap-4"
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover-elevate cursor-pointer" data-testid="radio-ai-driven">
                  <RadioGroupItem value="ai_driven" id="ai_driven" />
                  <Label htmlFor="ai_driven" className="cursor-pointer flex-1">
                    <div className="font-medium">AI Driven</div>
                    <div className="text-xs text-muted-foreground">AI generates RFT from business case</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover-elevate cursor-pointer" data-testid="radio-agent-driven">
                  <RadioGroupItem value="agent_driven" id="agent_driven" />
                  <Label htmlFor="agent_driven" className="cursor-pointer flex-1">
                    <div className="font-medium flex items-center gap-1">
                      6 AI Agents
                      <Badge variant="secondary" className="ml-1">Expert</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">6 specialized agents create domain-specific sections</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <Tabs value={businessCaseMethod} onValueChange={(v) => setBusinessCaseMethod(v as BusinessCaseMethod)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="generate" data-testid="tab-generate">
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Generate from Idea
                </TabsTrigger>
                <TabsTrigger value="upload" data-testid="tab-upload">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </TabsTrigger>
              </TabsList>

              <TabsContent value="generate" className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Need sample data to test? Click to auto-fill with aviation project example
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFillSampleData}
                    data-testid="button-fill-sample"
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Fill Sample Data
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="portfolio">Portfolio *</Label>
                  <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
                    <SelectTrigger id="portfolio" data-testid="select-portfolio">
                      <SelectValue placeholder="Select a portfolio" />
                    </SelectTrigger>
                    <SelectContent>
                      {portfolios.map((portfolio: any) => (
                        <SelectItem key={portfolio.id} value={portfolio.id}>
                          {portfolio.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={businessCaseName}
                    onChange={(e) => setBusinessCaseName(e.target.value)}
                    placeholder="e.g., Mobile Passenger App"
                    data-testid="input-business-case-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="objective">Business Objective *</Label>
                  <Textarea
                    id="objective"
                    value={projectObjective}
                    onChange={(e) => setProjectObjective(e.target.value)}
                    placeholder="e.g., Modernize passenger experience with digital services"
                    data-testid="textarea-objective"
                    className="min-h-20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scope">Scope</Label>
                    <Input
                      id="scope"
                      value={projectScope}
                      onChange={(e) => setProjectScope(e.target.value)}
                      placeholder="e.g., iOS/Android app"
                      data-testid="input-scope"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeline">Timeline</Label>
                    <Input
                      id="timeline"
                      value={timeline}
                      onChange={(e) => setTimeline(e.target.value)}
                      placeholder="e.g., 12 months"
                      data-testid="input-timeline"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Budget</Label>
                  <Input
                    id="budget"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g., $2M"
                    data-testid="input-budget"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="functional-requirements">Functional Requirements *</Label>
                  <Textarea
                    id="functional-requirements"
                    value={functionalRequirements}
                    onChange={(e) => setFunctionalRequirements(e.target.value)}
                    placeholder="e.g., Booking system, seat selection, payment processing, boarding pass generation, flight status updates, baggage tracking"
                    data-testid="textarea-functional-requirements"
                    className="min-h-24"
                  />
                  <p className="text-xs text-muted-foreground">
                    Describe what the system must do - features, functions, and capabilities
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="non-functional-requirements">Non-functional Requirements</Label>
                  <Textarea
                    id="non-functional-requirements"
                    value={nonFunctionalRequirements}
                    onChange={(e) => setNonFunctionalRequirements(e.target.value)}
                    placeholder="e.g., 99.99% uptime, <2s response time, PCI-DSS compliance, GDPR compliance, support 100K concurrent users, mobile responsive"
                    data-testid="textarea-non-functional-requirements"
                    className="min-h-24"
                  />
                  <p className="text-xs text-muted-foreground">
                    Describe quality attributes - performance, security, reliability, scalability
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="success">Success Criteria</Label>
                  <Textarea
                    id="success"
                    value={successCriteria}
                    onChange={(e) => setSuccessCriteria(e.target.value)}
                    placeholder="e.g., 100K downloads, 4.5+ rating"
                    data-testid="textarea-success"
                    className="min-h-20"
                  />
                </div>

                <Button
                  onClick={handleGenerateBusinessCase}
                  disabled={generateBusinessCaseMutation.isPending}
                  className="w-full"
                  data-testid="button-generate"
                >
                  {generateBusinessCaseMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Business Case...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate with AI & Continue
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="portfolio-upload">Portfolio *</Label>
                  <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
                    <SelectTrigger id="portfolio-upload" data-testid="select-portfolio-upload">
                      <SelectValue placeholder="Select a portfolio" />
                    </SelectTrigger>
                    <SelectContent>
                      {portfolios.map((portfolio: any) => (
                        <SelectItem key={portfolio.id} value={portfolio.id}>
                          {portfolio.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name-upload">Business Case Name *</Label>
                  <Input
                    id="name-upload"
                    value={businessCaseName}
                    onChange={(e) => setBusinessCaseName(e.target.value)}
                    placeholder="e.g., Digital Transformation Initiative 2025"
                    data-testid="input-business-case-name-upload"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={businessCaseDescription}
                    onChange={(e) => setBusinessCaseDescription(e.target.value)}
                    placeholder="Brief description of the business case"
                    data-testid="textarea-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="document">Document *</Label>
                  <Input
                    id="document"
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.txt"
                    data-testid="input-file"
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                  className="w-full"
                  data-testid="button-upload"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Continue
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Template */}
      {currentStep === 2 && (
        <Card data-testid="step-template">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Step 2: Select RFT Template
            </CardTitle>
            <CardDescription>
              Choose between AI-generated or organization templates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs 
              defaultValue="ai_generation" 
              onValueChange={(value) => {
                setGenerationMode(value as GenerationMode);
                setSelectedTemplate(""); // Reset selection when switching modes
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ai_generation" data-testid="tab-ai-generation">
                  <Wand2 className="h-4 w-4 mr-2" />
                  AI Templates
                </TabsTrigger>
                <TabsTrigger value="template_merge" data-testid="tab-template-merge">
                  <FileText className="h-4 w-4 mr-2" />
                  Organization Templates
                </TabsTrigger>
              </TabsList>

              {/* AI Templates Tab */}
              <TabsContent value="ai_generation" className="space-y-4">
                {(templatesLoading || isSeedingTemplates) ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {isSeedingTemplates ? "Loading RFT templates..." : "Loading..."}
                    </p>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No AI templates available</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {templates.map((template: any) => (
                      <div
                        key={template.id}
                        className={`p-4 border rounded-lg cursor-pointer hover-elevate ${
                          selectedTemplate === template.id ? "border-primary bg-accent" : ""
                        }`}
                        onClick={() => setSelectedTemplate(template.id)}
                        data-testid={`template-ai-${template.category}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{template.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.description}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline">{template.category}</Badge>
                              <Badge variant="secondary">
                                {(template.sections?.sections || []).length} sections
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Organization Templates Tab */}
              <TabsContent value="template_merge" className="space-y-4">
                {orgTemplatesLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading organization templates...</p>
                  </div>
                ) : orgTemplates.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <p className="text-muted-foreground">No organization templates available</p>
                    <p className="text-sm text-muted-foreground">
                      Upload templates in Template Management to use them here
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {orgTemplates.filter((t: any) => t.isActive === "true").map((template: any) => (
                      <div
                        key={template.id}
                        className={`p-4 border rounded-lg cursor-pointer hover-elevate ${
                          selectedTemplate === template.id ? "border-primary bg-accent" : ""
                        }`}
                        onClick={() => setSelectedTemplate(template.id)}
                        data-testid={`template-org-${template.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{template.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.description}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline">{template.category}</Badge>
                              {template.isDefault === "true" && (
                                <Badge variant="default">Default</Badge>
                              )}
                              {template.sectionMappings && (
                                <Badge variant="secondary">
                                  {template.sectionMappings.length} sections configured
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                data-testid="button-back"
              >
                Back
              </Button>
              <Button
                onClick={handleSelectTemplate}
                disabled={
                  createProjectMutation.isPending || 
                  (generationMode === "template_merge" && !selectedTemplate)
                }
                className="flex-1"
                data-testid="button-select-template"
              >
                {createProjectMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2" />
                    Creating Project...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Generate RFT Draft */}
      {currentStep === 3 && (
        <Card data-testid="step-generate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5" />
              Step 3: Generate RFT Draft
            </CardTitle>
            <CardDescription>
              Create a collaborative draft with stakeholder assignments for review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-accent p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Ready to Generate {rftGenerationMode === "agent_driven" ? "with 6 AI Agents" : "Draft"}</h4>
              <p className="text-sm text-muted-foreground">
                {rftGenerationMode === "agent_driven" 
                  ? "Six specialized AI agents (Product, Architecture, Engineering, Security, Procurement, Delivery) will collaboratively generate comprehensive RFT sections with evaluation criteria and vendor questions. This process may take 1-2 minutes."
                  : generationMode === "ai_generation" 
                  ? "AI will create structured RFT sections with stakeholder assignments based on your business case. Sections will be assigned to Technical PM, Solution Architect, Cybersecurity Analyst, and other roles for collaborative review."
                  : "The system will merge your business case with the selected organization template, creating sections with pre-configured stakeholder assignments for collaborative review."
                }
              </p>
              {rftGenerationMode === "agent_driven" && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm font-medium mb-2">What you'll receive:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>1 comprehensive RFT document (DOCX & PDF)</li>
                    <li>4 Excel questionnaires with domain-specific questions</li>
                    <li>All files uploaded to Azure Blob Storage</li>
                  </ul>
                </div>
              )}
              {rftGenerationMode !== "agent_driven" && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm font-medium mb-1">Next steps after generation:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Review sections assigned to stakeholders</li>
                    <li>Edit content and get approvals</li>
                    <li>Finalize when all sections approved</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Progress indicator for agent-driven generation */}
            {generateWithAgentsMutation.isPending && (
              <Card className="bg-muted/30 border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <CardTitle className="text-base">6 AI Agents Working in Parallel...</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Each specialized agent is generating domain-specific RFT sections simultaneously
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Product Agent */}
                  <div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg border">
                    <Loader2 className="w-4 h-4 animate-spin text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">Product Agent</div>
                      <div className="text-xs text-muted-foreground">Creating product requirements, IATA standards, and user experience specifications</div>
                    </div>
                  </div>

                  {/* Architecture Agent */}
                  <div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg border">
                    <Loader2 className="w-4 h-4 animate-spin text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">Architecture Agent</div>
                      <div className="text-xs text-muted-foreground">Defining technical architecture, scalability, and integration requirements</div>
                    </div>
                  </div>

                  {/* Engineering Agent */}
                  <div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg border">
                    <Loader2 className="w-4 h-4 animate-spin text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">Engineering Agent</div>
                      <div className="text-xs text-muted-foreground">Specifying API/SDK requirements, code quality, and observability standards</div>
                    </div>
                  </div>

                  {/* Security Agent */}
                  <div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg border">
                    <Loader2 className="w-4 h-4 animate-spin text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">Security Agent</div>
                      <div className="text-xs text-muted-foreground">Establishing security, compliance, and data protection requirements</div>
                    </div>
                  </div>

                  {/* Procurement Agent */}
                  <div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg border">
                    <Loader2 className="w-4 h-4 animate-spin text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">Procurement Agent</div>
                      <div className="text-xs text-muted-foreground">Drafting commercial terms, pricing models, SLAs, and contract clauses</div>
                    </div>
                  </div>

                  {/* Delivery Agent */}
                  <div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg border">
                    <Loader2 className="w-4 h-4 animate-spin text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">Delivery Agent</div>
                      <div className="text-xs text-muted-foreground">Outlining delivery methodology, timelines, and risk management approach</div>
                    </div>
                  </div>

                  <div className="pt-2 text-xs text-muted-foreground text-center">
                    ⚡ All agents running concurrently • Estimated time: 20-30 seconds
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(2)}
                disabled={generateDraftMutation.isPending || generateWithAgentsMutation.isPending}
                data-testid="button-back-step3"
              >
                Back
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generateDraftMutation.isPending || generateWithAgentsMutation.isPending}
                className="flex-1"
                data-testid="button-generate"
              >
                {(generateDraftMutation.isPending || generateWithAgentsMutation.isPending) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {rftGenerationMode === "agent_driven" ? "Agents Working... 1-2 minutes" : "Creating Draft... This may take a minute"}
                  </>
                ) : (
                  <>
                    {rftGenerationMode === "agent_driven" ? <Lightbulb className="w-4 h-4 mr-2" /> : <FileCheck2 className="w-4 h-4 mr-2" />}
                    {rftGenerationMode === "agent_driven" 
                      ? "Generate with 6 AI Agents" 
                      : generationMode === "ai_generation" 
                      ? "Generate Draft with AI" 
                      : "Create Draft from Template"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Publish */}
      {currentStep === 4 && generatedRft && (
        <Card data-testid="step-publish">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Step 4: Review & Publish
            </CardTitle>
            <CardDescription>
              Review the generated RFT and 4 Excel questionnaires, then publish
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* RFT Document Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-lg">RFT Document</h4>
                <Badge variant="secondary">{(generatedRft.sections?.sections || []).length} sections</Badge>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto p-3 bg-muted/30 rounded-lg">
                {(generatedRft.sections?.sections || []).map((section: any, idx: number) => (
                  <div key={idx} className="p-3 bg-background border rounded-md">
                    <h5 className="font-medium text-sm">{section.title}</h5>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {section.content.substring(0, 150)}...
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={handleOpenEditDialog}
                  data-testid="button-edit-rft"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Document
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open(`/api/generated-rfts/${generatedRftId}/download/doc`, "_blank");
                  }}
                  data-testid="button-download-doc"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Download DOC
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open(`/api/generated-rfts/${generatedRftId}/download/pdf`, "_blank");
                  }}
                  data-testid="button-download-pdf"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>

            <Separator />

            {/* Questionnaires Section */}
            <div className="space-y-3">
              <h4 className="font-semibold text-lg">Excel Questionnaires</h4>
              <p className="text-sm text-muted-foreground">
                Four comprehensive questionnaires with dropdown compliance scoring (100%-Fully Met, 50%-Partially Met, 25%-Not Compliant, 0%-Not Applicable) and remarks column.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Product Questionnaire */}
                <div className="p-4 border rounded-lg space-y-2 hover-elevate">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium">Product Questionnaire</h5>
                    <Badge variant="outline">30 Questions</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Product features, capabilities, roadmap, and vendor support
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.open(`/api/questionnaires/download/${generatedRftId}/product`, "_blank");
                    }}
                    data-testid="button-download-product"
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </Button>
                </div>

                {/* NFR Questionnaire */}
                <div className="p-4 border rounded-lg space-y-2 hover-elevate">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium">NFR Questionnaire</h5>
                    <Badge variant="outline">50 Questions</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Non-functional requirements: performance, scalability, reliability
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.open(`/api/questionnaires/download/${generatedRftId}/nfr`, "_blank");
                    }}
                    data-testid="button-download-nfr"
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </Button>
                </div>

                {/* Cybersecurity Questionnaire */}
                <div className="p-4 border rounded-lg space-y-2 hover-elevate">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium">Cybersecurity Questionnaire</h5>
                    <Badge variant="outline">20 Questions</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Security, compliance, data protection, and certifications
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.open(`/api/questionnaires/download/${generatedRftId}/cybersecurity`, "_blank");
                    }}
                    data-testid="button-download-cybersecurity"
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </Button>
                </div>

                {/* Agile Delivery Questionnaire */}
                <div className="p-4 border rounded-lg space-y-2 hover-elevate">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium">Agile Delivery Questionnaire</h5>
                    <Badge variant="outline">20 Questions</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Agile methodology, sprint planning, CI/CD, and team structure
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.open(`/api/questionnaires/download/${generatedRftId}/agile`, "_blank");
                    }}
                    data-testid="button-download-agile"
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </Button>
                </div>
              </div>
              
              {/* Download All Button */}
              <div className="mt-4">
                <Button
                  variant="default"
                  size="lg"
                  onClick={() => {
                    window.open(`/api/generated-rfts/${generatedRftId}/download/all`, "_blank");
                  }}
                  data-testid="button-download-all"
                  className="w-full"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download All Deliverables (ZIP)
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Includes 1 RFT document (DOCX) + 4 Excel questionnaires
                </p>
              </div>
            </div>

            <Separator />

            {/* Publish Section */}
            <div className="space-y-3">
              <div className="bg-accent p-4 rounded-lg">
                <h5 className="font-semibold mb-2">Ready to Publish</h5>
                <p className="text-sm text-muted-foreground">
                  Publishing will make the RFT document available to vendors and create evaluation criteria in the system.
                </p>
              </div>

              {/* Quick Test: Generate Vendor Responses */}
              <div className="p-3 border border-dashed rounded-lg bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h6 className="font-medium text-sm mb-1">Quick Test</h6>
                    <p className="text-xs text-muted-foreground">
                      Generate sample vendor responses for testing the evaluation workflow
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateVendorResponsesMutation.mutate()}
                    disabled={!generatedRftId || generateVendorResponsesMutation.isPending}
                    data-testid="button-generate-vendor-responses"
                  >
                    {generateVendorResponsesMutation.isPending ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3 h-3 mr-2" />
                        Generate Responses
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Button
                onClick={handlePublish}
                disabled={publishMutation.isPending}
                className="w-full"
                data-testid="button-publish"
              >
                {publishMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publishing RFT...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Publish RFT to Vendors
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit RFT Document Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit RFT Document</DialogTitle>
            <DialogDescription>
              Review and edit each section of your RFT document. Changes will be saved to the database.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {editedSections.map((section: any, index: number) => (
              <div key={index} className="space-y-2 p-4 border rounded-lg">
                <Label htmlFor={`section-title-${index}`}>Section {index + 1} - Title</Label>
                <Input
                  id={`section-title-${index}`}
                  value={section.title}
                  onChange={(e) => handleSectionChange(index, "title", e.target.value)}
                  data-testid={`input-section-title-${index}`}
                />
                
                <Label htmlFor={`section-content-${index}`}>Content</Label>
                <Textarea
                  id={`section-content-${index}`}
                  value={section.content}
                  onChange={(e) => handleSectionChange(index, "content", e.target.value)}
                  className="min-h-32 font-mono text-sm"
                  data-testid={`textarea-section-content-${index}`}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={updateRftMutation.isPending}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdits}
              disabled={updateRftMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateRftMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
