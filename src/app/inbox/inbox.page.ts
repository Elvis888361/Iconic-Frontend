import { environment } from "../../environments/environment"
import { Router } from '@angular/router';
import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ChangeDetectorRef,
} from "@angular/core"
// import { Clipboard } from '@angular/cdk/clipboard'; // or use navigator.clipboard
import { HttpClient, HttpHeaders } from "@angular/common/http"
import { WebsocketService } from "../services/websocket.service"

// PDF.js CDN loader
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

function loadPdfJsFromCdn(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve();
      return;
    }

    // Try multiple CDN sources for better reliability
    const cdnSources = [
      {
        main: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.js",
        worker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js"
      },
      {
        main: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
        worker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
      },
      {
        main: "https://unpkg.com/pdfjs-dist@4.2.67/build/pdf.min.js",
        worker: "https://unpkg.com/pdfjs-dist@4.2.67/build/pdf.worker.min.js"
      }
    ];

    let currentSourceIndex = 0;

    const tryLoadSource = (sourceIndex: number) => {
      if (sourceIndex >= cdnSources.length) {
        reject(new Error("All PDF.js CDN sources failed to load"));
        return;
      }

      const source = cdnSources[sourceIndex];
      const script = document.createElement("script");
      script.src = source.main;
      script.type = "text/javascript";

      // Add timeout for script loading
      const timeout = setTimeout(() => {
        script.remove();
        console.warn(`PDF.js source ${sourceIndex + 1} timed out, trying next...`);
        tryLoadSource(sourceIndex + 1);
      }, 10000); // 10 second timeout

      script.onload = () => {
        clearTimeout(timeout);
        try {
          if (window.pdfjsLib) {
            // Set workerSrc to corresponding worker URL
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = source.worker;
            console.log(`PDF.js loaded successfully from source ${sourceIndex + 1}`);
            resolve();
          } else {
            console.warn(`PDF.js source ${sourceIndex + 1} loaded but pdfjsLib not available, trying next...`);
            script.remove();
            tryLoadSource(sourceIndex + 1);
          }
        } catch (error) {
          console.warn(`PDF.js source ${sourceIndex + 1} error during setup:`, error);
          script.remove();
          tryLoadSource(sourceIndex + 1);
        }
      };

      script.onerror = (error) => {
        clearTimeout(timeout);
        console.warn(`PDF.js source ${sourceIndex + 1} failed to load:`, error);
        script.remove();
        tryLoadSource(sourceIndex + 1);
      };

      document.head.appendChild(script);
    };

    tryLoadSource(0);
  });
}
interface OcrField {
  label: string
  value: string
  confidence: number
  position: {
    x: number
    y: number
    width: number
    height: number
  } // Removed the optional ? to make it required
  isNew?: boolean
  isHighlighted?: boolean
  animationPhase?: number
}

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  active: boolean;
  route?: string;
}

interface StatusOption {
  id: string;
  label: string;
  active: boolean;
}

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface WorkflowStep {
  icon: string;
  label: string;
}
interface ProcessingStep {
  step: string
  message: string
  progress: number
}
interface TableCell {
  row: number
  column: number
  text: string
  confidence: number
}


interface DocumentMapping {
  cellWidth: number
  cellHeight: number
  startX: number
  startY: number
  tableRows: number
  tableColumns: number
}

@Component({
  selector: "app-inbox",
  templateUrl: "inbox.page.html",
  styleUrls: ["inbox.page.scss"],
})
export class InboxPage implements OnInit, OnDestroy, AfterViewInit {
 @Input() name?: string
  @ViewChild("fileInputRef") fileInputRef!: ElementRef<HTMLInputElement>
  @ViewChild("documentCanvas", { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>
  @ViewChild("canvasContainer", { static: false }) canvasContainer!: ElementRef<HTMLDivElement>
  @ViewChild("fieldModal") fieldModal: any

  totalAmount: number = 150;
  isLoading: boolean = false;
  loadingMessage: string = 'Laden...';
  showInfoCard: boolean = true;
  uploadCardHovered: boolean = false;
  teamImageUrl: string | null = null;

   // Navigation items
  navigationItems: NavigationItem[] = [
    { id: 'home', label: 'Home', icon: '🏠', active: true, route: '/dashboard' },
    { id: 'inbox', label: 'Inbox', icon: '📥', active: false, route: '/inbox' },
    { id: 'outbox', label: 'Outbox', icon: '📤', active: false, route: '/outbox' },
    { id: 'profile', label: 'Profile', icon: '👤', active: false, route: '/profile' }
  ];

  // Status options
  statusOptions: StatusOption[] = [
    { id: 'today', label: 'vandaag', active: true },
    { id: 'yesterday', label: 'gisteren', active: false }
  ];

  // Company logos
  companyLogos: string[] = [
    'EXACT', 'AFAS', 'CASH', 'KING',
    'snelstart', 'Asperion', 'KING', 'e-Boekhouden',
    'informer', 'Minox', 'yuki', '+'
  ];

  // Workflow features
  workflowFeatures: string[] = [
    'Al je facturen zijn direct inzichtelijk',
    'Nooit meer in je mailbox zoeken naar facturen',
    'Alle aankopen en totaalbedragen zijn direct zichtbaar'
  ];

  // Workflow steps
  workflowSteps: WorkflowStep[] = [
    { icon: '📧', label: 'Email' },
    { icon: '📋', label: 'Process' },
    { icon: '✅', label: 'Complete' }
  ];
toastMessages: ToastMessage[] = [];

  private toastCounter: number = 0;
  private toastTimeouts: { [key: string]: any } = {};

  // File and processing state
  Object = Object;
  public selectedFile: File | null = null
  public isProcessing = false
  public processingComplete = false
  public currentProcessingStep = ""
  public ocrProgress = 0
  public totalFieldsProcessed = 0
  private documentMapping: DocumentMapping | null = null
  private isTableBasedData = false

  // OCR results
  public extractedFields: OcrField[] = []
  public newFieldsQueue: OcrField[] = []
  public highConfidenceCount = 0

  // Canvas properties
  public canvas: HTMLCanvasElement | null = null
  public ctx: CanvasRenderingContext2D | null = null
  public documentImage: HTMLImageElement | null = null

  public canvasWidth = 1000
public canvasHeight = 700
  public scaleFactor = 1
  public documentOffsetX = 0
  public documentOffsetY = 0
  public documentWidth = 0
  public documentHeight = 0

  // UI state
  public showFieldLabels = true
  public confidenceFilter = 50 // Show fields with 50%+ confidence
  public showFieldModal = false
  public selectedField: OcrField | null = null

  // Animation properties
  public processingAnimation = false
  public animationFrameId: number | null = null
  public scanLinePosition = 0
  public scanDirection = 1
  public fieldAnimations = new Map<number, number>()

  // WebSocket properties
  private socketId: string | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  public showInvoiceDetails = true; 

  public invoiceData: any = null;

  // Math helper for template
  public Math = Math

  constructor(
    private http: HttpClient,
    private websocketService: WebsocketService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    // private clipboard: Clipboard,
  ) {}

  ngOnInit() {
    this.setupWebSocketListeners()
    this.initializeComponent();
    this.loadDashboardData();
  }

  ngAfterViewInit() {
    this.initializeCanvas()
  }

  ngOnDestroy() {
    this.cleanup()
    this.clearAllToasts();
  }
   // Initialization methods
  private initializeComponent(): void {
    console.log('Dashboard component initialized');
    // Additional initialization logic
  }

  private async loadDashboardData(): Promise<void> {
    try {
      this.setLoading(true, 'Dashboard gegevens laden...');
      
      // Simulate API calls
      await this.delay(1000);
      
      // Load data here
      await this.loadInboxTotal();
      await this.loadUserSettings();
      
      this.setLoading(false);
      this.showToast('Dashboard succesvol geladen!', 'success');
    } catch (error) {
      this.setLoading(false);
      this.showToast('Fout bij het laden van dashboard gegevens', 'error');
      console.error('Error loading dashboard data:', error);
    }
  }

  private async loadInboxTotal(): Promise<void> {
    // Simulate API call to get inbox total
    await this.delay(500);
    this.totalAmount = 150; // This would come from your service
  }

  private async loadUserSettings(): Promise<void> {
    // Simulate API call to get user settings
    await this.delay(300);
    // Load user preferences, settings, etc.
  }

  // Navigation methods
  onNavigationClick(item: NavigationItem): void {
    this.navigationItems.forEach(nav => nav.active = false);
    item.active = true;
    
    console.log(`Navigating to: ${item.label}`, item);
    
    // Add your routing logic here
    if (item.route) {
      this.router.navigate([item.route]).catch(error => {
        console.error('Navigation error:', error);
        this.showToast('Navigatie fout opgetreden', 'error');
      });
    }
    
    this.showToast(`Navigeerd naar ${item.label}`, 'info');
  }

  // Status methods
  onStatusChange(selectedStatus: StatusOption): void {
    this.statusOptions.forEach(status => status.active = false);
    selectedStatus.active = true;
    
    console.log(`Status changed to: ${selectedStatus.label}`, selectedStatus);
    
    // Reload data based on status
    this.loadStatusData(selectedStatus.id);
    this.showToast(`Status gewijzigd naar ${selectedStatus.label}`, 'info');
  }

  private async loadStatusData(statusId: string): Promise<void> {
    this.setLoading(true, 'Gegevens laden...');
    
    try {
      // Simulate API call based on status
      await this.delay(800);
      
      // Update data based on status
      if (statusId === 'today') {
        this.totalAmount = 150;
      } else {
        this.totalAmount = 85;
      }
      
      this.setLoading(false);
    } catch (error) {
      this.setLoading(false);
      this.showToast('Fout bij het laden van gegevens', 'error');
    }
  }

  // Upload methods
  onUploadClick(): void {
    console.log('Upload button clicked from sidebar');
    this.onUploadFactuur();
  }

  onUploadFactuur(): void {
    console.log('Upload factuur clicked');
    
    // Add your file upload logic here
    this.simulateFileUpload();
  }

  private async simulateFileUpload(): Promise<void> {
    this.setLoading(true, 'Factuur uploaden...');
    
    try {
      await this.delay(2000);
      
      // Simulate successful upload
      this.totalAmount += 50; // Add uploaded amount
      this.setLoading(false);
      this.showToast('Factuur succesvol geüpload!', 'success');
    } catch (error) {
      this.setLoading(false);
      this.showToast('Fout bij het uploaden van factuur', 'error');
    }
  }

  // Card interaction methods
  onUploadCardHover(hovered: boolean): void {
    this.uploadCardHovered = hovered;
  }

  onCloseInfoCard(): void {
    this.showInfoCard = false;
    this.showToast('Info kaart gesloten', 'info');
  }

  onReadMore(event: Event): void {
    event.preventDefault();
    console.log('Read more clicked');
    
    // Add your read more logic here
    this.showToast('Meer informatie wordt geladen...', 'info');
    
    // You could open a modal, navigate to a detailed page, or expand content
    // Example: this.router.navigate(['/info-details']);
  }

  // Filter methods
  onFilterClick(): void {
    console.log('Filter button clicked');
    this.showToast('Filter opties worden geladen...', 'info');
    
    // Add your filter logic here
    // You could open a filter modal or dropdown
  }

  onWorkflowFilter(): void {
    console.log('Workflow filter clicked');
    this.showToast('Workflow filter wordt toegepast...', 'info');
    
    // Add your workflow filter logic here
  }

  // Loading methods
  private setLoading(loading: boolean, message: string = 'Laden...'): void {
    this.isLoading = loading;
    this.loadingMessage = message;
  }

  // Toast methods
  private showToast(message: string, type: 'success' | 'error' | 'info', duration: number = 3000): void {
    const toast: ToastMessage = {
      id: `toast-${++this.toastCounter}`,
      message,
      type,
      duration
    };

    this.toastMessages.push(toast);

    // Auto-remove toast after duration
    const timeout = setTimeout(() => {
      this.removeToast(toast.id);
    }, duration);

    this.toastTimeouts[toast.id] = timeout;
  }

  private removeToast(toastId: string): void {
    const index = this.toastMessages.findIndex(toast => toast.id === toastId);
    if (index > -1) {
      this.toastMessages.splice(index, 1);
    }
    
    // Clear timeout if it exists
    if (this.toastTimeouts[toastId]) {
      clearTimeout(this.toastTimeouts[toastId]);
      delete this.toastTimeouts[toastId];
    }
  }

  private clearAllToasts(): void {
    // Clear all timeouts
    Object.values(this.toastTimeouts).forEach(timeout => {
      clearTimeout(timeout);
    });
    
    this.toastTimeouts = {};
    this.toastMessages = [];
  }

  // Utility methods
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Additional utility methods you might need
  private formatCurrency(amount: number): string {
    return `€${amount},-`;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Method to refresh dashboard data
  refreshDashboard(): void {
    this.loadDashboardData();
  }

  // Method to reset filters and status
  resetFilters(): void {
    this.statusOptions.forEach(status => {
      status.active = status.id === 'today';
    });
    this.loadStatusData('today');
    this.showToast('Filters gereset', 'info');
  }

  private cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }
    if (this.fieldUpdateTimer) {
      clearTimeout(this.fieldUpdateTimer)
    }
    this.websocketService.disconnect()
  }


  private setupWebSocketListeners(): void {
    const socket = this.websocketService.getSocket()

    socket.on("connect", () => {
      console.log("Connected to WebSocket server")
      this.socketId = socket.id || null
      this.reconnectAttempts = 0
    })

    socket.on("disconnect", () => {
      console.log("Disconnected from WebSocket server")
      this.socketId = null
      this.handleReconnection()
    })

    socket.on("processing_start", (data: any) => {
      console.log("Processing started:", data)
      this.resetProcessingState()
      this.isProcessing = true
      this.processingAnimation = true
      this.currentProcessingStep = "Initializing OCR processing..."
      this.startProcessingAnimation()
      this.cdr.detectChanges()
    })

    socket.on("processing_step", (data: any) => {
      console.log("Processing step:", data)
      this.handleProcessingStep(data)
    })

    socket.on("positional_data", (data: any) => {
      console.log("Received positional data:", data)
      this.handlePositionalData(data)
    })

    socket.on("processing_complete", (data: any) => {
      console.log("Processing complete:", data)
      this.handleProcessingComplete(data)
    })

    socket.on("error", (error: any) => {
      console.error("WebSocket error:", error)
      this.handleProcessingError(error)
    })
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
        // Assuming websocketService has a reconnect method or we reinitialize
        this.setupWebSocketListeners()
      }, 2000 * this.reconnectAttempts)
    }
  }

  
