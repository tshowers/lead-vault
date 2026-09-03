import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { LeadVaultNotificationService } from '../../services/lead-vault-notification.service';

@Component( {
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css',
} )
export class ToastComponent {
  constructor ( readonly notifications: LeadVaultNotificationService ) { }

  dismiss ( id: number ): void {
    this.notifications.dismiss( id );
  }
}
