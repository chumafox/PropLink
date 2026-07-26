import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import {
  listConversationsForUser,
  findDirectConversation,
  createConversation,
  getMessages,
  sendMessage,
  markRead,
  isParticipant,
  totalUnread,
  getOtherParticipantIds,
  getMessageById,
  getConversationById,
  hideMessage,
  unhideMessage,
  getChatContacts,
  setConversationListing,
  setConversationPinnedFiles,
  setConversationNotes,
  getConversationTasks,
  createConversationTask,
  updateConversationTaskStatus,
  deleteConversationTask,
  reorderConversationTasks,
  toggleConversationPin,
  reorderConversations,
} from "./queries/messaging";
import { createNotification } from "./queries/notifications";
import { getListingOwnerId } from "./queries/listings";
import { getAiSettings, cacheMessageTranslation } from "./queries/aiSettings";
import { translateText } from "./ai/translate";
import {
  getConnectionById,
  setConversationExternalEcho,
} from "./queries/channels";
import { sendMetaText, sendWhatsAppText } from "./channels/meta";
import { sendXdm } from "./channels/x";
import { sendTelegramMessage } from "./channels/telegram";

const attachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(255),
  kind: z.enum(["image", "document", "audio"]),
});

export const messagesRouter = createRouter({
  conversations: authedQuery.query(({ ctx }) =>
    listConversationsForUser(ctx.user.id),
  ),

  chatContacts: authedQuery.query(({ ctx }) =>
    getChatContacts(ctx.user.id),
  ),

  createGroup: authedQuery
    .input(
      z.object({
        participantIds: z.array(z.number()),
        subject: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Current user is also a participant
      const allIds = Array.from(new Set([...input.participantIds, ctx.user.id]));
      if (allIds.length < 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Group chat must have at least 3 participants",
        });
      }
      
      const conv = await createConversation(allIds, {
        subject: input.subject,
        isGroup: true,
      });
      return { conversationId: conv.id };
    }),

  unreadCount: authedQuery.query(({ ctx }) => totalUnread(ctx.user.id)),

  // Start (or reuse) a direct conversation with the owner of a listing
  startWithOwner: authedQuery
    .input(z.object({ listingId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const ownerId = await getListingOwnerId(input.listingId);
      if (!ownerId) throw new TRPCError({ code: "NOT_FOUND" });
      if (ownerId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This is your own listing",
        });
      }
      const existing = await findDirectConversation(
        ctx.user.id,
        ownerId,
        input.listingId,
      );
      if (existing) return existing;
      return createConversation([ctx.user.id, ownerId], {
        listingId: input.listingId,
      });
    }),

  messages: authedQuery
    .input(z.object({ conversationId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (!(await isParticipant(input.conversationId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getMessages(input.conversationId, ctx.user.id);
    }),

  hideMessage: authedQuery
    .input(z.object({ messageId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await hideMessage(input.messageId, ctx.user.id);
      return { ok: true };
    }),

  unhideMessage: authedQuery
    .input(z.object({ messageId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await unhideMessage(input.messageId, ctx.user.id);
      return { ok: true };
    }),

  setListing: authedQuery
    .input(z.object({ conversationId: z.number().int().positive(), listingId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!(await isParticipant(input.conversationId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await setConversationListing(input.conversationId, input.listingId);
      return { ok: true };
    }),

  setNotes: authedQuery
    .input(z.object({ conversationId: z.number().int().positive(), notes: z.string().max(50000) }))
    .mutation(async ({ ctx, input }) => {
      if (!(await isParticipant(input.conversationId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await setConversationNotes(input.conversationId, ctx.user.id, input.notes);
      return { ok: true };
    }),

  setPinnedFiles: authedQuery
    .input(z.object({
      conversationId: z.number().int().positive(),
      files: z.array(z.object({ url: z.string(), name: z.string(), kind: z.enum(["image", "document", "audio"]) }))
    }))
    .mutation(async ({ ctx, input }) => {
      if (!(await isParticipant(input.conversationId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await setConversationPinnedFiles(input.conversationId, input.files);
      return { ok: true };
    }),

  getTasks: authedQuery
    .input(z.object({ conversationId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (!(await isParticipant(input.conversationId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return await getConversationTasks(input.conversationId);
    }),

  createTask: authedQuery
    .input(z.object({ conversationId: z.number().int().positive(), title: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      if (!(await isParticipant(input.conversationId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return await createConversationTask(input.conversationId, input.title);
    }),

  updateTaskStatus: authedQuery
    .input(z.object({
      conversationId: z.number().int().positive(),
      taskId: z.number().int().positive(),
      status: z.enum(["todo", "in_progress", "done"])
    }))
    .mutation(async ({ ctx, input }) => {
      if (!(await isParticipant(input.conversationId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await updateConversationTaskStatus(input.conversationId, input.taskId, input.status);
      return { ok: true };
    }),

  deleteTask: authedQuery
    .input(z.object({
      conversationId: z.number().int().positive(),
      taskId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!(await isParticipant(input.conversationId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await deleteConversationTask(input.conversationId, input.taskId);
      return { ok: true };
    }),

  reorderTasks: authedQuery
    .input(z.object({
      conversationId: z.number().int().positive(),
      taskIds: z.array(z.number().int().positive()),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!(await isParticipant(input.conversationId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await reorderConversationTasks(input.conversationId, input.taskIds);
      return { ok: true };
    }),

  togglePinConversation: authedQuery
    .input(z.object({
      conversationId: z.number().int().positive(),
      isPinned: z.number().int().min(0).max(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!(await isParticipant(input.conversationId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await toggleConversationPin(input.conversationId, ctx.user.id, input.isPinned);
      return { ok: true };
    }),

  reorderConversations: authedQuery
    .input(z.object({
      conversationIds: z.array(z.number().int().positive()),
    }))
    .mutation(async ({ ctx, input }) => {
      await reorderConversations(input.conversationIds, ctx.user.id);
      return { ok: true };
    }),

  send: authedQuery
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        body: z.string().max(10000).optional(),
        attachments: z.array(attachmentSchema).max(10).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await isParticipant(input.conversationId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (!input.body?.trim() && input.attachments.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Empty message" });
      }
      const msg = await sendMessage(
        input.conversationId,
        ctx.user.id,
        input.body?.trim() || null,
        input.attachments,
      );
      const others = await getOtherParticipantIds(
        input.conversationId,
        ctx.user.id,
      );
      for (const uid of others) {
        void createNotification(uid, {
          type: "new_message",
          title: `New message from ${ctx.user.name ?? "a user"}`,
          body: input.body?.trim().slice(0, 140) || "Attachment",
          link: `/messages/${input.conversationId}`,
        }).catch(() => {});
      }

      // Omnichannel bridge: relay to the external messenger if this
      // conversation came from Facebook / Instagram / WhatsApp / X.
      const conv = await getConversationById(input.conversationId);
      if (
        conv &&
        conv.channel !== "internal" &&
        conv.connectionId &&
        conv.externalThreadId &&
        input.body?.trim()
      ) {
        void (async () => {
          try {
            const conn = await getConnectionById(conv.connectionId!);
            if (!conn || conn.status !== "active") return;
            let externalId: string | null = null;
            if (conn.channel === "facebook" || conn.channel === "instagram") {
              externalId = await sendMetaText(
                conn,
                conv.externalThreadId!,
                input.body!.trim(),
              );
            } else if (conn.channel === "whatsapp") {
              externalId = await sendWhatsAppText(
                conn,
                conv.externalThreadId!,
                input.body!.trim(),
              );
            } else if (conn.channel === "x") {
              externalId = await sendXdm(
                conn,
                conv.externalThreadId!,
                input.body!.trim(),
              );
            } else if (conn.channel === "telegram") {
              externalId = await sendTelegramMessage(
                conn,
                conv.externalThreadId!,
                input.body!.trim(),
              );
            }
            if (externalId) {
              await setConversationExternalEcho(externalId, msg.id).catch(
                () => {},
              );
            }
          } catch (e) {
            console.error(`[channels] outbound ${conv.channel} failed:`, e);
          }
        })();
      }
      return msg;
    }),

  markRead: authedQuery
    .input(z.object({ conversationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await markRead(input.conversationId, ctx.user.id);
      return { ok: true };
    }),

  // Lazy BYOK translation: translate one incoming message into the
  // requester's target language, cache the result on the message row.
  translate: authedQuery
    .input(z.object({ messageId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const msg = await getMessageById(input.messageId);
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      if (!(await isParticipant(msg.conversationId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (msg.senderId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot translate your own message",
        });
      }
      if (!msg.body?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nothing to translate",
        });
      }
      const settings = await getAiSettings(ctx.user.id);
      if (!settings) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "AI translator is not configured. Set up your API key in Dashboard → AI Bot.",
        });
      }
      const lang = settings.targetLanguage ?? "en";
      const cached = msg.translations?.[lang];
      if (cached) {
        return { text: cached, language: lang, cached: true };
      }
    let translated: string;
      try {
        console.log(`[translate] Starting translation for message ${msg.id} to ${lang} via ${settings.provider}`);
        translated = await translateText(
          {
            provider: settings.provider,
            apiKey: settings.apiKey,
            baseUrl: settings.baseUrl,
            model: settings.model,
          },
          msg.body,
          lang,
        );
        console.log(`[translate] Success for message ${msg.id}`);
      } catch (e: any) {
        console.error(`[translate] Failed for message ${msg.id}:`, e);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e?.message ?? "Translation failed",
        });
      }
      await cacheMessageTranslation(msg.id, lang, translated).catch((err) => {
        console.error(`[translate] Cache failed:`, err);
      });
      return { text: translated, language: lang, cached: false };
    }),
});