// Replace these key methods in your component

// 1. Enhanced canvas initialization
private initializeCanvas(): void {
  if (this.canvasRef) {
    this.canvas = this.canvasRef.nativeElement
    this.ctx = this.canvas.getContext("2d")

    if (this.ctx) {
      // Dynamic canvas sizing
      this.canvasWidth = Math.min(1000, window.innerWidth - 100)
      this.canvasHeight = Math.min(700, window.innerHeight - 300)
      
      this.canvas.width = this.canvasWidth
      this.canvas.height = this.canvasHeight
      this.canvas.style.width = this.canvasWidth + 'px'
      this.canvas.style.height = this.canvasHeight + 'px'
      
      this.drawEmptyState()
    }
  }
}

  private drawEmptyState(): void {
    if (!this.ctx || !this.canvas) return

    // Clear canvas
    this.ctx.fillStyle = "#f8f9fa"
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw dashed border
    this.ctx.strokeStyle = "#dee2e6"
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([15, 10])
    this.ctx.strokeRect(20, 20, this.canvas.width - 40, this.canvas.height - 40)

    // Draw upload icon and text
    this.ctx.fillStyle = "#6c757d"
    this.ctx.font = "bold 24px Arial"
    this.ctx.textAlign = "center"
    this.ctx.fillText("📄", this.canvas.width / 2, this.canvas.height / 2 - 40)

    this.ctx.font = "18px Arial"
    this.ctx.fillText("Select a document to preview", this.canvas.width / 2, this.canvas.height / 2)

    this.ctx.font = "14px Arial"
    this.ctx.fillStyle = "#adb5bd"
    this.ctx.fillText("Supported formats: PDF, JPG, PNG", this.canvas.width / 2, this.canvas.height / 2 + 30)

    this.ctx.setLineDash([])
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0]
      this.resetProcessingState()
      this.loadFileToCanvas(this.selectedFile)
    }
  }

  clearSelectedFile(): void {
    this.selectedFile = null
    this.invoiceData = null
    this.resetProcessingState()
    this.drawEmptyState()
    if (this.fileInputRef) {
      this.fileInputRef.nativeElement.value = ""
    }
  }

  private resetProcessingState(): void {
    this.isProcessing = false
    this.processingComplete = false
    this.processingAnimation = false
    this.extractedFields = []
    this.newFieldsQueue = []
    this.totalFieldsProcessed = 0
    this.highConfidenceCount = 0
    this.ocrProgress = 0
    this.currentProcessingStep = ""
    this.fieldAnimations.clear()
    this.invoiceData = null

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    if (this.fieldUpdateTimer) {
      clearTimeout(this.fieldUpdateTimer)
      this.fieldUpdateTimer = null
    }
  }

  private loadFileToCanvas(file: File): void {
    if (!this.ctx || !this.canvas) return

    if (file.type.startsWith("image/")) {
      this.loadImageFile(file)
    } else if (file.type === "application/pdf") {
      this.loadPdfPreview(file)
    }
  }

  private loadImageFile(file: File): void {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        this.documentImage = img
        this.drawDocumentToCanvas(img)
      }
      img.onerror = () => {
        console.error("Failed to load image")
        this.drawErrorState("Failed to load image file")
      }
      if (e.target?.result) {
        img.src = e.target.result as string
      }
    }
    reader.onerror = () => {
      console.error("Failed to read file")
      this.drawErrorState("Failed to read file")
    }
    reader.readAsDataURL(file)
  }

  private async loadPdfPreview(file: File): Promise<void> {
  if (!this.ctx || !this.canvas) return;
  
  try {
    // Show loading state
    this.drawLoadingState("Loading PDF.js library...");
    
    // Load PDF.js with timeout and retry logic
    await Promise.race([
      loadPdfJsFromCdn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("PDF.js loading timeout")), 15000)
      )
    ]);

    this.drawLoadingState("Processing PDF file...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!e.target?.result) {
          throw new Error("Failed to read file data");
        }

        const typedarray = new Uint8Array(e.target.result as ArrayBuffer);
        
        // Load PDF document with timeout
        const loadingTask = window.pdfjsLib.getDocument({ 
          data: typedarray,
          verbosity: 0 // Reduce console output
        });
        
        const pdf = await Promise.race([
          loadingTask.promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("PDF parsing timeout")), 10000)
          )
        ]);
        
        // Get first page
        const page = await pdf.getPage(1);
        
        // Calculate optimal scale to fit canvas
        const viewport = page.getViewport({ scale: 1.0 });
        const canvasAspect = this.canvas!.width / this.canvas!.height;
        const pageAspect = viewport.width / viewport.height;
        
        let scale: number;
        if (pageAspect > canvasAspect) {
          // Page is wider than canvas
          scale = (this.canvas!.width - 40) / viewport.width;
        } else {
          // Page is taller than canvas
          scale = (this.canvas!.height - 40) / viewport.height;
        }
        
        const scaledViewport = page.getViewport({ scale });
        
        // Center the PDF in the canvas
        this.documentWidth = scaledViewport.width;
        this.documentHeight = scaledViewport.height;
        this.documentOffsetX = (this.canvas!.width - this.documentWidth) / 2;
        this.documentOffsetY = (this.canvas!.height - this.documentHeight) / 2;
        this.scaleFactor = scale;
        
        console.log('PDF loaded:', {
          originalSize: { width: viewport.width, height: viewport.height },
          scale: scale,
          canvasSize: { width: this.canvas!.width, height: this.canvas!.height },
          documentSize: { width: this.documentWidth, height: this.documentHeight },
          offset: { x: this.documentOffsetX, y: this.documentOffsetY }
        });
        
        // Clear canvas and draw background
        this.ctx!.fillStyle = "#f0f0f0";
        this.ctx!.fillRect(0, 0, this.canvas!.width, this.canvas!.height);
        
        // Draw document shadow
        this.ctx!.fillStyle = "rgba(0, 0, 0, 0.1)";
        this.ctx!.fillRect(
          this.documentOffsetX + 3, 
          this.documentOffsetY + 3, 
          this.documentWidth, 
          this.documentHeight
        );
        
        // Create temporary canvas for PDF rendering
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = scaledViewport.width;
        tempCanvas.height = scaledViewport.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (!tempCtx) {
          throw new Error("Failed to get canvas context");
        }
        
        this.drawLoadingState("Rendering PDF...");
        
        // Render PDF to temporary canvas with timeout
        await Promise.race([
          page.render({ canvasContext: tempCtx, viewport: scaledViewport }).promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("PDF rendering timeout")), 15000)
          )
        ]);
        
        // Draw PDF content to main canvas
        this.ctx!.drawImage(
          tempCanvas, 
          this.documentOffsetX, 
          this.documentOffsetY, 
          this.documentWidth, 
          this.documentHeight
        );
        
        // Store the rendered image for later use
        this.documentImage = new Image();
        this.documentImage.src = tempCanvas.toDataURL();
        
        console.log('PDF rendered successfully');
        
      } catch (err) {
        console.error("Failed to render PDF:", err);
        this.drawErrorState(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    
    reader.onerror = () => {
      console.error("Failed to read PDF file");
      this.drawErrorState("Failed to read PDF file. The file may be corrupted.");
    };
    
    reader.readAsArrayBuffer(file);
    
  } catch (err) {
    console.error("PDF.js loading failed:", err);
    this.drawErrorState("PDF viewer unavailable. Please use an image file instead.");
  }
}

