import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: Socket;

  constructor() {
    // Connect to the WebSocket server
    this.socket = io(environment.apiUrl.replace('/api', ''), {
      transports: ['websocket']
    });
  }

  // Method to get the socket instance
  getSocket(): Socket {
    return this.socket;
  }

  // Method to disconnect from the WebSocket server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}