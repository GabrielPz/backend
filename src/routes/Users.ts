import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { autenticarToken, checkRole } from "./Auth";
import bcrypt from "bcrypt";
import speakeasy from "speakeasy";
import { transporter } from "../services/nodeMailer";

const userSchema = z.object({
  name: z.string(),
  cpf: z.string(),
  email: z.string(),
  phone: z.string(),
  password: z.string(),
});

const updateroleSchema = z.object({
  role: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const validateCodeSchema = z.object({
  email: z.string().email(),
  code: z.string(),
  password: z.string().min(6),
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
          role: "PARTICIPANT", // Default role is PARTICIPANT
        },
        select: {
          id: true,
          name: true,
          cpf: true,
          email: true,
          phone: true,
          password: true,
          role: true,
        },
      });

      if (!user) {
        return reply.status(400).send({ message: "User not created" });
      }

      return reply.status(201).send(user);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    "/forgot-password",
    {
      schema: {
        summary: "Forgot Password",
        tags: ["Users"],
        body: forgotPasswordSchema,
        response: {
          201: userSchema.extend({ message: z.string() }),
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const { email } = forgotPasswordSchema.parse(request.body);

        const user = await prisma.user.findUnique({
          where: {
            email: email,
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (!user) {
          return reply.status(400).send({ message: "User does not exists" });
        }

        const secret = speakeasy.generateSecret({ length: 6 });
        const code = secret.base32;
        const nomeUser = user.name;

        const dataAtual = new Date();
        dataAtual.setHours(dataAtual.getHours() + 3);

        transporter.sendMail(
          {
            from: process.env.SMTP_EMAIL,
            to: email,
            subject: "HRX Recuperação de senha",
            text: `Olá ${nomeUser} sua chave secreta é: ${code}, validade de 3 horas. sds, equipe HRX`,
          },
          (error: Error, info: any) => {
            if (error) {
              console.error(error);
            } else {
              console.log(
                "Chave secreta 2FA enviada com sucesso: " + info.response
              );
            }
          }
        );

        const updateUser = await prisma.forgotPassword.upsert({
          where: {
            userId: user.id,
          },
          update: {
            token: code,
            expires: dataAtual,
          },
          create: {
            token: code,
            expires: dataAtual,
            userId: user.id,
          },
        });

        return reply.status(200).send({ message: "Token sent successfully" });
      } catch (error) {
        return reply.status(500).send({ message: "Internal server error" });
      }
    }
  );
  app.withTypeProvider<ZodTypeProvider>().post(
    "/validate-code-password",
    {
      schema: {
        summary: "Validate Code Password",
        tags: ["Users"],
        body: validateCodeSchema,
        response: {
          201: userSchema.extend({ message: z.string() }),
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const { email, code, password } = validateCodeSchema.parse(
          request.body
        );

        const user = await prisma.user.findUnique({
          where: {
            email: email,
          },
        });

        if (!user) {
          return reply.status(400).send({ message: "Usuário não existe" });
        }

        const searchCodeUser = await prisma.forgotPassword.findUnique({
          where: {
            userId: user.id,
          },
        });

        if (!searchCodeUser) {
          return reply.status(401).send({ message: "Código não existe" });
        }

        if (searchCodeUser.token != code) {
          return reply.status(402).send({ message: "Código é inválido" });
        }

        const dataAtual = new Date();

        if (dataAtual > searchCodeUser.expires) {
          return reply.status(403).send({ message: "Código foi expirado" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const updateUser = await prisma.user.update({
          where: {
            email: email,
          },
          data: {
            password: hashedPassword,
          },
        });

        return reply
          .status(200)
          .send({ message: "Senha atualizada com sucesso" });
      } catch (error) {
        return reply.status(500).send({ message: "Internal server error" });
      }
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    "/users/:id",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Get User by ID",
        tags: ["Users"],
        params: z.object({ id: z.string().uuid() }),
        headers: z.object({
          authorization: z.string().optional(),
        }),
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
      preHandler: autenticarToken,
      schema: {
        summary: "Update User by ID",
        tags: ["Users"],
        headers: z.object({
          authorization: z.string().optional(),
        }),
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
  app.withTypeProvider<ZodTypeProvider>().put(
    "/users/update-role/:id",
    {
      preHandler: [autenticarToken, checkRole(["ADMIN"])],
      schema: {
        summary: "Update role by User ID",
        tags: ["Users"],
        headers: z.object({
          authorization: z.string().optional(),
        }),
        params: z.object({ id: z.string().uuid() }),
        body: updateroleSchema,
        response: {
          200: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const reqBody = updateroleSchema.parse(request.body);

      if (reqBody.role !== "ADMIN" && reqBody.role !== "PARTICIPANT") {
        return reply.status(400).send({
          message: "Invalid Role, available option: PARTICIPANT, ADMIN",
        });
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          role: reqBody.role,
        },
        select: {
          id: true,
          name: true,
          cpf: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ message: "Usuário não encontrado" });
      }

      return reply
        .status(200)
        .send({ message: "Permissões atualizadas com sucesso" });
    }
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
    "/users/:id",
    {
      preHandler: autenticarToken,
      schema: {
        summary: "Delete User by ID",
        tags: ["Users"],
        headers: z.object({
          authorization: z.string().optional(),
        }),
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