private drawLoadingState(message: string): void {
  if (!this.ctx || !this.canvas) return;

  // Clear canvas
  this.ctx.fillStyle = "#f8f9fa";
  this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

  // Draw loading icon
  this.ctx.fillStyle = "#6c757d";
  this.ctx.font = "bold 24px Arial";
  this.ctx.textAlign = "center";
  this.ctx.fillText("⏳", this.canvas.width / 2, this.canvas.height / 2 - 40);

  // Draw loading message
  this.ctx.font = "18px Arial";
  this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);

  // Draw spinner animation
  const time = Date.now() * 0.005;
  const spinnerRadius = 15;
  const spinnerX = this.canvas.width / 2;
  const spinnerY = this.canvas.height / 2 + 40;

  this.ctx.strokeStyle = "#007bff";
  this.ctx.lineWidth = 3;
  this.ctx.lineCap = "round";

  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI / 4) + time;
    const alpha = Math.max(0.2, 1 - (i * 0.1));
    
    this.ctx.globalAlpha = alpha;
    this.ctx.beginPath();
    this.ctx.moveTo(
      spinnerX + Math.cos(angle) * spinnerRadius * 0.5,
      spinnerY + Math.sin(angle) * spinnerRadius * 0.5
    );
    this.ctx.lineTo(
      spinnerX + Math.cos(angle) * spinnerRadius,
      spinnerY + Math.sin(angle) * spinnerRadius
    );
    this.ctx.stroke();
  }

  this.ctx.globalAlpha = 1;
}

  private loadImageFromUrl(imageUrl: string): void {
    const img = new Image()
    img.onload = () => {
      this.documentImage = img
      this.drawDocumentToCanvas(img)
    }
    img.onerror = () => {
      console.error("Failed to load preview image")
      this.drawErrorState("Failed to load document preview")
    }
    img.crossOrigin = "anonymous"
    img.src = imageUrl
  }

  private loadPdfPlaceholder(file: File): void {
    if (!this.ctx || !this.canvas) return

    // Clear canvas
    this.ctx.fillStyle = "#ffffff"
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw PDF representation
    const pdfWidth = 300
    const pdfHeight = 400
    const pdfX = (this.canvas.width - pdfWidth) / 2
    const pdfY = (this.canvas.height - pdfHeight) / 2

    // PDF background
    this.ctx.fillStyle = "#ffffff"
    this.ctx.fillRect(pdfX, pdfY, pdfWidth, pdfHeight)
    this.ctx.strokeStyle = "#dee2e6"
    this.ctx.lineWidth = 2
    this.ctx.strokeRect(pdfX, pdfY, pdfWidth, pdfHeight)

    // PDF header
    this.ctx.fillStyle = "#dc3545"
    this.ctx.fillRect(pdfX, pdfY, pdfWidth, 60)

    // PDF icon and text
    this.ctx.fillStyle = "#ffffff"
    this.ctx.font = "bold 24px Arial"
    this.ctx.textAlign = "center"
    this.ctx.fillText("PDF", this.canvas.width / 2, pdfY + 40)

    // File name
    this.ctx.fillStyle = "#495057"
    this.ctx.font = "14px Arial"
    const fileName = file.name.length > 30 ? file.name.substring(0, 27) + "..." : file.name
    this.ctx.fillText(fileName, this.canvas.width / 2, pdfY + pdfHeight + 30)

    // Draw text lines
    this.ctx.strokeStyle = "#dee2e6"
    this.ctx.lineWidth = 1
    for (let i = 0; i < 15; i++) {
      const lineY = pdfY + 80 + i * 20
      const lineWidth = Math.random() * 200 + 50
      this.ctx.beginPath()
      this.ctx.moveTo(pdfX + 20, lineY)
      this.ctx.lineTo(pdfX + 20 + lineWidth, lineY)
      this.ctx.stroke()
    }
  }

  private drawErrorState(message: string): void {
    if (!this.ctx || !this.canvas) return

    this.ctx.fillStyle = "#f8f9fa"
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.fillStyle = "#dc3545"
    this.ctx.font = "bold 20px Arial"
    this.ctx.textAlign = "center"
    this.ctx.fillText("⚠️ Error", this.canvas.width / 2, this.canvas.height / 2 - 20)

    this.ctx.font = "16px Arial"
    this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2 + 20)
  }

private drawDocumentToCanvas(img: HTMLImageElement): void {
    if (!this.ctx || !this.canvas) return;

    // For PDFs, the image is a snapshot of the rendered PDF, so draw it at (0,0) with full canvas size
    if (
      this.selectedFile?.type === "application/pdf" &&
      img.width === this.canvas.width &&
      img.height === this.canvas.height
    ) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
      // documentWidth/Height/Offset already set in loadPdfPreview
      return;
    }

    // For images, keep the original logic
    // Calculate scaling to fit canvas while maintaining aspect ratio
    const canvasAspect = this.canvas.width / this.canvas.height;
    const imageAspect = img.width / img.height;

    if (imageAspect > canvasAspect) {
      // Image is wider than canvas
      this.documentWidth = this.canvas.width - 40; // 20px margin on each side
      this.documentHeight = this.documentWidth / imageAspect;
      this.documentOffsetX = 20;
      this.documentOffsetY = (this.canvas.height - this.documentHeight) / 2;
    } else {
      // Image is taller than canvas
      this.documentHeight = this.canvas.height - 40; // 20px margin on each side
      this.documentWidth = this.documentHeight * imageAspect;
      this.documentOffsetX = (this.canvas.width - this.documentWidth) / 2;
      this.documentOffsetY = 20;
    }

    this.scaleFactor = Math.min(this.documentWidth / img.width, this.documentHeight / img.height);

    // Clear canvas with background
    this.ctx.fillStyle = "#f8f9fa";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw shadow
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    this.ctx.fillRect(this.documentOffsetX + 5, this.documentOffsetY + 5, this.documentWidth, this.documentHeight);

    // Draw document
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(this.documentOffsetX, this.documentOffsetY, this.documentWidth, this.documentHeight);
    this.ctx.drawImage(img, this.documentOffsetX, this.documentOffsetY, this.documentWidth, this.documentHeight);

    // Draw border
    this.ctx.strokeStyle = "#dee2e6";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(this.documentOffsetX, this.documentOffsetY, this.documentWidth, this.documentHeight);
  }

  startOcrProcessing(): void {
    if (!this.selectedFile) {
      console.warn("No file selected")
      return
    }

    this.loadFileToCanvas(this.selectedFile)

    const formData = new FormData()
    formData.append("file", this.selectedFile, this.selectedFile.name)

    let headers = new HttpHeaders()
    if (this.socketId) {
      headers = headers.set("x-socket-id", this.socketId)
    }

    this.resetProcessingState()
    this.isProcessing = true
    this.processingAnimation = true
    this.currentProcessingStep = "Initializing OCR processing..."
    this.startProcessingAnimation()

    this.http.post(`${environment.apiUrl}/invoices/pdf2json`, formData, { headers }).subscribe({
      next: (data: any) => {
        this.handleProcessingComplete(data)
      },
      error: (error) => {
        this.handleProcessingError(error)
      },
    })
  }

 // Fix the processing step handler to show better progress
