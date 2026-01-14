# WebSocket Real-time Communication Rules

**CRITICAL**: This project requires WebSocket for two-player real-time interaction. Follow these patterns strictly.

## WebSocket Manager Pattern

### Create Singleton WebSocket Manager
- Centralize WebSocket logic in a manager class
- Use singleton pattern for single connection
- Example:
  ```typescript
  // utils/websocket-manager.ts
  interface IWebSocketMessage {
      type: string;
      data: unknown;
      timestamp: number;
  }

  interface IWebSocketConfig {
      url: string;
      heartbeatInterval?: number;
      reconnectInterval?: number;
      maxReconnectAttempts?: number;
  }

  type MessageHandler = (message: IWebSocketMessage) => void;
  type ConnectionStateHandler = (isConnected: boolean) => void;

  class WebSocketManager {
      private static instance: WebSocketManager;
      private socketTask: WechatMiniprogram.SocketTask | null = null;
      private config: IWebSocketConfig | null = null;
      private messageHandlers: Map<string, MessageHandler[]> = new Map();
      private connectionStateHandlers: ConnectionStateHandler[] = [];
      private heartbeatTimer: number | null = null;
      private reconnectTimer: number | null = null;
      private reconnectAttempts = 0;
      private isConnected = false;
      private shouldReconnect = true;

      private constructor() {}

      static getInstance(): WebSocketManager {
          if (!WebSocketManager.instance) {
              WebSocketManager.instance = new WebSocketManager();
          }
          return WebSocketManager.instance;
      }

      connect(config: IWebSocketConfig): Promise<void> {
          return new Promise((resolve, reject) => {
              this.config = config;
              this.shouldReconnect = true;

              this.socketTask = wx.connectSocket({
                  url: config.url,
                  success: () => {
                      console.log('WebSocket connection initiated');
                  },
                  fail: (error) => {
                      console.error('WebSocket connection failed:', error);
                      reject(error);
                  },
              });

              this.socketTask.onOpen(() => {
                  console.log('WebSocket connected');
                  this.isConnected = true;
                  this.reconnectAttempts = 0;
                  this.notifyConnectionState(true);
                  this.startHeartbeat();
                  resolve();
              });

              this.socketTask.onMessage((res) => {
                  this.handleMessage(res.data);
              });

              this.socketTask.onError((error) => {
                  console.error('WebSocket error:', error);
                  this.handleError(error);
              });

              this.socketTask.onClose(() => {
                  console.log('WebSocket closed');
                  this.handleClose();
              });
          });
      }

      disconnect(): void {
          this.shouldReconnect = false;
          this.stopHeartbeat();
          this.stopReconnect();

          if (this.socketTask) {
              this.socketTask.close({
                  code: 1000,
                  reason: 'Client disconnect',
              });
              this.socketTask = null;
          }

          this.isConnected = false;
          this.notifyConnectionState(false);
      }

      send(type: string, data: unknown): void {
          if (!this.isConnected || !this.socketTask) {
              console.error('WebSocket not connected');
              throw new Error('WebSocket not connected');
          }

          const message: IWebSocketMessage = {
              type,
              data,
              timestamp: Date.now(),
          };

          this.socketTask.send({
              data: JSON.stringify(message),
              success: () => {
                  console.log('Message sent:', type);
              },
              fail: (error) => {
                  console.error('Failed to send message:', error);
              },
          });
      }

      on(messageType: string, handler: MessageHandler): void {
          if (!this.messageHandlers.has(messageType)) {
              this.messageHandlers.set(messageType, []);
          }
          this.messageHandlers.get(messageType)!.push(handler);
      }

      off(messageType: string, handler: MessageHandler): void {
          const handlers = this.messageHandlers.get(messageType);
          if (handlers) {
              const index = handlers.indexOf(handler);
              if (index > -1) {
                  handlers.splice(index, 1);
              }
          }
      }

      onConnectionStateChange(handler: ConnectionStateHandler): void {
          this.connectionStateHandlers.push(handler);
      }

      private handleMessage(rawData: string | ArrayBuffer): void {
          try {
              const messageStr = typeof rawData === 'string'
                  ? rawData
                  : String.fromCharCode.apply(null, new Uint8Array(rawData) as any);

              const message = JSON.parse(messageStr) as IWebSocketMessage;

              console.log('Received message:', message.type);

              const handlers = this.messageHandlers.get(message.type);
              if (handlers) {
                  handlers.forEach(handler => handler(message));
              }
          } catch (error) {
              console.error('Failed to parse message:', error);
          }
      }

      private handleError(error: WechatMiniprogram.GeneralCallbackResult): void {
          this.isConnected = false;
          this.notifyConnectionState(false);
          this.attemptReconnect();
      }

      private handleClose(): void {
          this.isConnected = false;
          this.stopHeartbeat();
          this.notifyConnectionState(false);

          if (this.shouldReconnect) {
              this.attemptReconnect();
          }
      }

      private attemptReconnect(): void {
          if (!this.config) return;

          const maxAttempts = this.config.maxReconnectAttempts || 5;
          if (this.reconnectAttempts >= maxAttempts) {
              console.error('Max reconnection attempts reached');
              return;
          }

          const interval = this.config.reconnectInterval || 3000;
          this.reconnectAttempts++;

          console.log(
              `Reconnecting in ${interval}ms (attempt ${this.reconnectAttempts}/${maxAttempts})`
          );

          this.reconnectTimer = setTimeout(() => {
              this.connect(this.config!).catch(error => {
                  console.error('Reconnection failed:', error);
              });
          }, interval) as unknown as number;
      }

      private startHeartbeat(): void {
          const interval = this.config?.heartbeatInterval || 30000;

          this.heartbeatTimer = setInterval(() => {
              if (this.isConnected) {
                  this.send('heartbeat', { timestamp: Date.now() });
              }
          }, interval) as unknown as number;
      }

      private stopHeartbeat(): void {
          if (this.heartbeatTimer) {
              clearInterval(this.heartbeatTimer);
              this.heartbeatTimer = null;
          }
      }

      private stopReconnect(): void {
          if (this.reconnectTimer) {
              clearTimeout(this.reconnectTimer);
              this.reconnectTimer = null;
          }
          this.reconnectAttempts = 0;
      }

      private notifyConnectionState(isConnected: boolean): void {
          this.connectionStateHandlers.forEach(handler => handler(isConnected));
      }

      getConnectionState(): boolean {
          return this.isConnected;
      }
  }

  export const wsManager = WebSocketManager.getInstance();
  ```

