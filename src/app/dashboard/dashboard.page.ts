import { Router } from '@angular/router';
import { Component, OnInit, OnDestroy } from '@angular/core';

// Interfaces
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
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit,OnDestroy  {

  // Properties
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

  // Toast messages
  toastMessages: ToastMessage[] = [];

  private toastCounter: number = 0;
  private toastTimeouts: { [key: string]: any } = {};

  constructor(private router: Router) {
    // Constructor logic here
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    // Cleanup subscriptions, timers, etc.
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
}