private handleProcessingStep(data: any): void {
  const stepProgress = this.getStepProgress(data.step);
  this.ocrProgress = stepProgress;
  this.currentProcessingStep = data.message || this.getStepLabel(data.step);
  
  // Update progress overlay on canvas
  this.drawProcessingProgress();
  this.cdr.detectChanges();
}
   private transformCoordinates(field: any): { x: number; y: number; width: number; height: number } {
    console.log('Transforming coordinates:', { 
      field: field, 
      fileType: this.selectedFile?.type,
      documentOffset: { x: this.documentOffsetX, y: this.documentOffsetY },
      documentSize: { width: this.documentWidth, height: this.documentHeight },
      scaleFactor: this.scaleFactor,
      originalImageSize: { width: this.originalImageWidth, height: this.originalImageHeight }
    });

    // Ensure we have valid numeric values
    const fieldX = typeof field.x === 'number' ? field.x : 0;
    const fieldY = typeof field.y === 'number' ? field.y : 0;
    const fieldWidth = typeof field.width === 'number' ? field.width : this.estimateTextWidth(field.text || '');
    const fieldHeight = typeof field.height === 'number' ? field.height : 20;

    let canvasX: number, canvasY: number, width: number, height: number;

    if (this.selectedFile?.type === "application/pdf") {
      // For PDF files, coordinates from backend are already in pixel coordinates
      // relative to the original image size. We need to scale them to fit our canvas.
      
      if (this.originalImageWidth && this.originalImageHeight) {
        // Calculate scale factor from original image to our displayed document
        const displayScaleX = this.documentWidth / this.originalImageWidth;
        const displayScaleY = this.documentHeight / this.originalImageHeight;
        
        console.log('PDF display scaling:', { displayScaleX, displayScaleY });
        
        // Apply display scaling and add document offset
        canvasX = this.documentOffsetX + (fieldX * displayScaleX);
        canvasY = this.documentOffsetY + (fieldY * displayScaleY);
        width = fieldWidth * displayScaleX;
        height = fieldHeight * displayScaleY;
      } else {
        // Fallback: use the current scale factor
        canvasX = this.documentOffsetX + (fieldX * this.scaleFactor);
        canvasY = this.documentOffsetY + (fieldY * this.scaleFactor);
        width = fieldWidth * this.scaleFactor;
        height = fieldHeight * this.scaleFactor;
      }
    } else {
      // For image files, apply scaling and offset
      canvasX = fieldX * this.scaleFactor + this.documentOffsetX;
      canvasY = fieldY * this.scaleFactor + this.documentOffsetY;
      width = fieldWidth * this.scaleFactor;
      height = fieldHeight * this.scaleFactor;
    }

    // Ensure all values are valid numbers and within reasonable bounds
    const result = { 
      x: Math.max(0, Math.min(isNaN(canvasX) ? 0 : canvasX, this.canvasWidth)), 
      y: Math.max(0, Math.min(isNaN(canvasY) ? 0 : canvasY, this.canvasHeight)), 
      width: Math.max(10, Math.min(isNaN(width) ? 100 : width, this.canvasWidth)), 
      height: Math.max(10, Math.min(isNaN(height) ? 20 : height, this.canvasHeight))
    };

    console.log('Transformed coordinates:', result);
    return result;
  }
  copyFieldText() {
    if (this.selectedField?.value) {
      navigator.clipboard.writeText(this.selectedField.value)
        .then(() => console.log('Copied!'))
        .catch(err => console.error('Copy failed', err));
    }
  }
  onInvoiceDetailsReceived(data: any) {
    this.invoiceData = data.invoiceDetails;  // or however you get it
    console.log('Invoice details:', this.invoiceData);
  }
  getCountryColor(code: string): string {
    const colors: Record<string,string> = {
      NL: '#155724',   // greenish
      BE: '#0d47a1'    // bluish
    };
    return colors[code] || '#333';
  }
  getCountryName(code: string): string {
  const countryMap: Record<string, string> = {
    'NL': 'Netherlands',
    'BE': 'Belgium',
    'DE': 'Germany',
    'FR': 'France',
    'UK': 'United Kingdom',
    'US': 'United States',
    'UNKNOWN': 'Unknown'
  };
  return countryMap[code] || code;
}
  getCompletenessColor(score: number): string {
  if (score >= 90) return 'linear-gradient(135deg, #28a745, #20c997)'; // Green
  if (score >= 70) return 'linear-gradient(135deg, #ffc107, #fd7e14)'; // Yellow
  if (score >= 50) return 'linear-gradient(135deg, #fd7e14, #dc3545)'; // Orange
  return 'linear-gradient(135deg, #dc3545, #c82333)'; // Red
}
validateIBAN(iban: string): boolean {
  if (!iban) return false;
  // Basic IBAN validation - NL IBAN should be 18 characters
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{10}$/.test(cleanIban);
}
validateVATNumber(vat: string, country: string): boolean {
  if (!vat) return false;
  const cleanVat = vat.replace(/\s/g, '').toUpperCase();
  
  switch (country) {
    case 'NL':
      return /^NL\d{9}B\d{2}$/.test(cleanVat);
    case 'BE':
      return /^BE\d{10}$/.test(cleanVat);
    default:
      return cleanVat.length > 5; // Basic validation
  }
}
validateCompanyNumber(number: string, country: string): boolean {
  if (!number) return false;
  const cleanNumber = number.replace(/\s/g, '');
  
  switch (country) {
    case 'NL':
      return /^\d{8}$/.test(cleanNumber); // Dutch KvK number
    case 'BE':
      return /^BE\d{10}$/.test(cleanNumber) || /^\d{10}$/.test(cleanNumber);
    default:
      return cleanNumber.length >= 6;
  }
}
getFieldValidationStatus(fieldPath: string): { status: 'success' | 'warning' | 'error', message: string } {
  if (!this.invoiceData?.data_validation?.field_status) {
    return { status: 'warning', message: 'Validation not available' };
  }

  const fieldStatus = this.invoiceData.data_validation.field_status[fieldPath];
  if (!fieldStatus) {
    return { status: 'warning', message: 'Field status unknown' };
  }

  if (fieldStatus.present) {
    return { status: 'success', message: 'Found' };
  } else {
    return { status: 'error', message: 'Missing' };
  }
}
hasCriticalDataMissing(): boolean {
  if (!this.invoiceData?.data_validation) return true;
  
  const criticalFields = [
    'sender.company', 'total_amount_incl_vat', 'invoice.date', 
    'invoice.number', 'company.vat_number'
  ];
  
  return criticalFields.some(field => {
    const fieldStatus = this.invoiceData.data_validation.field_status[field];
    return !fieldStatus || !fieldStatus.present;
  });
}
getDataQualityAssessment(): string {
  if (!this.invoiceData?.data_validation) return 'Unknown';
  
  const score = this.invoiceData.data_validation.completeness_score;
  if (score >= 95) return 'Excellent';
  if (score >= 85) return 'Very Good';
  if (score >= 75) return 'Good';
  if (score >= 65) return 'Fair';
  if (score >= 50) return 'Poor';
  return 'Very Poor';
}
getSenderDataCount(): number {
  if (!this.invoiceData?.sender) return 0;
  
  let count = 0;
  if (this.invoiceData.sender.company) count++;
  if (this.invoiceData.sender.address) count++;
  if (this.invoiceData.sender.phone) count++;
  if (this.invoiceData.sender.email) count++;
  
  return count;
}
getReceiverDataCount(): number {
  if (!this.invoiceData?.receiver) return 0;
  
  let count = 0;
  if (this.invoiceData.receiver.company) count++;
  if (this.invoiceData.receiver.address) count++;
  
  return count;
}
getFinancialDataCount(): number {
  if (!this.invoiceData) return 0;
  
  let count = 0;
  if (this.invoiceData.total_amount_incl_vat) count++;
  if (this.invoiceData.subtotal_amount_excl_vat) count++;
  if (this.invoiceData.vat_percentage) count++;
  if (this.invoiceData.items && this.invoiceData.items.length > 0) count++;
  
  return count;
}
getLegalDataCount(): number {
  if (!this.invoiceData) return 0;
  
  let count = 0;
  if (this.invoiceData.company?.country && this.invoiceData.company.country !== 'UNKNOWN') count++;
  if (this.invoiceData.company?.kvk_number) count++;
  if (this.invoiceData.company?.vat_number) count++;
  if (this.invoiceData.company?.logo?.found) count++;
  if (this.invoiceData.invoice?.number) count++;
  if (this.invoiceData.invoice?.date) count++;
  
  return count;
}
private processOcrResultsEnhanced(data: any): void {
  // Store the comprehensive invoice data
  this.invoiceData = data.JsonModalInvoice;
  
  // Process extracted fields for visualization
  if (data.JsonModalInvoice?.Fields) {
    this.extractedFields = data.JsonModalInvoice.Fields.map((f: any) => ({
      label: f.label,
      value: f.value,
      confidence: f.confidence ?? 1,
      position: f.position,
    }));
  } else if (Array.isArray(data.groupedData)) {
    const fields: OcrField[] = [];
    data.groupedData.forEach((group: any[]) => {
      group.forEach((item) => {
        fields.push({
          label: item.text,
          value: item.text,
          confidence: item.confidence ?? 1,
          position: {
            x: item.x,
            y: item.y,
            width: item.width || 100,
            height: item.height || 20,
          },
        });
      });
    });
    this.extractedFields = fields;
  }

  // Update statistics
  this.updateStats();
  
  // Log validation results for debugging
  if (this.invoiceData?.data_validation) {
    console.log('Invoice data validation:', this.invoiceData.data_validation);
    console.log(`Completeness: ${this.invoiceData.data_validation.completeness_score}%`);
    
    if (this.invoiceData.data_validation.missing_fields?.length > 0) {
      console.log('Missing fields:', this.invoiceData.data_validation.missing_fields);
    }
  }
}
exportInvoiceData(): void {
  if (!this.invoiceData) {
    console.warn('No invoice data to export');
    return;
  }

  const dataToExport = {
    extraction_date: new Date().toISOString(),
    file_name: this.selectedFile?.name,
    completeness_score: this.invoiceData.data_validation?.completeness_score,
    invoice_data: this.invoiceData
  };

  const dataStr = JSON.stringify(dataToExport, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoice_data_${new Date().getTime()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
private isValidCoordinate(item: any): boolean {
  const isValid = (
    typeof item.x === "number" &&
    typeof item.y === "number" &&
    !isNaN(item.x) &&
    !isNaN(item.y) &&
    item.x >= 0 &&
    item.y >= 0 &&
    item.text &&
    typeof item.text === "string" &&
    item.text.trim().length > 0
  );
  
  if (!isValid) {
    console.log('Invalid coordinate item:', item);
  }
  
  return isValid;
}

  private estimateTextWidth(text: string): number {
    if (!text) return 50

    // More accurate text width estimation
    const avgCharWidth = 9 // Average character width in pixels
    const padding = 10 // Add some padding

    return Math.max(text.length * avgCharWidth + padding, 50)
  }

  // 2. Improved field processing with better timing
 private handlePositionalData(data: any): void {
  console.log("Received positional data:", data);

  if (data.groupedData && Array.isArray(data.groupedData)) {
    // Store image dimensions if provided
    if (data.imageDimensions) {
      this.originalImageWidth = data.imageDimensions.width;
      this.originalImageHeight = data.imageDimensions.height;
      console.log("Image dimensions received:", this.originalImageWidth, this.originalImageHeight);
    }

    if (data.invoiceDetails) {
      this.invoiceData = data.invoiceDetails;
      console.log("Invoice details received:", this.invoiceData);
    }

    // Process new fields with better error handling
    const newFields: OcrField[] = [];
    let validFieldCount = 0;
    let invalidFieldCount = 0;
    
    data.groupedData.forEach((group: any[], groupIndex: number) => {
      if (Array.isArray(group)) {
        group.forEach((item: any, itemIndex: number) => {
          if (this.isValidCoordinate(item)) {
            try {
              // Transform coordinates properly
              const transformedPosition = this.transformCoordinates(item);
              
              const field: OcrField = {
                label: item.text || "Unknown",
                value: item.text || "",
                confidence: typeof item.confidence === 'number' ? item.confidence : 0.8,
                position: transformedPosition,
                isNew: true,
                animationPhase: 0,
              };
              
              newFields.push(field);
              validFieldCount++;
            } catch (error) {
              console.error(`Error transforming coordinates for item ${groupIndex}-${itemIndex}:`, error, item);
              invalidFieldCount++;
            }
          } else {
            invalidFieldCount++;
          }
        });
      }
    });

    console.log(`Processed ${validFieldCount} valid fields, ${invalidFieldCount} invalid fields`);

    // Replace fields for this processing step
    this.extractedFields = newFields;
    this.totalFieldsProcessed = this.extractedFields.length;

    // Update canvas with new fields
    this.updateCanvasRealTime();
    this.updateStats();
    this.cdr.detectChanges();
  }
}

private originalImageWidth: number = 0;
private originalImageHeight: number = 0;

// New method for real-time canvas updates
private updateCanvasRealTime(): void {
  if (!this.ctx || !this.canvas) return;

  // Redraw document base
  if (this.documentImage) {
    this.drawDocumentToCanvas(this.documentImage);
  } else if (this.selectedFile?.type === "application/pdf") {
    // For PDF, the canvas already has the rendered content
    // Just ensure we don't clear it unnecessarily
  }

  // Draw fields with real-time animation
  this.drawFieldOverlaysRealTime();
}
private drawFieldOverlaysRealTime(): void {
  if (!this.ctx || !this.canvas) return;

  this.extractedFields.forEach((field, index) => {
    if (field.position && this.shouldShowField(field)) {
      this.drawFieldBoxRealTime(field, index);
    }
  });
}

  private drawFieldBoxRealTime(field: OcrField, index: number): void {
    if (!this.ctx || !this.canvas || !field.position) return;

    const canvasX = field.position.x;
    const canvasY = field.position.y;
    const width = field.position.width;
    const height = field.position.height;

    // Strict bounds checking with some tolerance
    const tolerance = 50;
    const isWithinBounds = (
      canvasX >= -tolerance && 
      canvasY >= -tolerance && 
      canvasX < this.canvas.width + tolerance && 
      canvasY < this.canvas.height + tolerance &&
      width > 0 && height > 0
    );

    if (!isWithinBounds) {
      console.log(`Field ${index} outside bounds or invalid size:`, { 
        position: field.position,
        canvasBounds: { width: this.canvas.width, height: this.canvas.height },
        text: field.value
      });
      return;
    }

    // Calculate intersection with canvas to avoid drawing outside
    const drawX = Math.max(0, canvasX);
    const drawY = Math.max(0, canvasY);
    const drawWidth = Math.min(width, this.canvas.width - drawX);
    const drawHeight = Math.min(height, this.canvas.height - drawY);

    if (drawWidth <= 0 || drawHeight <= 0) {
      return; // Nothing to draw
    }

    // Visual styling
    let color = this.getConfidenceColor(field.confidence);
    let alpha = 0.8;
    let lineWidth = 2;

    // Animation effects for new fields
    if (field.isNew) {
      const time = Date.now() * 0.005;
      const pulse = Math.sin(time) * 0.3 + 0.7;
      alpha = 0.6 + 0.4 * pulse;
      lineWidth = 2 + Math.sin(time * 2) * 1;
      color = "#00ff88";
      
      // Remove new flag after animation
      setTimeout(() => {
        field.isNew = false;
        this.updateCanvasRealTime();
      }, 2000);
    }

    // Draw field box with effects
    this.ctx.save();
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = field.isNew ? 10 : 5;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.globalAlpha = alpha;
    
    // Draw border
    this.ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
    
    // Draw fill
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = alpha * 0.15;
    this.ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
    
    this.ctx.restore();

    // Draw labels if enabled and there's enough space
    if (this.showFieldLabels && drawWidth > 30 && drawHeight > 15) {
      this.drawRealTimeFieldLabels(field, index, drawX, drawY, drawWidth, drawHeight, color);
    }
  }


// Enhanced field labels for real-time updates
private drawRealTimeFieldLabels(
  field: OcrField,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  if (!this.ctx) return;

  // Field number badge with animation
  const badgeSize = 18;
  const badgeX = Math.max(x - badgeSize - 3, 0);
  const badgeY = y;

  // Animated badge for new fields
  if (field.isNew) {
    const time = Date.now() * 0.01;
    const scale = 1 + Math.sin(time) * 0.2;
    this.ctx.save();
    this.ctx.translate(badgeX + badgeSize/2, badgeY + badgeSize/2);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-badgeSize/2, -badgeSize/2);
  }

  // Draw circular badge
  this.ctx.fillStyle = color;
  this.ctx.beginPath();
  this.ctx.arc(badgeSize/2, badgeSize/2, badgeSize/2, 0, 2 * Math.PI);
  this.ctx.fill();

  // Badge number
  this.ctx.fillStyle = "#ffffff";
  this.ctx.font = "bold 10px Arial";
  this.ctx.textAlign = "center";
  this.ctx.fillText(`${index + 1}`, badgeSize/2, badgeSize/2 + 3);

  if (field.isNew) {
    this.ctx.restore();
  }

  // Confidence badge
  const confidenceText = `${Math.round(field.confidence * 100)}%`;
  this.ctx.font = "9px Arial";
  const textWidth = this.ctx.measureText(confidenceText).width;
  const confBadgeWidth = textWidth + 6;
  const confBadgeHeight = 12;
  const confBadgeX = x + width - confBadgeWidth;
  const confBadgeY = y - confBadgeHeight - 1;

  // Draw confidence badge
  this.ctx.fillStyle = color;
  this.ctx.fillRect(confBadgeX, confBadgeY, confBadgeWidth, confBadgeHeight);

  this.ctx.fillStyle = "#ffffff";
  this.ctx.textAlign = "center";
  this.ctx.fillText(confidenceText, confBadgeX + confBadgeWidth / 2, confBadgeY + 9);

  // Text content preview with better positioning
  if (field.value && width > 40 && height > 12) {
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    this.ctx.font = "10px Arial";
    this.ctx.textAlign = "left";

    let displayText = field.value.trim();
    const maxChars = Math.floor(width / 6);
    if (displayText.length > maxChars) {
      displayText = displayText.substring(0, maxChars - 3) + "...";
    }

    // Text background
    const textMetrics = this.ctx.measureText(displayText);
    const textBgWidth = Math.min(textMetrics.width + 4, width - 4);

    this.ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    this.ctx.fillRect(x + 2, y + height - 14, textBgWidth, 12);

    this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    this.ctx.fillText(displayText, x + 4, y + height - 4);
  }
}


  private convertTableToPixelCoordinates(item: any): { x: number; y: number; width: number; height: number } {
    if (!this.documentMapping) {
      return {
        x: item.x * 50, // Fallback scaling
        y: item.y * 25,
        width: item.width || this.estimateTextWidth(item.text),
        height: item.height || 20,
      }
    }

    const mapping = this.documentMapping

    // Convert table cell coordinates to pixel coordinates
    const pixelX = mapping.startX + item.x * mapping.cellWidth
    const pixelY = mapping.startY + item.y * mapping.cellHeight

    // Calculate width based on text length or use cell width
    const textWidth = this.estimateTextWidth(item.text)
    const width = Math.min(textWidth, mapping.cellWidth * 0.9) // Don't exceed cell width
    const height = Math.min(item.height || 20, mapping.cellHeight * 0.8)

    return {
      x: pixelX,
      y: pixelY,
      width,
      height,
    }
  }

  private analyzeCoordinateSystem(groupedData: any[]): void {
    const coordinates: { x: number; y: number }[] = []

    groupedData.forEach((group: any[]) => {
      group.forEach((item: any) => {
        if (typeof item.x === "number" && typeof item.y === "number") {
          coordinates.push({ x: item.x, y: item.y })
        }
      })
    })

    if (coordinates.length === 0) return

    // Check if coordinates look like table indices (small integers)
    const maxX = Math.max(...coordinates.map((c) => c.x))
    const maxY = Math.max(...coordinates.map((c) => c.y))
    const minX = Math.min(...coordinates.map((c) => c.x))
    const minY = Math.min(...coordinates.map((c) => c.y))

    // If coordinates are small integers (likely table cells), treat as table-based
    this.isTableBasedData = maxX < 50 && maxY < 50 && minX >= 0 && minY >= 0

    if (this.isTableBasedData) {
      console.log("Detected table-based coordinate system")
      this.createDocumentMapping(coordinates, maxX, maxY, minX, minY)
    } else {
      console.log("Detected pixel-based coordinate system")
      this.documentMapping = null
    }
  }

  private createDocumentMapping(
    coordinates: { x: number; y: number }[],
    maxX: number,
    maxY: number,
    minX: number,
    minY: number,
  ): void {
    if (!this.documentWidth || !this.documentHeight) {
      console.warn("Document dimensions not available for mapping")
      return
    }

    // Estimate table structure
    const tableColumns = maxX - minX + 1
    const tableRows = maxY - minY + 1

    // Calculate cell dimensions based on document size
    // Leave margins and account for headers/footers
    const marginX = this.documentWidth * 0.1 // 10% margin
    const marginY = this.documentHeight * 0.15 // 15% margin for headers

    const availableWidth = this.documentWidth - 2 * marginX
    const availableHeight = this.documentHeight - 2 * marginY

    const cellWidth = availableWidth / tableColumns
    const cellHeight = availableHeight / tableRows

    this.documentMapping = {
      cellWidth,
      cellHeight,
      startX: this.documentOffsetX + marginX,
      startY: this.documentOffsetY + marginY,
      tableRows,
      tableColumns,
    }

    console.log("Document mapping created:", this.documentMapping)
  }

  private updateCanvasWithNewFields(newFields: OcrField[]): void {
    if (!this.ctx || !this.canvas) return;

    // Always redraw the base document (PDF or image)
    if (this.documentImage) {
      this.drawDocumentToCanvas(this.documentImage);
    }

    // Draw all existing fields
    this.drawFieldOverlays();

    // Animate new fields with a pulsing effect
    newFields.forEach((field, index) => {
      this.animateFieldAppearance(field, Date.now());
    });
  }
  private animateFieldAppearance(field: OcrField, startTime: number): void {
    if (!field.position) return

    const animate = () => {
      const elapsed = Date.now() - startTime
      const duration = 1000 // 1 second animation

      if (elapsed >= duration) {
        field.isNew = false
        field.animationPhase = 1
        return
      }

      // Smooth easing function
      const progress = elapsed / duration
      field.animationPhase = 1 - Math.pow(1 - progress, 3) // Ease-out cubic

      // Redraw with animation
      if (this.documentImage) {
        this.drawDocumentToCanvas(this.documentImage)
        this.drawFieldOverlays()
      }

      requestAnimationFrame(animate)
    }

    animate()
  }

  private handleProcessingComplete(data: any): void {
    this.isProcessing = false
    this.processingAnimation = false
    this.processingComplete = true
    this.ocrProgress = 100
    this.currentProcessingStep = "Processing complete!"

    this.processOcrResults(data)
    this.drawFinalResults()
    this.cdr.detectChanges()
  }
  logAllExtractedData(): void {
  if (!this.invoiceData) {
    console.log('No invoice data available');
    return;
  }

  console.group('📋 Complete Invoice Data Extraction');
  
  console.log('1. Sender Information:', {
    company: this.invoiceData.sender?.company || 'Not found',
    address: this.invoiceData.sender?.address || 'Not found',
    phone: this.invoiceData.sender?.phone || 'Not found',
    email: this.invoiceData.sender?.email || 'Not found',
    website: this.invoiceData.sender?.website || 'Not found'
  });

  console.log('2. Receiver Information:', {
    company: this.invoiceData.receiver?.company || 'Not found',
    address: this.invoiceData.receiver?.address || 'Not found'
  });

  console.log('3. Country:', this.invoiceData.company?.country || 'Unknown');

  console.log('4. Company Logo:', {
    found: this.invoiceData.company?.logo?.found || false,
    estimated_position: this.invoiceData.company?.logo?.estimated_position || null
  });

  console.log('5. Company Registration Number:', this.invoiceData.company?.kvk_number || 'Not found');

  console.log('6-7. VAT/BTW Number:', this.invoiceData.company?.vat_number || 'Not found');

  console.log('8. Invoice Date:', this.invoiceData.invoice?.date || 'Not found');

  console.log('9. Invoice Number:', this.invoiceData.invoice?.number || 'Not found');

  console.log('10. Payment Status:', {
    paid: this.invoiceData.invoice?.paid,
    method: this.invoiceData.invoice?.payment_method || 'Not specified',
    confidence: this.invoiceData.invoice?.payment_confidence || 0
  });

  console.log('11. Total Amount (incl. VAT):', this.invoiceData.total_amount_incl_vat || 'Not found');

  console.log('12. Subtotal (excl. VAT):', this.invoiceData.subtotal_amount_excl_vat || 'Not found');

  console.log('13. VAT Percentage:', this.invoiceData.vat_percentage ? `${this.invoiceData.vat_percentage}%` : 'Not found');

  console.log('14. Invoice Items:', {
    count: this.invoiceData.items?.length || 0,
    items: this.invoiceData.items || 'No items found'
  });

  console.log('15. IBAN Number:', this.invoiceData.bank?.iban || 'Not found');

  console.log('16. Bank Account Holder:', this.invoiceData.bank?.account_holder || 'Not found');

  console.log('Data Validation Summary:', this.invoiceData.data_validation);

  console.groupEnd();
}
validateAllDataPoints(): { valid: number, total: number, missing: string[] } {
  const dataPoints = [
    { key: 'sender.company', name: '1. Sender Company' },
    { key: 'receiver.company', name: '2. Receiver Company' },
    { key: 'company.country', name: '3. Country' },
    { key: 'company.logo.found', name: '4. Logo' },
    { key: 'company.kvk_number', name: '5. Company Registration' },
    { key: 'company.vat_number', name: '6-7. VAT Number' },
    { key: 'invoice.date', name: '8. Invoice Date' },
    { key: 'invoice.number', name: '9. Invoice Number' },
    { key: 'invoice.paid', name: '10. Payment Status' },
    { key: 'total_amount_incl_vat', name: '11. Total Amount' },
    { key: 'subtotal_amount_excl_vat', name: '12. Subtotal' },
    { key: 'vat_percentage', name: '13. VAT Percentage' },
    { key: 'items', name: '14. Invoice Items' },
    { key: 'bank.iban', name: '15. IBAN' },
    { key: 'bank.account_holder', name: '16. Account Holder' }
  ];

  let validCount = 0;
  const missing: string[] = [];

  dataPoints.forEach(point => {
    const value = this.getNestedValue(this.invoiceData, point.key);
    let isValid = false;

    if (point.key === 'items') {
      isValid = Array.isArray(value) && value.length > 0;
    } else if (point.key === 'company.logo.found') {
      isValid = value === true;
    } else if (point.key === 'invoice.paid') {
      isValid = typeof value === 'boolean';
    } else {
      isValid = value !== null && value !== undefined && value !== '' && value !== 'UNKNOWN';
    }

    if (isValid) {
      validCount++;
    } else {
      missing.push(point.name);
    }
  });

  return {
    valid: validCount,
    total: dataPoints.length,
    missing
  };
}
private getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

  private handleProcessingError(error: any): void {
    this.isProcessing = false
    this.processingAnimation = false
    this.processingComplete = false
    console.error("Processing failed:", error)

    if (this.documentImage) {
      this.drawDocumentToCanvas(this.documentImage)
    }

    // Show error message on canvas
    if (this.ctx && this.canvas) {
      this.ctx.fillStyle = "rgba(220, 53, 69, 0.9)"
      this.ctx.fillRect(0, 0, this.canvas.width, 60)
      this.ctx.fillStyle = "#ffffff"
      this.ctx.font = "bold 16px Arial"
      this.ctx.textAlign = "center"
      this.ctx.fillText("❌ Processing failed. Please try again.", this.canvas.width / 2, 35)
    }

    this.cdr.detectChanges()
  }

  private processNewFieldsQueue(): void {
    if (this.newFieldsQueue.length === 0) return

    // Animate fields one by one for real-time effect
    const processNext = () => {
      if (this.newFieldsQueue.length === 0) return
      const field = this.newFieldsQueue.shift()
      if (field) {
        this.extractedFields.push(field)
        this.totalFieldsProcessed++
        this.animateNewField(field, this.extractedFields.length - 1)
        this.updateStats()
        // Redraw after each field is added
        if (this.documentImage) {
          this.drawDocumentToCanvas(this.documentImage)
          this.drawFieldOverlays()
        }
        // Animate next field after a short delay
        setTimeout(processNext, 350)
      }
    }
    processNext()
  }

  private animateNewField(field: OcrField, index: number): void {
    if (!field.position) return

    let animationFrame = 0
    const maxFrames = 20

    const animate = () => {
      if (animationFrame >= maxFrames) {
        field.isNew = false
        this.fieldAnimations.delete(index)
        return
      }

      field.animationPhase = animationFrame / maxFrames
      this.fieldAnimations.set(index, animationFrame)

      if (this.documentImage) {
        this.drawDocumentToCanvas(this.documentImage)
        this.drawFieldOverlays()
        this.drawProcessingProgress()
      }

      animationFrame++
      requestAnimationFrame(animate)
    }

    animate()
  }

  private startProcessingAnimation(): void {
    if (!this.processingAnimation) return
    this.animateProcessing()
  }

  private animateProcessing(): void {
  if (!this.processingAnimation || !this.ctx || !this.canvas) return;

  // Redraw document base
  if (this.documentImage) {
    this.drawDocumentToCanvas(this.documentImage);
  }

  // Draw current fields with animation
  this.drawFieldOverlaysRealTime();

  // Draw scanning animation
  this.drawScanningAnimation();

  // Draw progress overlay
  this.drawProcessingProgress();

  this.animationFrameId = requestAnimationFrame(() => this.animateProcessing());
}



  private drawScanningAnimation(): void {
    if (!this.ctx || !this.canvas || !this.documentImage) return

    const time = Date.now() * 0.002
    const scanProgress = (Math.sin(time) + 1) / 2 // 0 to 1

    // Vertical scanning line
    const scanY = this.documentOffsetY + scanProgress * this.documentHeight

    // Draw scanning line with glow effect
    this.ctx.shadowColor = "#007bff"
    this.ctx.shadowBlur = 10
    this.ctx.strokeStyle = "#007bff"
    this.ctx.lineWidth = 3
    this.ctx.globalAlpha = 0.8

    this.ctx.beginPath()
    this.ctx.moveTo(this.documentOffsetX, scanY)
    this.ctx.lineTo(this.documentOffsetX + this.documentWidth, scanY)
    this.ctx.stroke()

    // Reset shadow and alpha
    this.ctx.shadowColor = "transparent"
    this.ctx.shadowBlur = 0
    this.ctx.globalAlpha = 1

    // Draw scanned area overlay
    this.ctx.fillStyle = "rgba(0, 123, 255, 0.05)"
    this.ctx.fillRect(this.documentOffsetX, this.documentOffsetY, this.documentWidth, scanY - this.documentOffsetY)
  }

  private drawProcessingProgress(): void {
    if (!this.ctx || !this.canvas) return

    // Progress overlay background
    const overlayHeight = 80
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.85)"
    this.ctx.fillRect(0, 0, this.canvas.width, overlayHeight)

    // Progress text
    this.ctx.fillStyle = "#ffffff"
    this.ctx.font = "bold 16px Arial"
    this.ctx.textAlign = "center"
    this.ctx.fillText(this.currentProcessingStep, this.canvas.width / 2, 25)

    // Progress bar
    const progressBarWidth = this.canvas.width - 60
    const progressBarHeight = 20
    const progressBarX = 30
    const progressBarY = 35

    // Progress bar background
    this.ctx.fillStyle = "#333333"
    this.ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight)

    // Progress bar fill
    const progressWidth = (progressBarWidth * this.ocrProgress) / 100
    const gradient = this.ctx.createLinearGradient(progressBarX, 0, progressBarX + progressWidth, 0)
    gradient.addColorStop(0, "#007bff")
    gradient.addColorStop(1, "#0056b3")
    this.ctx.fillStyle = gradient
    this.ctx.fillRect(progressBarX, progressBarY, progressWidth, progressBarHeight)

    // Progress bar border
    this.ctx.strokeStyle = "#6c757d"
    this.ctx.lineWidth = 1
    this.ctx.strokeRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight)

    // Progress percentage and field count
    this.ctx.fillStyle = "#ffffff"
    this.ctx.font = "12px Arial"
    this.ctx.fillText(
      `${Math.round(this.ocrProgress)}% - ${this.totalFieldsProcessed} fields discovered`,
      this.canvas.width / 2,
      progressBarY + progressBarHeight + 15,
    )
  }

  private drawFieldOverlays(): void {
    if (!this.ctx || !this.canvas || !this.documentImage) return

    this.extractedFields.forEach((field, index) => {
      if (field.position && this.shouldShowField(field)) {
        this.drawFieldBox(field, index)
      }
    })
  }
public getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return "#28a745" // High confidence - green
  if (confidence >= 0.7) return "#17a2b8" // Good confidence - blue
  if (confidence >= 0.5) return "#ffc107" // Medium confidence - yellow
  if (confidence >= 0.3) return "#fd7e14" // Low confidence - orange
  return "#dc3545" // Very low confidence - red
}

  private shouldShowField(field: OcrField): boolean {
    return field.confidence * 100 >= this.confidenceFilter
  }

  private drawFieldBox(field: OcrField, index: number): void {
    if (!this.ctx || !this.canvas || !field.position) return

    // Use the transformed coordinates directly (already converted from table to pixels)
    let canvasX = field.position.x
    let canvasY = field.position.y
    let width = field.position.width || 100
    let height = field.position.height || 20

    // For PDF files, coordinates might need additional offset adjustment
    if (this.selectedFile?.type === "application/pdf") {
      // Coordinates are already in document space, just ensure they're within bounds
    } else if (this.documentImage) {
      // For images, coordinates might need scaling if not already handled
      if (!this.isTableBasedData) {
        canvasX = field.position.x * this.scaleFactor + this.documentOffsetX
        canvasY = field.position.y * this.scaleFactor + this.documentOffsetY
        width = (field.position.width || 100) * this.scaleFactor
        height = (field.position.height || 20) * this.scaleFactor
      }
    }

    // Bounds checking
    if (
      canvasX < this.documentOffsetX ||
      canvasY < this.documentOffsetY ||
      canvasX > this.documentOffsetX + this.documentWidth ||
      canvasY > this.documentOffsetY + this.documentHeight
    ) {
      console.log(`Field ${index} outside bounds:`, { canvasX, canvasY, width, height })
      return
    }

    // Enhanced visual styling
    let color = this.getConfidenceColor(field.confidence)
    let alpha = 0.8
    let lineWidth = 2
    let glowIntensity = 0

    // Animation effects for new fields
    if (field.isNew && field.animationPhase !== undefined) {
      const phase = field.animationPhase

      // Pulsing effect with smooth animation
      const pulseIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7
      alpha = 0.5 + 0.5 * phase * pulseIntensity
      lineWidth = 2 + 3 * (1 - phase)
      glowIntensity = 15 * (1 - phase)

      // Bright highlight color for new fields
      color = "#00ff88"
    }

    // Draw with glow effect
    if (glowIntensity > 0 || field.isHighlighted) {
      this.ctx.shadowColor = color
      this.ctx.shadowBlur = glowIntensity || 8
    }

    // Draw main bounding box
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = lineWidth
    this.ctx.globalAlpha = alpha
    this.ctx.strokeRect(canvasX, canvasY, width, height)

    // Draw semi-transparent fill
    this.ctx.fillStyle = color
    this.ctx.globalAlpha = alpha * 0.2
    this.ctx.fillRect(canvasX, canvasY, width, height)

    // Reset effects
    this.ctx.shadowColor = "transparent"
    this.ctx.shadowBlur = 0
    this.ctx.globalAlpha = 1

    // Draw labels and info
    if (this.showFieldLabels) {
      this.drawEnhancedFieldLabels(field, index, canvasX, canvasY, width, height, color)
    }
  }

  private drawEnhancedFieldLabels(
    field: OcrField,
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ): void {
    if (!this.ctx) return

    // Field number badge
    const badgeSize = 18
    const badgeX = Math.max(x - badgeSize - 3, 0)
    const badgeY = y

    // Draw circular badge
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, 2 * Math.PI)
    this.ctx.fill()

    // Badge number
    this.ctx.fillStyle = "#ffffff"
    this.ctx.font = "bold 10px Arial"
    this.ctx.textAlign = "center"
    this.ctx.fillText(`${index + 1}`, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 3)

    // Confidence badge
    const confidenceText = `${Math.round(field.confidence * 100)}%`
    this.ctx.font = "9px Arial"
    const textWidth = this.ctx.measureText(confidenceText).width
    const confBadgeWidth = textWidth + 6
    const confBadgeHeight = 12
    const confBadgeX = x + width - confBadgeWidth
    const confBadgeY = y - confBadgeHeight - 1

    // Draw confidence badge with rounded corners
    this.ctx.fillStyle = color
    this.ctx.fillRect(confBadgeX, confBadgeY, confBadgeWidth, confBadgeHeight)

    this.ctx.fillStyle = "#ffffff"
    this.ctx.textAlign = "center"
    this.ctx.fillText(confidenceText, confBadgeX + confBadgeWidth / 2, confBadgeY + 9)

    // Text content preview
    if (field.value && width > 40 && height > 12) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)"
      this.ctx.font = "10px Arial"
      this.ctx.textAlign = "left"

      let displayText = field.value.trim()
      const maxChars = Math.floor(width / 6)
      if (displayText.length > maxChars) {
        displayText = displayText.substring(0, maxChars - 3) + "..."
      }

      // Semi-transparent background for text
      const textMetrics = this.ctx.measureText(displayText)
      const textBgWidth = Math.min(textMetrics.width + 4, width - 4)

      this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
      this.ctx.fillRect(x + 2, y + height - 14, textBgWidth, 12)

      this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)"
      this.ctx.fillText(displayText, x + 4, y + height - 4)
    }
  }

  private debugCoordinateMapping(): void {
    if (!this.ctx || !this.documentMapping) return

    const mapping = this.documentMapping

    // Draw grid lines to visualize table structure
    this.ctx.strokeStyle = "rgba(255, 0, 0, 0.3)"
    this.ctx.lineWidth = 1

    // Vertical lines
    for (let col = 0; col <= mapping.tableColumns; col++) {
      const x = mapping.startX + col * mapping.cellWidth
      this.ctx.beginPath()
      this.ctx.moveTo(x, mapping.startY)
      this.ctx.lineTo(x, mapping.startY + mapping.tableRows * mapping.cellHeight)
      this.ctx.stroke()
    }

    // Horizontal lines
    for (let row = 0; row <= mapping.tableRows; row++) {
      const y = mapping.startY + row * mapping.cellHeight
      this.ctx.beginPath()
      this.ctx.moveTo(mapping.startX, y)
      this.ctx.lineTo(mapping.startX + mapping.tableColumns * mapping.cellWidth, y)
      this.ctx.stroke()
    }
  }
  // 6. Add debug mode toggle
