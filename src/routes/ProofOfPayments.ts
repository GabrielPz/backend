import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { autenticarToken } from "./Auth";

const proofOfPaymentSchema = z.object({
  orderId: z.string().uuid(),
  link: z.string(),
});

export async function proofOfPaymentRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/proofs-of-payment",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Create Proof of Payment",
        tags: ["ProofsOfPayment"],
        headers: z.object({
          authorization: z.string().optional()
        }),
        body: proofOfPaymentSchema,
        response: {
          201: proofOfPaymentSchema.extend({ id: z.string().uuid() }),
          400: z.object({ message: z.string() })
        }
      }
    },
    async (request, reply) => {
      const proofOfPaymentData = proofOfPaymentSchema.parse(request.body);

      const proofOfPayment = await prisma.proofOfPayment.create({
        data: proofOfPaymentData,
        select: {
          id: true,
          orderId: true,
          link: true
        }
      });

      if (!proofOfPayment) {
        return reply
          .status(400)
          .send({ message: "Proof of Payment not created" });
      }

      return reply.status(201).send(proofOfPayment);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    "/proofs-of-payment/:id",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Get Proof of Payment by ID",
        tags: ["ProofsOfPayment"],
        headers: z.object({
          authorization: z.string().optional()
        }),
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: proofOfPaymentSchema.extend({ id: z.string().uuid() }),
          404: z.object({ message: z.string() })
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const proofOfPayment = await prisma.proofOfPayment.findUnique({
        where: { id },
        select: {
          id: true,
          orderId: true,
          link: true
        }
      });

      if (!proofOfPayment) {
        return reply
          .status(404)
          .send({ message: "Proof of Payment not found" });
      }

      return reply.status(200).send(proofOfPayment);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    "/proofs-of-payment/:id",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Update Proof of Payment by ID",
        tags: ["ProofsOfPayment"],
        headers: z.object({
          authorization: z.string().optional()
        }),
        params: z.object({ id: z.string().uuid() }),
        body: proofOfPaymentSchema,
        response: {
          200: proofOfPaymentSchema.extend({ id: z.string().uuid() }),
          404: z.object({ message: z.string() })
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      const proofOfPaymentData = proofOfPaymentSchema.parse(request.body);

      const proofOfPayment = await prisma.proofOfPayment.update({
        where: { id },
        data: proofOfPaymentData,
        select: {
          id: true,
          orderId: true,
          link: true
        }
      });

      if (!proofOfPayment) {
        return reply
          .status(404)
          .send({ message: "Proof of Payment not found" });
      }

      return reply.status(200).send(proofOfPayment);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
    "/proofs-of-payment/:id",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Delete Proof of Payment by ID",
        tags: ["ProofsOfPayment"],
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

      const proofOfPayment = await prisma.proofOfPayment.delete({
        where: { id }
      });

      if (!proofOfPayment) {
        return reply
          .status(404)
          .send({ message: "Proof of Payment not found" });
      }

      return reply.status(204).send();
    }
  );

  
}
