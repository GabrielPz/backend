import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import axios from "axios";
import { prisma } from "../lib/prisma";

export async function Webhook(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .post("/webhook", { config: { rawBody: true } }, async (request, reply) => {
      try {
        const { data } = request.body as any;
        const { id } = data;
        const type = (request.body as any).type;

        console.log("request body: " + JSON.stringify(request.body));
        console.log("id e type: " + id, type);

        const response = await axios.get(
          `https://api.mercadopago.com/v1/payments/${id}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.ACCESS_TOKEN || ""}`,
            },
          }
        );

        const externalReference = response.data.external_reference;
        const status = response.data.status;

        const searchOrder = await prisma.order.update({
          where: {
            external_reference: externalReference,
          },
          data: {
            userPaymentStatus: status,
          },
        });

        if (!searchOrder) {
          return reply.status(400).send({ message: "Order not found" });
        }
      } catch (error: any) {
        return reply.status(400).send({ message: error.message });
      }

      return reply.status(200).send({ message: "Webhook received" });
    });
}