public debugMode = false

public toggleDebugMode(): void {
  this.debugMode = !this.debugMode
  console.log('Debug mode:', this.debugMode)
  
  if (this.debugMode) {
    console.log('Current state:', {
      canvasSize: { width: this.canvasWidth, height: this.canvasHeight },
      documentSize: { width: this.documentWidth, height: this.documentHeight },
      documentOffset: { x: this.documentOffsetX, y: this.documentOffsetY },
      scaleFactor: this.scaleFactor,
      fieldCount: this.extractedFields.length,
      isProcessing: this.isProcessing
    })
  }
  
  this.updateCanvasRealTime()
}



  private drawFieldLabels(
    field: OcrField,
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ): void {
    if (!this.ctx) return

    // Field number badge
    const badgeSize = 20
    const badgeX = x - badgeSize - 5
    const badgeY = y

    // Draw badge background
    this.ctx.fillStyle = color
    this.ctx.fillRect(badgeX, badgeY, badgeSize, badgeSize)

    // Draw badge text
    this.ctx.fillStyle = "#ffffff"
    this.ctx.font = "bold 10px Arial"
    this.ctx.textAlign = "center"
    this.ctx.fillText(`${index + 1}`, badgeX + badgeSize / 2, badgeY + 13)

    // Confidence badge
    const confidenceText = `${Math.round(field.confidence * 100)}%`
    const confTextMetrics = this.ctx.measureText(confidenceText)
    const confBadgeWidth = confTextMetrics.width + 8
    const confBadgeHeight = 14
    const confBadgeX = x + width - confBadgeWidth
    const confBadgeY = y - confBadgeHeight - 2

    // Draw confidence badge
    this.ctx.fillStyle = color
    this.ctx.fillRect(confBadgeX, confBadgeY, confBadgeWidth, confBadgeHeight)

    this.ctx.fillStyle = "#ffffff"
    this.ctx.font = "bold 9px Arial"
    this.ctx.textAlign = "center"
    this.ctx.fillText(confidenceText, confBadgeX + confBadgeWidth / 2, confBadgeY + 10)

    // Text preview inside the box
    if (field.value && width > 60 && height > 15) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
      this.ctx.font = "11px Arial"
      this.ctx.textAlign = "left"

      let displayText = field.value.trim()
      const maxChars = Math.floor(width / 7)
      if (displayText.length > maxChars) {
        displayText = displayText.substring(0, maxChars - 3) + "..."
      }

      // Draw text with background for better readability
      const textX = x + 4
      const textY = y + height - 4

      this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
      this.ctx.fillRect(textX - 2, textY - 12, this.ctx.measureText(displayText).width + 4, 14)

      this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)"
      this.ctx.fillText(displayText, textX, textY)
    }
  }

  private fieldUpdateQueue: OcrField[] = []
  private fieldUpdateTimer: any = null

  private fillRoundedRect(x: number, y: number, width: number, height: number, radius: number): void {
    if (!this.ctx) return

    this.ctx.beginPath()
    this.ctx.moveTo(x + radius, y)
    this.ctx.lineTo(x + width - radius, y)
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    this.ctx.lineTo(x + width, y + height - radius)
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    this.ctx.lineTo(x + radius, y + height)
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    this.ctx.lineTo(x, y + radius)
    this.ctx.quadraticCurveTo(x, y, x + radius, y)
    this.ctx.closePath()
    this.ctx.fill()
  }
  private handlePositionalDataBatched(data: any): void {
    if (data.groupedData) {
      const newFields: OcrField[] = []

      data.groupedData.forEach((group: any[]) => {
        group.forEach((item: any) => {
          if (this.isValidCoordinate(item)) {
            const field: OcrField = {
              label: item.text || "Unknown",
              value: item.text || "",
              confidence: item.confidence ?? 0.8,
              position: {
                x: item.x,
                y: item.y,
                width: item.width || this.estimateTextWidth(item.text),
                height: item.height || 20,
              },
              isNew: true,
              animationPhase: 0,
            }
            newFields.push(field)
          }
        })
      })

      // Add to queue for batched processing
      this.fieldUpdateQueue.push(...newFields)

      // Debounce updates to avoid too frequent redraws
      if (this.fieldUpdateTimer) {
        clearTimeout(this.fieldUpdateTimer)
      }

      this.fieldUpdateTimer = setTimeout(() => {
        this.processFieldUpdateQueue()
      }, 100) // Process every 100ms
    }
  }

  private processFieldUpdateQueue(): void {
    if (this.fieldUpdateQueue.length === 0) return

    // Add all queued fields
    this.extractedFields.push(...this.fieldUpdateQueue)
    this.totalFieldsProcessed = this.extractedFields.length

    // Animate the new fields
    const newFields = [...this.fieldUpdateQueue]
    this.fieldUpdateQueue = []

    this.updateCanvasWithNewFields(newFields)
    this.updateStats()
    this.cdr.detectChanges()
  }
  private drawRoundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: string,
    lineWidth: number,
  ): void {
    if (!this.ctx) return

    this.ctx.beginPath()
    this.ctx.moveTo(x + radius, y)
    this.ctx.lineTo(x + width - radius, y)
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    this.ctx.lineTo(x + width, y + height - radius)
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    this.ctx.lineTo(x + radius, y + height)
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    this.ctx.lineTo(x, y + radius)
    this.ctx.quadraticCurveTo(x, y, x + radius, y)
    this.ctx.closePath()

    this.ctx.strokeStyle = color
    this.ctx.lineWidth = lineWidth
    this.ctx.stroke()
  }

  private drawFinalResults(): void {
    if (!this.ctx || !this.canvas || !this.documentImage) return

    this.drawDocumentToCanvas(this.documentImage)
    this.drawFieldOverlays()

    // Draw completion banner
    const bannerHeight = 60
    this.ctx.fillStyle = "rgba(40, 167, 69, 0.95)"
    this.ctx.fillRect(0, 0, this.canvas.width, bannerHeight)

    this.ctx.fillStyle = "#ffffff"
    this.ctx.font = "bold 18px Arial"
    this.ctx.textAlign = "center"
    this.ctx.fillText("✓ OCR Processing Complete!", this.canvas.width / 2, 25)

    this.ctx.font = "14px Arial"
    this.ctx.fillText(
      `${this.totalFieldsProcessed} fields extracted • ${Math.round(this.avgConfidencePercent)}% average confidence`,
      this.canvas.width / 2,
      45,
    )
  }

  private processOcrResults(data: any): void {
    if (data.JsonModalInvoice?.Fields) {
      this.extractedFields = data.JsonModalInvoice.Fields.map((f: any) => ({
        label: f.label,
        value: f.value,
        confidence: f.confidence ?? 1,
        position: f.position,
      }))
    } else if (Array.isArray(data.groupedData)) {
      const fields: OcrField[] = []
      data.groupedData.forEach((group: any[]) => {
        group.forEach((item) => {
          fields.push({
            label: item.text,
            value: item.text,
            confidence: item.confidence ?? 1,
            position: {
              x: item.x,
              y: item.y,
              width: item.width || 100,
              height: item.height || 20,
            },
          })
        })
      })
      this.extractedFields = fields
    }

    this.updateStats()
  }

  private updateStats(): void {
    this.totalFieldsProcessed = this.extractedFields.length
    this.highConfidenceCount = this.extractedFields.filter((f) => f.confidence > 0.8).length
  }

  private getStepProgress(step: string): number {
    const stepProgressMap: { [key: string]: number } = {
      convert_pdf: 15,
      ocr: 30,
      parse_pdf: 40,
      extract_text: 50,
      process_data: 60,
      group_data: 70,
      extract_header: 75,
      extract_items: 80,
      extract_total: 85,
      extract_sender_receiver: 90,
      map_items: 95,
      finalize: 100,
    }

    return stepProgressMap[step] || 0
  }

  private getStepLabel(step: string): string {
    const stepLabels: { [key: string]: string } = {
      convert_pdf: "Converting PDF to image format",
      ocr: "Performing optical character recognition",
      parse_pdf: "Parsing document structure",
      extract_text: "Extracting text with position data",
      process_data: "Processing extracted information",
      group_data: "Grouping related text elements",
      extract_header: "Identifying header information",
      extract_items: "Extracting line items",
      extract_total: "Finding totals and amounts",
      extract_sender_receiver: "Identifying parties",
      map_items: "Mapping data to fields",
      finalize: "Finalizing extraction results",
    }

    return stepLabels[step] || "Processing document"
  }

  // Canvas interaction methods
