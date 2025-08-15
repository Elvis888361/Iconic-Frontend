import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

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
}

interface InvoiceData {
  supplier: string;
  items: string;
  quantity: string;
  amount: string;
  date: string;
}

interface PurchaseData {
  item: string;
  description: string;
  supplier: string;
  date: string;
  count: number;
  amount: string;
  logo: string;
  logoColor: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  // State management
  totalAmount: number = 150;
  isLoading: boolean = false;
  loadingMessage: string = 'Laden...';
  showInfoCard: boolean = true;
  uploadCardHovered: boolean = false;
  hasInvoices: boolean = true; // Toggle between states
  toastMessages: ToastMessage[] = [];
  toastCounter: number = 0;
  showFacturenTable: boolean = false;
  showAankopenTable: boolean = false; // New state for purchases modal
  showProjectenTable: boolean = false; // New state for projects modal

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
    'EXACT', 'AFAS', 'B-CASH', 'KING',
    'snelstart', 'Asperion', 'KING', 'e-Boekhouden',
    'informer', 'Minox', 'yuki', '+'
  ];

  // Workflow features
  workflowFeatures: string[] = [
    'Al je facturen zijn direct inzichtelijk',
    'Nooit meer in je mailbox zoeken naar facturen',
    'Alle aankopen en totaalbedragen zijn direct zichtbaar'
  ];

  // Invoice data for populated state
  invoiceData: InvoiceData = {
    supplier: 'Bouwmaat Haarlem',
    items: 'Houten balken 138*38mm',
    quantity: '2 stuks',
    amount: '€150,-',
    date: 'Net ontvangen, vandaag 12:05'
  };

  // Facturen table data
  facturenTableData = [
    {
      supplier: 'Bouwmaat Haarlem',
      logo: 'BM',
      logoColor: '#3b82f6',
      status: 'terug',
      invoices: [
        { date: '21 oktober ontvangen, 22:05', count: 1, amount: '€150,-' },
        { date: '21 september ontvangen, 22:05', count: 1, amount: '€12,-' },
        { date: '11 januari ontvangen, 22:05', count: 1, amount: '€550,-' },
        { date: '01 januari ontvangen, 22:05', count: 1, amount: '€660,-' }
      ],
      totalCount: 4,
      totalAmount: '€1.302,-'
    },
    {
      supplier: 'T-Mobile',
      logo: 'T',
      logoColor: '#e91e63',
      status: 'meest betaald',
      invoices: [
        { date: '21 oktober ontvangen, 22:05', count: 1, amount: '€50,-' }
      ],
      totalCount: 2,
      totalAmount: '€80,-'
    }
  ];

  // New: Aankopen table data
  aankopenTableData = [
    {
      item: 'Houten balken 138*38mm',
      description: 'artikelnr. 123456, gekocht bij bouwmaat haarlem',
      purchases: [
        { date: '21 oktober ontvangen, 22:05', count: 1, amount: '€80,-', supplier: 'Bouwmaat Haarlem' },
        { date: '21 september ontvangen, 22:05', count: 2, amount: '€150,-', supplier: 'Bouwmaat Haarlem' },
        { date: '11 januari ontvangen, 22:05', count: 1, amount: '€2000,-', supplier: 'Bouwmaat Haarlem' }
      ],
      totalCount: 4,
      totalAmount: '€2230,-',
      logo: 'BM',
      logoColor: '#3b82f6'
    }
  ];

  // New: Projecten table data
  projectenTableData = [
    {
      project: 'Houten balken 138*38mm',
      description: 'artikelnr. 123456, gekocht bij bouwmaat haarlem',
      items: [
        { date: '21 oktober ontvangen, 22:05', count: 1, amount: '€80,-', supplier: 'Bouwmaat Haarlem' },
        { date: '21 september ontvangen, 22:05', count: 2, amount: '€150,-', supplier: 'Bouwmaat Haarlem' },
        { date: '11 januari ontvangen, 22:05', count: 1, amount: '€2000,-', supplier: 'Bouwmaat Haarlem' }
      ],
      totalCount: 4,
      totalAmount: '€2230,-',
      logo: 'BM',
      logoColor: '#3b82f6'
    }
  ];

  constructor(
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    // Any initialization logic can go here
  }

  // Navigation handler
  onNavigationClick(item: NavigationItem): void {
    this.navigationItems.forEach(nav => nav.active = false);
    item.active = true;

    console.log(`Navigating to: ${item.label}`, item);

    if (item.route) {
      this.router.navigate([item.route]).catch(error => {
        console.error('Navigation error:', error);
        this.showToast('Navigatie fout opgetreden', 'error');
      });
    }

    this.showToast(`Navigeerd naar ${item.label}`, 'info');
  }

  // Status change handler
  onStatusChange(selectedStatus: StatusOption): void {
    this.statusOptions = this.statusOptions.map(status => ({
      ...status,
      active: status.id === selectedStatus.id
    }));
    
    // Update amount based on status
    if (selectedStatus.id === 'today') {
      this.totalAmount = this.hasInvoices ? 150 : 0;
    } else {
      this.totalAmount = this.hasInvoices ? 85 : 0;
    }
    
    this.showToast(`Status gewijzigd naar ${selectedStatus.label}`, 'info');
  }

  // Upload handler - toggles between states
  onUploadFactuur(): void {
    this.hasInvoices = !this.hasInvoices;
    
    if (!this.hasInvoices) {
      // Going from empty to populated
      this.totalAmount = 150;
      this.showInfoCard = true;
      this.showToast('Factuur succesvol geüpload!', 'success');
    } else {
      // Going from populated to empty
      this.totalAmount = 0;
      this.showInfoCard = false;
      this.showToast('Dashboard gereset', 'info');
    }
  }

  // Toast methods
  showToast(message: string, type: 'success' | 'error' | 'info', duration: number = 3000): void {
    const toast: ToastMessage = {
      id: `toast-${this.toastCounter + 1}`,
      message,
      type
    };
    
    this.toastCounter++;
    this.toastMessages.push(toast);
    
    setTimeout(() => {
      this.toastMessages = this.toastMessages.filter(t => t.id !== toast.id);
    }, duration);
  }

  removeToast(toastId: string): void {
    this.toastMessages = this.toastMessages.filter(toast => toast.id !== toastId);
  }

  // Other handlers
  onUploadCardHover(hovered: boolean): void {
    this.uploadCardHovered = hovered;
  }

  onCloseInfoCard(): void {
    this.showInfoCard = false;
    this.showToast('Info kaart gesloten', 'info');
  }

  onReadMore(event: Event): void {
    event.preventDefault();
    this.showToast('Meer informatie wordt geladen...', 'info');
  }

  onFilterClick(): void {
    this.showToast('Filter opties worden geladen...', 'info');
  }

  onWorkflowFilter(): void {
    this.showToast('Workflow filter wordt toegepast...', 'info');
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
    if (event.target.nextElementSibling) {
      event.target.nextElementSibling.style.display = 'flex';
    }
  }

  onFacturenMenuClick(): void {
    this.showFacturenTable = !this.showFacturenTable;
    const message = this.showFacturenTable ? 'Facturen tabel geopend' : 'Facturen tabel gesloten';
    this.showToast(message, 'info');
  }

  // New: Aankopen menu handler
  onAankopenMenuClick(): void {
    this.showAankopenTable = !this.showAankopenTable;
    const message = this.showAankopenTable ? 'Aankopen overzicht geopend' : 'Aankopen overzicht gesloten';
    this.showToast(message, 'info');
  }

  // New: Projecten menu handler
  onProjectenMenuClick(): void {
    this.showProjectenTable = !this.showProjectenTable;
    const message = this.showProjectenTable ? 'Projecten overzicht geopend' : 'Projecten overzicht gesloten';
    this.showToast(message, 'info');
  }

  // Alternative toast implementation using Ionic ToastController
  async showIonicToast(message: string, color: string = 'primary'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}