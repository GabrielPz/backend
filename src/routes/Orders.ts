import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma";
import { any, z } from "zod";
import { autenticarToken } from "./Auth";
import { Payment, MercadoPagoConfig } from "mercadopago";
import { v4 } from "uuid";

const client = new MercadoPagoConfig({
  accessToken:
    "TEST-5286490925840188-082920-39578d3eeb3e96e3071eded6e49cde67-607790691"
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
        number: z.string()
      })
    })
  })
});

const bodyShema = z.object({
  userId: z.string().uuid(),
  brlValue: z.number(),
  yuanValue: z.number(),
  expireAt: z.string(),
  paymentData: z.object({
    description: z.string(),
    payment_method_id: z.string(),
    token: z.string().optional().nullish(),
    installments: z.number().optional().nullish(),
    payer: z.object({
      email: z.string(),
      identification: z.object({
        type: z.string(),
        number: z.string()
      })
    })
  })
});

export async function orderRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/orders",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Create Order",
        tags: ["Orders"],
        body: bodyShema,
        headers: z.object({
          authorization: z.string().optional()
        }),
        response: {
          201: z.object({
            paymentLink: z.string().nullish(),
            qrCodeImg: z.string().nullish(),
            qrCodeBase64: z.string().nullish()
          }),
          400: z.object({ message: z.string() })
        }
        // preHandler: [autenticarToken]
      }
    },
    async (request, reply) => {
      const orderData = orderSchema.parse(request.body);
      const { body } = request;
      const user = await prisma.user.findUnique({
        where: { email: request.body.paymentData.payer.email },
        select: {
          id: true
        }
      });
      const userId = user!.id;
      const external = v4();
      let paymentInfo = {
        body: {
          transaction_amount: body.brlValue,
          description: body.paymentData.description,
          payment_method_id: body.paymentData.payment_method_id,
          payer: {
            email: body.paymentData.payer.email,
            identification: {
              type: body.paymentData.payer.identification.type,
              number: body.paymentData.payer.identification.number
            }
          },
          installments: body?.paymentData?.installments || 1,
          external_reference: external
        },
        requestOptions: { idempotencyKey: external }
      };
      if (body.paymentData.token != null) {
        (paymentInfo.body as any).token = body.paymentData.token;
      }

      let paymentResult;
      try {
        paymentResult = await payments.create(paymentInfo);
      } catch (error) {
        console.log("Erro ao processar pagamento:", error);
        return reply
          .status(400)
          .send({ message: "Erro ao processar pagamento" });
      }
      console.log(paymentResult);

      const order = await prisma.order.create({
        data: {
          ...orderData,
          userPaymentStatus: paymentResult?.status || "pending",
          adminPaymentStatus: "pending",
          userId: userId,
          external_reference: external
        }
      });

      if (!order) {
        return reply.status(400).send({ message: "Order not created" });
      }

      console.log("deu certo a criacao da order");

      console.log(
        paymentResult.point_of_interaction?.transaction_data?.ticket_url ?? ""
      );
      console.log(
        paymentResult.point_of_interaction?.transaction_data?.qr_code ?? ""
      );
      console.log(
        paymentResult.point_of_interaction?.transaction_data?.qr_code_base64 ??
          ""
      );

      return reply.status(201).send({
        paymentLink:
          paymentResult.point_of_interaction?.transaction_data?.ticket_url ??
          "",
        qrCodeImg:
          paymentResult.point_of_interaction?.transaction_data?.qr_code ?? "",
        qrCodeBase64:
          paymentResult.point_of_interaction?.transaction_data
            ?.qr_code_base64 ?? ""
      });
    }
  );

  interface PaymentData {
    description: string;
    payment_method_id: string;
    payer: {
      email: string;
      identification: {
        type: string;
        number: string;
      };
    };
    token?: string | null;
    installments?: number | null;
  }

  interface Order {
    id: string;
    userId: string;
    brlValue: number;
    yuanValue: number;
    userPaymentStatus: string;
    adminPaymentStatus: string;
    expireAt: string;
    paymentData: PaymentData;
    proofOfPayment?: { link: string } | null;
    qrCode?: { link: string } | null;
    user: { phone: string };
    createdAt: Date;
    updatedAt: Date;
  }

  app.withTypeProvider<ZodTypeProvider>().get(
    "/orders/:id",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Get Order by ID",
        tags: ["Orders"],
        headers: z.object({
          authorization: z.string().optional()
        }),
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: any,
          404: z.object({ message: z.string() })
        },
        preHandler: [autenticarToken]
      }
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
          expireAt: true
        }
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
      preHandler: autenticarToken,
      schema: {
        summary: "Get Orders",
        tags: ["Orders"],
        headers: z.object({
          authorization: z.string().optional()
        })
      }
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
          expireAt: true,
          createdAt: true,
          paymentData: true,
          proofOfPayment: true,
          qrCode: true,
          updatedAt: true,
          user: true
        }
      });

      if (!orders) {
        return reply.status(404).send({ message: "No orders" });
      }

      return reply.status(200).send(orders);
    }
  );

  const requestParamsSchema = z.object({
    id: z.string().uuid()
  });

  app.withTypeProvider<ZodTypeProvider>().get(
    "/orders/user/:id",
    {
      preHandler: autenticarToken,
      schema: {
        // summary: "Get Orders",
        // tags: ["Orders"],
        params: requestParamsSchema,
        headers: z.object({
          authorization: z.string().optional()
        })
      }
    },
    async (request, reply) => {
      const { id } = requestParamsSchema.parse(request.params);

      const orders = await prisma.order.findMany({
        where: {
          userId: id
        },
        select: {
          id: true,
          userId: true,
          brlValue: true,
          yuanValue: true,
          userPaymentStatus: true,
          adminPaymentStatus: true,
          expireAt: true,
          createdAt: true,
          paymentData: true,
          proofOfPayment: true,
          qrCode: true,
          updatedAt: true,
          user: true
        }
      });

      if (!orders) {
        return reply.status(404).send({ message: "No orders" });
      }

      return reply.status(200).send(orders);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    "/orders/:id",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Update Order by ID",
        tags: ["Orders"],
        headers: z.object({
          authorization: z.string().optional()
        }),
        params: z.object({ id: z.string().uuid() }),
        body: orderSchema,
        response: {
          200: any,
          404: z.object({ message: z.string() })
        },
        preHandler: [autenticarToken]
      }
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
          expireAt: true
        }
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
      preHandler: autenticarToken,
      schema: {
        summary: "Delete Order by ID",
        tags: ["Orders"],
        headers: z.object({
          authorization: z.string().optional()
        }),
        params: z.object({ id: z.string().uuid() }),
        response: {
          204: z.null(),
          404: z.object({ message: z.string() })
        },
        preHandler: [autenticarToken]
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const order = await prisma.order.delete({
        where: { id }
      });

      if (!order) {
        return reply.status(404).send({ message: "Order not found" });
      }

      return reply.status(204).send();
    }
  );
}
