import fastify, { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { autenticarToken, checkRole } from "./Auth";

const yuanSchema = z.object({
  yuanPercentageIncrease: z.number(),
});

const convertBrlSchema = z.object({
  brlValue: z.number(),
});

export async function yuanRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/yuan",
    {
      preHandler: [autenticarToken, checkRole(["ADMIN"])],
      schema: {
        summary: "Create Yuan Config",
        tags: ["Yuan"],
        body: yuanSchema,
        headers: z.object({
          authorization: z.string().optional(),
        }),
        response: {
          201: yuanSchema.extend({ id: z.string().uuid() }),
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const yuanData = yuanSchema.parse(request.body);
      const config = await prisma.configValues.create({
        data: yuanData,
        select: {
          id: true,
          yuanPercentageIncrease: true,
        },
      });

      if (!config) {
        return reply.status(400).send({ message: "Config not created" });
      }

      return reply.status(201).send(config);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    "/yuan",
    {
      schema: {
        summary: "Get Yuan Configs",
        tags: ["Yuan"],
        response: {
          200: z.array(yuanSchema.extend({ id: z.string().uuid() })),
        },
      },
    },
    async (request, reply) => {
      const configs = await prisma.configValues.findMany({
        select: {
          id: true,
          yuanPercentageIncrease: true,
        },
      });

      return reply.status(200).send(configs);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    "/yuan",
    {
      preHandler: [autenticarToken, checkRole(["ADMIN"])],
      schema: {
        summary: "Update Yuan Config",
        tags: ["Yuan"],
        body: yuanSchema,
        headers: z.object({
          authorization: z.string().optional(),
        }),
        response: {
          200: yuanSchema.extend({ id: z.string().uuid() }),
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const yuanData = yuanSchema.parse(request.body);

      const existingConfig = await prisma.configValues.findFirst();

      let updatedConfig;
      if (existingConfig) {
        updatedConfig = await prisma.configValues.update({
          where: { id: existingConfig.id },
          data: yuanData,
          select: {
            id: true,
            yuanPercentageIncrease: true,
          },
        });
      } else {
        updatedConfig = await prisma.configValues.create({
          data: yuanData,
          select: {
            id: true,
            yuanPercentageIncrease: true,
          },
        });
      }

      return reply.status(200).send(updatedConfig);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    "/convert-brl-to-yuan",
    {
      preHandler: autenticarToken,
      schema: {
        headers: z.object({
          authorization: z.string().optional(),
        }),
        summary: "Convert BRL to Yuan",
        tags: ["Conversion"],
        body: convertBrlSchema,
        response: {
          200: z.object({
            brlValue: z.number(),
            convertedValue: z.number(),
            yuanPercentageIncrease: z.number(),
          }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const { brlValue } = convertBrlSchema.parse(request.body);

        const config = await prisma.configValues.findFirst({
          select: {
            yuanPercentageIncrease: true,
          },
        });

        if (!config) {
          return reply
            .status(400)
            .send({ message: "Yuan configuration not found" });
        }

        const convertedValue = Number(
          (brlValue * config.yuanPercentageIncrease).toFixed(2)
        );

        return reply.status(200).send({
          brlValue,
          convertedValue,
          yuanPercentageIncrease: config.yuanPercentageIncrease,
        });
      } catch (error: any) {
        return reply.status(400).send({ message: error.message });
      }
    }
  );
}
