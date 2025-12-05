
import { GlobalData } from '../types';
import Peer, { DataConnection } from 'peerjs';

export class SyncService {
    private peer: Peer | null = null;
    private connection: DataConnection | null = null;
    private onDataReceived: (data: GlobalData) => void;
    private onStatusChange: (status: 'disconnected' | 'connecting' | 'connected') => void;
    
    private familyName: string;
    private slot: 1 | 2;
    private reconnectInterval: any = null;

    constructor(
        familyName: string, 
        slot: 1 | 2, 
        onDataReceived: (data: GlobalData) => void,
        onStatusChange: (status: 'disconnected' | 'connecting' | 'connected') => void
    ) {
        // Sanitize family name to ensure valid PeerID (alphanumeric only)
        this.familyName = familyName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        this.slot = slot;
        this.onDataReceived = onDataReceived;
        this.onStatusChange = onStatusChange;
    }

    private getMyId(): string {
        return `onewallet-v2-${this.familyName}-${this.slot}`;
    }

    private getTargetId(): string {
        const targetSlot = this.slot === 1 ? 2 : 1;
        return `onewallet-v2-${this.familyName}-${targetSlot}`;
    }

    public initialize() {
        if (this.peer) return;

        console.log(`Initializing P2P: ${this.getMyId()}`);
        this.onStatusChange('connecting');

        this.peer = new Peer(this.getMyId());

        this.peer.on('open', (id) => {
            console.log('Peer open with ID:', id);
            this.startReconnectionLoop();
        });

        this.peer.on('connection', (conn) => {
            console.log('Incoming connection from:', conn.peer);
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            // If ID is taken, we might already be connected in another tab or zombie session.
            // In a real app we'd handle this more gracefully.
            if (err.type === 'unavailable-id') {
                 // Retry logic handled by external reload or user action mostly
            }
            this.onStatusChange('disconnected');
        });

        this.peer.on('disconnected', () => {
             console.log('Peer disconnected from server');
             this.onStatusChange('disconnected');
             this.peer?.reconnect();
        });
    }

    private startReconnectionLoop() {
        if (this.reconnectInterval) clearInterval(this.reconnectInterval);
        
        // Try to connect to the partner immediately
        this.connectToPartner();

        // And retry every 5 seconds if not connected
        this.reconnectInterval = setInterval(() => {
            if (!this.connection || !this.connection.open) {
                this.connectToPartner();
            }
        }, 5000);
    }

    private connectToPartner() {
        if (!this.peer || this.peer.disconnected) return;
        if (this.connection && this.connection.open) return;

        const target = this.getTargetId();
        console.log(`Attempting to connect to ${target}...`);
        
        const conn = this.peer.connect(target, { reliable: true });
        this.handleConnection(conn);
    }

    private handleConnection(conn: DataConnection) {
        // If we already have a healthy connection, ignore this one or replace it?
        // Simple strategy: Replace.
        if (this.connection && this.connection.open) {
            this.connection.close();
        }

        this.connection = conn;

        conn.on('open', () => {
            console.log(`Connected to partner: ${conn.peer}`);
            this.onStatusChange('connected');
            // Handshake: Request data? Or just wait.
            // Ideally we send a "hello" with our latest update timestamp.
        });

        conn.on('data', (data) => {
            console.log('Received sync data');
            this.onDataReceived(data as GlobalData);
        });

        conn.on('close', () => {
            console.log('Connection closed');
            this.onStatusChange('disconnected');
            this.connection = null;
        });
        
        conn.on('error', (err) => {
             console.error('Connection error:', err);
             this.connection = null;
        });
    }

    public broadcast(data: GlobalData) {
        if (this.connection && this.connection.open) {
            this.connection.send(data);
        }
    }

    public destroy() {
        if (this.reconnectInterval) clearInterval(this.reconnectInterval);
        if (this.connection) this.connection.close();
        if (this.peer) this.peer.destroy();
        this.peer = null;
        this.connection = null;
        this.onStatusChange('disconnected');
    }
}