## Usage in App

### Initialize WebSocket on App Launch
- Connect WebSocket in App lifecycle
- Example:
  ```typescript
  // app.ts
  import { wsManager } from './utils/websocket-manager';

  App<IAppOption>({
      globalData: {
          wsConnected: false,
      },

      onLaunch() {
          this.initWebSocket();
      },

      async initWebSocket() {
          try {
              await wsManager.connect({
                  url: 'wss://your-websocket-server.com',
                  heartbeatInterval: 30000,
                  reconnectInterval: 3000,
                  maxReconnectAttempts: 5,
              });

              wsManager.onConnectionStateChange((isConnected) => {
                  this.globalData.wsConnected = isConnected;

                  if (isConnected) {
                      wx.showToast({
                          title: '连接成功',
                          icon: 'success',
                      });
                  } else {
                      wx.showToast({
                          title: '连接断开',
                          icon: 'none',
                      });
                  }
              });

              console.log('WebSocket initialized');
          } catch (error) {
              console.error('Failed to initialize WebSocket:', error);
          }
      },

      onHide() {
          // Keep connection alive when app is in background
      },

      onUnload() {
          wsManager.disconnect();
      },
  });
  ```

## Usage in Pages

### Subscribe to Messages in Page
- Register message handlers in `onLoad`
- Unregister in `onUnload`
- Example:
  ```typescript
  // pages/game/game.ts
  import { wsManager } from '../../utils/websocket-manager';

  interface IGameState {
      player1: IPlayer;
      player2: IPlayer;
      currentTurn: 'player1' | 'player2';
  }

  interface IPlayer {
      id: string;
      name: string;
      score: number;
  }

  Page({
      data: {
          gameState: null as IGameState | null,
          isMyTurn: false,
          connectionStatus: 'disconnected' as 'connected' | 'disconnected',
      },

      onLoad() {
          this.registerMessageHandlers();
          this.checkConnection();
      },

      onUnload() {
          this.unregisterMessageHandlers();
      },

      registerMessageHandlers() {
          wsManager.on('game:start', this.handleGameStart);
          wsManager.on('game:move', this.handleGameMove);
          wsManager.on('game:end', this.handleGameEnd);
          wsManager.on('player:joined', this.handlePlayerJoined);
          wsManager.on('player:left', this.handlePlayerLeft);

          wsManager.onConnectionStateChange(this.handleConnectionStateChange);
      },

      unregisterMessageHandlers() {
          wsManager.off('game:start', this.handleGameStart);
          wsManager.off('game:move', this.handleGameMove);
          wsManager.off('game:end', this.handleGameEnd);
          wsManager.off('player:joined', this.handlePlayerJoined);
          wsManager.off('player:left', this.handlePlayerLeft);
      },

      handleGameStart: function(message: IWebSocketMessage) {
          console.log('Game started:', message.data);
          const gameState = message.data as IGameState;
          this.setData({ gameState });
      },

      handleGameMove: function(message: IWebSocketMessage) {
          console.log('Game move:', message.data);
          // Update game state
      },

      handleGameEnd: function(message: IWebSocketMessage) {
          console.log('Game ended:', message.data);
          wx.showModal({
              title: '游戏结束',
              content: '游戏已结束',
              showCancel: false,
          });
      },

      handlePlayerJoined: function(message: IWebSocketMessage) {
          console.log('Player joined:', message.data);
          wx.showToast({
              title: '玩家加入',
              icon: 'success',
          });
      },

      handlePlayerLeft: function(message: IWebSocketMessage) {
          console.log('Player left:', message.data);
          wx.showToast({
              title: '玩家离开',
              icon: 'none',
          });
      },

      handleConnectionStateChange: function(isConnected: boolean) {
          this.setData({
              connectionStatus: isConnected ? 'connected' : 'disconnected',
          });
      },

      checkConnection() {
          const isConnected = wsManager.getConnectionState();
          this.setData({
              connectionStatus: isConnected ? 'connected' : 'disconnected',
          });
      },

      // Send message to server
      handlePlayerMove(event: WechatMiniprogram.TouchEvent) {
          const { x, y } = event.currentTarget.dataset;

          try {
              wsManager.send('game:move', {
                  x,
                  y,
                  playerId: this.data.myPlayerId,
              });
          } catch (error) {
              console.error('Failed to send move:', error);
              wx.showToast({
                  title: '发送失败',
                  icon: 'none',
              });
          }
      },
  });
  ```

