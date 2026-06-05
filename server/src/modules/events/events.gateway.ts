import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.APP_CORS_ORIGINS
      ? process.env.APP_CORS_ORIGINS.split(',')
      : '*',
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  afterInit() {
    this.logger.log('WebSocket gateway initialised');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ): void {
    client.join(room);
    this.logger.debug(`Client ${client.id} joined room: ${room}`);
  }

  @SubscribeMessage('leave')
  handleLeave(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ): void {
    client.leave(room);
  }

  emitSchoolUpdated(schoolId: string, payload: unknown): void {
    this.server.to(`school:${schoolId}`).emit('school:updated', payload);
  }

  emitScoresRecalculated(schoolId: string, assessment: unknown): void {
    this.server.to(`school:${schoolId}`).emit('scores:updated', assessment);
  }

  emitReportStatusChanged(
    reportedByUserId: string,
    payload: {
      reportId: string;
      schoolId: string;
      newStatus: string;
      reportedBy: string;
    },
  ): void {
    this.server.to(`user:${reportedByUserId}`).emit('report:status_changed', payload);
  }
}
