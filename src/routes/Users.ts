import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { autenticarToken } from "./Auth";
import bcrypt from "bcrypt";

const userSchema = z.object({
  name: z.string(),
  cpf: z.string(),
  email: z.string(),
  phone: z.string(),
  password: z.string(),
});

export async function userRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/users",
    {
      schema: {
        summary: "Create User",
        tags: ["Users"],
        body: userSchema,
        response: {
          201: userSchema.extend({ id: z.string().uuid() }),
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const userData = userSchema.parse(request.body);

      // Criptografar a senha
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Criar o usuário com a senha criptografada
      const user = await prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword, // Salvar a senha criptografada
        },
        select: {
          id: true,
          name: true,
          cpf: true,
          email: true,
          phone: true,
          password: true,
        },
      });

      if (!user) {
        return reply.status(400).send({ message: "User not created" });
      }

      return reply.status(201).send(user);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    "/users/:id",
    {
      schema: {
        preHandler: autenticarToken,
        summary: "Get User by ID",
        tags: ["Users"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: userSchema.extend({ id: z.string().uuid() }),
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          cpf: true,
          email: true,
          phone: true,
          password: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      return reply.status(200).send(user);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    "/users/:id",
    {
      schema: {
        preHandler: autenticarToken,
        summary: "Update User by ID",
        tags: ["Users"],
        params: z.object({ id: z.string().uuid() }),
        body: userSchema,
        response: {
          200: userSchema.extend({ id: z.string().uuid() }),
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userData = userSchema.parse(request.body);

      const user = await prisma.user.update({
        where: { id },
        data: userData,
        select: {
          id: true,
          name: true,
          cpf: true,
          email: true,
          phone: true,
          password: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      return reply.status(200).send(user);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
    "/users/:id",
    {
      schema: {
        preHandler: autenticarToken,
        summary: "Delete User by ID",
        tags: ["Users"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          204: z.null(),
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const user = await prisma.user.delete({
        where: { id },
      });

      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      return reply.status(204).send();
    }
  );
}
