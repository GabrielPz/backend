import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { autenticarToken } from "./Auth";

const qrCodeSchema = z.object({
  orderId: z.string().uuid(),
  link: z.string(),
});

export async function qrCodeRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/qrcodes",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Create QR Code",
        tags: ["QrCodes"],
        body: qrCodeSchema,
        headers: z.object({
          authorization: z.string().optional()
        }),
        response: {
          201: z.object({
            id: z.string().uuid(),
            orderId: z.string().uuid().nullable(),
            link: z.string()
          }),
          400: z.object({ message: z.string() })
        }
      }
    },
    async (request, reply) => {
      const qrCodeData = qrCodeSchema.parse(request.body);

      const qrCode = await prisma.qrCode.create({
        data: qrCodeData,
        select: {
          id: true,
          orderId: true,
          link: true
        }
      });

      if (!qrCode) {
        return reply.status(400).send({ message: "QR Code not created" });
      }

      return reply.status(201).send(qrCode);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    "/qrcodes/:id",
    {
      preHandler: autenticarToken,
      schema: {
        headers: z.object({
          authorization: z.string().optional()
        }),
        summary: "Get QR Code by ID",
        tags: ["QrCodes"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({
            id: z.string().uuid(),
            orderId: z.string().uuid().nullable(),
            link: z.string()
          }),
          404: z.object({ message: z.string() })
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const qrCode = await prisma.qrCode.findUnique({
        where: { id },
        select: {
          id: true,
          orderId: true,
          link: true
        }
      });

      if (!qrCode) {
        return reply.status(404).send({ message: "QR Code not found" });
      }

      return reply.status(200).send(qrCode);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    "/qrcodes/:id",
    {
      preHandler: autenticarToken,
      schema: {
        headers: z.object({
          authorization: z.string().optional()
        }),
        summary: "Update QR Code by ID",
        tags: ["QrCodes"],
        params: z.object({ id: z.string().uuid() }),
        body: qrCodeSchema,
        response: {
          200: qrCodeSchema.extend({ id: z.string().uuid() }),
          404: z.object({ message: z.string() })
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      const qrCodeData = qrCodeSchema.parse(request.body);

      const qrCode = await prisma.qrCode.update({
        where: { id },
        data: qrCodeData,
        select: {
          id: true,
          orderId: true,
          link: true
        }
      });

      if (!qrCode) {
        return reply.status(404).send({ message: "QR Code not found" });
      }

      return reply.status(200).send(qrCode);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
    "/qrcodes/:id",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Delete QR Code by ID",
        tags: ["QrCodes"],
        headers: z.object({
          authorization: z.string().optional()
        }),
        params: z.object({ id: z.string().uuid() }),
        response: {
          204: z.null(),
          404: z.object({ message: z.string() })
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const qrCode = await prisma.qrCode.delete({
        where: { id }
      });

      if (!qrCode) {
        return reply.status(404).send({ message: "QR Code not found" });
      }

      return reply.status(204).send();
    }
  );

}
