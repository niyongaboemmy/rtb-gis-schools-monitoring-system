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
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import {
  resolveAccessScope,
  schoolMatchesScope,
} from '../../common/scope/access-scope';

/** Rooms a client may ask to join; anything else is refused. */
const ROOM_PATTERN = /^(user|school):([0-9a-f-]{36})$/i;

/** Pulls the access token from the handshake: `auth.token` or a Bearer header. */
export function extractSocketToken(client: Socket): string | null {
  const fromAuth = client.handshake?.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.trim()) return fromAuth.trim();
  const header = client.handshake?.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer '))
    return header.slice(7).trim() || null;
  return null;
}

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

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
  ) {}

  /**
   * Authenticates in Socket.IO middleware, which runs before the connection
   * is accepted: the client's `connect` event (and its first `join`) only
   * fires once the user is loaded. Authenticating in handleConnection instead
   * races with that first join.
   */
  afterInit(server: Server) {
    server.use((client, next) => {
      void this.authenticate(client).then((user) =>
        user ? next() : next(new Error('Unauthorized')),
      );
    });
    this.logger.log('WebSocket gateway initialised');
  }

  /** Loads the user for the handshake token onto `client.data`, or null. */
  async authenticate(client: Socket): Promise<User | null> {
    const token = extractSocketToken(client);
    if (!token) return null;
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      const user = await this.authService.validateUser(payload.sub);
      client.data.user = user;
      return user;
    } catch {
      return null;
    }
  }

  /** Defensive: middleware already rejected unauthenticated handshakes. */
  handleConnection(client: Socket) {
    if (!client.data?.user) return this.reject(client, 'unauthenticated');
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  async handleJoin(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: boolean }> {
    const user = client.data?.user as User | undefined;
    if (!user || !(await this.canJoin(user, room))) {
      this.logger.warn(`Refused join of "${room}" by ${user?.id ?? client.id}`);
      return { ok: false };
    }
    await client.join(room);
    return { ok: true };
  }

  @SubscribeMessage('leave')
  async handleLeave(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    await client.leave(room);
  }

  /** A user may join their own room, or a school room inside their scope. */
  async canJoin(user: User, room: unknown): Promise<boolean> {
    if (typeof room !== 'string') return false;
    const match = ROOM_PATTERN.exec(room);
    if (!match) return false;
    const [, kind, id] = match;

    if (kind === 'user') return id === user.id;

    const school = await this.schoolRepository.findOne({
      where: { id },
      select: ['id', 'province', 'district', 'sector'],
    });
    return !!school && schoolMatchesScope(school, resolveAccessScope(user));
  }

  private reject(client: Socket, reason: string) {
    this.logger.debug(`Rejected socket ${client.id}: ${reason}`);
    client.emit('auth_error', { message: 'Unauthorized' });
    client.disconnect(true);
  }

  /** Pushes an event to one user's private room. */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitSchoolUpdated(schoolId: string, payload: unknown): void {
    this.server.to(`school:${schoolId}`).emit('school:updated', payload);
  }

  emitScoresRecalculated(schoolId: string, assessment: unknown): void {
    this.server.to(`school:${schoolId}`).emit('scores:updated', assessment);
  }

  /** A site feature (measurement / note / pin) was created, updated or deleted. */
  emitSiteFeatureChanged(
    schoolId: string,
    payload: {
      schoolId: string;
      id: string;
      op: 'created' | 'updated' | 'deleted';
    },
  ): void {
    this.server?.to(`school:${schoolId}`).emit('site-feature:changed', payload);
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
    this.server
      .to(`user:${reportedByUserId}`)
      .emit('report:status_changed', payload);
  }
}