// Enhanced click detection with proper coordinate mapping
onCanvasClick(event: MouseEvent): void {
  if (!this.canvas || this.isProcessing) return;

  const rect = this.canvas.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;

  console.log(`Canvas clicked at: (${clickX}, ${clickY})`);

  // Find clicked field with better hit detection
  const clickedField = this.findFieldAtPosition(clickX, clickY);
  if (clickedField) {
    console.log('Clicked field:', clickedField);
    this.showFieldDetails(clickedField);
  } else {
    console.log('No field found at click position');
  }
}

private findFieldAtPosition(x: number, y: number): OcrField | null {
  for (let i = 0; i < this.extractedFields.length; i++) {
    const field = this.extractedFields[i];
    if (!field.position) continue;

    // Use the already transformed coordinates from the field position
    const fieldX = field.position.x;
    const fieldY = field.position.y;
    const fieldWidth = field.position.width;
    const fieldHeight = field.position.height;

    // Add some padding for easier clicking
    const padding = 5;
    
    if (x >= fieldX - padding && 
        x <= fieldX + fieldWidth + padding && 
        y >= fieldY - padding && 
        y <= fieldY + fieldHeight + padding) {
      console.log(`Found field at position: Field ${i}, bounds: (${fieldX}, ${fieldY}, ${fieldWidth}, ${fieldHeight})`);
      return field;
    }
  }
  return null;
}

