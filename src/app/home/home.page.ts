import { Component,OnInit  } from '@angular/core';
import { Router } from '@angular/router';
// PDF.js CDN loader


@Component({
  selector: "app-home",
  templateUrl: "home.page.html",
  styleUrls: ["home.page.scss"],
})
export class HomePage implements OnInit{
  public signupEmail: string = '';
  public loginEmail: string = '';
  public acceptTerms: boolean = false;
  logoUrl = '../../../assets/logo.png';
  googleLogoUrl = '../../../assets/logobg.png';

  ngOnInit() {
    // Component initialization logic
  }
  onSignup(): void {
    if (!this.signupEmail) {
      this.showAlert('Vul je email adres in');
      return;
    }

    if (!this.acceptTerms) {
      this.showAlert('Accepteer de voorwaarden om door te gaan');
      return;
    }

    if (!this.isValidEmail(this.signupEmail)) {
      this.showAlert('Vul een geldig email adres in');
      return;
    }

    // Process signup
    console.log('Signup attempt:', {
      email: this.signupEmail,
      termsAccepted: this.acceptTerms
    });

    // Here you would typically call your authentication service
    this.processSignup(this.signupEmail);
  }
  onLogin(): void {
    if (!this.loginEmail) {
      this.showAlert('Vul je email adres in');
      return;
    }

    if (!this.isValidEmail(this.loginEmail)) {
      this.showAlert('Vul een geldig email adres in');
      return;
    }

    // Process login
    console.log('Login attempt:', {
      email: this.loginEmail
    });

    // Here you would typically call your authentication service
    this.processLogin(this.loginEmail);
  }
   signInWithGoogle(): void {
    console.log('Google Sign In initiated');
    
    // Here you would integrate with Google OAuth
    // Example with Firebase Auth or similar service
    this.processGoogleSignIn();
  }

  /**
   * Process signup with email verification
   */
  private processSignup(email: string): void {
    // Simulate API call
    console.log(`Sending verification email to: ${email}`);
    
    // Show success message
    
    // Clear form
    this.signupEmail = '';
    this.acceptTerms = false;
    this.router.navigate(['/dashboard']);
  }

  /**
   * Process login with email verification
   */
  private processLogin(email: string): void {
    // Simulate API call
    console.log(`Sending login verification to: ${email}`);
    
    // Show success message
    this.showAlert(`Verificatie email verzonden naar ${email}. Controleer je inbox.`, 'success');
    
    // Clear form
    this.loginEmail = '';
  }

  /**
   * Process Google Sign In
   */
  private processGoogleSignIn(): void {
    // Simulate Google OAuth flow
    console.log('Processing Google Sign In...');
    
    // Here you would implement actual Google OAuth
    // For example, using Firebase Auth:
    // this.afAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
    
    this.showAlert('Google inloggen wordt gestart...', 'info');
  }

  /**
   * Email validation helper
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Show alert message (you might want to use a proper alert/toast service)
   */
  private showAlert(message: string, type: 'error' | 'success' | 'info' = 'error'): void {
    // For demonstration purposes, using console.log
    // In a real app, you'd use a toast/alert service
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // You could also use browser alert for now
    alert(message);
  }

  /**
   * Clear signup form
   */
  clearSignupForm(): void {
    this.signupEmail = '';
    this.acceptTerms = false;
  }

  /**
   * Clear login form
   */
  clearLoginForm(): void {
    this.loginEmail = '';
  }

  /**
   * Toggle terms acceptance
   */
  toggleTerms(): void {
    this.acceptTerms = !this.acceptTerms;
  }

  constructor(private router: Router) {}

  onClick(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/dashboard']);
  }
}

