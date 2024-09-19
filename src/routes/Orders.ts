import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma";
import { any, z } from "zod";
import { autenticarToken, checkRole } from "./Auth";
import { Payment, MercadoPagoConfig } from "mercadopago";
import { v4 } from "uuid";

const client = new MercadoPagoConfig({
  accessToken: process.env.ACCESS_TOKEN || "",
});
const payments = new Payment(client);

const orderSchema = z.object({
  userId: z.string().uuid(),
  brlValue: z.number(),
  yuanValue: z.number(),
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
  userId: z.string().uuid(),
  brlValue: z.number(),
  yuanValue: z.number(),
  paymentData: z.object({
    description: z.string(),
    payment_method_id: z.string(),
    token: z.string().optional().nullish(),
    installments: z.number().optional().nullish(),
    payer: z.object({
      email: z.string(),
      identification: z.object({
        type: z.string(),
        number: z.string(),
      }),
    }),
  }),
});

const requestParamsSchema = z.object({
  id: z.string().uuid(),
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
          authorization: z.string().optional(),
        }),
        response: {
          201: z.object({
            orderId: z.string().uuid(),
            paymentLink: z.string().nullish(),
            qrCodeImg: z.string().nullish(),
            qrCodeBase64: z.string().nullish(),
          }),
          400: z.object({ message: z.string() }),
        },
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

      if (!user) {
        return reply.status(400).send({
          message: `Usuário ${request.body.paymentData.payer.email} não cadastrado no sistema`,
        });
      }

      const userId = user!.id;
      const external = v4();

      const config = await prisma.configValues.findFirst({
        select: {
          yuanPercentageIncrease: true,
        },
      });

      if (!config) {
        return reply
          .status(400)
          .send({ message: "Configure um valor de câmbio primeiro" });
      }

      const {
        brlValue,
        yuanValue: yuanValueFromRequest,
        paymentData: { payment_method_id: method },
      } = body;
      const { yuanPercentageIncrease } = config;

      const finalBrlValue = method === "pix" ? brlValue : brlValue * 1.04;

      const yuanValue = Number(
        (body.brlValue * yuanPercentageIncrease).toFixed(2)
      );

      if (yuanValue !== body.yuanValue) {
        return reply.status(400).send({ message: "Valor em yuan inválido" });
      }

      let paymentInfo = {
        body: {
          transaction_amount: finalBrlValue,
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
          external_reference: external,
          notification_url: "https://backend-p624.onrender.com/webhook",
        },
        requestOptions: { idempotencyKey: external },
      };

      if (body.paymentData.token != null) {
        (paymentInfo.body as any).token = body.paymentData.token;
      }

      let paymentResult;

      try {
        paymentResult = await payments.create(paymentInfo);
        console.log("Payment Status", paymentResult.status);
      } catch (error) {
        console.log("Erro ao processar pagamento:", error);
        return reply
          .status(400)
          .send({ message: "Erro ao processar pagamento" });
      }

      const order = await prisma.order.create({
        data: {
          ...orderData,
          brlValue: finalBrlValue,
          closed: false,
          pixInfo: {
            paymentLink:
              paymentResult.point_of_interaction?.transaction_data
                ?.ticket_url ?? "",
            qrCodeImg:
              paymentResult.point_of_interaction?.transaction_data?.qr_code ??
              "",
          },
          expireAt: paymentResult?.date_of_expiration || "",
          userPaymentStatus: paymentResult?.status || "pending",
          adminPaymentStatus: "pending",
          userId: userId,

          external_reference: external,
        },
      });

      try {
        console.log("Order created", order);
      } catch (err) {}

      if (!order) {
        return reply.status(400).send({ message: "Erro ao criar pedido" });
      }

      return reply.status(201).send({
        orderId: order.id,
        paymentLink:
          paymentResult.point_of_interaction?.transaction_data?.ticket_url ??
          "",
        qrCodeImg:
          paymentResult.point_of_interaction?.transaction_data?.qr_code ?? "",
        qrCodeBase64:
          paymentResult.point_of_interaction?.transaction_data
            ?.qr_code_base64 ?? "",
      });
    }
  );

  //ORDER BY ID
  app.withTypeProvider<ZodTypeProvider>().get(
    "/orders/:id",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Get Order by ID",
        tags: ["Orders"],
        headers: z.object({
          authorization: z.string().optional(),
        }),
        params: requestParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = requestParamsSchema.parse(request.params);

      const order = await prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          brlValue: true,
          yuanValue: true,
          userPaymentStatus: true,
          adminPaymentStatus: true,
          closed: true,
          createdAt: true,
          proofOfPayment: {
            select: {
              link: true,
            },
          },
          qrCode: {
            select: {
              link: true,
            },
          },
          user: {
            select: {
              name: true,
              phone: true,
              email: true,
            },
          },
          pixInfo: true,
        },
      });

      if (!order) {
        return reply.status(404).send({ message: "Pedido não encontrado" });
      }

      return reply.status(200).send(order);
    }
  );

  //CLOSE ORDER
  app.withTypeProvider<ZodTypeProvider>().put(
    "/orders/close/:id",
    {
      preHandler: [autenticarToken, checkRole(["ADMIN"])],
      schema: {
        summary: "Get Order by ID",
        tags: ["Orders"],
        headers: z.object({
          authorization: z.string().optional(),
        }),
        params: requestParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = requestParamsSchema.parse(request.params);

      const order = await prisma.order.update({
        where: { id },
        data: { closed: true },
      });

      if (!order) {
        return reply.status(404).send({ message: "Pedido não encontrado" });
      }

      return reply.status(200).send({ message: "Pedido fechado" });
    }
  );

  //ALL ORDERS
  app.withTypeProvider<ZodTypeProvider>().get(
    "/orders",
    {
      preHandler: [autenticarToken, checkRole(["ADMIN"])],
      schema: {
        summary: "Get Orders",
        tags: ["Orders"],
        headers: z.object({
          authorization: z.string().optional(),
        }),
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
          createdAt: true,
          closed: true,
          proofOfPayment: {
            select: {
              link: true,
            },
          },
          qrCode: {
            select: {
              link: true,
            },
          },
          user: {
            select: {
              name: true,
              phone: true,
              email: true,
            },
          },
          pixInfo: true,
        },
      });

      if (!orders) {
        return reply.status(404).send({ message: "Sem pedidos" });
      }

      return reply.status(200).send(orders);
    }
  );

  //USER ORDERS
  app.withTypeProvider<ZodTypeProvider>().get(
    "/orders/user/:id",
    {
      preHandler: autenticarToken,
      schema: {
        params: requestParamsSchema,
        headers: z.object({
          authorization: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = requestParamsSchema.parse(request.params);

      const orders = await prisma.order.findMany({
        where: {
          userId: id,
        },
        select: {
          id: true,
          userId: true,
          brlValue: true,
          yuanValue: true,
          userPaymentStatus: true,
          createdAt: true,
          adminPaymentStatus: true,
          closed: true,
          proofOfPayment: {
            select: {
              link: true,
            },
          },
          qrCode: {
            select: {
              link: true,
            },
          },
          user: {
            select: {
              name: true,
              phone: true,
              email: true,
            },
          },
          pixInfo: true,
        },
      });

      if (!orders) {
        return reply.status(404).send({ message: "No orders" });
      }

      return reply.status(200).send(orders);
    }
  );

  //UPDATE ORDER
  app.withTypeProvider<ZodTypeProvider>().put(
    "/orders/:id",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Update Order by ID",
        tags: ["Orders"],
        headers: z.object({
          authorization: z.string().optional(),
        }),
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
          proofOfPayment: {
            select: {
              link: true,
            },
          },
          qrCode: {
            select: {
              link: true,
            },
          },
          user: {
            select: {
              name: true,
              phone: true,
              email: true,
            },
          },
          pixInfo: true,
        },
      });

      if (!order) {
        return reply.status(404).send({ message: "Pedido não encontrado" });
      }

      return reply.status(200).send(order);
    }
  );

  //DELETE ORDER
  app.withTypeProvider<ZodTypeProvider>().delete(
    "/orders/:id",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Delete Order by ID",
        tags: ["Orders"],
        headers: z.object({
          authorization: z.string().optional(),
        }),
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
        return reply.status(404).send({ message: "Pedido não encontrado" });
      }

      return reply.status(204).send();
    }
  );
}
