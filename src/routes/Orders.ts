import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma";
import { any, z } from "zod";
import { autenticarToken } from "./Auth";
import { Payment, MercadoPagoConfig } from "mercadopago";
import mercadopago from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken:
    "TEST-5286490925840188-082920-39578d3eeb3e96e3071eded6e49cde67-607790691",
});
const payments = new Payment(client);

const orderSchema = z.object({
  userId: z.string().uuid(),
  brlValue: z.number(),
  yuanValue: z.number(),
  userPaymentStatus: z.string().default("PENDING"),
  adminPaymentStatus: z.string().default("PENDING"),
  proofOfPaymentId: z.string().nullable().optional(),
  expireAt: z.string(),
  paymentData: z.object({
    description: z.string(),
    payment_method_id: z.string(),
    payer: z.object({
      email: z.string(),
      identification: z.object({
        type: z.string(),
        number: z.string(),
      }),
    }),
  }),
});

const bodyShema = z.object({
  brlValue: z.number(),
  yuanValue: z.number(),
  paymentData: z.object({
    description: z.string(),
    payment_method_id: z.string(),
    token: z.string().optional().nullable(),
    installments: z.number().optional().nullable(),
    payer: z.object({
      email: z.string(),
      identification: z.object({
        type: z.string(),
        number: z.string(),
      }),
    }),
  }),
});

export async function orderRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/orders",
    {
      schema: {
        summary: "Create Order",
        tags: ["Orders"],
        body: bodyShema,
        response: {
          201: any,
          400: z.object({ message: z.string() }),
        },
        preHandler: [autenticarToken],
      },
    },
    async (request, reply) => {
      const orderData = orderSchema.parse(request.body);
      const { body } = request;
      const user = await prisma.user.findUnique({
        where: { email: request.body.paymentData.payer.email },
        select: {
          id: true,
        },
      });
      const userId = user!.id;
      let paymentInfo = {
        body: {
          transaction_amount: body.brlValue,
          description: body.paymentData.description,
          payment_method_id: body.paymentData.payment_method_id,
          payer: {
            email: body.paymentData.payer.email,
            identification: {
              type: body.paymentData.payer.identification.type,
              number: body.paymentData.payer.identification.number,
            },
          },
          installments: body?.paymentData?.installments || 1,
        },
        requestOptions: { idempotencyKey: "<SOME_UNIQUE_VALUE>" },
      };
      if (body.paymentData.token) {
        (paymentInfo.body as any).token = body.paymentData.token;
      }

      const paymentResult = await payments.create(paymentInfo);

      const order = await prisma.order.create({
        data: {
          ...orderData,
          userPaymentStatus: paymentResult?.status || "pending",
          adminPaymentStatus: "pending",
          userId: userId,
        },
      });

      return reply.status(200).send({
        paymentLink:
          paymentResult.point_of_interaction?.transaction_data?.ticket_url,
        qrCodeImg:
          paymentResult.point_of_interaction?.transaction_data?.qr_code,
        qrCodeBase64:
          paymentResult.point_of_interaction?.transaction_data?.qr_code_base64,
      });
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    "/orders/:id",
    {
      schema: {
        summary: "Get Order by ID",
        tags: ["Orders"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: any,
          404: z.object({ message: z.string() }),
        },
        preHandler: [autenticarToken],
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const order = await prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          brlValue: true,
          yuanValue: true,
          userPaymentStatus: true,
          adminPaymentStatus: true,
          proofOfPaymentId: true,
          expireAt: true,
        },
      });

      if (!order) {
        return reply.status(404).send({ message: "Order not found" });
      }

      return reply.status(200).send(order);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    "/orders",
    {
      schema: {
        summary: "Get Orders",
        tags: ["Orders"],
        response: {
          200: any,
          404: z.object({ message: z.string() }),
        },
        preHandler: [autenticarToken],
      },
    },
    async (request, reply) => {
      const orders = await prisma.order.findMany({
        select: {
          id: true,
          userId: true,
          brlValue: true,
          yuanValue: true,
          userPaymentStatus: true,
          adminPaymentStatus: true,
          proofOfPaymentId: true,
          expireAt: true,
          createdAt: true,
          paymentData: true,
          proofOfPayment: true,
          qrCode: true,
          supplierQrCodeId: true,
          updatedAt: true,
          user: true,
        },
      });

      if (!orders) {
        return reply.status(204).send({ message: "No orders" });
      }

      return reply.status(200).send(orders);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    "/orders/:id",
    {
      schema: {
        summary: "Update Order by ID",
        tags: ["Orders"],
        params: z.object({ id: z.string().uuid() }),
        body: orderSchema,
        response: {
          200: any,
          404: z.object({ message: z.string() }),
        },
        preHandler: [autenticarToken],
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const orderData = orderSchema.parse(request.body);

      const order = await prisma.order.update({
        where: { id },
        data: orderData,
        select: {
          id: true,
          userId: true,
          brlValue: true,
          yuanValue: true,
          userPaymentStatus: true,
          adminPaymentStatus: true,
          proofOfPaymentId: true,
          expireAt: true,
        },
      });

      if (!order) {
        return reply.status(404).send({ message: "Order not found" });
      }

      return reply.status(200).send(order);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
    "/orders/:id",
    {
      schema: {
        summary: "Delete Order by ID",
        tags: ["Orders"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          204: z.null(),
          404: z.object({ message: z.string() }),
        },
        preHandler: [autenticarToken],
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const order = await prisma.order.delete({
        where: { id },
      });

      if (!order) {
        return reply.status(404).send({ message: "Order not found" });
      }

      return reply.status(204).send();
    }
  );
}