## Message Protocol

### Define Clear Message Types
- Use consistent message type naming
- Example:
  ```typescript
  // types/websocket.ts
  export type MessageType =
      | 'game:start'
      | 'game:move'
      | 'game:end'
      | 'player:joined'
      | 'player:left'
      | 'chat:message'
      | 'heartbeat';

  export interface IGameStartMessage {
      type: 'game:start';
      data: {
          gameId: string;
          player1: IPlayer;
          player2: IPlayer;
      };
  }

  export interface IGameMoveMessage {
      type: 'game:move';
      data: {
          playerId: string;
          x: number;
          y: number;
      };
  }

  // ... other message types
  ```

## Error Handling

### Handle WebSocket Errors Gracefully
- Show user-friendly error messages
- Provide recovery options
- Example:
  ```typescript
  Page({
      handleWebSocketError(error: unknown) {
          console.error('WebSocket error:', error);

          wx.showModal({
              title: '连接错误',
              content: '网络连接出现问题，是否重新连接?',
              confirmText: '重新连接',
              success: (res) => {
                  if (res.confirm) {
                      this.reconnectWebSocket();
                  }
              },
          });
      },

      async reconnectWebSocket() {
          wx.showLoading({ title: '正在连接...' });

          try {
              await wsManager.connect({
                  url: 'wss://your-websocket-server.com',
              });
              wx.hideLoading();
              wx.showToast({
                  title: '连接成功',
                  icon: 'success',
              });
          } catch (error) {
              wx.hideLoading();
              this.handleWebSocketError(error);
          }
      },
  });
  ```

## WebSocket Best Practices

### Connection Management
- Connect on app launch
- Maintain connection in background
- Disconnect on app unload
- Implement automatic reconnection
- Send heartbeat messages to keep connection alive

### Message Handling
- Use typed message interfaces
- Validate incoming messages
- Handle errors in message handlers
- Log messages for debugging

### Performance
- Batch messages when possible
- Avoid sending large payloads
- Use binary format for large data (if needed)
- Implement message queue for offline scenarios

### Security
- Use WSS (secure WebSocket) protocol
- Implement authentication/authorization
- Validate all incoming messages
- Don't send sensitive data unencrypted

## WebSocket Checklist (For AI Tools)

Before implementing WebSocket features, ensure:
- [ ] WebSocketManager uses singleton pattern
- [ ] Connection includes heartbeat mechanism
- [ ] Automatic reconnection is implemented
- [ ] Message handlers are properly typed
- [ ] Handlers are registered in `onLoad` and unregistered in `onUnload`
- [ ] Connection state is tracked and displayed to user
- [ ] Error handling provides user-friendly messages
- [ ] Message protocol is well-defined with types
- [ ] WSS protocol is used for security
- [ ] Messages are validated before processing