private showFieldDetails(field: OcrField): void {
  // Ensure field has valid position before showing details
  if (!field.position) {
    console.warn('Field selected without position data:', field);
    return;
  }
  
  this.selectedField = field
  this.showFieldModal = true

  // Highlight the selected field
  this.extractedFields.forEach((f) => (f.isHighlighted = false))
  field.isHighlighted = true

  if (this.documentImage) {
    this.drawDocumentToCanvas(this.documentImage)
    this.drawFieldOverlays()
  }
}


  closeFieldModal(): void {
    this.showFieldModal = false
    this.selectedField = null

    // Remove highlighting
    this.extractedFields.forEach((f) => (f.isHighlighted = false))

    if (this.documentImage) {
      this.drawDocumentToCanvas(this.documentImage)
      this.drawFieldOverlays()
    }
  }

  // UI control methods
  clearCanvas(): void {
    if (this.documentImage) {
      this.drawDocumentToCanvas(this.documentImage)
    } else {
      this.drawEmptyState()
    }
  }

  toggleFieldLabels(): void {
    this.showFieldLabels = !this.showFieldLabels
    if (this.documentImage) {
      this.drawDocumentToCanvas(this.documentImage)
      this.drawFieldOverlays()
    }
  }

  toggleConfidenceFilter(): void {
    const filters = [0, 50, 70, 90]
    const currentIndex = filters.indexOf(this.confidenceFilter)
    this.confidenceFilter = filters[(currentIndex + 1) % filters.length]

    if (this.documentImage) {
      this.drawDocumentToCanvas(this.documentImage)
      this.drawFieldOverlays()
    }
  }

  // Template helper methods
  getHighConfidenceCount(): number {
    return this.extractedFields.filter((f) => f.confidence > 0.8).length
  }

  get avgConfidencePercent(): number {
    if (this.extractedFields.length === 0) return 0
    const total = this.extractedFields.map((f) => f.confidence).reduce((sum, c) => sum + c, 0)
    return (total / this.extractedFields.length) * 100
  }
}

export default InboxPage
