/**
 * Note Service
 *
 * Manages notes attached to leads.
 */

import type { PrismaClient, Note } from '@prisma/client';
import type { CreateNoteInput } from '@/types';
import { AuditLogger } from '../audit';

export class NoteService {
  private auditLogger: AuditLogger;

  constructor(private prisma: PrismaClient) {
    this.auditLogger = new AuditLogger(prisma);
  }

  /**
   * Create a note
   */
  async createNote(
    input: CreateNoteInput,
    userId: string,
    tenantId: string
  ): Promise<Note> {
    const note = await this.prisma.note.create({
      data: {
        tenantId,
        leadId: input.leadId,
        userId,
        content: input.content,
        isPinned: input.isPinned || false,
      },
    });

    // Log creation
    await this.auditLogger.logCreate('Note', note.id, note as any, {
      userId,
      tenantId,
      metadata: {
        leadId: input.leadId,
      },
    });

    // Create activity
    await this.prisma.activity.create({
      data: {
        tenantId,
        leadId: input.leadId,
        userId,
        type: 'note_added',
        description: 'Note added',
        metadata: {
          noteId: note.id,
          preview: input.content.substring(0, 100),
        },
      },
    });

    return note;
  }

  /**
   * Get notes for a lead
   */
  async getLeadNotes(leadId: string, tenantId: string): Promise<Note[]> {
    return this.prisma.note.findMany({
      where: {
        leadId,
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    }) as any;
  }

  /**
   * Update note
   */
  async updateNote(
    noteId: string,
    content: string,
    userId: string,
    tenantId: string
  ): Promise<Note> {
    const before = await this.prisma.note.findFirst({
      where: { id: noteId, tenantId },
    });

    if (!before) {
      throw new Error('Note not found');
    }

    const note = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        content,
        updatedAt: new Date(),
      },
    });

    // Log update
    await this.auditLogger.logUpdate('Note', noteId, before as any, note as any, {
      userId,
      tenantId,
    });

    return note;
  }

  /**
   * Pin/unpin note
   */
  async togglePin(
    noteId: string,
    userId: string,
    tenantId: string
  ): Promise<Note> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, tenantId },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    return this.prisma.note.update({
      where: { id: noteId },
      data: {
        isPinned: !note.isPinned,
      },
    });
  }

  /**
   * Delete note
   */
  async deleteNote(noteId: string, userId: string, tenantId: string): Promise<void> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, tenantId },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    await this.prisma.note.delete({
      where: { id: noteId },
    });

    // Log deletion
    await this.auditLogger.logDelete('Note', noteId, note as any, {
      userId,
      tenantId,
    });
  }
}
